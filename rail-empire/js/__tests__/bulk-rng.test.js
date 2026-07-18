import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng, setGlobalRng, getGlobalRng } from '../rng.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('SeededRng determinism across seeds', (() => {
  const cases = [];
  for (let seed = 0; seed < 2000; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const a = new SeededRng(seed);
        const b = new SeededRng(seed);
        for (let i = 0; i < 50; i++) {
          assert.equal(a.random(), b.random(), `step ${i}`);
        }
      },
    });
  }
  return cases;
})());

itCases('SeededRng range and monotonic moments', (() => {
  const cases = [];
  for (let seed = 1; seed <= 500; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const rng = new SeededRng(seed);
        let sum = 0;
        let min = 1;
        let max = 0;
        for (let i = 0; i < 100; i++) {
          const v = rng.random();
          assert.ok(v >= 0 && v < 1, `out of range ${v}`);
          sum += v;
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
        assert.ok(max > min, 'not constant');
        assert.ok(sum / 100 > 0.3 && sum / 100 < 0.7, `mean ${sum / 100}`);
      },
    });
  }
  return cases;
})());

itCases('SeededRng randomInt bounds', (() => {
  const cases = [];
  for (let n = 1; n <= 100; n++) {
    for (let seed = 1; seed <= 10; seed++) {
      cases.push({
        name: `n=${n},seed=${seed}`,
        fn: () => {
          const rng = new SeededRng(seed);
          for (let i = 0; i < 20; i++) {
            const v = rng.randomInt(n);
            assert.ok(Number.isInteger(v));
            assert.ok(v >= 0 && v < n, `${v} not in [0,${n})`);
          }
        },
      });
    }
  }
  return cases;
})());

itCases('SeededRng state save/restore', (() => {
  const cases = [];
  for (let seed = 1; seed <= 1000; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const rng = new SeededRng(seed);
        for (let i = 0; i < 25; i++) rng.random();
        const state = rng.getState();
        const expected = [];
        for (let i = 0; i < 10; i++) expected.push(rng.random());
        const restored = new SeededRng(0);
        restored.setState(state);
        for (let i = 0; i < expected.length; i++) {
          assert.equal(restored.random(), expected[i]);
        }
      },
    });
  }
  return cases;
})());

itCases('global RNG can be swapped', (() => {
  const cases = [];
  for (let seed = 1; seed <= 500; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const rng = new SeededRng(seed);
        const twin = new SeededRng(seed);
        setGlobalRng(rng);
        const g = getGlobalRng();
        assert.equal(g, rng);
        assert.equal(g.random(), twin.random());
        setGlobalRng(null);
      },
    });
  }
  return cases;
})());

describe('bulk-rng meta', () => {
  it('loaded', () => assert.ok(true));
});
