import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeTerrariumRGB, slippyTileForLatLon, terrainGridSize } from '../terrain3d.js';

const root = new URL('../../', import.meta.url);
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');
const terrain = fs.readFileSync(new URL('../terrain3d.js', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');
const coreBundlePath = new URL('../rail-empire.file.bundle.js', import.meta.url);

test('HOTFIX10 decodes Terrarium DEM heights in metres', () => {
  assert.equal(decodeTerrariumRGB(128, 0, 0), 0);
  assert.equal(decodeTerrariumRGB(128, 1, 0), 1);
  assert.equal(decodeTerrariumRGB(127, 255, 0), -1);
  assert.ok(Math.abs(decodeTerrariumRGB(128, 0, 128) - 0.5) < 1e-9);
});

test('HOTFIX10 tile math is stable and grid quality is bounded for low-memory browsers', () => {
  const p = slippyTileForLatLon(48.8584, 2.2945, 12);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(p.x >= 0 && p.x < 4096 && p.y >= 0 && p.y < 4096);
  assert.ok(terrainGridSize(14, 2, 1280) <= 41);
  assert.ok(terrainGridSize(14, 8, 1600) <= 57);
});

test('HOTFIX10 adds a true WebGL terrain canvas but no heavyweight 3D framework', () => {
  assert.match(index, /id="re3d-terrain-canvas"/);
  assert.match(index, /data-re3d-action="relief"/);
  assert.match(renderer, /new TerrainRelief3D/);
  assert.match(terrain, /getContext\('webgl'/);
  assert.match(terrain, /elevation-tiles-prod/);
  assert.match(terrain, /texImage2D\([\s\S]*this\._sourceCanvas/);
  assert.doesNotMatch(terrain + renderer + ui + index, /from\s+['"]three|THREE\.|BABYLON\.|WebGLRenderer/);
});

test('HOTFIX10 drapes the existing Livemap and keeps GPS train markers projected on the DEM surface', () => {
  assert.match(renderer, /terrain3D\.sync\(this\.canvas,\s*!!this\.tileMap\.isDirty\)/);
  assert.match(renderer, /terrain3D\.projectLatLon/);
  assert.match(css, /re3d-relief-active[\s\S]*re3d-terrain-canvas/);
  assert.match(css, /re3d-relief-active \.re3d-train-marker[\s\S]*translate\(-50%,-50%\)/);
});

test('HOTFIX10 follows with a terrain dead-zone instead of rebuilding DEM every frame', () => {
  assert.match(ui, /terrain\.shouldRecenter/);
  assert.match(ui, /terrain\.requestRebuild\(true\)/);
  assert.match(terrain, /Math\.hypot\(dx,dz\) > Math\.max/);
  assert.match(terrain, /now-this\._lastMeshAt>250/);
});

test('HOTFIX10 auto-falls back to HOTFIX9 pseudo-3D when DEM or GPU is unavailable', () => {
  assert.match(terrain, /_emit\('fallback','DEM indisponible'\)/);
  assert.match(terrain, /_emit\('fallback','WebGL indisponible'\)/);
  assert.match(ui, /re3d-relief-fallback/);
  assert.match(ui, /fallback 3D/);
});

test('HOTFIX10 explicitly releases GPU allocations and bounds decoded DEM cache for Opera', () => {
  assert.match(terrain, /gl\.deleteBuffer/);
  assert.match(terrain, /gl\.deleteTexture/);
  assert.match(terrain, /this\.canvas\.width=1/);
  assert.match(terrain, /this\._demMaxTiles = 28/);
  assert.match(terrain, /this\._evictDem\(6\)/);
  assert.match(terrain, /Math\.min\(1\.75, Math\.max\(1\.25, window\.devicePixelRatio/);
});


test('HOTFIX10 hillshades the real DEM mesh and releases linked shader objects', () => {
  assert.match(terrain, /attribute vec3 aNormal/);
  assert.match(terrain, /uSunDir/);
  assert.match(terrain, /const normals=new Float32Array/);
  assert.match(terrain, /this\._normBuf=gl\.createBuffer\(\)/);
  assert.match(terrain, /gl\.deleteShader\(v\)/);
  assert.match(terrain, /gl\.deleteShader\(f\)/);
});

test('HOTFIX10 package identity is isolated from HOTFIX9 cache', () => {
  assert.match(build, /HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(build, /CACHE_VERSION = '1199repair24'/);
  assert.match(index, /style\.css\?v=1199re3d7/);
  assert.match(index, /rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});


test('HOTFIX10 final FILE bundle embeds the DEM terrain engine and current cache identity', () => {
  const coreBundle = fs.readFileSync(coreBundlePath, 'utf8');
  assert.match(coreBundle, /HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(coreBundle, /TerrainRelief3D/);
  assert.match(coreBundle, /elevation-tiles-prod/);
  assert.match(coreBundle, /re3d-terrain-canvas/);
});
