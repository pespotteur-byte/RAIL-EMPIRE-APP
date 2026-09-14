import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ScheduleV2Manager, ScheduleVersion, ScheduleState, TrainCategory, PerformanceProfile,
  ScheduledLocation, SchedulePath, RouteConstraint, parseScheduleClock, RoundTripGroup
} from '../schedule-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ORMClient } from '../orm.js';

function routeBetween(a,b,wayId='w1'){
  return {
    routePoints:[{lat:a.track.snapLat,lon:a.track.snapLon,wayId,maxSpeed:160,maxSpeedSource:'OSM'},{lat:b.track.snapLat,lon:b.track.snapLon,wayId,maxSpeed:160,maxSpeedSource:'OSM'}],
    segments:[{wayId,from:{lat:a.track.snapLat,lon:a.track.snapLon},to:{lat:b.track.snapLat,lon:b.track.snapLon},distanceKm:1,maxSpeed:160,maxSpeedSource:'OSM'}],
    distanceKm:1,
  };
}
function validVersion({state=ScheduleState.VALID}={}){
  const a=new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:{wayId:'w1',displayName:'1',lat:48,lon:2,snapLat:48,snapLon:2},departureSec:1000,dwellSec:0});
  const b=new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:{wayId:'w1',displayName:'1',lat:48,lon:2.01,snapLat:48,snapLon:2.01},arrivalSec:1100,departureSec:1400,dwellSec:300});
  const snap=routeBetween(a,b);
  return new ScheduleVersion({state,category:TrainCategory.PASSENGER,locations:[a,b],outboundPath:{topologyRevision:1,resolvedRevision:1,routePoints:snap.routePoints,segments:snap.segments,legs:[{id:'leg-a-b',fromLocationId:'a',toLocationId:'b',constraintIds:[],...snap}],distanceKm:1}});
}

test('v1.1.74 parser accepts J+N shorthand and canonical form',()=>{
  assert.equal(parseScheduleClock('J+1 00:15',0),87300);
  assert.equal(parseScheduleClock('00:15 (+1)',0),87300);
});

test('v1.1.74 new stops and terminal layover default to 5 minutes',()=>{
  assert.equal(new ScheduledLocation({}).dwellSec,300);
  assert.equal(new RoundTripGroup({}).terminalLayoverSec,300);
  assert.equal(new ScheduledLocation({dwellSec:0}).dwellSec,0,'explicit 0 remains player-controlled');
});

test('v1.1.74 stale topology can never validate',()=>{
  const v=validVersion();
  v.outboundPath.topologyRevision=2;v.outboundPath.resolvedRevision=1;
  const r=validateScheduleVersion(v,{ormAvailable:false});
  assert.ok(r.errors.some(x=>x.code==='ROUTE_TOPOLOGY_STALE'));
});

test('v1.1.74 manual arrival before physical minimum is rejected',()=>{
  const v=validVersion();const b=v.locations[1];
  b.computedArrivalSec=1200;b.arrivalOverride=true;b.arrivalSec=1100;
  const r=validateScheduleVersion(v);
  assert.ok(r.errors.some(x=>x.code==='MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'));
});

test('v1.1.74 Schedule Manager enforces unique generated train numbers',()=>{
  const m=new ScheduleV2Manager();
  const a=m.createDraft({number:'17801'}),b=m.createDraft({number:'17801'});
  assert.equal(a.number,'17801');assert.notEqual(b.number,a.number);
  const c=m.duplicateSchedule(a.id,{preserveState:true,number:'17801'});
  assert.notEqual(c.number,'17801');
});

