/**
 * Physique de traction (portage RC28 `train-physics.ts`, `physics-rear-clearance.ts`,
 * `tail-speed-index.ts`). Unités SI internes (kg, m, s, N) ; km/h aux frontières.
 *
 *  PH-01 accélération/décélération = puissance + masse + pente
 *  PH-02 résistance de Davis R = A + B·v + C·v² (+ composante de pente)
 *  PH-03 effort de traction borné par puissance/vitesse ET adhérence
 *  PH-04 freinage borné par le taux de la rame ET l'adhérence (météo)
 *  VIT-02 transition positive : n'accélérer qu'une fois toute la rame dégagée
 */
export const G = 9.81;
export const KMH_TO_MS = 1 / 3.6;
export const MS_TO_KMH = 3.6;

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'wind'
  | 'light_rain'
  | 'rain'
  | 'heavy_rain'
  | 'storm'
  | 'snow';

const WEATHER_ADHESION: Record<WeatherCondition, number> = {
  clear: 0.33,
  cloudy: 0.33,
  wind: 0.33,
  light_rain: 0.28,
  rain: 0.25,
  heavy_rain: 0.22,
  storm: 0.2,
  snow: 0.15,
};

export interface TrainPhysicsParams {
  massKg: number;
  powerW: number;
  lengthM: number;
  weather?: WeatherCondition;
  adhesionMassKg?: number;
  brakeServiceMs2?: number;
}

export function weatherAdhesion(weather: WeatherCondition | undefined): number {
  return weather ? WEATHER_ADHESION[weather] : WEATHER_ADHESION.clear;
}

/** PH-02 — résistance à l'avancement (N) de la rame complète. */
export function resistanceN(massKg: number, vMs: number, gradePermille = 0, lengthM = 200): number {
  const massT = massKg / 1000;
  const A = 6.4 * massT;
  const B = 0.14 * massT;
  const C = 6.0 + 0.05 * lengthM;
  return A + B * vMs + C * vMs * vMs + massKg * G * (gradePermille / 1000);
}

/** PH-03 — effort de traction disponible (N) à une vitesse donnée. */
export function tractiveEffortN(powerW: number, vMs: number, adhesionMassKg: number, weather: WeatherCondition | undefined): number {
  if (powerW <= 0) return 0;
  const adhesionLimit = weatherAdhesion(weather) * adhesionMassKg * G;
  return Math.min(powerW / Math.max(vMs, 2.0), adhesionLimit);
}

/** PH-01/PH-03 — accélération nette (m/s²). */
export function accelerationMs2(p: TrainPhysicsParams, vMs: number, gradePermille = 0): number {
  const te = tractiveEffortN(p.powerW, vMs, p.adhesionMassKg ?? p.massKg, p.weather);
  return (te - resistanceN(p.massKg, vMs, gradePermille, p.lengthM)) / p.massKg;
}

/** PH-04 — décélération de service max (m/s², positive). */
export function brakingDecelMs2(p: TrainPhysicsParams, weather: WeatherCondition | undefined, gradePermille = 0): number {
  const base = p.brakeServiceMs2 ?? 0.9;
  const adhesionCap = weatherAdhesion(weather ?? p.weather) * G * 0.5;
  return Math.max(0.05, Math.min(base, adhesionCap) + G * (gradePermille / 1000));
}

/** Distance (m) pour passer de v0 à vTarget à la décélération d. */
export function brakingDistanceM(v0Ms: number, vTargetMs: number, decelMs2: number): number {
  if (v0Ms <= vTargetMs) return 0;
  return (v0Ms * v0Ms - vTargetMs * vTargetMs) / (2 * decelMs2);
}

/** Temps d'établissement du freinage (s) : pneumatique long ou rame courte. */
export function brakeBuildSec(p: TrainPhysicsParams): number {
  const longPneumatic = (p.brakeServiceMs2 ?? 0.9) <= 0.7 || p.lengthM >= 450;
  return Math.max(
    0.5,
    longPneumatic ? Math.max(2.5, Math.min(7.0, 2.2 + p.lengthM / 170)) : Math.max(1.0, Math.min(2.5, 0.8 + p.lengthM / 300)),
  );
}

/**
 * VIT-02 — enveloppe exacte de dégagement de queue sur des cellules numériques.
 * Chaque transition positive impose son ancienne vitesse jusqu'à ce que toute la
 * rame l'ait franchie ; un tas-min fusionne les restrictions qui se chevauchent.
 */
