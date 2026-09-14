import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

function way(id,coords,nodeIds,extra={}){
  return {id,geometry:coords.map(([lat,lon])=>({lat,lon})),nodeIds,
    maxSpeed:120,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],
    loadingGauge:'',axleLoad:null,metreLoad:null,tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',
    preferredDirection:'',bidirectional:'',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{},...extra};
}

function bind(w,lat,lon,segmentIndex=0){
  return {wayId:String(w.id),lat,lon,snapLat:lat,snapLon:lon,segmentIndex,
    osmSnapshot:{...w,wayId:String(w.id),segmentIndex,distanceM:0,snapLat:lat,snapLon:lon}};
}

test('v1.1.87 bidirectional=no without preferred_direction never invents a direction from arbitrary OSM way orientation',async()=>{
  const orm=new ORMClient();
  const w=way(1,[[49,8],[49,8.01],[49,8.02]],[1,2,3],{bidirectional:'no',preferredDirection:''});
  orm._ways.set(w.id,w);
  const reverse=await orm.findRouteViaCursorAnchors([
    {lat:49,lon:8.019,wayId:'1',segmentIndex:1,osmSnapshot:w},
    {lat:49,lon:8.001,wayId:'1',segmentIndex:0,osmSnapshot:w},
  ],{allowFallback:false});
  assert.ok(reverse?.length>=2,'missing preferred_direction must not make OSM way orientation a fake one-way railway');
});

test('v1.1.87 Schedule V2 preserves physical connectivity across signalling-restricted wrong-line direction',async()=>{
  const orm=new ORMClient();
  const w=way(2,[[49,8],[49,8.01],[49,8.02]],[11,12,13],{bidirectional:'no',preferredDirection:'forward'});
  orm._ways.set(w.id,w);
  const a=bind(w,49,8.019,1),b=bind(w,49,8.001,0);
  const lowLevel=await orm.findRouteViaCursorAnchors([a,b],{allowFallback:false});
  assert.equal(lowLevel,null,'generic low-level contract may still honour the explicit signalling restriction');
  const router=new ScheduleV2Router(orm);
  const schedule=await router.routeBetweenBindings(a,b,[],{maxSpeed:160});
  assert.ok(schedule?.length>=2,'Schedule Creator must not report NO_CONNECTED_PATH for physically continuous rail solely because of signalling direction');
  assert.ok(schedule.some(p=>p.signalRestrictedDirection)||schedule.length>=2);
});

test('v1.1.87 stale segmentIndex is a hint, not authority, on the exact selected OSM way',()=>{
  const orm=new ORMClient();
  // Same way folds back nearby: segment 0 is under the click, stale segment 2 is ~20 m away.
  const w=way(3,[[49,8],[49,8.01],[49.00018,8.01],[49.00018,8]],[21,22,23,24]);
  const hits=orm._cursorSegmentCandidates([w],49,8.005,0.04,3,'3',true,2);
  assert.ok(hits.length);
  assert.equal(hits[0].segmentIndex,0,'actual clicked segment on the same way must beat a stale but still in-radius segmentIndex');
  assert.ok(hits[0].distanceKm<0.001);
});

test('v1.1.87 failed 3 km exact corridor receives the same continuous-bbox rescue as regional legs',async()=>{
  const orm=new ORMClient();
  const a={lat:49,lon:8,wayId:'A',segmentIndex:0,osmSnapshot:{id:'A',geometry:[{lat:49,lon:8},{lat:49,lon:8.001}],nodeIds:[1,2],railway:'rail'}};
  const b={lat:49,lon:8.04,wayId:'B',segmentIndex:0,osmSnapshot:{id:'B',geometry:[{lat:49,lon:8.04},{lat:49,lon:8.041}],nodeIds:[3,4],railway:'rail'}};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[]});
  orm.fetchRailwayTiles=async()=>Object.assign([],{_fetchStats:{requested:1,failed:0,ways:0}});
  let broadCalls=0;
  const expected=[{lat:49,lon:8,wayId:'A',maxSpeed:120},{lat:49,lon:8.02,wayId:'X',maxSpeed:120},{lat:49,lon:8.04,wayId:'B',maxSpeed:120}];
  orm._findCursorLegBroadArea=async()=>{broadCalls++;return expected;};
  const r=await orm._findCursorLegLocal(a,b,{_scheduleExact:true,_deadlineTs:Date.now()+10000});
  assert.equal(broadCalls,1);
  assert.equal(r,expected);
});

