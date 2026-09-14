import { simulateProfileStream } from './physics-profile-stream.js';
import { rearClearanceCaps } from './physics-rear-clearance.js';
import { resolveRailSpeedLimits } from './rail-speed.js';
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
const G = 9.81; // m/s²
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
    if (!weather)
        return WEATHER_ADHESION.clear;
    return WEATHER_ADHESION[weather] ?? WEATHER_ADHESION.clear;
}
// PH-02 — Davis running resistance (N) for the whole trainset.
// A: bearing/rolling (∝ weight), B: flange/track (∝ weight·v),
// C: aerodynamic (∝ v²), scaled by an aero constant per metre of length.
export function resistanceN(massKg, vMs, gradePermille = 0, lengthM = 200) {
    const massT = massKg / 1000;
    const A = 6.4 * massT; // ~6.4 N per tonne at rest
    const B = 0.14 * massT; // N·s/m per tonne
    const cAero = 6.0 + 0.05 * lengthM; // longer trains have more drag
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
    if (powerW <= 0)
        return 0;
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
export function brakingDecelMs2(params, weather, gradePermille = 0) {
    const base = params.brakeServiceMs2 || 0.9; // typical service brake
    const mu = weatherAdhesion(weather || params.weather);
    const adhesionCap = mu * G * 0.5; // brakes never fully use adhesion; low-grip weather bites
    const brakeOnly = Math.min(base, adhesionCap);
    // +grade = uphill: gravity assists braking. -grade = downhill: gravity opposes it.
    // Keep a tiny positive floor so safety-distance maths never divides by zero.
    const gradeAssist = G * (Number(gradePermille || 0) / 1000);
    return Math.max(0.05, brakeOnly + gradeAssist);
}
// Distance (m) required to brake from v0 to vTarget at deceleration d.
export function brakingDistanceM(v0Ms, vTargetMs, decelMs2) {
    if (v0Ms <= vTargetMs)
        return 0;
    return (v0Ms * v0Ms - vTargetMs * vTargetMs) / (2 * decelMs2);
}
function routeInclinePermille(a, b) {
    const raw = b?.tags?.incline ?? a?.tags?.incline ?? b?.incline ?? a?.incline;
    if (raw == null || raw === '')
        return 0;
    const lower = String(raw).trim().toLowerCase();
    if (lower === 'up' || lower === 'down')
        return 0; // no numeric magnitude available
    const txt = lower.replace(',', '.');
    let value = Number.parseFloat(txt);
    if (!Number.isFinite(value))
        return 0;
    if (!txt.includes('‰'))
        value *= 10; // OSM plain / percent incline -> permille
    value = Math.max(-80, Math.min(80, value));
    const travelDir = b?.travelDirection || a?.travelDirection;
    if (travelDir === 'backward')
        value *= -1;
    return value;
}
// Build coarse segments [{distM, limitMs}] from an ORM route (array of points
// with lat/lon/maxSpeed) capped by the trainset max speed.
export function segmentsFromRoute(route, rameMaxSpeedKmh, haversineKm) {
    const segs = [];
    if (!Array.isArray(route) || route.length < 2)
        return segs;
    const rameCapKmh = Number(rameMaxSpeedKmh || 160);
    const cap = rameCapKmh * KMH_TO_MS;
    const resolved = resolveRailSpeedLimits(route, rameCapKmh);
    for (let i = 1; i < route.length; i++) {
        const distM = haversineKm(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon) * 1000;
        if (distM <= 0)
            continue;
        const limitKmh = resolved[i];
        segs.push({
            distM,
            limitMs: Math.min(cap, Number(limitKmh ?? rameCapKmh) * KMH_TO_MS),
            gradePermille: routeInclinePermille(route[i - 1], route[i]),
            electrified: route[i]?.electrified ?? route[i - 1]?.electrified ?? null,
            voltage: route[i]?.voltage || route[i - 1]?.voltage || [],
            frequency: route[i]?.frequency || route[i - 1]?.frequency || [],
            // Keep the original ORM route-pair index. This lets callers map the
            // physical time profile back to exact route progress without assuming
            // distance/time proportionality.
            sourceIndex: i - 1,
        });
    }
    return segs;
}
export const MAX_PROFILE_WORKSPACE_CELLS = 20000;
let lastProfileWorkspace = { streamed: false, totalCells: 0, residentCells: 0, cellStorageBytes: 0, windows: 0 };
/** Diagnostics describe numerical cell storage, not route metadata or output arrays. */
export function getLastProfileWorkspaceStats() { return { ...lastProfileWorkspace }; }
// Core simulation: integrate a run over `segments` and return the travel time.
//   segments: [{distM, limitMs}]  (limits already capped by rame max speed)
//   params:   { massKg, powerW, lengthM, weather, adhesionMassKg, brakeServiceMs2,
//               startMs=0, endMs=0, preBrakeMarginM=100, dsStep=20 }
// Returns { timeSec, distM, vMaxReachedMs }.
export function simulateProfile(segments, params = {}) {
    if (!Array.isArray(segments) || segments.length === 0) {
        lastProfileWorkspace = { streamed: false, totalCells: 0, residentCells: 0, cellStorageBytes: 0, windows: 0 };
        return { timeSec: 0, distM: 0, vMaxReachedMs: 0, segmentTimeSec: [] };
    }
    // At least two cells are required for a stop-to-stop run: one to
    // accelerate and one to brake. A single cell with endMs=0 cannot move.
    const routeDistM = segments.reduce((sum, seg) => sum + Math.max(0, seg.distM), 0);
    const dsStep = Math.min(Math.max(0.01, params.dsStep || 20), Math.max(0.001, routeDistM / 2));
    const preBrakeMarginM = params.preBrakeMarginM ?? 100;
    const longPneumatic = Number(params.brakeServiceMs2 || 0.9) <= 0.7 || Number(params.lengthM || 0) >= 450;
    const brakeBuildSec = Math.max(0.5, Number(params.brakeBuildSec ?? (longPneumatic
        ? Math.max(2.5, Math.min(7.0, 2.2 + Number(params.lengthM || 200) / 170))
        : Math.max(1.0, Math.min(2.5, 0.8 + Number(params.lengthM || 200) / 300)))));
    // RC4: compact structure-of-arrays sampler. The discretisation and arithmetic
    // order are unchanged; geometry/voltage arrays are shared through segment IDs
    // rather than copied into an object (plus two arrays) for every physics cell.
    let N = 0;
    for (const seg of segments)
        N += Math.max(1, Math.ceil(seg.distM / dsStep));
    if (!Number.isSafeInteger(N) || N < 1)
        throw new RangeError('Profil physique : taille numérique non représentable');
    const requested = Number(params.workspaceCellLimit);
    const capacity = Number.isFinite(requested) && requested >= 2 ? Math.min(MAX_PROFILE_WORKSPACE_CELLS, Math.floor(requested)) : MAX_PROFILE_WORKSPACE_CELLS;
    const streamed = N > capacity;
    lastProfileWorkspace = { streamed, totalCells: N, residentCells: Math.min(N, capacity), cellStorageBytes: (streamed ? 20 * capacity : 45 * N), windows: Math.ceil(N / capacity) };
    if (streamed)
        return simulateProfileStream(segments, params, { cellCount: N, capacity, dsStep, preBrakeMarginM, brakeBuildSec, brake: brakingDecelMs2, accel: accelerationMs2, power: profileSegmentPower });
    const cellDistance = new Float64Array(N);
    const cellSegment = new Uint32Array(N);
    const originalLimit = new Float64Array(N);
    const transitionUp = new Uint8Array(N);
    const sourceIndexes = new Uint32Array(segments.length);
    const segmentDecel = new Float64Array(segments.length);
    let totalDist = 0;
    let prevLimit = segments[0].limitMs;
    let cellIndex = 0;
    let maxSourceIndex = 0;
    for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const seg = segments[segIndex];
        const n = Math.max(1, Math.ceil(seg.distM / dsStep));
        const step = seg.distM / n;
        const isUp = seg.limitMs > prevLimit + 1e-6;
        const sourceIndex = Number.isInteger(seg.sourceIndex) ? Number(seg.sourceIndex) : segIndex;
        sourceIndexes[segIndex] = sourceIndex;
        maxSourceIndex = Math.max(maxSourceIndex, sourceIndex);
        segmentDecel[segIndex] = brakingDecelMs2(params, params.weather, Number(seg.gradePermille || 0));
        for (let k = 0; k < n; k++, cellIndex++) {
            cellDistance[cellIndex] = step;
            cellSegment[cellIndex] = segIndex;
            originalLimit[cellIndex] = seg.limitMs;
            transitionUp[cellIndex] = isUp && k === 0 ? 1 : 0;
            totalDist += step;
        }
        prevLimit = seg.limitMs;
    }
    // 2) VIT-03 — shift each speed REDUCTION upstream by preBrakeMargin so the
    //    lower speed is reached before the slower zone, then run a backward
    //    braking pass so braking is always physically feasible.
    const limit = originalLimit.slice();
    // Detect transitions on immutable infrastructure limits. Never detect a
    // second transition at the boundary of a margin we have just inserted.
    for (let i = N - 1; i > 0; i--) {
        if (originalLimit[i] < originalLimit[i - 1] - 1e-6) {
            const approachMs = Math.max(originalLimit[i - 1], originalLimit[i]);
            const shiftM = preBrakeMarginM + approachMs * brakeBuildSec * 0.5;
            let acc = 0, j = i - 1;
            while (j >= 0 && acc < shiftM) {
                limit[j] = Math.min(limit[j], originalLimit[i]);
                acc += cellDistance[j];
                j--;
            }
        }
    }
    const vCap = limit.slice();
    vCap[N - 1] = Math.min(vCap[N - 1], params.endMs ?? 0);
    for (let i = N - 2; i >= 0; i--) {
        const decel = segmentDecel[cellSegment[i + 1]];
        const brakeable = Math.sqrt(vCap[i + 1] * vCap[i + 1] + 2 * decel * cellDistance[i + 1]);
        vCap[i] = Math.min(limit[i], brakeable);
    }
    // Runtime reserves roughly v*build/2 metres before a full brake is established.
    // Overlay the same rule for the terminal stop so timetable and runtime use the
    // same stopping envelope rather than an instantaneous full-brake assumption.
    {
        let remainingM = 0;
        const target = Math.max(0, Number(params.endMs ?? 0));
        for (let i = N - 1; i >= 0; i--) {
            remainingM += cellDistance[i];
            const a = segmentDecel[cellSegment[i]];
            const ab = a * brakeBuildSec;
            const discriminant = ab * ab + 4 * (target * target + 2 * a * remainingM);
            const capWithBuild = Math.max(target, (-ab + Math.sqrt(Math.max(0, discriminant))) / 2);
            vCap[i] = Math.min(vCap[i], capWithBuild);
        }
    }
    // 3) VIT-02 — after a speed INCREASE, hold the old limit until the whole
    //    train length has cleared the transition point.
    const holdUntilDist = rearClearanceCaps(cellDistance, originalLimit, transitionUp, params.lengthM || 200);
    // Electrical compatibility depends on infrastructure, not on cell speed.
    // Resolve it once per segment instead of once per numerical cell.
    const segmentPower = new Float64Array(segments.length);
    for (let i = 0; i < segments.length; i++)
        segmentPower[i] = profileSegmentPower(segments[i], params);
    // One private parameter object: never mutate the caller's (possibly frozen)
    // profile, and never allocate a spread copy in the hot integration loop.
    const localParams = { ...params, powerW: 0 };
    // 4) Forward pass — accelerate under physics, respecting caps.
    let v = Math.max(0, params.startMs ?? 0);
    let timeSec = 0;
    let vMaxReached = 0;
    const collectSegmentTimes = params.collectSegmentTimes !== false;
    const segmentTimeSec = collectSegmentTimes ? new Float64Array(maxSourceIndex + 1) : null;
    for (let i = 0; i < N; i++) {
        const ds = cellDistance[i];
        let cap = vCap[i];
        if (holdUntilDist[i] > 0)
            cap = Math.min(cap, holdUntilDist[i]); // VIT-02 hold
        const vStart = v;
        const segIndex = cellSegment[i];
        localParams.powerW = segmentPower[segIndex];
        const grade = Number(segments[segIndex].gradePermille || 0);
        const a = accelerationMs2(localParams, v, grade);
        // Net resistance still acts when already at the line limit. Ignoring a<0
        // allowed underpowered freight trains to climb indefinitely at Vmax.
        let nextSquared = v * v + 2 * a * ds;
        if (a < 0 && nextSquared <= 0 && v > 0 && accelerationMs2(localParams, 0, grade) > 0) {
            // A coarse cell must not overshoot the traction equilibrium into a
            // fictitious stall. Locate the sustainable speed within [0, v].
            let lo = 0, hi = v;
            for (let k = 0; k < 24; k++) {
                const mid = (lo + hi) / 2;
                if (accelerationMs2(localParams, mid, grade) > 0)
                    lo = mid;
                else
                    hi = mid;
            }
            nextSquared = lo * lo;
        }
        v = Math.min(cap, Math.sqrt(Math.max(0, nextSquared)));
        if (vStart + v <= 1e-9) {
            return { timeSec: Infinity, distM: totalDist, vMaxReachedMs: vMaxReached,
                segmentTimeSec: segmentTimeSec ? Array.from(segmentTimeSec) : [] };
        }
        // Exact kinematic cell time under the local constant-acceleration model.
        // Using ds/finalSpeed made acceleration unrealistically fast in timetable
        // calculations and made braking use a different integration convention.
        const speedSum = vStart + v;
        const dtCell = (2 * ds) / speedSum;
        timeSec += dtCell;
        if (segmentTimeSec)
            segmentTimeSec[sourceIndexes[segIndex]] += dtCell;
        if (v > vMaxReached)
            vMaxReached = v;
    }
    return { timeSec, distM: totalDist, vMaxReachedMs: vMaxReached, segmentTimeSec: segmentTimeSec ? Array.from(segmentTimeSec) : [] };
}
export const _units = { G, KMH_TO_MS, MS_TO_KMH };
function profileSegmentPower(cell, params) {
    const ep = Math.max(0, Number(params.electricPowerW || 0)), dp = Math.max(0, Number(params.dieselPowerW || 0));
    if (!ep && !dp)
        return Number(params.powerW || 0);
    // Unknown electrification is not a ban. A known non-electrified or
    // incompatible section, however, must never borrow electric power.
    if (cell?.electrified !== false && ep > 0) {
        const systems = Array.isArray(params.electricSystems) ? params.electricSystems : [], volts = cell.voltage || [], freqs = (cell.frequency || []).length ? (cell.frequency ?? []) : [0];
        if (!systems.length || !volts.length)
            return Math.min(Number(params.powerW) || ep + dp, ep + dp);
        for (const sys of systems)
            for (const vv of volts)
                for (const ff of freqs) {
                    const vok = !Number(sys?.voltage) || Math.abs(Number(sys.voltage) - Number(vv)) <= Math.max(50, Number(vv) * 0.03);
                    const fok = !Number(sys?.frequency) || !Number(ff) || Math.abs(Number(sys.frequency) - Number(ff)) <= 1;
                    if (vok && fok)
                        return Math.min(Number(params.powerW) || ep + dp, ep + dp);
                }
    }
    if (dp > 0)
        return dp;
    return 0;
}
