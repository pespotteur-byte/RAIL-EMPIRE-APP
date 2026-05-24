import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Stub browser globals used by CantonManager._isTrainGone
globalThis.window = { game: null };

import { haversineDistance, analyzeRoute, CantonManager } from '../simulation.js';

// ============================================================
// haversineDistance
// ============================================================

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    assert.equal(haversineDistance(48.8566, 2.3522, 48.8566, 2.3522), 0);
  });

  it('computes Paris to Lyon (~392 km)', () => {
    const d = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);
    assert.ok(d > 390 && d < 395, `Expected ~392 km, got ${d}`);
  });

  it('computes Paris to Marseille (~660 km)', () => {
    const d = haversineDistance(48.8566, 2.3522, 43.2965, 5.3698);
    assert.ok(d > 655 && d < 665, `Expected ~660 km, got ${d}`);
  });

  it('is symmetric (A->B == B->A)', () => {
    const ab = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);
    const ba = haversineDistance(45.7640, 4.8357, 48.8566, 2.3522);
    assert.ok(Math.abs(ab - ba) < 0.001, 'Haversine should be symmetric');
  });

  it('handles negative coordinates (Southern/Western hemispheres)', () => {
    const d = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    assert.ok(d > 700 && d < 720, `Expected ~714 km (Sydney to Melbourne), got ${d}`);
  });

  it('handles meridian crossing (lon sign change)', () => {
    const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(d > 330 && d < 350, `Expected ~343 km (London to Paris), got ${d}`);
  });

  it('handles very small distances (~100m)', () => {
    const d = haversineDistance(48.8566, 2.3522, 48.8575, 2.3530);
    assert.ok(d > 0.05 && d < 0.2, `Expected ~0.1 km, got ${d}`);
  });

  it('handles antipodal points (~20000 km)', () => {
    const d = haversineDistance(0, 0, 0, 180);
    assert.ok(d > 20000 && d < 20100, `Expected ~20015 km, got ${d}`);
  });
});

// ============================================================
// analyzeRoute
// ============================================================

describe('analyzeRoute', () => {
  it('returns empty for null route', () => {
    const result = analyzeRoute(null, 160);
    assert.deepEqual(result, { segments: [], totalDistance: 0, estimatedTimeMinutes: 0 });
  });

  it('returns empty for single-point route', () => {
    const result = analyzeRoute([{ lat: 48, lon: 2 }], 160);
    assert.deepEqual(result, { segments: [], totalDistance: 0, estimatedTimeMinutes: 0 });
  });

  it('computes segments for a 2-point route', () => {
    const route = [
      { lat: 48.8566, lon: 2.3522, maxSpeed: 160 },
      { lat: 48.9, lon: 2.4, maxSpeed: 160 },
    ];
    const result = analyzeRoute(route, 200);
    assert.equal(result.segments.length, 1);
    assert.ok(result.totalDistance > 0);
    assert.ok(result.estimatedTimeMinutes > 0);
    assert.equal(result.segments[0].effectiveSpeed, 160);
  });

  it('computes correct cumulative distance', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 160 },
      { lat: 48.1, lon: 2.0, maxSpeed: 160 },
      { lat: 48.2, lon: 2.0, maxSpeed: 160 },
    ];
    const result = analyzeRoute(route, 300);
    assert.equal(result.segments.length, 2);
    const seg0dist = result.segments[0].distance;
    const seg1dist = result.segments[1].distance;
    assert.ok(Math.abs(result.totalDistance - (seg0dist + seg1dist)) < 0.001);
    assert.equal(result.segments[0].cumulativeDistance, seg0dist);
    assert.equal(result.segments[1].cumulativeDistance, seg0dist + seg1dist);
  });

  it('enforces effective speed = min(trainMax, segmentMax)', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 300 },
      { lat: 48.1, lon: 2.0, maxSpeed: 100 },
      { lat: 48.2, lon: 2.0, maxSpeed: 300 },
    ];
    const result = analyzeRoute(route, 200);
    assert.equal(result.segments[0].effectiveSpeed, 100);
    assert.equal(result.segments[1].effectiveSpeed, 200);
  });
});

