import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceStop, ActiveService, ScheduleCreator } from '../schedule-creator.js';
import { Rame } from '../rame.js';
import { World, Station } from '../world.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

function makeRame(type = 'voyageur') {
  const isFreight = type === 'fret';
  return new Rame({
    elementDetails: [
      {
        category: isFreight ? 'locomotive' : 'automotrice',
        traction: '25kv',
        maxSpeed: 160,
        power: 4000,
        mass: 80,
        tonnage: 80,
        length: 80,
        passengerCapacity: isFreight ? 0 : 300,
        freightCapacity: isFreight ? 80 : 0,
      },
      {
        category: isFreight ? 'wagon' : 'voiture',
        maxSpeed: 160,
        mass: isFreight ? 40 : 30,
        tonnage: isFreight ? 40 : 30,
        length: 20,
        passengerCapacity: isFreight ? 0 : 80,
        freightCapacity: isFreight ? 40 : 0,
      },
    ],
  });
}

function makeWorld(n = 3) {
  const world = new World();
  for (let i = 0; i < n; i++) {
    world.addStation({ id: `s${i}`, name: `Gare ${i}`, lat: 45 + i * 0.1, lon: 2 + i * 0.1, platforms: 2 });
  }
  return world;
}

itCases('ServiceStop wrap time', (() => {
  const cases = [];
  for (let t = -2000; t <= 3000; t += 5) {
    cases.push({
      name: `time=${t}`,
      fn: () => {
        const s = new ServiceStop('A', 'arret', t, t);
        assert.ok(s.departureTime >= 0 && s.departureTime < 1440);
        assert.equal(s.departureTime, s.arrivalTime);
      },
    });
  }
  return cases;
})());

itCases('ActiveService getColor / naming', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `svc-${i}`,
      fn: () => {
        const svc = new ActiveService({ name: `Train ${i}` }, makeRame(), makeWorld());
        assert.ok(svc.id.startsWith('svc-'));
        assert.ok(svc.train.color.match(/^#[0-9a-f]{6}$/i));
        assert.equal(svc.getColor(), svc.train.color);
        assert.ok(svc.train.name === `Train ${i}`);
      },
    });
  }
  return cases;
})());

itCases('ActiveService getNextStop / getTargetStation', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = 2 + (i % 5);
    const world = makeWorld(n);
    const stops = [];
    for (let k = 0; k < n; k++) {
      stops.push({ stationId: `s${k}`, type: 'arret', departureTime: k * 60, arrivalTime: k * 60, stopCode: k % 2 === 0 ? '' : '[C]' });
    }
    cases.push({
      name: `stops-${i}`,
      fn: () => {
        const svc = new ActiveService({ name: `S${i}`, stops }, makeRame(), world);
        const next = svc.getNextStop();
        assert.ok(next);
        assert.equal(next.stationId, 's0');
        const target = svc.getTargetStation();
        assert.ok(target);
        assert.equal(target.id, 's0');
      },
    });
  }
  return cases;
})());

itCases('ActiveService buildReturnStops', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = 2 + (i % 6);
    const world = makeWorld(n);
    const stops = [];
    for (let k = 0; k < n; k++) {
      stops.push({ stationId: `s${k}`, type: 'arret', departureTime: k * 60, arrivalTime: k * 60 });
    }
    cases.push({
      name: `return-${i}`,
      fn: () => {
        const svc = new ActiveService({ name: `R${i}`, stops, roundTrip: true }, makeRame(), world);
        const ret = svc.buildReturnStops();
        assert.equal(ret.length, n);
        assert.equal(ret[0].stationId, stops[n - 1].stationId);
        assert.equal(ret[ret.length - 1].stationId, stops[0].stationId);
      },
    });
  }
  return cases;
})());

