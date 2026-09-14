import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Renderer, compute3DPlaneGeometry } from '../renderer.js';
import { TerrainRelief3D } from '../terrain3d.js';

const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');

function angularError(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}
function svcFor(a,b){return {id:'T',_state:{cachedRoute:[a,b],index:0},train:{}};}

test('S3 Alpha23 current 3D contract keeps exact railway bearing and dynamic counter-rotation',()=>{
  const r=Object.create(Renderer.prototype);
  const north=r._ormTrainGeoHeading(svcFor({lat:48,lon:2},{lat:48.01,lon:2}));
  const east=r._ormTrainGeoHeading(svcFor({lat:48,lon:2},{lat:48,lon:2.01}));
  assert.ok(angularError(north,0)<1e-3);
  assert.ok(angularError(east,Math.PI/2)<1e-3);
  assert.match(rendererSrc,/--re3d-pitch[^\n]*geom\.pitchDeg/);
  assert.match(rendererSrc,/--re3d-counter-pitch[^\n]*-geom\.pitchDeg/);
  assert.match(css,/rotateZ\(var\(--re3d-camera-counter,0deg\)\)/);
  assert.match(css,/rotateX\(var\(--re3d-counter-pitch,[^)]+\)\)/);
});

test('S3 Alpha23 current 3D contract is the accepted HOTFIX29 70-degree camera with zoom 30',()=>{
  for(const zoom of [8.5,11,20,25,30]){
    const g=compute3DPlaneGeometry(982,540,zoom);
    assert.equal(g.pitchDeg,70);
    assert.equal(g.yComp,1.3);
    assert.equal(g.overscan,1.9);
  }
  assert.match(uiSrc,/Math\.min\(30\.0/);
  assert.match(uiSrc,/_set3DMapPan/);
  assert.match(css,/translate3d\(var\(--re3d-pan-x,0px\),var\(--re3d-pan-y,0px\),0\)/);
});

test('S3 Alpha23 current 3D contract keeps normal Livemap display filters authoritative',()=>{
  assert.match(css,/#main-area\.re3d-active \.map-toggles \{[\s\S]*?display:flex !important/);
  assert.match(css,/content:"Affichage carte"/);
  const hideRule=css.match(/#main-area\.re3d-active \.map-controls,[\s\S]*?display:none !important; \}/)?.[0] || '';
  assert.ok(hideRule);
  assert.doesNotMatch(hideRule,/\.map-toggles/);
  assert.match(rendererSrc,/if\s*\(showTrains\)\s*this\.drawServices\(ctx, world, services\)/);
  assert.match(rendererSrc,/else if\s*\(window\.game\?\.ui\?\._threeDFollowActive[\s\S]*?clear3DMarkers\(\)/);
});

test('S3 Alpha23 followed train stays pinned in an untransformed screen-space layer',()=>{
  assert.match(index,/id="re3d-follow-marker-plane" class="re3d-follow-marker-plane"/);
  assert.match(css,/\.re3d-follow-marker-plane \{[\s\S]*?position:absolute; inset:0;[\s\S]*?pointer-events:none/);
  const screenLayerBlock=css.match(/\.re3d-follow-marker-plane \{[^}]*\}/)?.[0] || '';
  assert.ok(screenLayerBlock);
  assert.doesNotMatch(screenLayerBlock,/transform|rotateX|perspective/);
  assert.match(rendererSrc,/isPinnedFollow[\s\S]*?p\s*=\s*\{\s*x\s*:\s*this\.viewportWidth\s*\/\s*2\s*,\s*y\s*:\s*this\.viewportHeight\s*\/\s*2/);
  assert.doesNotMatch(rendererSrc,/p\s*=\s*\{\s*x\s*:\s*this\.logicalWidth\s*\/\s*2\s*,\s*y\s*:\s*this\.logicalHeight\s*\/\s*2/);
  assert.match(rendererSrc,/const\s+targetLayer\s*=\s*isPinnedFollow\s*\?\s*followLayer\s*:\s*layer/);
});

test('S3 Alpha23 current 3D follow remains presentation-only and cleans itself up',()=>{
  assert.match(uiSrc,/_threeDFollowActive\s*=\s*false/);
  assert.match(uiSrc,/if\s*\(page !== 'map' && this\._threeDFollowActive\)\s*this\.disable3DFollow\(\)/);
  assert.match(uiSrc,/if\s*\(this\._threeDFollowActive\)\s*this\.disable3DFollow\(\)/);
  assert.match(uiSrc,/_sync3DCameraHeading\(svc/);
  assert.match(uiSrc,/Math\.atan2\(Math\.sin\(target - heading\), Math\.cos\(target - heading\)\)/);
});

test('S3 Alpha23 DEM bearing changes projection without rebuilding terrain',()=>{
  const t=new TerrainRelief3D(null,null);
  t._viewportW=1000;t._viewportH=700;t._halfWidthKm=10;t._halfHeightKm=8;
  t._computeMvp();
  const before=Array.from(t._mvp);
  t.setBearing(Math.PI/2);
  assert.ok(angularError(t.bearingRad,Math.PI/2)<1e-9);
  assert.notDeepEqual(Array.from(t._mvp),before);
  assert.equal(t._rebuildPending,false);
});

test('S3 Alpha23 3D bundle/cache identity is current and no heavyweight 3D framework is introduced',()=>{
  assert.match(build,/S3-TYPESCRIPT-ALPHA23/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(index,/style\.css\?v=1199repair24/);
  assert.match(bundle,/bearingRad/);
  assert.match(bundle,/setBearing/);
  assert.doesNotMatch(bundle,/from ['"]three['"]|from ['"]babylon|THREE\.Scene|BABYLON\.Engine/);
});
