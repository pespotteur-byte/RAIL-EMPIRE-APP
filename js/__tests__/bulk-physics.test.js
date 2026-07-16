import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weatherAdhesion,
  resistanceN,
  tractiveEffortN,
  accelerationMs2,
  brakingDecelMs2,
  brakingDistanceM,
  segmentsFromRoute,
  simulateProfile,
} from '../train-physics.js';
import { haversineDistance } from '../simulation.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

const WEATHERS = ['clear', 'cloudy', 'wind', 'light_rain', 'rain', 'heavy_rain', 'storm', 'snow'];
const ADHESION = {
  clear: 0.33, cloudy: 0.33, wind: 0.33,
  light_rain: 0.28, rain: 0.25, heavy_rain: 0.22,
  storm: 0.20, snow: 0.15,
};

itCases('weatherAdhesion lookup', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    const w = WEATHERS[i % WEATHERS.length];
    cases.push({
      name: `${w}-${i}`,
      fn: () => {
        assert.equal(weatherAdhesion(w), ADHESION[w]);
        assert.equal(weatherAdhesion(null), ADHESION.clear);
        assert.equal(weatherAdhesion(''), ADHESION.clear);
      },
    });
  }
  return cases;
})());

itCases('resistanceN invariants', (() => {
  const cases = [];
  const massesT = [10, 50, 100, 200, 300, 400, 500, 750, 1000];
  const speeds = [0, 10, 20, 40, 80, 120];
  const grades = [-20, -10, 0, 10, 20];
  const lengths = [100, 200, 400, 800];
  for (const m of massesT) {
    for (const v of speeds) {
      for (const g of grades) {
        for (const L of lengths) {
          cases.push({
            name: `m=${m},v=${v},g=${g},L=${L}`,
            fn: () => {
              const r = resistanceN(m * 1000, v, g, L);
              assert.ok(Number.isFinite(r));
              const rSame = resistanceN(m * 1000, v, g, L);
              assert.equal(r, rSame, 'deterministic');
              const rHigherV = resistanceN(m * 1000, v + 10, g, L);
              assert.ok(rHigherV >= r, 'resistance non-decreasing with speed');
              if (g > 0) assert.ok(r >= resistanceN(m * 1000, v, 0, L), 'uphill adds');
              if (g < 0) assert.ok(r <= resistanceN(m * 1000, v, 0, L), 'downhill subtracts');
            },
          });
        }
      }
    }
  }
  return cases;
})());

itCases('tractiveEffortN invariants', (() => {
  const cases = [];
  const powers = [0, 1_000_000, 2_000_000, 4_000_000, 8_000_000, 12_000_000];
  const speeds = [0, 5, 10, 30, 60, 100];
  const massesT = [50, 100, 200, 500, 1000];
  for (const p of powers) {
    for (const v of speeds) {
      for (const m of massesT) {
        for (const w of WEATHERS) {
          cases.push({
            name: `p=${p},v=${v},m=${m},w=${w}`,
            fn: () => {
              const te = tractiveEffortN(p, v, m * 1000, w);
              const mu = ADHESION[w];
              const adhesionLimit = mu * m * 1000 * 9.81;
              assert.ok(Number.isFinite(te));
              assert.ok(te >= 0);
              assert.ok(te <= adhesionLimit + 1e-3, `${te} > ${adhesionLimit}`);
              if (p === 0) assert.equal(te, 0);
              const teSlow = tractiveEffortN(p, Math.max(2, v * 0.5), m * 1000, w);
              assert.ok(te <= teSlow || v === 0, 'TE non-increasing with speed');
            },
          });
        }
      }
    }
  }
  return cases;
})());

itCases('accelerationMs2 invariants', (() => {
  const cases = [];
  const configs = [
    { massKg: 200_000, powerW: 2_000_000, lengthM: 200, weather: 'clear' },
    { massKg: 500_000, powerW: 4_000_000, lengthM: 400, weather: 'clear' },
    { massKg: 1_000_000, powerW: 6_000_000, lengthM: 600, weather: 'clear' },
    { massKg: 200_000, powerW: 2_000_000, lengthM: 200, weather: 'snow' },
    { massKg: 300_000, powerW: 1_000_000, lengthM: 300, weather: 'rain' },
  ];
  const speeds = [0, 5, 15, 40, 80];
  const grades = [-15, -5, 0, 5, 15];
  for (const base of configs) {
    for (const v of speeds) {
      for (const g of grades) {
        cases.push({
          name: `m=${base.massKg},v=${v},g=${g},w=${base.weather}`,
          fn: () => {
            const a = accelerationMs2(base, v, g);
            assert.ok(Number.isFinite(a));
            const a0 = accelerationMs2(base, v, 0);
            if (g > 0) assert.ok(a <= a0 + 1e-6, 'uphill reduces acceleration');
            if (g < 0) assert.ok(a >= a0 - 1e-6, 'downhill increases acceleration');
          },
        });
      }
    }
  }
  return cases;
})());

