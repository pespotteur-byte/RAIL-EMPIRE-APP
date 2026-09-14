import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SimulationEngine } from '../engine.js';
import { ScheduleCreator, cantonManager } from '../schedule-creator.js';
import {
  ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding,
  TrainCategory, StopCode,
} from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function makeGame(){
  // Each fixture is a separate world; no occupancy may leak from the previous test.
  for (const key of ['cantons','routeCantons','trainCantons','resourceCantons']) cantonManager[key].clear();
  const scheduleV2=new ScheduleV2Manager();
  const rotationV2=new RotationV2Manager(scheduleV2);
  const world={
    stations:[
      {id:'PAR',name:'Paris',lat:48.8566,lon:2.3522,platforms:8},
      {id:'LYO',name:'Lyon',lat:45.7600,lon:4.8600,platforms:8},
      {id:'MRS',name:'Marseille',lat:43.3030,lon:5.3810,platforms:8},
    ],
    getStationById(id){return this.stations.find(s=>s.id===id)||null;},
  };
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1},rameManager:{getById(){return null;}}};
  game.scheduleV2Runtime=new ScheduleV2Runtime(game);
  return game;
}

function addParisLyonMarseille(game){
  const rec=game.scheduleV2.createDraft({number:'TGV82',name:'Paris Marseille',category:TrainCategory.PASSENGER,maxSpeed:300});
  const v=rec.currentVersion;
  const mk=(id,order,stationId,name,lat,lon,arr,dep)=>new ScheduledLocation({
    id,order,stationId,name,
    track:new TrackBinding({wayId:`w${order}`,displayName:'V1',lat,lon,snapLat:lat,snapLon:lon}),
    arrivalSec:arr,departureSec:dep,dwellSec:arr!=null&&dep!=null?Math.max(0,dep-arr):0,
    stopCode:StopCode.S,arrivalOverride:arr!=null,departureOverride:dep!=null,
  });
  v.locations=[
    mk('p',0,'PAR','Paris',48.8566,2.3522,null,10*3600),
    mk('l',1,'LYO','Lyon',45.7600,4.8600,11*3600+50*60,12*3600),
    mk('m',2,'MRS','Marseille',43.3030,5.3810,14*3600,14*3600+120),
  ];
  const route1=[
    {lat:48.8566,lon:2.3522,wayId:'w0',maxSpeed:300,electrified:true},
    {lat:47.4,lon:3.4,wayId:'w01',maxSpeed:300,electrified:true},
    {lat:45.7600,lon:4.8600,wayId:'w1',maxSpeed:160,electrified:true},
  ];
  const route2=[
    {lat:45.7600,lon:4.8600,wayId:'w1',maxSpeed:300,electrified:true},
    {lat:44.5,lon:4.95,wayId:'w12',maxSpeed:300,electrified:true},
    {lat:43.3030,lon:5.3810,wayId:'w2',maxSpeed:160,electrified:true},
  ];
  v.outboundPath.legs=[
    {id:'pl',fromLocationId:'p',toLocationId:'l',constraintIds:[],routePoints:route1,segments:[],distanceKm:400},
    {id:'lm',fromLocationId:'l',toLocationId:'m',constraintIds:[],routePoints:route2,segments:[],distanceKm:315},
  ];
  v.outboundPath.routePoints=[...route1,...route2.slice(1)];
  v.outboundPath.segments=[];
  v.state=ScheduleState.VALID;
  const rot=game.rotationV2.addRotation({name:'TGV Sud-Est'});
  const loco=game.rotationV2.addVehicle({number:'TGV TEST',name:'TGV TEST',category:'locomotive',traction:'diesel',maxSpeed:300,massKg:400000,powerW:8000000,lengthM:200});
  const occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});
  occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD,order:0})];
  return {rec,rot,occ,loco};
}

