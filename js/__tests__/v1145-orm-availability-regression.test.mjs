import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

const ormSource = fs.readFileSync(new URL('../orm.js', import.meta.url), 'utf8');
const routingSource = fs.readFileSync(new URL('../schedule-v2-routing.js', import.meta.url), 'utf8');

test('v1.1.45 keeps anti-reversal routing directed but never hard-fails a pure same-way backup', () => {
  assert.match(ormSource, /_routeToTargets\s*\(\s*graph\s*,\s*pc\.key\s*,\s*targets\s*,\s*\{\s*\.\.\.opts\s*,\s*allowFallback\s*:\s*false\s*,\s*directed\s*:\s*true\s*\}\s*\)/);
  assert.match(ormSource, /e1\.key\s*,\s*e2\.key\s*,\s*\{\s*\.\.\.opts\s*,\s*allowFallback\s*:\s*false\s*,\s*directed\s*:\s*true\s*\}/);
  const orm = new ORMClient();
  const graph = { nodes:new Map() };
  for (const [key,lon] of [['A',2],['B',2.01]]) graph.nodes.set(key,{key,lat:48,lon,edges:[]});
  const meta={maxSpeed:100,maxSpeedSource:'OSM',wayId:'W',service:'',usage:'main',againstPreferredDirection:false,directionForbidden:false};
  const ab={from:'A',to:'B',dist:0.7,...meta};
  const ba={from:'B',to:'A',dist:0.7,...meta};
  graph.nodes.get('A').edges.push(ab); graph.nodes.get('B').edges.push(ba);
  const pen=orm._turnPenalty(graph,ab,ba,true);
  assert.ok(Number.isFinite(pen), 'backup penalty must be finite so topology remains routable');
  assert.ok(pen>=72, 'backup must remain a massive last-resort penalty');
});

test('v1.1.45 partial Overpass failure plus usable rail data is topology failure, not ORM unavailable', async () => {
  const orm = new ORMClient();
  orm._ways.clear();
  let calls=0;
  orm.fetchRailwayTiles=async()=>{
    calls++;
    if(calls===1) throw new Error('temporary endpoint failure');
    return [{id:'W1',geometry:[{lat:48,lon:2},{lat:48,lon:2.10}],tags:{railway:'rail'}}];
  };
  orm.fetchArea=async()=>({ok:true,ways:[]});
  orm.fetchSmallOsmMapCorridor=async()=>({ok:false,complete:false,ways:[],requested:1,failed:1});
  orm.fetchSmallOsmMapArea=async()=>({ok:false,ways:[],switches:[],source:'test-offline'});
  orm._routeCursorAnchorChainOnWays=async()=>null;
  const route=await orm.findRouteViaCursorAnchors([{lat:48,lon:2},{lat:48,lon:2.10}],{});
  assert.equal(route,null);
  assert.equal(orm._lastCursorRouteFailure,'NO_CONNECTED_PATH');
});

test('v1.1.45 genuine zero-data network failure still reports ORM network unavailable', async () => {
  const orm = new ORMClient();
  orm._ways.clear();
  orm.fetchRailwayTiles=async()=>{ throw new Error('offline'); };
  orm.fetchArea=async()=>{ throw new Error('offline'); };
  orm.fetchSmallOsmMapCorridor=async()=>({ok:false,complete:false,ways:[],requested:1,failed:1});
  orm.fetchSmallOsmMapArea=async()=>({ok:false,ways:[],switches:[],source:'test-offline'});
  const route=await orm.findRouteViaCursorAnchors([{lat:48,lon:2},{lat:48,lon:2.01}],{});
  assert.equal(route,null);
  assert.equal(orm._lastCursorRouteFailure,'NETWORK_UNAVAILABLE');
});

test('v1.1.45 Schedule V2 only maps genuine NETWORK_UNAVAILABLE to ORM unavailable UI error', async () => {
  const fakeOrm={
    _lastCursorRouteFailure:'NO_CONNECTED_PATH',
    async findRouteViaCursorAnchors(){ return null; },
    isFallbackRoute(){ return false; },
  };
  const router=new ScheduleV2Router(fakeOrm);
  await assert.rejects(
    ()=>router.routeBetweenBindings({lat:48,lon:2},{lat:48,lon:2.01},[]),
    err=>err?.code==='ORM_NO_CONNECTED_PATH' && !/indisponible/i.test(err.message),
  );
  fakeOrm._lastCursorRouteFailure='NETWORK_UNAVAILABLE';
  await assert.rejects(
    ()=>router.routeBetweenBindings({lat:48,lon:2},{lat:48,lon:2.01},[]),
    err=>err?.code==='ORM_NETWORK_UNAVAILABLE' && /indisponible/i.test(err.message),
  );
  assert.doesNotMatch(routingSource,/reason\.startsWith\('NETWORK'\)/);
});
