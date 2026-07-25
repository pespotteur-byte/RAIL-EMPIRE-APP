// Train traction physics (Remaster P0 — PR 2).
// Pure, dependency-free module. All internal maths in SI units (kg, m, s, N);
// speeds are converted from km/h at the boundary.
//
// Checklist coverage:
//   PH-01 accel/decel from engine power + total mass + gradient
//   PH-02 Davis resistance R = A + B·v + C·v² (+ gradient component)
//   PH-03 tractive effort bounded by power/speed AND adhesion
//   PH-04 braking bounded by the trainset brake rate AND adhesion (weather)
//   PH-05 a loaded freight accelerates/brakes visibly slower than a light coach set
//   PH-06 freight mass reflects real payload per wagon (caller passes massKg)
//   PH-07 realistic (non-optimistic) travel time → fixes "trains in advance"
//   VIT-01 per-segment speed limit honoured (segments come from ORM)
//   VIT-02 positive transition: only accelerate once the whole train length has
//          cleared the transition point
//   VIT-03 negative transition: the lower speed is reached ~preBrakeMargin metres
//          BEFORE the slower zone
//   VIT-04/05 speed capping is the caller's (routing already caps service tracks)

const G = 9.81;             // m/s²
const KMH_TO_MS = 1 / 3.6;
const MS_TO_KMH = 3.6;

// Adhesion coefficient (wheel/rail) by weather — drives both max tractive
// effort and max braking deceleration.
const WEATHER_ADHESION = {
  clear: 0.33, cloudy: 0.33, wind: 0.33,
  light_rain: 0.28, rain: 0.25, heavy_rain: 0.22,
  storm: 0.20, snow: 0.15,
};

export function weatherAdhesion(weather) {
  if (!weather) return WEATHER_ADHESION.clear;
  return WEATHER_ADHESION[weather] ?? WEATHER_ADHESION.clear;
}

// PH-02 — Davis running resistance (N) for the whole trainset.
// A: bearing/rolling (∝ weight), B: flange/track (∝ weight·v),
// C: aerodynamic (∝ v²), scaled by an aero constant per metre of length.
export function resistanceN(massKg, vMs, gradePermille = 0, lengthM = 200) {
  const massT = massKg / 1000;
  const A = 6.4 * massT;                 // ~6.4 N per tonne at rest
  const B = 0.14 * massT;                // N·s/m per tonne
  const cAero = 6.0 + 0.05 * lengthM;    // longer trains have more drag
  const C = cAero;
  const rolling = A + B * vMs + C * vMs * vMs;
  const grade = massKg * G * (gradePermille / 1000); // +uphill, -downhill
  return rolling + grade;
}

// PH-03 — tractive effort (N) available at a given speed.
// Bounded by installed power (TE = P/v) and by adhesion (μ·m_adh·g).
export function tractiveEffortN(powerW, vMs, adhesionMassKg, weather) {
  const mu = weatherAdhesion(weather);
  const adhesionLimit = mu * adhesionMassKg * G;
  if (powerW <= 0) return 0;
  const vFloor = Math.max(vMs, 2.0); // avoid divide-by-zero / infinite TE at v≈0
  const teFromPower = powerW / vFloor;
  return Math.min(teFromPower, adhesionLimit);
}

// PH-01/PH-03 — net acceleration (m/s²) at a given speed.
export function accelerationMs2(params, vMs, gradePermille = 0) {
  const { massKg, powerW, lengthM = 200, weather } = params;
  const adhesionMassKg = params.adhesionMassKg || massKg;
  const te = tractiveEffortN(powerW, vMs, adhesionMassKg, weather);
  const res = resistanceN(massKg, vMs, gradePermille, lengthM);
  return (te - res) / massKg;
}

