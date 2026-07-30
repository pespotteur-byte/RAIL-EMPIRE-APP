import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  visaSpeedCapKmh,
  aspectFromOccupancy,
  aspectSpeedCapKmh,
  ASPECT,
  PlayerSignal,
  PlayerSignalManager,
} from '../signaling.js';
import { CantonManager } from '../simulation.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

function stubWindow(trainIds = []) {
  const prev = globalThis.window;
  globalThis.window = {
    game: {
      scheduleCreator: {
        services: trainIds.map(id => ({ id, state: 'moving', position: { lat: 0, lon: 0 } })),
      },
    },
  };
  return prev;
}

function restoreWindow(prev) {
  globalThis.window = prev;
}

itCases('visaSpeedCapKmh steps', (() => {
  const cases = [];
  const table = [
    [-10, null],
    [0, 0],
    [15, 0],
    [30, 0],
    [50, 10],
    [100, 10],
    [150, 20],
    [200, 20],
    [250, 30],
    [300, 30],
    [400, null],
  ];
  for (let i = 0; i < 3000; i++) {
    const [d, expected] = table[i % table.length];
    cases.push({
      name: `dist=${d}`,
      fn: () => assert.equal(visaSpeedCapKmh(d), expected),
    });
  }
  return cases;
})());

itCases('aspectFromOccupancy and aspectSpeedCapKmh', (() => {
  const cases = [];
  const combos = [
    [false, false, ASPECT.CLEAR],
    [true, false, ASPECT.CLOSED],
    [false, true, ASPECT.CAUTION],
    [true, true, ASPECT.CLOSED],
  ];
  for (let i = 0; i < 3000; i++) {
    const [next, second, exp] = combos[i % combos.length];
    cases.push({
      name: `next=${next},second=${second}`,
      fn: () => {
        assert.equal(aspectFromOccupancy(next, second), exp);
        const cap = aspectSpeedCapKmh(exp, 160, 100);
        assert.ok(cap >= 0);
        assert.ok(cap <= 160);
      },
    });
  }
  return cases;
})());

itCases('PlayerSignalManager speed limit', (() => {
  const cases = [];
  for (let i = 0; i < 2000; i++) {
    cases.push({
      name: `sigmgr-${i}`,
      fn: () => {
        const mgr = new PlayerSignalManager();
        mgr.add({ stationA: 'A', stationB: 'B', type: 'ralentissement', speedLimit: 80 });
        mgr.add({ stationA: 'A', stationB: 'B', type: 'avertissement' });
        mgr.add({ stationA: 'A', stationB: 'B', type: 'arret' });
        assert.equal(mgr.getSpeedLimit('A', 'B'), 0);
        mgr.remove(mgr.signals.find(s => s.type === 'arret').id);
        const limit = mgr.getSpeedLimit('A', 'B');
        assert.equal(limit, 60);
      },
    });
  }
  return cases;
})());

itCases('CantonManager basic lifecycle', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = 3 + (i % 10);
    const route = [];
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.01, lon: 2 + k * 0.01, maxSpeed: 160 });
    }
    cases.push({
      name: `canton-${i}`,
      fn: () => {
        const prev = stubWindow();
        try {
          const cm = new CantonManager();
          cm.setTime(i % 1440);
          const assignments = cm.createRouteCantons(route);
          assert.ok(assignments.length > 0);
          for (const a of assignments) {
            assert.ok(a.cantonId);
            assert.ok(a.startIndex >= 0);
            assert.ok(a.endIndex > a.startIndex);
          }
        } finally {
          restoreWindow(prev);
        }
      },
    });
  }
  return cases;
})());

itCases('CantonManager occupy / release', (() => {
  const cases = [];
  for (let i = 0; i < 1500; i++) {
    const route = [
      { lat: 45, lon: 2, maxSpeed: 160 },
      { lat: 45.1, lon: 2.1, maxSpeed: 160 },
      { lat: 45.2, lon: 2.2, maxSpeed: 160 },
    ];
    cases.push({
      name: `occupy-${i}`,
      fn: () => {
        const prev = stubWindow(['trainA']);
        try {
          const cm = new CantonManager();
          cm.setTime(0);
          const assignments = cm.createRouteCantons(route);
          const id = assignments[0].cantonId;
          assert.equal(cm.occupy(id, 'trainA'), true);
          assert.equal(cm.isAvailable(id, 'trainA'), true);
          assert.equal(cm.isAvailable(id, 'trainB'), false);
          cm.release(id, 'trainA');
          cm.setTime(1);
          assert.equal(cm.isAvailable(id, 'trainB'), true, 'le canton est disponible immédiatement après libération');
        } finally {
          restoreWindow(prev);
        }
      },
    });
  }
  return cases;
})());

describe('bulk-signaling meta', () => {
  it('loaded', () => assert.ok(true));
});
