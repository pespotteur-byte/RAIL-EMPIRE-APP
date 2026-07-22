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
// Doc barème (Annexe 3A):
//   < 60 km/h      → 500 m
//   60-100 km/h    → 900 m
//   100-160 km/h   → 1200 m
//   160-200 km/h   → 1500 m
//   > 200 km/h     → 2000 m
export function cantonLengthKm(lineSpeedKmh) {
  const v = lineSpeedKmh || 0;
  if (v <= 60) return 0.5;
  if (v <= 100) return 0.9;
  if (v <= 160) return 1.2;
  if (v <= 200) return 1.5;
  return 2.0;
}

// New ETCS-style block spacing. Constraints:
//   - never below 300 m
//   - never above 2 500 m
//   - below 160 km/h, never above 1 400 m
export function blockLengthKm(lineSpeedKmh) {
  const v = lineSpeedKmh || 0;
  if (v <= 10) return 0.30;
  if (v <= 20) return 0.30;
  if (v <= 30) return 0.30;
  if (v <= 40) return 0.35;
  if (v <= 50) return 0.40;
  if (v <= 60) return 0.45;
  if (v <= 70) return 0.55;
  if (v <= 80) return 0.65;
  if (v <= 90) return 0.75;
  if (v <= 100) return 0.85;
  if (v <= 110) return 0.95;
  if (v <= 120) return 1.05;
  if (v <= 130) return 1.15;
  if (v <= 140) return 1.25;
  if (v <= 150) return 1.35;
  if (v <= 160) return 1.40;
  if (v <= 200) return 1.75;
  if (v <= 220) return 2.00;
  if (v <= 230) return 2.20;
  if (v <= 250) return 2.45;
  return 2.50;
}

// SIG-06 / SIG-05 — VISA speed cap (km/h) as a function of the distance (m)
// remaining to a CLOSED signal. Returns 0 inside the stop margin, the matching
// VISA step within 300 m, or null when the signal is far enough to ignore.
export function visaSpeedCapKmh(distToClosedSignalM, marginM = CARRE_STOP_MARGIN_M) {
  if (!(distToClosedSignalM >= 0)) return null;
  if (distToClosedSignalM <= marginM) return 0;
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
export function aspectSpeedCapKmh(aspect, lineSpeedKmh, distToSignalM = Infinity, marginM = CARRE_STOP_MARGIN_M) {
  switch (aspect) {
    case ASPECT.CLEAR:
      return lineSpeedKmh;
    case ASPECT.CAUTION:
      // Be able to stop at the next signal: never exceed the restart speed.
      return Math.min(lineSpeedKmh, RESTART_SPEED_KMH);
    case ASPECT.CLOSED: {
      const visa = visaSpeedCapKmh(distToSignalM, marginM);
      return visa === null ? Math.min(lineSpeedKmh, RESTART_SPEED_KMH) : visa;
    }
    default:
      return lineSpeedKmh;
  }
}

// SIG-08 — signaux ajoutables par le joueur (facultatif)
let nextSignalId = 1;
export class PlayerSignal {
  constructor(data) {
    this.id = data.id || `sig-${nextSignalId++}`;
    this.name = data.name || `Signal ${this.id}`;
    this.stationA = data.stationA || '';
    this.stationB = data.stationB || '';
    this.type = data.type || 'ralentissement'; // 'ralentissement' | 'avertissement' | 'arret'
    this.speedLimit = data.speedLimit || 40; // km/h (pour ralentissement)
    this.active = data.active !== false;
    this.xKm = data.xKm || 0; // distance depuis stationA
  }
}

export class PlayerSignalManager {
  constructor() {
    this.signals = [];
  }

  add(data) {
    const s = new PlayerSignal(data);
    this.signals.push(s);
    return s;
  }

  remove(id) {
    this.signals = this.signals.filter(s => s.id !== id);
  }

  getAll() {
    return this.signals;
  }

  // Renvoie la limitation imposée par un signal actif sur le tronçon A-B (dans n'importe quel sens)
  getSpeedLimit(stationA, stationB) {
    let limit = null;
    for (const s of this.signals) {
      if (!s.active) continue;
      const onSegment = (s.stationA === stationA && s.stationB === stationB) ||
                        (s.stationA === stationB && s.stationB === stationA);
      if (!onSegment) continue;
      if (s.type === 'arret') return 0;
      if (s.type === 'avertissement') limit = Math.min(limit ?? Infinity, 60);
      if (s.type === 'ralentissement' && s.speedLimit > 0) limit = Math.min(limit ?? Infinity, s.speedLimit);
    }
    return limit;
  }

  toSave() {
    return this.signals.map(s => ({
      id: s.id, name: s.name, stationA: s.stationA, stationB: s.stationB,
      type: s.type, speedLimit: s.speedLimit, active: s.active, xKm: s.xKm,
    }));
  }

  loadFromSave(arr) {
    this.signals = (arr || []).map(d => {
      const s = new PlayerSignal(d);
      const n = parseInt(d.id?.replace('sig-', '') || '0');
      if (n >= nextSignalId) nextSignalId = n + 1;
      return s;
    });
  }
}
