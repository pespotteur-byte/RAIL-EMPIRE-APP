import { ScheduleCreator } from './js/schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from './js/schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from './js/rotation-v2-model.js';
import { ScheduleV2Runtime } from './js/schedule-v2-runtime.js';
import { RameManager } from './js/rame.js';
import { VoiePointManager } from './js/voie-points.js';
import { PlatformManager } from './js/line.js';

const scheduleV2=new ScheduleV2Manager(), rotationV2=new RotationV2Manager(scheduleV2), rameManager=new RameManager();
const world={stations:[
{id:'PGE',name:"Paris Gare de l'Est",lat:48.8763,lon:2.3590,platforms:30},
{id:'CH',name:'Chelles - Gournay',lat:48.874,lon:2.582,platforms:4},
{id:'VT',name:'Vaires-Torcy',lat:48.875,lon:2.639,platforms:4}],getStationById(id){return this.stations.find(s=>s.id===id)||null;},tracks:[]};
const scheduleCreator=new ScheduleCreator();
const voiePointManager=new VoiePointManager();
const platformManager=new PlatformManager();
const game={scheduleV2,rotationV2,rameManager,world,scheduleCreator,voiePointManager,platformManager,realismSettings:{physics:1},seasonal:null,unions:{isServiceBlocked:()=>false}};
globalThis.window={game};
game.scheduleV2Runtime=new ScheduleV2Runtime(game);
// Exact platform points. Runtime schedule label deliberately says "Voie 20".
voiePointManager.addVoiePoint({id:'vp20',stationId:'PGE',voie:'20',lat:48.87631,lon:2.35901});
voiePointManager.addVoiePoint({id:'vp21',stationId:'PGE',voie:'21',lat:48.87632,lon:2.35905});
const rec=scheduleV2.createDraft({number:'117171',name:'MICI 117171',category:TrainCategory.PASSENGER,maxSpeed:140});
const v=rec.currentVersion;
const dep=23*3600+53*60;
v.locations=[
 new ScheduledLocation({id:'a',order:0,stationId:'PGE',name:"Paris Gare de l'Est",track:new TrackBinding({wayId:'w20',displayName:'Voie 20',trackRef:'20',lat:48.87631,lon:2.35901,snapLat:48.87631,snapLon:2.35901}),departureSec:dep,dwellSec:0,stopCode:StopCode.C,departureOverride:true}),
 new ScheduledLocation({id:'b',order:1,stationId:'CH',name:'Chelles - Gournay',track:new TrackBinding({wayId:'w1',displayName:'Voie V1B1',lat:48.874,lon:2.582,snapLat:48.874,snapLon:2.582}),arrivalSec:24*3600+5*60,departureSec:24*3600+6*60,dwellSec:60,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true}),
 new ScheduledLocation({id:'c',order:2,stationId:'VT',name:'Vaires-Torcy',track:new TrackBinding({wayId:'w1',displayName:'Voie 1',lat:48.875,lon:2.639,snapLat:48.875,snapLon:2.639}),arrivalSec:24*3600+9*60,dwellSec:0,stopCode:StopCode.C,arrivalOverride:true})
];
const p0={lat:48.87631,lon:2.35901,wayId:'w20',maxSpeed:60,electrified:true};
const p1={lat:48.875,lon:2.40,wayId:'w20',maxSpeed:100,electrified:true};
const p2={lat:48.874,lon:2.582,wayId:'w1',maxSpeed:120,electrified:true};
const p3={lat:48.875,lon:2.639,wayId:'w1',maxSpeed:120,electrified:true};
v.outboundPath.legs=[
{id:'l1',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:[p0,p1,p2],segments:[],distanceKm:16},
{id:'l2',fromLocationId:'b',toLocationId:'c',constraintIds:[],routePoints:[p2,p3],segments:[],distanceKm:4}
];v.outboundPath.routePoints=[p0,p1,p2,p3];v.outboundPath.segments=[];v.state=ScheduleState.VALID;
const r=rameManager.add({name:'Z 50001',serialNumber:'50001',elements:['m'],elementDetails:[{name:'Z50000',category:'automotrice',traction:'electric',electricSystems:[{voltage:25000,frequency:50}],maxSpeed:140,mass:200,tonnage:200,power:3200,length:129}],currentLocation:{stationId:'PGE',lat:p0.lat,lon:p0.lon}});
const proxy=rotationV2.upsertRameProxy(r); rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:proxy.id,role:FormationRole.LEAD,order:0}]},{rameId:r.id});
for (const m of [23*60+48,23*60+52,23*60+53,23*60+54,23*60+55]) {
  game.scheduleV2Runtime.sync(m,'2026-08-30');
  const svc=scheduleCreator.services.find(s=>s._v2OccurrenceId);
  if(svc){svc.scheduleTick(m,'2026-08-30',null);}
  console.log('TIME',m,'svc',svc&&{state:svc.state,trainState:svc.train.state,blocked:svc.train.blockedBy,reason:svc.train.delayReason,pos:svc.position,speed:svc.speed,platform:svc.train.platform,assignment:svc._platformAssignment,stopPlatform:svc.stops[0]?.platform,stopVp:svc.stops[0]?.voiePointId},'vp20',voiePointManager.getVoiePointById('vp20')?.occupiedBy,'vp21',voiePointManager.getVoiePointById('vp21')?.occupiedBy);
}
