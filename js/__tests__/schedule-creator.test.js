import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal stubs so schedule-creator.js can load outside a browser
globalThis.window = { game: null };
globalThis.performance = { now: () => Date.now() };

import { ActiveService, ServiceStop, ScheduleCreator, cantonManager } from '../schedule-creator.js';

// ============================================================
// Helpers
// ============================================================

function makeRame(opts = {}) {
  return {
    id: opts.id || 'rame-1',
    name: opts.name || 'TGV-1',
    maxSpeed: opts.maxSpeed || 300,
    totalPower: opts.totalPower || 8800,
    totalMass: opts.totalMass || 400,
    elements: opts.elements || [],
    getTotalMassWithPayload: () => opts.totalMass || 400,
    totalKmRun: opts.totalKmRun || 0,
    kmSinceLastMaint: 0,
    wearLevel: 0,
    inMaintenance: false,
  };
}

function makeWorld(stations) {
  const stationMap = new Map();
  for (const s of stations) stationMap.set(s.id, s);
  return {
    stations,
    getStationById(id) { return stationMap.get(id) || null; },
    getStations() { return stations; },
  };
}

function makeStops(stations, depTimes) {
  return stations.map((s, i) => ({
    stationId: s.id,
    type: i === 0 ? 'depart' : i === stations.length - 1 ? 'terminus' : 'arret',
    departureTime: depTimes[i],
    arrivalTime: depTimes[i],
  }));
}

function makeRoute(from, to, numPoints) {
  const pts = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    pts.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lon: from.lon + (to.lon - from.lon) * t,
      maxSpeed: 160,
      electrified: true,
      tracks: 2,
    });
  }
  return pts;
}

const PARIS = { id: 'st-paris', name: 'Paris', lat: 48.8566, lon: 2.3522, platforms: 10 };
const LYON = { id: 'st-lyon', name: 'Lyon', lat: 45.7640, lon: 4.8357, platforms: 8 };
const MARSEILLE = { id: 'st-marseille', name: 'Marseille', lat: 43.2965, lon: 5.3698, platforms: 6 };

// ============================================================
// ActiveService – construction & basics
// ============================================================

describe('ActiveService', () => {
  let world, rame;

  beforeEach(() => {
    world = makeWorld([PARIS, LYON, MARSEILLE]);
    rame = makeRame();
  });

  it('initializes with default values', () => {
    const svc = new ActiveService({
      name: 'TGV 101',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [],
    }, rame, world);

    assert.equal(svc.name, 'TGV 101');
    assert.equal(svc.state, 'waiting');
    assert.equal(svc.speed, 0);
    assert.equal(svc.currentStopIndex, 0);
    assert.equal(svc.totalDistance, 0);
    assert.equal(svc.plannedDistance, 0);
  });

  it('separates plannedDistance from totalDistance', () => {
    const svc = new ActiveService({
      name: 'TGV 102',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [],
      plannedDistance: 500,
      totalDistance: 0,
    }, rame, world);

    assert.equal(svc.plannedDistance, 500);
    assert.equal(svc.totalDistance, 0);
  });

  it('computes mass-based physics from rame', () => {
    const svc = new ActiveService({
      name: 'TGV 103',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [],
    }, rame, world);

    assert.ok(svc.train.accel > 0 && svc.train.accel <= 5.0);
    assert.ok(svc.train.decel > 0 && svc.train.decel <= 5.0);
  });

  it('getNextStop returns correct stop', () => {
    const svc = new ActiveService({
      name: 'TGV 104',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON, MARSEILLE], [480, 510, 570]),
      routes: [],
    }, rame, world);

    assert.equal(svc.getNextStop().stationId, 'st-paris');
    svc.currentStopIndex = 1;
    assert.equal(svc.getNextStop().stationId, 'st-lyon');
    svc.currentStopIndex = 2;
    assert.equal(svc.getNextStop().stationId, 'st-marseille');
    svc.currentStopIndex = 3;
    assert.equal(svc.getNextStop(), null);
  });

  it('getCurrentRoute returns route for current leg', () => {
    const route1 = makeRoute(PARIS, LYON, 10);
    const route2 = makeRoute(LYON, MARSEILLE, 10);
    const svc = new ActiveService({
      name: 'TGV 105',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON, MARSEILLE], [480, 510, 570]),
      routes: [route1, route2],
    }, rame, world);

    // currentStopIndex 0 → no route yet (idx = max(0, 0-1) = 0)
    svc.currentStopIndex = 1;
    const r1 = svc.getCurrentRoute();
    assert.equal(r1.length, route1.length);

    svc.currentStopIndex = 2;
    const r2 = svc.getCurrentRoute();
    assert.equal(r2.length, route2.length);
  });
});

