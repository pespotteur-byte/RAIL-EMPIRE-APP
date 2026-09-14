import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TileMap } from '../map.js';

const map = fs.readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');

test('HOTFIX71: GPS night mode uses NASA VIIRS Black Marble satellite imagery', () => {
  const tm = new TileMap();
  assert.equal(tm._nightSatelliteMaxZoom, 8);
  assert.equal(tm.nightSatelliteTileUrls.length, 1);
  assert.match(tm.nightSatelliteTileUrls[0], /gibs\.earthdata\.nasa\.gov/);
  assert.match(tm.nightSatelliteTileUrls[0], /VIIRS_Black_Marble/);
  assert.match(tm.nightSatelliteTileUrls[0], /GoogleMapsCompatible_Level8\/\{z\}\/\{y\}\/\{x\}\.png/);
});

test('HOTFIX71: night view keeps high-resolution satellite detail and composites true night imagery above it', () => {
  assert.match(map, /const baseUrls = this\.satelliteEnabled[\s\S]{0,120}this\.satelliteTileUrls/);
  assert.match(map, /if \(lightsOpacity > 0\)\s+layers\.push\(this\.nightSatelliteTileUrls\)/);
  assert.match(map, /isNightSatelliteLayer[\s\S]{0,2000}globalAlpha = lightsOpacity/);
  assert.doesNotMatch(map, /globalCompositeOperation = 'screen'/);
  assert.match(map, /isNightSatelliteLayer[\s\S]{0,2400}_nightSatelliteMaxZoom/);
  // RC9 centralizes source-aware cache keys; verify the actual night-layer key.
  const tiles = new TileMap();
  try {
    tiles._zoomSettled = false;
    const night = tiles.getTile(128, 88, 8, tiles.nightSatelliteTileUrls[0]);
    const day = tiles.getTile(128, 88, 8, tiles.satelliteTileUrls[0]);
    assert.notEqual(night, day);
    assert.match(night.cacheKey, /\/n$/);
    assert.match(day.cacheKey, /\/s$/);
  } finally { tiles.dispose(); }
  assert.doesNotMatch(map, /this\.nightMapEnabled[\s\S]{0,100}\? this\._osmBaseTileUrls/);
});

test('HOTFIX71: night attribution identifies Esri detail + NASA VIIRS imagery', () => {
  assert.match(renderer, /getMapCreditText/);
  const tm = new TileMap();
  try {
    tm.zoomLevel=8;tm.satelliteEnabled=true;tm.nightMapEnabled=true;
    assert.match(tm.getMapCreditText(), /Esri World Imagery · NASA GIBS \/ VIIRS Black Marble · OpenRailwayMap/);
    tm.zoomLevel=16;assert.doesNotMatch(tm.getMapCreditText(), /NASA/);
  } finally {tm.dispose();}
});

test('HOTFIX71: FILE bundle identity is bumped for true night satellite composite', () => {
  assert.match(build, /HOTFIX71-GPS-TRUE-NIGHT-SATELLITE/);
  assert.match(build, /CACHE_VERSION = '1199repair24'/);
  assert.match(index, /rail-empire\.file\.bundle\.js\?v=1199repair24/);
});
