import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { SimulationEngine } from '../engine.js';
import {
  ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding,
  TrainCategory, StopCode,
} from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

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

function addSchedule(game,{number='8398571',departureSec=16*3600+19*60+37,arrivalSec=16*3600+30*60+42}={}) {
  const rec=game.scheduleV2.createDraft({number,name:'Terrain',category:TrainCategory.FREIGHT,maxSpeed:120});
  const v=rec.currentVersion;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec,departureSec:arrivalSec+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true}),
  ];
  const points=[{lat:48,lon:2,wayId:'10',maxSpeed:120,electrified:false},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:120,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:120,electrified:false}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:points,segments:[],distanceKm:30}];
  v.outboundPath.routePoints=points;
  v.outboundPath.segments=[];
  v.state=ScheduleState.VALID;
  return rec;
}

function addVehicle(game,number='D1') {
  return game.rotationV2.addVehicle({number,name:number,category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});
}
function addFormation(game,rot,rec,vehicle,{sequence=0}={}) {
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,sequence});
  occ.formation.members=[new FormationMember({vehicleId:vehicle.id,role:FormationRole.LEAD,order:0})];
  return occ;
}

test('runtime honors the exact version pinned by the rotation occurrence',()=>{
  const game=makeGame();
  const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const pinned=rec.currentVersion;
  const newer=rec.createVersion({state:ScheduleState.VALID});
  newer.locations[0].departureSec=20*3600;
  newer.locations[0].computedDepartureSec=20*3600;
  const rot=game.rotationV2.addRotation({name:'Pinned'});
  const vehicle=addVehicle(game);
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:pinned.id});
  occ.formation.members=[new FormationMember({vehicleId:vehicle.id,role:FormationRole.LEAD})];
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(game.scheduleCreator.services[0].stops[0].departureTime,16*60+19);
});

test('pinned version calendar is fail-closed when not applicable',()=>{
  const game=makeGame();
  const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const cal=game.scheduleV2.addCalendar({name:'Tomorrow only',startDate:'2026-08-17',endDate:'2026-08-17'});
  rec.currentVersion.calendarIds=[cal.id];
  const rot=game.rotationV2.addRotation({name:'Calendar'});addFormation(game,rot,rec,addVehicle(game));
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_OCCURRENCE_NOT_RUNNABLE'));
});

test('cancelled occurrence never spawns a service',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const rot=game.rotationV2.addRotation({name:'Cancelled'});const occ=addFormation(game,rot,rec,addVehicle(game));occ.cancelled=true;
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
});

test('invalid leg never creates a service and does not lock its locomotive',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  rec.currentVersion.outboundPath.legs=[];
  const rot=game.rotationV2.addRotation({name:'Broken route'});const vehicle=addVehicle(game);addFormation(game,rot,rec,vehicle);
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.equal(vehicle.available,true);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_ROUTE_INVALID'));
});

test('one physical locomotive can own only one due V2 service',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const vehicle=addVehicle(game);
  const r1=game.rotationV2.addRotation({name:'First'}),r2=game.rotationV2.addRotation({name:'Second'});
  addFormation(game,r1,rec,vehicle);addFormation(game,r2,rec,vehicle);
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(game.scheduleCreator.services[0]._v2VehicleIds[0],vehicle.id);
});

test('V2 runtime snapshot restores an in-progress train at its saved Livemap position',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const rot=game.rotationV2.addRotation({name:'Reload'});addFormation(game,rot,rec,addVehicle(game));
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  const svc=game.scheduleCreator.services[0];
  svc.state='moving';svc.currentStopIndex=0;svc.position={lat:48.1,lon:2.1};svc.speed=83;
  svc._state.index=1;svc._state.progress=.42;svc._state.legKey='0-0';
  const runtimeSave=game.scheduleV2Runtime.toSave();
  const scheduleSave=game.scheduleV2.toSave(),rotationSave=game.rotationV2.toSave();

  const game2=makeGame();game2.scheduleV2.loadFromSave(scheduleSave);game2.rotationV2.loadFromSave(rotationSave);game2.scheduleV2Runtime.loadFromSave(runtimeSave);
  game2.scheduleV2Runtime.sync(16*60+20,'2026-08-16');
  assert.equal(game2.scheduleCreator.services.length,1);
  const restored=game2.scheduleCreator.services[0];
  assert.equal(restored.state,'moving');
  assert.deepEqual(restored.position,{lat:48.1,lon:2.1});
  assert.equal(restored.speed,83);
  assert.equal(restored._state.index,1);
  assert.equal(restored._state.progress,.42);
  assert.equal(game2.rotationV2.vehicles[0].available,false);
});

test('engine emits a fractional-minute V2 tick at the exact second',()=>{
  const engine=new SimulationEngine();
  engine._lastFrameTime=performance.now();
  engine.getParisTime=()=>({hours:16,minutes:19,seconds:37,date:new Date('2026-08-16T12:00:00Z'),dayOfWeek:0});
  engine.getParisDate=()=> '2026-08-16';
  let secondTick=null;engine.onSecondTick=(t,date)=>{secondTick={t,date};};
  engine.update();
  assert.equal(secondTick.date,'2026-08-16');
  assert.ok(Math.abs(secondTick.t-(16*60+19+37/60))<1e-9);
});

test('late reload restores a saved V2 train even beyond the normal compile window',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const rot=game.rotationV2.addRotation({name:'Very late reload'});const vehicle=addVehicle(game);const occ=addFormation(game,rot,rec,vehicle);
  const id=`v2:${rot.id}:${occ.id}:2026-08-16`;
  globalThis.window={game};
  // v1.1.54: only a freshly captured runtime snapshot may justify restoring a
  // legitimately delayed train after its published end time.
  game.scheduleV2Runtime.loadFromSave({schemaVersion:3,capturedAtUnixSec:Math.floor(Date.now()/1000),services:[{
    id,rotationId:rot.id,occurrenceId:occ.id,baseDate:'2026-08-16',state:'moving',currentStopIndex:0,
    position:{lat:48.15,lon:2.15},speed:42,delay:5400,stateIndex:1,stateProgress:.75,legKey:'0-0',
    vehicleIds:[vehicle.id],formationMembers:[{vehicleId:vehicle.id,role:FormationRole.LEAD}],
    train:{speed:42,delay:5400,state:'moving',delayReason:'retard massif'},
  }]});
  game.scheduleV2Runtime.sync(18*60,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(game.scheduleCreator.services[0].id,id);
  assert.equal(game.scheduleCreator.services[0].state,'moving');
  assert.deepEqual(game.scheduleCreator.services[0].position,{lat:48.15,lon:2.15});
  assert.equal(vehicle.available,false);
  delete globalThis.window;
});

test('late load without snapshot reports a missed runtime window instead of failing silently',()=>{
  const game=makeGame();const rec=addSchedule(game,{departureSec:16*3600+19*60,arrivalSec:16*3600+30*60});
  const rot=game.rotationV2.addRotation({name:'Late no snapshot'});addFormation(game,rot,rec,addVehicle(game));
  game.scheduleV2Runtime.sync(18*60,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_RUNTIME_WINDOW_MISSED'));
});
