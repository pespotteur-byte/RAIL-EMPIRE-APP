import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
    // effectiveSpeed should be min(200, 160) = 160
    assert.equal(result.segments[0].effectiveSpeed, 160);
  });

  it('computes correct cumulative distance', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 160 },
      { lat: 48.1, lon: 2.0, maxSpeed: 160 },
      { lat: 48.2, lon: 2.0, maxSpeed: 160 },
    ];
    const result = analyzeRoute(route, 200);
    assert.equal(result.segments.length, 2);
    const seg0Dist = result.segments[0].distance;
    const seg1Dist = result.segments[1].distance;
    assert.ok(Math.abs(result.totalDistance - (seg0Dist + seg1Dist)) < 0.001);
    assert.ok(Math.abs(result.segments[1].cumulativeDistance - result.totalDistance) < 0.001);
  });

  it('uses train speed when lower than segment speed', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 300 },
      { lat: 48.1, lon: 2.0, maxSpeed: 300 },
    ];
    const result = analyzeRoute(route, 120);
    assert.equal(result.segments[0].effectiveSpeed, 120);
  });

  it('uses segment speed when lower than train speed', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 80 },
      { lat: 48.1, lon: 2.0, maxSpeed: 80 },
    ];
    const result = analyzeRoute(route, 200);
    assert.equal(result.segments[0].effectiveSpeed, 80);
  });

  it('defaults maxSpeed to 160 when not set', () => {
    const route = [
      { lat: 48.0, lon: 2.0 },
      { lat: 48.1, lon: 2.0 },
    ];
    const result = analyzeRoute(route, 200);
    assert.equal(result.segments[0].maxSpeed, 160);
    assert.equal(result.segments[0].effectiveSpeed, 160);
  });

  it('computes time correctly: time = distance / speed * 60', () => {
    const route = [
      { lat: 48.0, lon: 2.0, maxSpeed: 100 },
      { lat: 48.1, lon: 2.0, maxSpeed: 100 },
    ];
    const result = analyzeRoute(route, 100);
    const expectedTime = (result.segments[0].distance / 100) * 60;
    assert.ok(
      Math.abs(result.segments[0].timeMinutes - expectedTime) < 0.001,
      `Expected ${expectedTime}, got ${result.segments[0].timeMinutes}`
    );
  });
});

// ============================================================
// CantonManager
// ============================================================

