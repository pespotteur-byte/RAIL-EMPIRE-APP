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
