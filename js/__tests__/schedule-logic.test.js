import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TERMINUS_WAIT_MIN,
  SKIP_PROBABILITY,
  toOdd,
  returnNumberFor,
  incrementForward,
  parseStopType,
  rollSkip,
  shouldSkipStop,
  interpolatePassageTimes,
} from '../schedule-logic.js';

describe('SC-06 — terminus wait default', () => {
  it('defaults to 5 minutes', () => {
    assert.equal(DEFAULT_TERMINUS_WAIT_MIN, 5);
  });
});

describe('SC-03 — odd (aller) / even (retour) numbering', () => {
  it('forces odd numbers for the aller', () => {
    assert.equal(toOdd(1), 1);
    assert.equal(toOdd(2), 3);
    assert.equal(toOdd(0), 1);
    assert.equal(toOdd(4), 5);
  });

  it('return number is the next even after the aller number', () => {
    assert.equal(returnNumberFor(1), 2);
    assert.equal(returnNumberFor(3), 4);
    assert.equal(returnNumberFor(2), 4); // 2 -> odd 3 -> 4
    assert.ok(returnNumberFor(7) % 2 === 0);
  });

  it('increments forward numbers by 2 (stays odd)', () => {
    assert.equal(incrementForward(1, 1), 3);
    assert.equal(incrementForward(1, 2), 5);
    assert.equal(incrementForward(3, 3), 9);
    for (let k = 0; k < 10; k++) {
      assert.ok(incrementForward(1, k) % 2 === 1);
    }
  });
});

describe('ARR-01/02/03 — stop type parsing', () => {
  it('recognises bracketed [C]/[S] as skippable', () => {
    assert.deepEqual(parseStopType('Melun [C]'), { code: 'C', skippable: true, clean: 'Melun' });
    assert.deepEqual(parseStopType('Sens [S]'), { code: 'S', skippable: true, clean: 'Sens' });
  });

  it('accepts parentheses too', () => {
    assert.equal(parseStopType('Melun (S)').code, 'S');
    assert.equal(parseStopType('Melun (s)').skippable, true);
  });

  it('treats a bare C/S suffix as an incompressible stop', () => {
    assert.deepEqual(parseStopType('Dijon C'), { code: 'C', skippable: false, clean: 'Dijon' });
    assert.equal(parseStopType('Dijon S').skippable, false);
  });

  it('no marker = no code, not skippable', () => {
    assert.deepEqual(parseStopType('Paris Gare de Lyon'), { code: null, skippable: false, clean: 'Paris Gare de Lyon' });
  });
});

describe('ARR-04/05 — skip draw', () => {
  it('uses a 25% probability', () => {
    assert.equal(SKIP_PROBABILITY, 0.25);
    assert.equal(rollSkip(() => 0.24), true);
    assert.equal(rollSkip(() => 0.25), false);
    assert.equal(rollSkip(() => 0.99), false);
  });

  it('never skips a non-skippable stop even on a low draw', () => {
    assert.equal(shouldSkipStop('Dijon', () => 0.0), false);
    assert.equal(shouldSkipStop('Dijon C', () => 0.0), false);
  });

  it('skips a bracketed stop only when the draw is under 25%', () => {
    assert.equal(shouldSkipStop('Melun [C]', () => 0.10), true);
    assert.equal(shouldSkipStop('Melun [C]', () => 0.90), false);
  });

  it('draw is re-rolled each circulation (independent of seed)', () => {
    // Simulate 3 circulations with different draws → different outcomes.
    const draws = [0.1, 0.5, 0.2];
    let i = 0;
    const rng = () => draws[i++];
    const outcomes = draws.map(() => shouldSkipStop('Melun [C]', rng));
    assert.deepEqual(outcomes, [true, false, true]);
  });
});

describe('SC-02 — passage times interpolated by distance', () => {
  it('endpoints match departure and arrival', () => {
    const t = interpolatePassageTimes(600, 700, [0, 50, 100]);
    assert.equal(t[0], 600);
    assert.equal(t[2], 700);
  });

  it('midpoint by distance gets the proportional time', () => {
    // A at 0 km / 600 min, B at 200 km / 700 min; station at 50 km => 25%
    const t = interpolatePassageTimes(600, 700, [0, 50, 200]);
    assert.equal(t[1], 625);
  });

  it('handles a degenerate zero-length leg', () => {
    const t = interpolatePassageTimes(600, 600, [0, 0, 0]);
    assert.deepEqual(t, [600, 600, 600]);
  });

  it('returns empty for empty input', () => {
    assert.deepEqual(interpolatePassageTimes(0, 10, []), []);
  });
});
