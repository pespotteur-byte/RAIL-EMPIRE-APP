import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function gameFixture(){const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;}
function schedule(game){const rec=game.scheduleV2.createDraft({number:'T1',name:'T',category:TrainCategory.FREIGHT,maxSpeed:120}),v=rec.currentVersion;v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'1',displayName:'1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:3600,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'2',displayName:'2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:4200,departureSec:4320,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];v.outboundPath.legs=[{id:'l',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:[{lat:48,lon:2,wayId:'1',maxSpeed:120,electrified:false},{lat:48.2,lon:2.2,wayId:'2',maxSpeed:120,electrified:false}],segments:[],distanceKm:30}];v.outboundPath.routePoints=v.outboundPath.legs[0].routePoints;v.state=ScheduleState.VALID;return rec;}

test('runtime load sanitizes non-finite snapshot fields instead of contaminating simulation',()=>{const g=gameFixture(),rt=g.scheduleV2Runtime;assert.equal(rt.loadFromSave({schemaVersion:3,capturedAtUnixSec:1,services:[{id:'x',state:'moving',currentStopIndex:Infinity,position:{lat:999,lon:Infinity},speed:Infinity,delay:NaN,stateIndex:Infinity,stateProgress:Infinity,onboardPax:Infinity,onboardFreight:-5,totalDistance:Infinity,brakeEffort:Infinity,vehicleIds:['v','v'],formationMembers:[{vehicleId:'v'}],train:{speed:Infinity,delay:Infinity,state:'waiting'}}],busyVehicles:[]}),true);const s=rt._pendingSnapshots.get('x');assert.equal(s.speed,0);assert.equal(s.delay,0);assert.equal(s.currentStopIndex,0);assert.equal(s.position,null);assert.equal(s.stateProgress,0);assert.equal(s.onboardPax,0);assert.equal(s.onboardFreight,0);assert.deepEqual(s.vehicleIds,['v']);});

test('restore repairs stale waiting train.state when service snapshot is moving',()=>{const g=gameFixture(),rec=schedule(g),rot=g.rotationV2.addRotation({name:'R'}),loco=g.rotationV2.addVehicle({number:'L',category:'locomotive',traction:'diesel',powerW:2e6,massKg:80000,maxSpeed:120,lengthM:20});g.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});g.scheduleV2Runtime.sync(55,'2026-08-25');const svc=g.scheduleCreator.services[0];assert.ok(svc);g.scheduleV2Runtime._pendingSnapshots.set(String(svc.id),{id:svc.id,state:'moving',currentStopIndex:1,isReturnLeg:false,position:{lat:48.05,lon:2.05},speed:20,delay:0,stateIndex:0,stateProgress:0,vehicleIds:[loco.id],formationMembers:[{vehicleId:loco.id,role:FormationRole.LEAD}],train:{speed:20,delay:0,state:'waiting',delayReason:''}});assert.equal(g.scheduleV2Runtime._restoreSnapshot(svc),true);assert.equal(svc.state,'moving');assert.equal(svc.train.state,'moving');});

test('V2 snapshot preserves the real station stop clock across F5',()=>{
  const g=gameFixture(), rt=g.scheduleV2Runtime;
  const svc=g.scheduleCreator.addService({
    id:'svc-stop-clock',name:'Clock',rameId:'',v2OccurrenceId:'occ-clock',v2RotationId:'rot-clock',v2BaseDate:'2026-08-25',serviceType:'fret',
    stops:[
      {stationId:'A',type:'arret',arrivalTime:60,departureTime:60,lat:48,lon:2,platform:'1'},
      {stationId:'B',type:'arret',arrivalTime:70,departureTime:80,lat:48.2,lon:2.2,platform:'1',v2OperationSec:600},
    ],
    routes:[[{lat:48,lon:2,maxSpeed:100},{lat:48.2,lon:2.2,maxSpeed:100}]],
  },null,g.world);
  svc.state='stopped_at_station'; svc.train.state='stopped_at_station'; svc.currentStopIndex=2;
  svc.position={lat:48.2,lon:2.2}; svc.train._stoppedSinceGameTime=71.25;
  svc._platformAssignment={stationId:'B',platform:'1',source:'PLATFORM_MANAGER'};
  const save=rt.toSave();
  const snap=save.services.find(s=>s.id==='svc-stop-clock');
  assert.equal(snap.stoppedSinceGameTime,71.25,'arrival clock must be persisted');

  svc.train._stoppedSinceGameTime=null;
  assert.equal(rt.loadFromSave(save),true);
  assert.equal(rt._restoreSnapshot(svc,75),true);
  assert.equal(svc.train._stoppedSinceGameTime,71.25,'exact arrival clock must survive restore');
});

test('old V2 stopped snapshots without an arrival clock restart dwell safely at reload time',()=>{
  const g=gameFixture(), rt=g.scheduleV2Runtime;
  const svc=g.scheduleCreator.addService({
    id:'svc-old-stop-clock',name:'Old Clock',rameId:'',v2OccurrenceId:'occ-old-clock',v2RotationId:'rot-old-clock',v2BaseDate:'2026-08-25',serviceType:'fret',
    stops:[
      {stationId:'A',type:'arret',arrivalTime:60,departureTime:60,lat:48,lon:2,platform:'1'},
      {stationId:'B',type:'arret',arrivalTime:70,departureTime:80,lat:48.2,lon:2.2,platform:'1',v2OperationSec:600},
    ],routes:[[{lat:48,lon:2,maxSpeed:100},{lat:48.2,lon:2.2,maxSpeed:100}]],
  },null,g.world);
  rt._pendingSnapshots.set(svc.id,{id:svc.id,state:'stopped_at_station',currentStopIndex:2,isReturnLeg:false,position:{lat:48.2,lon:2.2},speed:0,delay:0,stateIndex:0,stateProgress:0,platformAssignment:{stationId:'B',platform:'1',source:'PLATFORM_MANAGER'},vehicleIds:[],formationMembers:[],train:{speed:0,delay:0,state:'stopped_at_station'}});
  assert.equal(rt._restoreSnapshot(svc,75),true);
  assert.equal(svc.train._stoppedSinceGameTime,75,'old snapshot must not skip its operational dwell');
});