itCases('brakingDecelMs2 invariants', (() => {
  const cases = [];
  const configs = [
    { massKg: 200_000, brakeServiceMs2: 0.9 },
    { massKg: 500_000, brakeServiceMs2: 0.7 },
    { massKg: 1_000_000, brakeServiceMs2: 0.6 },
    { massKg: 50_000, brakeServiceMs2: 1.0 },
  ];
  for (const base of configs) {
    for (const w of WEATHERS) {
      cases.push({
        name: `brake=${base.brakeServiceMs2},w=${w}`,
        fn: () => {
          const d = brakingDecelMs2(base, w);
          assert.ok(d > 0 && d <= 2.0, `${d}`);
          const clear = brakingDecelMs2({ ...base, weather: 'clear' }, 'clear');
          if (w !== 'clear') assert.ok(d <= clear, `${w} reduces decel`);
        },
      });
    }
  }
  return cases;
})());

itCases('brakingDistanceM invariants', (() => {
  const cases = [];
  const decels = [0.5, 0.9, 1.2];
  for (let v0 = 0; v0 <= 100; v0 += 10) {
    for (let vt = 0; vt <= v0; vt += 10) {
      for (const d of decels) {
        cases.push({
          name: `v0=${v0},vt=${vt},d=${d}`,
          fn: () => {
            const dist = brakingDistanceM(v0, vt, d);
            assert.ok(Number.isFinite(dist));
            assert.ok(dist >= 0);
            if (v0 <= vt) assert.equal(dist, 0);
            if (v0 > vt) {
              assert.ok(dist > 0);
              assert.ok(brakingDistanceM(v0 + 10, vt, d) >= dist, 'distance grows with speed');
              assert.ok(brakingDistanceM(v0, vt, d + 0.1) <= dist, 'distance shrinks with decel');
            }
          },
        });
      }
    }
  }
  return cases;
})());

itCases('segmentsFromRoute invariants', (() => {
  const cases = [];
  const caps = [30, 60, 100, 120, 160, 200, 250, 320];
  for (let i = 0; i < 1000; i++) {
    const route = [];
    const n = 3 + (i % 12);
    for (let k = 0; k < n; k++) {
      route.push({ lat: 45 + k * 0.01, lon: 2 + k * 0.01, maxSpeed: [30, 80, 120, 160, 200, 250, 320][k % 7] });
    }
    const cap = caps[i % caps.length];
    cases.push({
      name: `cap=${cap},n=${n}`,
      fn: () => {
        const segs = segmentsFromRoute(route, cap, haversineDistance);
        assert.ok(segs.length > 0, 'has segments');
        for (const s of segs) {
          assert.ok(s.distM > 0);
          assert.ok(s.limitMs > 0);
          assert.ok(s.limitMs <= cap * (1 / 3.6) + 1e-9, `${s.limitMs} > ${cap / 3.6}`);
        }
      },
    });
  }
  return cases;
})());

itCases('simulateProfile invariants', (() => {
  const cases = [];
  const params = [
    { massKg: 200_000, powerW: 2_000_000, lengthM: 200, weather: 'clear' },
    { massKg: 500_000, powerW: 4_000_000, lengthM: 300, weather: 'clear' },
    { massKg: 200_000, powerW: 2_000_000, lengthM: 200, weather: 'snow' },
    { massKg: 1_000_000, powerW: 6_000_000, lengthM: 500, weather: 'rain' },
  ];
  const caps = [30, 60, 100, 120, 160];
  for (let i = 0; i < 1000; i++) {
    const cap = caps[i % caps.length];
    const segCount = 2 + (i % 6);
    const p = params[i % params.length];
    cases.push({
      name: `run-${i}`,
      fn: () => {
        const segments = [];
        for (let k = 0; k < segCount; k++) {
          segments.push({ distM: 500 + (k % 3) * 250, limitMs: cap * (1 / 3.6) });
        }
        const r = simulateProfile(segments, p);
        assert.ok(r.timeSec > 0, 'positive time');
        assert.ok(r.distM > 0);
        assert.ok(r.vMaxReachedMs <= cap * (1 / 3.6) + 1e-6);
        const naive = r.distM / Math.max(0.1, cap * (1 / 3.6));
        assert.ok(r.timeSec >= naive * 0.75, 'not faster than physics');
      },
    });
  }
  return cases;
})());

describe('bulk-physics meta', () => {
  it('loaded', () => assert.ok(true));
});
