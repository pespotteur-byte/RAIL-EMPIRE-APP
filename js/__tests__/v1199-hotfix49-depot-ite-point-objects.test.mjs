import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DepotManager } from '../depot.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX49 Depot/ITE page uses a point-object placer, not rail-section routing',()=>{
  const ui=read('js/ui.js');
  const point=read('js/depot-ite-point-editor.js');
  assert.match(ui,/btn-add-depot[^\n]+_ensureDepotITEPointEditor\(\)\.open\('depot'\)/);
  assert.match(point,/point-object placer|point-object/);
  assert.doesNotMatch(point,/ScheduleV2Router|routeBetweenBindings|chooseTrackCandidates/);
  assert.doesNotMatch(point,/add-section|Section \/ voie|Dernier VIA|Point A — voie exacte/);
  assert.match(point,/this\.location=\{lat:Number\(p\.lat\),lon:Number\(p\.lon\)\}/);
  assert.match(point,/placementOnly:true/);
  assert.match(point,/railSections:\[\]/);
  assert.doesNotMatch(point,/world\.addStation/);
});

test('HOTFIX49 global map +ITE action remains on the legacy ORM editor',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/btn-create-ite[^\n]+_ensureInfrastructureV2Editor\(\)\.open\('ite-fret'\)/);
});

test('HOTFIX49 placement-only Depot/ITE objects persist exact map coordinates without fake rail geometry',()=>{
  const dm=new DepotManager();
  const d=dm.add({type:'depot',name:'Dijon dépôt',stationId:'DIJON',tracks:4,cost:0,placementOnly:true,location:{lat:47.31,lon:5.03},railSections:[]},null);
  const i=dm.add({type:'ite-fret',name:'Dijon ITE',stationId:'DIJON',tracks:2,cost:0,placementOnly:true,location:{lat:47.30,lon:5.04},railSections:[],iteTracks:[],iteCargoTypes:['conteneurs']},null);
  assert.equal(d.placementOnly,true);assert.deepEqual(d.location,{lat:47.31,lon:5.03});assert.equal(d.railSections.length,0);
  assert.equal(i.placementOnly,true);assert.equal(i.iteTracks.length,0);
  const info=dm.getITEInfo('DIJON',900,'conteneurs');assert.equal(info.usable,true);assert.equal(info.canFit,true);assert.equal(info.totalLength,Infinity);
  const dm2=new DepotManager();dm2.loadFromSave(dm.toSave());
  assert.equal(dm2.getDepotById(d.id).placementOnly,true);assert.deepEqual(dm2.getDepotById(d.id).location,{lat:47.31,lon:5.03});
});

test('HOTFIX49 renderer uses exact object location and distinct Depot/ITE pictograms',()=>{
  const renderer=read('js/renderer.js');
  assert.match(renderer,/depot\.location[^\n]+\? depot\.location : station/);
  assert.match(renderer,/#7c3aed/);
  assert.match(renderer,/#0891b2/);
  assert.match(renderer,/String\(type \|\| ''\)\.startsWith\('ite'\)/);
});

test('HOTFIX49 point objects remain page-managed without requiring ORM access',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/d\.location\?Number\(d\.location\.lat\)/);
  assert.match(ui,/Rattachement technique|rattachement technique/i);
  assert.doesNotMatch(ui,/ScheduleV2Router.*renderDepotsList/s);
});
