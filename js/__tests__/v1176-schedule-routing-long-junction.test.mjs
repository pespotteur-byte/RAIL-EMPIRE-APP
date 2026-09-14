import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { TrackBinding, RouteConstraint } from '../schedule-v2-model.js';

function way(id, coords, nodeIds){
  return {id:String(id), geometry:coords.map(([lat,lon])=>({lat,lon})), nodeIds,
    maxSpeed:160,maxSpeedSource:'OSM',electrified:true,voltage:[15000],frequency:[16.7],gauge:[1435],
    tracks:1,usage:'main',service:'',railway:'rail',tags:{}};
}
function route(a,b,wayId='1',segmentIndex=0){
  const r=[{lat:a.lat,lon:a.lon,wayId,maxSpeed:160,maxSpeedSource:'OSM'},{lat:b.lat,lon:b.lon,wayId,maxSpeed:160,maxSpeedSource:'OSM'}];
  r._resolvedAnchors=[{lat:a.lat,lon:a.lon,wayId:String(a.wayId||wayId),segmentIndex:a.segmentIndex??segmentIndex},{lat:b.lat,lon:b.lon,wayId:String(b.wayId||wayId),segmentIndex:b.segmentIndex??segmentIndex}];
  return r;
}

test('v1.1.76 appending one exact VIA reuses every already resolved prefix leg', async()=>{
  const orm=new ORMClient();
  let calls=0;
  orm._findCursorLegLocal=async(a,b)=>{calls++;return route(a,b,a.wayId,a.segmentIndex||0);};
  const a={lat:48.99,lon:8.40,wayId:'100',segmentIndex:1};
  const b={lat:49.15,lon:8.45,wayId:'101',segmentIndex:2};
  const c={lat:49.35,lon:8.53,wayId:'102',segmentIndex:3};
  const d={lat:49.44,lon:8.57,wayId:'103',segmentIndex:4};
  const r1=await orm.findRouteViaCursorAnchors([a,b,c],{maxSpeed:160});
  assert.ok(r1?.length>=2);assert.equal(calls,2);
  const r2=await orm.findRouteViaCursorAnchors([a,b,c,d],{maxSpeed:160});
  assert.ok(r2?.length>=2);
  assert.equal(calls,3,'only C→D may be newly routed; A→B and B→C must come from exact-leg cache');
});

test('v1.1.76 a short turnout leg uses raw OSM main topology even inside a future long journey', async()=>{
  const orm=new ORMClient();
  orm.getLoadedRailwaysInBounds=()=>[];
  const main=way('10',[[49.4380,8.5700],[49.4390,8.5710],[49.4400,8.5720]],['A','J','K']);
  const branch=way('20',[[49.4390,8.5710],[49.4400,8.5750],[49.4420,8.5800]],['J','B','C']);
  let mainCalls=0,tileCalls=0;
  orm.fetchSmallOsmMapArea=async()=>{mainCalls++;return {ok:true,ways:[main,branch],source:'test-osm-main'};};
  orm.fetchRailwayTiles=async()=>{tileCalls++;return [];};
  const a={lat:49.4385,lon:8.5705,wayId:'10',segmentIndex:0};
  const b={lat:49.4408,lon:8.5770,wayId:'20',segmentIndex:1};
  const r=await orm._findCursorLegLocal(a,b,{maxSpeed:160});
  assert.ok(r?.length>=2,'connected switch node J must make the branch routable');
  assert.equal(mainCalls,1);
  assert.equal(tileCalls,0,'successful station-throat OSM-main route must not continue into corridor Overpass');
});

test('v1.1.86 compact multi-VIA chain uses one whole-chain network envelope without persistent-history scan or per-leg retries', async()=>{
  const orm=new ORMClient();
  let incremental=0,persistent=0,main=0,overpass=0;
  orm._findExactCursorChainIncremental=async()=>{incremental++;return null;};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._loadPersistentRailwaysInBounds=async()=>{persistent++;return [];};
  orm.fetchSmallOsmMapArea=async()=>{main++;return {ok:true,ways:[],source:'test-main-empty'};};
  orm.fetchArea=async()=>{overpass++;return {ok:true,ways:[],source:'test-empty'};};
  const anchors=[0,1,2,3].map(i=>({lat:49+i*0.01,lon:8.5,wayId:String(100+i),segmentIndex:0}));
  const r=await orm.findRouteViaCursorAnchors(anchors,{maxSpeed:160});
  assert.equal(r,null);
  assert.equal(incremental,0,'v1.1.81 local whole-chain solver must bypass per-leg incremental retries');
  assert.equal(persistent,0,'interactive exact multi-VIA must not scan timestamp-ordered persistent history');
  assert.equal(main,1);assert.equal(overpass,2,'one compact + one wider chain-wide network rescue maximum');
  assert.equal(orm._lastCursorRouteFailure,'NO_CONNECTED_PATH');
});

test('v1.1.76 exact segment hints are persisted by TrackBinding and VIA constraints',()=>{
  const t=new TrackBinding({wayId:'123',lat:49,lon:8,snapLat:49,snapLon:8,segmentIndex:42,displayName:'1'});
  const v=new RouteConstraint({wayId:'456',lat:49,lon:8,snapLat:49,snapLon:8,segmentIndex:7});
  assert.equal(t.segmentIndex,42);assert.equal(t.toJSON().segmentIndex,42);
  assert.equal(v.segmentIndex,7);assert.equal(v.toJSON().segmentIndex,7);
});

test('v1.1.76 source bounds persistent cache scans and exact-way segment scans',()=>{
  const src=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(src,/maxScanned = Math\.max\(limit, Number\(options\.maxScanned \|\| 180\)\)/);
  assert.match(src,/openCursor\(null, 'prev'\)/);
  assert.match(src,/exactWayOnly\s*&&\s*pref\s*&&\s*String\(way\?\.id\)\s*!==?\s*pref/);
  assert.match(src,/_scheduleExactLegCache/);
});

test('v1.1.76 exact segment identity survives leg-cache and Schedule preview endpoint',()=>{
  const orm=new ORMClient();
  const a={lat:49.44,lon:8.57,wayId:'900',segmentIndex:4};
  const b1={lat:49.441,lon:8.575,wayId:'901',segmentIndex:1};
  const b2={...b1,segmentIndex:2};
  assert.notEqual(orm._cursorLegCacheKey(a,b1,{maxSpeed:160}),orm._cursorLegCacheKey(a,b2,{maxSpeed:160}),
    'two pieces of the same OSM way must never share the exact-leg cache key');

  const bare=[{lat:a.lat,lon:a.lon,wayId:a.wayId},{lat:b1.lat,lon:b1.lon,wayId:b1.wayId}];
  orm.rememberCursorRoute([a,b1],bare,{maxSpeed:160});
  const recalled=orm.recallCursorRoute([a,b1],{maxSpeed:160});
  assert.equal(recalled?._resolvedAnchors?.[0]?.segmentIndex,4);
  assert.equal(recalled?._resolvedAnchors?.[1]?.segmentIndex,1);

  const editor=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  assert.match(editor,/segmentIndex:end\.segmentIndex\?\?null,displayName:'VIA'/);
  assert.match(editor,/u\.target\.segmentIndex=Number\(u\.r\.segmentIndex\)/);
});
