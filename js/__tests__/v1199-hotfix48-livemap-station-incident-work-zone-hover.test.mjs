import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX48 station hover adds current station incident details',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/_livemapStationIncidents\(station\)/);
  assert.match(ui,/Incident en cours —/);
  assert.match(ui,/Début \$\{this\._livemapClock\(start\)\}/);
  assert.match(ui,/min restantes/);
  assert.match(ui,/incidentHtml = this\._livemapStationIncidentHtml\(station\)/);
});

test('HOTFIX48 draws exact active Works SC route in very dark orange',()=>{
  const renderer=read('js/renderer.js');
  assert.match(renderer,/drawActiveWorksZones\(ctx, world, engine\)/);
  assert.match(renderer,/const color = '#7c2d12'/);
  assert.match(renderer,/item\.route\.length < 2/);
  assert.match(renderer,/drawStroke\('#06101d', underWidth/);
  assert.match(renderer,/_livemapWorkHitZones\.push/);
});

test('HOTFIX48 active work route is hoverable and exposes work information',()=>{
  const renderer=read('js/renderer.js');
  const ui=read('js/ui.js');
  assert.match(renderer,/getActiveWorkZoneAt\(x, y\)/);
  assert.match(ui,/renderer\.getActiveWorkZoneAt\?\.\(x, y\)/);
  assert.match(ui,/Travaux en cours/);
  assert.match(ui,/Aucun impact sur la circulation/);
  assert.match(ui,/LTV \$\{Number\(item\.speedLimit\|\|40\)\} km\/h/);
  assert.match(ui,/Chaque jour/);
});

test('HOTFIX48 FILE cache contains the Livemap hover runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const index=read('index.html');
  assert.match(bundle,/HOTFIX48-LIVEMAP-STATION-INCIDENT-WORK-ZONE-HOVER/);
  assert.match(bundle,/drawActiveWorksZones/);
  assert.match(bundle,/getActiveWorkZoneAt/);
  assert.match(bundle,/Incident en cours/);
  assert.match(index,/1199repair24&fullaudit=1/);
});
