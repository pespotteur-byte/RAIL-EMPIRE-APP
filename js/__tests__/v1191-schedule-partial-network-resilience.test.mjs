import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function way(id, coords, nodeIds, extra={}){
  return {id:String(id),geometry:coords.map(([lat,lon])=>({lat,lon})),nodeIds:nodeIds.map(String),
    maxSpeed:160,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[1500],frequency:[50],gauge:[1435],
    loadingGauge:'',axleLoad:null,metreLoad:null,tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',
    preferredDirection:'',bidirectional:'regular',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{railway:'rail'},...extra};
}
function bind(w,lat,lon,segmentIndex=0){
  return {lat,lon,wayId:String(w.id),segmentIndex,osmSnapshot:{...w,wayId:String(w.id),segmentIndex,snapLat:lat,snapLon:lon}};
}
function result(arr, failed=[]){
  Object.defineProperty(arr,'_fetchStats',{value:Object.freeze({requested:1,failed:failed.length,ways:arr.length}),enumerable:false});
  Object.defineProperty(arr,'_fetchFailures',{value:Object.freeze(failed.map(f=>Object.freeze(f))),enumerable:false});
  return arr;
}

test('v1.1.91 dynamic SC heals a missing middle tile before certifying topology',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  orm._corridorTiles=()=>[{south:46.9,west:4.7,north:47.4,east:5.1}];
  const A=way('A',[[47.30,5.00],[47.20,4.95]],['1','2']);
  const M=way('M',[[47.20,4.95],[47.10,4.90]],['2','3']);
  const B=way('B',[[47.10,4.90],[47.02,4.85]],['3','4']);
  const a=bind(A,47.29,4.995,0),b=bind(B,47.03,4.85625,0);
  let healCalls=0,broadCalls=0;
  orm.fetchRailwayTiles=async()=>result([A,B],[{tile:{south:47.05,west:4.88,north:47.15,east:4.96},code:'NETWORK',message:'busy'}]);
  orm._healFailedRailwayTiles=async()=>{healCalls++;return result([M],[]);};
  orm._findCursorLegBroadArea=async()=>{broadCalls++;return null;};
  const r=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false});
  assert.ok(r?.length>=4);
  assert.equal(healCalls,1);
  assert.equal(broadCalls,0,'complete healed topology should not need broad rescue');
  assert.equal(orm._lastCursorRouteFailure,'');
});

test('v1.1.91 incomplete tiled graph cannot cache a detour when continuous bbox finds the direct main line',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  orm._corridorTiles=()=>[{south:46.9,west:4.7,north:47.4,east:5.2}];
  const A=way('A',[[47.30,5.00],[47.20,4.95]],['11','12']);
  const D1=way('D1',[[47.20,4.95],[47.18,5.18]],['12','13']);
  const D2=way('D2',[[47.18,5.18],[47.10,5.14]],['13','14']);
  const D3=way('D3',[[47.10,5.14],[47.10,4.90]],['14','15']);
  const B=way('B',[[47.10,4.90],[47.02,4.85]],['15','16']);
  const directMid=way('M',[[47.20,4.95],[47.10,4.90]],['12','15']);
  const a=bind(A,47.29,4.995,0),b=bind(B,47.03,4.85625,0);
  const failure={tile:{south:47.08,west:4.88,north:47.22,east:4.98},code:'NETWORK',message:'busy'};
  orm.fetchRailwayTiles=async()=>result([A,D1,D2,D3,B],[failure]);
  orm._healFailedRailwayTiles=async()=>result([], [failure]);
  let broadCalls=0;
  orm._findCursorLegBroadArea=async()=>{broadCalls++;const g=await orm._buildGraphFromWaysAsync([A,directMid,B],{allowSyntheticStitches:false});return orm._routeCursorCandidatesOnWays([A,directMid,B],a,b,{_sharedGraph:g,allowSyntheticStitches:false,routeObjective:'distance',allowSignalRestrictedDirection:true,forbidPureBackup:true});};
  const r=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false});
  assert.ok(r?.length>=4);
  assert.equal(broadCalls,1);
  assert.ok(r.some(p=>String(p.wayId)==='M'),'continuous bbox direct main line must replace partial detour');
  assert.ok(!r.some(p=>String(p.wayId)==='D2'));
});

test('v1.1.91 unresolved holes report network unavailable instead of false topology verdict',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  orm._corridorTiles=()=>[{south:46.9,west:4.7,north:47.4,east:5.1}];
  const A=way('A',[[47.30,5.00],[47.20,4.95]],['21','22']);
  const B=way('B',[[47.10,4.90],[47.02,4.85]],['23','24']);
  const a=bind(A,47.29,4.995,0),b=bind(B,47.03,4.85625,0);
  const failure={tile:{south:47.08,west:4.88,north:47.22,east:4.98},code:'NETWORK',message:'busy'};
  orm.fetchRailwayTiles=async()=>result([A,B],[failure]);
  orm._healFailedRailwayTiles=async()=>result([], [failure]);
  orm._findCursorLegBroadArea=async()=>null;
  const r=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false});
  assert.equal(r,null);
  assert.equal(orm._lastCursorRouteFailure,'NETWORK_UNAVAILABLE');
});

