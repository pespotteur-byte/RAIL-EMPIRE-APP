/**
 * Projection Web Mercator en mètres (EPSG:3857). Le moteur travaille en plan
 * (x est, y nord) : additions et distances locales sans trigonométrie.
 */
const R = 6_378_137;
const MAX_LAT = 85.05112878;

export interface XY {
  x: number;
  y: number;
}

export function project(lat: number, lon: number): XY {
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return {
    x: (lon * Math.PI * R) / 180,
    y: R * Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360)),
  };
}

export function unproject(x: number, y: number): { lat: number; lon: number } {
  return {
    lon: (x * 180) / (Math.PI * R),
    lat: (360 / Math.PI) * Math.atan(Math.exp(y / R)) - 90,
  };
}

/** Facteur d'échelle Mercator à une latitude (mètres projetés / mètres réels). */
export function mercatorScale(lat: number): number {
  return 1 / Math.cos((lat * Math.PI) / 180);
}
