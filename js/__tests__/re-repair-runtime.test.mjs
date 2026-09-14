import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator, cantonManager } from '../schedule-creator.js';
import {
  ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding,
  TrainCategory, StopCode, SchedulePath,
} from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { recalculateScheduleTiming } from '../schedule-v2-timing.js';

function makeGame() {
  for(const k of ['cantons','routeCantons','trainCantons','resourceCantons']) cantonManager[k].clear();
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


import { resolveRailSpeedLimits } from '../rail-speed.js';
import { UI } from '../ui.js';
const day='2026-08-16',before=23*60+49;
const fixture=()=>{const game=makeGame(),rec=addValidSchedule(game),rot=game.rotationV2.addRotation({name:'Repair'}),formation=addDieselFormation(game,rot,rec);game.scheduleV2Runtime.sync(before,day);assert.equal(game.scheduleCreator.services.length,1);return{game,rec,rot,...formation,svc:game.scheduleCreator.services[0]};};

test('RE repair: editing a prepared timetable replaces its runtime, but keeps the service identity',()=>{
 const{game,rec,svc}=fixture();const oldDep=svc.stops[0].departureTime;
 rec.currentVersion.locations[0].departureSec+=30;game.scheduleV2Runtime.forceSync(before,day);
 const next=game.scheduleCreator.services[0];assert.ok(next);assert.notEqual(next,svc);assert.equal(next.id,svc.id);assert.equal(next.stops[0].departureTime,oldDep+0.5);
});
test('RE repair: unchanged prepared service is not rebuilt each sync',()=>{
 const{game,svc}=fixture();game.scheduleV2Runtime.forceSync(before,day);assert.equal(game.scheduleCreator.services[0],svc);
});
test('RE repair: DRAFT timetable retires its prepared service and frees its vehicle',()=>{
 const{game,rec,loco}=fixture();rec.currentVersion.state=ScheduleState.DRAFT;game.scheduleV2Runtime.forceSync(before,day);
 assert.equal(game.scheduleCreator.services.length,0);assert.equal(loco.available,true);
});
test('RE repair: disabling a rotation retires its prepared train',()=>{
 const{game,rot}=fixture();rot.enabled=false;game.scheduleV2Runtime.forceSync(before,day);assert.equal(game.scheduleCreator.services.length,0);
});
test('RE repair: deleting timetable retires prepared train',()=>{
 const{game,rec}=fixture();game.scheduleV2.removeSchedule(rec.id);game.scheduleV2Runtime.forceSync(before,day);assert.equal(game.scheduleCreator.services.length,0);
});
test('RE repair: source edits do not destroy a train which already departed',()=>{
 const{game,rec,svc}=fixture();svc.state='moving';svc.currentStopIndex=1;rec.currentVersion.state=ScheduleState.DRAFT;
 game.scheduleV2Runtime.forceSync(before,day);assert.equal(game.scheduleCreator.services[0],svc);
});
test('RE repair: a catch-up conflict rolls back the physical position and reports the fresh cause',()=>{
 const{game,svc,rot}=fixture(),runtime=game.scheduleV2Runtime;
 const plan=runtime._plansForRotationDate(rot,day)[0];const old={...svc.position};
 svc._syncCantonFootprint=()=>false;svc._brakeEffort=0.8;
 const result=runtime._catchUpFreshCompile(svc,plan,(plan.startSec+plan.endSec)/2);
 assert.equal(result.mode,'blocked');assert.deepEqual(svc.position,old);assert.equal(svc.speed,0);assert.match(svc.train.delayReason,/ressource occupée/);
});
test('RE repair: existing stopped-by-signal trains are never timetable-caught-up',()=>{
 const{game,svc}=fixture();svc.train.movementAuthority={status:'STOP'};let called=0;
 game.scheduleV2Runtime._catchUpFreshCompile=()=>{called++;return null;};
 game.scheduleV2Runtime.catchUpExistingToClock(23*60+55,day,{gapSec:60});assert.equal(called,0);
});
test('RE repair: snapshot preserves breakdown, passenger distance and reserved contract cargo',()=>{
 const{game,svc}=fixture();svc.train.breakdown={type:'moteur',severity:'severe'};svc._onboardPassengerKm=1234;svc._contractFreight=42;svc._contractDelivered=8;
 const saved=game.scheduleV2Runtime.toSave().services[0];assert.deepEqual(saved.train.breakdown,svc.train.breakdown);assert.equal(saved.onboardPassengerKm,1234);assert.equal(saved.contractFreight,42);assert.equal(saved.contractDelivered,8);
});
test('RE repair: distant V30 does not propagate across an unknown 100 km line',()=>{
 const points=Array.from({length:101},(_,i)=>({lat:0,lon:i/111.195,wayId:'main',maxSpeed:30,maxSpeedSource:'FALLBACK_30'}));
 points[0]={...points[0],maxSpeed:160,maxSpeedSource:'OSM'};points[100]={...points[100],maxSpeed:30,maxSpeedSource:'OSM'};
 const speeds=resolveRailSpeedLimits(points,160);assert.equal(speeds[50],160);assert.equal(speeds[90],160);assert.equal(speeds[100],30);
});
test('RE repair: same-way opposite-direction proxy and unknown service track are consistent',()=>{
 assert.equal(resolveRailSpeedLimits([{maxSpeed:30,maxSpeedSource:'FALLBACK_30',travelDirection:'backward',maxSpeedForward:120}],160)[0],120);
 assert.equal(resolveRailSpeedLimits([{maxSpeed:30,maxSpeedSource:'FALLBACK_30',service:'siding'}],300)[0],30);
});
test('RE repair: missing LiveMap payload is not fabricated at 70 percent capacity',()=>{
 const ui={_displayRameForService:()=>({totalCapacity:100,totalFreightCapacity:0})};
 assert.equal(UI.prototype._livemapPayloadText.call(ui,{category:'voyageur'}),'0 passagers à bord');
 assert.equal(UI.prototype._livemapPayloadText.call(ui,{category:'voyageur',_onboardPax:27}),'27 passagers à bord');
});
test('RE repair: LiveMap freight payload includes separately reserved contract cargo',()=>{
 const ui={_displayRameForService:()=>({totalCapacity:0,totalFreightCapacity:100})};
 assert.equal(UI.prototype._livemapPayloadText.call(ui,{category:'fret',_onboardFreight:20,_contractFreight:30}),'50 tonnes de fret transportées');
});

test('RE repair: runtime speed cache follows a changed consist speed cap',()=>{
 const {svc}=fixture();const route=[{lat:48,lon:2,maxSpeed:160,maxSpeedSource:'OSM'},{lat:48.01,lon:2,maxSpeed:160,maxSpeedSource:'OSM'}];
 svc.rame={maxSpeed:160};assert.equal(svc._resolvedRouteSpeeds(route)[0],160);
 svc.rame.maxSpeed=80;assert.equal(svc._resolvedRouteSpeeds(route)[0],80);
 svc.rame.maxSpeed=160;assert.equal(svc._resolvedRouteSpeeds(route)[0],160);
});
test('RE repair: legacy lossy global segments recover restrictions from matching canonical legs',()=>{
 const points=[{lat:48,lon:2},{lat:48.01,lon:2}];
 const canonical={from:points[0],to:points[1],distanceKm:1,maxSpeed:80,electrified:false,gauge:[1000],axleLoad:10};
 const path=new SchedulePath({legs:[{id:'l',routePoints:points,segments:[canonical]}],routePoints:points,segments:[{distanceKm:1,maxSpeed:80}]});
 assert.equal(path.segments[0].electrified,false);assert.deepEqual(path.segments[0].gauge,[1000]);assert.equal(path.segments[0].axleLoad,10);
});

test('RE repair: legacy migration never discards a documented global restriction',()=>{
 const points=[{lat:48,lon:2},{lat:48.01,lon:2}];
 const path=new SchedulePath({legs:[{id:'l',routePoints:points}],routePoints:points,segments:[{from:points[0],to:points[1],distanceKm:1,gauge:[1000],electrified:false,axleLoad:10}]});
 assert.deepEqual(path.segments[0].gauge,[1000]);assert.equal(path.segments[0].electrified,false);assert.equal(path.segments[0].axleLoad,10);
});