test('v1.1.74 round-trip duplication preserves NEEDS_REPAIR historical versions',()=>{
  const m=new ScheduleV2Manager();
  const out=m.createDraft({number:'17801'}),ret=m.createDraft({number:'17802'});
  out.currentVersion.locations=validVersion().locations;out.currentVersion.outboundPath=validVersion().outboundPath;out.currentVersion.state=ScheduleState.VALID;
  ret.currentVersion.locations=[...validVersion().locations].reverse().map((x,i)=>new ScheduledLocation({...x.toJSON(),id:i?'ra':'rb',order:i,stationId:i?'A':'B',name:i?'A':'B',track:{...x.track.toJSON(),wayId:'w1'},departureSec:i?2200:1600,arrivalSec:i?2200:null}));
  const rs=routeBetween(ret.currentVersion.locations[0],ret.currentVersion.locations[1]);ret.currentVersion.outboundPath=new SchedulePath({topologyRevision:1,resolvedRevision:1,routePoints:rs.routePoints,segments:rs.segments,legs:[{id:'leg-r',fromLocationId:ret.currentVersion.locations[0].id,toLocationId:ret.currentVersion.locations[1].id,constraintIds:[],...rs}],distanceKm:1});ret.currentVersion.state=ScheduleState.VALID;
  out.createVersion({state:ScheduleState.NEEDS_REPAIR});ret.createVersion({state:ScheduleState.NEEDS_REPAIR});
  out.currentVersionId=out.versions[0].id;ret.currentVersionId=ret.versions[0].id;
  const g=m.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:300});
  const made=m.duplicateRoundTrip(g.id,{intervalSec:3600,horizonSec:3600,maxPairs:1});
  assert.equal(made.length,1);
  assert.ok(made[0].outbound.versions.some(v=>v.state===ScheduleState.NEEDS_REPAIR));
  assert.ok(made[0].return.versions.some(v=>v.state===ScheduleState.NEEDS_REPAIR));
});

test('v1.1.74 route memory key includes physical profile',()=>{
  const o=new ORMClient();const a=[{lat:48,lon:2,wayId:'1'},{lat:48,lon:2.1,wayId:'2'}];
  const k1=o._cursorRouteMemoryKey(a,{maxSpeed:160,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435]});
  const k2=o._cursorRouteMemoryKey(a,{maxSpeed:120,traction:'diesel',gauges:[1435]});
  assert.notEqual(k1,k2);
});

test('v1.1.74 saved route memory hydrates only fresh VALID versions',()=>{
  const o=new ORMClient();const v=validVersion();
  const manager={schedules:[{versions:[v]}]};
  assert.equal(o.hydrateCursorRouteMemoryFromSchedules(manager),1);
  v.state=ScheduleState.NEEDS_REPAIR;assert.equal(o.hydrateCursorRouteMemoryFromSchedules(manager),0);
  v.state=ScheduleState.VALID;v.outboundPath.resolvedRevision=0;assert.equal(o.hydrateCursorRouteMemoryFromSchedules(manager),0);
});

test('v1.1.74 reference rame preserves electrical/gauge/brake metadata and no hidden payload',()=>{
  const p=PerformanceProfile.fromLegacyRame({id:'r',name:'R',maxSpeed:160,totalMass:100,totalPower:4000,totalLength:100,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435],elementDetails:[{category:'automotrice',mass:100,power:4000,brakeServiceMs2:1.1,electricSystems:[{voltage:25000,frequency:50}],gauge:1435}]});
  assert.equal(p.massKg,100000);assert.equal(p.electricSystems[0].voltage,25000);assert.ok(p.gauges.includes(1435));assert.ok(p.brakeServiceMs2>1);
});

test('v1.1.74 remove first stop drops VIA of deleted leg and interior merge keeps railway order',async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);ed._routeGeneration=0;ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed._autosaveSoon=()=>{};ed._recomputeActivePath=async()=>true;ed._error=()=>{};
  const locs=['A','B','C'].map((n,i)=>new ScheduledLocation({id:n,order:i,stationId:n,name:n,track:{wayId:'w'+i,displayName:'1',lat:48,lon:2+i*.01,snapLat:48,snapLon:2+i*.01}}));
  const path=new SchedulePath({constraints:[new RouteConstraint({id:'ab',legIndex:0,order:0,wayId:'w0',lat:48,lon:2.005}),new RouteConstraint({id:'bc',legIndex:1,order:1,wayId:'w1',lat:48,lon:2.015})]});
  const ver=new ScheduleVersion({locations:locs,outboundPath:path});ed._activeVersion=()=>ver;ed._activePath=()=>ver.outboundPath;
  await ed.removeStop('A');assert.deepEqual(ver.outboundPath.constraints.map(c=>c.id),['bc']);assert.equal(ver.outboundPath.constraints[0].legIndex,0);
});

