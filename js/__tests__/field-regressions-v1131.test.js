import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';

function way(id, coords, nodeIds, extra={}) {
  return {
    id, geometry:coords.map(([lat,lon])=>({lat,lon})), nodeIds,
    maxSpeed:120,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[25000],frequency:[50],gauge:[1435],
    loadingGauge:'',axleLoad:null,metreLoad:null,tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',
    preferredDirection:'',bidirectional:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{},...extra,
  };
}

test('v1.1.31 successful multi-anchor route exposes exact resolved VIA/station snaps', async()=>{
  const orm=new ORMClient();
  const w=way(700,[[48,2],[48,2.1],[48,2.2]],[1,2,3]);
  orm._ways.set(w.id,w);
  orm.areaCache.set('test-local',[w]);
  orm._loadedBboxes=[{key:'test-local',south:47.9,west:1.9,north:48.1,east:2.3}];
  orm.fetchRailwayTiles=async()=>[];orm._findCursorLegBroadArea=async()=>null;
  const route=await orm.findRouteViaCursorAnchors([
    {lat:48,lon:2.02},{lat:48,lon:2.11},{lat:48,lon:2.18},
  ],{allowFallback:false});
  assert.ok(route?.length>=3);
  assert.equal(route._resolvedAnchors.length,3);
  assert.ok(Math.abs(route._resolvedAnchors[1].lon-2.11)<1e-6);
  assert.equal(route._resolvedAnchors[2].wayId,'700');
});

test('v1.1.31 preferred-direction candidate wins over slightly closer wrong-direction parallel track', async()=>{
  const orm=new ORMClient();
  // Two independent parallel tracks, both fully routable from cursor candidates.
  // Wrong track is slightly closer to both cursor clicks; normal-direction track
  // must still be selected because preferred_direction says it is the proper way.
  const good=way(801,[[48,2.00010],[48.01,2.00010],[48.02,2.00010]],[11,12,13],{preferredDirection:'forward'});
  const wrong=way(802,[[48,2.00000],[48.01,2.00000],[48.02,2.00000]],[21,22,23],{preferredDirection:'backward'});
  orm._ways.set(good.id,good);orm._ways.set(wrong.id,wrong);
  orm.areaCache.set('parallel-local',[good,wrong]);
  orm._loadedBboxes=[{key:'parallel-local',south:47.95,west:1.95,north:48.05,east:2.05}];
  orm.fetchRailwayTiles=async()=>[good,wrong];
  const route=await orm.findRouteViaCursorAnchors([{lat:48.001,lon:2.00002},{lat:48.019,lon:2.00002}],{allowFallback:false});
  assert.ok(route?.length>=2);
  assert.ok(route.slice(1).every(p=>String(p.wayId)==='801'),`ways=${route.slice(1).map(p=>p.wayId).join(',')}`);
  assert.ok(route.slice(1).every(p=>!p._againstPreferredDirection));
});

test('v1.1.31 bidirectional regular and service tracks do not create preferred-direction false alarms',()=>{
  const orm=new ORMClient();
  const regular=orm._edgeMetadata(way(1,[[0,0],[0,1]],[1,2],{preferredDirection:'forward',bidirectional:'regular'}),false);
  const siding=orm._edgeMetadata(way(2,[[0,0],[0,1]],[3,4],{preferredDirection:'forward',service:'siding'}),false);
  assert.equal(regular.againstPreferredDirection,false);
  assert.equal(siding.againstPreferredDirection,false);
});

