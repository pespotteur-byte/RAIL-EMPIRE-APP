import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { PlatformManager } from '../line.js';

function makeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[
    {id:'A',name:'Paris Est',lat:48.87631,lon:2.35901,platforms:2},
    {id:'B',name:'B',lat:48.9,lon:2.5,platforms:2},
  ],tracks:[],getStationById(id){return this.stations.find(s=>s.id===id)||null;},getStationsNear(){return[];}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1},platformManager:new PlatformManager(),works:{works:[]},incidents:{incidents:[]}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function makeRun(game, number='T17', track='20', departureSec=12*3600){
  const rec=game.scheduleV2.createDraft({number,name:'Test',category:TrainCategory.PASSENGER,maxSpeed:120});
  const v=rec.currentVersion, arrivalSec=departureSec+15*60;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'Paris Est',track:new TrackBinding({wayId:'10',trackRef:track,displayName:track,lat:48.87631,lon:2.35901,snapLat:48.87631,snapLon:2.35901}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',trackRef:'1',displayName:'1',lat:48.9,lon:2.5,snapLat:48.9,snapLon:2.5}),arrivalSec,departureSec:arrivalSec,dwellSec:0,stopCode:StopCode.S}),
  ];
  const pts=[{lat:48.87631,lon:2.35901,wayId:'10',maxSpeed:120},{lat:48.9,lon:2.5,wayId:'11',maxSpeed:120}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:10}];
  v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  const loco=game.rotationV2.addVehicle({number:`${number}-L`,name:`${number}-L`,category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48.87631,lon:2.35901}});
  const rot=game.rotationV2.addRotation({name:number});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});
  occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
  return {rec,rot,occ};
}

test('HOTFIX17: V2 exact track 20 is valid even when generic station capacity says 2 platforms',()=>{
  const game=makeGame();makeRun(game);
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(11*60+59,'2026-08-31');
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.train.blockedBy,false);
  assert.equal(svc._platformAssignment?.platform,'20');
  svc.scheduleTick(12*60,'2026-08-31',null);
  assert.equal(svc.state,'moving');
  assert.equal(svc.train.blockedBy,false);
  assert.equal(svc.train.delayReason,'');
  const start={...svc.position};
  for(let i=0;i<40;i++)svc.moveUpdate(0.5,12*60+i/120,[svc]);
  assert.ok(svc.speed>1,'train must physically accelerate after departure');
  assert.ok(svc.totalDistance>0.01,'train must physically travel after departure');
  assert.notDeepEqual(svc.position,start,'GPS position must advance');
  assert.equal(svc.train.blockedBy,false);
  delete globalThis.window;
});

test('HOTFIX17: exact V2 track still blocks a second live train on the same track',()=>{
  const pm=new PlatformManager();
  assert.equal(pm.assignPlatform('A','one',2,'20',{exactPreferred:true}),'20');
  assert.equal(pm.assignPlatform('A','two',2,'20',{exactPreferred:true}),null);
  pm.releasePlatform('A','one');
  assert.equal(pm.assignPlatform('A','two',2,'20',{exactPreferred:true}),'20');
});

test('HOTFIX17: legacy impossible numeric platform remains fail-closed',()=>{
  const pm=new PlatformManager();
  assert.equal(pm.assignPlatform('A','legacy',2,'20'),1);
});