export function rearClearanceCaps(
  distance: Float64Array,
  originalLimit: Float64Array,
  transitionUp: Uint8Array,
  lengthM: number,
): Float64Array {
  const count = distance.length;
  if (originalLimit.length !== count || transitionUp.length !== count) {
    throw new RangeError('Rear-clearance arrays must describe the same cells');
  }
  const result = new Float64Array(count);
  if (!(lengthM > 0) || count < 2) return result;
  let transitions = 0;
  for (let i = 1; i < count; i++) if (transitionUp[i]) transitions++;
  if (!transitions) return result;
  const caps = new Float64Array(transitions);
  const until = new Float64Array(transitions);
  let size = 0;
  let position = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0 && transitionUp[i]) {
      const cap = originalLimit[i - 1] ?? 0;
      const end = position + lengthM;
      let child = size++;
      while (child > 0) {
        const parent = (child - 1) >>> 1;
        if ((caps[parent] ?? 0) <= cap) break;
        caps[child] = caps[parent] ?? 0;
        until[child] = until[parent] ?? 0;
        child = parent;
      }
      caps[child] = cap;
      until[child] = end;
    }
    while (size > 0 && position >= (until[0] ?? 0)) {
      const last = --size;
      if (!size) break;
      const cap = caps[last] ?? 0;
      const end = until[last] ?? 0;
      let parent = 0;
      for (;;) {
        let child = parent * 2 + 1;
        if (child >= size) break;
        if (child + 1 < size && (caps[child + 1] ?? 0) < (caps[child] ?? 0)) child++;
        if (cap <= (caps[child] ?? 0)) break;
        caps[parent] = caps[child] ?? 0;
        until[parent] = until[child] ?? 0;
        parent = child;
      }
      caps[parent] = cap;
      until[parent] = end;
    }
    if (size > 0) result[i] = caps[0] ?? 0;
    position += distance[i] ?? 0;
  }
  return result;
}

/**
 * Index compact du minimum exact des limites sous la rame (queue incluse).
 * Géométrie immuable sur une étape ; blocs de 64 pour éviter de rebalayer les
 * sommets OSM denses. Aucune restriction ni partie du train n'est ignorée.
 */
export class TailSpeedIndex {
  private static readonly SIZE = 64;
  private static readonly EPS_KM = 1e-9;
  private readonly blockDistance: Float64Array;
  private readonly blockMinimum: Float64Array;
  private readonly distances: Float64Array;
  private readonly speeds: ArrayLike<number>;

  /**
   * @param distances longueur (km) de chaque segment i → i+1
   * @param speeds    limite (km/h) à chaque sommet (distances.length + 1)
   */
  constructor(distances: Float64Array, speeds: ArrayLike<number>) {
    this.distances = distances;
    this.speeds = speeds;
    if (speeds.length !== distances.length + 1) throw new RangeError('Tail-speed index: incompatible route arrays');
    const blocks = Math.ceil(distances.length / TailSpeedIndex.SIZE);
    this.blockDistance = new Float64Array(blocks);
    this.blockMinimum = new Float64Array(blocks);
    for (let b = 0; b < blocks; b++) {
      let distance = 0;
      let minimum = Number.POSITIVE_INFINITY;
      for (let i = Math.min(distances.length, (b + 1) * TailSpeedIndex.SIZE) - 1; i >= b * TailSpeedIndex.SIZE; i--) {
        distance += distances[i] ?? 0;
        minimum = Math.min(minimum, speeds[i] ?? Number.POSITIVE_INFINITY, speeds[i + 1] ?? Number.POSITIVE_INFINITY);
      }
      this.blockDistance[b] = distance;
      this.blockMinimum[b] = minimum;
    }
  }

  get bytes(): number {
    return this.blockDistance.byteLength + this.blockMinimum.byteLength;
  }

  /** Minimum des limites occupées par une rame de `lengthM` dont la tête est à `progress` du segment `segIndex`. */
  minimum(segIndex: number, progress: number, lengthM: number): number {
    return this.scan(segIndex, progress, lengthM, true);
  }

  private scan(segIndex: number, progress: number, lengthM: number, useBlocks: boolean): number {
    const sp = this.speeds;
    if (!this.distances.length) return sp[0] ?? Number.POSITIVE_INFINITY;
    const start = Math.max(0, Math.min(this.distances.length - 1, Math.floor(segIndex) || 0));
    let minimum = Math.min(sp[start] ?? Number.POSITIVE_INFINITY, sp[start + 1] ?? Number.POSITIVE_INFINITY);
    let remaining = Math.max(0, lengthM || 0) / 1000 - Math.max(0, Math.min(1, progress || 0)) * (this.distances[start] ?? 0);
    let i = start - 1;
    let skipped = false;
    while (remaining > 0 && i >= 0) {
      const b = Math.floor(i / TailSpeedIndex.SIZE);
      const bd = this.blockDistance[b] ?? 0;
      if (useBlocks && i % TailSpeedIndex.SIZE === TailSpeedIndex.SIZE - 1 && remaining > bd + TailSpeedIndex.EPS_KM) {
        minimum = Math.min(minimum, this.blockMinimum[b] ?? Number.POSITIVE_INFINITY);
        remaining -= bd;
        i -= TailSpeedIndex.SIZE;
        skipped = true;
      } else {
        minimum = Math.min(minimum, sp[i] ?? Number.POSITIVE_INFINITY, sp[i + 1] ?? Number.POSITIVE_INFINITY);
        remaining -= this.distances[i] ?? 0;
        i--;
        if (skipped && Math.abs(remaining) <= TailSpeedIndex.EPS_KM) return this.scan(segIndex, progress, lengthM, false);
      }
    }
    if (remaining > 0) minimum = Math.min(minimum, sp[0] ?? Number.POSITIVE_INFINITY);
    return minimum;
  }
}
