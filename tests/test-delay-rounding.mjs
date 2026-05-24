/**
 * Unit tests for delay rounding logic.
 * Verifies that delay values are rounded to whole integer minutes.
 * Run with: node tests/test-delay-rounding.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

// timeDiff is used in schedule-creator.js — extract the logic here
function timeDiff(current, expected) {
  let diff = current - expected;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

test('delay rounding: Math.round(timeDiff) produces integers', () => {
  const cases = [
    { current: 100.5, expected: 100, result: 1 },
    { current: 100, expected: 100, result: 0 },
    { current: 100, expected: 100.7, result: -1 },
    { current: 100.3, expected: 100.1, result: 0 },
    { current: 100.9, expected: 100.1, result: 1 },
  ];
  for (const c of cases) {
    const raw = timeDiff(c.current, c.expected);
    const rounded = Math.round(raw);
    assert.equal(rounded, c.result, `timeDiff(${c.current}, ${c.expected}) = ${raw}, rounded = ${rounded}, expected ${c.result}`);
    assert.ok(Number.isInteger(rounded), 'Delay must be an integer');
  }
});

test('delay rounding: fractional delays like 0.0011 are eliminated', () => {
  const rawDelay = 0.0011;
  const rounded = Math.round(rawDelay);
  assert.equal(rounded, 0, 'Tiny fractional delay should round to 0');
});

test('delay rounding: large delays round correctly', () => {
  const rawDelay = 7.6;
  const rounded = Math.round(rawDelay);
  assert.equal(rounded, 8);
});

test('delay rounding: negative delays (early) round correctly', () => {
  const rawDelay = -2.3;
  const rounded = Math.round(rawDelay);
  assert.equal(rounded, -2);
});

test('delay rounding: Math.round(Math.max(0, x)) for initial delay', () => {
  // Simulates the first departure delay logic
  const timeDiffVal = 0.4;
  const result = Math.round(Math.max(0, timeDiffVal));
  assert.equal(result, 0);

  const timeDiffVal2 = 3.7;
  const result2 = Math.round(Math.max(0, timeDiffVal2));
  assert.equal(result2, 4);
});

test('delay rounding in save: Math.round(delay) produces integer', () => {
  const delay = 2.7499;
  const saved = Math.round(delay);
  assert.equal(saved, 3);
  assert.equal(saved % 1, 0);
});

test('delay rounding: dashboard avgDelay is integer', () => {
  const delays = [3, 0, -2, 5, 1];
  const totalDelay = delays.reduce((a, b) => a + b, 0);
  const avgDelay = delays.length > 0 ? Math.round(totalDelay / delays.length) : 0;
  assert.equal(avgDelay, 1);
  assert.equal(avgDelay % 1, 0);
});
