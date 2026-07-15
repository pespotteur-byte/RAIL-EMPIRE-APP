import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator, ActiveService } from '../schedule-creator.js';

describe('SC-02 — passage times for intermediate stations', () => {
  it('computes passage time for a station on the route', () => {
    const world = {
      stations: [
        { id: 'A', name: 'Paris', lat: 0, lon: 0 },
        { id: 'B', name: 'Lyon', lat: 0.2, lon: 0 }, // ~22 km at equator
        { id: 'C', name: 'Dijon', lat: 0.1, lon: 0 }, // midpoint
      ],
    };
    const svc = new ActiveService({
      name: 'TGV 1',
      rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'departure', departureTime: 600, arrivalTime: 600 },
        { stationId: 'B', type: 'arrival', departureTime: 630, arrivalTime: 630 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.05, lon: 0 }, { lat: 0.1, lon: 0 }, { lat: 0.15, lon: 0 }, { lat: 0.2, lon: 0 }]],
    }, null, world);
    const passages = svc.getPassageStops();
    assert.equal(passages.length, 1);
    assert.equal(passages[0].stationId, 'C');
    assert.equal(passages[0].name, 'Dijon');
    assert.equal(passages[0].time, 615);
  });
});

describe('ARR-04/05 — skippable [C]/[S] stops applied per circulation', () => {
  it('skips a bracketed stop 25% of the time and keeps bare C/S stops', () => {
    const world = { stations: [
      { id: 'A', name: 'A', lat: 0, lon: 0 },
      { id: 'B', name: 'B', lat: 0.1, lon: 0 },
      { id: 'C', name: 'C', lat: 0.2, lon: 0 },
    ] };
    const svc = new ActiveService({
      name: 'Test', rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'arret', stopCode: '', departureTime: 0, arrivalTime: 0 },
        { stationId: 'B', type: 'arret', stopCode: '[C]', departureTime: 10, arrivalTime: 10 },
        { stationId: 'C', type: 'arret', stopCode: 'C', departureTime: 20, arrivalTime: 20 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }, { lat: 0.2, lon: 0 }]],
    }, null, world);
    const adjusted = svc._buildAdjustedStops();
    assert.equal(adjusted.length, 3);
    assert.equal(adjusted[0].type, 'arret');
    assert.equal(adjusted[2].type, 'arret'); // bare C is never skipped
    // With a fixed RNG we can force the bracketed stop to be skipped.
    const skipped = svc._buildAdjustedStops(svc.stops, () => 0.1);
    assert.equal(skipped[1].type, 'waypoint');
    assert.equal(skipped[1]._skipped, true);
    const kept = svc._buildAdjustedStops(svc.stops, () => 0.9);
    assert.equal(kept[1].type, 'arret');
  });
});

describe('SC-04 — buildReturnStops returns reversed forward stops', () => {
  it('returns exactly the reversed forward stops when no independent return is defined', () => {
    const svc = new ActiveService({
      name: 'Test', rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 480, arrivalTime: 480 },
        { stationId: 'B', type: 'arret', departureTime: 540, arrivalTime: 540 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
      roundTrip: true, terminusWait: 5,
    }, null, { stations: [] });
    const ret = svc.buildReturnStops();
    assert.equal(ret.length, 2);
    assert.equal(ret[0].stationId, 'B');
    assert.equal(ret[1].stationId, 'A');
  });
});

describe('SC-04 — independent return stops and routes', () => {
  it('uses returnStops/returnRoutes for the return leg and falls back to reversed forward otherwise', () => {
    const world = { stations: [
      { id: 'A', name: 'A', lat: 0, lon: 0 },
      { id: 'B', name: 'B', lat: 0.1, lon: 0 },
    ] };
    const svc = new ActiveService({
      name: 'Test', rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 480, arrivalTime: 480 },
        { stationId: 'B', type: 'arret', departureTime: 540, arrivalTime: 540 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
      roundTrip: true, terminusWait: 5,
      // Different return path: B -> C -> A
      returnStops: [
        { stationId: 'B', type: 'arret', departureTime: 545, arrivalTime: 545 },
        { stationId: 'C', type: 'arret', departureTime: 570, arrivalTime: 570 },
        { stationId: 'A', type: 'arret', departureTime: 600, arrivalTime: 600 },
      ],
      returnRoutes: [[{ lat: 0.1, lon: 0 }, { lat: 0.05, lon: 0.1 }, { lat: 0, lon: 0 }]],
    }, null, world);
    svc.isReturnLeg = true;
    svc.currentStopIndex = 0;
    const retStops = svc.getCurrentStops();
    assert.equal(retStops.length, 3);
    assert.equal(retStops[0].stationId, 'B');
    assert.equal(retStops[1].stationId, 'C');
    const retRoute = svc.getCurrentRoute();
    assert.equal(retRoute.length, 3);
    assert.equal(retRoute[0].lat, 0.1);
    assert.equal(retRoute[0].lon, 0);
    assert.equal(retRoute[1].lat, 0.05);
    assert.equal(retRoute[1].lon, 0.1);
  });
});

