import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { timeDiff, timeGte, isInServiceWindow } from '../time-utils.js';

describe('timeDiff', () => {
  it('returns 0 for equal times', () => {
    assert.equal(timeDiff(600, 600), 0);
  });

  it('returns positive when A is later', () => {
    assert.equal(timeDiff(610, 600), 10);
  });

  it('returns negative when A is earlier', () => {
    assert.equal(timeDiff(590, 600), -10);
  });

  it('wraps forward across midnight', () => {
    // 00:05 (5 min) vs 23:55 (1435 min): 5 is 10 min after 1435
    const diff = timeDiff(5, 1435);
    assert.equal(diff, 10);
  });

  it('wraps backward across midnight', () => {
    // 23:55 vs 00:05: 1435 is 10 min before 5 → -10
    const diff = timeDiff(1435, 5);
    assert.equal(diff, -10);
  });

  it('clamps to [-720, 720]', () => {
    // Exactly 12 hours apart
    const diff = timeDiff(0, 720);
    assert.ok(diff >= -720 && diff <= 720);
  });

  it('handles same minute wrapping correctly', () => {
    assert.equal(timeDiff(0, 0), 0);
    assert.equal(timeDiff(1439, 1439), 0);
  });
});

describe('timeGte', () => {
  it('returns true when A equals B', () => {
    assert.equal(timeGte(600, 600), true);
  });

  it('returns true when A is after B', () => {
    assert.equal(timeGte(610, 600), true);
  });

  it('returns false when A is before B', () => {
    assert.equal(timeGte(590, 600), false);
  });

  it('handles midnight crossing: 00:05 >= 23:55', () => {
    assert.equal(timeGte(5, 1435), true);
  });

  it('handles midnight crossing: 23:50 < 00:05 → false', () => {
    assert.equal(timeGte(1430, 5), false);
  });
});

describe('isInServiceWindow', () => {
  it('returns true when time is within normal window', () => {
    assert.equal(isInServiceWindow(600, 500, 700), true);
  });

  it('returns false when time is before window', () => {
    assert.equal(isInServiceWindow(400, 500, 700), false);
  });

  it('returns false when time is after window', () => {
    assert.equal(isInServiceWindow(800, 500, 700), false);
  });

  it('returns true at window boundaries', () => {
    assert.equal(isInServiceWindow(500, 500, 700), true);
    assert.equal(isInServiceWindow(700, 500, 700), true);
  });

  it('handles midnight-crossing window (23:00-01:00)', () => {
    // 23:00 = 1380, 01:00 = 60
    assert.equal(isInServiceWindow(1400, 1380, 60), true); // 23:20
    assert.equal(isInServiceWindow(30, 1380, 60), true);    // 00:30
    assert.equal(isInServiceWindow(600, 1380, 60), false);  // 10:00
  });

  it('normalizes negative start/end times', () => {
    // -60 → 1380 (23:00), 60 → 60 (01:00)
    assert.equal(isInServiceWindow(1400, -60, 60), true);
  });

  it('normalizes times over 1440', () => {
    // 1500 → 60 (01:00), 1560 → 120 (02:00)
    assert.equal(isInServiceWindow(90, 1500, 1560), true);
  });
});
