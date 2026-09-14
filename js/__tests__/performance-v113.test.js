import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { VoiePointManager } from '../voie-points.js';
import { ORMClient } from '../orm.js';

test('V1.1.3 voie-point batch emits one graph change', () => {
  const vpm = new VoiePointManager();
  let changes = 0;
  vpm.onChange = () => changes++;
  vpm.beginBatch();
  for (let i = 0; i < 2000; i++) vpm.addVoiePoint({ id:`v${i}`, lat:48+i*1e-6, lon:2, voie:'1' });
  for (let i = 0; i < 1000; i++) vpm.addTroncon({ id:`t${i}`, pointA:`v${i*2}`, pointB:`v${i*2+1}`, route:[{lat:48+i*2e-6,lon:2},{lat:48+(i*2+1)*1e-6,lon:2}], distance:0.01 });
  vpm.endBatch();
  assert.equal(changes, 1);
});

test('V1.1.3 voie-point spatial query and save cache', () => {
  const vpm = new VoiePointManager();
  vpm.beginBatch();
  for (let i = 0; i < 50000; i++) vpm.addVoiePoint({ id:`v${i}`, lat:48+(i%1000)*0.0001, lon:2+Math.floor(i/1000)*0.0001, voie:'1', linePoint:true });
  vpm.endBatch();
  // First query builds the spatial index; subsequent queries must be cheap.
  vpm.getVoiePointsNear(48.05, 2.002, 0.2);
  const t0 = performance.now();
  for (let i=0;i<50;i++) vpm.getVoiePointsNear(48.05, 2.002, 0.2);
  const queryMs = performance.now() - t0;
  assert.ok(queryMs < 150, `50 indexed hit-tests took ${queryMs.toFixed(1)}ms`);
  const a = vpm.toSave();
  const t1 = performance.now();
  const b = vpm.toSave();
  const cachedMs = performance.now() - t1;
  assert.equal(a, b);
  assert.ok(cachedMs < 5, `cached save snapshot took ${cachedMs.toFixed(1)}ms`);
});

test('V1.1.3 OSM station parser excludes tram/metro/light rail', () => {
  const orm = new ORMClient();
  const got = orm._parseStations({ elements: [
    {type:'node',id:1,lat:48,lon:2,tags:{railway:'station',name:'Gare rail',train:'yes'}},
    {type:'node',id:2,lat:48,lon:2,tags:{railway:'station',name:'Métro',station:'subway',subway:'yes'}},
    {type:'node',id:3,lat:48,lon:2,tags:{railway:'station',name:'Light rail',station:'light_rail'}},
    {type:'node',id:4,lat:48,lon:2,tags:{railway:'halt',name:'Tram',tram:'yes'}},
    {type:'node',id:5,lat:48,lon:2,tags:{railway:'halt',name:'Halte TER'}},
  ]});
  assert.deepEqual(got.filter(s=>!s.urbanTransit).map(s=>s.name), ['Gare rail','Halte TER']);
});

test('V1.1.3 infrastructure import returns railway stations on imported geometry', async () => {
  const orm = new ORMClient();
  const way = { id:11, maxSpeed:120, electrified:true, tracks:2, usage:'main', service:'', name:'Ligne test', ref:'', trackRef:'', geometry:[{lat:48,lon:2},{lat:48.01,lon:2},{lat:48.02,lon:2}], nodeIds:[] };
  orm.fetchStationsArea = async () => [
    {id:101,lat:48.0101,lon:2.0001,name:'Gare test',type:'station',urbanTransit:false},
  ];
  orm.fetchArea = async () => [structuredClone(way)];
  const out = await orm.importInfrastructure(48,2,48.02,2);
  assert.ok(out.voiePoints.length >= 2);
  assert.ok(out.troncons.length >= 1);
  const stations = await out.stationsPromise;
  assert.deepEqual(stations.map(s=>s.name), ['Gare test']);
});
