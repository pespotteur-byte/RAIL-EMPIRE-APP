import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RollingStockItem as RollingStock } from '../rolling-stock.js';

const ui = fs.readFileSync(new URL('../../src/ts/ui.ts', import.meta.url), 'utf8');

test('B04 — SNCF X-series autorail marked electric is normalised to diesel (non-SNCF X untouched)', () => {
  const x73500 = new RollingStock({
    id: 'cat-11536', name: 'X 73500 — A TER (X 73500 / 73900)', category: 'automotrice',
    traction: 'electrique', imageData: 'img/catalog/SNCF/AD/X73500_T2.gif',
    _source: "Trains d'Europe: http://trains-europe.fr/sncf/automoteurs/x73500.htm",
  });
  assert.equal(x73500.traction, 'diesel');
  const sjX2000 = new RollingStock({
    id: 'sj', name: 'X2 — X2000', category: 'automotrice', traction: 'electrique',
    _source: 'SJ', imageData: 'img/catalog/SJ/X2.gif',
  });
  assert.equal(sjX2000.traction, 'electrique');
  const z = new RollingStock({ id: 'z', name: 'Z 26500', category: 'automotrice', traction: 'electrique', _source: 'sncf' });
  assert.equal(z.traction, 'electrique');
});

test('B01 — station creation refuses an exact GPS duplicate on both creation paths', () => {
  assert.match(ui, /_findStationAtSameCoords\(lat: number, lon: number/);
  const calls = ui.match(/const twin = this\._findStationAtSameCoords\(lat, lon\);/g) ?? [];
  assert.equal(calls.length, 2);
});

test('B02 — leaving station creation mode or the map page hides the pick hint', () => {
  assert.match(ui, /this\.stationCreationMode = !this\.stationCreationMode;\n\s*if \(!this\.stationCreationMode\) this\._hidePickHint\(\);/);
  assert.match(ui, /switchPage\(page: string\) \{\n\s*if \(page !== 'map' && this\.stationCreationMode\) this\.toggleStationCreation\(\);\n\s*if \(page !== 'map'\) this\._hidePickHint\(\);/);
});

test('B05 — adding a line stop refreshes the manual-trace button state', () => {
  assert.match(ui, /stationName: station\.name,\n\s*\}\);\n\s*this\.renderLineStops\(\);\n\s*this\._updateLineManualUI\(\);/);
});

test('B06 — ORM route computations in the line editor are time-bounded', () => {
  assert.match(ui, /_boundedOrm<T>\(promise: Promise<T>, timeoutMs = 90000\)/);
  const bounded = ui.match(/this\._boundedOrm(<[^>]*>)?\(/g) ?? [];
  assert.ok(bounded.length >= 3, `expected ≥3 bounded ORM calls, got ${bounded.length}`);
  assert.match(ui, /ORM_TIMEOUT/);
});
