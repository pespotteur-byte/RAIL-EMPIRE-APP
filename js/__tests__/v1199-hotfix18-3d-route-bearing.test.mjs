import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Renderer } from '../renderer.js';
import { TerrainRelief3D } from '../terrain3d.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

function svcFor(a,b){
  return {id:'T',_state:{cachedRoute:[a,b],index:0},train:{}};
}

function angularError(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}

test('HOTFIX18 derives geographic camera bearing from the exact active route segment',()=>{
  const r=Object.create(Renderer.prototype);
  const north=r._ormTrainGeoHeading(svcFor({lat:48,lon:2},{lat:48.01,lon:2}));
  const east=r._ormTrainGeoHeading(svcFor({lat:48,lon:2},{lat:48,lon:2.01}));
  assert.ok(angularError(north,0)<1e-3,`north=${north}`);
  assert.ok(angularError(east,Math.PI/2)<1e-3,`east=${east}`);
});

test('HOTFIX18 converts renderer radians to CSS degrees instead of feeding radians as degrees',()=>{
  assert.match(rendererSrc,/const headingDeg = Number\(heading \|\| 0\) \* 180 \/ Math\.PI/);
  assert.match(rendererSrc,/--re3d-heading[^\n]*headingDeg\.toFixed\(1\)/);
});

test('HOTFIX18 CSS fallback rotates map opposite train bearing and counter-rotates billboards',()=>{
  assert.match(css,/rotateZ\(var\(--re3d-map-rotation,0deg\)\)/);
  assert.match(css,/\.re3d-train-marker[\s\S]*rotateZ\(var\(--re3d-camera-counter,0deg\)\)[\s\S]*rotateX\(var\(--re3d-counter-pitch,[^)]+\)\)/);
  assert.match(css,/transform-origin:50% 50%/);
  assert.match(ui,/--re3d-map-rotation/);
  assert.match(ui,/--re3d-camera-counter/);
});

test('HOTFIX18 true DEM camera bearing changes projection without a terrain rebuild',()=>{
  const t=new TerrainRelief3D(null,null);
  t._viewportW=1000;t._viewportH=700;t._halfWidthKm=10;t._halfHeightKm=8;
  t._computeMvp();
  const before=Array.from(t._mvp);
  t.setBearing(Math.PI/2);
  const after=Array.from(t._mvp);
  assert.ok(angularError(t.bearingRad,Math.PI/2)<1e-9);
  assert.notDeepEqual(after,before);
  assert.equal(t._rebuildPending,false);
});

test('HOTFIX18 camera interpolation is shortest-path and updates both CSS and DEM bearing',()=>{
  assert.match(ui,/_sync3DCameraHeading\(svc, force = false\)/);
  assert.match(ui,/Math\.atan2\(Math\.sin\(target - heading\), Math\.cos\(target - heading\)\)/);
  assert.match(ui,/terrain3D\?\.setBearing\?\.\(heading\)/);
  assert.match(ui,/this\._sync3DCameraHeading\(svc\)/);
});

test('HOTFIX18 route-bearing functionality survives the current TypeScript bundle',()=>{
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  assert.match(build,/S3-TYPESCRIPT-ALPHA23/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(index,/style\.css\?v=1199repair24/);
  assert.match(bundle,/bearingRad/);
  assert.match(bundle,/setBearing/);
});
