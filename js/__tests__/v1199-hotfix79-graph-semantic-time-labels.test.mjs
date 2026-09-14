import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GraphMarche } from '../graph-marche.js';

test('HOTFIX79 semantic time scale refines 30 -> 10 -> 5 -> 1 minute', () => {
  const g = new GraphMarche();
  assert.equal(g._timeStepForZoom(1), 30);
  assert.equal(g._timeStepForZoom(1.99), 30);
  assert.equal(g._timeStepForZoom(2), 10);
  assert.equal(g._timeStepForZoom(4.99), 10);
  assert.equal(g._timeStepForZoom(5), 5);
  assert.equal(g._timeStepForZoom(23.99), 5);
  assert.equal(g._timeStepForZoom(24), 1);
  assert.equal(g._timeStepForZoom(32), 1);
});

test('HOTFIX79 train label anchor clips a crossing leg to the visible viewport', () => {
  const g = new GraphMarche();
  g.viewZoom = 1;
  g.viewPanX = 0;
  g.viewPanY = 0;
  const seg = g._bestVisibleTrainLabelSegment([
    { x1: -500, y1: 300, x2: 1400, y2: 300 },
  ], 900, 600);
  assert.ok(seg);
  assert.equal(seg.x1, 62);
  assert.equal(seg.x2, 895);
  assert.equal(seg.y1, 300);
  assert.equal(seg.y2, 300);
});

test('HOTFIX79 train label follows the currently visible leg after pan/zoom', () => {
  const g = new GraphMarche();
  g.viewZoom = 4;
  g.viewPanX = -1200;
  g.viewPanY = -700;
  const seg = g._bestVisibleTrainLabelSegment([
    { x1: 50, y1: 50, x2: 100, y2: 100 },      // fully off-screen after camera
    { x1: 250, y1: 200, x2: 500, y2: 300 },    // crosses visible screen
  ], 900, 600);
  assert.ok(seg);
  assert.ok(seg.x1 >= 62 && seg.x1 <= 895);
  assert.ok(seg.x2 >= 62 && seg.x2 <= 895);
  assert.ok(seg.y1 >= 5 && seg.y1 <= 595);
  assert.ok(seg.y2 >= 5 && seg.y2 <= 595);
});

test('HOTFIX79 labels are rendered after camera restore and time ruler is screen-fixed', () => {
  const src = fs.readFileSync(new URL('../graph-marche.js', import.meta.url), 'utf8');
  for (const token of [
    '_timeStepForZoom',
    '_drawScreenTimeScale',
    '_bestVisibleTrainLabelSegment',
    '30→10→5→1 min',
    'ctx.restore();',
    'if (lp) this._drawTrainLabel(ctx, lp.x1, lp.y1, lp.x2, lp.y2, this._serviceDisplayName(m.svc));',
  ]) assert.ok(src.includes(token), token);
  const restore = src.indexOf('ctx.restore();', src.indexOf('  _draw(game)'));
  const overlay = src.indexOf('this._drawScreenTimeScale(ctx, W, H, pad, chartH, timeStep, visibleTimeRange);', restore);
  const label = src.indexOf('if (lp) this._drawTrainLabel(ctx, lp.x1, lp.y1, lp.x2, lp.y2, this._serviceDisplayName(m.svc));', overlay);
  assert.ok(restore >= 0 && overlay > restore && label > overlay);
});