test('SC Future source contains async route generation guard, exact pixel binding, no automatic boot revalidation and no segment-count wrong-way penalty',()=>{
  const editor=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const orm=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(editor,/_routeGeneration/);assert.match(editor,/HIT_TOLERANCE_PX=5/);assert.match(editor,/chooseTrackCandidatesAtCursor/);assert.match(editor,/ROUTE_TOPOLOGY_STALE|topologyRevision/);
  assert.doesNotMatch(orm,/wrong\s*\*\s*50/);assert.match(orm,/wrongKm\s*\*\s*100/);assert.doesNotMatch(main,/scheduleV2Revalidator\?\.run\?\./);assert.doesNotMatch(main,/scheduleV2Revalidator\?\.run\(/);
});

test('v1.1.74 Schedule V2 schema 1 has an explicit migration path instead of silent data loss',()=>{
  const m=new ScheduleV2Manager();assert.equal(m.loadFromSave({schemaVersion:1,schedules:[],calendars:[],roundTrips:[],technicalLocations:[]}),true);
  assert.equal(m.loadFromSave({schemaVersion:999,schedules:[]}),false);
});

test('SC Future exact track binding refuses geometry outside the 5 px cursor hit', async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed.router={chooseTrackCandidates:async()=>[{wayId:'far',distanceM:20.01,snapLat:48,snapLon:2}]};
  await assert.rejects(()=>ed._exactTrackBinding(48,2,'1'),/5 px|tolérance graphique/);
});

test('v1.1.74 a free VIA after A→B is assigned to the future B→C leg', async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const a=new ScheduledLocation({id:'A',order:0,stationId:'A',name:'A',track:{wayId:'wa',displayName:'1',lat:48,lon:2,snapLat:48,snapLon:2}});
  const b=new ScheduledLocation({id:'B',order:1,stationId:'B',name:'B',track:{wayId:'wb',displayName:'1',lat:48,lon:2.01,snapLat:48,snapLon:2.01}});
  const v=new ScheduleVersion({locations:[a,b],outboundPath:{constraints:[]}});
  ed._activeVersion=()=>v;ed._activePath=()=>v.outboundPath;
  ed.router={chooseTrackCandidates:async()=>[{wayId:'wv',trackRef:'2',distanceM:2,snapLat:48,snapLon:2.015}]};
  ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed._autosaveSoon=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._setHint=()=>{};ed._recomputeActivePath=async()=>true;ed._error=e=>{throw e;};
  await ed._addConstraint(48,2.015);
  assert.equal(v.outboundPath.constraints.length,1);
  assert.equal(v.outboundPath.constraints[0].legIndex,1);
  assert.equal(v.outboundPath.constraints[0].wayId,'wv');
});

test('v1.1.74 an older async ORM calculation can never overwrite a newer route', async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const v=validVersion();
  v.outboundPath=new SchedulePath({topologyRevision:1,resolvedRevision:1});
  ed.version=v;ed.mode='OUTBOUND';ed._routeGeneration=0;ed._activeVersion=()=>v;ed._activePath=()=>v.outboundPath;
  ed._setHint=()=>{};ed._setActivePreview=()=>{};ed.game={weather:null,orm:{_lastCursorRouteFailure:''}};
  let resolveOld;let calls=0;
  const oldRoute=[{lat:48,lon:2,wayId:'w1',maxSpeed:160,maxSpeedSource:'OSM',marker:'old'},{lat:48,lon:2.01,wayId:'w1',maxSpeed:160,maxSpeedSource:'OSM',marker:'old'}];
  oldRoute._resolvedAnchors=[{lat:48,lon:2,wayId:'w1'},{lat:48,lon:2.01,wayId:'w1'}];
  const newRoute=[{lat:48,lon:2,wayId:'w1',maxSpeed:160,maxSpeedSource:'OSM',marker:'new'},{lat:48,lon:2.01,wayId:'w1',maxSpeed:160,maxSpeedSource:'OSM',marker:'new'}];
  newRoute._resolvedAnchors=[{lat:48,lon:2,wayId:'w1'},{lat:48,lon:2.01,wayId:'w1'}];
  const snap=(route)=>({routePoints:route.map(x=>({...x})),segments:[{wayId:'w1',from:route[0],to:route[1],distanceKm:1,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,gauge:[1435]}],distanceKm:1});
  ed.router={
    routeBetweenBindings:async()=>{calls++;if(calls===1)return await new Promise(r=>{resolveOld=r;});return newRoute;},
    snapshotRoute:snap,
  };
  const first=ed._recomputeActivePath({topologyChanged:false});
  await Promise.resolve();
  const second=ed._recomputeActivePath({topologyChanged:false});
  await second;
  resolveOld(oldRoute);
  await first;
  assert.equal(v.outboundPath.routePoints[0].marker,'new');
});