// ============================================================
// ScheduleCreator – save / load round-trip
// ============================================================

describe('ScheduleCreator – save/load', () => {
  let sc, world, rame;

  beforeEach(() => {
    sc = new ScheduleCreator();
    world = makeWorld([PARIS, LYON, MARSEILLE]);
    rame = makeRame();
    cantonManager.cantons.clear();
    cantonManager.routeCantons.clear();
    cantonManager.trainCantons.clear();
  });

  it('round-trips a basic service through save/load', () => {
    sc.addService({
      name: 'TGV 201',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 20)],
      plannedDistance: 392,
    }, rame, world);

    const saved = sc.toSave();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].n, 'TGV 201');
    assert.equal(saved[0].pd, 392);
    assert.equal(saved[0].td, 0);

    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);
    assert.equal(sc2.services.length, 1);
    assert.equal(sc2.services[0].name, 'TGV 201');
    assert.equal(sc2.services[0].plannedDistance, 392);
    assert.equal(sc2.services[0].totalDistance, 0);
  });

  it('preserves runtime state for waiting trains', () => {
    sc.addService({
      name: 'TGV 202',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 20)],
    }, rame, world);

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const svc = sc2.services[0];
    assert.equal(svc.state, 'waiting');
    assert.equal(svc.position, null);
    assert.equal(svc.speed, 0);
    assert.equal(svc.currentStopIndex, 0);
  });

  it('restores mid-journey moving train position and state', () => {
    const svc = sc.addService({
      name: 'TGV 203',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 20)],
    }, rame, world);

    // Simulate mid-journey state
    svc.state = 'moving';
    svc.position = { lat: 47.5, lon: 3.5 };
    svc.speed = 280;
    svc.currentStopIndex = 1;
    svc.delay = 2.5;
    svc._state.index = 10;

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restored = sc2.services[0];
    assert.equal(restored.state, 'moving');
    assert.ok(Math.abs(restored.position.lat - 47.5) < 0.001);
    assert.ok(Math.abs(restored.position.lon - 3.5) < 0.001);
    assert.equal(restored.speed, 280);
    assert.equal(restored.currentStopIndex, 1);
    assert.ok(Math.abs(restored.delay - 2.5) < 0.01);
    assert.equal(restored._state.index, 10);
  });

  it('restores stopped_at_station state', () => {
    const svc = sc.addService({
      name: 'TGV 204',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON, MARSEILLE], [480, 510, 570]),
      routes: [makeRoute(PARIS, LYON, 10), makeRoute(LYON, MARSEILLE, 10)],
    }, rame, world);

    svc.state = 'stopped_at_station';
    svc.position = { lat: LYON.lat, lon: LYON.lon };
    svc.speed = 0;
    svc.currentStopIndex = 1;
    svc.delay = -1;

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restored = sc2.services[0];
    assert.equal(restored.state, 'stopped_at_station');
    assert.ok(Math.abs(restored.position.lat - LYON.lat) < 0.001);
    assert.equal(restored.speed, 0);
    assert.equal(restored.currentStopIndex, 1);
    assert.ok(Math.abs(restored.delay - (-1)) < 0.01);
    assert.equal(restored.train.state, 'stopped_at_station');
  });

  it('preserves _adjustedStops for mid-journey trains', () => {
    const svc = sc.addService({
      name: 'TGV 205',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 10)],
    }, rame, world);

    svc.state = 'moving';
    svc.position = { lat: 47.5, lon: 3.5 };
    svc.speed = 200;
    svc.currentStopIndex = 1;
    svc._tripCount = 2;
    svc._adjustedStops = [
      new ServiceStop('st-paris', 'depart', 510, 510),
      new ServiceStop('st-lyon', 'terminus', 540, 540),
    ];

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restored = sc2.services[0];
    assert.equal(restored.state, 'moving');
    // _adjustedStops should be preserved via runtime restore
    // (was previously wiped by line 1902)
    assert.notEqual(restored._adjustedStops, null);
    assert.equal(restored._adjustedStops.length, 2);
    assert.equal(restored._adjustedStops[0].departureTime, 510);
    assert.equal(restored._tripCount, 2);
  });

  it('clears _adjustedStops and _tripCount for waiting trains', () => {
    const svc = sc.addService({
      name: 'TGV 206',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 10)],
    }, rame, world);

    svc._tripCount = 5;
    svc._adjustedStops = [
      new ServiceStop('st-paris', 'depart', 510, 510),
      new ServiceStop('st-lyon', 'terminus', 540, 540),
    ];

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restored = sc2.services[0];
    assert.equal(restored.state, 'waiting');
    assert.equal(restored._adjustedStops, null);
    assert.equal(restored._tripCount, 0);
  });

  it('saves and restores _state.index for route position', () => {
    const svc = sc.addService({
      name: 'TGV 207',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 50)],
    }, rame, world);

    svc.state = 'moving';
    svc.position = { lat: 47.5, lon: 3.5 };
    svc.speed = 250;
    svc.currentStopIndex = 1;
    svc._state.index = 25;

    const saved = sc.toSave();
    assert.equal(saved[0]._r.si, 25);

    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restored = sc2.services[0];
    assert.equal(restored._state.index, 25);
  });

  it('does not save _state.index when 0', () => {
    const svc = sc.addService({
      name: 'TGV 208',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 10)],
    }, rame, world);

    const saved = sc.toSave();
    assert.equal(saved[0]._r.si, undefined);
  });

  it('duplicated service gets totalDistance=0 and preserves plannedDistance', () => {
    const svc = sc.addService({
      name: 'TGV 300',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [makeRoute(PARIS, LYON, 10)],
      plannedDistance: 392,
    }, rame, world);
    svc.totalDistance = 150;

    const copies = sc.duplicateService(svc.id, 30, 2, rame, world);
    assert.equal(copies.length, 2);
    for (const c of copies) {
      assert.equal(c.totalDistance, 0);
      assert.equal(c.plannedDistance, 392);
    }
  });
});

