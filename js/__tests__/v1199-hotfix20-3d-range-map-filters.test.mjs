import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UI } from '../ui.js';

const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

test('HOTFIX20 range controls remain present with the current extended 3D zoom range',()=>{
  assert.match(uiSrc,/Math\.max\(8\.5,\s*Math\.min\(30\.0,/);
});

test('HOTFIX20 keeps normal map display filters visible in 3D',()=>{
  assert.match(css,/#main-area\.re3d-active \.map-toggles \{[\s\S]*display:flex !important/);
  assert.match(css,/content:"Affichage carte"/);
  const hideRule=css.match(/#main-area\.re3d-active \.map-controls,[\s\S]*?display:none !important; \}/)?.[0] || '';
  assert.ok(hideRule);
  assert.doesNotMatch(hideRule,/\.map-toggles/);
});

test('HOTFIX20 Trains checkbox also hides 3D DOM arrows',()=>{
  assert.match(rendererSrc,/if \(showTrains\)\s*this\.drawServices\(ctx, world, services\);/);
  assert.match(rendererSrc,/else if \(window\.game\?\.ui\?\._threeDFollowActive && this\._re3dMarkerNodes\?\.size\)\s*this\.clear3DMarkers\(\);/);
  assert.doesNotMatch(rendererSrc,/showTrains \|\| window\.game\?\.ui\?\._threeDFollowActive/);
});

test('HOTFIX20 behavior remains in the current cumulative TypeScript build',()=>{
  assert.match(build,/S3-TYPESCRIPT-ALPHA23/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/<script\s+src="js\/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1"><\/script>/);
  assert.match(index,/<link\s+rel="stylesheet"\s+href="style\.css\?v=1199repair24">/);
});
