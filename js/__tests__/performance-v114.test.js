import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

test('V1.1.4 Tracer ligne does not wait for slow station metadata', async () => {
  const orm = new ORMClient();
  const way = { id:11, maxSpeed:120, electrified:true, tracks:2, usage:'main', service:'', name:'Ligne test', ref:'', trackRef:'', geometry:[{lat:48,lon:2},{lat:48.01,lon:2},{lat:48.02,lon:2}], nodeIds:[] };
  orm.fetchArea = async () => [structuredClone(way)];
  orm.fetchStationsArea = async () => {
    await new Promise(r => setTimeout(r, 250));
    return [{id:'node-101',lat:48.0101,lon:2.0001,name:'Gare test',type:'station',urbanTransit:false}];
  };
  const t0 = performance.now();
  const out = await orm.importInfrastructure(48,2,48.02,2);
  const elapsed = performance.now() - t0;
  assert.ok(out.voiePoints.length >= 2);
  assert.ok(out.troncons.length >= 1);
  assert.ok(elapsed < 100, `rail import waited ${elapsed.toFixed(1)}ms for stations`);
  assert.ok(out.stationsPromise instanceof Promise);
  const stations = await out.stationsPromise;
  assert.deepEqual(stations.map(s=>s.name), ['Gare test']);
});

test('V1.1.99 HOTFIX3 railway parser accepts ORM rail, preserved and urban rail classes', () => {
  const orm = new ORMClient();
  const mk=(id,railway)=>({type:'way',id,tags:{railway},geometry:[{lat:48,lon:2},{lat:48.01,lon:2}],nodes:[1,2]});
  const ways=orm.parseWays({elements:[mk(1,'rail'),mk(2,'narrow_gauge'),mk(3,'preserved'),mk(4,'tram'),mk(5,'subway'),mk(6,'light_rail')]});
  assert.deepEqual(ways.map(w=>w.id),[1,2,3,4,5,6]);
});

test('V1.1.4 station blue validation contains no blocking snapToRailway call', () => {
  const src=fs.readFileSync(new URL('../ui.js', import.meta.url),'utf8');
  const start=src.indexOf('  async saveStation()');
  const end=src.indexOf('  _showPickHint(',start);
  const block=src.slice(start,end);
  assert.ok(!block.includes('await orm.snapToRailway'));
  assert.ok(block.includes('orm.snapToNearest'));
});
