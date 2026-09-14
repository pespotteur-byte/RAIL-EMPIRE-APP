import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../schedule-v2-editor.js', import.meta.url), 'utf8');

test('SC Future hides station labels below LiveMap-style zoom threshold', () => {
  assert.match(source, /SC_STATION_LABEL_MIN_ZOOM\s*=\s*10\.5/);
  assert.match(source, /const\s+showNames\s*=\s*zoom\s*>=\s*SC_STATION_LABEL_MIN_ZOOM/);
  assert.doesNotMatch(source, /showNames\s*=\s*zoom\s*>=\s*8\.5/);
});

test('SC Future thins regional station labels in screen space and restores all at exact zoom', () => {
  assert.match(source, /SC_STATION_LABEL_ALL_ZOOM\s*=\s*13\.5/);
  assert.match(source, /labelOccupied\s*=\s*showNames\s*&&\s*zoom\s*<\s*SC_STATION_LABEL_ALL_ZOOM\s*\?\s*new Set\(\)\s*:\s*null/);
  assert.match(source, /Math\.floor\(\s*p\.x\s*\/\s*labelCellW\s*\).*Math\.floor\(\s*p\.y\s*\/\s*labelCellH\s*\)/s);
});

test('station markers remain independent from station-name visibility', () => {
  const start = source.indexOf('_drawStations(ctx, w, h)');
  const end = source.indexOf('_drawRoute(ctx, route, color, alpha = 1)', start);
  assert.ok(start >= 0 && end > start, 'station drawing block must remain present');
  const block = source.slice(start, end);
  assert.match(block, /ctx\.arc\(\s*p\.x\s*,\s*p\.y\s*,\s*3\.5\s*,\s*0\s*,\s*Math\.PI\s*\*\s*2\s*\)\s*;\s*ctx\.fill\(\)\s*;\s*ctx\.stroke\(\)/);
  assert.match(block, /if\s*\(\s*showNames\s*\)/);
});
