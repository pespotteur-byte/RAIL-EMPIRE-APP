import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GraphMarche } from '../graph-marche.js';

test('HOTFIX77 graph camera is bounded from 1x to 32x without growing the canvas', () => {
  const g = new GraphMarche();
  assert.equal(g._viewMinZoom, 1);
  assert.equal(g._viewMaxZoom, 32);
  g.viewZoom = 80; g.viewPanX = -99999; g.viewPanY = 99999;
  g._clampGraphView(900, 600);
  assert.equal(g.viewZoom, 32);
  assert.equal(g.viewPanX, -27900);
  assert.equal(g.viewPanY, 0);
});

test('HOTFIX77 graph camera returns to origin at 1x', () => {
  const g = new GraphMarche();
  g.viewZoom = 1; g.viewPanX = -400; g.viewPanY = -200;
  g._clampGraphView(900, 600);
  assert.equal(g.viewPanX, 0);
  assert.equal(g.viewPanY, 0);
});

test('HOTFIX77 train display label prefers the service name', () => {
  const g = new GraphMarche();
  assert.equal(g._serviceDisplayName({name:'EYAN 02', number:'17801'}), 'EYAN 02');
  assert.equal(g._serviceDisplayName({name:'', number:'17801'}), 'Train 17801');
});

test('HOTFIX77 graph UI exposes zoom controls, keyboard pan and rotated labels', () => {
  const src = fs.readFileSync(new URL('../graph-marche.js', import.meta.url), 'utf8');
  for (const token of ['gm-zoom-in','gm-zoom-out','gm-zoom-max','×32','gm-viewport','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ctx.rotate(angle)','Molette : zoom']) {
    assert.ok(src.includes(token), token);
  }
  assert.match(src, /ctx\.scale\(this\.viewZoom, this\.viewZoom\)/);
  assert.match(src, /_drawTrainLabel\(ctx, lp\.x1, lp\.y1, lp\.x2, lp\.y2, this\._serviceDisplayName\(m\.svc\)\)/);
});