test('v1.1.31 rotation save/load never persists a ghost unavailable runtime lock and serializers are non-recursive',()=>{
  const schedules=new ScheduleV2Manager();
  const mgr=new RotationV2Manager(schedules);
  const v=mgr.addVehicle({number:'L1',category:'locomotive',traction:'diesel',powerW:1000000,massKg:80000});
  const coach=mgr.addVehicle({number:'C1',category:'voiture',traction:'none',massKg:40000});
  const coupon=mgr.addCoupon({name:'Coupon A',vehicleIds:[coach.id]});
  const rot=mgr.addRotation({name:'R1'});
  const occ=mgr.addOccurrence(rot.id,{scheduleId:'sched-x',versionId:'ver-x',formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH,sourceCouponId:coupon.id}]}});
  mgr.addAction(rot.id,{type:'DETACH',occurrenceId:occ.id,locationOccurrenceId:'stop-x',vehicleIds:[coach.id],couponIds:[coupon.id],details:{reason:'test'}});
  v.available=false;
  const save=mgr.toSave();
  assert.doesNotThrow(()=>JSON.stringify(save));
  assert.equal(save.vehicles[0].available,true);
  assert.equal(save.rotations[0].occurrences[0].formation.members.length,2);
  assert.equal(save.rotations[0].actions[0].vehicleIds[0],coach.id);
  save.vehicles[0].available=false; // emulate a v1.1.30 save already poisoned
  const restored=new RotationV2Manager(schedules);
  assert.equal(restored.loadFromSave(save),true);
  assert.equal(restored.vehicles[0].available,true);
  assert.equal(restored.rotations[0].occurrences.length,1);
  assert.equal(restored.rotations[0].actions.length,1);
});

function makeRuntimeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[],getStationById(){return null;}}; // emulate OSM station not streamed yet
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function addRuntimeSchedule(game){
  const rec=game.scheduleV2.createDraft({number:'8398571',name:'TER test',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'osm-node-A',name:'Chateau',track:new TrackBinding({displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:16*3600+19*60,dwellSec:0,stopCode:StopCode.NONE}),
    new ScheduledLocation({id:'b',order:1,stationId:'osm-node-B',name:'Dormans',track:new TrackBinding({displayName:'V1',lat:48.1,lon:2.1,snapLat:48.1,snapLon:2.1}),arrivalSec:16*3600+30*60,departureSec:16*3600+32*60,dwellSec:120,stopCode:StopCode.NONE,arrivalOverride:true,departureOverride:true}),
  ];
  v.outboundPath.routePoints=[{lat:48,lon:2,wayId:'1',maxSpeed:160},{lat:48.1,lon:2.1,wayId:'1',maxSpeed:160}];
  v.outboundPath.legs=[{fromLocationId:'a',toLocationId:'b',routePoints:v.outboundPath.routePoints,segments:[],distanceKm:12}];
  v.state=ScheduleState.VALID;
  return rec;
}

test('v1.1.31 stale available=false no longer prevents V2 compile and train is visible before departure using exact track coordinate',()=>{
  const game=makeRuntimeGame();const rec=addRuntimeSchedule(game);
  const rot=game.rotationV2.addRotation({name:'R'});
  const loco=game.rotationV2.addVehicle({number:'BB',name:'BB',category:'locomotive',traction:'diesel',maxSpeed:160,massKg:80000,powerW:3000000,lengthM:20});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});
  loco.available=false; // ghost lock from old save; no runtime owner exists
  game.scheduleV2Runtime.sync(16*60+18,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  global.window={game:{...game,unions:{isServiceBlocked:()=>false},voiePointManager:null}};
  svc.scheduleTick(16*60+18,'2026-08-16',null);
  assert.deepEqual(svc.position,{lat:48,lon:2});
  svc.scheduleTick(16*60+19,'2026-08-16',null);
  assert.equal(svc.state,'moving');
  assert.deepEqual(svc.position,{lat:48,lon:2});
  delete global.window;
});

test('v1.1.31 editor gives station clicks priority over nearby VIA clicks',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const stationPos=src.indexOf('const st=this._nearestStation(w.lat,w.lon);');
  const constraintPos=src.indexOf('const existing=this._nearestConstraint(w.lat,w.lon);');
  assert.ok(stationPos>0 && constraintPos>stationPos);
});