test('v1.1.74 electric/gauge profile routing rejects a shorter incompatible path',()=>{
  const orm=new ORMClient();
  const nodes=new Map();
  const node=(id,lat,lon)=>({id,lat,lon,edges:[]});
  nodes.set('S',node('S',48,2));nodes.set('X',node('X',48.01,2));nodes.set('Y',node('Y',48,2.005));nodes.set('E',node('E',48.02,2));
  const edge=(from,to,wayId,dist,electrified,gauge=[1435],voltage=[])=>({from,to,wayId,dist,maxSpeed:160,maxSpeedSource:'OSM',directionForbidden:false,againstPreferredDirection:false,travelDirection:'forward',electrified,voltage,frequency:voltage.length?[50]:[],gauge,service:'',usage:'main',railway:'rail'});
  nodes.get('S').edges.push(edge('S','X','E1',2,true,[1435],[25000]),edge('S','Y','N1',.25,false,[1435],[]));
  nodes.get('X').edges.push(edge('X','E','E2',2,true,[1435],[25000]));
  nodes.get('Y').edges.push(edge('Y','E','N2',.25,false,[1435],[]));
  const route=orm._route({nodes},'S','E',{directed:true,maxSpeed:160,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435]});
  assert.ok(route?.length>=3);
  assert.ok(route.every(p=>!String(p.wayId||'').startsWith('N')),'pure electric train must not select the shorter non-electrified branch');
});

test('v1.1.74 blank timetable field really clears a manual override',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const loc=new ScheduledLocation({id:'A',order:0,name:'A',departureSec:1000,arrivalSec:900});
  loc.computedArrivalSec=800;loc.arrivalOverride=true;loc.arrivalSec=900;
  const ver=new ScheduleVersion({locations:[loc]});
  ed._activeVersion=()=>ver;ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._autosaveSoon=()=>{};ed.game={weather:null};
  ed._handleStopField({target:{dataset:{stop:'A:arr'},value:''}});
  assert.equal(ver.locations[0].arrivalOverride,false);
});

test('v1.1.74 editor transient modes are fully reset between schedules',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed._routeGeneration=3;ed.pendingStation={x:1};ed._replaceLocationId='x';ed._forcedConstraintLegIndex=4;ed._viaNext=true;ed._technicalNext=true;ed._constraintEdit={};ed.selectedConstraintId='c';ed._manualTraceMode=true;ed._manualTraceLegIndex=2;ed.insertConstraint={};ed.busy=true;ed.picker={classList:{remove(){}}};
  ed._resetTransientModes();
  assert.equal(ed._routeGeneration,4);assert.equal(ed.pendingStation,null);assert.equal(ed._forcedConstraintLegIndex,null);assert.equal(ed._viaNext,false);assert.equal(ed._technicalNext,false);assert.equal(ed.selectedConstraintId,null);assert.equal(ed._manualTraceMode,false);assert.equal(ed.busy,false);
});

test('v1.1.74 route endpoint mismatch around 50 m is no longer accepted',()=>{
  const v=validVersion();
  const last=v.outboundPath.routePoints.at(-1);
  last.lat+=0.00045;
  v.outboundPath.legs[0].routePoints.at(-1).lat=last.lat;
  const r=validateScheduleVersion(v);
  assert.ok(r.errors.some(x=>String(x.code).includes('ENDPOINT')||String(x.code).includes('ROUTE')));
});

test('v1.1.74 manual departure shorter than the physical dwell is rejected',()=>{
  const v=validVersion();const b=v.locations[1];
  b.computedArrivalSec=1100;b.computedDepartureSec=1400;b.departureOverride=true;b.departureSec=1200;
  const r=validateScheduleVersion(v);
  assert.ok(r.errors.some(x=>x.code==='MANUAL_DEPARTURE_DWELL_IMPOSSIBLE'));
});

test('v1.1.86 saved exact route memory survives unrelated resident topology streaming',()=>{
  const orm=new ORMClient();const anchors=[{lat:48,lon:2,wayId:'1'},{lat:48,lon:2.01,wayId:'1'}];
  const route=[{lat:48,lon:2,wayId:'1'},{lat:48,lon:2.01,wayId:'1'}];
  assert.equal(orm.rememberCursorRoute(anchors,route,{maxSpeed:160}),true);
  const before=orm.recallCursorRoute(anchors,{maxSpeed:160});assert.ok(before);
  orm._touchTopology();
  const after=orm.recallCursorRoute(anchors,{maxSpeed:160});
  assert.ok(after,'unrelated resident streaming must not destroy a validated exact route snapshot');
  assert.equal(after._fromScheduleRouteMemory,true);
});

