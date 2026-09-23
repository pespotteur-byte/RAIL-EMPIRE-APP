/**
 * Signalisation et cantons (portage RC28 `signaling.ts`, règles SIG-01).
 * Module pur : aucune dépendance, aucun état global.
 */
export const Aspect = {
  Clear: 'clear',
  Caution: 'caution',
  Closed: 'closed',
} as const;
export type SignalAspect = (typeof Aspect)[keyof typeof Aspect];

export const CARRE_STOP_MARGIN_M = 30;
export const RESTART_SPEED_KMH = 60;
const VISA_STEPS: readonly (readonly [number, number])[] = [
  [100, 10],
  [200, 20],
  [300, 30],
];

/** Longueur cible d'un canton (km) selon la vitesse de ligne. */
export function cantonLengthKm(lineSpeedKmh: number): number {
  const v = lineSpeedKmh || 0;
  if (v <= 60) return 0.5;
  if (v <= 100) return 0.9;
  if (v <= 160) return 1.2;
  if (v <= 200) return 1.5;
  return 2.0;
}

/** Plafond de vitesse à l'approche d'un carré fermé, null si hors zone. */
export function visaSpeedCapKmh(distToClosedSignalM: number, marginM = CARRE_STOP_MARGIN_M): number | null {
  if (!(distToClosedSignalM >= 0)) return null;
  if (distToClosedSignalM <= marginM) return 0;
  for (const [maxD, spd] of VISA_STEPS) if (distToClosedSignalM <= maxD) return spd;
  return null;
}

export function aspectFromOccupancy(nextOccupied: boolean, secondOccupied: boolean): SignalAspect {
  if (nextOccupied) return Aspect.Closed;
  if (secondOccupied) return Aspect.Caution;
  return Aspect.Clear;
}

export function aspectSpeedCapKmh(
  aspect: SignalAspect,
  lineSpeedKmh: number,
  distToSignalM = Number.POSITIVE_INFINITY,
  marginM = CARRE_STOP_MARGIN_M,
): number {
  switch (aspect) {
    case Aspect.Clear:
      return lineSpeedKmh;
    case Aspect.Caution:
      return Math.min(lineSpeedKmh, RESTART_SPEED_KMH);
    case Aspect.Closed: {
      const visa = visaSpeedCapKmh(distToSignalM, marginM);
      return visa ?? Math.min(lineSpeedKmh, RESTART_SPEED_KMH);
    }
  }
}

export type PlayerSignalType = 'ralentissement' | 'avertissement' | 'arret';

export interface PlayerSignalData {
  id?: string;
  name?: string;
  stationA?: string;
  stationB?: string;
  type?: PlayerSignalType;
  speedLimit?: number;
  active?: boolean;
  xKm?: number;
}

export interface PlayerSignal {
  id: string;
  name: string;
  stationA: string;
  stationB: string;
  type: PlayerSignalType;
  speedLimit: number;
  active: boolean;
  xKm: number;
}

/** Signaux posés par le joueur entre deux gares (sauvegardables). */
export class PlayerSignalManager {
  private signals: PlayerSignal[] = [];
  private nextId = 1;

  add(data: PlayerSignalData): PlayerSignal {
    const s = this.build(data);
    this.signals.push(s);
    return s;
  }

  remove(id: string): void {
    this.signals = this.signals.filter((s) => s.id !== id);
  }

  getAll(): readonly PlayerSignal[] {
    return this.signals;
  }

  /** Limite (km/h) imposée sur le tronçon A–B (symétrique), null si aucune. */
  getSpeedLimit(stationA: string, stationB: string): number | null {
    let limit: number | null = null;
    for (const s of this.signals) {
      if (!s.active) continue;
      const on = (s.stationA === stationA && s.stationB === stationB) || (s.stationA === stationB && s.stationB === stationA);
      if (!on) continue;
      if (s.type === 'arret') return 0;
      if (s.type === 'avertissement') limit = Math.min(limit ?? Number.POSITIVE_INFINITY, 60);
      if (s.type === 'ralentissement' && s.speedLimit > 0) limit = Math.min(limit ?? Number.POSITIVE_INFINITY, s.speedLimit);
    }
    return limit;
  }

  toSave(): PlayerSignalData[] {
    return this.signals.map((s) => ({ ...s }));
  }

  loadFromSave(arr: readonly PlayerSignalData[] | null | undefined): void {
    this.signals = (arr ?? []).map((d) => {
      const s = this.build(d);
      const n = Number.parseInt(s.id.replace('sig-', ''), 10);
      if (Number.isFinite(n) && n >= this.nextId) this.nextId = n + 1;
      return s;
    });
  }

  private build(d: PlayerSignalData): PlayerSignal {
    const id = d.id ?? `sig-${this.nextId++}`;
    return {
      id,
      name: d.name ?? `Signal ${id}`,
      stationA: d.stationA ?? '',
      stationB: d.stationB ?? '',
      type: d.type ?? 'ralentissement',
      speedLimit: d.speedLimit ?? 40,
      active: d.active !== false,
      xKm: d.xKm ?? 0,
    };
  }
}
