import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ==========================================================================
// These tests verify the save/restore serialisation contract introduced by
// the "remove fast-forward" change.  Because schedule-creator.js uses
// browser-only versioned imports (e.g. './simulation.js?v=…') we cannot
// import it directly in Node.  Instead we replicate the exact serialisation
// and deserialisation logic here so the contract is tested independently.
// ==========================================================================

// --- helpers (mirror of schedule-creator.js compact format) ---

function encodeRuntimeState(svc) {
  const o = {
    ci: svc.currentStopIndex || 0,
    dir: svc.direction || 1,
    tc: svc._tripCount || 0,
    st: svc.state || 'waiting',
    sp: Math.round((svc.speed || 0) * 10) / 10,
    dl: Math.round((svc.delay || 0) * 100) / 100,
  };
  if (svc.isReturnLeg) o.rl = true;
  if (svc.completed) o.cp = true;
  if (svc.completedDate) o.cd = svc.completedDate;
  if (svc.position) {
    o.pos = [
      Math.round(svc.position.lat * 1e6) / 1e6,
      Math.round(svc.position.lon * 1e6) / 1e6,
    ];
  }
  if (svc._adjustedStops) {
    o.as = svc._adjustedStops.map(st => ({
      si: st.stationId, t: st.type, d: st.departureTime, a: st.arrivalTime,
    }));
  }
  return o;
}

function decodeRuntimeState(r) {
  return {
    direction: r.dir || 1,
    _tripCount: r.tc || 0,
    currentStopIndex: r.ci || 0,
    state: r.st || 'waiting',
    speed: r.sp || 0,
    delay: r.dl || 0,
    position: r.pos || null,
    isReturnLeg: r.rl || false,
    completed: r.cp || false,
    completedDate: r.cd || '',
    _adjustedStops: r.as
      ? r.as.map(s => ({ stationId: s.si, type: s.t, departureTime: s.d, arrivalTime: s.a }))
      : null,
  };
}

// ==========================================================================
// Serialisation round-trip tests
// ==========================================================================

