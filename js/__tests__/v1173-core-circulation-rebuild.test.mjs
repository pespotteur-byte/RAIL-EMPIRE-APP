import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CantonManager } from '../simulation.js';
import { VoiePointManager } from '../voie-points.js';
import { simulateProfile } from '../train-physics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function withWindowServices(services, fn) {
  const old = globalThis.window;
  globalThis.window = { game: { scheduleCreator: { services } } };
  try { return fn(); } finally { if (old === undefined) delete globalThis.window; else globalThis.window = old; }
}

test('v1.1.73 — CantonManager cannot steal a foreign reservation', () => {
  withWindowServices([
    { id: 'A', state: 'moving', position: { lat: 0, lon: 0 } },
    { id: 'B', state: 'moving', position: { lat: 0, lon: 0.001 } },
  ], () => {
    const cm = new CantonManager();
    const route = [
      { lat: 48, lon: 2, wayId: 'W1', maxSpeed: 120 },
      { lat: 48.02, lon: 2, wayId: 'W1', maxSpeed: 120 },
    ];
    const asg = cm.createRouteCantons(route);
    assert.ok(asg.length > 0);
    const id = asg[0].cantonId;
    assert.equal(cm.reserve(id, 'A'), true);
    assert.equal(cm.occupy(id, 'B'), false);
    assert.equal(cm.cantons.get(id).reservedBy, 'A');
    assert.notEqual(cm.cantons.get(id).occupiedBy, 'B');
  });
});

test('v1.1.73 — turnout section cannot be stolen from another train', () => {
  const vm = new VoiePointManager();
  vm.addVoiePoint({ id: 'p1', lat: 48, lon: 2, voie: '1' });
  vm.addVoiePoint({ id: 'p2', lat: 48.001, lon: 2.001, voie: '1' });
  const t = vm.addTroncon({ id: 't1', pointA: 'p1', pointB: 'p2', route: [] });
  assert.equal(vm.reserveTroncon(t.id, 'A'), true);
  assert.equal(vm.occupyTroncon(t.id, 'B'), false);
  assert.equal(vm.getTronconById(t.id).reservedBy, 'A');
  assert.equal(vm.occupyTroncon(t.id, 'A'), true);
  assert.equal(vm.getTronconById(t.id).occupiedBy, 'A');
});

test('v1.1.73 — brake build-up makes a long train no faster than an instant-brake train', () => {
  const segments = [{ distM: 5000, limitMs: 160 / 3.6, gradePermille: 0 }];
  const base = {
    massKg: 500000,
    adhesionMassKg: 90000,
    powerW: 6000000,
    lengthM: 400,
    vmaxKmh: 160,
    brakeServiceMs2: 0.75,
    weather: 'clear',
  };
  const quick = simulateProfile(segments, { ...base, brakeBuildSec: 0.5 });
  const slow = simulateProfile(segments, { ...base, brakeBuildSec: 8 });
  assert.ok(Number.isFinite(quick.timeSec) && Number.isFinite(slow.timeSec));
  assert.ok(slow.timeSec >= quick.timeSec - 0.01, `${slow.timeSec} should be >= ${quick.timeSec}`);
});


test('v1.1.73 — next canton is reserved upstream and cannot be won at the boundary by a rival', () => {
  withWindowServices([
    { id: 'A', state: 'moving', position: { lat: 48, lon: 2 } },
    { id: 'B', state: 'moving', position: { lat: 48, lon: 2 } },
  ], () => {
    const cm = new CantonManager();
    const route = [
      {lat:48,lon:2,wayId:'W'},
      {lat:48.01,lon:2,wayId:'W'},
      {lat:48.02,lon:2,wayId:'W'},
      {lat:48.03,lon:2,wayId:'W'},
    ];
    const asg=cm.createRouteCantons(route);
    assert.ok(asg.length>=2);
    const first=asg[0];
    cm.occupy(first.cantonId,'A');
    const r=cm.reserveNextAhead(asg,first.startIndex,'A',Number(first.startKm||0),5000);
    assert.equal(r?.blocked,false);
    assert.equal(cm.cantons.get(r.assignment.cantonId).reservedBy,'A');
    assert.equal(cm.reserve(r.assignment.cantonId,'B'),false);
    cm.syncFootprint('A',asg,Number(first.startKm||0),20);
    assert.equal(cm.cantons.get(r.assignment.cantonId).reservedBy,'A','ahead reservation survives footprint sync');
  });
});

test('v1.1.73 — source contracts for routing, timing, LOD and physical safety', () => {
  const main = read('js/main.js');
  const engine = read('js/engine.js');
  const orm = read('js/orm.js');
  const sc = read('js/schedule-creator.js');
  const sim = read('js/simulation.js');
  const vp = read('js/voie-points.js');
  const v2 = read('js/schedule-v2-runtime.js');
  const depot = read('js/depot.js');
  const renderer = read('js/renderer.js');

  assert.match(engine, /currentMinute \+ \(Number\(pt\.seconds \|\| 0\) \/ 60\)/);
  assert.match(main, /this\.scheduleCreator\.refreshMovingCache\(\)/);
  assert.match(main, /stopped_at_station/);
  assert.match(orm, /this\._switchDivergePenaltyH\s*=\s*0\.01/);
  assert.match(orm, /this\._reversalPenaltyH\s*=\s*0\.08/);
  assert.match(orm, /wrongPreferredKm/);
  assert.match(sc, /_reserveUpcomingTroncon/);
  assert.match(sc, /_wayIdsAlong/);
  assert.match(sc, /_holdForBookedArrival/);
  assert.match(sc, /blocked_route/);
  assert.doesNotMatch(sc, /this\.isPassenger/);
  assert.match(sim, /syncFootprint/);
  assert.match(sim, /reserveNextAhead/);
  assert.match(sim, /already reserved by another live train|foreign reservation/);
  assert.match(vp, /reservedBy/);
  assert.match(vp, /Fail closed/);
  assert.match(v2, /departureResourceHold/);
  assert.match(v2, /stationaryRouteRef/);
  assert.match(v2, /_reserveOriginSafetyFootprint/);
  assert.match(depot, /routing_return/);
  assert.doesNotMatch(depot, /route\s*:\s*\[\.\.\.[^\]]*\]\.reverse\(\)/);
  assert.doesNotMatch(renderer, /_returnRoutes.*reverse\(\)/);
});

test('v1.1.73 — no hidden whole-minute travel-time rounding remains in core analyzers', () => {
  const sim = read('js/simulation.js');
  const orm = read('js/orm.js');
  assert.doesNotMatch(sim, /Math\.round\(totalTimeMinutes\s*\*\s*1\.0001\)/);
  assert.doesNotMatch(orm, /Math\.round\(res\.timeSec\s*\/\s*60\)/);
});
