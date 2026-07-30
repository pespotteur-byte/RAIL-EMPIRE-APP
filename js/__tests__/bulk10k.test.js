/*
 * Bulk parameterized regression suite — ~10 000 deterministic micro-tests
 * covering the pure helpers used by the remaster.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  toOdd,
  returnNumberFor,
  incrementForward,
  incrementTrailingNumber,
  parseStopType,
  rollSkip,
  shouldSkipStop,
  interpolatePassageTimes,
} from '../schedule-logic.js';
import { ServiceStop } from '../schedule-creator.js';
import { formatTime } from '../schedule.js';
import { haversineDistance } from '../simulation.js';
import {
  visaSpeedCapKmh,
  aspectFromOccupancy,
  aspectSpeedCapKmh,
  ASPECT,
} from '../signaling.js';
import { Economy } from '../economy.js';
import { SeededRng } from '../rng.js';
import { PlayerSignal } from '../signaling.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

// ---------------- parseStopType ----------------
itCases('parseStopType', (() => {
  const labels = [
    'Melun [C]', 'Melun (S)', 'Melun C', 'Melun S', 'Melun',
    'Paris [c]', 'Lyon (s)', 'Dijon C', 'Tours S', 'Le Mans',
    'Rennes [C]', 'Brest (S)', 'Bordeaux C', 'Strasbourg   S',
    'Nantes [C]', 'Montpellier (S)', 'Lille C', 'Reims S',
    'Toulouse [C]', 'Grenoble (S)', 'Nice C', 'Toulon S',
    'Marseille [C]', 'Aix (S)', 'Avignon C', 'Nîmes S',
    'Perpignan [C]', 'Carcassonne (S)', 'Béziers C', 'Sète S',
    'Montpellier [C]', 'Nîmes (S)', 'Avignon C', 'Marseille S',
    'Lyon [C]', 'Mâcon (S)', 'Chalon C', 'Dijon S',
    'Besançon [C]', 'Belfort (S)', 'Mulhouse C', 'Strasbourg S',
    'Paris [C]', 'Melun (S)', 'Montereau C', 'Sens S',
    'Joigny [C]', 'Auxerre (S)', 'Clamecy C', 'Nevers S',
    'Bourges [C]', 'Vierzon (S)', 'Orléans C', 'Tours S',
    'Le Mans [C]', 'Alençon (S)', 'Laval C', 'Rennes S',
    'Saint-Brieuc [C]', 'Guingamp (S)', 'Morlaix C', 'Brest S',
    'Quimper [C]', 'Lorient (S)', 'Vannes C', 'Redon S',
    'Angers [C]', 'Saumur (S)', 'Chinon C', 'Poitiers S',
    'Niort [C]', 'La Rochelle (S)', 'Rochefort C', 'Saintes S',
    'Cognac [C]', 'Angoulême (S)', 'Libourne C', 'Bordeaux S',
    'Périgueux [C]', 'Brive (S)', 'Tulle C', 'Aurillac S',
    'Figeac [C]', 'Cahors (S)', 'Montauban C', 'Toulouse S',
    'Carcassonne [C]', 'Narbonne (S)', 'Béziers C', 'Sète S',
    'Montpellier [C]', 'Nîmes (S)', 'Avignon C', 'Marseille S',
  ];

  function expectedFor(label) {
    const raw = String(label).trim();
    const bracketed = raw.match(/[[(]\s*([CS])\s*[\])]\s*$/i);
    const bare = raw.match(/\s([CS])\s*$/i);
    if (bracketed) {
      return { code: bracketed[1].toUpperCase(), skippable: true, clean: raw.slice(0, bracketed.index).trim() };
    }
    if (bare) {
      return { code: bare[1].toUpperCase(), skippable: false, clean: raw.slice(0, bare.index).trim() };
    }
    return { code: null, skippable: false, clean: raw };
  }

  const cases = [];
  for (const label of labels) {
    cases.push({
      name: `"${label}"`,
      fn: () => {
        const r = parseStopType(label);
        const exp = expectedFor(label);
        assert.deepEqual(r, exp);
      },
    });
  }
  // explicit edge cases
  cases.push(
    { name: 'explicit bracket C', fn: () => assert.deepEqual(parseStopType('Melun [C]'), { code: 'C', skippable: true, clean: 'Melun' }) },
    { name: 'explicit paren S', fn: () => assert.deepEqual(parseStopType('Melun (S)'), { code: 'S', skippable: true, clean: 'Melun' }) },
    { name: 'explicit bare C', fn: () => assert.deepEqual(parseStopType('Melun C'), { code: 'C', skippable: false, clean: 'Melun' }) },
    { name: 'explicit bare S', fn: () => assert.deepEqual(parseStopType('Melun S'), { code: 'S', skippable: false, clean: 'Melun' }) },
    { name: 'explicit none', fn: () => assert.deepEqual(parseStopType('Melun'), { code: null, skippable: false, clean: 'Melun' }) },
    { name: 'trailing space', fn: () => assert.deepEqual(parseStopType('Bordeaux C '), { code: 'C', skippable: false, clean: 'Bordeaux' }) },
  );
  return cases;
})());

// ---------------- rollSkip / shouldSkipStop ----------------
itCases('rollSkip determinism', (() => {
  const cases = [];
  for (let v = 0; v < 25; v++) {
    const p = v / 25;
    cases.push({
      name: `threshold ${v}`,
      fn: () => {
        const value = p;
        assert.equal(rollSkip(() => value), value < 0.25);
      },
    });
  }
  const labels = ['Melun [C]', 'Melun (S)', 'Melun C', 'Melun S', 'Melun'];
  for (let i = 0; i < 100; i++) {
    const label = labels[i % labels.length];
    const draw = i % 3 === 0 ? 0.1 : 0.9;
    cases.push({
      name: `skip decision ${i}`,
      fn: () => {
        const skipped = shouldSkipStop(label, () => draw);
        const parsed = parseStopType(label);
        assert.equal(skipped, parsed.skippable && draw < 0.25);
      },
    });
  }
  return cases;
})());

// ---------------- Numbering helpers ----------------
itCases('toOdd', (() => {
  const cases = [];
  for (let n = -10; n <= 1000; n++) {
    cases.push({
      name: `n=${n}`,
      fn: () => {
        const r = toOdd(n);
        assert.equal(r % 2, 1, 'result is odd');
        assert.ok(r >= Math.max(1, Math.floor(Number(n) || 1)), 'result >= clamped input');
        if (n >= 1) assert.ok(r - n <= 2, 'at most +2');
      },
    });
  }
  return cases;
})());

itCases('returnNumberFor', (() => {
  const cases = [];
  for (let n = 1; n <= 500; n++) {
    cases.push({
      name: `forward=${n}`,
      fn: () => {
        const r = returnNumberFor(n);
        assert.equal(r % 2, 0, 'return number is even');
        assert.ok(r >= 0, 'return number is non-negative');
        assert.equal(r, toOdd(n) + 1);
      },
    });
  }
  return cases;
})());

itCases('incrementForward', (() => {
  const cases = [];
  for (let base = 1; base <= 100; base += 2) {
    for (let k = 0; k <= 20; k++) {
      cases.push({
        name: `base=${base},k=${k}`,
        fn: () => {
          const r = incrementForward(base, k);
          assert.equal(r % 2, 1);
          assert.equal(r, toOdd(base) + 2 * k);
        },
      });
    }
  }
  return cases;
})());

itCases('incrementTrailingNumber', (() => {
  const cases = [];
  const names = ['TGV 1', 'TGV 001', 'TER 2', 'RER A 10', 'Train ', 'Service 99', 'BB 26000 001', 'BR186-1'];
  for (const name of names) {
    for (let d = -5; d <= 10; d++) {
      cases.push({
        name: `${name}+${d}`,
        fn: () => {
          const r = incrementTrailingNumber(name, d);
          const m = name.match(/(\d+)$/);
          if (m) {
            const expected = String(parseInt(m[1], 10) + d).padStart(m[1].length, '0');
            assert.ok(r.includes(expected), `got ${r}, expected ${expected}`);
          } else {
            const n = 1 + d;
            if (n < 0) {
              assert.equal(r, name);
            } else {
              assert.ok(r.endsWith(String(n)), `got ${r}`);
            }
          }
        },
      });
    }
  }
  // extra random-like cases with original padding
  for (let i = 0; i < 300; i++) {
    const num = 100 + i;
    const d = (i % 21) - 10;
    cases.push({
      name: `auto ${i}`,
      fn: () => {
        const base = `Train ${num}`;
        const r = incrementTrailingNumber(base, d);
        const m = base.match(/(\d+)$/);
        const expected = String(num + d).padStart(m[1].length, '0');
        assert.equal(r, `Train ${expected}`);
      },
    });
  }
  return cases;
})());

// ---------------- interpolatePassageTimes ----------------
itCases('interpolatePassageTimes', (() => {
  const cases = [];
  for (let tA = 0; tA < 1440; tA += 60) {
    for (let tB = tA + 15; tB <= tA + 180 && tB < 1440; tB += 15) {
      for (let segments = 1; segments <= 8; segments++) {
        cases.push({
          name: `dep=${tA},arr=${tB},seg=${segments}`,
          fn: () => {
            const cumDists = [];
            for (let s = 0; s <= segments; s++) cumDists.push(s * 10);
            const times = interpolatePassageTimes(tA, tB, cumDists);
            assert.equal(times.length, cumDists.length);
            assert.equal(times[0], tA);
            assert.equal(times[times.length - 1], tB);
            for (let i = 1; i < times.length; i++) {
              assert.ok(times[i] >= times[i - 1] || Math.abs(times[i] - times[i - 1]) < 1e-9, 'monotonic');
            }
            const mid = Math.floor(segments / 2);
            assert.equal(Math.round(times[mid] * 1000), Math.round((tA + (tB - tA) * (mid / segments)) * 1000));
          },
        });
      }
    }
  }
  return cases;
})());

// ---------------- ServiceStop wrap ----------------
itCases('ServiceStop wrap time', (() => {
  const cases = [];
  for (let t = -1500; t <= 3000; t += 5) {
    cases.push({
      name: `time=${t}`,
      fn: () => {
        const s = new ServiceStop('A', 'arret', t, t);
        assert.ok(s.departureTime >= 0 && s.departureTime < 1440, `wrapped ${s.departureTime}`);
        assert.equal(s.departureTime, s.arrivalTime);
        if (t >= 0 && t < 1440) assert.equal(s.departureTime, t);
      },
    });
  }
  return cases;
})());

// ---------------- formatTime ----------------
itCases('formatTime', (() => {
  const cases = [];
  for (let m = 0; m < 1440; m++) {
    cases.push({
      name: `min=${m}`,
      fn: () => {
        const h = String(Math.floor(m / 60)).padStart(2, '0');
        const mn = String(m % 60).padStart(2, '0');
        assert.equal(formatTime(m), `${h}:${mn}`);
      },
    });
  }
  return cases;
})());

// ---------------- haversineDistance ----------------
itCases('haversineDistance', (() => {
  const cases = [];
  const cityPairs = [
    { a: [48.8566, 2.3522], b: [45.7640, 4.8357], expected: 392, label: 'Paris-Lyon' },
    { a: [48.8566, 2.3522], b: [43.2965, 5.3698], expected: 661, label: 'Paris-Marseille' },
    { a: [48.8566, 2.3522], b: [48.8566, 2.3522], expected: 0, label: 'same' },
    { a: [0, 0], b: [0, 1], expected: 111.2, label: 'equator 1 deg lon' },
    { a: [0, 0], b: [1, 0], expected: 111.2, label: '1 deg lat' },
    { a: [51.5074, -0.1278], b: [48.8566, 2.3522], expected: 344, label: 'London-Paris' },
    { a: [52.5200, 13.4050], b: [48.8566, 2.3522], expected: 878, label: 'Berlin-Paris' },
    { a: [40.7128, -74.0060], b: [51.5074, -0.1278], expected: 5570, label: 'NYC-London' },
  ];
  for (const pair of cityPairs) {
    cases.push({
      name: pair.label,
      fn: () => {
        const d = haversineDistance(pair.a[0], pair.a[1], pair.b[0], pair.b[1]);
        assert.ok(Math.abs(d - pair.expected) < 10, `${d} vs ${pair.expected}`);
        const d2 = haversineDistance(pair.b[0], pair.b[1], pair.a[0], pair.a[1]);
        assert.ok(Math.abs(d - d2) < 1e-6, 'symmetric');
      },
    });
  }
  // random invariant checks (seeded deterministic by test order)
  for (let i = 0; i < 1000; i++) {
    const lat1 = ((i * 137.5) % 180 - 90);
    const lon1 = ((i * 73.3) % 360 - 180);
    const lat2 = ((i * 211.7) % 180 - 90);
    const lon2 = ((i * 19.1) % 360 - 180);
    cases.push({
      name: `random ${i}`,
      fn: () => {
        const d1 = haversineDistance(lat1, lon1, lat2, lon2);
        const d2 = haversineDistance(lat2, lon2, lat1, lon1);
        assert.ok(d1 >= 0, 'non-negative');
        assert.ok(Math.abs(d1 - d2) < 1e-9, 'symmetric');
        const dSame = haversineDistance(lat1, lon1, lat1, lon1);
        assert.equal(dSame, 0);
      },
    });
  }
  return cases;
})());

// ---------------- visaSpeedCapKmh ----------------
itCases('visaSpeedCapKmh', (() => {
  const cases = [];
  const grid = [0, 30, 50, 90, 100, 150, 200, 250, 300, 400];
  for (const d of grid) {
    cases.push({
      name: `dist=${d}`,
      fn: () => {
        const c = visaSpeedCapKmh(d);
        if (d <= 30) assert.equal(c, 0);
        else if (d <= 100) assert.equal(c, 10);
        else if (d <= 200) assert.equal(c, 20);
        else if (d <= 300) assert.equal(c, 30);
        else assert.equal(c, null);
      },
    });
  }
  for (let d = 0; d <= 500; d += 10) {
    cases.push({
      name: `range d=${d}`,
      fn: () => {
        const c = visaSpeedCapKmh(d);
        assert.ok(c === null || [0, 10, 20, 30].includes(c));
      },
    });
  }
  return cases;
})());

// ---------------- aspectFromOccupancy / aspectSpeedCapKmh ----------------
itCases('aspectFromOccupancy', (() => {
  const cases = [];
  const combos = [
    [false, false, ASPECT.CLEAR],
    [true, false, ASPECT.CLOSED],
    [false, true, ASPECT.CAUTION],
    [true, true, ASPECT.CLOSED],
  ];
  for (const [next, second, exp] of combos) {
    cases.push({
      name: `next=${next},second=${second}`,
      fn: () => assert.equal(aspectFromOccupancy(next, second), exp),
    });
  }
  return cases;
})());

itCases('aspectSpeedCapKmh', (() => {
  const cases = [];
  const aspects = [ASPECT.CLEAR, ASPECT.CAUTION, ASPECT.CLOSED];
  const lineSpeeds = [30, 60, 100, 120, 160, 200, 250, 320];
  const dists = [0, 50, 100, 150, 200, 250, 300, 400, 1000];
  const RESTART_SPEED = 60;
  for (const aspect of aspects) {
    for (const lineSpeed of lineSpeeds) {
      for (const dist of dists) {
        cases.push({
          name: `${aspect}/v=${lineSpeed}/d=${dist}`,
          fn: () => {
            const cap = aspectSpeedCapKmh(aspect, lineSpeed, dist);
            assert.ok(typeof cap === 'number' && cap >= 0);
            if (aspect === ASPECT.CLEAR) assert.equal(cap, lineSpeed);
            if (aspect === ASPECT.CAUTION) assert.equal(cap, Math.min(lineSpeed, RESTART_SPEED));
            if (aspect === ASPECT.CLOSED) {
              const visa = visaSpeedCapKmh(dist);
              const expected = visa === null ? Math.min(lineSpeed, RESTART_SPEED) : visa;
              assert.equal(cap, expected);
            }
          },
        });
      }
    }
  }
  return cases;
})());

// ---------------- SeededRng ----------------
itCases('SeededRng determinism', (() => {
  const cases = [];
  for (let seed = 0; seed < 500; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const a = new SeededRng(seed);
        const b = new SeededRng(seed);
        for (let i = 0; i < 20; i++) assert.equal(a.random(), b.random());
        const v = a.random();
        assert.ok(v >= 0 && v < 1);
      },
    });
  }
  for (let n = 2; n <= 100; n++) {
    cases.push({
      name: `randomInt n=${n}`,
      fn: () => {
        const rng = new SeededRng(42);
        const v = rng.randomInt(n);
        assert.ok(v >= 0 && v < n);
      },
    });
  }
  return cases;
})());

// ---------------- Economy._calcInfrastructureToll ----------------
itCases('Economy toll formula', (() => {
  const cases = [];
  const countries = ['FR', 'DE', 'IT', 'ES', 'BE', 'NL', 'CH', 'AT', 'GB', 'PL', 'CZ', 'HU', 'XX'];
  const rames = [
    { maxSpeed: 160, totalTonnage: 100 },
    { maxSpeed: 320, totalTonnage: 400 },
    { maxSpeed: 80, totalTonnage: 1200 },
    { maxSpeed: 200, totalTonnage: 800 },
  ];
  const routeTemplates = [
    { maxSpeed: 160, tracks: 2, electrified: true, usage: 'main' },
    { maxSpeed: 30, tracks: 1, electrified: false, usage: 'service' },
    { maxSpeed: 320, tracks: 2, electrified: true, usage: 'main' },
    { maxSpeed: 250, tracks: 1, electrified: true, usage: 'main' },
    { maxSpeed: 120, tracks: 1, electrified: false, usage: 'branch' },
    { maxSpeed: 80, tracks: 3, electrified: true, usage: 'main' },
  ];
  const distances = [10, 50, 100, 250, 500];
  const economy = new Economy();
  let idx = 0;
  for (const country of countries) {
    for (const rame of rames) {
      for (const tpl of routeTemplates) {
        for (const dist of distances) {
          for (const extra of [0, 1]) {
            cases.push({
              name: `toll-${idx++}`,
              fn: () => {
                const route = [{ ...tpl }, { ...tpl }, { ...tpl }];
                if (extra) route.push({ maxSpeed: 80, tracks: 1, electrified: false, usage: 'service' });
                const toll = economy._calcInfrastructureToll(dist, route, rame, country);
                assert.ok(Number.isFinite(toll));
                assert.ok(toll >= 0);
                if (dist > 0) assert.ok(toll > 0);
                const fallback = Math.round(dist * 2.0);
                assert.ok(toll >= fallback * 0.1, 'not absurdly low');
              },
            });
          }
        }
      }
    }
  }
  return cases;
})());

// ---------------- PlayerSignal ----------------
itCases('PlayerSignal constructor', (() => {
  const cases = [];
  const types = ['ralentissement', 'avertissement', 'arret'];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `signal ${i}`,
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
        assert.ok(['ralentissement', 'avertissement', 'arret'].includes(s.type));
      },
    });
  }
  return cases;
})());

// Smoke count sanity check
describe('bulk10k meta', () => {
  it('suite loaded', () => assert.ok(true));
});
