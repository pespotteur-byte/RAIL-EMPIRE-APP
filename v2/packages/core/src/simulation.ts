/**
 * Moteur de simulation V2 — v0 « preuve d'architecture ».
 *
 * Règles :
 *  - aucun accès DOM, aucune dépendance navigateur : tourne dans un Worker ou dans Node ;
 *  - pas de temps réel dans le moteur : `step(dt)` avance d'un pas fixe, l'appelant
 *    décide de la cadence ;
 *  - état des trains dans des tableaux typés (structure of arrays) : un snapshot
 *    est une copie mémoire, pas une sérialisation d'objets.
 *
 * v0 : les trains suivent une séquence de points (gares) en ligne droite avec
 * accélération / freinage constants et arrêt en gare. Le graphe de voies et
 * l'autorité de mouvement arrivent aux étapes 2–3 du plan.
 */
import { haversineM, project } from '@re/data';

export interface SimStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Web Mercator (m) */
  x: number;
  y: number;
}

export interface TrainSpec {
  id: string;
  label: string;
  /** Gares desservies dans l'ordre (ids). */
  route: string[];
  /** km/h */
  maxSpeedKmh: number;
  /** m/s² */
  acceleration: number;
  /** m/s² (positif) */
  braking: number;
  /** secondes d'arrêt en gare */
  dwellS: number;
  /** boucle sur la route (aller-retour) */
  loop: boolean;
}

/** Disposition d'un train dans le snapshot : 6 float32 par train. */
export const SNAPSHOT_STRIDE = 6;
export const SnapshotField = {
  X: 0,
  Y: 1,
  /** radians, 0 = est, sens trigonométrique */
  Heading: 2,
  /** m/s */
  Speed: 3,
  /** index de la gare suivante dans la route */
  NextStop: 4,
  /** 1 si à l'arrêt en gare */
  Dwelling: 5,
} as const;

interface TrainState {
  spec: TrainSpec;
  /** indices de gares résolus */
  stops: SimStation[];
  segmentIndex: number;
  /** distance parcourue sur le segment courant (m réels) */
  segmentPos: number;
  segmentLength: number;
  speed: number;
  dwellRemaining: number;
  direction: 1 | -1;
  x: number;
  y: number;
  heading: number;
}

export interface SimStats {
  simTime: number;
  trains: number;
  stations: number;
  lastStepMs: number;
}

export class Simulation {
  private readonly stations = new Map<string, SimStation>();
  private readonly trains: TrainState[] = [];
  private readonly trainIndex = new Map<string, number>();
  private simTime = 0;
  private lastStepMs = 0;

  addStations(list: readonly { id: string; name: string; lat: number; lon: number }[]): void {
    for (const s of list) {
      if (this.stations.has(s.id)) continue;
      const p = project(s.lat, s.lon);
      this.stations.set(s.id, { id: s.id, name: s.name, lat: s.lat, lon: s.lon, x: p.x, y: p.y });
    }
  }

  station(id: string): SimStation | undefined {
    return this.stations.get(id);
  }

  get stationCount(): number {
    return this.stations.size;
  }

  get trainCount(): number {
    return this.trains.length;
  }

  get time(): number {
    return this.simTime;
  }

  addTrain(spec: TrainSpec): boolean {
    if (this.trainIndex.has(spec.id)) return false;
    const stops: SimStation[] = [];
    for (const id of spec.route) {
      const s = this.stations.get(id);
      if (!s) return false;
      stops.push(s);
    }
    if (stops.length < 2) return false;
    const first = stops[0];
    if (!first) return false;
    const state: TrainState = {
      spec,
      stops,
      segmentIndex: 0,
      segmentPos: 0,
      segmentLength: this.segmentLength(stops, 0, 1),
      speed: 0,
      dwellRemaining: spec.dwellS,
      direction: 1,
      x: first.x,
      y: first.y,
      heading: 0,
    };
    this.trainIndex.set(spec.id, this.trains.length);
    this.trains.push(state);
    return true;
  }

  removeTrain(id: string): boolean {
    const i = this.trainIndex.get(id);
    if (i === undefined) return false;
    this.trains.splice(i, 1);
    this.trainIndex.clear();
    this.trains.forEach((t, k) => this.trainIndex.set(t.spec.id, k));
    return true;
  }

