import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { inferRailJunctions } from '../schedule-v2-editor.js';

const editorSource=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
const ormSource=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');

test('v1.1.47 fetches OSM railway=switch point features',()=>{
  assert.match(ormSource,/node\[\\"railway\\"=\\"switch\\"\]/);
  assert.match(ormSource,/fetchRailwaySwitchesViewport/);
  assert.match(ormSource,/getLoadedRailwaySwitchesInBounds/);
});

test('v1.1.47 resident switch lookup is bbox filtered and deduplicated',()=>{
  const orm=new ORMClient();
  orm._switchAreaCache.set('a',[{id:1,lat:49.038,lon:3.409,tags:{railway:'switch'}},{id:2,lat:49.2,lon:3.8,tags:{railway:'switch'}}]);
  orm._switchAreaCache.set('b',[{id:1,lat:49.038,lon:3.409,tags:{railway:'switch'}}]);
  orm._loadedSwitchBboxes=[
    {key:'a',south:49.0,west:3.35,north:49.25,east:3.9},
    {key:'b',south:49.0,west:3.35,north:49.10,east:3.5},
  ];
  const hit=orm.getLoadedRailwaySwitchesInBounds(49.03,3.40,49.05,3.42);
  assert.deepEqual(hit.map(x=>x.id),[1]);
});

test('v1.1.47 infers an untagged 3-branch rail junction from shared OSM node ids',()=>{
  const ways=[
    {id:10,nodeIds:[100,200,300],geometry:[{lat:49,lon:3},{lat:49.001,lon:3.001},{lat:49.002,lon:3.002}]},
    {id:11,nodeIds:[200,400],geometry:[{lat:49.001,lon:3.001},{lat:49.0015,lon:3.003}]},
  ];
  const j=inferRailJunctions(ways);
  assert.equal(j.length,1);
  assert.equal(j[0].id,'200');
  assert.equal(j[0].degree,3);
});

test('v1.1.47 does not invent a junction on an ordinary degree-2 line',()=>{
  const ways=[{id:10,nodeIds:[100,200,300],geometry:[{lat:49,lon:3},{lat:49.001,lon:3.001},{lat:49.002,lon:3.002}]}];
  assert.deepEqual(inferRailJunctions(ways),[]);
});

test('v1.1.47 Schedule Creator draws tagged switches and inferred junctions',()=>{
  assert.match(editorSource,/const\s+inferred\s*=\s*inferRailJunctions/);
  assert.match(editorSource,/ctx\.lineTo\s*\(\s*p\.x\s*\+\s*r\s*,\s*p\.y\s*\)/);
});

test('v1.1.47 switch fetch helpers remain available for diagnostics',()=>{
  assert.match(ormSource,/fetchRailwaySwitchesViewport/);
  assert.match(ormSource,/getLoadedRailwaySwitchesInBounds/);
});
