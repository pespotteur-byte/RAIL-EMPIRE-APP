import assert from 'node:assert/strict';
import { ScheduleCreator, cantonManager } from '../schedule-creator.js';
import {
  ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding,
  TrainCategory, StopCode, SchedulePath,
} from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { recalculateScheduleTiming } from '../schedule-v2-timing.js';

export function makeGame() {
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

export function addValidSchedule(game,{number='17802', optional=false, long=false}={}) {
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
export function addDieselFormation(game,rot,rec) {
  const loco=game.rotationV2.addVehicle({number:'BB TEST',name:'Diesel',category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id});
  occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
  return {loco,occ};
}