// ============================================================
// CantonManager
// ============================================================

describe('CantonManager', () => {
  let cm;

  beforeEach(() => {
    cm = new CantonManager();
  });

  describe('createRouteCantons', () => {
    it('creates cantons for a short route', () => {
      const route = [];
      for (let i = 0; i < 20; i++) {
        route.push({ lat: 48 + i * 0.01, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      assert.ok(assignments.length > 0, 'Should create at least one canton');
      assert.equal(assignments[0].startIndex, 0);
    });

    it('returns empty for degenerate routes', () => {
      assert.deepEqual(cm.createRouteCantons([]), []);
      assert.deepEqual(cm.createRouteCantons([{ lat: 48, lon: 2 }]), []);
    });
  });

  describe('occupy / release', () => {
    it('allows a train to occupy an unoccupied canton', () => {
      const route = [];
      for (let i = 0; i < 50; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      assert.ok(assignments.length > 0);
      const cantonId = assignments[0].cantonId;
      const result = cm.occupy(cantonId, 'train-1');
      assert.equal(result, true);
    });

    it('blocks a second train from the same canton', () => {
      const route = [];
      for (let i = 0; i < 50; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      const cantonId = assignments[0].cantonId;
      cm.occupy(cantonId, 'train-1');
      const result = cm.occupy(cantonId, 'train-2');
      assert.equal(result, false);
    });

    it('allows re-occupation after release', () => {
      const route = [];
      for (let i = 0; i < 50; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      const cantonId = assignments[0].cantonId;
      cm.occupy(cantonId, 'train-1');
      cm.release(cantonId, 'train-1');
      const result = cm.occupy(cantonId, 'train-2');
      assert.equal(result, true);
    });
  });

  describe('getSignalAspect', () => {
    it('returns null (green) when next canton is clear', () => {
      const route = [];
      for (let i = 0; i < 100; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length < 2) return;
      const aspect = cm.getSignalAspect(assignments, 0, 'train-1');
      assert.equal(aspect, null);
    });

    it('returns 0 (red) when next canton is occupied by another train', () => {
      const route = [];
      for (let i = 0; i < 100; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length < 2) return;
      cm.occupy(assignments[1].cantonId, 'train-2');
      const aspect = cm.getSignalAspect(assignments, 0, 'train-1');
      assert.equal(aspect, 0);
    });

    it('returns 30 (yellow) for two-block look-ahead warning', () => {
      const route = [];
      for (let i = 0; i < 200; i++) {
        route.push({ lat: 48 + i * 0.003, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length < 3) return;
      cm.occupy(assignments[2].cantonId, 'train-2');
      const aspect = cm.getSignalAspect(assignments, 0, 'train-1');
      assert.equal(aspect, 30);
    });
  });

  describe('getNextCanton', () => {
    it('returns the next canton after current segment', () => {
      const route = [];
      for (let i = 0; i < 100; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length < 2) return;
      const next = cm.getNextCanton(assignments, 0);
      assert.ok(next !== null);
      assert.equal(next.cantonId, assignments[1].cantonId);
    });

    it('returns null for the last canton', () => {
      const route = [];
      for (let i = 0; i < 100; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length === 0) return;
      const lastCantonStart = assignments[assignments.length - 1].startIndex;
      const next = cm.getNextCanton(assignments, lastCantonStart);
      assert.equal(next, null);
    });
  });

  describe('releaseAll', () => {
    it('releases all cantons for a train', () => {
      const route = [];
      for (let i = 0; i < 100; i++) {
        route.push({ lat: 48 + i * 0.005, lon: 2, maxSpeed: 160 });
      }
      const assignments = cm.createRouteCantons(route);
      if (assignments.length < 2) return;
      cm.occupy(assignments[0].cantonId, 'train-1');
      cm.occupy(assignments[1].cantonId, 'train-1');
      cm.releaseAll('train-1');
      assert.equal(cm.isAvailable(assignments[0].cantonId, 'train-2'), true);
      assert.equal(cm.isAvailable(assignments[1].cantonId, 'train-2'), true);
    });
  });
});
