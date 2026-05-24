import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { timeDiff, timeGte, isInServiceWindow } from '../time-utils.js';

// All times are in minutes since midnight (0 = 00:00, 1439 = 23:59)

describe('timeDiff', () => {
  it('returns 0 for identical times', () => {
    assert.equal(timeDiff(600, 600), 0);
  });

  it('returns positive when A is after B (same day)', () => {
    // 10:00 - 08:00 = 120 min
    assert.equal(timeDiff(600, 480), 120);
  });

  it('returns negative when A is before B (same day)', () => {
    // 08:00 - 10:00 = -120 min
    assert.equal(timeDiff(480, 600), -120);
  });

  it('handles midnight wrapping (A near 00:00, B near 23:00)', () => {
    // 00:30 (30) vs 23:00 (1380): should be +90 (30 minutes after midnight is 90 minutes after 23:00)
    const d = timeDiff(30, 1380);
    assert.equal(d, 90);
  });

  it('handles midnight wrapping (A near 23:00, B near 00:00)', () => {
    // 23:00 (1380) vs 00:30 (30): should be -90
    const d = timeDiff(1380, 30);
    assert.equal(d, -90);
  });

  it('clamps large positive differences via wrapping', () => {
    // 23:59 (1439) vs 00:00 (0): raw diff = 1439, wrapped = -1
    const d = timeDiff(1439, 0);
    assert.equal(d, -1);
  });

  it('clamps large negative differences via wrapping', () => {
    // 00:00 (0) vs 23:59 (1439): raw diff = -1439, wrapped = 1
    const d = timeDiff(0, 1439);
    assert.equal(d, 1);
  });

  it('handles exactly 12 hours apart (720 min)', () => {
    assert.equal(timeDiff(720, 0), 720);
  });
});

describe('timeGte', () => {
  it('returns true when A == B', () => {
    assert.ok(timeGte(600, 600));
  });

  it('returns true when A > B (same day)', () => {
    assert.ok(timeGte(700, 600));
  });

  it('returns false when A < B (same day)', () => {
    assert.ok(!timeGte(600, 700));
  });

  it('returns true when A is just after midnight and B is just before', () => {
    // 00:05 (5) vs 23:55 (1435): A is 10 minutes after B
    assert.ok(timeGte(5, 1435));
  });

  it('returns false when A is just before midnight and B is just after', () => {
    // 23:55 (1435) vs 00:05 (5): A is 10 minutes before B
    assert.ok(!timeGte(1435, 5));
  });
});

describe('isInServiceWindow', () => {
  it('returns true when time is inside a normal window', () => {
    // Window: 08:00 (480) to 18:00 (1080), time: 12:00 (720)
    assert.ok(isInServiceWindow(720, 480, 1080));
  });

  it('returns false when time is outside a normal window', () => {
    // Window: 08:00 to 18:00, time: 20:00 (1200)
    assert.ok(!isInServiceWindow(1200, 480, 1080));
  });

  it('returns true at exact start of window', () => {
    assert.ok(isInServiceWindow(480, 480, 1080));
  });

  it('returns true at exact end of window', () => {
    assert.ok(isInServiceWindow(1080, 480, 1080));
  });

  it('handles midnight-crossing window (23:00 to 01:00)', () => {
    // Window: 23:00 (1380) to 01:00 (60)
    assert.ok(isInServiceWindow(1400, 1380, 60));  // 23:20 — inside
    assert.ok(isInServiceWindow(30, 1380, 60));     // 00:30 — inside
    assert.ok(!isInServiceWindow(120, 1380, 60));   // 02:00 — outside
    assert.ok(!isInServiceWindow(720, 1380, 60));   // 12:00 — outside
  });

  it('handles midnight-crossing at exact boundaries', () => {
    assert.ok(isInServiceWindow(1380, 1380, 60));  // start boundary
    assert.ok(isInServiceWindow(60, 1380, 60));     // end boundary
  });

  it('handles window that is the entire day', () => {
    // start == end: special case (should be treated as a point)
    assert.ok(isInServiceWindow(600, 600, 600));
  });

  it('returns false for time before normal window', () => {
    assert.ok(!isInServiceWindow(300, 480, 1080));
  });

  it('normalizes negative start/end values', () => {
    // -60 should normalize to 1380 (23:00)
    assert.ok(isInServiceWindow(1400, -60, 60));
  });

  it('normalizes values greater than 1440', () => {
    // 1500 should normalize to 60 (01:00)
    assert.ok(isInServiceWindow(720, 480, 1500));
  });
});
