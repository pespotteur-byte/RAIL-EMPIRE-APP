import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole, ROTATION_V2_SCHEMA } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { StaffManager } from '../staff.js';
import fs from 'node:fs';

function fixture({rotationsRequired=false, personnelRequired=false}={}){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1,rotationsRequired,personnelRequired},rameManager:{getAll(){return[];},getById(){return null;}},_currentDate:'2026-09-02'};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;
}
function schedule(game,departureSec=3600,number='17801'){
  const rec=game.scheduleV2.createDraft({number,name:'A B',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion,arr=departureSec+600;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:arr,departureSec:arr+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true}),
  ];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:160,electrified:false},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:160,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:160,electrified:false}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  return {rec,v};
}
function loco(game){return game.rotationV2.addVehicle({number:'L1',name:'L1',category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:4000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});}

test('HOTFIX64 simplified mode compiles a direct Rame/material assignment without a rotation',()=>{
  const game=fixture(),{rec,v}=schedule(game),l=loco(game);
  const a=game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[new FormationMember({vehicleId:l.id,role:FormationRole.LEAD,order:0})]});
  assert.ok(a);assert.equal(game.rotationV2.rotations.length,0);
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(55,'2026-09-02');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.match(game.scheduleCreator.services[0].id,/^v2:direct:/);
  assert.equal(game.scheduleCreator.services[0]._v2DirectAssignmentId,a.id);
  delete globalThis.window;
});

test('HOTFIX64 advanced Roulements mode ignores direct assignment until a real rotation exists',()=>{
  const game=fixture({rotationsRequired:true}),{rec,v}=schedule(game),l=loco(game);
  game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[new FormationMember({vehicleId:l.id,role:FormationRole.LEAD,order:0})]});
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(55,'2026-09-02');
  assert.equal(game.scheduleCreator.services.length,0);
  const r=game.rotationV2.addRotation({name:'R01'});game.rotationV2.setAssignedFormation(r.id,{members:[new FormationMember({vehicleId:l.id,role:FormationRole.LEAD,order:0})]});game.rotationV2.addOccurrence(r.id,{scheduleId:rec.id,versionId:v.id});
  game.scheduleV2Runtime.forceSync(55,'2026-09-02');
  assert.equal(game.scheduleCreator.services.length,1);
  assert.equal(game.scheduleCreator.services[0]._v2RotationId,r.id);
  delete globalThis.window;
});

test('HOTFIX64 direct assignments persist in schema 6',()=>{
  const game=fixture(),{rec,v}=schedule(game),l=loco(game);
  const a=game.rotationV2.setDirectAssignment(rec.id,v.id,{members:[new FormationMember({vehicleId:l.id,role:FormationRole.LEAD,order:0})]});
  const save=game.rotationV2.toSave();assert.equal(ROTATION_V2_SCHEMA,6);assert.equal(save.directAssignments.length,1);assert.equal(save.directAssignments[0].id,a.id);
  const restored=new RotationV2Manager(game.scheduleV2);assert.equal(restored.loadFromSave(save),true);assert.equal(restored.directAssignments.length,1);assert.equal(restored.directAssignments[0].scheduleId,rec.id);
});


test('HOTFIX64 direct Rame assignment materializes the full physical formation automatically',()=>{
  const game=fixture(),{rec,v}=schedule(game);
  const rame={id:'rame-simple-1',name:'TER simple',serialNumber:'TER-001',elements:['loco','coach'],elementDetails:[
    {elementId:'el-loco',instanceName:'BB 26001',name:'BB 26000',category:'locomotive',traction:'1.5kv',maxSpeed:200,power:5600,mass:90,length:17.4},
    {elementId:'el-coach',instanceName:'B11u 01',name:'Corail B11u',category:'voiture',maxSpeed:200,power:0,mass:42,length:26.4,passengerCapacity:88},
  ],currentLocation:{stationId:'A',lat:48,lon:2}};
  const a=game.rotationV2.setDirectRameAssignment(rec.id,v.id,rame);
  assert.equal(a.rameId,rame.id);assert.equal(a.formation.members.length,2);
  assert.equal(a.formation.members[0].role,FormationRole.LEAD);assert.equal(a.formation.members[1].role,FormationRole.COACH);
  assert.ok(game.rotationV2.getRameElementVehicle(rame.id,0));assert.ok(game.rotationV2.getRameElementVehicle(rame.id,1));
  assert.ok(game.rotationV2.getVehicle(`rame-proxy:${rame.id}`),'Rame proxy remains available for UI/runtime compatibility');
});

test('HOTFIX64 personnel strictness is opt-in',()=>{
  const sm=new StaffManager();
  assert.equal(sm.hasAssignedConductor('svc'),true,'legacy/non-strict helper remains beginner-friendly');
  assert.equal(sm.hasAssignedConductor('svc',true),false,'advanced mode requires a real assigned driver');
});

test('HOTFIX64 settings and UI explicitly expose both optional advanced systems',()=>{
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const editor=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const sc=fs.readFileSync(new URL('../schedule-creator.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  for(const token of ['settings-rotations-required','settings-personnel-required','Systèmes avancés — facultatifs'])assert.ok(index.includes(token),token);
  for(const token of ['rotationsRequired: false','personnelRequired: false'])assert.ok(main.includes(token),token);
  for(const token of ['PRÊT · MODE SIMPLE','RAME À AFFECTER','Mode simple — affecter une rame','Les <b>Roulements sont facultatifs</b>'])assert.ok(editor.includes(token),token);
  assert.ok(sc.includes("personnelRequired === true"));
  assert.match(sc,/personnelRequired === true && .*isServiceBlocked/);
  assert.ok(sc.includes("personnelRequired !== true"),'regulation staffing is neutral in simple mode');
  assert.ok(ui.includes("personnelRequired===true?this.game.staffManager:null"));
});