// ============================================================
// ScheduleCreator – route encoding
// ============================================================

describe('ScheduleCreator – route encoding', () => {
  let sc, world, rame;

  beforeEach(() => {
    sc = new ScheduleCreator();
    world = makeWorld([PARIS, LYON]);
    rame = makeRame();
  });

  it('delta-encodes and decodes routes losslessly', () => {
    const route = makeRoute(PARIS, LYON, 30);
    sc.addService({
      name: 'TGV 401',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [route],
    }, rame, world);

    const saved = sc.toSave();
    const sc2 = new ScheduleCreator();
    sc2.loadFromSave(saved, { getById: () => rame }, world);

    const restoredRoute = sc2.services[0].routes[0];
    assert.ok(restoredRoute.length > 0);
    // Check first and last point are close (1e-5 precision)
    assert.ok(Math.abs(restoredRoute[0].lat - PARIS.lat) < 0.001);
    assert.ok(Math.abs(restoredRoute[restoredRoute.length - 1].lat - LYON.lat) < 0.001);
  });
});

// ============================================================
// blockedBy reset
// ============================================================

describe('ActiveService – blockedBy reset', () => {
  it('blockedBy defaults to false in constructor', () => {
    const world = makeWorld([PARIS, LYON]);
    const rame = makeRame();
    const svc = new ActiveService({
      name: 'TGV 501',
      rameId: 'rame-1',
      stops: makeStops([PARIS, LYON], [480, 510]),
      routes: [],
    }, rame, world);

    assert.equal(svc.train.blockedBy, false);
  });
});