describe('Runtime state serialisation', () => {
  it('round-trips a moving train with position', () => {
    const svc = {
      currentStopIndex: 3,
      direction: 1,
      _tripCount: 0,
      state: 'moving',
      speed: 142.5,
      delay: 2.75,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
      position: { lat: 48.856789, lon: 2.352345 },
      _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    const decoded = decodeRuntimeState(encoded);

    assert.equal(decoded.state, 'moving');
    assert.equal(decoded.speed, 142.5);
    assert.equal(decoded.delay, 2.75);
    assert.equal(decoded.currentStopIndex, 3);
    assert.deepEqual(decoded.position, [48.856789, 2.352345]);
    assert.equal(decoded.isReturnLeg, false);
    assert.equal(decoded.completed, false);
  });

  it('round-trips a return-leg train', () => {
    const svc = {
      currentStopIndex: 2,
      direction: -1,
      _tripCount: 1,
      state: 'moving',
      speed: 80,
      delay: 0,
      isReturnLeg: true,
      completed: false,
      completedDate: '',
      position: { lat: 45.764, lon: 4.8357 },
      _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    const decoded = decodeRuntimeState(encoded);

    assert.equal(decoded.isReturnLeg, true);
    assert.equal(decoded._tripCount, 1);
    assert.equal(decoded.direction, -1);
  });

  it('round-trips a completed service', () => {
    const svc = {
      currentStopIndex: 0,
      direction: 1,
      _tripCount: 0,
      state: 'waiting',
      speed: 0,
      delay: 0,
      isReturnLeg: false,
      completed: true,
      completedDate: '2026-05-24',
      position: null,
      _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    const decoded = decodeRuntimeState(encoded);

    assert.equal(decoded.completed, true);
    assert.equal(decoded.completedDate, '2026-05-24');
    assert.equal(decoded.state, 'waiting');
    assert.equal(decoded.position, null);
  });

  it('round-trips a stopped_at_station train', () => {
    const svc = {
      currentStopIndex: 5,
      direction: 1,
      _tripCount: 0,
      state: 'stopped_at_station',
      speed: 0,
      delay: 4.5,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
      position: { lat: 43.2965, lon: 5.3698 },
      _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    const decoded = decodeRuntimeState(encoded);

    assert.equal(decoded.state, 'stopped_at_station');
    assert.equal(decoded.speed, 0);
    assert.equal(decoded.delay, 4.5);
    assert.deepEqual(decoded.position, [43.2965, 5.3698]);
  });

  it('round-trips adjusted stops for multi-trip services', () => {
    const svc = {
      currentStopIndex: 1,
      direction: 1,
      _tripCount: 2,
      state: 'moving',
      speed: 100,
      delay: 0,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
      position: { lat: 48.5, lon: 2.5 },
      _adjustedStops: [
        { stationId: 'st-1', type: 'arret', departureTime: 600, arrivalTime: 600 },
        { stationId: 'st-2', type: 'passage', departureTime: 630, arrivalTime: 628 },
        { stationId: 'st-3', type: 'arret', departureTime: 660, arrivalTime: 655 },
      ],
    };
    const encoded = encodeRuntimeState(svc);
    const decoded = decodeRuntimeState(encoded);

    assert.equal(decoded._tripCount, 2);
    assert.ok(decoded._adjustedStops);
    assert.equal(decoded._adjustedStops.length, 3);
    assert.equal(decoded._adjustedStops[0].stationId, 'st-1');
    assert.equal(decoded._adjustedStops[1].type, 'passage');
    assert.equal(decoded._adjustedStops[2].arrivalTime, 655);
  });

  it('omits isReturnLeg flag when false (compact)', () => {
    const svc = {
      currentStopIndex: 0, direction: 1, _tripCount: 0,
      state: 'waiting', speed: 0, delay: 0,
      isReturnLeg: false, completed: false, completedDate: '',
      position: null, _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    assert.equal(encoded.rl, undefined, 'rl should not be present when false');
    assert.equal(encoded.cp, undefined, 'cp should not be present when false');
    assert.equal(encoded.cd, undefined, 'cd should not be present when empty');
    assert.equal(encoded.pos, undefined, 'pos should not be present when null');
    assert.equal(encoded.as, undefined, 'as should not be present when null');
  });
});

// ==========================================================================
// State restoration logic tests
// ==========================================================================

describe('loadFromSave state restoration', () => {
  function simulateRestore(runtime) {
    const savedState = runtime?.state || 'waiting';
    const savedPos = runtime?.position || null;
    const savedSpeed = runtime?.speed || 0;
    const savedDelay = runtime?.delay || 0;
    const savedStopIdx = runtime?.currentStopIndex || 0;
    const savedReturnLeg = runtime?.isReturnLeg || false;
    const savedCompleted = runtime?.completed || false;
    const savedCompletedDate = runtime?.completedDate || '';

    const svc = {};

    if ((savedState === 'moving' || savedState === 'stopped_at_station') && savedPos) {
      svc.state = savedState;
      svc.position = { lat: savedPos[0], lon: savedPos[1] };
      svc.speed = savedSpeed;
      svc.currentStopIndex = savedStopIdx;
      svc.delay = savedDelay;
      svc.trainDelay = Math.round(savedDelay);
      svc.trainSpeed = savedSpeed;
      svc.trainState = savedState === 'moving' ? 'moving' : 'stopped_at_station';
      svc.completed = false;
      svc.isReturnLeg = savedReturnLeg;
      svc._adjustedStopsCleared = false;
      svc._tripCountCleared = false;
      svc._resetStateCalled = false;
    } else {
      svc.state = 'waiting';
      svc.position = null;
      svc.speed = 0;
      svc.currentStopIndex = 0;
      svc.completed = savedCompleted;
      svc.completedDate = savedCompletedDate;
      svc.isReturnLeg = false;
      svc.delay = 0;
      svc.trainDelay = 0;
      svc.trainSpeed = 0;
      svc.trainState = 'waiting';
      svc._adjustedStopsCleared = true;
      svc._tripCountCleared = true;
      svc._resetStateCalled = true;
    }
    return svc;
  }

  it('restores mid-journey moving train', () => {
    const runtime = {
      state: 'moving',
      position: [48.8566, 2.3522],
      speed: 120,
      delay: 1.5,
      currentStopIndex: 4,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.state, 'moving');
    assert.deepEqual(svc.position, { lat: 48.8566, lon: 2.3522 });
    assert.equal(svc.speed, 120);
    assert.equal(svc.currentStopIndex, 4);
    assert.equal(svc.delay, 1.5);
    assert.equal(svc.trainDelay, 2);
    assert.equal(svc.completed, false);
    assert.equal(svc._adjustedStopsCleared, false, 'adjustedStops should NOT be cleared for mid-journey');
    assert.equal(svc._tripCountCleared, false, '_tripCount should NOT be cleared for mid-journey');
    assert.equal(svc._resetStateCalled, false, '_resetState should NOT be called for mid-journey');
  });

  it('restores stopped-at-station train', () => {
    const runtime = {
      state: 'stopped_at_station',
      position: [45.764, 4.8357],
      speed: 0,
      delay: 3,
      currentStopIndex: 2,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.state, 'stopped_at_station');
    assert.equal(svc.speed, 0);
    assert.equal(svc.trainState, 'stopped_at_station');
    assert.equal(svc._adjustedStopsCleared, false);
  });

  it('restores return-leg flag for mid-journey trains', () => {
    const runtime = {
      state: 'moving',
      position: [47.5, 3.0],
      speed: 80,
      delay: 0,
      currentStopIndex: 1,
      isReturnLeg: true,
      completed: false,
      completedDate: '',
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.isReturnLeg, true, 'Return leg should be preserved for mid-journey');
  });

  it('resets waiting trains to default state', () => {
    const runtime = {
      state: 'waiting',
      position: null,
      speed: 0,
      delay: 0,
      currentStopIndex: 0,
      isReturnLeg: false,
      completed: false,
      completedDate: '',
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.state, 'waiting');
    assert.equal(svc.position, null);
    assert.equal(svc.speed, 0);
    assert.equal(svc._adjustedStopsCleared, true, 'adjustedStops SHOULD be cleared for waiting');
    assert.equal(svc._tripCountCleared, true, '_tripCount SHOULD be cleared for waiting');
    assert.equal(svc._resetStateCalled, true, '_resetState SHOULD be called for waiting');
  });

  it('restores completed service state', () => {
    const runtime = {
      state: 'waiting',
      position: null,
      speed: 0,
      delay: 0,
      currentStopIndex: 0,
      isReturnLeg: false,
      completed: true,
      completedDate: '2026-05-24',
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.completed, true);
    assert.equal(svc.completedDate, '2026-05-24');
    assert.equal(svc.state, 'waiting');
  });

  it('falls back to waiting when no runtime provided', () => {
    const svc = simulateRestore(undefined);

    assert.equal(svc.state, 'waiting');
    assert.equal(svc.position, null);
    assert.equal(svc.speed, 0);
    assert.equal(svc.completed, false);
    assert.equal(svc.isReturnLeg, false);
  });

  it('falls back to waiting when position is missing for moving train', () => {
    const runtime = {
      state: 'moving',
      position: null,
      speed: 100,
      delay: 0,
      currentStopIndex: 2,
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.state, 'waiting', 'Should fall back to waiting without position');
    assert.equal(svc.position, null);
    assert.equal(svc.speed, 0);
  });

  it('correctly rounds train delay', () => {
    const runtime = {
      state: 'moving',
      position: [48.0, 2.0],
      speed: 100,
      delay: 2.7,
      currentStopIndex: 1,
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.trainDelay, 3, 'Math.round(2.7) should be 3');
  });

  it('zero delay rounds correctly', () => {
    const runtime = {
      state: 'moving',
      position: [48.0, 2.0],
      speed: 100,
      delay: 0.4,
      currentStopIndex: 1,
    };
    const svc = simulateRestore(runtime);

    assert.equal(svc.trainDelay, 0, 'Math.round(0.4) should be 0');
  });
});

// ==========================================================================
// Position precision tests
// ==========================================================================

describe('Position serialisation precision', () => {
  it('preserves 6 decimal places of lat/lon', () => {
    const pos = { lat: 48.123456789, lon: 2.987654321 };
    const encoded = [
      Math.round(pos.lat * 1e6) / 1e6,
      Math.round(pos.lon * 1e6) / 1e6,
    ];
    assert.equal(encoded[0], 48.123457);
    assert.equal(encoded[1], 2.987654);
  });

  it('handles negative coordinates', () => {
    const pos = { lat: -33.868820, lon: 151.209290 };
    const encoded = [
      Math.round(pos.lat * 1e6) / 1e6,
      Math.round(pos.lon * 1e6) / 1e6,
    ];
    assert.equal(encoded[0], -33.86882);
    assert.equal(encoded[1], 151.20929);
  });

  it('handles zero coordinates', () => {
    const pos = { lat: 0, lon: 0 };
    const encoded = [
      Math.round(pos.lat * 1e6) / 1e6,
      Math.round(pos.lon * 1e6) / 1e6,
    ];
    assert.equal(encoded[0], 0);
    assert.equal(encoded[1], 0);
  });
});

// ==========================================================================
// Edge cases & backward compatibility
// ==========================================================================

describe('Backward compatibility', () => {
  it('handles old save format without new runtime fields', () => {
    const oldRuntime = {
      dir: 1,
      tc: 0,
      ci: 0,
      st: 'waiting',
      sp: 0,
      dl: 0,
    };
    const decoded = decodeRuntimeState(oldRuntime);

    assert.equal(decoded.isReturnLeg, false);
    assert.equal(decoded.completed, false);
    assert.equal(decoded.completedDate, '');
    assert.equal(decoded.position, null);
  });

  it('handles old save format with position but no new fields', () => {
    const oldRuntime = {
      dir: 1,
      tc: 0,
      ci: 3,
      st: 'moving',
      sp: 120,
      dl: 0,
      pos: [48.8, 2.3],
    };
    const decoded = decodeRuntimeState(oldRuntime);

    assert.equal(decoded.state, 'moving');
    assert.equal(decoded.speed, 120);
    assert.deepEqual(decoded.position, [48.8, 2.3]);
    assert.equal(decoded.isReturnLeg, false);
    assert.equal(decoded.completed, false);
  });
});

describe('Speed precision', () => {
  it('rounds speed to 1 decimal place', () => {
    const svc = {
      currentStopIndex: 0, direction: 1, _tripCount: 0,
      state: 'moving', speed: 142.567, delay: 0,
      isReturnLeg: false, completed: false, completedDate: '',
      position: { lat: 48, lon: 2 }, _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    assert.equal(encoded.sp, 142.6);
  });

  it('rounds delay to 2 decimal places', () => {
    const svc = {
      currentStopIndex: 0, direction: 1, _tripCount: 0,
      state: 'moving', speed: 100, delay: 3.14159,
      isReturnLeg: false, completed: false, completedDate: '',
      position: { lat: 48, lon: 2 }, _adjustedStops: null,
    };
    const encoded = encodeRuntimeState(svc);
    assert.equal(encoded.dl, 3.14);
  });
});
