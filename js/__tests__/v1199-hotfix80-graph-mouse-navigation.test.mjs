import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../graph-marche.js', import.meta.url), 'utf8');

test('HOTFIX80 wheel zoom does not require Ctrl and keeps pointer focal zoom', () => {
  assert.match(src, /viewport\.addEventListener\('wheel'/);
  assert.doesNotMatch(src, /if \(!e\.ctrlKey\) return;/);
  assert.match(src, /e\.preventDefault\(\)/);
  assert.match(src, /const x = e\.clientX - rect\.left/);
  assert.match(src, /const y = e\.clientY - rect\.top/);
  assert.match(src, /this\._setGraphZoom\(game,[\s\S]*x, y\)/);
});

test('HOTFIX80 left pointer drag pans with pointer capture', () => {
  assert.match(src, /if \(e\.button !== 0\) return;/);
  assert.match(src, /viewport\.setPointerCapture\?\.\(e\.pointerId\)/);
  assert.match(src, /viewport\.addEventListener\('pointermove'/);
  assert.match(src, /this\._panGraph\(game, dx, dy\)/);
  assert.match(src, /viewport\.addEventListener\('pointerup', stopDrag\)/);
  assert.match(src, /viewport\.addEventListener\('pointercancel', stopDrag\)/);
  assert.match(src, /cursor:grab/);
  assert.match(src, /viewport\.style\.cursor = 'grabbing'/);
});

test('HOTFIX80 retains semantic minute scale and persistent train labels', () => {
  assert.match(src, /if \(z >= 24\) return 1;/);
  assert.match(src, /if \(z >= 5\) return 5;/);
  assert.match(src, /if \(z >= 2\) return 10;/);
  assert.match(src, /return 30;/);
  assert.match(src, /_bestVisibleTrainLabelSegment/);
});
