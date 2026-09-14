import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorksManager } from '../works.js';
import { DepotManager } from '../depot.js';
import { ActiveService } from '../schedule-creator.js';
import { normalizeSectionDirection, railSectionDirectionMatchesRoute } from '../rail-section-geometry.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const route=[{lat:48.0,lon:2.0,wayId:'100'},{lat:48.01,lon:2.0,wayId:'100'},{lat:48.02,lon:2.0,wayId:'100'}];
const section=(direction='both',impact='slow')=>({
  id:'S1',name:'Section 1',direction,impact,speedLimit:60,
  startBinding:{lat:48,lon:2,snapLat:48,snapLon:2,wayId:'100'},
  endBinding:{lat:48.02,lon:2,snapLat:48.02,snapLon:2,wayId:'100'},
  constraints:[],route,segments:[{wayId:'100'}],distanceKm:2.22,
});

test('HOTFIX40 sections default to both directions',()=>{
  assert.equal(normalizeSectionDirection(undefined),'both');
  assert.equal(normalizeSectionDirection('junk'),'both');
  assert.equal(normalizeSectionDirection('forward'),'forward');
  assert.equal(normalizeSectionDirection('reverse'),'reverse');
});

test('HOTFIX40 direction matcher distinguishes A→B and B→A',()=>{
  assert.equal(railSectionDirectionMatchesRoute(route,section('forward')),true);
  assert.equal(railSectionDirectionMatchesRoute([...route].reverse(),section('forward')),false);
  assert.equal(railSectionDirectionMatchesRoute(route,section('reverse')),false);
  assert.equal(railSectionDirectionMatchesRoute([...route].reverse(),section('reverse')),true);
  assert.equal(railSectionDirectionMatchesRoute([...route].reverse(),section('both')),true);
});

test('Travaux V2 persists independent sections, LTV and per-section direction',()=>{
  const m=new WorksManager();
  m.add({name:'RVB multi',startDate:'2026-09-01',endDate:'2026-09-02',startTime:'00:00',endTime:'23:59',recurrence:'daily',zones:[section('both','slow'),{...section('forward','stop'),id:'S2',route:route.map(p=>({...p,lon:p.lon+0.5})),startBinding:{...section().startBinding,lon:2.5,snapLon:2.5},endBinding:{...section().endBinding,lon:2.5,snapLon:2.5}}]});
  const r=m.getActiveRestrictions('2026-09-01',600);
  assert.equal(r.length,2);
  assert.equal(r[0].impact,'slow');
  assert.equal(r[0].speedLimit,60);
  assert.equal(r[0].direction,'both');
  assert.equal(r[1].direction,'forward');
  const m2=new WorksManager();m2.loadFromSave(m.toSave());
  assert.equal(m2.getAll()[0].zones.length,2);
  assert.equal(m2.getAll()[0].zones[1].direction,'forward');
});

test('ActiveService applies one-way work only to matching train direction',()=>{
  const m=new WorksManager();m.add({name:'LTV sens A-B',startDate:'2026-09-01',endDate:'2026-09-01',startTime:'00:00',endTime:'23:59',recurrence:'once',zones:[section('forward','slow')]});
  global.window={game:{worksManager:m}};
  const svc=Object.create(ActiveService.prototype);svc.world={tracks:[]};svc.currentStopIndex=1;svc.getCurrentStops=()=>[{stationId:'A'},{stationId:'B'}];
  assert.equal(svc._getBlockingWorksForRoute(route,'2026-09-01',600).length,1);
  assert.equal(svc._getBlockingWorksForRoute([...route].reverse(),'2026-09-01',600).length,0);
  delete global.window;
});

test('Depot/ITE V2 save roundtrip preserves real independent ORM track geometry',()=>{
  const dm=new DepotManager();
  const created=dm.add({schemaVersion:2,type:'ite-fret',name:'ITE Test',stationId:'ITE-ST',tracks:2,cost:0,railSections:[section('both')],iteTracks:[{name:'Voie réception',length:2220,cargoType:'conteneurs',...section('both'),role:'ite-track'}],iteCargoTypes:['conteneurs']});
  assert.ok(created);assert.equal(created.schemaVersion,2);assert.equal(created.railSections.length,1);assert.equal(created.iteTracks[0].route.length,3);
  const dm2=new DepotManager();dm2.loadFromSave(dm.toSave());const x=dm2.getITEs()[0];
  assert.equal(x.schemaVersion,2);assert.equal(x.railSections.length,1);assert.equal(x.iteTracks[0].cargoType,'conteneurs');assert.equal(x.iteTracks[0].route[0].wayId,'100');
});

test('Legacy global +ITE editor still reuses Schedule Creator ORM routing; Depot/ITE page is superseded by HOTFIX49 point placement',()=>{
  const src=fs.readFileSync(path.join(root,'js','infrastructure-v2-editor.js'),'utf8');
  assert.match(src,/ScheduleV2Router/);assert.match(src,/chooseTrackCandidates/);assert.match(src,/routeBetweenBindings/);assert.match(src,/Each section is independent|Chaque section est indépendante/);assert.match(src,/＋ Section \/ voie/);
  const ui=fs.readFileSync(path.join(root,'js','ui.js'),'utf8');
  assert.match(ui,/btn-add-depot[^\n]+_ensureDepotITEPointEditor\(\)\.open\('depot'\)/);
  assert.match(ui,/btn-create-ite[^\n]+_ensureInfrastructureV2Editor\(\)\.open\('ite-fret'\)/);
});

test('Travaux V2 editor exposes LTV and bidirectional default',()=>{
  const src=fs.readFileSync(path.join(root,'js','works-v2-editor.js'),'utf8');
  assert.match(src,/LTV — limitation temporaire de vitesse/);
  assert.match(src,/Deux sens \(par défaut\)/);
  assert.match(src,/direction:'both'/);
  assert.match(src,/＋ Section/);
});
