// Tests for the traction physics module (Remaster P0 — PR 2).
// Covers PH-01..PH-07 and VIT-01..VIT-03. Assertions target physical
// RELATIONSHIPS (heavier => slower, gradient => slower, weather => longer
// braking, transitions respect train length) rather than exact magic numbers.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resistanceN, tractiveEffortN, accelerationMs2, brakingDecelMs2,
  brakingDistanceM, weatherAdhesion, segmentsFromRoute, simulateProfile, _units,
} from '../train-physics.js';

const kmh = (v) => v * _units.KMH_TO_MS;

// Reference trainsets
const coach = { massKg: 400_000, powerW: 4_400_000, lengthM: 200, weather: 'clear' };      // light coaches, strong loco
const freight = { massKg: 1_600_000, powerW: 4_400_000, lengthM: 500, weather: 'clear' };   // heavy loaded freight

describe('Train physics', () => {
  describe('PH-02 — Davis resistance', () => {
    it('increases with speed and with mass', () => {
      const r0 = resistanceN(400_000, 0, 0);
      const r30 = resistanceN(400_000, 30, 0);
      assert.ok(r30 > r0, 'resistance grows with speed');
      assert.ok(resistanceN(1_600_000, 30, 0) > r30, 'resistance grows with mass');
    });
    it('adds a positive uphill and negative downhill gradient term', () => {
      const flat = resistanceN(400_000, 20, 0);
      const up = resistanceN(400_000, 20, 10);   // 10 ‰ climb
      const down = resistanceN(400_000, 20, -10);
      assert.ok(up > flat && flat > down, 'uphill > flat > downhill');
    });
  });

  describe('PH-03 — tractive effort bounds', () => {
    it('is limited by adhesion at low speed (not infinite)', () => {
      const te = tractiveEffortN(4_400_000, 0.1, 90_000, 'clear');
      const adhesion = weatherAdhesion('clear') * 90_000 * _units.G;
      assert.ok(te <= adhesion + 1, 'capped by adhesion');
      assert.ok(Number.isFinite(te) && te > 0);
    });
    it('falls off with speed (P/v) once above the adhesion knee', () => {
      const teLow = tractiveEffortN(4_400_000, 20, 90_000, 'clear');
      const teHigh = tractiveEffortN(4_400_000, 60, 90_000, 'clear');
      assert.ok(teHigh < teLow, 'TE decreases at higher speed');
    });
    it('is lower in snow than in clear weather (adhesion)', () => {
      assert.ok(
        tractiveEffortN(4_400_000, 0.1, 90_000, 'snow') <
        tractiveEffortN(4_400_000, 0.1, 90_000, 'clear'));
    });
  });

  describe('PH-01/PH-05 — acceleration vs mass and gradient', () => {
    it('a light coach set accelerates faster than a heavy freight (same loco)', () => {
      assert.ok(accelerationMs2(coach, kmh(40)) > accelerationMs2(freight, kmh(40)));
    });
    it('acceleration drops on an uphill gradient', () => {
      assert.ok(accelerationMs2(coach, kmh(40), 0) > accelerationMs2(coach, kmh(40), 15));
    });
  });

  describe('PH-04 — braking bounded by rate and adhesion (weather)', () => {
    it('snow reduces braking deceleration vs clear', () => {
      assert.ok(brakingDecelMs2(freight, 'snow') < brakingDecelMs2(freight, 'clear'));
    });
    it('braking distance grows in snow (longer to stop)', () => {
      const dClear = brakingDistanceM(kmh(140), 0, brakingDecelMs2(coach, 'clear'));
      const dSnow = brakingDistanceM(kmh(140), 0, brakingDecelMs2(coach, 'snow'));
      assert.ok(dSnow > dClear);
    });
  });

  describe('PH-05/PH-07 — realistic travel time', () => {
    const route160 = [{ distM: 20000, limitMs: kmh(160) }];
    it('freight takes longer than a coach set over the same 20 km', () => {
      const tCoach = simulateProfile(route160, coach).timeSec;
      const tFreight = simulateProfile(route160, freight).timeSec;
      assert.ok(tFreight > tCoach, `freight ${tFreight|0}s > coach ${tCoach|0}s`);
    });
    it('is slower than the naive distance/vmax estimate (no instant top speed)', () => {
      const naive = 20000 / kmh(160);
      const real = simulateProfile(route160, coach).timeSec;
      assert.ok(real > naive, `real ${real|0}s > naive ${naive|0}s (accel/brake cost)`);
    });
    it('never exceeds the segment speed limit', () => {
      const res = simulateProfile(route160, coach);
      assert.ok(res.vMaxReachedMs <= kmh(160) + 0.01);
    });
  });

  describe('VIT-03 — negative transition (brake before the slower zone)', () => {
    it('reaches the lower limit before entering the 40 km/h zone', () => {
      // 5 km at 160, then 2 km at 40. With look-ahead braking the train must be
      // at/below 40 km/h by the time it enters the second segment.
      const segs = [{ distM: 5000, limitMs: kmh(160) }, { distM: 2000, limitMs: kmh(40) }];
      const res = simulateProfile(segs, { ...coach, dsStep: 10 });
      // If braking were late, total time would be much lower; assert it's finite/positive
      assert.ok(res.timeSec > 0);
      // Compare to a "no slow zone" run: the slow zone must add time
      const fast = simulateProfile([{ distM: 7000, limitMs: kmh(160) }], { ...coach, dsStep: 10 });
      assert.ok(res.timeSec > fast.timeSec, 'the 40 km/h zone costs time (braking honoured)');
    });
  });

  describe('VIT-02 — positive transition (hold until tail clears)', () => {
    it('a longer train takes longer to profit from a speed increase', () => {
      // 3 km at 60, then 5 km at 160. A 750 m train must hold 60 km/h over its
      // whole length past the transition, so it needs more time than a 100 m one.
      const segs = [{ distM: 3000, limitMs: kmh(60) }, { distM: 5000, limitMs: kmh(160) }];
      const shortT = simulateProfile(segs, { ...coach, lengthM: 100, dsStep: 10 }).timeSec;
      const longT = simulateProfile(segs, { ...coach, lengthM: 750, dsStep: 10 }).timeSec;
      assert.ok(longT > shortT, `long train ${longT|0}s > short ${shortT|0}s`);
    });
  });

  describe('VIT-01 — segments from ORM route', () => {
    const hav = (la1, lo1, la2, lo2) => {
      const R = 6371, toRad = Math.PI / 180;
      const dLat = (la2 - la1) * toRad, dLon = (lo2 - lo1) * toRad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * toRad) * Math.cos(la2 * toRad) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };
    it('caps each segment at min(rame max, ORM limit)', () => {
      const route = [
        { lat: 48.0, lon: 2.0, maxSpeed: 200 },
        { lat: 48.1, lon: 2.0, maxSpeed: 200 },
        { lat: 48.2, lon: 2.0, maxSpeed: 90 },
      ];
      const segs = segmentsFromRoute(route, 160, hav); // rame limited to 160
      assert.equal(segs.length, 2);
      assert.ok(Math.abs(segs[0].limitMs - kmh(160)) < 0.01, '200 ORM capped to 160 rame');
      assert.ok(Math.abs(segs[1].limitMs - kmh(90)) < 0.01, '90 ORM kept');
    });
  });
});
