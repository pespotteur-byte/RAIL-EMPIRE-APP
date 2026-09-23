/**
 * Moteur de simulation V2 — étape 2 : voies, cantonnement, autorité de mouvement.
 *
 * Règles :
 *  - aucun accès DOM, aucune dépendance navigateur : tourne dans un Worker ou dans Node ;
 *  - pas de temps réel dans le moteur : `step(dt)` avance d'un pas fixe ;
 *  - état des trains dans des tableaux typés, snapshot = copie mémoire.
 *
 * Chaque train circule sur une route compilée (polyligne de voie, limites par
 * sommet, cantons SIG-01). À chaque pas :
 *  1. occupation des cantons sous la rame (tête → queue), libération derrière la queue ;
 *  2. réservation du canton suivant → aspect du signal (clear / caution / closed) ;
 *  3. autorité de mouvement = min(limite de ligne sous toute la rame [VIT-02],
 *     plafond d'aspect + visa, courbe de freinage vers l'arrêt ou le carré fermé) ;
 *  4. intégration physique : traction (puissance/adhérence/Davis) ou freinage de service.
 */
import { BlockManager } from './blocks.ts';
import { MovementAuthority, type MovementStatus } from './movement-authority.ts';
import { blockIndexAtKm, compileRoute, limitAtKm, poseAtKm, segmentIndexAtKm, type CompiledRoute, type RouteVertex } from './rail-route.ts';
import type { RailSpeedPoint } from './rail-speed.ts';
import { Aspect, aspectFromOccupancy, aspectSpeedCapKmh, CARRE_STOP_MARGIN_M, type SignalAspect } from './signaling.ts';
import { accelerationMs2, brakingDecelMs2, KMH_TO_MS, MS_TO_KMH, TailSpeedIndex, type TrainPhysicsParams, type WeatherCondition } from './train-physics.ts';

export interface SimStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TrainSpec {
  id: string;
  label: string;
  /** Gares desservies dans l'ordre (ids). */
  route: string[];
  /**
   * Géométrie de voie de chaque étape (route.length − 1 tableaux), extrémités
   * comprises. Absente → segment droit entre les deux gares, limite = vitesse du train.
   */
  legs?: RailSpeedPoint[][];
  /** km/h — plafond de la rame */
  maxSpeedKmh: number;
  physics: TrainPhysicsParams;
  /** secondes d'arrêt en gare */
  dwellS: number;
  /** boucle sur la route (aller-retour) */
  loop: boolean;
}

/** Disposition d'un train dans le snapshot : 9 float32 par train. */
export const SNAPSHOT_STRIDE = 9;
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
  /** abscisse de la tête sur la route courante (km) */
  RouteKm: 6,
  /** 0 = GO, 1 = CAUTION, 2 = STOP */
  Authority: 7,
  /** plafond de vitesse publié (km/h) */
  LimitKmh: 8,
} as const;

export const AUTHORITY_CODE: Record<MovementStatus, number> = { GO: 0, CAUTION: 1, STOP: 2 };

export interface TrainDetail {
  id: string;
  label: string;
  speedKmh: number;
  limitKmh: number;
  lineLimitKmh: number;
  status: MovementStatus;
  code: string;
  reason: string;
  aspect: SignalAspect;
  routeKm: number;
  routeTotalKm: number;
  nextStop: string | null;
  dwelling: boolean;
  blocksHeld: number;
}

interface Leg {
  route: CompiledRoute;
  tail: TailSpeedIndex;
  /** ids de gare aux arrêts (route.stops), dans le sens de parcours */
  stationIds: string[];
}

interface TrainState {
  spec: TrainSpec;
  /** paramètres physiques avec la météo courante */
  physics: TrainPhysicsParams;
  forward: Leg;
  backward: Leg | null;
  leg: Leg;
  /** index (dans leg.route.stops) du prochain arrêt */
  nextStop: number;
  headKm: number;
  speed: number;
  dwellRemaining: number;
  lowestHeldBlock: number;
  ma: MovementAuthority;
  status: MovementStatus;
  code: string;
  reason: string;
  limitKmh: number;
  lineLimitKmh: number;
  aspect: SignalAspect;
  x: number;
  y: number;
  heading: number;
}

export interface SimStats {
  simTime: number;
  trains: number;
  stations: number;
  cantons: number;
  lastStepMs: number;
}

const ARRIVAL_EPS_M = 0.5;

export class Simulation {
  private readonly stations = new Map<string, SimStation>();
  private readonly trains: TrainState[] = [];
  private readonly trainIndex = new Map<string, number>();
  private readonly blocks = new BlockManager({ isGone: (id) => !this.trainIndex.has(id) });
  /** Routes compilées partagées entre trains de même parcours (géométrie immuable). */
  private readonly legCache = new Map<string, { forward: Leg; backward: Leg | null }>();
  private weather: WeatherCondition = 'clear';
  private simTime = 0;
  private lastStepMs = 0;
  private readonly pose = { x: 0, y: 0, heading: 0 };