test('v1.1.87 Karlsruhe-class station throat stays routable from exact platform track to exact branch track',async()=>{
  const orm=new ORMClient();
  // Synthetic analogue of a through-station east throat: exact platform -> crossover -> main -> branch.
  // One outbound piece carries restrictive signalling metadata in the direction needed by the player.
  const p=way('P',[[49.0000,8.4000],[49.0000,8.4100]],[101,102],{service:'yard'});
  const x=way('X',[[49.0000,8.4100],[49.0003,8.4140]],[102,103],{service:'crossover'});
  const m=way('M',[[49.0003,8.4140],[49.0020,8.4240]],[103,104],{preferredDirection:'backward',bidirectional:'no'});
  const b=way('B',[[49.0020,8.4240],[49.0100,8.4320]],[104,105],{preferredDirection:'forward',bidirectional:'signals'});
  for(const w of [p,x,m,b])orm._ways.set(w.id,w);
  const router=new ScheduleV2Router(orm);
  const start=bind(p,49.0000,8.4050,0),end=bind(b,49.0080,8.4300,0);
  const route=await router.routeBetweenBindings(start,end,[],{maxSpeed:160});
  assert.ok(route?.length>=5,'exact station platform and exact branch must remain connected through the physical throat');
  assert.equal(String(route[0].wayId),'P');
  assert.ok(route.some(pt=>String(pt.wayId)==='M'));
  assert.ok(route.some(pt=>String(pt.wayId)==='B'));
});

test('v1.1.87 broad-area rescue cannot lose exact clicked ways omitted by bbox response',async()=>{
  const orm=new ORMClient();
  const aWay=way('A',[[49,8],[49,8.005]],[201,202]);
  const mid=way('M',[[49,8.005],[49,8.025]],[202,203]);
  const bWay=way('B',[[49,8.025],[49,8.030]],[203,204]);
  const a=bind(aWay,49,8.002,0),b=bind(bWay,49,8.028,0);
  // Simulate an Overpass bbox that returns the middle connector but omits the two long through-ways.
  orm.fetchArea=async()=>({ok:true,ways:[mid]});
  const r=await orm._findCursorLegBroadArea(a,b,{allowSignalRestrictedDirection:true,_deadlineTs:Date.now()+10000});
  assert.ok(r?.length>=4,'anchor snapshots + middle bbox way must reconstruct one continuous exact route');
  assert.ok(r.some(p=>String(p.wayId)==='A'));
  assert.ok(r.some(p=>String(p.wayId)==='M'));
  assert.ok(r.some(p=>String(p.wayId)==='B'));
});

test('v1.1.87 journey prefetch remains usable when endpoint ways are supplied only by exact anchor snapshots',async()=>{
  const orm=new ORMClient();
  const aWay=way('A2',[[49,8],[49,8.005]],[301,302]);
  const mid=way('MID2',[[49,8.005],[50,9]],[302,303]);
  const bWay=way('B2',[[50,9],[50,9.005]],[303,304]);
  const a=bind(aWay,49,8.002,0),b=bind(bWay,50,9.003,0);
  orm._scheduleJourneyPrefetch={ways:[mid],complete:false,at:Date.now(),key:'partial'};
  const r=await orm._routeFromJourneyPrefetch(a,b,{allowSignalRestrictedDirection:true});
  assert.ok(r?.length>=4);
  assert.ok(r.some(p=>String(p.wayId)==='A2'));
  assert.ok(r.some(p=>String(p.wayId)==='MID2'));
  assert.ok(r.some(p=>String(p.wayId)==='B2'));
});

test('v1.1.87 local OSM-main rescue seeds exact endpoint snapshots before falling through to Overpass',async()=>{
  const orm=new ORMClient();
  const aWay=way('AS',[[49,8],[49,8.005]],[401,402]);
  const mid=way('MS',[[49,8.005],[49,8.020]],[402,403]);
  const bWay=way('BS',[[49,8.020],[49,8.025]],[403,404]);
  const a=bind(aWay,49,8.002,0),b=bind(bWay,49,8.023,0);
  orm.getLoadedRailwaysInBounds=()=>[];
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[mid]});
  orm.fetchRailwayTiles=async()=>{throw new Error('Overpass should not be needed');};
  const r=await orm._findCursorLegLocal(a,b,{_scheduleExact:true,allowSignalRestrictedDirection:true,_deadlineTs:Date.now()+10000});
  assert.ok(r?.length>=4);
  assert.ok(r.some(p=>String(p.wayId)==='AS'));
  assert.ok(r.some(p=>String(p.wayId)==='MS'));
  assert.ok(r.some(p=>String(p.wayId)==='BS'));
});
