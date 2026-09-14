import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js?v=1199hf32final';

const read=(rel)=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');

test('HOTFIX32 final FILE bundle/cache carries the player-exact rolling-duty system',()=>{
  const index=read('../../index.html');
  const build=read('../../scripts/build-file-bundle-v1199.cjs');
  const bundle=read('../rail-empire.file.bundle.js');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24/);
  // The rolling-duty contract is verified from the built bundle below; do not pin this
  // historical regression test to a finite list of later HOTFIX flavor names.
  assert.match(build,/const BUNDLE_VERSION = '1\.1\.99'/);
  assert.match(build,/CACHE_VERSION = '1199repair24'/);
  for(const token of [
    'Lignes de roulement','Toutes les lignes','Diagramme réel','Formation affectée à la ligne',
    'Journée matériel','Même schéma graphique que le roulement','HORS ROULEMENT',
    'Mode simple — affecter une rame','PRÊT · MODE SIMPLE','rotationsRequired','Personnel est facultatif'
  ]) assert.ok(bundle.includes(token),token);
  assert.ok(!bundle.includes('Les Roulements sont <b>facultatifs</b>'));
  assert.ok(!bundle.includes('utiliser en horaire direct ou en Roulement'));
});

test('HOTFIX32 preserves the accepted HOTFIX29 70-degree GPS camera and zoom 30',()=>{
  const ui=read('../ui.js');
  const css=read('../../style.css');
  const g=compute3DPlaneGeometry(982,540,30);
  assert.equal(g.pitchDeg,70);
  assert.equal(g.yComp,1.3);
  assert.equal(g.overscan,1.9);
  assert.match(ui,/Math\.min\(30\.0/);
  assert.match(ui,/_set3DMapPan/);
  assert.match(css,/translate3d\(var\(--re3d-pan-x,0px\),var\(--re3d-pan-y,0px\),0\)/);
});

test('HOTFIX32 preserves HOTFIX31 resilient French SIV recovery',()=>{
  const bundle=read('../rail-empire.file.bundle.js');
  for(const token of ['allowLanguageFallback','FR_LANG_FALLBACK','speechSynthesis?.resume',"Ce train a pour destination","Il s'arrêtera en gare de"])
    assert.ok(bundle.includes(token),token);
  assert.match(bundle,/failed local WAV\/M4A must never silence the whole SIV|failed local WAV\/M4A/);
});
