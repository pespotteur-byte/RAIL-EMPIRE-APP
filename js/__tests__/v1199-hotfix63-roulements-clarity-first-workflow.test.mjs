import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');

test('HOTFIX63 default Roulements UI is a four-step clarity-first workflow',()=>{
  for(const token of ['HOTFIX63-ROULEMENTS-CLARITY-FIRST-WORKFLOW','Services du roulement','Matériel affecté','Opérations particulières','Validation','Outils avancés']) assert.ok(src.includes(token),token);
  assert.ok(src.includes('1</strong> Services'));
  assert.ok(src.includes('2</strong> Matériel'));
  assert.ok(src.includes('3</strong> Opérations'));
  assert.ok(src.includes('4</strong> Validation'));
});

test('HOTFIX63 fleet landing page is deliberately simple and searchable',()=>{
  for(const token of ['Nouveau roulement','Rechercher un roulement, un train, une gare ou du matériel','Tous les roulements','Aucun roulement à afficher']) assert.ok(src.includes(token),token);
  assert.ok(src.includes('_renderRv63Fleet'));
});

test('HOTFIX63 selecting a line opens the simple line workflow, not the advanced sheet',()=>{
  assert.match(src,/if\(a==='select-line'\).*this\.activeView='line'/s);
  assert.match(src,/if\(this\.activeView==='line'\).*_renderRv63Line/s);
});

test('HOTFIX63 service rows expose only the essentials until the player selects one',()=>{
  for(const token of ['rv63-service-detail','Matériel spécifique','+ Opération','↑ Monter','↓ Descendre']) assert.ok(src.includes(token),token);
  assert.ok(src.includes("selected?this._renderRv63ServiceDetails(rot,o):''"));
});

test('HOTFIX63 keeps calendar and activation controls in the simple line header',()=>{
  assert.ok(src.includes('Calendrier : selon les horaires'));
  assert.ok(src.includes('data-rv2="toggle-rotation"'));
  assert.ok(src.includes('Désactiver'));
  assert.ok(src.includes('Activer'));
});

test('HOTFIX63 advanced legacy tools remain available without cluttering the default view',()=>{
  for(const token of ['Feuille graphique','Journée matériel','Tableau technique','Montage avancé','← Retour au roulement']) assert.ok(src.includes(token),token);
});

test('HOTFIX63 uses readable default type sizes and single-column sections',()=>{
  assert.ok(src.includes('.rv63-titleblock h1{margin:0;font-size:28px'));
  assert.ok(src.includes('.rv63-section-title h2{font-size:17px'));
  assert.ok(src.includes('.rv63-service-train b{font-size:15px'));
  assert.ok(src.includes('.rv63-section{background:#0b1724'));
});

test('HOTFIX63 bundle/cache contract is dep57',()=>{
  assert.ok(build.includes('HOTFIX63-ROULEMENTS-CLARITY-FIRST-WORKFLOW'));
  assert.ok(build.includes("const CACHE_VERSION = '1199repair24'"));
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
