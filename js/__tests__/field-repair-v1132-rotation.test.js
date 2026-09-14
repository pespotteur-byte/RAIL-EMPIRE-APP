import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole, RotationActionType } from '../rotation-v2-model.js';

function gameBase({electrified=false}={}){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  const rec=scheduleV2.createDraft({number:'R1',name:'Rotation',category:TrainCategory.FREIGHT,maxSpeed:120});const v=rec.currentVersion;
  v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({displayName:'1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:16*3600+20*60,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({displayName:'1',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:16*3600+30*60,departureSec:16*3600+40*60,dwellSec:600,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];
  const pts=[{lat:48,lon:2,wayId:'w',maxSpeed:120,electrified},{lat:48.2,lon:2.2,wayId:'w',maxSpeed:120,electrified}];v.outboundPath.routePoints=pts;v.outboundPath.legs=[{id:'l',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[{wayId:'w',electrified,voltage:electrified?[25000]:[],frequency:electrified?[50]:[],gauge:[1435],maxSpeed:120}],distanceKm:30}];v.outboundPath.segments=v.outboundPath.legs[0].segments;v.state=ScheduleState.VALID;
  return {game,rec,v};
}

function addDiesel(game,number='D',location={kind:'STATION',id:'A',lat:48,lon:2}){return game.rotationV2.addVehicle({number,category:'locomotive',traction:'diesel',maxSpeed:120,massKg:80000,powerW:2000000,lengthM:20,gauges:[1435],location});}
function addOcc(game,rec,rot,vehicle){return game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:vehicle.id,role:FormationRole.LEAD}]}});}

test('operation dependency may point to a later array action and still yields full critical path',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Ops'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const other=addDiesel(game,'D2');
  const a=game.rotationV2.addAction(rot.id,{type:RotationActionType.DETACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[loco.id],durationSec:300});
  const b=game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[other.id],durationSec:300});
  a.dependsOn=[b.id];
  assert.equal(game.rotationV2.operationWindowSec(rot.id,occ.id,'b'),600);
});

test('operation dependency cycles are rejected by rotation validation',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Cycle'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const a=game.rotationV2.addAction(rot.id,{type:RotationActionType.DETACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[loco.id]});
  const b=game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[loco.id]});a.dependsOn=[b.id];b.dependsOn=[a.id];
  assert.ok(game.rotationV2.validateRotation(rot.id).some(i=>i.code==='OPERATION_DEPENDENCY_INVALID'));
});

test('disabled rotations do not create material double-booking conflicts',()=>{
  const {game,rec}=gameBase();const loco=addDiesel(game);const on=game.rotationV2.addRotation({name:'On'}),off=game.rotationV2.addRotation({name:'Off',enabled:false});addOcc(game,rec,on,loco);addOcc(game,rec,off,loco);
  assert.equal(game.rotationV2.validateMaterialConflicts().length,0);
});

test('missing and duplicated formation vehicles are blocking validation errors',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Ghost'});const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:'ghost',role:FormationRole.LEAD},{vehicleId:'ghost',role:FormationRole.LEAD}]}});
  const codes=game.rotationV2.validateRotation(rot.id).map(i=>i.code);
  assert.ok(codes.includes('FORMATION_VEHICLE_MISSING'));assert.ok(codes.includes('FORMATION_VEHICLE_DUPLICATE'));
  assert.equal(occ.formation.members.length,2);
});

test('no active traction is a blocking ERROR in rotation validation',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Coach only'});const coach=game.rotationV2.addVehicle({number:'C1',category:'coach',traction:'none',massKg:40000,lengthM:25});game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:coach.id,role:FormationRole.COACH}]}});
  const issue=game.rotationV2.validateRotation(rot.id).find(i=>i.code==='NO_ACTIVE_TRACTION_ASSIGNED');assert.equal(issue?.level,'ERROR');
});

test('coordinate-only material localization blocks a locomotive that is far from origin',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Far'});const loco=addDiesel(game,'FAR',{kind:'UNKNOWN',id:'',lat:0,lon:0});addOcc(game,rec,rot,loco);
  game.scheduleV2Runtime.sync(16*60+19,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,0);assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='TITULAR_MISSING'));
});

test('mixed diesel+electric formation does not count unusable electric power on non-electrified track',()=>{
  const {game,rec}=gameBase({electrified:false});const rot=game.rotationV2.addRotation({name:'Mixed'});
  const diesel=addDiesel(game,'DIESEL');const electric=game.rotationV2.addVehicle({number:'ELEC',category:'locomotive',traction:'electric',maxSpeed:160,massKg:90000,powerW:6000000,lengthM:20,electricSystems:[{voltage:25000,frequency:50}],gauges:[1435],location:{kind:'STATION',id:'A',lat:48,lon:2}});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:diesel.id,role:FormationRole.LEAD},{vehicleId:electric.id,role:FormationRole.ACTIVE_MULTIPLE}]}});
  const plan=game.scheduleV2Runtime.planRotationForDate(rot,'2026-08-16')[0];assert.ok(plan?.ver);assert.equal(plan.ver.performanceProfile.powerW,diesel.powerW);assert.equal(occ.cancelled,false);
});

test('origin and terminal operation windows are included in runtime planning',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Window'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const coach=game.rotationV2.addVehicle({number:'C-ORIGIN',category:'coach',traction:'none',massKg:40000,lengthM:25,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'a',vehicleIds:[coach.id],durationSec:600});
  game.rotationV2.addAction(rot.id,{type:RotationActionType.DETACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[loco.id],durationSec:600});
  const plan=game.scheduleV2Runtime.planRotationForDate(rot,'2026-08-16')[0];
  assert.equal(plan.startSec-plan.prepStartSec,600);assert.ok(plan.endSec>=plan.ver.lastArrivalSec+600);
});