  /** Avance la simulation de `dt` secondes (temps simulé). */
  step(dt: number): void {
    const t0 = now();
    for (const t of this.trains) this.stepTrain(t, dt);
    this.simTime += dt;
    this.lastStepMs = now() - t0;
  }

  stats(): SimStats {
    return { simTime: this.simTime, trains: this.trains.length, stations: this.stations.size, lastStepMs: this.lastStepMs };
  }

  /** Écrit l'état des trains dans `out` (longueur ≥ trains × SNAPSHOT_STRIDE). Renvoie le nombre de trains. */
  writeSnapshot(out: Float32Array): number {
    const n = Math.min(this.trains.length, Math.floor(out.length / SNAPSHOT_STRIDE));
    for (let i = 0; i < n; i++) {
      const t = this.trains[i];
      if (!t) break;
      const o = i * SNAPSHOT_STRIDE;
      out[o + SnapshotField.X] = t.x;
      out[o + SnapshotField.Y] = t.y;
      out[o + SnapshotField.Heading] = t.heading;
      out[o + SnapshotField.Speed] = t.speed;
      out[o + SnapshotField.NextStop] = this.nextStopIndex(t);
      out[o + SnapshotField.Dwelling] = t.dwellRemaining > 0 ? 1 : 0;
    }
    return n;
  }

  trainIds(): string[] {
    return this.trains.map((t) => t.spec.id);
  }

  trainLabels(): string[] {
    return this.trains.map((t) => t.spec.label);
  }

  private nextStopIndex(t: TrainState): number {
    return t.direction === 1 ? t.segmentIndex + 1 : t.segmentIndex;
  }

  private segmentLength(stops: SimStation[], a: number, b: number): number {
    const sa = stops[a];
    const sb = stops[b];
    if (!sa || !sb) return 0;
    return Math.max(1, haversineM(sa.lat, sa.lon, sb.lat, sb.lon));
  }

  private stepTrain(t: TrainState, dt: number): void {
    if (t.dwellRemaining > 0) {
      t.dwellRemaining -= dt;
      t.speed = 0;
      return;
    }
    const vmax = t.spec.maxSpeedKmh / 3.6;
    const remaining = t.segmentLength - t.segmentPos;
    // vitesse max permettant de s'arrêter à la fin du segment : v² = 2·b·d
    const vStop = Math.sqrt(2 * t.spec.braking * Math.max(0, remaining));
    const target = Math.min(vmax, vStop);
    if (t.speed < target) t.speed = Math.min(target, t.speed + t.spec.acceleration * dt);
    else t.speed = Math.max(target, t.speed - t.spec.braking * dt);
    t.segmentPos += t.speed * dt;
    if (t.segmentPos >= t.segmentLength - 0.5) {
      t.segmentPos = t.segmentLength;
      t.speed = 0;
      this.placeOnSegment(t);
      this.arrive(t);
      return;
    }
    this.placeOnSegment(t);
  }

  private arrive(t: TrainState): void {
    t.dwellRemaining = t.spec.dwellS;
    const last = t.stops.length - 1;
    if (t.direction === 1) {
      if (t.segmentIndex + 1 >= last) {
        if (!t.spec.loop) {
          t.dwellRemaining = Number.POSITIVE_INFINITY;
          return;
        }
        t.direction = -1;
        t.segmentIndex = last - 1;
      } else {
        t.segmentIndex++;
      }
    } else if (t.segmentIndex <= 0) {
      t.direction = 1;
      t.segmentIndex = 0;
    } else {
      t.segmentIndex--;
    }
    t.segmentPos = 0;
    t.segmentLength = this.segmentLength(t.stops, t.segmentIndex, t.segmentIndex + 1);
  }

  private placeOnSegment(t: TrainState): void {
    const a = t.stops[t.segmentIndex];
    const b = t.stops[t.segmentIndex + 1];
    if (!a || !b) return;
    const from = t.direction === 1 ? a : b;
    const to = t.direction === 1 ? b : a;
    const f = t.segmentLength > 0 ? t.segmentPos / t.segmentLength : 1;
    t.x = from.x + (to.x - from.x) * f;
    t.y = from.y + (to.y - from.y) * f;
    t.heading = Math.atan2(to.y - from.y, to.x - from.x);
  }
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
