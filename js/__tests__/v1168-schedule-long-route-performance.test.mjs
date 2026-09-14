import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

function makeWay(id, coords, nodeIds=null){
  return {
    id:String(id), geometry:coords.map(([lat,lon])=>({lat,lon})),
    nodeIds:nodeIds||coords.map((_,i)=>`${id}-n${i}`), maxSpeed:160,
    maxSpeedSource:'OSM', electrified:true, tracks:1, usage:'main', service:'',
    railway:'rail', tags:{}, name:'', ref:'', trackRef:'',
  };
}

test('v1.1.68 10 km simple leg stops after first successful narrow corridor pass', async()=>{
  const orm=new ORMClient();
  orm._cacheReady=Promise.resolve(true);
  orm._loadPersistentRailwaysInBounds=async()=>[];
  orm.getLoadedRailwaysInBounds=()=>[];
  const coords=[]; for(let i=0;i<=50;i++) coords.push([48,2+i*0.002]);
  const w=makeWay('main',coords,coords.map((_,i)=>`n${i}`));
  let fetches=0;
  orm.fetchRailwayTiles=async()=>{fetches++;return [w];};
  orm.fetchArea=async()=>({ok:true,ways:[]});
  const route=await orm.findRouteViaCursorAnchors([{lat:48,lon:2.001},{lat:48,lon:2.099}],{allowFallback:false});
  assert.ok(route?.length>=2);
  assert.equal(fetches,1,'wide rescue corridor must not be fetched after narrow pass succeeds');
  assert.equal(orm.isFallbackRoute(route),false);
});

test('v1.1.68 50 km simple leg also stops after first connected corridor pass', async()=>{
  const orm=new ORMClient();
  orm._cacheReady=Promise.resolve(true);
  orm._loadPersistentRailwaysInBounds=async()=>[];
  orm.getLoadedRailwaysInBounds=()=>[];
  const coords=[]; for(let i=0;i<=250;i++) coords.push([48,2+i*0.00268]);
  const w=makeWay('main50',coords,coords.map((_,i)=>`m${i}`));
  let fetches=0;
  orm.fetchRailwayTiles=async()=>{fetches++;return [w];};
  orm.fetchArea=async()=>({ok:true,ways:[]});
  const t0=performance.now();
  const route=await orm.findRouteViaCursorAnchors([{lat:48,lon:2.001},{lat:48,lon:2.668}],{allowFallback:false});
  const elapsed=performance.now()-t0;
  assert.ok(route?.length>=2);
  assert.equal(fetches,1,'50 km route should not prefetch a second wide corridor after success');
  assert.equal(orm.isFallbackRoute(route),false);
  assert.ok(elapsed<2500,`synthetic 50 km route took ${elapsed.toFixed(0)} ms`);
});

test('v1.1.68 cursor candidate fan-out is bounded on dense parallel geometry', async()=>{
  const orm=new ORMClient();
  const ways=[];
  for(let k=0;k<1000;k++){
    const lat=48+(k-500)*0.000008;
    const coords=[];for(let i=0;i<=20;i++)coords.push([lat,2+i*0.005]);
    ways.push(makeWay(k,coords));
  }
  let calls=0;const raw=orm.dijkstra.bind(orm);orm.dijkstra=(...a)=>{calls++;return raw(...a);};
  const t0=performance.now();
  const route=await orm._routeCursorAnchorChainOnWays(ways,[{lat:48,lon:2.001},{lat:48,lon:2.099}],{allowFallback:false});
  const elapsed=performance.now()-t0;
  assert.ok(route?.length>=2);
  assert.ok(calls<=36,`expected <=36 A* attempts, got ${calls}`);
  assert.ok(elapsed<2500,`dense synthetic 10 km routing took ${elapsed.toFixed(0)} ms`);
});

test('v1.1.68 local-routing clone reuses immutable geometry instead of deep-copying every point',()=>{
  const orm=new ORMClient();
  const w=makeWay('x',[[48,2],[48,2.1]]);
  const [c]=orm._cloneWaysForLocalRouting([w]);
  assert.notEqual(c,w,'way wrapper remains isolated');
  assert.equal(c.geometry,w.geometry,'geometry array is reused read-only');
});

test('v1.1.68 source contains adaptive cache bounds and segment cooperative yield',()=>{
  const src=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(src,/persistentWayLimit\s*=\s*shortChain\s*\?\s*9000\s*:\s*\(\s*maxChainLegKm\s*<\s*25\s*\?\s*3500/);
  assert.match(src,/all\.length\s*===\s*2\s*&&\s*merged\.size/);
  assert.match(src,/segmentCount\s*%\s*2500/);
  assert.match(src,/distKm\s*<\s*25\s*\?\s*\[\s*\{\s*target\s*:\s*10\s*,\s*buffer\s*:\s*4\s*\}/);
});
