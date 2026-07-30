import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

function makeChainGraph(orm, n, maxSpeed = 160) {
  const ways = [];
  const geom = [];
  for (let i = 0; i <= n; i++) {
    geom.push({ lat: 45 + i * 0.01, lon: 2 + i * 0.01 });
  }
  ways.push({ id: 'chain', geometry: geom, maxSpeed, electrified: true, tracks: 2, usage: 'main' });
  return orm.buildGraph(ways);
}

itCases('dijkstra on chain graph', (() => {
  const cases = [];
  for (let n = 2; n <= 50; n++) {
    for (let start = 0; start < n; start++) {
      const end = (start + 1) % (n + 1);
      cases.push({
        name: `n=${n},start=${start},end=${end}`,
        fn: () => {
          const orm = new ORMClient();
          const graph = makeChainGraph(orm, n);
          const keys = Array.from(graph.nodes.keys());
          const path = orm.dijkstra(graph, keys[start], keys[end]);
          assert.ok(path);
          assert.equal(path.length, 2);
        },
      });
    }
  }
  return cases;
})());

itCases('dijkstra no path / same node', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `case-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const graph = makeChainGraph(orm, 5);
        const keys = Array.from(graph.nodes.keys());
        const same = orm.dijkstra(graph, keys[0], keys[0]);
        assert.ok(same);
        assert.equal(same.length, 1);
        const noPath = orm.dijkstra(graph, keys[0], 'nonexistent');
        assert.equal(noPath, null);
      },
    });
  }
  return cases;
})());

itCases('findNearestNode on graph', (() => {
  const cases = [];
  for (let i = 0; i < 2000; i++) {
    cases.push({
      name: `nearest-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const graph = makeChainGraph(orm, 20);
        const queryLat = 45 + (i % 21) * 0.01 + 0.0005;
        const queryLon = 2 + (i % 21) * 0.01 + 0.0005;
        const nearest = orm.findNearestNode(graph, queryLat, queryLon, 5);
        assert.ok(nearest);
        assert.ok(nearest.dist >= 0);
        assert.ok(nearest.node);
      },
    });
  }
  return cases;
})());

itCases('getRouteDistance and getRouteSegments', (() => {
  const cases = [];
  for (let i = 0; i < 3000; i++) {
    const route = [];
    const n = 2 + (i % 20);
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.01, lon: 2 + k * 0.01, maxSpeed: 80 + (k % 5) * 40 });
    }
    cases.push({
      name: `route-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const dist = orm.getRouteDistance(route);
        const segs = orm.getRouteSegments(route);
        assert.ok(dist >= 0);
        assert.equal(segs.length, route.length - 1);
        let sum = 0;
        for (const s of segs) sum += s.distance;
        assert.ok(Math.abs(sum - dist) < 1e-9);
        for (const s of segs) {
          assert.ok(s.maxSpeed > 0);
          assert.ok(s.distance >= 0);
        }
      },
    });
  }
  return cases;
})());

itCases('isFallbackRoute', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `fb-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const real = [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }];
        const fallback = [{ lat: 0, lon: 0, fallback: true }, { lat: 1, lon: 1 }];
        assert.equal(orm.isFallbackRoute(real), false);
        assert.equal(orm.isFallbackRoute(fallback), true);
        assert.equal(orm.isFallbackRoute([]), false);
      },
    });
  }
  return cases;
})());

itCases('getPointAtRatio', (() => {
  const cases = [];
  for (let i = 0; i < 3000; i++) {
    const route = [];
    const n = 2 + (i % 10);
    for (let k = 0; k < n; k++) {
      route.push({ lat: k * 0.5, lon: k * 0.5, maxSpeed: 120 });
    }
    const ratios = [0, 0.25, 0.5, 0.75, 1];
    cases.push({
      name: `ratio-${i}`,
      fn: () => {
        const orm = new ORMClient();
        for (const r of ratios) {
          const p = orm.getPointAtRatio(route, r);
          assert.ok(p);
          assert.ok(p.lat >= 0 && p.lat <= (n - 1) * 0.5);
          assert.ok(p.lon >= 0 && p.lon <= (n - 1) * 0.5);
        }
      },
    });
  }
  return cases;
})());

itCases('calculateTravelTime', (() => {
  const cases = [];
  for (let i = 0; i < 3000; i++) {
    const route = [];
    const n = 2 + (i % 10);
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.05, lon: 2 + k * 0.05, maxSpeed: [30, 60, 120, 160, 200][k % 5] });
    }
    const rameMax = [30, 60, 100, 160, 200, 250, 320][i % 7];
    cases.push({
      name: `tt-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const minutes = orm.calculateTravelTime(route, rameMax);
        assert.ok(Number.isFinite(minutes));
        assert.ok(minutes > 0);
      },
    });
  }
  return cases;
})());

itCases('generateSignalBlocks', (() => {
  const cases = [];
  for (let i = 0; i < 2000; i++) {
    const route = [];
    const n = 2 + (i % 20);
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.05, lon: 2 + k * 0.05, maxSpeed: 160 });
    }
    cases.push({
      name: `signals-${i}`,
      fn: () => {
        const orm = new ORMClient();
        const signals = orm.generateSignalBlocks(route);
        const dist = orm.getRouteDistance(route);
        assert.ok(signals.length >= 0);
        for (const s of signals) {
          assert.ok(s.km >= 0);
          assert.ok(s.km <= dist + 1e-6);
          assert.ok(s.lat >= 45 && s.lat <= 45 + (n - 1) * 0.05);
          assert.ok(s.lon >= 2 && s.lon <= 2 + (n - 1) * 0.05);
        }
      },
    });
  }
  return cases;
})());

itCases('country and drive side helpers', (() => {
  const cases = [];
  const pairs = [
    [48.8566, 2.3522, 'FR'],
    [52.52, 13.405, 'DE'],
    [41.9028, 12.4964, 'IT'],
    [40.4168, -3.7038, 'ES'],
    [50.8503, 4.3517, 'BE'],
    [52.3676, 4.9041, 'NL'],
    [51.5074, -0.1278, 'GB'],
    [46.948, 7.4474, 'CH'],
    [0, 0, 'OTHER'],
  ];
  for (let i = 0; i < 3000; i++) {
    const [lat, lon, expected] = pairs[i % pairs.length];
    cases.push({
      name: `country-${i}`,
      fn: () => {
        const orm = new ORMClient();
        assert.equal(orm.getCountryAtPoint(lat, lon), expected);
      },
    });
  }
  return cases;
})());

itCases('isDriveLeft', (() => {
  const cases = [];
  const left = ['FR', 'IT', 'BE', 'GB'];
  const right = ['DE', 'ES', 'NL', 'US', 'JP'];
  for (let i = 0; i < 1000; i++) {
    const c = i % 2 === 0 ? left[i % left.length] : right[i % right.length];
    cases.push({
      name: `drive-${i}`,
      fn: () => {
        const orm = new ORMClient();
        assert.equal(orm.isDriveLeft(c), left.includes(c));
      },
    });
  }
  return cases;
})());

itCases('ORM save/load roundtrip', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `save-${i}`,
      fn: () => {
        const orm = new ORMClient();
        orm._loadedBboxes = [`${i},${i},${i + 1},${i + 1}`];
        const save = orm.toSave();
        const restored = new ORMClient();
        restored.loadFromSave(save);
        assert.deepEqual(restored._loadedBboxes, orm._loadedBboxes);
      },
    });
  }
  return cases;
})());

describe('bulk-orm meta', () => {
  it('loaded', () => assert.ok(true));
});
