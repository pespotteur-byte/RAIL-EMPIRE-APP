// Tests for the directed ORM routing graph (Remaster P0 — PR 1).
// Covers checklist IDs R-01..R-06:
//   R-01 directed infrastructure graph (edges carry a running direction + metadata)
//   R-02 real Dijkstra/A* routing on ORM ways, weighted by travel time
//   R-03 no straight-line fallback for long routes
//   R-04 no arbitrary reverse / wrong-way movement
//   R-05 routing works over long distance (>= 1200 km)
//   R-06 spatial index for nearest-node queries
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

// Build a synthetic OSM "way" from a list of [lat, lon] points.
function makeWay(id, coords, opts = {}) {
  return {
    id,
    maxSpeed: opts.maxSpeed ?? 160,
    electrified: opts.electrified ?? true,
    tracks: opts.tracks ?? 1,
    usage: opts.usage ?? 'main',
    service: opts.service ?? '',
    name: opts.name ?? '',
    ref: opts.ref ?? '',
    geometry: coords.map(([lat, lon]) => ({ lat, lon })),
    nodeIds: [],
  };
}

// Register ways into an ORMClient and force a graph rebuild.
function clientWithWays(ways) {
  const orm = new ORMClient();
  for (const w of ways) orm._ways.set(w.id, w);
  orm._graphDirty = true;
  return orm;
}

const key = (lat, lon) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

