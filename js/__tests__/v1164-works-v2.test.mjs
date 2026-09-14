import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorksManager } from '../works.js';
import { ActiveService } from '../schedule-creator.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const zone=(id,way,impact='stop',speedLimit=0,lat=48)=>({
  id,name:id,impact,speedLimit,
  startBinding:{wayId:String(way),lat,lon:2,snapLat:lat,snapLon:2},
  endBinding:{wayId:String(way),lat:lat+0.01,lon:2,snapLat:lat+0.01,snapLon:2},
  constraints:[],
  route:[{lat,lon:2,wayId:String(way)},{lat:lat+0.01,lon:2,wayId:String(way)}],
  segments:[{wayId:String(way)}],distanceKm:1.11,
});

test('v1.1.64 PlannedWorks persists several independent precise ORM zones',()=>{
  const m=new WorksManager();
  m.add({name:'RVB',startDate:'2026-08-18',endDate:'2026-08-20',startTime:'00:00',endTime:'23:59',zones:[zone('z1',101,'stop',0),zone('z2',202,'slow',40,49)]});
  const active=m.getActiveRestrictions('2026-08-19',720);
  assert.equal(active.length,2);
  assert.equal(active[0].impact,'stop');
  assert.equal(active[1].speedLimit,40);
  assert.equal(active[0].route[0].wayId,'101');
  const save=m.toSave();
  const m2=new WorksManager();m2.loadFromSave(save);
  assert.equal(m2.getAll()[0].zones.length,2);
  assert.equal(m2.getAll()[0].zones[1].segments[0].wayId,'202');
});

test('Travaux V2 runtime distinguishes parallel OSM ways instead of using proximity alone',()=>{
  const m=new WorksManager();m.add({name:'Voie 1 fermée',startDate:'2026-08-18',endDate:'2026-08-18',startTime:'00:00',endTime:'23:59',zones:[zone('z1',111,'stop',0)]});
  global.window={game:{worksManager:m}};
  const svc=Object.create(ActiveService.prototype);svc.world={tracks:[]};svc.currentStopIndex=1;svc.getCurrentStops=()=>[{stationId:'a'},{stationId:'b'}];
  const same=[{lat:48,lon:2,wayId:'111'},{lat:48.01,lon:2,wayId:'111'}];
  const parallel=[{lat:48,lon:2.00002,wayId:'222'},{lat:48.01,lon:2.00002,wayId:'222'}];
  assert.equal(svc._getBlockingWorksForRoute(same,'2026-08-18',600).length,1);
  assert.equal(svc._getBlockingWorksForRoute(parallel,'2026-08-18',600).length,0);
  delete global.window;
});

test('Caténaire coupée blocks electric-only stock but not diesel',()=>{
  const svc=Object.create(ActiveService.prototype);
  svc._getBlockingWorksForRoute=()=>[{impact:'power-off',speedLimit:0}];
  // This unit test is about traction compatibility, not route geometry/braking.
  // Model the train as already at the affected zone boundary.
  svc._distanceAheadToRestriction=()=>0;
  svc._safetyHorizonKm=()=>1;
  svc._brakingCurveCapKmh=()=>0;
  svc.rame={traction:'25kv'};
  assert.equal(svc._computeWorksLimit([], '2026-08-18', 600),0);
  svc.rame={traction:'diesel'};
  assert.equal(svc._computeWorksLimit([], '2026-08-18', 600),null);
});

test('Travaux V2 editor reuses Schedule V2 ORM router and exposes VIA/manual/multi-zone controls',()=>{
  const src=fs.readFileSync(path.join(root,'js','works-v2-editor.js'),'utf8');
  assert.match(src,/ScheduleV2Router/);
  assert.match(src,/routeBetweenBindings/);
  assert.match(src,/chooseTrackCandidates/);
  assert.match(src,/＋ (?:Zone|Section)/);
  assert.match(src,/＋ VIA/);
  assert.match(src,/Tracé manuel/);
  assert.match(src,/Caténaire coupée/);
});

test('Incidents page opens the V2 works editor, not the legacy modal',()=>{
  const src=fs.readFileSync(path.join(root,'js','ui.js'),'utf8');
  assert.match(src,/btn-add-works[^\n]+_ensureWorksV2Editor\(\)\.open\(\)/);
  assert.match(src,/new WorksV2Editor\(this\.game, this\)/);
});

test('v1.1.64 FILE bundle contains Travaux V2 editor and cache/version marker',()=>{
  const bundle=fs.readFileSync(path.join(root,'js','rail-empire.file.bundle.js'),'utf8');
  assert.match(bundle,/Rail Empire v1\.1\.99 FILE:\/\/ CORE bundle/);
  assert.ok(bundle.includes('Travaux V2'));
  assert.ok(bundle.includes('getActiveRestrictions'));
  assert.ok(bundle.includes('power-off'));
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