// PH-04 — max service braking deceleration (m/s²), bounded by the trainset
// brake rate and by adhesion (weather). Value is positive.
export function brakingDecelMs2(params, weather) {
  const base = params.brakeServiceMs2 || 0.9; // typical service brake
  const mu = weatherAdhesion(weather || params.weather);
  const adhesionCap = mu * G * 0.5;           // brakes never fully use adhesion; low-grip weather bites
  return Math.min(base, adhesionCap);
}

// Distance (m) required to brake from v0 to vTarget at deceleration d.
export function brakingDistanceM(v0Ms, vTargetMs, decelMs2) {
  if (v0Ms <= vTargetMs) return 0;
  return (v0Ms * v0Ms - vTargetMs * vTargetMs) / (2 * decelMs2);
}

// Build coarse segments [{distM, limitMs}] from an ORM route (array of points
// with lat/lon/maxSpeed) capped by the trainset max speed.
export function segmentsFromRoute(route, rameMaxSpeedKmh, haversineKm) {
  const segs = [];
  if (!Array.isArray(route) || route.length < 2) return segs;
  const cap = (rameMaxSpeedKmh || 160) * KMH_TO_MS;
  for (let i = 1; i < route.length; i++) {
    const distM = haversineKm(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon) * 1000;
    if (distM <= 0) continue;
    const limitKmh = route[i].maxSpeed || route[i - 1].maxSpeed || 160;
    segs.push({ distM, limitMs: Math.min(cap, limitKmh * KMH_TO_MS) });
  }
  return segs;
}

// Core simulation: integrate a run over `segments` and return the travel time.
//   segments: [{distM, limitMs}]  (limits already capped by rame max speed)
//   params:   { massKg, powerW, lengthM, weather, adhesionMassKg, brakeServiceMs2,
//               startMs=0, endMs=0, preBrakeMarginM=100, dsStep=20 }
// Returns { timeSec, distM, vMaxReachedMs }.
export function simulateProfile(segments, params = {}) {
  const res = simulateProfileCumulative(segments, params, []);
  return { timeSec: res.timeSec, distM: res.distM, vMaxReachedMs: res.vMaxReachedMs };
}

