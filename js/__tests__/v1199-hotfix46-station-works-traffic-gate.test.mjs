import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorksManager } from '../works.js';
import { ActiveService } from '../schedule-creator.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const DATE='2026-09-02';

test('HOTFIX46 station-only informational works persist and never become operational restrictions',()=>{
  const m=new WorksManager();
  m.add({
    name:'Passerelle Dijon',scope:'station',stationId:'DIJON',stationName:'Dijon-Ville',
    station:{id:'DIJON',name:'Dijon-Ville',lat:47.323,lon:5.027},
    stationA:'DIJON',stationB:'DIJON',
    affectsTraffic:false,stationImpact:'stop',
    startDate:DATE,endDate:DATE,startTime:'00:00',endTime:'23:59',recurrence:'once',zones:[]
  });
  const display=m.getActiveDisplayItems(DATE,600);
  assert.equal(display.length,1);
  assert.equal(display[0].stationOnly,true);
  assert.equal(display[0].stationName,'Dijon-Ville');
  assert.equal(display[0].affectsTraffic,false);
  assert.equal(display[0].impact,'none');
  assert.equal(m.getActiveRestrictions(DATE,600).length,0);

  const m2=new WorksManager();m2.loadFromSave(m.toSave());
  const w=m2.getAll()[0];
  assert.equal(w.scope,'station');
  assert.equal(w.stationId,'DIJON');
  assert.equal(w.affectsTraffic,false);
  assert.equal(m2.getZones(w).length,0);
});

test('HOTFIX46 station-only operational works are detected by through trains even without a booked stop',()=>{
  const m=new WorksManager();
  m.add({
    name:'Voie Dijon',scope:'station',stationId:'DIJON',stationName:'Dijon-Ville',
    station:{id:'DIJON',name:'Dijon-Ville',lat:47.323,lon:5.027},
    stationA:'DIJON',stationB:'DIJON',
    affectsTraffic:true,stationImpact:'slow',stationSpeedLimit:30,impact:'slow',speedLimit:30,
    startDate:DATE,endDate:DATE,startTime:'00:00',endTime:'23:59',recurrence:'once',zones:[]
  });
  const restrictions=m.getActiveRestrictions(DATE,600);
  assert.equal(restrictions.length,1);
  assert.equal(restrictions[0].stationOnly,true);
  assert.equal(restrictions[0].impact,'slow');
  assert.equal(restrictions[0].speedLimit,30);

  global.window={game:{worksManager:m}};
  const svc=Object.create(ActiveService.prototype);
  svc.world={
    tracks:[],
    getStationById:id=>id==='DIJON'?{id:'DIJON',lat:47.323,lon:5.027}:null
  };
  svc.currentStopIndex=1;
  svc.getCurrentStops=()=>[{stationId:'BEAUNE'},{stationId:'LANGRES'}];
  const route=[
    {lat:47.300,lon:5.027,wayId:'1'},
    {lat:47.323,lon:5.027,wayId:'1'},
    {lat:47.350,lon:5.027,wayId:'1'}
  ];
  const blocking=svc._getBlockingWorksForRoute(route,DATE,600);
  assert.equal(blocking.length,1);
  assert.equal(blocking[0].stationOnly,true);
  delete global.window;
});

test('HOTFIX46 informational section works remain visible but do not affect trains',()=>{
  const m=new WorksManager();
  const route=[{lat:48,lon:2,wayId:'100'},{lat:48.01,lon:2,wayId:'100'}];
  m.add({name:'Peinture passerelle',scope:'sections',affectsTraffic:false,startDate:DATE,endDate:DATE,startTime:'00:00',endTime:'23:59',recurrence:'once',zones:[{
    id:'Z',impact:'stop',speedLimit:0,direction:'both',route,distanceKm:1,
    startBinding:{lat:48,lon:2,snapLat:48,snapLon:2,wayId:'100'},
    endBinding:{lat:48.01,lon:2,snapLat:48.01,snapLon:2,wayId:'100'}
  }]});
  assert.equal(m.getActiveDisplayItems(DATE,600).length,1);
  assert.equal(m.getActiveRestrictions(DATE,600).length,0);
});

test('HOTFIX46 Works V2 UI exposes station scope and traffic-impact gate',()=>{
  const src=read('js/works-v2-editor.js');
  assert.match(src,/Une gare uniquement/);
  assert.match(src,/Ces travaux impactent-ils les trains/);
  assert.match(src,/Non — informatif uniquement/);
  assert.match(src,/Impact en gare/);
  assert.match(src,/pick-work-station/);
  assert.match(src,/scope\s*:\s*'station'/);
  assert.match(src,/affectsTraffic/);
});

test('HOTFIX46 incident page/banner renders station works and no-impact wording',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/w\.scope === 'station'/);
  assert.match(ui,/Aucun impact sur la circulation/);
  assert.match(ui,/sans impact circulation/);
  assert.match(ui,/getActiveDisplayItems/);
});

test('HOTFIX46 FILE bundle/cache exposes station-only works runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const index=read('index.html');
  assert.match(bundle,/HOTFIX46-STATION-WORKS-TRAFFIC-GATE/);
  assert.match(bundle,/stationOnly/);
  assert.match(bundle,/Une gare uniquement/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
