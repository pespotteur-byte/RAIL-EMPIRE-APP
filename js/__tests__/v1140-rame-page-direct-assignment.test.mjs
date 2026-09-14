import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { RameManager } from '../rame.js';

function game(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2),rameManager=new RameManager();
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const g={scheduleV2,rotationV2,rameManager,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};g.scheduleV2Runtime=new ScheduleV2Runtime(g);return g;
}
function schedule(g,n='17801',dep=3600){
  const rec=g.scheduleV2.createDraft({number:n,name:'Test',category:TrainCategory.PASSENGER,maxSpeed:160});const v=rec.currentVersion,arr=dep+600;
  v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:dep,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:arr,departureSec:arr+120,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:160,electrified:false},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:160,electrified:false},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:160,electrified:false}];v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;return {rec,v};
}
function rame(g,name='TER 001'){
  return g.rameManager.add({name,serialNumber:'001',elements:['loco','coach'],elementDetails:[{name:'Locomotive',instanceName:'BB 22201',category:'locomotive',traction:'diesel',maxSpeed:160,mass:80,tonnage:80,power:4000,length:20},{name:'Voiture',instanceName:'Corail 301-A',category:'voiture',traction:'none',maxSpeed:160,mass:40,tonnage:40,power:0,length:26}],currentLocation:{depotId:'',stationId:'A',serviceId:'',lat:48,lon:2}});
}
function assignLine(g,rec,v,r,name='R01'){
  for(let i=0;i<r.elementDetails.length;i++)g.rotationV2.materializeRameElement(r,i,null);
  const rot=g.rotationV2.addRotation({name});g.rotationV2.assignRameToRotation(rot.id,r);g.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});return rot;
}

test('HOTFIX32 a Rame from page Rames runs only after assignment to a real rotation line',()=>{const g=game(),{rec,v}=schedule(g),r=rame(g);const rot=assignLine(g,rec,v,r);g.scheduleV2Runtime.sync(55,'2026-08-17');assert.equal(g.scheduleCreator.services.length,1);const svc=g.scheduleCreator.services[0];assert.equal(svc._v2AssignedRameId,r.id);assert.match(svc.id,new RegExp(`^v2:${rot.id}:`));assert.deepEqual(svc.position,{lat:48,lon:2});assert.equal(r.currentLocation.serviceId,svc.id);});

test('rame proxy keeps aggregate physical metrics',()=>{const g=game(),r=rame(g);const p=g.rotationV2.upsertRameProxy(r);assert.equal(p.sourceRameId,r.id);assert.equal(p.massKg,120000);assert.equal(p.powerW,4000000);assert.equal(p.lengthM,46);assert.equal(p.maxSpeed,160);assert.equal(p.traction,'diesel');});

test('HOTFIX32 Rame line assignment survives save/load through assignedRameId and formation',()=>{const g=game(),{rec,v}=schedule(g),r=rame(g);assignLine(g,rec,v,r);const save=g.rotationV2.toSave();const rm=new RotationV2Manager(g.scheduleV2);assert.equal(rm.loadFromSave(save),true);assert.equal(rm.rotations[0].assignedRameId,r.id);assert.equal(rm.rotations[0].occurrences[0].scheduleId,rec.id);assert.equal(rm.rotations[0].assignedFormation.members.length,2);});

test('deleted page-Rames consist blocks its rotation line instead of using stale material',()=>{const g=game(),{rec,v}=schedule(g),r=rame(g);assignLine(g,rec,v,r);g.rameManager.remove(r.id);g.scheduleV2Runtime.sync(55,'2026-08-17');assert.equal(g.scheduleCreator.services.length,0);assert.ok(g.scheduleV2Runtime.alerts.some(a=>a.code==='ROTATION_RAME_MISSING'));});

test('rame in maintenance blocks its rotation line',()=>{const g=game(),{rec,v}=schedule(g),r=rame(g);assignLine(g,rec,v,r);r.inMaintenance=true;g.scheduleV2Runtime.sync(55,'2026-08-17');assert.equal(g.scheduleCreator.services.length,0);assert.ok(g.scheduleV2Runtime.alerts.some(a=>a.code==='ROTATION_RAME_MAINTENANCE'));});

test('same physical Rame is detected as double-booked across overlapping rotation lines',()=>{const g=game(),s1=schedule(g,'17801',3600),s2=schedule(g,'17803',3700),r=rame(g);assignLine(g,s1.rec,s1.v,r,'R01');assignLine(g,s2.rec,s2.v,r,'R02');assert.ok(g.rotationV2.validateMaterialConflicts().some(c=>(c.code==='RAME_DOUBLE_BOOKED'&&c.rameId===r.id)||c.code==='VEHICLE_DOUBLE_BOOKED'));});

test('HOTFIX64 schedule UI offers direct Rame in simple mode and rotations in advanced mode',()=>{const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');const start=src.indexOf('_directAssignmentDialog(scheduleId)');const end=src.indexOf('_markRecordChanged',start);const block=src.slice(start,end);assert.match(block,/rotationsRequired\s*===\s*true/);assert.match(block,/Ajouter au roulement/);assert.match(block,/Ligne de roulement/);assert.match(block,/Mode simple — affecter une rame/);assert.match(block,/data-simple-rame/);assert.match(block,/setDirectRameAssignment/);});