describe('ORM directed routing graph', () => {
  describe('R-01 — directed graph with edge metadata', () => {
    it('builds nodes whose edges carry direction (from/to) and ORM metadata', () => {
      const orm = clientWithWays([
        makeWay(1, [[48.0, 2.0], [48.0, 2.1], [48.0, 2.2]], { maxSpeed: 200, usage: 'main' }),
      ]);
      const g = orm._ensureGraph();
      assert.ok(g.nodes.size === 3, 'three distinct nodes');
      const mid = g.nodes.get(key(48.0, 2.1));
      assert.ok(mid, 'middle node exists');
      // Middle node connects both ways (bidirectional physical track = 2 directed edges)
      assert.equal(mid.edges.length, 2);
      for (const e of mid.edges) {
        assert.ok(e.from && e.to && e.from !== e.to, 'edge has a direction');
        assert.equal(e.maxSpeed, 200, 'carries ORM maxSpeed');
        assert.equal(e.usage, 'main', 'carries ORM usage');
        assert.equal(typeof e.dist, 'number');
      }
    });
  });

  describe('R-06 — spatial index', () => {
    it('attaches a spatial index and finds the nearest node matching brute force', () => {
      const coords = [];
      for (let i = 0; i <= 50; i++) coords.push([48.0 + i * 0.01, 2.0]);
      const orm = clientWithWays([makeWay(1, coords)]);
      const g = orm._ensureGraph();
      assert.ok(g._index && g._index.cells.size > 0, 'spatial index built');

      const target = { lat: 48.234, lon: 2.001 };
      const viaIndex = orm.findNearestNode(g, target.lat, target.lon, 5);
      // brute-force reference
      let best = null, bd = Infinity;
      for (const [, n] of g.nodes) {
        const d = Math.hypot(n.lat - target.lat, n.lon - target.lon);
        if (d < bd) { bd = d; best = n; }
      }
      assert.ok(viaIndex, 'index returned a node');
      assert.equal(viaIndex.node.key, best.key, 'index nearest == brute-force nearest');
    });

    it('respects the maxDist radius (returns null when nothing is close enough)', () => {
      const orm = clientWithWays([makeWay(1, [[48.0, 2.0], [48.0, 2.1]])]);
      const g = orm._ensureGraph();
      const far = orm.findNearestNode(g, 40.0, -5.0, 2); // Spain, far away
      assert.equal(far, null);
    });
  });

  describe('R-02 — Dijkstra/A* follows the track', () => {
    it('returns a path that traverses every intermediate node of a bent line', () => {
      const coords = [[48.0, 2.0], [48.05, 2.05], [48.1, 2.0], [48.15, 2.1]];
      const orm = clientWithWays([makeWay(1, coords, { maxSpeed: 160 })]);
      const g = orm._ensureGraph();
      const path = orm.dijkstra(g, key(48.0, 2.0), key(48.15, 2.1));
      assert.ok(path && path.length === 4, 'path visits all 4 nodes');
      assert.equal(path[0].lat, 48.0);
      assert.equal(path[path.length - 1].lat, 48.15);
      // Real ORM route, never a fallback straight line
      assert.equal(orm.isFallbackRoute(path), false);
    });

    it('prefers the faster main line over a shorter but slower service track (time-weighted)', () => {
      // Main line dips south (longer distance) but is fast (200 km/h)
      const main = makeWay(1, [[48.0, 2.0], [47.95, 2.10], [48.0, 2.20]], { maxSpeed: 200, usage: 'main' });
      // Service track is a near-straight shortcut but capped at 30 km/h (siding)
      const svc = makeWay(2, [[48.0, 2.0], [48.0, 2.10], [48.0, 2.20]], { maxSpeed: 160, service: 'siding' });
      const orm = clientWithWays([main, svc]);
      const g = orm._ensureGraph();
      const path = orm.dijkstra(g, key(48.0, 2.0), key(48.0, 2.20));
      assert.ok(path, 'route found');
      // The chosen route must dip south through the main-line node (lat < 48)
      assert.ok(path.some(p => p.lat < 47.99), 'took the faster main line, not the slow siding');
    });
  });

  describe('R-04 — no arbitrary reverse / wrong-way movement', () => {
    it('_turnPenalty forbids a U-turn on the same physical track', () => {
      const orm = clientWithWays([makeWay(1, [[48.0, 2.0], [48.0, 2.1]])]);
      const g = orm._ensureGraph();
      const a = g.nodes.get(key(48.0, 2.0));
      const fwd = a.edges[0]; // 2.0 -> 2.1
      const b = g.nodes.get(key(48.0, 2.1));
      const back = b.edges.find(e => e.to === fwd.from && e.wayId === fwd.wayId); // 2.1 -> 2.0
      assert.ok(back, 'reverse edge exists physically');
      assert.equal(orm._turnPenalty(g, fwd, back, true), Infinity, 'reversal forbidden');
    });

    it('_turnPenalty penalises a sharp (>100°) turn but not a gentle one', () => {
      // Y: from A->B (going east), then B->C sharp back-west vs B->D gentle
      const orm = clientWithWays([
        makeWay(1, [[48.0, 2.0], [48.0, 2.1]]),           // A->B east
        makeWay(2, [[48.0, 2.1], [48.02, 2.11]]),          // B->D gentle NE
        makeWay(3, [[48.0, 2.1], [48.0, 2.0005]]),         // B->~A sharp west (near reversal)
      ]);
      const g = orm._ensureGraph();
      const b = g.nodes.get(key(48.0, 2.1));
      const inEdge = g.nodes.get(key(48.0, 2.0)).edges[0]; // A->B
      const gentle = b.edges.find(e => e.wayId === 2);
      const sharp = b.edges.find(e => e.wayId === 3);
      assert.equal(orm._turnPenalty(g, inEdge, gentle, true), 0, 'gentle turn: no penalty');
      assert.equal(orm._turnPenalty(g, inEdge, sharp, true), orm._reversalPenaltyH, 'sharp turn penalised');
    });

    it('a computed route never visits the same node twice', () => {
      const coords = [];
      for (let i = 0; i <= 30; i++) coords.push([48.0 + i * 0.01, 2.0 + Math.sin(i / 5) * 0.02]);
      const orm = clientWithWays([makeWay(1, coords)]);
      const g = orm._ensureGraph();
      const path = orm.dijkstra(g, key(coords[0][0], coords[0][1]), key(coords[30][0], coords[30][1]));
      assert.ok(path);
      const seen = new Set();
      for (const p of path) {
        const k = key(p.lat, p.lon);
        assert.ok(!seen.has(k), `no revisit of ${k}`);
        seen.add(k);
      }
    });
  });

  describe('R-03 — no straight-line fallback for long routes', () => {
    it('makeFallbackRoute returns null beyond 1 km and a tagged stub within 1 km', () => {
      const orm = new ORMClient();
      assert.equal(orm.makeFallbackRoute(48.0, 2.0, 49.0, 3.0), null, 'long: no diagonal');
      const stub = orm.makeFallbackRoute(48.0, 2.0, 48.004, 2.004); // < 1 km
      assert.ok(Array.isArray(stub) && stub.length > 1, 'short connector produced');
      assert.equal(orm.isFallbackRoute(stub), true, 'tagged as fallback');
    });

    it('routing between two disconnected components returns null (not a straight line)', () => {
      const orm = clientWithWays([
        makeWay(1, [[48.0, 2.0], [48.0, 2.1]]),   // component A
        makeWay(2, [[50.0, 5.0], [50.0, 5.1]]),   // component B (disconnected)
      ]);
      const g = orm._ensureGraph();
      const path = orm.dijkstra(g, key(48.0, 2.0), key(50.0, 5.1));
      assert.equal(path, null, 'no route => null, never a diagonal');
    });

    it('travel-time helpers are null-safe when no route exists', () => {
      const orm = new ORMClient();
      assert.equal(orm.getRouteDistance(null), 0);
      assert.deepEqual(orm.getRouteSegments(null), []);
      assert.equal(orm.calculateTravelTime(null, 160), 1);
    });
  });

  describe('R-05 — long distance (>= 1200 km)', () => {
    it('routes end to end over a > 1200 km chain', () => {
      // ~0.02° lat steps ≈ 2.2 km. 600 steps ≈ 1330 km north-south chain.
      const coords = [];
      for (let i = 0; i <= 600; i++) coords.push([44.0 + i * 0.02, 2.0]);
      const orm = clientWithWays([makeWay(1, coords, { maxSpeed: 200 })]);
      const g = orm._ensureGraph();
      const t0 = Date.now();
      const path = orm.dijkstra(g, key(coords[0][0], coords[0][1]), key(coords[600][0], coords[600][1]));
      const ms = Date.now() - t0;
      assert.ok(path && path.length === 601, 'full chain routed');
      const distKm = orm.getRouteDistance(path);
      assert.ok(distKm >= 1200, `route length ${distKm.toFixed(0)} km >= 1200 km`);
      assert.ok(ms < 3000, `routed in ${ms} ms`);
    });
  });
});