  addStations(list: readonly SimStation[]): void {
    for (const s of list) if (!this.stations.has(s.id)) this.stations.set(s.id, { ...s });
  }

  station(id: string): SimStation | undefined {
    return this.stations.get(id);
  }

  setWeather(w: WeatherCondition): void {
    this.weather = w;
    for (const t of this.trains) t.physics.weather = w;
  }

  get stationCount(): number {
    return this.stations.size;
  }

  get trainCount(): number {
    return this.trains.length;
  }

  get cantonCount(): number {
    return this.blocks.cantonCount;
  }

  get time(): number {
    return this.simTime;
  }

  addTrain(spec: TrainSpec): boolean {
    if (this.trainIndex.has(spec.id) || spec.route.length < 2) return false;
    if (spec.legs && spec.legs.length !== spec.route.length - 1) return false;
    const key = routeKey(spec);
    let legs = this.legCache.get(key);
    if (!legs || (spec.loop && !legs.backward)) {
      const vertices = this.buildVertices(spec);
      if (!vertices) return false;
      const forward = legs?.forward ?? this.compileLeg(vertices, spec.maxSpeedKmh);
      const backward = spec.loop ? this.compileLeg(reverseVertices(vertices), spec.maxSpeedKmh) : null;
      legs = { forward, backward };
      this.legCache.set(key, legs);
      this.blocks.register(forward.route.blocks);
      if (backward) this.blocks.register(backward.route.blocks);
    }
    const { forward, backward } = legs;
    const state: TrainState = {
      spec,
      physics: { ...spec.physics, weather: this.weather },
      forward,
      backward,
      leg: forward,
      nextStop: 1,
      headKm: 0,
      speed: 0,
      dwellRemaining: spec.dwellS,
      lowestHeldBlock: 0,
      ma: new MovementAuthority(),
      status: 'STOP',
      code: 'DWELL',
      reason: 'arrêt en gare',
      limitKmh: 0,
      lineLimitKmh: limitAtKm(forward.route, 0),
      aspect: Aspect.Clear,
      x: forward.route.x[0] ?? 0,
      y: forward.route.y[0] ?? 0,
      heading: 0,
    };
    this.trainIndex.set(spec.id, this.trains.length);
    this.trains.push(state);
    this.occupyUnderTrain(state);
    return true;
  }

