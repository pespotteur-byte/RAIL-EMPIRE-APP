import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleVersion } from '../schedule-v2-model.js';

function mkWay(id,a,b,nodeA='A',nodeB='B',speedSource='OSM'){
  return {id:String(id),geometry:[a,b],nodeIds:[nodeA,nodeB],maxSpeed:160,maxSpeedSource:speedSource,maxSpeedForward:null,maxSpeedBackward:null,electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],tracks:2,usage:'main',service:'',railway:'rail',trafficMode:'',preferredDirection:'',bidirectional:'regular',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{railway:'rail'}};
}

test('v1.1.84 FALLBACK_30/yellow segments still count in exact route distance',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const preview=[{lat:49,lon:8,maxSpeed:30,maxSpeedSource:'FALLBACK_30'},{lat:49.01,lon:8,maxSpeed:30,maxSpeedSource:'FALLBACK_30'}];
  const ver={locations:[{departureSec:8*3600},{arrivalSec:9*3600,departureSec:9*3600+300}],performanceProfile:{maxSpeed:160,massKg:400000,powerW:4000000,lengthM:180,adhesionMassKg:80000,brakeServiceMs2:.9}};
  ed._activeVersion=()=>ver;
  ed._activePath=()=>({distanceKm:54.5,routePoints:[{lat:48.5,lon:8,maxSpeed:160},{lat:49,lon:8,maxSpeed:160}]});
  ed._activePreview=()=>preview;
  ed.router={snapshotRoute(){return {distanceKm:1.7};}};
  ed.game={weather:null};
  const m=ed._activeMetrics();
  assert.equal(m.preview,true);
  assert.equal(m.distanceKm,56.2,'preview suffix must be added after 2+ resolved stops');
  assert.ok(m.durationSec>0);
});

test('v1.1.84 hedged Overpass bbox uses first valid endpoint instead of serial timeout stacking',async()=>{
  const orm=new ORMClient();
  orm._cacheReady=Promise.resolve();orm._loadCachedArea=async()=>null;orm._saveCachedArea=async()=>{};
  const oldFetch=globalThis.fetch;let calls=0,aborted=0;
  globalThis.fetch=(url,{signal}={})=>new Promise((resolve,reject)=>{
    const n=++calls;
    const timer=setTimeout(()=>resolve({ok:true,status:200,json:async()=>({elements:[{type:'way',id:77,tags:{railway:'rail',maxspeed:'160'},geometry:[{lat:49,lon:8},{lat:49.001,lon:8.001}],nodes:[1,2]}]})}),n===1?700:35);
    signal?.addEventListener('abort',()=>{clearTimeout(timer);aborted++;const e=new Error('aborted');e.name='AbortError';reject(e);},{once:true});
  });
  const t0=Date.now();
  try{
    const res=await orm.fetchArea(48.99,7.99,49.01,8.01,{withStatus:true,timeoutMs:900,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:15});
    assert.equal(res.ok,true);assert.equal(res.ways.length,1);
    assert.ok(Date.now()-t0<350,`hedged request should not wait for slow first endpoint: ${Date.now()-t0} ms`);
    assert.ok(calls>=2);assert.ok(aborted>=1);
  }finally{globalThis.fetch=oldFetch;}
});

test('v1.1.86 exact two-anchor edits use the same exact-leg pipeline below and above 3 km',async()=>{
  const orm=new ORMClient();
  let incrementalCalls=0;
  orm._findExactCursorChainIncremental=async(all)=>{
    incrementalCalls++;
    const route=[{lat:all[0].lat,lon:all[0].lon,wayId:all[0].wayId},{lat:all[1].lat,lon:all[1].lon,wayId:all[1].wayId}];
    route._resolvedAnchors=all;
    return route;
  };
  orm._routeCursorAnchorChainOnWays=async()=>{throw new Error('legacy whole-chain solver must not handle ordinary two-anchor exact edits');};
  const short=await orm.findRouteViaCursorAnchors([{lat:49,lon:8,wayId:'1',segmentIndex:0},{lat:49.02,lon:8,wayId:'1',segmentIndex:0}],{maxSpeed:160});
  const regional=await orm.findRouteViaCursorAnchors([{lat:49,lon:8,wayId:'1',segmentIndex:0},{lat:49.08,lon:8,wayId:'1',segmentIndex:0}],{maxSpeed:160});
  assert.ok(short?.length>=2);assert.ok(regional?.length>=2);
  assert.equal(incrementalCalls,2,'both distances must use the same exact-leg pipeline');
});

