/** Coordonnées entières (1e-5 degré ≈ 1,1 m) : compactes en JSON, exactes, sans dérive flottante. */
export const COORD_SCALE = 1e5;

export const EARTH_RADIUS_M = 6_371_008.8;

export function toMicro(deg: number): number {
  return Math.round(deg * COORD_SCALE);
}

export function fromMicro(v: number): number {
  return v / COORD_SCALE;
}

/** Distance haversine en mètres entre deux points en degrés. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Taille d'une tuile monde en degrés. 2° ≈ 220 km : ~400 tuiles pour l'Europe. */
export const TILE_DEG = 2;

export interface TileId {
  /** floor(lat / TILE_DEG) */
  ty: number;
  /** floor(lon / TILE_DEG) */
  tx: number;
}

export function tileOf(lat: number, lon: number): TileId {
  return { ty: Math.floor(lat / TILE_DEG), tx: Math.floor(lon / TILE_DEG) };
}

export function tileKey(t: TileId): string {
  return `${t.ty}_${t.tx}`;
}

export function parseTileKey(key: string): TileId | null {
  const m = /^(-?\d+)_(-?\d+)$/.exec(key);
  if (!m) return null;
  return { ty: Number(m[1]), tx: Number(m[2]) };
}

/** Tuiles couvrant une boîte englobante (bornes en degrés). */
export function tilesInBounds(s: number, w: number, n: number, e: number): TileId[] {
  const out: TileId[] = [];
  const t0 = tileOf(s, w);
  const t1 = tileOf(n, e);
  for (let ty = t0.ty; ty <= t1.ty; ty++) {
    for (let tx = t0.tx; tx <= t1.tx; tx++) out.push({ ty, tx });
  }
  return out;
}
