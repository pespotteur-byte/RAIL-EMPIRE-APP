import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UI } from '../ui.js';
import { haversineDistance } from '../simulation.js';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function makeRuntimeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={
    stations:[{id:'A',name:'Dormans',lat:49.073,lon:3.64},{id:'B',name:'Château-Thierry',lat:49.046,lon:3.403}],
    getStationById(id){return this.stations.find(s=>s.id===id)||null;},
  };
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function add1721Service(game){
  const rec=game.scheduleV2.createDraft({number:'2',name:'Dormans - Château-Thierry',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;
  const dep=(17*60+21)*60, arr=(17*60+31)*60;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'Dormans',track:new TrackBinding({wayId:'34a',displayName:'Voie 2',lat:49.073,lon:3.64,snapLat:49.073,snapLon:3.64}),departureSec:dep,dwellSec:0,stopCode:StopCode.C,departureOverride:true}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'Château-Thierry',track:new TrackBinding({wayId:'34b',displayName:'Voie 2',lat:49.046,lon:3.403,snapLat:49.046,snapLon:3.403}),arrivalSec:arr,departureSec:arr,arrivalOverride:true,departureOverride:true,dwellSec:0,stopCode:StopCode.S}),
  ];
  const pts=[
    {lat:49.073,lon:3.64,wayId:'34a',maxSpeed:160,electrified:false},
    {lat:49.060,lon:3.52,wayId:'34a',maxSpeed:160,electrified:false},
    {lat:49.046,lon:3.403,wayId:'34b',maxSpeed:160,electrified:false},
  ];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:18}];
  v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  const rot=game.rotationV2.addRotation({name:'R Dormans'});
  const loco=game.rotationV2.addVehicle({number:'2',name:'Loco test',category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:4000000,lengthM:20});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]}});
  return {rec,v,rot,loco,occ,serviceId:`v2:${rot.id}:${occ.id}:2026-08-17`};
}

test('Livemap arrow uses real route distance across hidden VIA/passages',()=>{
  const ui=Object.create(UI.prototype);ui._lvpRouteDistanceCache=new WeakMap();
  const route0=[{lat:0,lon:0},{lat:0,lon:.01}];
  const route1=[{lat:0,lon:.01},{lat:0,lon:.04}];
  const d0=haversineDistance(0,0,0,.01),d1=haversineDistance(0,.01,0,.04);
  const stops=[{type:'arret',stationId:'A'},{type:'waypoint',stationId:''},{type:'arret',stationId:'B'}];
  const svc={state:'moving',currentStopIndex:2,isReturnLeg:false,routes:[route0,route1],_state:{cachedRoute:route1,index:0,progress:.5,segDists:new Float64Array([d1]),cumDist:new Float64Array([d1,0])}};
  const p=ui._livemapArrowProgress(svc,stops);
  assert.equal(p.fromDisplayIndex,0);assert.equal(p.toDisplayIndex,1);
  assert.ok(Math.abs(p.fraction-((d0+d1*.5)/(d0+d1)))<1e-6,`fraction=${p.fraction}`);
});

test('Livemap panel contains one floating arrow and updates it every lightweight frame',()=>{
  const src=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
  assert.match(src,/lvp-arrow lvp-arrow-floating/);
  assert.match(src,/this\._syncLivemapProgressArrow\(svc\);\n\s*if \(stateKey !== this\._lvpStateKey\)/);
  assert.match(src,/data-display-idx/);
  assert.match(css,/\.lvp-arrow-floating[^}]*transition:top 90ms linear/s);
});

test('reload does not create a finished 17:21-17:31 train at 18:14',()=>{
  const game=makeRuntimeGame();add1721Service(game);
  game.scheduleV2Runtime.sync(18*60+14,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_RUNTIME_WINDOW_MISSED'));
});

test('legacy 1.1.53 moving snapshot cannot resurrect a train after its published window',()=>{
  const game=makeRuntimeGame();const {serviceId,loco}=add1721Service(game);
  game.scheduleV2Runtime.loadFromSave({schemaVersion:2,services:[{id:serviceId,state:'moving',currentStopIndex:1,position:{lat:49.06,lon:3.52},speed:93,delay:60,stateIndex:0,stateProgress:.5,vehicleIds:[loco.id],formationMembers:[{vehicleId:loco.id,role:FormationRole.LEAD}],train:{speed:93,delay:60,state:'moving'}}]});
  game.scheduleV2Runtime.sync(18*60+14,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,0);
  assert.ok(game.scheduleV2Runtime.alerts.some(a=>a.code==='V2_STALE_RUNTIME_SNAPSHOT_IGNORED'));
});

test('fresh snapshot preserves a genuinely delayed moving train across an immediate F5',()=>{
  const game=makeRuntimeGame();const {serviceId,loco}=add1721Service(game);
  game.scheduleV2Runtime.loadFromSave({schemaVersion:3,capturedAtUnixSec:Math.floor(Date.now()/1000),services:[{id:serviceId,state:'moving',currentStopIndex:1,position:{lat:49.06,lon:3.52},speed:93,delay:60,stateIndex:0,stateProgress:.5,vehicleIds:[loco.id],formationMembers:[{vehicleId:loco.id,role:FormationRole.LEAD}],train:{speed:93,delay:60,state:'moving'}}]});
  game.scheduleV2Runtime.sync(18*60+14,'2026-08-17');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.state,'moving');assert.equal(svc.train.speed,93);assert.equal(svc.delay,60);
  assert.deepEqual(svc.position,{lat:49.06,lon:3.52});
});
