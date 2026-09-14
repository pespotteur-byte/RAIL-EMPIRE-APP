import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TileMap } from '../map.js';

const mapSrc = fs.readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const uiSrc = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');

class FakeImage {
  static instances = [];
  constructor(){ this.onload = null; this.onerror = null; FakeImage.instances.push(this); }
  set src(v){ this._src = v; }
  get src(){ return this._src; }
}

test('HOTFIX73: stale raster callbacks cannot drive loader counters negative after a mode switch', () => {
  const oldImage = globalThis.Image;
  globalThis.Image = FakeImage;
  FakeImage.instances.length = 0;
  try {
    const tm = new TileMap();
    tm.zoomLevel = 8;
    tm._lastRoundedZoom = tm._effectiveTileZoom();
    tm._lastQueueZoom = tm._effectiveTileZoom();
    tm._zoomSettled = true;
    tm.getTile(128, 88, 8, tm.satelliteTileUrls[0]);
    assert.equal(tm._baseLoading, 1);
    const stale = FakeImage.instances.at(-1);
    const oldGeneration = tm._generation;
    tm.setNightMapEnabled(true);
    assert.ok(tm._generation > oldGeneration, 'night switch must invalidate in-flight loaders');
    assert.equal(tm._baseLoading, 0);
    stale.onload?.();
    assert.equal(tm._baseLoading, 0, 'stale callback must not decrement fresh counter below zero');
  } finally {
    globalThis.Image = oldImage;
  }
});

test('HOTFIX73: GPS mode starts from a bounded low-memory raster cache', () => {
  const tm = new TileMap();
  for (let i=0;i<900;i++) tm.tileCache.set(`8/${i}/0/r`, {loaded:true,error:false,img:{}});
  tm._tileCanvas = { width: 2048, height: 2048 };
  assert.equal(tm.setGPSLowMemoryMode(true), true);
  assert.equal(tm._gpsLowMemoryMode, true);
  assert.equal(tm._maxBaseConn, 4);
  assert.equal(tm._maxRailConn, 4);
  assert.equal(tm._tileCacheLimit, 600);
  assert.equal(tm.tileCache.size, 0);
  assert.equal(tm._tileCanvas, null);
});

test('HOTFIX73: cache eviction compares against effective integer tile zoom', () => {
  assert.match(mapSrc, /const currentZ = this\._effectiveTileZoom\(\)/);
  assert.doesNotMatch(mapSrc, /const currentZ = this\.zoomLevel;/);
});

test('HOTFIX73: GPS enter/exit explicitly owns low-memory tile mode', () => {
  assert.match(uiSrc, /setGPSLowMemoryMode\?\.\(true\)/);
  assert.match(uiSrc, /setGPSLowMemoryMode\?\.\(false\)/);
});

test('HOTFIX73: loader has a bounded timeout and clamps active counters', () => {
  assert.match(mapSrc, /this\._gpsLowMemoryMode \? 8000 : 15000/);
  assert.match(mapSrc, /this\._baseLoading = Math\.max\(0, this\._baseLoading - 1\)/);
  assert.match(mapSrc, /this\._railLoading = Math\.max\(0, this\._railLoading - 1\)/);
});

test('HOTFIX73 bundle/cache identity is prepared', () => {
  assert.match(build, /HOTFIX73/);
  assert.match(index, /rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
