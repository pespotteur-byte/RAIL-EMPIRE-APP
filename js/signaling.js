// Railway signaling & block sections (Remaster P0 — SIG).
// Pure, dependency-free module: block-length scale, signal aspects, VISA speed
// steps and restart rule. Distances in metres, speeds in km/h unless noted.
//
// Checklist coverage:
//   SIG-01 canton (block) length scales with line speed
//   SIG-03 "voie libre" (clear)        → line speed limit
//   SIG-04 "avertissement" (caution)   → be able to stop at next signal
//   SIG-05 "carré/fermé" (closed)      → mandatory stop 25-50 m upstream
//   SIG-06 VISA: 30 km/h @300 m, 20 @200 m, 10 @100 m from the closed signal
//   SIG-07 restart from a re-opened carré: <=60 km/h then VISA
// (SIG-02 "one train per canton" lives in CantonManager, simulation.js.)

// Signal aspects.
export const ASPECT = {
  CLEAR: 'clear',       // voie libre (VL)
  CAUTION: 'caution',   // avertissement
  CLOSED: 'closed',     // carré / sémaphore fermé
};

// Distance (m) at which a train must be stopped before a closed signal.
export const CARRE_STOP_MARGIN_M = 30; // within the 25-50 m band (SIG-05)

// Speed (km/h) allowed when restarting past a re-opened carré (SIG-07),
// before VISA takes over again.
export const RESTART_SPEED_KMH = 60;

// VISA steps: [maxDistanceM, speedKmh], evaluated nearest-first.
const VISA_STEPS = [
  [100, 10],
  [200, 20],
  [300, 30],
];

// SIG-01 — target block (canton) length in km as a function of line speed.
// Faster lines need longer blocks so braking distance fits inside one canton.
// Tunable to match the doc barème (A3.2).
export function cantonLengthKm(lineSpeedKmh) {
  const v = lineSpeedKmh || 0;
  if (v <= 40) return 0.5;
  if (v <= 60) return 0.8;
  if (v <= 100) return 1.2;
  if (v <= 120) return 1.5;
  if (v <= 160) return 2.0;
  if (v <= 200) return 2.7;
  if (v <= 250) return 3.5;
  return 4.0;
}

// SIG-06 / SIG-05 — VISA speed cap (km/h) as a function of the distance (m)
// remaining to a CLOSED signal. Returns 0 inside the stop margin, the matching
// VISA step within 300 m, or null when the signal is far enough to ignore.
export function visaSpeedCapKmh(distToClosedSignalM) {
  if (!(distToClosedSignalM >= 0)) return null;
  if (distToClosedSignalM <= CARRE_STOP_MARGIN_M) return 0;
  for (const [maxD, spd] of VISA_STEPS) {
    if (distToClosedSignalM <= maxD) return spd;
  }
  return null; // beyond 300 m — no VISA restriction yet
}

// SIG-03/04/05 — aspect seen by a driver given the occupancy of the blocks ahead.
//   nextOccupied     : is the very next canton occupied/unavailable?
//   secondOccupied   : is the canton after that occupied/unavailable?
// A closed next block → CARRE; a clear next block but occupied second block →
// AVERTISSEMENT (be ready to stop at the next signal); otherwise VOIE LIBRE.
export function aspectFromOccupancy(nextOccupied, secondOccupied) {
  if (nextOccupied) return ASPECT.CLOSED;
  if (secondOccupied) return ASPECT.CAUTION;
  return ASPECT.CLEAR;
}

// Speed cap (km/h) implied by an aspect, given the line speed and (for a closed
// signal) the distance to it. Returns the line speed for CLEAR, a
// stop-capable/graduated value for CAUTION, and the VISA/stop cap for CLOSED.
export function aspectSpeedCapKmh(aspect, lineSpeedKmh, distToSignalM = Infinity) {
  switch (aspect) {
    case ASPECT.CLEAR:
      return lineSpeedKmh;
    case ASPECT.CAUTION:
      // Be able to stop at the next signal: never exceed the restart speed.
      return Math.min(lineSpeedKmh, RESTART_SPEED_KMH);
    case ASPECT.CLOSED: {
      const visa = visaSpeedCapKmh(distToSignalM);
      return visa === null ? Math.min(lineSpeedKmh, RESTART_SPEED_KMH) : visa;
    }
    default:
      return lineSpeedKmh;
  }
}
