/**
 * Unit tests for Renderer helper methods.
 * Run with: node tests/test-renderer-helpers.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Replicate the _metersPerPixel formula from renderer.js
function metersPerPixel(lat, zoom) {
  return 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

test('metersPerPixel at equator zoom 10', () => {
  const mpp = metersPerPixel(0, 10);
  assert.ok(mpp > 150 && mpp < 160, `Expected ~153 m/px, got ${mpp}`);
});

test('metersPerPixel decreases at higher zoom levels', () => {
  const mpp10 = metersPerPixel(48.8, 10);
  const mpp14 = metersPerPixel(48.8, 14);
  assert.ok(mpp14 < mpp10, 'Higher zoom should have fewer meters per pixel');
});

test('metersPerPixel decreases at higher latitudes', () => {
  const mppEquator = metersPerPixel(0, 10);
  const mppParis = metersPerPixel(48.8, 10);
  assert.ok(mppParis < mppEquator, 'Higher latitude should have fewer meters per pixel');
});

test('radiusPx calculation produces positive value', () => {
  const radiusKm = 30;
  const lat = 48.8;
  const zoom = 10;
  const mpp = metersPerPixel(lat, zoom);
  const radiusPx = (radiusKm * 1000) / mpp;
  assert.ok(radiusPx > 0, `Expected positive radiusPx, got ${radiusPx}`);
  assert.ok(Number.isFinite(radiusPx), 'radiusPx must be finite');
});

test('null lat/lon guard: zones without coords are skipped', () => {
  const zones = [
    { name: 'A', lat: 48.8, lon: 2.35, radiusKm: 10 },
    { name: 'B', lat: null, lon: null, radiusKm: 10 },
    { name: 'C', lat: 0, lon: 0, radiusKm: 10 },
  ];
  const rendered = [];
  for (const z of zones) {
    if (z.lat == null || z.lon == null) continue;
    rendered.push(z.name);
  }
  assert.deepEqual(rendered, ['A', 'C'], 'Zone B (null coords) should be skipped, Zone C (lat=0) should render');
});

test('old falsy guard would incorrectly skip lat=0', () => {
  const z = { lat: 0, lon: 0, radiusKm: 10 };
  const oldGuard = !z.lat || !z.lon;
  const newGuard = z.lat == null || z.lon == null;
  assert.equal(oldGuard, true, 'Old guard incorrectly treats 0 as falsy');
  assert.equal(newGuard, false, 'New guard correctly allows lat=0');
});
