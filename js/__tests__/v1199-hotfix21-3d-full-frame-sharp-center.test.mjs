import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UI } from '../ui.js';
import { TileMap } from '../map.js';
import { compute3DPlaneGeometry } from '../renderer.js';

const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const terrainSrc=fs.readFileSync(new URL('../terrain3d.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

test('HOTFIX21 camera geographic centre is exactly the followed train',()=>{
  const obj=Object.create(UI.prototype);
  obj._ensure3DServicePosition=(svc)=>svc.position;
  const svc={position:{lat:48.876,lon:2.359}};
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const c=obj._threeDViewCenterForService(svc,heading);
    assert.equal(c.lat,svc.position.lat);
    assert.equal(c.lon,svc.position.lon);
    assert.equal(c.aheadKm,0);
  }
  assert.match(uiSrc,/optical centre of the GPS view/);
});

test('HOTFIX21 selected followed arrow is hard-pinned to viewport centre',()=>{
  assert.match(rendererSrc,/pin the followed arrow in SCREEN SPACE[\s\S]*?p\s*=\s*\{\s*x:\s*this\.viewportWidth \/ 2,\s*y:\s*this\.viewportHeight \/ 2/);
});

test('HOTFIX21 centre invariant survives the current HOTFIX29 low 70° projection',()=>{
  const geom=compute3DPlaneGeometry(1920,1080,10.75);
  assert.equal(geom.pitchDeg,70);
  assert.equal(geom.yComp,1.30);
  assert.equal(geom.planeScale,1.05);
  assert.equal(geom.overscan,1.90);
  assert.ok(geom.width>=Math.hypot(1920,1080)*1.89);
  assert.match(css,/perspective\(var\(--re3d-perspective,1400px\)\)[\s\S]*?rotateX\(var\(--re3d-pitch,70deg\)\)[\s\S]*?scale\(var\(--re3d-plane-scale,1\.05\)\)/);
  assert.match(css,/rotateX\(var\(--re3d-counter-pitch,-70deg\)\)[\s\S]*?scale\(var\(--re3d-billboard-scale,\.9615\)\)/);
  assert.match(rendererSrc,/compute3DPlaneGeometry/);
  assert.match(rendererSrc,/--re3d-billboard-scale/);
});

test('HOTFIX21 entry zoom remains wide while current manual zoom range stays available',()=>{
  assert.match(uiSrc,/this\._threeDReliefEnabled\s*\?\s*10\.75\s*:\s*Math\.max\(11\.0,\s*Math\.min\(12\.5,/);
  assert.match(uiSrc,/Math\.max\(8\.5,\s*Math\.min\(30\.0,/);
});

test('HOTFIX21 TileMap quality API remains functional while current renderer uses bounded GPS quality',()=>{
  const tm=new TileMap();
  tm.zoomLevel=11;
  tm.setRenderQuality(1,1.5);
  assert.equal(tm._effectiveTileZoom(),12);
  assert.equal(tm.sourceZoomBias,1);
  assert.equal(tm.bufferScale,1.5);
  tm.setRenderQuality(0,1);
  assert.equal(tm._effectiveTileZoom(),11);
  assert.equal(tm.bufferScale,1);
  assert.match(fs.readFileSync(new URL('../map.js',import.meta.url),'utf8'),/Supersampled buffer/);
  assert.match(rendererSrc,/const dpr = threeD \? 1\.0 : baseDpr/);
  assert.match(rendererSrc,/setRenderQuality\?\.\(0,\s*1\)/);
});

test('HOTFIX29 sharp rendering is memory-bounded instead of restoring the old oversized buffers',()=>{
  assert.match(rendererSrc,/const dpr = threeD \? 1\.0 : baseDpr/);
  assert.match(rendererSrc,/setRenderQuality\?\.\(0,\s*1\)/);
  assert.match(terrainSrc,/const dpr\s*=\s*Math\.min\(1\.35,\s*Math\.max\(1\.0,\s*window\.devicePixelRatio \|\| 1\)\)/);
  assert.doesNotMatch(rendererSrc,/threeD \? Math\.min\(1\.75/);
});

test('HOTFIX21 true DEM camera targets train origin instead of look-ahead',()=>{
  assert.match(terrainSrc,/const target\s*=\s*\[0,\s*0,\s*0\]/);
  assert.match(terrainSrc,/span\s*\*\s*1\.38/);
  assert.doesNotMatch(terrainSrc,/const target=\[Math\.sin\(bearing\)\*ahead/);
});

test('HOTFIX21 invariants survive in the current cumulative TypeScript build',()=>{
  assert.match(build,/S3-TYPESCRIPT-ALPHA23/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/<script\s+src="js\/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1"><\/script>/);
  assert.match(index,/<link\s+rel="stylesheet"\s+href="style\.css\?v=1199repair24">/);
});
