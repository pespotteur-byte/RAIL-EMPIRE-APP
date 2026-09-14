import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { PlatformManager } from '../line.js';

function makeGame(){
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2,platforms:2},{id:'B',name:'B',lat:48.2,lon:2.2,platforms:2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;
}
function makeRun(game, departureSec=12*3600){
  const rec=game.scheduleV2.createDraft({number:'T11',name:'Test',category:TrainCategory.PASSENGER,maxSpeed:120});
  const v=rec.currentVersion;const arrivalSec=departureSec+15*60;
  v.locations=[
    new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',trackRef:'1',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec,dwellSec:0,stopCode:StopCode.C}),
    new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',trackRef:'2',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec,departureSec:arrivalSec+60,dwellSec:60,stopCode:StopCode.S}),
  ];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:120,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:120,electrified:false}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
  const loco=game.rotationV2.addVehicle({number:'D1',name:'D1',category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3000000,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  const rot=game.rotationV2.addRotation({name:'Test'});const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
}

test('HOTFIX11: stale ghost voie occupation is purged and due V2 train departs',()=>{
  const game=makeGame();makeRun(game);
  const vp={id:'vp-A-1',stationId:'A',voie:'1',occupiedBy:'ghost-service'};
  game.voiePointManager={
    getStationVoiePoints(id){return id==='A'?[vp]:[];},
    getVoiePointById(id){return id===vp.id?vp:null;},
    occupyVoiePoint(id,trainId){if(id!==vp.id)return false;if(vp.occupiedBy!=null&&vp.occupiedBy!==trainId)return false;vp.occupiedBy=trainId;return true;},
    releaseVoiePoint(id,trainId){if(id===vp.id&&vp.occupiedBy===trainId)vp.occupiedBy=null;},
  };
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(11*60+55,'2026-08-30');
  const svc=game.scheduleCreator.services[0];
  const s0=svc.getCurrentStops()[0];s0.voiePointId=vp.id;s0.platform='1';
  svc.scheduleTick(12*60,'2026-08-30',null);
  assert.equal(svc.state,'moving');
  assert.equal(vp.occupiedBy,svc.id);
  delete globalThis.window;
});


test('HOTFIX11: stale ghost platform reservation is purged and due train departs',()=>{
  const game=makeGame();makeRun(game);
  game.platformManager=new PlatformManager();
  game.platformManager.initStation('A',2);
  game.platformManager.stationPlatforms.get('A').occupied.set(1,'ghost-service');
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(11*60+55,'2026-08-30');
  const svc=game.scheduleCreator.services[0];
  svc.getCurrentStops()[0].platform='1';
  svc.scheduleTick(12*60,'2026-08-30',null);
  assert.equal(svc.state,'moving');
  assert.equal(game.platformManager.stationPlatforms.get('A').occupied.get(1),svc.id);
  delete globalThis.window;
});

test('HOTFIX11: real active owner is never purged',()=>{
  const game=makeGame();makeRun(game);
  const vp={id:'vp-A-1',stationId:'A',voie:'1',occupiedBy:'real-other'};
  game.voiePointManager={getStationVoiePoints(){return [vp];},getVoiePointById(){return vp;},occupyVoiePoint(){return false;},releaseVoiePoint(){throw new Error('must not release active owner');}};
  game.scheduleCreator.services.push({id:'real-other',active:true,completed:false,cancelled:false,state:'moving'});
  globalThis.window={game,performance:globalThis.performance};
  game.scheduleV2Runtime.sync(11*60+55,'2026-08-30');
  const svc=game.scheduleCreator.services.find(s=>s.id!=='real-other');
  const s0=svc.getCurrentStops()[0];s0.voiePointId=vp.id;s0.platform='1';
  svc.scheduleTick(12*60,'2026-08-30',null);
  assert.equal(svc.state,'waiting');
  assert.equal(svc.train.delayReason,'attente voie libre au départ');
  delete globalThis.window;
});

test('HOTFIX11: 3D panel no longer relies on inline onclick and has stationary-position recovery',()=>{
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/onclick="game\.ui\.toggle3DFollow\(\)"/);
  assert.match(ui,/data-re3d-action="toggle"/);
  assert.match(ui,/action === 'toggle'/);
  assert.match(ui,/_ensure3DServicePosition\(svc\)/);
  assert.match(ui,/Relief DEM indisponible, pseudo-3D conservée/);
});

test('HOTFIX11: DEM rebuild failures are contained in fallback instead of rejecting UI flow',()=>{
  const terrain=fs.readFileSync(new URL('../terrain3d.js',import.meta.url),'utf8');
  assert.match(terrain,/if\s*\(\s*!this\.enabled\s*\|\|\s*this\.failed\s*\|\|\s*this\._rebuildPending\s*\)\s*return/);
  assert.match(terrain,/\.catch\(\s*\(?e\)?\s*=>\s*\{\s*console\.warn\('\[RE3D DEM\] rebuild failed'/);
  assert.match(terrain,/_emit\(\s*'fallback'\s*,\s*'Relief indisponible'\s*\)/);
});
