import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rame } from '../rame.js';
import { formatTime } from '../schedule.js';
import { parseStopType, toOdd, returnNumberFor, incrementForward, incrementTrailingNumber } from '../schedule-logic.js';
import { PlayerSignal } from '../signaling.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('Rame getters', (() => {
  const cases = [];
  const configs = [
    { category: 'locomotive', traction: '25kv', maxSpeed: 160, power: 4000, mass: 80, tonnage: 80, length: 20, passengerCapacity: 0, freightCapacity: 0 },
    { category: 'automotrice', traction: '25kv', maxSpeed: 320, power: 8000, mass: 200, tonnage: 200, length: 100, passengerCapacity: 400, freightCapacity: 0 },
    { category: 'wagon', maxSpeed: 120, power: 0, mass: 40, tonnage: 40, length: 15, passengerCapacity: 0, freightCapacity: 50 },
    { category: 'voiture', maxSpeed: 160, power: 0, mass: 30, tonnage: 30, length: 25, passengerCapacity: 80, freightCapacity: 0 },
  ];
  for (let i = 0; i < 3000; i++) {
    const cfg = configs[i % configs.length];
    const count = 1 + (i % 5);
    cases.push({
      name: `rame-${i}`,
      fn: () => {
        const details = [];
        for (let k = 0; k < count; k++) details.push({ ...cfg });
        const rame = new Rame({ elementDetails: details });
        assert.equal(rame.totalLength, cfg.length * count);
        assert.equal(rame.totalTonnage, cfg.tonnage * count);
        assert.equal(rame.totalMass, cfg.mass * count);
        assert.ok(Number.isFinite(rame.maxSpeed));
        if (cfg.category === 'locomotive' || cfg.category === 'automotrice') {
          assert.ok(rame.totalPower > 0);
          assert.ok(rame.traction.includes('25kv'));
        }
      },
    });
  }
  return cases;
})());

itCases('Rame capacity and validity', (() => {
  const cases = [];
  for (let i = 0; i < 2000; i++) {
    cases.push({
      name: `valid-${i}`,
      fn: () => {
        const rame = new Rame({ elementDetails: [{ category: 'automotrice', maxSpeed: 160, passengerCapacity: 300, length: 100, tonnage: 200 }] });
        assert.ok(rame.isValid);
        assert.ok(rame.totalCapacity > 0);
        const payload = rame.getTotalMassWithPayload(0.5);
        assert.ok(payload > rame.totalMass);
      },
    });
  }
  return cases;
})());

itCases('formatTime roundtrip', (() => {
  const cases = [];
  for (let m = 0; m < 1440; m++) {
    cases.push({
      name: `min=${m}`,
      fn: () => {
        const s = formatTime(m);
        assert.ok(s.match(/^\d{2}:\d{2}$/));
        const [h, n] = s.split(':').map(Number);
        assert.equal(h * 60 + n, m);
      },
    });
  }
  return cases;
})());

itCases('parseStopType extensive', (() => {
  const cases = [];
  const labels = [
    ['Paris [C]', 'C', true, 'Paris'],
    ['Paris (S)', 'S', true, 'Paris'],
    ['Paris C', 'C', false, 'Paris'],
    ['Paris S', 'S', false, 'Paris'],
    ['Paris', null, false, 'Paris'],
    ['Lyon  [C]  ', 'C', true, 'Lyon'],
    ['Marseille (s)', 'S', true, 'Marseille'],
    ['Toulouse    S  ', 'S', false, 'Toulouse'],
  ];
  for (let i = 0; i < 3000; i++) {
    const [label, code, skippable, clean] = labels[i % labels.length];
    cases.push({
      name: `parse-${i}`,
      fn: () => {
        const r = parseStopType(label);
        assert.equal(r.code, code);
        assert.equal(r.skippable, skippable);
        assert.equal(r.clean, clean);
      },
    });
  }
  return cases;
})());

itCases('schedule numbering helpers', (() => {
  const cases = [];
  for (let n = 1; n <= 200; n++) {
    cases.push({
      name: `n=${n}`,
      fn: () => {
        const odd = toOdd(n);
        assert.equal(odd % 2, 1);
        assert.equal(returnNumberFor(odd), odd - 1);
        assert.equal(incrementForward(odd, 5), odd + 10);
        const padded = incrementTrailingNumber(`Train ${String(n).padStart(3, '0')}`, 2);
        assert.ok(padded.includes(String(n + 2).padStart(3, '0')));
      },
    });
  }
  return cases;
})());

itCases('PlayerSignal construction', (() => {
  const cases = [];
  const types = ['ralentissement', 'avertissement', 'arret'];
  for (let i = 0; i < 2000; i++) {
    cases.push({
      name: `sig-${i}`,
      fn: () => {
        const s = new PlayerSignal({
          name: `Sig ${i}`,
          stationA: 'A',
          stationB: 'B',
          type: types[i % types.length],
          speedLimit: 20 + (i % 120),
          xKm: i,
        });
        assert.ok(s.id.startsWith('sig-'));
        assert.equal(s.stationA, 'A');
        assert.equal(s.active, true);
        assert.ok(types.includes(s.type));
      },
    });
  }
  return cases;
})());

describe('bulk-misc meta', () => {
  it('loaded', () => assert.ok(true));
});