itCases('ActiveService _buildAdjustedStops', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = 2 + (i % 5);
    const stops = [];
    for (let k = 0; k < n; k++) {
      stops.push({ stationId: `s${k}`, type: 'arret', departureTime: k * 60, arrivalTime: k * 60, stopCode: k % 3 === 0 ? '[C]' : '' });
    }
    cases.push({
      name: `adjusted-${i}`,
      fn: () => {
        const svc = new ActiveService({ name: `A${i}`, stops }, makeRame(), makeWorld(n));
        const adj = svc._buildAdjustedStops(svc.stops, () => 0.1); // always skip bracketed
        assert.equal(adj.length, n);
        for (let k = 0; k < n; k++) {
          assert.equal(adj[k].stationId, stops[k].stationId);
          if (stops[k].stopCode) {
            assert.equal(adj[k].type, 'waypoint');
            assert.equal(adj[k]._skipped, true);
          } else {
            assert.equal(adj[k].type, stops[k].type);
          }
        }
      },
    });
  }
  return cases;
})());

itCases('ActiveService getCurrentStops / passage stops', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = 3 + (i % 5);
    const world = makeWorld(n);
    const stops = [];
    for (let k = 0; k < n; k++) {
      stops.push({ stationId: `s${k}`, type: 'arret', departureTime: k * 60, arrivalTime: k * 60 });
    }
    // Add a route between first and last with intermediate stations matching world
    const route = [];
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.1, lon: 2 + k * 0.1, maxSpeed: 160 });
    }
    cases.push({
      name: `passage-${i}`,
      fn: () => {
        const svc = new ActiveService({ name: `P${i}`, stops, routes: [route] }, makeRame(), world);
        const current = svc.getCurrentStops();
        assert.ok(current.length > 0);
        const passages = svc.getPassageStops();
        assert.ok(Array.isArray(passages));
      },
    });
  }
  return cases;
})());

itCases('ScheduleCreator add / remove / duplicate', (() => {
  const cases = [];
  for (let i = 0; i < 1500; i++) {
    cases.push({
      name: `mgr-${i}`,
      fn: () => {
        const sc = new ScheduleCreator();
        const rame = makeRame(i % 2 === 0 ? 'voyageur' : 'fret');
        const world = makeWorld(3);
        const svc = sc.addService({
          name: `Svc ${i}`,
          stops: [
            { stationId: 's0', type: 'arret', departureTime: 0, arrivalTime: 0 },
            { stationId: 's1', type: 'arret', departureTime: 60, arrivalTime: 60 },
          ],
          routes: [[{ lat: 45, lon: 2 }, { lat: 45.1, lon: 2.1 }]],
          rameId: rame.id,
        }, rame, world);
        assert.ok(svc);
        assert.equal(sc.services.length, 1);
        const dup = sc.duplicateService(svc.id, 60, 2, rame, world);
        assert.ok(dup);
        assert.ok(sc.services.length >= 2);
        sc.removeService(svc.id);
        assert.ok(!sc.services.find(s => s.id === svc.id));
      },
    });
  }
  return cases;
})());

itCases('ScheduleCreator isRameInUse indexes', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `rame-${i}`,
      fn: () => {
        const sc = new ScheduleCreator();
        const rame = makeRame();
        const world = makeWorld(2);
        const svc = sc.addService({
          name: `Svc ${i}`,
          stops: [
            { stationId: 's0', type: 'arret', departureTime: i % 1440, arrivalTime: i % 1440 },
            { stationId: 's1', type: 'arret', departureTime: (i + 30) % 1440, arrivalTime: (i + 30) % 1440 },
          ],
          routes: [[{ lat: 45, lon: 2 }, { lat: 45.1, lon: 2.1 }]],
          rameId: rame.id,
        }, rame, world);
        sc.beginTick(i % 1440);
        const inUse = sc.isRameInUse(rame.id, svc.id, i % 1440);
        assert.equal(inUse, false); // excludes itself
      },
    });
  }
  return cases;
})());

describe('bulk-schedule meta', () => {
  it('loaded', () => assert.ok(true));
});
