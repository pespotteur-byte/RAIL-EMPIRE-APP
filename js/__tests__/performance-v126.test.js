import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync(new URL('../schedule-v2-editor.js', import.meta.url), 'utf8');
const orm = fs.readFileSync(new URL('../orm.js', import.meta.url), 'utf8');

test('V1.1.26 Schedule V2 redraw is event/dirty driven, not forced every 500ms', () => {
  assert.ok(editor.includes('if(this.tileMap.isDirty)this.draw()'));
  assert.ok(!editor.includes('Date.now()-this._lastRenderAt>500'));
  assert.ok(editor.includes("if(zoom<7)"));
  assert.ok(editor.includes('ctx.fillRect(p.x-dot/2,p.y-dot/2,dot,dot)'));
});

test('V1.1.32 cursor routing resolves the complete anchor chain globally on real rail', () => {
  const start = orm.indexOf('async findRouteViaCursorAnchors');
  const end = orm.indexOf('  _parseStations', start);
  const block = orm.slice(start, end);
  assert.ok(block.includes('_routeCursorAnchorChainOnWays'));
  assert.ok(block.includes('_cursorSegmentCandidates'));
  assert.ok(block.includes('_buildGraphFromWaysAsync'));
  assert.ok(block.includes('_findCursorLegBroadArea'));
  assert.ok(block.includes('allowFallback:false'));
  assert.ok(block.includes('_resolvedAnchors'));
  // Loaded real OSM ways are attempted before any network expansion; if the
  // globally connected chain cannot be found, broader real-rail data is fetched.
  assert.ok(block.indexOf('_routeCursorAnchorChainOnWays') < block.indexOf('_findCursorLegBroadArea'));
  assert.ok(!block.includes('makeFallbackRoute'));
});

test('V1.1.86 cursor routing uses bounded hedged Overpass requests without serial endpoint stacking', () => {
  assert.ok(orm.includes('timeoutMs:4800') || orm.includes('timeoutMs:4500') || orm.includes('timeoutMs:4200'));
  assert.ok(orm.includes('maxEndpoints:2'));
  assert.ok(orm.includes('raceEndpoints:2'));
  assert.ok(orm.includes('attemptsPerEndpoint:1'));
  assert.ok(orm.includes('allowPartial:true'));
  assert.ok(orm.includes('maxSplitDepth:1'));
});
