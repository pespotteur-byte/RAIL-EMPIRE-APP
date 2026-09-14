import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole, RotationActionType } from '../rotation-v2-model.js';

function L(id,name,stationId,arr,dep,dwell=0,lat=48,lon=2){return new ScheduledLocation({id,stationId,name,track:new TrackBinding({wayId:`w-${id}`,displayName:'1',lat,lon,snapLat:lat,snapLon:lon}),arrivalSec:arr,departureSec:dep,dwellSec:dwell,stopCode:StopCode.C,arrivalOverride:arr!=null,departureOverride:dep!=null});}
function setup(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'PA',name:'Paris',lat:48.85,lon:2.35},{id:'VA',name:'Valence',lat:44.93,lon:4.89},{id:'NI',name:'Nice',lat:43.7,lon:7.27}],getStationById(id){return this.stations.find(x=>x.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  const rec=scheduleV2.createDraft({number:'5773',name:'Paris Nice',category:TrainCategory.PASSENGER,maxSpeed:160}),v=rec.currentVersion;
  v.locations=[L('P','Paris','PA',null,8*3600,0,48.85,2.35),L('V','Valence','VA',9*3600,9*3600+10*60,600,44.93,4.89),L('N','Nice','NI',10*3600,null,0,43.7,7.27)];
  const p1=[{lat:48.85,lon:2.35,wayId:'w1'},{lat:44.93,lon:4.89,wayId:'w1'}],p2=[{lat:44.93,lon:4.89,wayId:'w2'},{lat:43.7,lon:7.27,wayId:'w2'}];
  v.outboundPath.routePoints=[...p1,p2[1]];v.outboundPath.legs=[{fromLocationId:'P',toLocationId:'V',routePoints:p1,segments:[{}],distanceKm:500},{fromLocationId:'V',toLocationId:'N',routePoints:p2,segments:[{}],distanceKm:300}];v.outboundPath.distanceKm=800;v.state=ScheduleState.VALID;
  return {game,rec,v};
}

test('HOTFIX33 exact material windows carry unambiguous schedule-location ids',()=>{
  const {game,rec}=setup(),rm=game.rotationV2,r=rm.addRotation({name:'ICN'}),old=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5000000}),coach=rm.addVehicle({number:'BRI',category:'voiture'}),neo=rm.addVehicle({number:'BB67436',category:'locomotive',powerW:5000000});
  const o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:old.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH}]}});
  rm.addAction(r.id,{type:RotationActionType.SPLIT,occurrenceId:o.id,locationOccurrenceId:'V',vehicleIds:[coach.id],durationSec:300});
  rm.addAction(r.id,{type:RotationActionType.CHANGE_LOCOMOTIVE,occurrenceId:o.id,locationOccurrenceId:'V',vehicleIds:[neo.id],durationSec:300});rm.recalculateRotation(r.id);
  const ivs=rm.materialIntervals(r.id,o.id,null,o.resolvedStartSec),by=id=>ivs.find(x=>x.vehicleId===id);
  assert.equal(by(coach.id).startLocationOccurrenceId,'P');assert.equal(by(coach.id).endLocationOccurrenceId,'V');
  assert.equal(by(neo.id).startLocationOccurrenceId,'V');assert.equal(by(neo.id).endLocationOccurrenceId,'N');
  assert.equal(rm.materialIntervalDistanceKm(r.id,o.id,by(coach.id)),500);
  assert.equal(rm.materialIntervalDistanceKm(r.id,o.id,by(old.id)),500);
  assert.equal(rm.materialIntervalDistanceKm(r.id,o.id,by(neo.id)),300);
});