test('v1.1.85 whole-journey prefetch uses one shared bounded hedged tile batch',async()=>{
  const orm=new ORMClient();
  const anchors=[{lat:49.0,lon:8.4,wayId:'1'},{lat:49.5,lon:8.7,wayId:'2'},{lat:50.1,lon:8.7,wayId:'3'},{lat:51.3,lon:9.48,wayId:'4'}];
  let call=null;
  orm.fetchRailwayTiles=async(tiles,_p,options)=>{call={tiles,options};return [
    mkWay('1',{lat:49,lon:8.4},{lat:49.5,lon:8.7},'A','B'),
    mkWay('2',{lat:49.5,lon:8.7},{lat:50.1,lon:8.7},'B','C'),
    mkWay('3',{lat:50.1,lon:8.7},{lat:51.3,lon:9.48},'C','D'),
    mkWay('4',{lat:51.3,lon:9.48},{lat:51.31,lon:9.49},'D','E')
  ];};
  const res=await orm.prefetchScheduleJourney(anchors,{_deadlineTs:Date.now()+180000});
  assert.ok(call);assert.ok(call.tiles.length>=3);assert.ok(call.tiles.length<=12);
  assert.equal(call.options.maxEndpoints,2);assert.equal(call.options.raceEndpoints,2);assert.equal(call.options.maxSplitDepth,1);assert.ok(call.options.concurrency>=3);
  assert.ok(res.ways>=4);assert.ok(orm._scheduleJourneyPrefetch?.ways?.length>=4);
});


test('v1.1.84 failed new suffix preserves already resolved prefix instead of returning 0.0 km',async()=>{
  const ver=new ScheduleVersion({
    locations:[
      {id:'A',stationId:'A',name:'A',track:{wayId:'1',displayName:'1',lat:49,lon:8,snapLat:49,snapLon:8},departureSec:8*3600,dwellSec:0},
      {id:'B',stationId:'B',name:'B',track:{wayId:'2',displayName:'1',lat:49.1,lon:8.1,snapLat:49.1,snapLon:8.1},dwellSec:300},
      {id:'C',stationId:'C',name:'C',track:{wayId:'3',displayName:'1',lat:49.2,lon:8.2,snapLat:49.2,snapLon:8.2},dwellSec:300},
    ],
    outboundPath:{topologyRevision:1,resolvedRevision:0,constraints:[]}
  });
  const path=ver.outboundPath;
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed._routeGeneration=0;ed._activeRoutingDeadlineTs=null;ed._engineOsmVisible=false;
  ed._activeVersion=()=>ver;ed._activePath=()=>path;ed._setHint=()=>{};ed._setActivePreview=()=>{};ed._error=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};
  ed.game={weather:null,orm:{prefetchScheduleJourney:async()=>({skipped:true})}};
  let calls=0;
  ed.router={
    async routeBetweenBindings(){calls++;if(calls===2){const e=new Error('suffix failed');e.code='ORM_NO_CONNECTED_PATH';throw e;}return [{lat:49,lon:8,wayId:'1',maxSpeed:160},{lat:49.1,lon:8.1,wayId:'2',maxSpeed:160}];},
    snapshotRoute(route){return {routePoints:route.map(x=>({...x})),segments:[{wayId:'2',from:route[0],to:route[1],distanceKm:15,maxSpeed:160,maxSpeedSource:'OSM'}],distanceKm:15};}
  };
  const ok=await ed._recomputeActivePath({topologyChanged:true});
  const expectedKm=ORMClient.prototype.getRouteDistance.call({}, path.routePoints);
  assert.equal(ok,false);assert.ok(Math.abs(path.distanceKm-expectedKm)<1e-9);assert.ok(path.distanceKm>0);assert.equal(path.legs.length,1);assert.equal(path.routePoints.length,2);assert.match(path.error,/suffix failed/);
});
