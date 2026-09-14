import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from '../engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.resolve(__dirname, '../main.js'), 'utf8');

test('CLOCK-01: load/start ignore legacy saved gameTime/gameDate', () => {
  assert.match(mainSource, /_loadStateUnchecked\(s\)[\s\S]{0,800}this\.engine\.setGameTime\(null, null\)/);
  assert.match(mainSource, /startGame\(savedState\)[\s\S]{0,500}this\.engine\.setGameTime\(null, null\)/);
  assert.doesNotMatch(mainSource, /setGameTime\(savedState\.gameTime/);
  assert.doesNotMatch(mainSource, /setGameTime\(savedTime, savedDate\)/);
});

test('CLOCK-01: normal autosave no longer persists gameTime/gameDate', () => {
  const start = mainSource.search(/_saveStateNow\s*\(/);
  assert.ok(start >= 0);
  const end = mainSource.indexOf('\n  saveState()', start);
  const block = mainSource.slice(start, end > start ? end : start + 8000);
  assert.doesNotMatch(block, /\bgameTime\s*:/);
  assert.doesNotMatch(block, /\bgameDate\s*:/);
});

test('CLOCK-01: resetting an offset engine returns to real Paris clock', () => {
  const engine = new SimulationEngine();
  engine.setGameTime(12 * 60, '2020-01-01');
  engine.setGameTime(null, null);
  const real = engine._getRealParisTime();
  const actual = engine.getParisTime();
  const realMin = real.hours * 60 + real.minutes;
  const actualMin = actual.hours * 60 + actual.minutes;
  const delta = Math.min(Math.abs(actualMin - realMin), 1440 - Math.abs(actualMin - realMin));
  assert.ok(delta <= 1, `clock delta ${delta} min`);
  assert.equal(engine.getParisDate(), engine._formatDateISO(real.date));
});
