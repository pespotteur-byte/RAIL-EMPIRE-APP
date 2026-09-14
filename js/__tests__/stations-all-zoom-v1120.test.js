import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../renderer.js';

function makeCtx() {
  const calls = { fillRect: 0, arc: 0, fillText: 0 };
  return {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    arc() { calls.arc++; },
    fillRect() { calls.fillRect++; },
    fillText() { calls.fillText++; },
  };
}

function makeRenderer(zoom) {
  const r = Object.create(Renderer.prototype);
  r.tileMap = {
    zoomLevel: zoom,
    screenToWorld() { throw new Error('spatial viewport query must not run below zoom 7'); },
  };
  r.logicalWidth = 1200;
  r.logicalHeight = 800;
  r.latLonToScreen = () => ({ x: 600, y: 400 });
  return r;
}

test('v1.1.20: every gameplay station is drawn even at minimum zoom, with no screen-grid dedupe', () => {
  const renderer = makeRenderer(5);
  const ctx = makeCtx();
  const stations = Array.from({ length: 17817 }, (_, i) => ({
    id: `st-${i}`, name: `Station ${i}`, lat: 48, lon: 2, type: 'voyageur', closed: false, platforms: 2,
  }));
  const world = {
    stations,
    getStationsInBounds() { throw new Error('low zoom must scan the compact station array directly'); },
  };

  renderer.drawStations(ctx, world, null, true);

  assert.equal(ctx.calls.fillRect, 17817, 'all native stations must remain visible at zoom 5');
  assert.equal(ctx.calls.fillText, 0, 'names stay hidden at continent zoom');
  assert.equal(ctx.calls.arc, 0, 'continent rendering uses cheap pixel markers');
});

test('v1.1.20: local zoom still uses the station spatial index', () => {
  const renderer = Object.create(Renderer.prototype);
  renderer.tileMap = {
    zoomLevel: 9,
    screenToWorld(x, y) { return { lat: y ? 40 : 55, lon: x ? 15 : -5 }; },
  };
  renderer.logicalWidth = 1200;
  renderer.logicalHeight = 800;
  renderer.latLonToScreen = () => ({ x: 600, y: 400 });
  const ctx = makeCtx();
  let queries = 0;
  const world = {
    stations: [{ id:'all', name:'all', lat:48, lon:2, type:'voyageur', platforms:2 }],
    getStationsInBounds() {
      queries++;
      return [{ id:'visible', name:'Visible', lat:48, lon:2, type:'voyageur', platforms:2 }];
    },
  };

  renderer.drawStations(ctx, world, null, false);
  assert.equal(queries, 1);
  assert.equal(ctx.calls.arc, 1);
});
