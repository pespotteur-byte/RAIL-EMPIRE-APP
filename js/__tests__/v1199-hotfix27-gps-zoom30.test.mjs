import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const mapSrc=fs.readFileSync(new URL('../map.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

test('HOTFIX27 exposes ten extra 3D GPS zoom levels',()=>{
  assert.match(uiSrc,/Math\.min\(30\.0, Number\(tm\.zoomLevel \|\| 11\)/);
  const z20=compute3DPlaneGeometry(982,540,20);
  const z30=compute3DPlaneGeometry(982,540,30);
  assert.equal(z30.zoom,30);
  assert.equal(z30.pitchDeg,z20.pitchDeg);
  assert.ok(z30.pitchDeg>=67.9 && z30.pitchDeg<=68.1);
});

test('HOTFIX27 keeps native raster sources clamped while visual camera can reach z30',()=>{
  assert.match(mapSrc,/this\._baseMaxZoom = 20/);
  assert.match(mapSrc,/this\._satelliteMaxZoom = 20/);
  assert.match(mapSrc,/this\._railMaxZoom = 19/);
  assert.match(mapSrc,/viewZ:this\._lastQueueZoom/);
  assert.match(mapSrc,/item\.viewZ !== undefined && item\.viewZ !== curZ/);
  assert.match(mapSrc,/urls === this\.baseTileUrls\) layerZ = Math\.min\(z, this\._baseMaxZoom\)/);
});

test('HOTFIX27 cache/build identity is current',()=>{
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep19/);
  assert.match(build,/HOTFIX27-GPS-ZOOM30/);
  assert.match(build,/CACHE_VERSION = '1199dep19'/);
});
