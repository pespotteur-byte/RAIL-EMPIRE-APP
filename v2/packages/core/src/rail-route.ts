/**
 * Route compilée : polyligne de voie (sommets OSM ou segments droits) réduite en
 * tableaux typés — abscisse curviligne (km), limites par sommet, Mercator (m),
 * table de cantons à longueur dépendante de la vitesse (SIG-01, portage RC28
 * `CantonManager.createRouteCantons`).
 *
 * Deux services qui coupent leurs cantons virtuels différemment partagent
 * néanmoins les mêmes ressources physiques (segments OSM) : `resourceIds`.
 */
import { haversineM, project } from '@re/data';
import { resolveRailSpeedLimits, type RailSpeedPoint } from './rail-speed.ts';
import { cantonLengthKm } from './signaling.ts';

export interface RouteVertex extends RailSpeedPoint {
  /** id de la gare desservie à ce sommet (arrêt commercial) */
  stopId?: string;
}

export interface BlockAssignment {
  cantonId: string;
  startIndex: number;
  endIndex: number;
  startKm: number;
  endKm: number;
  trackSig: string;
  resourceIds: readonly string[];
}

export interface RouteStop {
  vertex: number;
  km: number;
  stationId: string;
}

export interface CompiledRoute {
  readonly vertexCount: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** abscisse cumulée (km) de chaque sommet */
  readonly km: Float64Array;
  /** longueur (km) de chaque segment i → i+1 (vertexCount − 1) */
  readonly segKm: Float64Array;
  /** limite (km/h) à chaque sommet, plafonnée par le train */
  readonly limitKmh: Float64Array;
  readonly totalKm: number;
  readonly blocks: readonly BlockAssignment[];
  readonly stops: readonly RouteStop[];
}

function coord(v: number): string {
  return v.toFixed(5);
}

/** Clé de canton symétrique (A→B = B→A), ~11 m de précision + identité de voie. */
export function cantonKey(lat1: number, lon1: number, lat2: number, lon2: number, trackSig: string): string {
  const a = `${coord(lat1)},${coord(lon1)}`;
  const b = `${coord(lat2)},${coord(lon2)}`;
  return `${a < b ? `${a}|${b}` : `${b}|${a}`}|w:${trackSig || 'unknown'}`;
}

/** Clé d'un segment physique atomique (ressource de sécurité). */
export function physicalSegmentKey(a: RailSpeedPoint, b: RailSpeedPoint): string {
  const ca = `${coord(a.lat)},${coord(a.lon)}`;
  const cb = `${coord(b.lat)},${coord(b.lon)}`;
  return `${ca < cb ? `${ca}|${cb}` : `${cb}|${ca}`}|w:${a.wayId ?? b.wayId ?? 'unknown'}`;
}

/**
 * Insère des sommets intermédiaires pour qu'aucun segment ne dépasse la longueur
 * de canton de sa vitesse : la géométrie clairsemée (démo, gares reliées en
 * ligne droite) obtient ainsi le même cantonnement qu'une voie OSM dense.
 * Les sommets insérés portent la limite résolue du sommet amont.
 */
export function densifyForCantons(vertices: readonly RouteVertex[], trainCapKmh = 160): RouteVertex[] {
  const limits = resolveRailSpeedLimits(vertices, trainCapKmh);
  const out: RouteVertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    if (!a) continue;
    out.push(a);
    const b = vertices[i + 1];
    if (!b) break;
    const lim = Math.min(limits[i] ?? 160, limits[i + 1] ?? 160);
    const stepKm = cantonLengthKm(lim);
    const dKm = haversineM(a.lat, a.lon, b.lat, b.lon) / 1000;
    const parts = Math.ceil(dKm / stepKm - 1e-9);
    for (let k = 1; k < parts; k++) {
      const f = k / parts;
      const v: RouteVertex = { ...a, lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, maxSpeed: limits[i] ?? 160, maxSpeedSource: 'INTERP' };
      delete v.stopId;
      delete v.maxSpeedForward;
      delete v.maxSpeedBackward;
      out.push(v);
    }
  }
  return out;
}

