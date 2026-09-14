import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { VoiePointManager } from '../voie-points.js';
import { World } from '../world.js';

function mkWay(id, lat=48, lon=2) {
  return { id, geometry:[{lat,lon},{lat:lat+0.01,lon:lon+0.01}], maxSpeed:100, electrified:true, tracks:1, usage:'main', service:'', name:'', ref:'', trackRef:'', nodeIds:[] };
}

test('V1.1.6 500 km diagonal uses bounded corridor tile count instead of whole rectangle', () => {
  const orm = new ORMClient();
  const from = [48.0, 2.0], to = [50.8, 6.2]; // ~450-500 km diagonal
  const corridor = orm._corridorTiles(from[0],from[1],to[0],to[1],20,18);
  const bbox = orm._tileBbox(Math.min(from[0],to[0]),Math.min(from[1],to[1]),Math.max(from[0],to[0]),Math.max(from[1],to[1]),35);
  assert.ok(corridor.length >= 15, `expected long corridor, got ${corridor.length}`);
  assert.ok(corridor.length < bbox.length, `corridor ${corridor.length} should be smaller than bbox ${bbox.length}`);
  assert.ok(corridor[0].south < from[0] && corridor[0].west < from[1]);
  const last = corridor.at(-1);
  assert.ok(last.north > to[0] && last.east > to[1]);
});

test('V1.1.6 station tile failure never discards successful station tiles', async () => {
  const orm = new ORMClient();
  const tiles = [
    {south:48,west:2,north:48.1,east:2.1},
    {south:48,west:2.1,north:48.1,east:2.2},
    {south:48,west:2.2,north:48.1,east:2.3},
  ];
  let calls = 0;
  orm._fetchStationTileResilient = async (tile) => {
    calls++;
    if (tile.west > 2.09 && tile.west < 2.19) throw new Error('simulated station outage');
    return [{id:`node-${Math.round(tile.west*10)}`,lat:48.05,lon:tile.west+0.01,name:'Gare',urbanTransit:false}];
  };
  const out = await orm.fetchStationTiles(tiles);
  assert.ok(calls >= 3);
  assert.equal(out.length, 2, 'successful station tiles must survive one broken tile');
});

test('V1.1.6 station area persistent cache avoids network refetch', async () => {
  const orm = new ORMClient();
  orm._cacheReady = Promise.resolve(true);
  orm._loadCachedArea = async () => ({ ways:[], stations:[{id:'node-1',lat:48,lon:2,name:'Cached',urbanTransit:false}] });
  let network = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { network++; throw new Error('network should not be used'); };
  try {
    const out = await orm.fetchStationsArea(48,2,48.1,2.1);
    assert.equal(out.length,1);
    assert.equal(out[0].name,'Cached');
    assert.equal(network,0);
  } finally { globalThis.fetch = oldFetch; }
});

test('V1.1.6 importInfrastructure no longer calls unused legacy buildGraph', async () => {
  const orm = new ORMClient();
  orm.fetchRailwayTiles = async () => [
    { id:1, geometry:[{lat:48,lon:2},{lat:48,lon:2.01},{lat:48,lon:2.02}], maxSpeed:100, electrified:true, tracks:1, usage:'main',service:'',name:'',ref:'',trackRef:'' }
  ];
  orm.fetchStationTiles = async () => [];
  orm.buildGraph = () => { throw new Error('legacy buildGraph must not be called'); };
  const out = await orm.importInfrastructure(48,2,48,2.02);
  assert.ok(out.voiePoints.length >= 2);
  assert.ok(out.troncons.length >= 1);
});

test('V1.1.6 bulk voie/troncon insertion keeps maps consistent with one logical chunks', () => {
  const vpm = new VoiePointManager();
  const vps = Array.from({length:5000},(_,i)=>({id:`v${i}`,lat:48+i*1e-6,lon:2,voie:'1'}));
  vpm.addVoiePointsBulk(vps);
  assert.equal(vpm.getAll().length,5000);
  assert.equal(vpm.getVoiePointById('v4321').id,'v4321');
  const trcs = Array.from({length:4999},(_,i)=>({id:`t${i}`,pointA:`v${i}`,pointB:`v${i+1}`,route:[],distance:0.1}));
  vpm.addTronconsBulk(trcs);
  assert.equal(vpm.getAllTroncons().length,4999);
  assert.equal(vpm.getTronconById('t4000').pointB,'v4001');
  assert.equal(vpm.getTronconsForPoint('v2500').length,2);
});

test('V1.1.6 world station spatial lookup stays local on huge station sets', () => {
  const world = new World();
  for (let i=0;i<20000;i++) world.addStation({id:`s${i}`,name:`S${i}`,lat:40+(i%200)*0.05,lon:-5+Math.floor(i/200)*0.05});
  world.addStation({id:'target',name:'Target',lat:48.123,lon:2.456});
  const out = world.getStationsNear(48.123,2.456,1);
  assert.ok(out.some(s=>s.id==='target'));
  assert.ok(out.length < 20, `lookup should stay local, got ${out.length}`);
});

test('V1.1.6 recursive station split exposes successful halves while retrying failed half', async () => {
  const orm = new ORMClient();
  orm.fetchStationsArea = async (s,w,n,e) => {
    // Western descendants succeed, eastern descendants keep failing.
    if (e <= 2.5) return {ok:true,stations:[{id:`west-${w.toFixed(3)}`,lat:48.05,lon:(w+e)/2,name:'West',urbanTransit:false}]};
    return {ok:false,stations:[],error:new Error('east outage')};
  };
  let err = null;
  try { await orm._fetchStationTileResilient({south:48,west:2,north:48.1,east:3},0); }
  catch (e) { err = e; }
  assert.ok(err, 'partial failure must remain retryable');
  assert.ok(Array.isArray(err.partialStations));
  assert.ok(err.partialStations.length > 0, 'successful western stations must be preserved in error payload');
});

test('V1.1.6 station validation closes modal before any ORM route await', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
  const a = src.indexOf('async saveStation()');
  const b = src.indexOf('  _showPickHint(text)', a);
  const body = src.slice(a,b);
  const closeAt = body.indexOf("document.getElementById('modal-station')?.classList.add('hidden');");
  const routeAwait = body.indexOf('await orm.findRoute');
  assert.ok(closeAt >= 0 && routeAwait >= 0);
  assert.ok(closeAt < routeAwait, 'modal must close before background ORM route calculation');
});

test('V1.1.6 Tracer ligne removed quadratic iterative simplifier', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../orm.js', import.meta.url), 'utf8');
  const a = src.indexOf('async importInfrastructure(');
  const b = src.indexOf('// ROUTE FINDING', a);
  const body = src.slice(a,b);
  assert.equal(body.includes('while (simplified)'), false);
  assert.equal(body.includes('this.buildGraph(allWays)'), false);
});
