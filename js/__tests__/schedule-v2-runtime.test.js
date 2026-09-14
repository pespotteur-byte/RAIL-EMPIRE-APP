import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import {
  ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding,
  TrainCategory, StopCode,
} from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { recalculateScheduleTiming } from '../schedule-v2-timing.js';

function makeGame() {
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={
    stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],
    getStationById(id){return this.stations.find(s=>s.id===id)||null;},
  };
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function addValidSchedule(game,{number='17802', optional=false, long=false}={}) {
  const rec=game.scheduleV2.createDraft({number,name:'Test',category:TrainCategory.FREIGHT,maxSpeed:120});
  const v=rec.currentVersion;
  const a=new ScheduledLocation({id:'la',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),arrivalSec:null,departureSec:23*3600+50*60,dwellSec:0,stopCode:StopCode.C});
  const bArr=long ? 26*3600+10*60 : 24*3600+10*60;
  const b=new ScheduledLocation({id:'lb',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:bArr,departureSec:bArr+120,dwellSec:120,stopCode:optional?StopCode.OPTIONAL_S:StopCode.S,arrivalOverride:true,departureOverride:true});
  v.locations=[a,b];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'la',toLocationId:'lb',constraintIds:[],routePoints:[{lat:48,lon:2,wayId:'10',maxSpeed:120,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:120,electrified:false}],segments:[],distanceKm:30}];
  v.outboundPath.routePoints=v.outboundPath.legs[0].routePoints;
  v.outboundPath.segments=[];
  v.state=ScheduleState.VALID;
  return rec;
}
function addDieselFormation(game,rot,rec) {
  const loco=game.rotationV2.addVehicle({number:'BB TEST',name:'Diesel',category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id});
  occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
  return {loco,occ};
}

test('V2 runtime compiles a J+1 service with absolute timetable and exact train number',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game);
  const rot=game.rotationV2.addRotation({name:'R1'});
  addDieselFormation(game,rot,rec);
  // 23:50 J -> 00:10 (+1), sync one minute before departure.
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.number,'17802'); // must not be forced odd by legacy creator
  assert.equal(svc.stops[0].departureTime,23*60+50);
  assert.ok(svc.stops[1].arrivalTime>1440);
  assert.equal(svc._v2BaseDate,'2026-08-16');
});

test('V2 runtime finds and keeps a service spanning more than 24h',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game,{long:true});
  const rot=game.rotationV2.addRotation({name:'Long'});
  addDieselFormation(game,rot,rec);
  // At J+1 01:00 the train that left previous operating day still exists.
  game.scheduleV2Runtime.sync(60,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.ok(game.scheduleCreator.services[0].stops.at(-1).arrivalTime>24*60);
});

test('[S] decision is deterministic per real circulation date and persisted on occurrence',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game,{optional:true});
  const rot=game.rotationV2.addRotation({name:'Optional'});
  const {occ}=addDieselFormation(game,rot,rec);
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  const keys1=Object.keys(occ.optionalStopDecisions);
  assert.ok(keys1.some(k=>k.startsWith('2026-08-16|')));
  const saved={...occ.optionalStopDecisions};
  game.scheduleCreator.services=[];
  game.rotationV2.vehicles[0].available=true;
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-17');
  const keys2=Object.keys(occ.optionalStopDecisions);
  assert.ok(keys2.some(k=>k.startsWith('2026-08-17|')));
  for(const [k,v] of Object.entries(saved)) assert.equal(occ.optionalStopDecisions[k],v);
});

test('V2 runtime does not spawn a train without active titular traction',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game);
  const rot=game.rotationV2.addRotation({name:'No loco'});
  game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id});
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>['NO_TRACTION','NO_ACTIVE_TRACTION_ASSIGNED','NO_TRACTION_AFTER_OPERATION'].includes(a.code)));
});

test('known track gauge mismatch blocks departure even for diesel',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game);const v=rec.currentVersion;
  v.outboundPath.segments=[{wayId:'10',gauge:[1000],electrified:false,maxSpeed:80,maxSpeedSource:'OSM'}];
  const rot=game.rotationV2.addRotation({name:'Gauge'});
  const loco=game.rotationV2.addVehicle({number:'D1435',name:'Diesel',category:'locomotive',traction:'diesel',gauges:[1435],maxSpeed:120,massKg:80000,powerW:2000000});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='PHYSICAL_INCOMPATIBILITY'&&a.message.includes('Écartement')));
});


