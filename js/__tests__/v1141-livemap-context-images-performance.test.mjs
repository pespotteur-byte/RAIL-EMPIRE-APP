import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { RameManager } from '../rame.js';

function game(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2),rameManager=new RameManager();
  const world={stations:[{id:'A',name:'Alpha',lat:48,lon:2},{id:'B',name:'Bravo',lat:48.2,lon:2.2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const g={scheduleV2,rotationV2,rameManager,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};g.scheduleV2Runtime=new ScheduleV2Runtime(g);return g;
}
function schedule(g){
  const rec=g.scheduleV2.createDraft({number:'17801',name:'Alpha - Bravo',category:TrainCategory.PASSENGER,maxSpeed:160});const v=rec.currentVersion;
  v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'Alpha',track:new TrackBinding({wayId:'10',displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:3600,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'Bravo',track:new TrackBinding({wayId:'11',displayName:'V2',lat:48.2,lon:2.2,snapLat:48.2,snapLon:2.2}),arrivalSec:4200,departureSec:4320,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];
  const pts=[{lat:48,lon:2,wayId:'10',maxSpeed:160,electrified:true},{lat:48.1,lon:2.1,wayId:'10',maxSpeed:160,electrified:true},{lat:48.2,lon:2.2,wayId:'11',maxSpeed:160,electrified:true}];
  v.outboundPath.legs=[{id:'leg',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:pts,segments:[],distanceKm:30}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;return {rec,v};
}

test('direct runtime stays lightweight while retaining the page-Rames id for display',()=>{
  const g=game(),{rec,v}=schedule(g);
  const r=g.rameManager.add({name:'TER Images',serialNumber:'X1',elements:['l','c'],elementDetails:[
    {name:'BB',instanceName:'BB 26000',category:'locomotive',traction:'electrique',maxSpeed:200,mass:90,tonnage:90,power:5600,length:17,imageData:'img/catalog/test-loco.gif'},
    {name:'Corail',instanceName:'B11u',category:'voiture',traction:'none',maxSpeed:200,mass:42,tonnage:42,power:0,length:26,imageData:'img/catalog/test-coach.gif',flipped:true}
  ],currentLocation:{stationId:'A',lat:48,lon:2,depotId:'',serviceId:''}});
  const proxy=g.rotationV2.upsertRameProxy(r);
  g.rotationV2.setDirectAssignment(rec.id,v.id,{members:[{vehicleId:proxy.id,role:FormationRole.LEAD,order:0}]},{rameId:r.id});
  g.scheduleV2Runtime.sync(55,'2026-08-17');
  const svc=g.scheduleCreator.services[0];
  assert.ok(svc);
  assert.notEqual(svc.rame,r);
  assert.equal(svc._v2DirectRameId,r.id);
  assert.equal(svc.rame.elementDetails.length,1);
  assert.equal(svc.rame.elementDetails[0].imageData,undefined);
});

test('Livemap between-label no longer scans every European station',()=>{
  const src=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const panelStart=src.indexOf('  _buildLivemapPanelContent(svc) {');
  const panelEnd=src.indexOf('_updateBandeauMarquee()',panelStart);
  const panel=src.slice(panelStart,panelEnd);
  const listStart=src.indexOf('updateTrainsList(services)');
  const listEnd=src.indexOf('updateFreightTab()',listStart);
  const list=src.slice(listStart,listEnd);
  assert.doesNotMatch(panel,/for\s*\(const st of world\.stations\)/);
  assert.doesNotMatch(list,/for\s*\(const st of this\.game\.world\.stations\)/);
  assert.match(panel,/scheduled passenger\/freight stop of THIS train/i);
  assert.match(list,/train's own timetable/i);
});

test('Livemap resolves direct-service images from page Rames and keeps image DOM persistent',()=>{
  const src=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const start=src.indexOf('updateTrainsList(services)');
  const end=src.indexOf('updateFreightTab()',start);
  const block=src.slice(start,end);
  assert.match(src,/_displayRameForService\(svc\)/);
  assert.match(block,/displayRame\?\.elementDetails/);
  assert.match(block,/data-service-id/);
  assert.match(block,/_hydratePersistentTrainImages/);
  assert.match(block,/node\.remove\(\)/);
  assert.doesNotMatch(block,/<img src=\"\$\{e\.imageData\}/);
});

test('expensive V2 diagnostics and freight sidebar are throttled (V2 0.5 Hz, freight 1 Hz)',()=>{
  const src=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  assert.match(src,/perfNow\s*-\s*this\._lastV2SidebarDiagAt\s*<\s*2000/);
  assert.match(src,/perfNow\s*-\s*this\._lastFreightSidebarAt\s*<\s*1000/);
});


test('empty Livemap train list does not rewrite identical DOM every refresh',()=>{
  const src=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const start=src.indexOf('updateTrainsList(services)');
  const end=src.indexOf('updateFreightTab()',start);
  const block=src.slice(start,end);
  assert.match(block,/container\._lastTrainListHtml !== emptyHtml/);
  assert.match(block,/container\._lastTrainListHtml = emptyHtml/);
});
