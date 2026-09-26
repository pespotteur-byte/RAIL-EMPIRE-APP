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

test('B04b — placeholder power (< 10 kW) on motor units is replaced by a real value', () => {
  const mk = (name, category = 'automotrice') => new RollingStock({ id: name, name, category, traction: 'diesel', power: 2 });
  assert.equal(mk('X 73500 — A TER').power, 514);
  assert.equal(mk('X 73900 Sarre — TER').power, 630);
  assert.equal(mk('Z 6400 — Transilien').power, 1180);
  assert.equal(mk("RRR Remorque d'extrémité — TER").power, 0);
  assert.equal(mk('CC 65000 — Diesel', 'locomotive').power, 1000);
  assert.equal(new RollingStock({ id: 'y', name: 'Y 2100', category: 'locomotive', power: 45 }).power, 45);
});

test('B07 — the rAF game loop is re-armed after an in-game save import suspended it', () => {
  const main = fs.readFileSync(new URL('../../src/ts/main.ts', import.meta.url), 'utf8');
  assert.match(main, /if \(!this\.running\) \{ this\._gameLoopScheduled = false; return; \}/);
  assert.match(main, /this\.running = wasRunning; this\.engine\.paused = wasPaused; this\._importing = false;\n\s*this\._ensureGameLoop\(\);/);
});

test('B03 — map controls/toggles live in a wrapping HUD that never overflows the map', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  assert.match(html, /<div class="map-hud">\s*<div class="map-controls">/);
  assert.match(css, /\.map-hud \{[^}]*right: 0;[^}]*flex-direction: column/);
  assert.match(css, /\.map-controls \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /\.map-toggles \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /#main-area\.re3d-active \.map-hud \{ display:contents; \}/);
});