describe('SC-04 — save/load preserves independent return stops and routes', () => {
  it('round-trips returnStops/returnRoutes through ScheduleCreator.toSave/loadFromSave', () => {
    const sc = new ScheduleCreator();
    const world = { stations: [
      { id: 'A', name: 'A', lat: 0, lon: 0 },
      { id: 'B', name: 'B', lat: 0.1, lon: 0 },
      { id: 'C', name: 'C', lat: 0.05, lon: 0.1 },
    ] };
    const base = sc.addService({
      name: 'Test', rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 480, arrivalTime: 480, stopCode: 'C' },
        { stationId: 'B', type: 'arret', departureTime: 540, arrivalTime: 540, stopCode: '[C]' },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
      roundTrip: true, terminusWait: 5,
      returnStops: [
        { stationId: 'B', type: 'arret', departureTime: 545, arrivalTime: 545, stopCode: 'S' },
        { stationId: 'C', type: 'arret', departureTime: 570, arrivalTime: 570 },
        { stationId: 'A', type: 'arret', departureTime: 600, arrivalTime: 600 },
      ],
      returnRoutes: [[{ lat: 0.1, lon: 0 }, { lat: 0.05, lon: 0.1 }, { lat: 0, lon: 0 }]],
    }, null, world);
    assert.equal(base._returnStopsData.length, 3);
    assert.equal(base._returnRoutes.length, 1);
    const saved = sc.toSave();
    const encoded = saved[0];
    assert.ok(encoded.rst, 'return stops encoded');
    assert.ok(encoded.rtrt, 'return routes encoded');
    assert.equal(encoded.rst.length, 3);

    const sc2 = new ScheduleCreator();
    sc2.loadFromSave([encoded], { getById: () => null }, world);
    const loaded = sc2.services[0];
    assert.equal(loaded._returnStopsData.length, 3);
    assert.equal(loaded._returnStopsData[0].stopCode, 'S');
    assert.equal(loaded._returnStopsData[1].stationId, 'C');
    assert.equal(loaded._returnRoutes[0].length, 3);
    assert.equal(loaded._returnRoutes[0][0].lat, 0.1);
  });
});

describe('SC-05 — Auto 24h creates real round-trip duplicates', () => {
  it('creates separate services with independent aller/retour numbers', () => {
    const sc = new ScheduleCreator();
    const base = sc.addService({
      name: 'TER 891001',
      rameId: 'r1',
      stops: [
        { stationId: 'A', type: 'departure', departureTime: 480, arrivalTime: 480 },
        { stationId: 'B', type: 'arrival', departureTime: 540, arrivalTime: 540 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }]],
      roundTrip: true,
      multiDepartures: 1,
      terminusWait: 5,
      returnName: 'TER 891000',
    });
    const dups = sc.createAutoRoundTripDuplicates(base, 4, 130, null, null);
    assert.equal(dups.length, 3);
    // Aller names increase by 2: 003, 005, 007
    assert.equal(dups[0].name, 'TER 891003');
    assert.equal(dups[1].name, 'TER 891005');
    assert.equal(dups[2].name, 'TER 891007');
    // Return names increase by 2: 002, 004, 006
    assert.equal(dups[0].returnName, 'TER 891002');
    assert.equal(dups[1].returnName, 'TER 891004');
    assert.equal(dups[2].returnName, 'TER 891006');
    // Each duplicate is a single round trip
    assert.equal(dups[0].multiDepartures, 1);
    assert.equal(dups[1].multiDepartures, 1);
    assert.equal(dups[2].multiDepartures, 1);
    // Stops are shifted by the full round-trip duration
    assert.equal(dups[0].stops[0].departureTime, 480 + 130);
    assert.equal(dups[1].stops[0].departureTime, 480 + 260);
    assert.equal(dups[2].stops[0].departureTime, 480 + 390);
  });
});