export function compileRoute(input: readonly RouteVertex[], trainCapKmh = 160): CompiledRoute {
  const vertices = densifyForCantons(input, trainCapKmh);
  const n = vertices.length;
  if (n < 2) throw new RangeError('Une route compilée exige au moins deux sommets');
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const km = new Float64Array(n);
  const segKm = new Float64Array(n - 1);
  const limitKmh = resolveRailSpeedLimits(vertices, trainCapKmh);
  const stops: RouteStop[] = [];
  let prev: RouteVertex | undefined;
  for (let i = 0; i < n; i++) {
    const v = vertices[i];
    if (!v) continue;
    const p = project(v.lat, v.lon);
    x[i] = p.x;
    y[i] = p.y;
    if (prev) {
      const d = haversineM(prev.lat, prev.lon, v.lat, v.lon) / 1000;
      segKm[i - 1] = d;
      km[i] = (km[i - 1] ?? 0) + d;
    }
    if (v.stopId !== undefined) stops.push({ vertex: i, km: km[i] ?? 0, stationId: v.stopId });
    prev = v;
  }
  const blocks: BlockAssignment[] = [];
  let blockStart = 0;
  let blockDist = 0;
  for (let i = 0; i < n - 1; i++) {
    const segDist = segKm[i] ?? 0;
    blockDist += segDist;
    if (blockDist >= cantonLengthKm(limitKmh[i + 1] ?? 160) || i === n - 2) {
      const endIdx = i + 1;
      const ways = new Set<string>();
      for (let j = blockStart; j <= endIdx; j++) {
        const w = vertices[j]?.wayId;
        if (w) ways.add(w);
      }
      const trackSig = [...ways].sort().join(',');
      const a = vertices[blockStart];
      const b = vertices[endIdx];
      if (!a || !b) break;
      const resourceIds: string[] = [];
      for (let j = blockStart; j < endIdx; j++) {
        const p = vertices[j];
        const q = vertices[j + 1];
        if (p && q) resourceIds.push(physicalSegmentKey(p, q));
      }
      blocks.push({
        cantonId: cantonKey(a.lat, a.lon, b.lat, b.lon, trackSig),
        startIndex: blockStart,
        endIndex: endIdx,
        startKm: km[blockStart] ?? 0,
        endKm: km[endIdx] ?? 0,
        trackSig,
        resourceIds,
      });
      blockStart = endIdx;
      blockDist = 0;
    }
  }
  return { vertexCount: n, x, y, km, segKm, limitKmh, totalKm: km[n - 1] ?? 0, blocks, stops };
}

/** Index du canton contenant l'abscisse `atKm` (recherche binaire), −1 hors route. */
export function blockIndexAtKm(blocks: readonly BlockAssignment[], atKm: number): number {
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((blocks[mid]?.endKm ?? 0) <= atKm) lo = mid + 1;
    else hi = mid;
  }
  if (lo < blocks.length) return lo;
  return atKm <= (blocks[blocks.length - 1]?.endKm ?? 0) ? blocks.length - 1 : -1;
}

/** Index du segment contenant `atKm` (0 ≤ i < vertexCount−1). */
export function segmentIndexAtKm(route: CompiledRoute, atKm: number): number {
  const kmArr = route.km;
  let lo = 0;
  let hi = route.vertexCount - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((kmArr[mid + 1] ?? 0) <= atKm) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, route.vertexCount - 2);
}

/** Position Mercator et cap (rad) à l'abscisse `atKm`. */
export function poseAtKm(route: CompiledRoute, atKm: number, out: { x: number; y: number; heading: number }): void {
  const i = segmentIndexAtKm(route, atKm);
  const len = route.segKm[i] ?? 0;
  const f = len > 0 ? Math.max(0, Math.min(1, (atKm - (route.km[i] ?? 0)) / len)) : 1;
  const x0 = route.x[i] ?? 0;
  const y0 = route.y[i] ?? 0;
  const x1 = route.x[i + 1] ?? x0;
  const y1 = route.y[i + 1] ?? y0;
  out.x = x0 + (x1 - x0) * f;
  out.y = y0 + (y1 - y0) * f;
  out.heading = Math.atan2(y1 - y0, x1 - x0);
}

/** Limite d'infrastructure (km/h) applicable à la tête à l'abscisse `atKm` (min des deux sommets du segment). */
export function limitAtKm(route: CompiledRoute, atKm: number): number {
  const i = segmentIndexAtKm(route, atKm);
  return Math.min(route.limitKmh[i] ?? 160, route.limitKmh[i + 1] ?? 160);
}
