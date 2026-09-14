import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RotationV2Manager } from '../rotation-v2-model.js';

const src = fs.readFileSync(new URL('../rotation-v2-editor.js', import.meta.url), 'utf8');
const model = fs.readFileSync(new URL('../rotation-v2-model.js', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('HOTFIX61 exposes a readable company control dashboard and global rotation search',()=>{
  for(const token of [
    'Lignes exploitables','Services en roulement','Horaires hors roulement','Matériel physique utilisé','Conflits matériels','Contrôle exploitation',
    'Rechercher une ligne, un train, une gare, une loco, un coupon',
    'Tous les statuts','Exploitables','À vérifier / corriger','À corriger','Inactives',
    'Chronologie compagnie'
  ]) assert.ok(src.includes(token), token);
});

test('HOTFIX61 line cards and opened line overview expose the operational information that matters',()=>{
  for(const token of [
    'rv61-linecard','rv61-line-overview','Prochain service','Dépôt(s) d’affectation','Diagnostic prioritaire',
    'Distance','Formation','Actions','Aucune anomalie détectée'
  ]) assert.ok(src.includes(token), token);
});

test('HOTFIX61 service table is explicit about train, route, release time, gap, formation and operations',()=>{
  for(const token of ['Train / départ','Service / conduite','Parcours','Distance / battement','Formation','Opérations','battement']) assert.ok(src.includes(token), token);
});

test('HOTFIX61 keeps historical Roulements vocabulary/flows visible for compatibility',()=>{
  for(const token of ['Toutes les lignes','Diagramme réel','Montage / opérations','Journée matériel','Tableau']) assert.ok(src.includes(token), token);
});

test('HOTFIX61 an enabled empty rotation is a blocking validation error, not falsely exploitable',()=>{
  assert.ok(model.includes("code:'ROTATION_EMPTY'"));
  const mgr=new RotationV2Manager();
  const r=mgr.addRotation({name:'Vide'});
  r.enabled=true;
  const issues=mgr.validateRotation(r.id);
  assert.ok(issues.some(i=>i.code==='ROTATION_EMPTY'&&i.level==='ERROR'));
});

test('HOTFIX61 bundle/cache contract is ready for dep55',()=>{
  assert.ok(build.includes('HOTFIX61-ROULEMENTS-CONTROL-CENTER-READABILITY'));
  assert.ok(build.includes("const CACHE_VERSION = '1199repair24'"));
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
