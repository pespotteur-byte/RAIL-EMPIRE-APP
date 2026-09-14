import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { RotationV2Manager, FormationRole, RotationActionType } from '../rotation-v2-model.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';

function way(id, coords, nodeIds, extra={}) {
  return { id, geometry:coords.map(([lat,lon])=>({lat,lon})), nodeIds,
    maxSpeed:120,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[25000],frequency:[50],gauge:[1435],
    loadingGauge:'',axleLoad:null,metreLoad:null,tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',
    preferredDirection:'',bidirectional:'',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{},...extra };
}

function runtimeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[],tracks:[],getStationById(){return null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function addSchedule(game,{number='8398571',dep=16*3600+19*60,arr=16*3600+30*60,calendarIds=[]}={}){
  const rec=game.scheduleV2.createDraft({number,name:'TER test',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;
  v.calendarIds=[...calendarIds];
  v.locations=[
    new ScheduledLocation({id:`a-${number}`,order:0,stationId:'osm-node-A',name:'Château-Thierry',track:new TrackBinding({displayName:'V1',lat:49.04,lon:3.40,snapLat:49.04,snapLon:3.40}),departureSec:dep,dwellSec:0,stopCode:StopCode.NONE}),
    new ScheduledLocation({id:`b-${number}`,order:1,stationId:'osm-node-B',name:'Dormans',track:new TrackBinding({displayName:'V1',lat:49.07,lon:3.64,snapLat:49.07,snapLon:3.64}),arrivalSec:arr,departureSec:arr+120,dwellSec:120,stopCode:StopCode.NONE,arrivalOverride:true,departureOverride:true}),
  ];
  const points=[{lat:49.04,lon:3.40,wayId:'1',maxSpeed:160},{lat:49.055,lon:3.52,wayId:'1',maxSpeed:160},{lat:49.07,lon:3.64,wayId:'1',maxSpeed:160}];
  v.outboundPath.routePoints=points;
  v.outboundPath.legs=[{fromLocationId:v.locations[0].id,toLocationId:v.locations[1].id,constraintIds:[],routePoints:points,segments:[],distanceKm:18}];
  v.outboundPath.distanceKm=18;v.outboundPath.error='';v.state=ScheduleState.VALID;
  return rec;
}

function addLocoAndOccurrence(game,rec,rotationName='R'){
  const rot=game.rotationV2.addRotation({name:rotationName});
  const loco=game.rotationV2.addVehicle({number:'BB-'+rotationName,name:'BB',category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:3000000,lengthM:20,gauges:[1435]});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});
  return {rot,loco,occ};
}

test('v1.1.32 global VIA routing backtracks from closer dead-end parallel rail to connected rail', async()=>{
  const orm=new ORMClient();
  const dead=way(101,[[48.00000,2.00],[48.00000,2.10]],[1,2]);
  const through=way(202,[[48.00025,2.00],[48.00025,2.10],[48.00025,2.20]],[11,12,13]);
  orm._ways.set(dead.id,dead);orm._ways.set(through.id,through);
  orm.fetchRailwayTiles=async()=>[dead,through];orm._findCursorLegBroadArea=async()=>null;
  const route=await orm.findRouteViaCursorAnchors([
    {lat:48.00002,lon:2.01},{lat:48.00002,lon:2.09},{lat:48.00025,lon:2.19},
  ],{allowFallback:false});
  assert.ok(route?.length>=3,'full A→VIA→B chain must exist');
  assert.equal(route._resolvedAnchors.length,3);
  assert.equal(String(route._resolvedAnchors[1].wayId),'202');
});

test('v1.1.77 railway direction semantics supersede the old road-style oneway contract', async()=>{
  const orm=new ORMClient();
  // Generic OSM oneway=* is road semantics and must not delete a physical railway direction.
  const w=way(301,[[48,2],[48,2.1],[48,2.2]],[1,2,3],{oneway:'yes'});
  orm._ways.set(w.id,w);orm.fetchRailwayTiles=async()=>[w];orm._findCursorLegBroadArea=async()=>null;
  const forward=await orm.findRouteViaCursorAnchors([{lat:48,lon:2.01},{lat:48,lon:2.19}],{allowFallback:false});
  const reverse=await orm.findRouteViaCursorAnchors([{lat:48,lon:2.19},{lat:48,lon:2.01}],{allowFallback:false});
  assert.ok(forward?.length>=2);assert.ok(reverse?.length>=2);

  // Explicit railway direction metadata remains authoritative.
  const orm2=new ORMClient();
  const single=way(302,[[48,2],[48,2.1],[48,2.2]],[11,12,13],{bidirectional:'no',preferredDirection:'forward'});
  orm2._ways.set(single.id,single);orm2.fetchRailwayTiles=async()=>[single];orm2._findCursorLegBroadArea=async()=>null;
  const ok=await orm2.findRouteViaCursorAnchors([{lat:48,lon:2.01},{lat:48,lon:2.19}],{allowFallback:false});
  const blocked=await orm2.findRouteViaCursorAnchors([{lat:48,lon:2.19},{lat:48,lon:2.01}],{allowFallback:false});
  assert.ok(ok?.length>=2);assert.equal(blocked,null);
});

test('v1.1.32 strict route lookup cannot reuse a synthetic route cached by permissive lookup',async()=>{
  const orm=new ORMClient();orm._maxFallbackKm=1;orm.fetchArea=async()=>[];
  const loose=await orm.findRoute(48,2,48,2.005,{allowFallback:true});
  const strict=await orm.findRoute(48,2,48,2.005,{allowFallback:false});
  assert.equal(loose,null);
  assert.equal(strict,null);
  assert.equal(orm.routeCache.size,2,'strict/fallback policies must never share the same cache key');
});

test('v1.1.32 validation rejects missing legs instead of certifying partial path',()=>{
  const game=runtimeGame();const rec=addSchedule(game);const v=rec.currentVersion;
  const c=new ScheduledLocation({id:'c',order:2,stationId:'osm-node-C',name:'Épernay',track:new TrackBinding({displayName:'V1',lat:49.05,lon:3.95,snapLat:49.05,snapLon:3.95}),arrivalSec:17*3600,departureSec:17*3600+120,dwellSec:120});
  v.locations.push(c);v.normalize();
  const report=validateScheduleVersion(v,{ormAvailable:true});
  assert.equal(report.canValidate,false);
  assert.ok(report.issues.some(i=>i.code==='LEG_COUNT_MISMATCH'||i.code==='LEG_MISSING'));
});

test('v1.1.32 cancelled occurrence never creates a service',()=>{
  const game=runtimeGame();const rec=addSchedule(game);const {occ}=addLocoAndOccurrence(game,rec);occ.cancelled=true;
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
});

test('v1.1.32 pinned version calendar is fail-closed on non-applicable date',()=>{
  const game=runtimeGame();const cal=game.scheduleV2.addCalendar({name:'Lundi',startDate:'2026-08-17',endDate:'2026-08-17',weekdays:[1]});
  const rec=addSchedule(game,{calendarIds:[cal.id]});addLocoAndOccurrence(game,rec);
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_OCCURRENCE_NOT_RUNNABLE'||a.code==='OCCURRENCE_NOT_COMPILED'));
});

test('v1.1.32 same physical locomotive cannot be compiled into two concurrent services; earliest wins',()=>{
  const game=runtimeGame();
  const later=addSchedule(game,{number:'200',dep:16*3600+20*60,arr:16*3600+31*60});
  const earlier=addSchedule(game,{number:'100',dep:16*3600+19*60,arr:16*3600+30*60});
  const rotLater=game.rotationV2.addRotation({name:'later'}),rotEarlier=game.rotationV2.addRotation({name:'earlier'});
  const loco=game.rotationV2.addVehicle({number:'UNIQUE',category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:3000000,lengthM:20,gauges:[1435]});
  game.rotationV2.addOccurrence(rotLater.id,{scheduleId:later.id,versionId:later.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});
  game.rotationV2.addOccurrence(rotEarlier.id,{scheduleId:earlier.id,versionId:earlier.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(String(game.scheduleCreator.services[0].number),'100');
});

test('v1.1.32 second-precision V2 departure can leave exactly at HH:MM:SS',()=>{
  const game=runtimeGame();const dep=16*3600+19*60+37;const rec=addSchedule(game,{dep,arr:dep+11*60});addLocoAndOccurrence(game,rec);
  const t=16*60+19+37/60;game.scheduleV2Runtime.sync(t,'2026-08-16');
  const svc=game.scheduleCreator.services[0];assert.ok(svc);
  global.window={game:{...game,unions:{isServiceBlocked:()=>false},voiePointManager:null}};
  svc.scheduleTick(t,'2026-08-16',null);
  assert.equal(svc.state,'moving');
  delete global.window;
});


test('v1.1.32 V2 compile -> departure -> first movement frame stays on real route',()=>{
  const game=runtimeGame();const rec=addSchedule(game,{dep:16*3600+19*60,arr:16*3600+30*60});addLocoAndOccurrence(game,rec);
  const t=16*60+19;game.scheduleV2Runtime.sync(t,'2026-08-16');const svc=game.scheduleCreator.services[0];assert.ok(svc);
  global.window={game:{...game,unions:{isServiceBlocked:()=>false},voiePointManager:null,realismSettings:{physics:1},worksManager:null,staffManager:null}};
  svc.scheduleTick(t,'2026-08-16',null);assert.equal(svc.state,'moving');
  assert.doesNotThrow(()=>svc.moveUpdate(1,t,[]));
  assert.notEqual(svc.state,'blocked_route');assert.ok(svc.position);
  delete global.window;
});

test('v1.1.32 V2 runtime snapshot restores an in-line train instead of restarting at origin',()=>{
  const game=runtimeGame();const rec=addSchedule(game);const {loco}=addLocoAndOccurrence(game,rec);
  game.scheduleV2Runtime.sync(16*60+20,'2026-08-16');
  const svc=game.scheduleCreator.services[0];assert.ok(svc);
  svc.state='moving';svc.currentStopIndex=1;svc.position={lat:49.055,lon:3.52};svc._initializeState(svc.routes[0],'0-0');svc._state.index=0;svc._state.progress=.5;svc.speed=90;svc.train.speed=90;
  const snap=game.scheduleV2Runtime.toSave();
  game.scheduleCreator.services=[];game.scheduleCreator._invalidateActiveCache();loco.available=true;
  game.scheduleV2Runtime.loadFromSave(snap);game.scheduleV2Runtime._lastSyncKey='';
  game.scheduleV2Runtime.sync(16*60+20,'2026-08-16');
  const restored=game.scheduleCreator.services[0];assert.ok(restored);assert.equal(restored.state,'moving');
  assert.deepEqual(restored.position,{lat:49.055,lon:3.52});assert.equal(restored._state.progress,.5);assert.equal(restored.speed,90);
});

test('v1.1.32 terminal rotation operations delay material release/planned end',()=>{
  const game=runtimeGame();const rec=addSchedule(game);const {rot,occ,loco}=addLocoAndOccurrence(game,rec);
  game.rotationV2.addAction(rot.id,{type:RotationActionType.DETACH,occurrenceId:occ.id,locationOccurrenceId:rec.currentVersion.locations[1].id,vehicleIds:[loco.id],durationSec:600});
  game.rotationV2.recalculateRotation(rot.id);
  const expected=rec.currentVersion.lastArrivalSec+600;
  assert.ok(occ.resolvedEndSec>=expected,`${occ.resolvedEndSec} < ${expected}`);
});

test('v1.1.32 Livemap renderer explicitly keeps blocked_route services with a position',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(main,/svc\.state === 'blocked_route'/);
});

test('v1.1.32 compiled V2 service survives first real moveUpdate frame on ORM geometry',()=>{
  const game=runtimeGame();const dep=16*3600+19*60;const rec=addSchedule(game,{dep,arr:dep+11*60});addLocoAndOccurrence(game,rec);
  const t=16*60+19;game.scheduleV2Runtime.sync(t,'2026-08-16');const svc=game.scheduleCreator.services[0];assert.ok(svc);
  global.window={game:{...game,_currentDate:'2026-08-16',unions:{isServiceBlocked:()=>false},voiePointManager:null,worksManager:null,renderer:null,platformManager:null,depotManager:null}};
  try{
    svc.scheduleTick(t,'2026-08-16',null);assert.equal(svc.state,'moving');
    const before={...svc.position};svc.moveUpdate(0.5,t,[svc]);
    assert.equal(svc.state,'moving');assert.ok(svc.position);assert.ok(Number.isFinite(svc.position.lat)&&Number.isFinite(svc.position.lon));
    assert.notDeepEqual(svc.position,null);assert.ok(svc.speed>=0);assert.ok(before);
  } finally { delete global.window; }
});
