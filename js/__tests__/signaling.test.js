import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASPECT,
  CARRE_STOP_MARGIN_M,
  RESTART_SPEED_KMH,
  visaSpeedCapKmh,
  aspectFromOccupancy,
  aspectSpeedCapKmh,
} from '../signaling.js';

describe('SIG-05 / SIG-06 — VISA speed steps toward a closed signal', () => {
  it('stops inside the carré margin', () => {
    assert.equal(visaSpeedCapKmh(0), 0);
    assert.equal(visaSpeedCapKmh(CARRE_STOP_MARGIN_M), 0);
  });

  it('applies 10 / 20 / 30 at 100 / 200 / 300 m', () => {
    assert.equal(visaSpeedCapKmh(100), 10);
    assert.equal(visaSpeedCapKmh(200), 20);
    assert.equal(visaSpeedCapKmh(300), 30);
  });

  it('picks the nearest applicable step', () => {
    assert.equal(visaSpeedCapKmh(90), 10);
    assert.equal(visaSpeedCapKmh(150), 20);
    assert.equal(visaSpeedCapKmh(250), 30);
  });

  it('has no restriction beyond 300 m', () => {
    assert.equal(visaSpeedCapKmh(301), null);
    assert.equal(visaSpeedCapKmh(1000), null);
  });

  it('steps are non-decreasing with distance', () => {
    let prev = -1;
    for (let d = 40; d <= 300; d += 10) {
      const s = visaSpeedCapKmh(d);
      assert.ok(s >= prev, `cap(${d})=${s} should be >= ${prev}`);
      prev = s;
    }
  });
});

describe('SIG-03 / SIG-04 / SIG-05 — aspect from block occupancy', () => {
  it('voie libre when both blocks ahead are free', () => {
    assert.equal(aspectFromOccupancy(false, false), ASPECT.CLEAR);
  });

  it('avertissement when the second block is occupied', () => {
    assert.equal(aspectFromOccupancy(false, true), ASPECT.CAUTION);
  });

  it('carré when the next block is occupied', () => {
    assert.equal(aspectFromOccupancy(true, false), ASPECT.CLOSED);
    assert.equal(aspectFromOccupancy(true, true), ASPECT.CLOSED);
  });
});

describe('aspectSpeedCapKmh — combined cap', () => {
  it('clear = line speed', () => {
    assert.equal(aspectSpeedCapKmh(ASPECT.CLEAR, 160), 160);
  });

  it('caution never exceeds restart speed (SIG-04/SIG-07)', () => {
    assert.equal(aspectSpeedCapKmh(ASPECT.CAUTION, 160), RESTART_SPEED_KMH);
    assert.equal(aspectSpeedCapKmh(ASPECT.CAUTION, 40), 40);
  });

  it('closed applies VISA near the signal and stops at the margin', () => {
    assert.equal(aspectSpeedCapKmh(ASPECT.CLOSED, 160, 100), 10);
    assert.equal(aspectSpeedCapKmh(ASPECT.CLOSED, 160, 0), 0);
  });

  it('closed but still far = capped at restart speed, not full line speed', () => {
    assert.equal(aspectSpeedCapKmh(ASPECT.CLOSED, 160, 5000), RESTART_SPEED_KMH);
  });
});