test('v1.1.91 complete but disconnected tiled corridor receives continuous bbox rescue',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  orm._corridorTiles=()=>[{south:46.9,west:4.7,north:47.4,east:5.1}];
  const A=way('A',[[47.30,5.00],[47.20,4.95]],['31','32']);
  const B=way('B',[[47.10,4.90],[47.02,4.85]],['33','34']);
  const M=way('M',[[47.20,4.95],[47.10,4.90]],['32','33']);
  const a=bind(A,47.29,4.995,0),b=bind(B,47.03,4.85625,0);
  orm.fetchRailwayTiles=async()=>result([A,B],[]);
  let broadCalls=0;
  orm._findCursorLegBroadArea=async()=>{broadCalls++;const g=await orm._buildGraphFromWaysAsync([A,M,B],{allowSyntheticStitches:false});return orm._routeCursorCandidatesOnWays([A,M,B],a,b,{_sharedGraph:g,allowSyntheticStitches:false,routeObjective:'distance',allowSignalRestrictedDirection:true,forbidPureBackup:true});};
  const r=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false});
  assert.ok(r?.length>=4);
  assert.equal(broadCalls,1);
});

test('v1.1.91 route memory generations changed so pre-fix route keys are not reused',()=>{
  const src=String(ORMClient.prototype._cursorRouteMemoryKey);
  const leg=String(ORMClient.prototype._scheduleExactLegKey);
  assert.match(src,/schedule-route-v7/);
  assert.match(leg,/exact-leg-v4/);
});

import { ScheduleV2Router } from '../schedule-v2-routing.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';

test('v1.1.91 router reports incomplete ORM acquisition as retryable network failure, not no-path topology',async()=>{
  const orm={
    _lastCursorRouteFailure:'RAILGRAPH_DATA_MISSING',
    isFallbackRoute:()=>false,
    findRouteViaLocalRailGraphAnchors:async function(){this._lastCursorRouteFailure='RAILGRAPH_DATA_MISSING';return null;},
    prepareAndRouteScheduleAnchors:async function(){this._lastCursorRouteFailure='NETWORK_UNAVAILABLE';return null;},
  };
  const router=new ScheduleV2Router(orm);
  await assert.rejects(
    ()=>router.routeBetweenBindings({snapLat:47.32337,snapLon:5.02721,wayId:'dijon'},{snapLat:47.02305,snapLon:4.84838,wayId:'beaune'}),
    err=>err?.code==='ORM_NETWORK_UNAVAILABLE' && /incomplètes|indisponible/i.test(String(err.message)) && !/aucun chemin/i.test(String(err.message))
  );
});

test('v1.1.91 forceFreshRoute bypasses previously remembered schedule route',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  orm._corridorTiles=()=>[{south:46.9,west:4.7,north:47.4,east:5.1}];
  const A=way('A',[[47.30,5.00],[47.20,4.95]],['41','42']);
  const M=way('M',[[47.20,4.95],[47.10,4.90]],['42','43']);
  const B=way('B',[[47.10,4.90],[47.02,4.85]],['43','44']);
  const a=bind(A,47.29,4.995,0),b=bind(B,47.03,4.85625,0);
  let recallCalls=0,fetchCalls=0;
  orm.recallCursorRoute=()=>{recallCalls++;return [{lat:a.lat,lon:a.lon,wayId:'BAD'},{lat:47.50,lon:5.50,wayId:'BAD'},{lat:b.lat,lon:b.lon,wayId:'BAD'}];};
  orm.fetchRailwayTiles=async()=>{fetchCalls++;return result([A,M,B],[]);};
  const r=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false,forceFreshRoute:true});
  assert.ok(r?.length>=4);
  assert.equal(recallCalls,0,'fresh AUTO retry must not consult saved/cached bad route');
  assert.ok(fetchCalls>=1,'fresh AUTO retry must reacquire real topology');
  assert.ok(!r.some(p=>String(p.wayId)==='BAD'));
});

test('v1.1.91 Auto segment explicitly requests a fresh ORM route',async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const a={name:'Dijon Ville'},b={name:'Beaune'};
  const path={constraints:[]};
  ed._activeVersion=()=>({locations:[a,b]});ed._activePath=()=>path;ed._activeManualLegIndex=()=>0;
  ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed._updateManualTraceButton=()=>{};ed._setHint=()=>{};ed._autosaveSoon=()=>{};
  let seen=null;ed._recomputeActivePath=async opts=>{seen=opts;return true;};
  await ed.resetActiveLegToAutomatic();
  assert.deepEqual(seen,{forceFreshRoute:true});
});

import { readFileSync } from 'node:fs';

test('v1.1.91 packaged build identity and SC resilience code survive FILE bundle',()=>{
  const root=new URL('../../',import.meta.url);
  const version=readFileSync(new URL('VERSION.txt',root),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
  const index=readFileSync(new URL('index.html',root),'utf8');
  const bundle=readFileSync(new URL('js/rail-empire.file.bundle.js',root),'utf8');
  assert.equal(version,'1.1.99');
  assert.equal(pkg.version,'1.1.99');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(bundle,/Rail Empire v1\.1\.99 FILE:\/\/ CORE bundle/);
  assert.match(bundle,/FULL-AUDIT-TAXONOMY-CROSSSYSTEM-SC-HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(bundle,/forceFreshRoute/);
  assert.match(bundle,/Réparation d’une zone OSM manquante/);
  assert.match(bundle,/ORM_NETWORK_UNAVAILABLE/);
  assert.match(bundle,/schedule-route-v7/);
});