  removeTrain(id: string): boolean {
    const i = this.trainIndex.get(id);
    if (i === undefined) return false;
    this.trains.splice(i, 1);
    this.trainIndex.clear();
    this.trains.forEach((t, k) => this.trainIndex.set(t.spec.id, k));
    this.blocks.releaseAll(id);
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
    return {
      simTime: this.simTime,
      trains: this.trains.length,
      stations: this.stations.size,
      cantons: this.blocks.cantonCount,
      lastStepMs: this.lastStepMs,
    };
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
      out[o + SnapshotField.NextStop] = this.nextStopRouteIndex(t);
      out[o + SnapshotField.Dwelling] = t.dwellRemaining > 0 ? 1 : 0;
      out[o + SnapshotField.RouteKm] = t.headKm;
      out[o + SnapshotField.Authority] = AUTHORITY_CODE[t.status];
      out[o + SnapshotField.LimitKmh] = t.limitKmh;
    }
    return n;
  }

  trainIds(): string[] {
    return this.trains.map((t) => t.spec.id);
  }

  trainLabels(): string[] {
    return this.trains.map((t) => t.spec.label);
  }

  trainDetail(id: string): TrainDetail | null {
    const i = this.trainIndex.get(id);
    const t = i === undefined ? undefined : this.trains[i];
    if (!t) return null;
    return {
      id: t.spec.id,
      label: t.spec.label,
      speedKmh: t.speed * MS_TO_KMH,
      limitKmh: t.limitKmh,
      lineLimitKmh: t.lineLimitKmh,
      status: t.status,
      code: t.code,
      reason: t.reason,
      aspect: t.aspect,
      routeKm: t.headKm,
      routeTotalKm: t.leg.route.totalKm,
      nextStop: t.leg.stationIds[t.nextStop] ?? null,
      dwelling: t.dwellRemaining > 0,
      blocksHeld: this.blocks.heldBy(t.spec.id).length,
    };
  }

  /** Propriétaire d'un canton (diagnostic / tests). */
  blockOccupant(cantonId: string): string | null {
    return this.blocks.occupant(cantonId);
  }

  private buildVertices(spec: TrainSpec): RouteVertex[] | null {
    const out: RouteVertex[] = [];
    for (let i = 0; i < spec.route.length; i++) {
      const id = spec.route[i];
      const s = id === undefined ? undefined : this.stations.get(id);
      if (!s || id === undefined) return null;
      if (i > 0) {
        const leg = spec.legs?.[i - 1];
        if (leg && leg.length >= 2) {
          for (let k = 1; k < leg.length - 1; k++) {
            const p = leg[k];
            if (p) out.push({ ...p });
          }
        }
      }
      if (spec.legs) {
        // attributs de voie de l'extrémité de l'étape entrante (ou sortante pour le premier arrêt)
        const incoming = spec.legs[i - 1]?.at(-1);
        const outgoing = spec.legs[i]?.[0];
        out.push({ ...(incoming ?? outgoing ?? {}), lat: s.lat, lon: s.lon, stopId: id });
      } else {
        out.push({ lat: s.lat, lon: s.lon, stopId: id, maxSpeed: spec.maxSpeedKmh, maxSpeedSource: 'LINE', wayId: `line:${spec.id}` });
      }
    }
    return out.length >= 2 ? out : null;
  }

  private compileLeg(vertices: RouteVertex[], capKmh: number): Leg {
    const route = compileRoute(vertices, capKmh);
    return {
      route,
      tail: new TailSpeedIndex(route.segKm, route.limitKmh),
      stationIds: route.stops.map((s) => s.stationId),
    };
  }

  private nextStopRouteIndex(t: TrainState): number {
    const id = t.leg.stationIds[t.nextStop];
    if (id === undefined) return t.spec.route.length - 1;
    const forward = t.leg === t.forward;
    const idx = forward ? t.spec.route.indexOf(id) : t.spec.route.lastIndexOf(id);
    return idx < 0 ? 0 : idx;
  }

  private stepTrain(t: TrainState, dt: number): void {
    const route = t.leg.route;
    const id = t.spec.id;
    const stop = route.stops[t.nextStop];
    if (!stop) {
      t.speed = 0;
      this.publish(t, 'STOP', 'TERMINUS', 'terminus', 0);
      return;
    }

    // 1. Cantons sous la rame et signal en avant.
    const secured = this.occupyUnderTrain(t);
    const headBlock = blockIndexAtKm(route.blocks, t.headKm);
    const current = route.blocks[headBlock];
    const next = route.blocks[headBlock + 1];
    const second = route.blocks[headBlock + 2];
    let aspect: SignalAspect = Aspect.Clear;
    let distToSignalM = Number.POSITIVE_INFINITY;
    if (current && next) {
      const nextFree = this.blocks.reserve(next.cantonId, id);
      const secondFree = second === undefined || this.blocks.isAvailable(second.cantonId, id);
      aspect = aspectFromOccupancy(!nextFree, !secondFree);
      if (aspect === Aspect.Closed) distToSignalM = Math.max(0, (current.endKm - t.headKm) * 1000);
    }
    t.aspect = aspect;

    // 2. Autorité de mouvement.
    const segIdx = segmentIndexAtKm(route, t.headKm);
    const segLen = route.segKm[segIdx] ?? 0;
    const progress = segLen > 0 ? (t.headKm - (route.km[segIdx] ?? 0)) / segLen : 1;
    const lineLimit = Math.min(t.spec.maxSpeedKmh, t.leg.tail.minimum(segIdx, progress, t.spec.physics.lengthM));
    t.lineLimitKmh = lineLimit;
    const ma = t.ma.begin(lineLimit);
    if (t.dwellRemaining > 0) ma.stop('DWELL', 'arrêt en gare', 'timetable');
    if (!secured) ma.stop('BLOCK_CONFLICT', 'canton occupé par un autre mouvement', 'blocks');
    if (aspect !== Aspect.Clear) {
      const cap = aspectSpeedCapKmh(aspect, lineLimit, distToSignalM);
      ma.limit(cap, aspect === Aspect.Closed ? 'SIGNAL_CLOSED' : 'SIGNAL_CAUTION', aspect === Aspect.Closed ? 'carré fermé' : 'avertissement', 'signaling');
    }
    const decel = brakingDecelMs2(t.physics, this.weather);
    if (aspect === Aspect.Closed) {
      // courbe de freinage vers le carré fermé (marge d'arrêt comprise)
      const vSignalMs = Math.sqrt(2 * decel * Math.max(0, distToSignalM - CARRE_STOP_MARGIN_M));
      ma.limit(vSignalMs * MS_TO_KMH, 'SIGNAL_CLOSED', 'carré fermé', 'signaling');
    }
    const d = ma.decision();
    this.publish(t, d.status, d.code, d.reason, d.speedLimitKmh);

    // 3. Intégration physique : plafond d'autorité ∧ courbe de freinage vers l'arrêt commercial.
    if (t.dwellRemaining > 0) {
      t.dwellRemaining -= dt;
      t.speed = 0;
      return;
    }
    const distToStopM = Math.max(0, (stop.km - t.headKm) * 1000);
    const limitMs = Math.min(d.speedLimitKmh * KMH_TO_MS, Math.sqrt(2 * decel * distToStopM));
    if (t.speed < limitMs) {
      const a = accelerationMs2(t.physics, t.speed, 0);
      t.speed = Math.min(limitMs, Math.max(0, t.speed + a * dt));
    } else {
      t.speed = Math.max(limitMs, t.speed - decel * dt);
    }
    const advanceKm = (t.speed * dt) / 1000;
    const remainingKm = stop.km - t.headKm;
    if (remainingKm * 1000 <= Math.max(ARRIVAL_EPS_M, t.speed * dt) || advanceKm >= remainingKm) {
      t.headKm = stop.km;
      t.speed = 0;
      this.placeAt(t);
      this.arrive(t);
      return;
    }
    t.headKm += advanceKm;
    this.placeAt(t);
  }

  private publish(t: TrainState, status: MovementStatus, code: string, reason: string, limitKmh: number): void {
    t.status = status;
    t.code = code;
    t.reason = reason;
    t.limitKmh = Number.isFinite(limitKmh) ? limitKmh : t.spec.maxSpeedKmh;
  }

  /** Occupe les cantons entre queue et tête, libère ceux entièrement dégagés. false si un canton est tenu par un autre mouvement. */
  private occupyUnderTrain(t: TrainState): boolean {
    const route = t.leg.route;
    const id = t.spec.id;
    const tailKm = Math.max(0, t.headKm - t.spec.physics.lengthM / 1000);
    const headBlock = blockIndexAtKm(route.blocks, t.headKm);
    const tailBlock = blockIndexAtKm(route.blocks, tailKm);
    if (headBlock < 0 || tailBlock < 0) return false;
    for (let b = t.lowestHeldBlock; b < tailBlock; b++) {
      const blk = route.blocks[b];
      if (blk) this.blocks.release(blk.cantonId, id);
    }
    t.lowestHeldBlock = Math.max(t.lowestHeldBlock, tailBlock);
    let ok = true;
    for (let b = tailBlock; b <= headBlock; b++) {
      const blk = route.blocks[b];
      if (blk && !this.blocks.occupy(blk.cantonId, id)) ok = false;
    }
    return ok;
  }

  private arrive(t: TrainState): void {
    t.dwellRemaining = t.spec.dwellS;
    if (t.nextStop + 1 < t.leg.route.stops.length) {
      t.nextStop++;
      return;
    }
    if (!t.spec.loop || !t.backward) {
      t.dwellRemaining = Number.POSITIVE_INFINITY;
      return;
    }
    // Retournement : libère la route parcourue, repart sur la route inverse.
    this.blocks.releaseAll(t.spec.id);
    t.leg = t.leg === t.forward ? t.backward : t.forward;
    t.headKm = 0;
    t.nextStop = 1;
    t.lowestHeldBlock = 0;
    this.occupyUnderTrain(t);
  }

  private placeAt(t: TrainState): void {
    poseAtKm(t.leg.route, t.headKm, this.pose);
    t.x = this.pose.x;
    t.y = this.pose.y;
    t.heading = this.pose.heading;
  }
}