test('v1.1.74 every cursor route-memory write carries the routing profile',()=>{
  const src=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  const calls=[...src.matchAll(/rememberCursorRoute\(all,([^;\n]+)\)/g)].map(m=>m[0]);
  assert.ok(calls.length>=4);
  for(const call of calls)assert.match(call,/opts\s*\|\|\s*\{\}/,call);
});

test('v1.1.74 save-load hydrates route memory only after topology invalidation',()=>{
  const src=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const dirty=src.indexOf('if (s.voiePoints || s.ormRoutes) this.orm.markGraphDirty()');
  const hydrate=src.indexOf('this.orm.hydrateCursorRouteMemoryFromSchedules?.(this.scheduleV2)');
  assert.ok(dirty>=0&&hydrate>dirty);
});

test('v1.1.74 loading gauge / axle / metre limits participate in ORM route choice when known',()=>{
  const orm=new ORMClient();const nodes=new Map();
  for(const [id,lat,lon] of [['S',48,2],['A',48,2.002],['B',48.002,2],['E',48.004,2]])nodes.set(id,{id,lat,lon,edges:[]});
  const e=(from,to,wayId,dist,loadingGauge,axleLoad,metreLoad)=>({from,to,wayId,dist,maxSpeed:160,maxSpeedSource:'OSM',directionForbidden:false,againstPreferredDirection:false,travelDirection:'forward',electrified:true,voltage:[25000],frequency:[50],gauge:[1435],loadingGauge,axleLoad,metreLoad,service:'',usage:'main',railway:'rail'});
  // Short branch is physically too small/light; longer branch is compatible.
  nodes.get('S').edges.push(e('S','A','BAD1',.1,'GA',20,6),e('S','B','GOOD1',1,'GC',25,9));
  nodes.get('A').edges.push(e('A','E','BAD2',.1,'GA',20,6));
  nodes.get('B').edges.push(e('B','E','GOOD2',1,'GC',25,9));
  const route=orm._route({nodes},'S','E',{directed:true,maxSpeed:160,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435],loadingGauge:'GB',axleLoad:22.5,metreLoad:8});
  assert.ok(route?.length>=3);
  assert.ok(route.every(p=>!String(p.wayId||'').startsWith('BAD')),'known physical envelope must beat the shorter incompatible branch');
});

test('v1.1.74 reference Rame propagates known physical envelope without inventing unknown values',()=>{
  const p=PerformanceProfile.fromLegacyRame({id:'R',name:'R',maxSpeed:120,totalMass:100,totalPower:2000,totalLength:50,traction:'electric',elementDetails:[
    {category:'locomotive',mass:80,power:2000,maxSpeed:120,loadingGauge:'GB',axleLoad:22.5,metreLoad:7.2,gauge:1435},
    {category:'voiture',mass:20,power:0,maxSpeed:120,loadingGauge:'GB',axleLoad:18,metreLoad:5,gauge:1435},
  ]},TrainCategory.PASSENGER);
  assert.equal(p.loadingGauge,'GB');assert.equal(p.axleLoad,22.5);assert.equal(p.metreLoad,7.2);
  const unknown=PerformanceProfile.fromLegacyRame({totalMass:100,totalPower:1000,totalLength:20,elementDetails:[]},TrainCategory.PASSENGER);
  assert.equal(unknown.loadingGauge,'');assert.equal(unknown.axleLoad,null);assert.equal(unknown.metreLoad,null);
});

test('v1.1.74 exact-track validation rejects endpoint geometry carried by the wrong wayId',()=>{
  const v=validVersion();
  v.outboundPath.routePoints[0].wayId='parallel-wrong';
  v.outboundPath.legs[0].routePoints[0].wayId='parallel-wrong';
  const r=validateScheduleVersion(v);
  assert.ok(r.errors.some(x=>x.code==='LEG_START_WAY_MISMATCH'));
});

test('v1.1.74 runtime timing never re-introduces a hidden 70 percent payload',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-runtime.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/passengerCapacity\|\|0\)\)\s*\*\s*\.7/);
  assert.doesNotMatch(src,/freightCapacity\|\|0\)\)\s*\*\s*\.7/);
  assert.match(src,/referenceLoadedMassKg=Math\.max\(1000,Number\(f\.massKg\|\|0\)\)/);
});
