/**
 * Politique unique de vitesse d'infrastructure (portage RC28 `rail-speed.ts`).
 *
 * Une donnée inconnue sur voie principale vaut 160 km/h (puis plafond du train) ;
 * une voie de service inconnue vaut 30. L'héritage local est borné à 1 km sur le
 * MÊME way OSM contigu. Un point inféré ne sert jamais de preuve pour un autre.
 */
import { haversineM } from '@re/data';

export type TravelDirection = 'forward' | 'backward' | '';

export interface RailSpeedPoint {
  lat: number;
  lon: number;
  wayId?: string;
  /** km/h documenté sur la voie */
  maxSpeed?: number;
  /** 'FALLBACK_30' = valeur de repli, non probante */
  maxSpeedSource?: string;
  maxSpeedForward?: number;
  maxSpeedBackward?: number;
  travelDirection?: TravelDirection;
  service?: string;
  usage?: string;
}

const SERVICE_TRACKS = new Set(['yard', 'siding', 'spur', 'crossover']);
const SLOW_USAGE = new Set(['industrial', 'military']);

function positive(v: number | undefined): number | null {
  return v !== undefined && Number.isFinite(v) && v > 0 ? v : null;
}

/** Vitesse documentée (km/h) ou null si rien de probant. */
export function documentedRailSpeed(p: RailSpeedPoint): number | null {
  const v = positive(p.maxSpeed);
  if (v !== null && p.maxSpeedSource !== 'FALLBACK_30') return v;
  const forward = positive(p.maxSpeedForward);
  const backward = positive(p.maxSpeedBackward);
  if (p.travelDirection === 'backward') return backward ?? forward;
  if (p.travelDirection === 'forward') return forward ?? backward;
  return null;
}

/** Limite (km/h) par point de la route, plafonnée par `trainCap`. */
export function resolveRailSpeedLimits(route: readonly RailSpeedPoint[], trainCap = 160): Float64Array {
  const cap = positive(trainCap) ?? 160;
  const n = route.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const known = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const next = new Int32Array(n).fill(-1);
  const distanceKm = new Float64Array(n);
  const wayOf = (i: number): string => route[i]?.wayId ?? '';
  let k = -1;
  for (let i = 0; i < n; i++) {
    const p = route[i];
    if (!p) continue;
    const d = documentedRailSpeed(p);
    known[i] = d ?? 0;
    if (i > 0) {
      const q = route[i - 1];
      distanceKm[i] = (distanceKm[i - 1] ?? 0) + (q ? haversineM(q.lat, q.lon, p.lat, p.lon) / 1000 : 0);
      if (wayOf(i) !== wayOf(i - 1)) k = -1;
    }
    if (d !== null) k = i;
    prev[i] = k;
  }
  k = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (i < n - 1 && wayOf(i) !== wayOf(i + 1)) k = -1;
    if ((known[i] ?? 0) > 0) k = i;
    next[i] = k;
  }
  for (let i = 0; i < n; i++) {
    const p = route[i];
    if (!p) continue;
    const kn = known[i] ?? 0;
    if (kn > 0) {
      out[i] = Math.min(cap, kn);
      continue;
    }
    if (SERVICE_TRACKS.has((p.service ?? '').toLowerCase()) || SLOW_USAGE.has((p.usage ?? '').toLowerCase())) {
      out[i] = Math.min(cap, 30);
      continue;
    }
    let best = Number.POSITIVE_INFINITY;
    const di = distanceKm[i] ?? 0;
    for (const j of [prev[i] ?? -1, next[i] ?? -1]) {
      if (j < 0) continue;
      const kj = known[j] ?? 0;
      if (kj > 0 && Math.abs((distanceKm[j] ?? 0) - di) <= 1) best = Math.min(best, kj);
    }
    out[i] = Math.min(cap, Number.isFinite(best) ? best : 160);
  }
  return out;
}