test('HOTFIX33 permanent odometers count only kilometres each physical vehicle actually travelled',()=>{
  const {game,rec}=setup(),rm=game.rotationV2,r=rm.addRotation({name:'ICN'}),old=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5000000,odometerKm:1000,location:{kind:'STATION',id:'PA'}}),coach=rm.addVehicle({number:'BRI',category:'voiture',odometerKm:2000,location:{kind:'STATION',id:'PA'}}),neo=rm.addVehicle({number:'BB67436',category:'locomotive',powerW:5000000,odometerKm:3000,location:{kind:'STATION',id:'VA'}});
  const o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:old.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH}]}});
  rm.addAction(r.id,{type:RotationActionType.SPLIT,occurrenceId:o.id,locationOccurrenceId:'V',vehicleIds:[coach.id],durationSec:300});
  rm.addAction(r.id,{type:RotationActionType.CHANGE_LOCOMOTIVE,occurrenceId:o.id,locationOccurrenceId:'V',vehicleIds:[neo.id],durationSec:300});rm.recalculateRotation(r.id);
  const plan=game.scheduleV2Runtime.planRotationForDate(r,'2026-08-31')[0];assert.ok(plan?.ver);game.scheduleV2Runtime._compile(plan);const svc=game.scheduleCreator.services[0];assert.ok(svc);
  svc.completed=true;svc.state='completed';svc.currentStopIndex=svc.stops.length-1;svc.position={lat:43.7,lon:7.27};svc.totalDistance=800;
  game.scheduleV2Runtime._finalizeServices('2026-08-31',Math.ceil(plan.endSec/60)+1);
  assert.equal(Math.round(old.odometerKm),1500,'old locomotive: Paris→Valence only');
  assert.equal(Math.round(coach.odometerKm),2500,'split coupon: Paris→Valence only');
  assert.equal(Math.round(neo.odometerKm),3300,'new locomotive: Valence→Nice only');
});

test('HOTFIX33 keeps player-request rolling-duty architecture unchanged',()=>{
  const model=fs.readFileSync(new URL('../rotation-v2-model.js',import.meta.url),'utf8'),editor=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
  for(const token of ['scheduleCoveredByRotation','assignedFormation','addAssignedCoupon','materialIntervals','directAssignments: this.directAssignments.map'])assert.ok(model.includes(token),token);
  for(const token of ['Diagramme réel','Journée matériel','km ce jour','Former une UM','Séparer l’UM','CV Ajouter en véhicule'])assert.ok(editor.includes(token),token);
});


test('HOTFIX33 repeated-station route uses exact occurrence ids, not the first matching station',()=>{
  const scheduleV2=new ScheduleV2Manager(),rm=new RotationV2Manager(scheduleV2),rec=scheduleV2.createDraft({number:'LOOP',name:'Loop',category:TrainCategory.PASSENGER,maxSpeed:120}),v=rec.currentVersion;
  v.locations=[L('A1','A','A',null,8*3600,0,48,2),L('B','B','B',9*3600,9*3600+300,300,48.5,2.5),L('A2','A','A',10*3600,null,0,48,2)];
  v.outboundPath.legs=[{fromLocationId:'A1',toLocationId:'B',distanceKm:100},{fromLocationId:'B',toLocationId:'A2',distanceKm:120}];v.outboundPath.distanceKm=220;v.state=ScheduleState.VALID;
  const r=rm.addRotation({name:'Loop'}),l=rm.addVehicle({number:'L',category:'locomotive',powerW:5000000}),c=rm.addVehicle({number:'C',category:'voiture'}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD},{vehicleId:c.id,role:FormationRole.COACH}]}});
  rm.addAction(r.id,{type:RotationActionType.SPLIT,occurrenceId:o.id,locationOccurrenceId:'B',vehicleIds:[c.id],durationSec:300});rm.recalculateRotation(r.id);
  const iv=rm.materialIntervals(r.id,o.id,null,o.resolvedStartSec).find(x=>x.vehicleId===c.id);assert.equal(iv.startLocationOccurrenceId,'A1');assert.equal(iv.endLocationOccurrenceId,'B');assert.equal(rm.materialIntervalDistanceKm(r.id,o.id,iv),100);
});

test('HOTFIX33 finalization is idempotent and cannot double vehicle odometers',()=>{
  const {game,rec}=setup(),rm=game.rotationV2,r=rm.addRotation({name:'One'}),l=rm.addVehicle({number:'BB',category:'locomotive',powerW:5000000,odometerKm:10,location:{kind:'STATION',id:'PA'}}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD}]}});rm.recalculateRotation(r.id);
  const plan=game.scheduleV2Runtime.planRotationForDate(r,'2026-08-31')[0];game.scheduleV2Runtime._compile(plan);const svc=game.scheduleCreator.services[0];svc.completed=true;svc.state='completed';svc.currentStopIndex=svc.stops.length-1;svc.position={lat:43.7,lon:7.27};svc.totalDistance=800;
  const minute=Math.ceil(plan.endSec/60)+1;game.scheduleV2Runtime._finalizeServices('2026-08-31',minute);const once=l.odometerKm;game.scheduleV2Runtime._finalizeServices('2026-08-31',minute+1);assert.equal(once,810);assert.equal(l.odometerKm,810);
});