// Cumulative version: same physics as simulateProfile, but also returns the
// time (in seconds) when the train reaches each distance in queryDistancesM.
// queryDistancesM must be in metres and non-negative.
// Returns { timeSec, distM, vMaxReachedMs, queryTimesSec }.
export function simulateProfileCumulative(segments, params = {}, queryDistancesM = []) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { timeSec: 0, distM: 0, vMaxReachedMs: 0, queryTimesSec: [] };
  }
  const dsStep = params.dsStep || 20;
  const preBrakeMarginM = params.preBrakeMarginM ?? 100;
  const decel = brakingDecelMs2(params, params.weather);

  // 1) Sample the run into fixed-length cells, each carrying its speed limit.
  const cells = []; // { limitMs, transitionUp:bool }
  let totalDist = 0;
  let prevLimit = segments[0].limitMs;
  for (const seg of segments) {
    const n = Math.max(1, Math.round(seg.distM / dsStep));
    const step = seg.distM / n;
    const isUp = seg.limitMs > prevLimit + 1e-6;
    for (let k = 0; k < n; k++) {
      cells.push({ ds: step, limitMs: seg.limitMs, transitionUp: isUp && k === 0 });
      totalDist += step;
    }
    prevLimit = seg.limitMs;
  }
  const N = cells.length;

  // 2) VIT-03 — shift each speed REDUCTION upstream by preBrakeMargin so the
  //    lower speed is reached before the slower zone, then run a backward
  //    braking pass so braking is always physically feasible.
  const limit = cells.map(c => c.limitMs);
  for (let i = N - 1; i > 0; i--) {
    if (limit[i] < limit[i - 1] - 1e-6) {
      let acc = 0, j = i - 1;
      while (j >= 0 && acc < preBrakeMarginM) {
        if (limit[j] > limit[i]) limit[j] = limit[i];
        acc += cells[j].ds; j--;
      }
    }
  }
  const vCap = limit.slice();
  vCap[N - 1] = Math.min(vCap[N - 1], params.endMs ?? 0);
  for (let i = N - 2; i >= 0; i--) {
    const brakeable = Math.sqrt(vCap[i + 1] * vCap[i + 1] + 2 * decel * cells[i + 1].ds);
    vCap[i] = Math.min(limit[i], brakeable);
  }

  // 3) VIT-02 — after a speed INCREASE, hold the old limit until the whole
  //    train length has cleared the transition point.
  const holdUntilDist = new Array(N).fill(0); // old-limit speed cap per cell
  {
    let dist = 0;
    const L = params.lengthM || 200;
    for (let i = 0; i < N; i++) {
      if (cells[i].transitionUp && i > 0) {
        const oldLimit = cells[i - 1].limitMs;
        let d = dist;
        for (let j = i; j < N && d < dist + L; j++) {
          holdUntilDist[j] = Math.max(holdUntilDist[j], oldLimit);
          d += cells[j].ds;
        }
      }
      dist += cells[i].ds;
    }
  }

  // Prepare query distances, sorted, while remembering original positions.
  const queries = (Array.isArray(queryDistancesM) ? queryDistancesM : [])
    .map((d, idx) => ({ d, idx }))
    .filter(x => Number.isFinite(x.d) && x.d >= 0)
    .sort((a, b) => a.d - b.d);
  const queryTimesSec = new Array(queries.length).fill(0);

  // 4) Forward pass — accelerate under physics, respecting caps, and record
  //    the time at every requested distance.
  let v = Math.max(0, params.startMs ?? 0);
  let timeSec = 0;
  let cumDist = 0;
  let vMaxReached = 0;
  let qi = 0;

  for (let i = 0; i < N; i++) {
    const ds = cells[i].ds;
    let cap = vCap[i];
    if (holdUntilDist[i] > 0) cap = Math.min(cap, holdUntilDist[i]);

    // Compute the speed at the end of the cell first, then use the average
    // speed for the cell travel time.  This avoids the old bug where the
    // final stopping cell (v -> 0) was inflated by clamping v to 0.5 m/s.
    let vNext = v;
    if (v > cap) {
      vNext = cap;
    } else if (v < cap) {
      const a = accelerationMs2(params, v);
      if (a > 0) {
        vNext = Math.min(cap, Math.sqrt(v * v + 2 * a * ds));
      }
    }

    // Answer queries that fall inside this cell.
    while (qi < queries.length && queries[qi].d <= cumDist + ds + 1e-9) {
      const target = queries[qi].d;
      const dx = Math.max(0, Math.min(ds, target - cumDist));
      let vPartial;
      if (dx <= 0) {
        vPartial = v;
      } else if (v > cap) {
        vPartial = cap;
      } else if (v < cap) {
        const a = accelerationMs2(params, v);
        if (a > 0) {
          if (dx >= ds - 1e-9) {
            vPartial = vNext;
          } else {
            vPartial = Math.min(cap, Math.sqrt(v * v + 2 * a * dx));
          }
        } else {
          vPartial = Math.min(cap, v);
        }
      } else {
        vPartial = v;
      }
      const vAvg = Math.max(0.5, (v + vPartial) / 2);
      queryTimesSec[queries[qi].idx] = timeSec + dx / vAvg;
      qi++;
    }

    const vAvg = Math.max(0.5, (v + vNext) / 2);
    timeSec += ds / vAvg;
    if (vNext > vMaxReached) vMaxReached = vNext;
    v = vNext;
    cumDist += ds;
  }

  // Any remaining queries beyond the route end get the total time.
  while (qi < queries.length) {
    queryTimesSec[queries[qi].idx] = timeSec;
    qi++;
  }

  return { timeSec, distM: totalDist, vMaxReachedMs: vMaxReached, queryTimesSec };
}

export const _units = { G, KMH_TO_MS, MS_TO_KMH };
