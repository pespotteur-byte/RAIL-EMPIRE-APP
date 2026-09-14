import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

test('HOTFIX23 followed arrow has a dedicated untransformed screen-space layer',()=>{
  assert.match(index,/id="re3d-follow-marker-plane" class="re3d-follow-marker-plane"/);
  assert.match(css,/\.re3d-follow-marker-plane \{[\s\S]*?position:absolute; inset:0;[\s\S]*?pointer-events:none/);
  assert.match(css,/#main-area\.re3d-active \.re3d-follow-marker-plane \{ display:block; \}/);
  const screenLayerBlock=css.match(/\.re3d-follow-marker-plane \{[^}]*\}/)?.[0] || '';
  assert.ok(screenLayerBlock);
  assert.doesNotMatch(screenLayerBlock,/transform|rotateX|perspective/);
});

test('HOTFIX23 followed arrow uses visible viewport centre, not overscan logical centre',()=>{
  assert.match(rendererSrc,/this\.viewportWidth = Math\.max\(1, Number\(rect\.width\)/);
  assert.match(rendererSrc,/this\.viewportHeight = Math\.max\(1, Number\(rect\.height\)/);
  assert.match(rendererSrc,/isPinnedFollow[\s\S]*?p = \{ x:this\.viewportWidth \/ 2, y:this\.viewportHeight \/ 2/);
  assert.doesNotMatch(rendererSrc,/p = \{ x:this\.logicalWidth \/ 2, y:this\.logicalHeight \/ 2/);
});

test('HOTFIX23 selected marker is moved between screen layer and map plane safely',()=>{
  assert.match(rendererSrc,/const targetLayer = isPinnedFollow \? followLayer : layer/);
  assert.match(rendererSrc,/if \(rec\.root\.parentElement !== targetLayer\) targetLayer\.appendChild\(rec\.root\)/);
  assert.match(rendererSrc,/followLayer\.textContent = ''/);
});

test('HOTFIX23 cache/build identities are bumped',()=>{
  assert.match(build,/HOTFIX23-SCREEN-CENTERED-FOLLOW-ARROW/);
  assert.match(build,/CACHE_VERSION = '1199dep15'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep15/);
  assert.match(index,/style\.css\?v=1199re3d8/);
});