test('slower real material departs without approval and uses automatically recalculated timing',()=>{
  const game=makeGame();
  const rec=game.scheduleV2.createDraft({number:'SLOW1',name:'Slow approval',category:TrainCategory.FREIGHT,maxSpeed:160});
  const v=rec.currentVersion;
  v.locations=[
    new ScheduledLocation({id:'sa',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:23*3600+50*60,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'sb',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.18,lon:2,snapLat:48.18,snapLon:2}),dwellSec:120,stopCode:StopCode.S}),
  ];
  v.outboundPath.routePoints=[{lat:48,lon:2,wayId:'10',maxSpeed:160,electrified:false},{lat:48.18,lon:2,wayId:'11',maxSpeed:160,electrified:false}];
  v.outboundPath.legs=[{id:'slowleg',fromLocationId:'sa',toLocationId:'sb',constraintIds:[],routePoints:v.outboundPath.routePoints,segments:[],distanceKm:20}];
  recalculateScheduleTiming(v,{firstDepartureSec:23*3600+50*60});
  v.state=ScheduleState.VALID;

  const rot=game.rotationV2.addRotation({name:'Slow rotation'});
  const loco=game.rotationV2.addVehicle({number:'SLOW DIESEL',name:'Slow diesel',category:'locomotive',traction:'diesel',maxSpeed:60,massKg:90000,powerW:700000,lengthM:20});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});

  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(game.rotationV2.timingMismatchNeedsApproval(occ),false);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='TIMING_MISMATCH_AUTO_RECALCULATED'));
  assert.equal(game.scheduleCreator.services[0].number,'SLOW1');
  assert.equal(game.scheduleCreator.services[0].stops[0].departureTime,23*60+50);
});

test('v1.1.97 restores terminal stopped cursor past the last stop and repairs poisoned v1.1.96 snapshot',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game);
  const rot=game.rotationV2.addRotation({name:'Terminal restore'});
  addDieselFormation(game,rot,rec);
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  const svc=game.scheduleCreator.services[0];
  assert.ok(svc);
  const lastIdx=svc.stops.length-1;
  const terminal=svc.stops[lastIdx];

  // Simulate an already-poisoned v1.1.96 save: stopped physically at terminal,
  // but cursor was clamped back onto the terminal itself instead of stops.length.
  game.scheduleV2Runtime._pendingSnapshots.set(String(svc.id),{
    id:svc.id,
    state:'stopped_at_station',
    currentStopIndex:lastIdx,
    isReturnLeg:false,
    position:null,
    speed:0,delay:0,completed:false,cancelled:false,
    platformAssignment:{stationId:terminal.stationId,platform:terminal.platform||'',voiePointId:null},
    vehicleIds:[],formationMembers:[],train:{speed:0,delay:0,state:'stopped_at_station',delayReason:''},
  });
  assert.equal(game.scheduleV2Runtime._restoreSnapshot(svc),true);
  assert.equal(svc.currentStopIndex,svc.stops.length,'terminal cursor must be the after-last sentinel');
  assert.equal(svc.getNextStop(),null,'terminal must not reappear as next stop');
});

test('v1.1.97 live stopped-cursor self-heal releases a train whose next stop wrongly equals its occupied terminal',()=>{
  const game=makeGame();
  const rec=addValidSchedule(game);
  const rot=game.rotationV2.addRotation({name:'Live terminal repair'});
  addDieselFormation(game,rot,rec);
  game.scheduleV2Runtime.sync(23*60+49,'2026-08-16');
  const svc=game.scheduleCreator.services[0];
  const terminal=svc.stops.at(-1);
  const terminalStation=game.world.getStationById(terminal.stationId);

  // Reproduce field symptom exactly: train visibly stopped at B while B is also
  // (incorrectly) still the cursor's next stop.
  svc.state='stopped_at_station';
  svc.train.state='stopped_at_station';
  svc.currentStopIndex=svc.stops.length-1;
  svc.position={lat:terminalStation.lat,lon:terminalStation.lon};
  svc.train.stoppedAt=terminalStation;
  svc._platformAssignment={stationId:terminal.stationId,platform:terminal.platform||'',voiePointId:null};
  svc.train._stoppedSinceGameTime=terminal.arrivalTime;

  // J+1 00:12 == absolute minute 1452, the booked terminal release in fixture.
  const oldWindow=globalThis.window;
  globalThis.window={game:{
    unions:null,scheduleCreator:game.scheduleCreator,world:game.world,
    depotManager:null,voiePointManager:null,platformManager:null,realismSettings:{},
  }};
  try{
    svc.scheduleTick(12,'2026-08-17',null);
    assert.equal(svc.completed,true,'service must leave the stopped state / finalize');
    assert.equal(svc.state,'completed');
  }finally{ globalThis.window=oldWindow; }
});