/** Clé de partage d'une route : gares + géométrie des étapes + plafond (qui borne les limites résolues). */
function routeKey(spec: TrainSpec): string {
  let h = 2166136261;
  const mix = (v: number): void => {
    h ^= Math.round(v * 1e6) | 0;
    h = Math.imul(h, 16777619);
  };
  if (spec.legs) {
    for (const leg of spec.legs) {
      for (const p of leg) {
        mix(p.lat);
        mix(p.lon);
        mix(p.maxSpeed ?? -1);
        mix(p.maxSpeedForward ?? -1);
        mix(p.maxSpeedBackward ?? -1);
        mix(p.wayId ? p.wayId.length : 0);
        mix(p.service ? 1 : 0);
        mix(p.usage ? 1 : 0);
      }
      mix(leg.length);
    }
  }
  return `${spec.route.join('>')}|${spec.maxSpeedKmh}|${spec.legs ? (h >>> 0).toString(36) : 'line'}`;
}

function reverseVertices(v: readonly RouteVertex[]): RouteVertex[] {
  const out: RouteVertex[] = [];
  for (let i = v.length - 1; i >= 0; i--) {
    const p = v[i];
    if (!p) continue;
    const q: RouteVertex = { ...p };
    if (p.travelDirection === 'forward') q.travelDirection = 'backward';
    else if (p.travelDirection === 'backward') q.travelDirection = 'forward';
    out.push(q);
  }
  return out;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
