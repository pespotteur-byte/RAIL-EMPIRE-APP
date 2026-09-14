import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';

function makeGame({rotationsRequired=false}={}){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1,rotationsRequired}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;
}
function makeSchedule(game,departureSec=3600,number='17801'){
  const rec=game.scheduleV2.createDraft({number,name:'Dijon Lyon',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion,arr=departureSec+600;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:arr,departureSec:arr+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true}),
  ];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:160,electrified:false},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:160,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:160,electrified:false}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  return {rec,v};
}
function addLoco(game,number='L1'){
  return game.rotationV2.addVehicle({number,name:number,category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:4000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});
}
function addRealLine(game,rec,v,loco,name='R01'){
  const rot=game.rotationV2.addRotation({name});
  game.rotationV2.setAssignedFormation(rot.id,{members:[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})]});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});
  return {rot,occ};
}

test('HOTFIX64 simplified direct assignment creates a train without a rotation',()=>{
  const game=makeGame(),{rec,v}=makeSchedule(game),loco=addLoco(game);
  const legacy=game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]});
  assert.ok(legacy);assert.equal(game.rotationV2.rotations.length,0);
  game.scheduleV2Runtime.sync(55,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.match(game.scheduleCreator.services[0].id,/^v2:direct:/);
});

test('HOTFIX32 a genuine line of rotation creates the visible train and departs at timetable time',()=>{
  const game=makeGame(),{rec,v}=makeSchedule(game),loco=addLoco(game),{rot}=addRealLine(game,rec,v,loco);
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(55,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];assert.match(svc.id,new RegExp(`^v2:${rot.id}:`));assert.equal(svc.state,'waiting');
  svc.scheduleTick(60,'2026-08-17',null);assert.equal(svc.state,'moving');
  delete globalThis.window;
});

test('HOTFIX32 legacy schema-4 direct save migrates into a one-service rotation line',()=>{
  const game=makeGame(),{rec,v}=makeSchedule(game),loco=addLoco(game);
  const legacy=game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]});
  const data={schemaVersion:4,vehicles:game.rotationV2.vehicles.map(x=>x.toJSON()),coupons:[],rotations:[],directAssignments:[legacy.toJSON()],stationCodes:{}};
  const restored=new RotationV2Manager(game.scheduleV2);assert.equal(restored.loadFromSave(data),true);
  assert.equal(restored.directAssignments.length,0);assert.equal(restored.rotations.length,1);
  assert.match(restored.rotations[0].name,/Migré/);assert.equal(restored.rotations[0].occurrences[0].scheduleId,rec.id);
  assert.equal(restored.rotations[0].assignedFormation.members[0].vehicleId,loco.id);
});

test('HOTFIX64 current schema persists simplified direct assignments',()=>{
  const game=makeGame(),{rec,v}=makeSchedule(game),loco=addLoco(game);
  game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]});
  const save=game.rotationV2.toSave();assert.equal(save.schemaVersion,6);assert.equal(save.directAssignments.length,1);assert.equal(save.directAssignments[0].scheduleId,rec.id);
});

test('HOTFIX64 readiness supports simplified Rame assignment and real rotations',()=>{
  const game=makeGame(),{rec,v}=makeSchedule(game),loco=addLoco(game);const ed=Object.create(ScheduleV2Editor.prototype);ed.game=game;
  assert.equal(ed._operationalReadiness(rec,v).code,'NEEDS_RAME');
  game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]});
  assert.equal(ed._operationalReadiness(rec,v).code,'READY_SIMPLE');
  addRealLine(game,rec,v,loco);
  assert.equal(ed._operationalReadiness(rec,v).code,'READY');
});

test('HOTFIX32 overlapping genuine rotation lines still detect double-booked physical material',()=>{
  const game=makeGame(),s1=makeSchedule(game,3600,'17801'),s2=makeSchedule(game,3700,'17803'),loco=addLoco(game);
  addRealLine(game,s1.rec,s1.v,loco,'R01');addRealLine(game,s2.rec,s2.v,loco,'R02');
  assert.ok(game.rotationV2.validateMaterialConflicts().some(c=>c.code==='VEHICLE_DOUBLE_BOOKED'&&c.vehicleId===loco.id));
});