test('HOTFIX82: a short in-game UI stall is repaid instead of losing train movement time',()=>{
  const engine=new SimulationEngine();
  engine._lastFrameTime=performance.now()-2000;
  engine._ptCache=engine._computeGameTime();engine._ptCacheTime=performance.now();
  let moved=0;engine.onMoveTick=(dt)=>{moved+=dt;};
  const oldDocument=globalThis.document;
  globalThis.document={hidden:false};
  try { engine.update(); } finally { if(oldDocument===undefined) delete globalThis.document; else globalThis.document=oldDocument; }
  assert.ok(moved>=1.9 && moved<=2.1,`expected ~2 s catch-up, got ${moved}`);
});

test('HOTFIX83: hidden-tab heartbeat advances real elapsed time up to the safe per-call cap',()=>{
  const engine=new SimulationEngine();
  engine._lastFrameTime=performance.now()-5000;
  engine._ptCache=engine._computeGameTime();engine._ptCacheTime=performance.now();
  let moved=0;engine.onMoveTick=(dt)=>{moved+=dt;};
  const oldDocument=globalThis.document;
  globalThis.document={hidden:true};
  try { engine.update(); } finally { if(oldDocument===undefined) delete globalThis.document; else globalThis.document=oldDocument; }
  assert.ok(moved>=4.8 && moved<=5.1,`hidden-tab heartbeat should advance ~5 s, got ${moved}`);
});

test('HOTFIX82: reload at Lyon dwell reconstructs Paris-Lyon-Marseille at Lyon, not Paris',()=>{
  const game=makeGame();addParisLyonMarseille(game);
  game.scheduleV2Runtime.sync(11*60+59,'2026-09-04');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.state,'stopped_at_station');
  assert.equal(svc.train.stoppedAt?.id,'LYO');
  assert.equal(svc.currentStopIndex,2);
  assert.ok(Math.abs(svc.position.lat-45.76)<0.01);
});

test('HOTFIX82: reload at Lyon departure resumes on Lyon-Marseille leg',()=>{
  const game=makeGame();addParisLyonMarseille(game);
  game.scheduleV2Runtime.sync(12*60,'2026-09-04');
  assert.equal(game.scheduleCreator.services.length,1);
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.state,'moving');
  assert.equal(svc.currentStopIndex,2);
  assert.ok(svc.position.lat<45.77 && svc.position.lat>43.29);
  assert.equal(svc.train.stoppedAt,null);
});

test('HOTFIX82: stale runtime snapshot no longer resurrects an old Paris position',()=>{
  const game=makeGame();const {rot,occ,loco}=addParisLyonMarseille(game);
  const id=`v2:${rot.id}:${occ.id}:2026-09-04`;
  game.scheduleV2Runtime._snapshotCapturedAtUnixSec=Math.floor(Date.now()/1000)-7200;
  game.scheduleV2Runtime._pendingSnapshots.set(id,{
    id,state:'moving',currentStopIndex:1,isReturnLeg:false,
    position:{lat:48.7,lon:2.5},speed:120,delay:0,completed:false,cancelled:false,
    stateIndex:0,stateProgress:0.1,vehicleIds:[loco.id],formationMembers:[{vehicleId:loco.id,role:FormationRole.LEAD}],
    totalDistance:20,train:{speed:120,delay:0,state:'moving',delayReason:'',incidentDelayReasons:[]},
  });
  game.scheduleV2Runtime.sync(11*60+59,'2026-09-04');
  const svc=game.scheduleCreator.services[0];
  assert.equal(svc.train.stoppedAt?.id,'LYO');
  assert.ok(Math.abs(svc.position.lat-45.76)<0.01,'must catch up to Lyon rather than restore Paris snapshot');
  assert.equal(game.scheduleV2Runtime._pendingSnapshots.has(id),false);
});

test('HOTFIX82: game loop simulation update is not gated by the LiveMap page',()=>{
  const src=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const start=src.indexOf('gameLoop() {');
  const end=src.indexOf('\n  }\n\n}',start);
  const body=src.slice(start,end>start?end:src.length);
  const update=body.indexOf('this.engine.update();');
  const pageGate=body.indexOf("const mapActive = this.ui?.activePage === 'map';");
  assert.ok(update>=0 && pageGate>update,'engine.update must run before/independently of the map-page render gate');
});
