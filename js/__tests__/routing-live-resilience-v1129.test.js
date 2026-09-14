import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

function makeWay(id, coords, nodeIds, opts = {}) {
  return {
    id,
    maxSpeed: opts.maxSpeed ?? 120,
    maxSpeedSource: 'OSM',
    electrified: true,
    electrifiedMode: 'contact_line',
    voltage: [25000], frequency: [50], gauge: [1435], tracks: 1,
    usage: opts.usage ?? 'main', service: opts.service ?? '', railway: 'rail',
    preferredDirection: '', bidirectional: '', trainProtection: {},
    name: '', ref: '', trackRef: '', tags: {},
    geometry: coords.map(([lat,lon])=>({lat,lon})),
    nodeIds: nodeIds || [],
  };
}

test('V1.1.99 HOTFIX3 routing endpoints are global-only and pre-all-track rail cache is invalidated', () => {
  const src = fs.readFileSync(new URL('../orm.js', import.meta.url), 'utf8');
  assert.ok(src.includes('https://overpass.private.coffee/api/interpreter'));
  assert.ok(src.includes('https://overpass-api.de/api/interpreter'));
  assert.ok(!src.includes("'https://overpass.osm.ch/api/interpreter'"));
  assert.ok(!src.includes("'https://overpass.kumi.systems/api/interpreter'"));
  assert.ok(src.includes('const key = `v7-all-orm-tracks:')); 
});

test('V1.1.29 local graph uses shared OSM node ids as topology even if geometry coordinates differ slightly', async () => {
  const orm = new ORMClient();
  const ways = [
    makeWay(1, [[48.0,2.0],[48.0100001,2.0100001]], [100,200]),
    // same OSM junction node 200, intentionally slightly different coordinate precision
    makeWay(2, [[48.0100012,2.0100012],[48.02,2.02]], [200,300]),
  ];
  const graph = await orm._buildGraphFromWaysAsync(ways);
  assert.ok(graph.nodes.has('osm-node:100'));
  assert.ok(graph.nodes.has('osm-node:200'));
  assert.ok(graph.nodes.has('osm-node:300'));
  const route = orm.dijkstra(graph,'osm-node:100','osm-node:300',{directed:false,allowFallback:false});
  assert.ok(route && route.length >= 3, 'shared OSM node id keeps the two ways connected');
  assert.equal(orm.isFallbackRoute(route), false);
});

test('V1.1.29 cursor routing falls back to the already-loaded real ORM graph, never a synthetic line', async () => {
  const orm = new ORMClient();
  const way = makeWay(10, [[48.0,2.0],[48.01,2.01],[48.02,2.02]], [1000,1001,1002]);
  orm._ways.set(way.id, way);
  orm._graphDirty = true;
  orm._findCursorLegLocal = async () => null; // simulate incomplete/failed local corridor
  orm._findCursorLegBroadArea = async () => null; // loaded graph must rescue before another network request
  const route = await orm.findRouteViaCursorAnchors([
    {lat:48.0001,lon:2.0001},
    {lat:48.0199,lon:2.0199},
  ], {allowFallback:false});
  assert.ok(route && route.length >= 3, 'loaded ORM graph rescued the route');
  assert.equal(orm.isFallbackRoute(route), false);
});

test('V1.1.29 cursor routing uses one continuous broad-area query when tiled local routing is incomplete', async () => {
  const orm = new ORMClient();
  const way = makeWay(20, [[48.0,2.0],[48.01,2.01],[48.02,2.02]], [2000,2001,2002]);
  orm._findCursorLegLocal = async () => null;
  orm.fetchArea = async () => [way];
  // force the loaded-graph rescue to miss so the continuous bbox fallback is exercised
  orm._findCursorLegLoadedGraph = async () => null;
  const route = await orm.findRouteViaCursorAnchors([
    {lat:48.0001,lon:2.0001},
    {lat:48.0199,lon:2.0199},
  ], {allowFallback:false});
  assert.ok(route && route.length >= 3);
  assert.equal(orm.isFallbackRoute(route), false);
});


test('V1.1.30 loaded-way rescue preserves mid-segment cursor anchors instead of jumping to geometry nodes', async () => {
  const orm = new ORMClient();
  const way = makeWay(30, [[48.0,2.0],[48.0,2.20]], [3000,3001]);
  orm._ways.set(way.id, way);
  orm._findCursorLegLocal = async () => null;
  orm._findCursorLegBroadArea = async () => null;
  const route = await orm.findRouteViaCursorAnchors([
    {lat:48.0,lon:2.04},
    {lat:48.0,lon:2.16},
  ], {allowFallback:false});
  assert.ok(route && route.length >= 2);
  assert.ok(Math.abs(route[0].lon-2.04) < 1e-6, `start stayed on cursor projection: ${route[0].lon}`);
  assert.ok(Math.abs(route.at(-1).lon-2.16) < 1e-6, `end stayed on cursor projection: ${route.at(-1).lon}`);
});

test('V1.1.30 two VIA on the same long OSM segment remain routable even when nearest-node fallback would collapse them', async () => {
  const orm = new ORMClient();
  const way = makeWay(31, [[48.0,2.0],[48.0,2.30]], [3100,3101]);
  orm._ways.set(way.id, way);
  orm._findCursorLegLocal = async () => null;
  orm._findCursorLegBroadArea = async () => null;
  const route = await orm.findRouteViaCursorAnchors([
    {lat:48.0,lon:2.03},
    {lat:48.0,lon:2.07},
  ], {allowFallback:false});
  assert.ok(route && route.length >= 2);
  assert.ok(Math.abs(route[0].lon-2.03) < 1e-6);
  assert.ok(Math.abs(route.at(-1).lon-2.07) < 1e-6);
});

test('V1.1.30 chained VIA keeps one continuous resolved anchor through successive rail legs', async () => {
  const orm = new ORMClient();
  const way = makeWay(32, [[48.0,2.0],[48.0,2.10],[48.0,2.20]], [3200,3201,3202]);
  orm._ways.set(way.id, way);
  orm._findCursorLegLocal = async () => null;
  orm._findCursorLegBroadArea = async () => null;
  const route = await orm.findRouteViaCursorAnchors([
    {lat:48.0,lon:2.02},
    {lat:48.0,lon:2.115},
    {lat:48.0,lon:2.18},
  ], {allowFallback:false});
  assert.ok(route && route.length >= 3);
  assert.ok(route.some(p => Math.abs(p.lon-2.115) < 1e-6), 'resolved VIA is physically present in full geometry');
  for(let i=1;i<route.length;i++) assert.ok(Math.abs(route[i].lon-route[i-1].lon) < 0.101, 'no missing chunk between route points');
});
