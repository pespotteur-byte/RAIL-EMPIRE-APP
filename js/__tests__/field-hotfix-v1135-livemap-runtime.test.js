import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function makeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;
}
function makeRun(game, departureSec=23*3600+15*60+37){
  const rec=game.scheduleV2.createDraft({number:'8398571',name:'Terrain',category:TrainCategory.FREIGHT,maxSpeed:120});
  const v=rec.currentVersion;const arrivalSec=departureSec+11*60;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec,departureSec:arrivalSec+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true}),
  ];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:120,electrified:false},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:120,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:120,electrified:false}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  const loco=game.rotationV2.addVehicle({number:'D1',name:'D1',category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  const rot=game.rotationV2.addRotation({name:'Terrain'});const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
  return {rec,rot,occ,loco};
}

test('compiled V2 train is visible on Livemap immediately at T-5',()=>{
  const game=makeGame();makeRun(game);
  game.scheduleV2Runtime.sync(23*60+10+37/60,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  assert.deepEqual(svc.position,{lat:48,lon:2});
  assert.equal(svc.state,'waiting');
  assert.ok(svc.train.stoppedAt);
});

test('compiled V2 train leaves at the exact scheduled second',()=>{
  const game=makeGame();makeRun(game);
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(23*60+10+37/60,'2026-08-16');
  const svc=game.scheduleCreator.services[0];
  svc.scheduleTick(23*60+15+36/60,'2026-08-16',null);
  assert.equal(svc.state,'waiting');
  svc.scheduleTick(23*60+15+37/60,'2026-08-16',null);
  assert.equal(svc.state,'moving');
  assert.ok(svc.position);
  delete globalThis.window;
});

test('main Livemap static overlay draws infrastructure before stations so low-zoom station pixels stay on top',()=>{
  const src=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  const start=src.indexOf('  _drawStaticOverlay(');
  const end=src.indexOf('  drawStationPlatformOccupancy(',start);
  const body=src.slice(start,end);
  assert.ok(body.indexOf('this.drawTracks')>=0);
  assert.ok(body.indexOf('this.drawVoieTroncons')>body.indexOf('this.drawTracks'));
  assert.ok(body.indexOf('this.drawStations')>body.indexOf('this.drawVoieTroncons'));
});

test('Livemap keeps V2 diagnostics out of the top header',()=>{
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="v2-runtime-status"/);
  assert.doesNotMatch(html,/id="world-stations-status"/);
  assert.match(html,/id="v2-runtime-sidebar-status"/);
  assert.match(main,/_updateV2RuntimeStatus\(\)/);
});
