import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationMember, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function makeGame(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;
}
function configure(game,dep){
  const rec=game.scheduleV2.createDraft({number:'8398571',name:'Terrain',category:TrainCategory.FREIGHT,maxSpeed:120}),v=rec.currentVersion;
  const setTimes=d=>{const arr=d+600;v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:d,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:arr,departureSec:arr+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];const pts=[{lat:48,lon:2,wayId:'10',electrified:false},{lat:48.2,lon:2.2,wayId:'11',electrified:false}];v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',routePoints:pts,segments:[],distanceKm:30,constraintIds:[]}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;};
  setTimes(dep);
  const loco=game.rotationV2.addVehicle({number:'D1',name:'D1',category:'locomotive',traction:'diesel',maxSpeed:140,massKg:80000,powerW:3e6,lengthM:20,location:{kind:'STATION',id:'A',lat:48,lon:2}});
  const rot=game.rotationV2.addRotation({name:'Test'}),occ=game.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});occ.formation.members=[new FormationMember({vehicleId:loco.id,role:FormationRole.LEAD})];game.rotationV2.recalculateRotation(rot.id);
  return {rec,v,rot,occ,loco,setTimes};
}

test('missed schedule delayed into T-5 window compiles immediately after forceSync',()=>{
  const game=makeGame(),x=configure(game,16*3600);
  game.scheduleV2Runtime.sync(18*60,'2026-08-16');assert.equal(game.scheduleCreator.services.length,0);
  x.setTimes(18*3600+4*60);game.rotationV2.recalculateRotation(x.rot.id);
  game.scheduleV2Runtime.forceSync(18*60,'2026-08-16');
  assert.equal(game.scheduleCreator.services.length,1);assert.equal(game.scheduleCreator.services[0].state,'waiting');assert.deepEqual(game.scheduleCreator.services[0].position,{lat:48,lon:2});
});

test('diagnostics explains no material instead of silent zero train',()=>{
  const game=makeGame(),x=configure(game,18*3600+4*60);x.occ.formation.members=[];game.rotationV2.recalculateRotation(x.rot.id);
  const d=game.scheduleV2Runtime.diagnose(18*60,'2026-08-16');
  assert.match(d.summary,/blocage/);assert.ok(d.items.some(i=>/aucun matériel affecté/.test(i.status)));
});

test('Carte sidebar contains permanent V2 diagnostics and waiting filter uses position',()=>{
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(html,/id="v2-runtime-sidebar-status"/);assert.match(ui,/updateV2RuntimeSidebar/);assert.match(ui,/svc\.state === 'waiting' && svc\.position/);assert.match(main,/svc\.state === 'waiting' && svc\.position/);
});