describe('CantonManager', () => {
  let cm;

  beforeEach(() => {
    cm = new CantonManager();
    // Stub window.game for _isTrainGone
    globalThis.window = { game: null };
  });

  describe('_geoKey', () => {
    it('produces the same key regardless of direction (A->B == B->A)', () => {
      const k1 = cm._geoKey(48.0, 2.0, 49.0, 3.0);
      const k2 = cm._geoKey(49.0, 3.0, 48.0, 2.0);
      assert.equal(k1, k2);
    });

    it('produces different keys for different coordinates', () => {
      const k1 = cm._geoKey(48.0, 2.0, 49.0, 3.0);
      const k2 = cm._geoKey(48.0, 2.0, 50.0, 4.0);
      assert.notEqual(k1, k2);
    });
  });

  describe('createRouteCantons', () => {
    it('returns empty for null/short route', () => {
      assert.deepEqual(cm.createRouteCantons(null), []);
      assert.deepEqual(cm.createRouteCantons([{ lat: 48, lon: 2 }]), []);
    });

    it('creates cantons for a simple route', () => {
      const route = [];
      for (let i = 0; i < 20; i++) {
        route.push({ lat: 48 + i * 0.01, lon: 2, maxSpeed: 100 });
      }
      const assignments = cm.createRouteCantons(route);
      assert.ok(assignments.length > 0, 'Should create at least one canton');
      // Verify assignments cover the entire route
      assert.equal(assignments[0].startIndex, 0);
      assert.equal(assignments[assignments.length - 1].endIndex, route.length - 1);
    });

    it('caches route cantons for the same route', () => {
      const route = [
        { lat: 48.0, lon: 2.0, maxSpeed: 100 },
        { lat: 48.1, lon: 2.0, maxSpeed: 100 },
        { lat: 48.2, lon: 2.0, maxSpeed: 100 },
      ];
      const a1 = cm.createRouteCantons(route);
      const a2 = cm.createRouteCantons(route);
      assert.equal(a1, a2, 'Should return same cached reference');
    });
  });

  describe('reserve / occupy / release', () => {
    it('allows reservation of unoccupied canton', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: null });
      assert.ok(cm.reserve('c1', 'train-1'));
    });

    it('prevents reservation by a different train when occupied', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-1', reservedBy: null });
      assert.ok(!cm.reserve('c1', 'train-2'));
    });

    it('allows same train to reserve already-reserved canton', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: 'train-1' });
      assert.ok(cm.reserve('c1', 'train-1'));
    });

    it('occupy sets occupiedBy and clears reservedBy', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: 'train-1' });
      cm.occupy('c1', 'train-1');
      const c = cm.cantons.get('c1');
      assert.equal(c.occupiedBy, 'train-1');
      assert.equal(c.reservedBy, null);
    });

    it('release clears occupation and reservation', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-1', reservedBy: null });
      cm.trainCantons.set('train-1', new Set(['c1']));
      cm.release('c1', 'train-1');
      const c = cm.cantons.get('c1');
      assert.equal(c.occupiedBy, null);
    });

    it('releaseAll clears all cantons for a train', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-1', reservedBy: null });
      cm.cantons.set('c2', { id: 'c2', occupiedBy: 'train-1', reservedBy: null });
      cm.trainCantons.set('train-1', new Set(['c1', 'c2']));
      cm.releaseAll('train-1');
      assert.equal(cm.cantons.get('c1').occupiedBy, null);
      assert.equal(cm.cantons.get('c2').occupiedBy, null);
      assert.ok(!cm.trainCantons.has('train-1'));
    });
  });

  describe('isAvailable', () => {
    it('returns true for unknown canton', () => {
      assert.ok(cm.isAvailable('unknown', 'train-1'));
    });

    it('returns true for unoccupied/unreserved canton', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: null });
      assert.ok(cm.isAvailable('c1', 'train-1'));
    });

    it('returns true for canton occupied by same train', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-1', reservedBy: null });
      assert.ok(cm.isAvailable('c1', 'train-1'));
    });

    it('returns false for canton occupied by different train', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-2', reservedBy: null });
      // _isTrainGone returns false when window.game is null
      assert.ok(!cm.isAvailable('c1', 'train-1'));
    });
  });

  describe('getCantonForSegment', () => {
    it('finds correct canton for a segment index', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
      ];
      assert.equal(cm.getCantonForSegment(assignments, 0).cantonId, 'c0');
      assert.equal(cm.getCantonForSegment(assignments, 4).cantonId, 'c0');
      assert.equal(cm.getCantonForSegment(assignments, 5).cantonId, 'c1');
      assert.equal(cm.getCantonForSegment(assignments, 9).cantonId, 'c1');
    });

    it('returns null for out-of-range segment index', () => {
      const assignments = [{ cantonId: 'c0', startIndex: 0, endIndex: 5 }];
      assert.equal(cm.getCantonForSegment(assignments, 10), null);
    });
  });

  describe('getNextCanton', () => {
    it('returns next canton after current', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
        { cantonId: 'c2', startIndex: 10, endIndex: 15 },
      ];
      const next = cm.getNextCanton(assignments, 3);
      assert.equal(next.cantonId, 'c1');
    });

    it('returns null for last canton', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
      ];
      assert.equal(cm.getNextCanton(assignments, 7), null);
    });
  });

  describe('getSignalAspect', () => {
    it('returns null (green) when next canton is available', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
        { cantonId: 'c2', startIndex: 10, endIndex: 15 },
      ];
      // All cantons unoccupied
      cm.cantons.set('c0', { id: 'c0', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c2', { id: 'c2', occupiedBy: null, reservedBy: null });
      assert.equal(cm.getSignalAspect(assignments, 2, 'train-1'), null);
    });

    it('returns 0 (red) when next canton is occupied', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
      ];
      cm.cantons.set('c0', { id: 'c0', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c1', { id: 'c1', occupiedBy: 'train-2', reservedBy: null });
      assert.equal(cm.getSignalAspect(assignments, 2, 'train-1'), 0);
    });

    it('returns 30 (yellow) when two-ahead canton is occupied', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
        { cantonId: 'c1', startIndex: 5, endIndex: 10 },
        { cantonId: 'c2', startIndex: 10, endIndex: 15 },
      ];
      cm.cantons.set('c0', { id: 'c0', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c2', { id: 'c2', occupiedBy: 'train-2', reservedBy: null });
      assert.equal(cm.getSignalAspect(assignments, 2, 'train-1'), 30);
    });

    it('returns null when there is no next canton (end of route)', () => {
      const assignments = [
        { cantonId: 'c0', startIndex: 0, endIndex: 5 },
      ];
      cm.cantons.set('c0', { id: 'c0', occupiedBy: null, reservedBy: null });
      assert.equal(cm.getSignalAspect(assignments, 2, 'train-1'), null);
    });
  });

  describe('cleanup', () => {
    it('removes idle cantons not tracked by any train', () => {
      cm.cantons.set('c1', { id: 'c1', occupiedBy: null, reservedBy: null });
      cm.cantons.set('c2', { id: 'c2', occupiedBy: 'train-1', reservedBy: null });
      cm.trainCantons.set('train-1', new Set(['c2']));
      cm.cleanup();
      assert.ok(!cm.cantons.has('c1'), 'Idle canton should be removed');
      assert.ok(cm.cantons.has('c2'), 'Active canton should remain');
    });

    it('evicts routeCantons cache when exceeding 200 entries', () => {
      for (let i = 0; i < 250; i++) {
        cm.routeCantons.set(`route-${i}`, []);
      }
      cm.cleanup();
      assert.ok(cm.routeCantons.size <= 200, `Expected <= 200, got ${cm.routeCantons.size}`);
    });
  });
});