test('cancelled V2 service releases material at its actual position, not at planned terminus',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'CancelPos'});const loco=addDiesel(game);addOcc(game,rec,rot,loco);
  game.scheduleV2Runtime.sync(16*60+19,'2026-08-16');const svc=game.scheduleCreator.services[0];assert.ok(svc);svc.state='cancelled';svc.position={lat:48.07,lon:2.07};svc.currentStopIndex=0;
  game.scheduleV2Runtime._finalizeServices('2026-08-16',16*60+21);
  assert.equal(loco.available,true);assert.equal(loco.location.id,'A');assert.equal(loco.location.lat,48.07);assert.equal(loco.location.lon,2.07);
});

test('runtime alert deduplication expires instead of silencing a recurring fault forever',()=>{
  const {game}=gameBase();const rt=game.scheduleV2Runtime;rt._pushAlert('ERROR','X','one',{rotationId:'r',occurrenceId:'o',baseDate:'2026-08-16'});assert.equal(rt.alerts.length,1);
  const key='X|r|o|2026-08-16|';rt._alertTimes.set(key,Date.now()-61000);rt._pushAlert('ERROR','X','two',{rotationId:'r',occurrenceId:'o',baseDate:'2026-08-16'});assert.equal(rt.alerts.length,2);
});

test('late load cannot compress a real origin operation window',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Late prep'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const coach=game.rotationV2.addVehicle({number:'C-LATE',category:'coach',traction:'none',massKg:40000,lengthM:25,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'a',vehicleIds:[coach.id],durationSec:600});
  // Planned departure is 16:20 but the game is opened only at 16:19.
  game.scheduleV2Runtime.sync(16*60+19,'2026-08-16');
  const svc=game.scheduleCreator.services[0];assert.ok(svc);
  assert.equal(svc._v2PrepReadyMinute,16*60+29);
  assert.equal(svc.stops[0].v2OperationSec,600);
});

test('runtime stop carries operation duration so freight recovery cannot erase it',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Dwell floor'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  game.rotationV2.addAction(rot.id,{type:RotationActionType.DETACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[loco.id],durationSec:600});
  game.scheduleV2Runtime.sync(16*60+19,'2026-08-16');
  const svc=game.scheduleCreator.services[0];assert.ok(svc);assert.equal(svc.stops[1].v2OperationSec,600);
});

test('incoming material operation reservation survives runtime save and reload',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Busy save'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const coach=game.rotationV2.addVehicle({number:'C-BUSY',category:'coach',traction:'none',massKg:40000,lengthM:25,location:{kind:'STATION',id:'B',lat:48.2,lon:2.2}});
  game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'b',vehicleIds:[coach.id],durationSec:600});
  const plan=game.scheduleV2Runtime.planRotationForDate(rot,'2026-08-16')[0];plan._relNow=16*3600+20*60;
  game.scheduleV2Runtime._compile(plan);const svc=game.scheduleCreator.services[0];assert.ok(svc);
  game.scheduleV2Runtime._beginActionsAtStop(svc,plan,svc.stops[1],16*3600+30*60,false);
  const expected=Date.parse('2026-08-16T00:00:00Z')/1000+16*3600+40*60;
  assert.equal(coach._v2BusyUntilEpoch,expected);assert.equal(coach._v2OperationOwnerServiceId,svc.id);
  const saved=game.scheduleV2Runtime.toSave();delete coach._v2BusyUntilEpoch;delete coach._v2OperationOwnerServiceId;
  game.scheduleV2Runtime.loadFromSave(saved);assert.equal(coach._v2BusyUntilEpoch,expected);
  const snap=game.scheduleV2Runtime._pendingSnapshots.get(svc.id);assert.equal(snap.operationState.entries[0].reservedIds[0],coach.id);
});

test('ActiveService really waits for late origin preparation instead of departing on timetable',()=>{
  const {game,rec}=gameBase();const rot=game.rotationV2.addRotation({name:'Late prep tick'});const loco=addDiesel(game);const occ=addOcc(game,rec,rot,loco);
  const coach=game.rotationV2.addVehicle({number:'C-TICK',category:'coach',traction:'none',massKg:40000,lengthM:25,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  game.rotationV2.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'a',vehicleIds:[coach.id],durationSec:600});
  globalThis.window={game};
  game.scheduleV2Runtime.sync(16*60+19,'2026-08-16');const svc=game.scheduleCreator.services[0];assert.ok(svc);
  svc.scheduleTick(16*60+20,'2026-08-16',null);
  assert.equal(svc.state,'waiting');assert.equal(svc.train.state,'preparation');
  delete globalThis.window;
});


test('HOTFIX35 terminal operation may extend release beyond scheduled dwell',()=>{
  const {game,rec,v}=gameBase();
  const rot=game.rotationV2.addRotation({name:'Terminal ops'});
  const loco=addDiesel(game,'BB TERM');
  const coach=game.rotationV2.addVehicle({number:'C TERM',category:'coach',traction:'none',massKg:40000,lengthM:25,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH}]}});
  const terminal=v.locations.at(-1); terminal.dwellSec=0;
  game.rotationV2.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:terminal.id,type:RotationActionType.DETACH,vehicleIds:[coach.id],durationSec:300});
  const issues=game.rotationV2.validateRotation(rot.id);
  assert.ok(!issues.some(i=>i.code==='OPERATION_DWELL_TOO_SHORT'&&i.locationOccurrenceId===terminal.id),'terminal operation extends release instead of requiring scheduled dwell');
  game.rotationV2.recalculateRotation(rot.id);
  assert.ok(Number(occ.resolvedEndSec)>=Number(v.lastArrivalSec)+300,'terminal operation extends material release by its duration');
});
