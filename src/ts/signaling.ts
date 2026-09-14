// Railway signaling & block sections (Remaster P0 — SIG).
export const ASPECT = {
  CLEAR: 'clear',
  CAUTION: 'caution',
  CLOSED: 'closed',
} as const;
export type SignalAspect = typeof ASPECT[keyof typeof ASPECT];

export const CARRE_STOP_MARGIN_M = 30;
export const RESTART_SPEED_KMH = 60;
const VISA_STEPS: ReadonlyArray<readonly [number, number]> = [[100,10],[200,20],[300,30]];

export function cantonLengthKm(lineSpeedKmh: number): number {
  const v = lineSpeedKmh || 0;
  if (v <= 60) return 0.5;
  if (v <= 100) return 0.9;
  if (v <= 160) return 1.2;
  if (v <= 200) return 1.5;
  return 2.0;
}

export function visaSpeedCapKmh(distToClosedSignalM: number, marginM = CARRE_STOP_MARGIN_M): number | null {
  if (!(distToClosedSignalM >= 0)) return null;
  if (distToClosedSignalM <= marginM) return 0;
  for (const [maxD, spd] of VISA_STEPS) if (distToClosedSignalM <= maxD) return spd;
  return null;
}

export function aspectFromOccupancy(nextOccupied: boolean, secondOccupied: boolean): SignalAspect {
  if (nextOccupied) return ASPECT.CLOSED;
  if (secondOccupied) return ASPECT.CAUTION;
  return ASPECT.CLEAR;
}

export function aspectSpeedCapKmh(aspect: SignalAspect | string, lineSpeedKmh: number, distToSignalM = Infinity, marginM = CARRE_STOP_MARGIN_M): number {
  switch (aspect) {
    case ASPECT.CLEAR: return lineSpeedKmh;
    case ASPECT.CAUTION: return Math.min(lineSpeedKmh, RESTART_SPEED_KMH);
    case ASPECT.CLOSED: {
      const visa = visaSpeedCapKmh(distToSignalM, marginM);
      return visa === null ? Math.min(lineSpeedKmh, RESTART_SPEED_KMH) : visa;
    }
    default: return lineSpeedKmh;
  }
}

export type PlayerSignalType = 'ralentissement' | 'avertissement' | 'arret' | string;
export interface PlayerSignalData {
  id?: string; name?: string; stationA?: string; stationB?: string;
  type?: PlayerSignalType; speedLimit?: number; active?: boolean; xKm?: number;
}

let nextSignalId = 1;
export class PlayerSignal {
  id: string; name: string; stationA: string; stationB: string; type: PlayerSignalType;
  speedLimit: number; active: boolean; xKm: number;
  constructor(data: PlayerSignalData) {
    this.id = data.id || `sig-${nextSignalId++}`;
    this.name = data.name || `Signal ${this.id}`;
    this.stationA = data.stationA || '';
    this.stationB = data.stationB || '';
    this.type = data.type || 'ralentissement';
    this.speedLimit = data.speedLimit || 40;
    this.active = data.active !== false;
    this.xKm = data.xKm || 0;
  }
}

export class PlayerSignalManager {
  signals: PlayerSignal[] = [];
  add(data: PlayerSignalData): PlayerSignal { const s = new PlayerSignal(data); this.signals.push(s); return s; }
  remove(id: string): void { this.signals = this.signals.filter(s => s.id !== id); }
  getAll(): PlayerSignal[] { return this.signals; }
  getSpeedLimit(stationA: string, stationB: string): number | null {
    let limit: number | null = null;
    for (const s of this.signals) {
      if (!s.active) continue;
      const onSegment = (s.stationA === stationA && s.stationB === stationB) || (s.stationA === stationB && s.stationB === stationA);
      if (!onSegment) continue;
      if (s.type === 'arret') return 0;
      if (s.type === 'avertissement') limit = Math.min(limit ?? Infinity, 60);
      if (s.type === 'ralentissement' && s.speedLimit > 0) limit = Math.min(limit ?? Infinity, s.speedLimit);
    }
    return limit;
  }
  toSave(): PlayerSignalData[] { return this.signals.map(s => ({id:s.id,name:s.name,stationA:s.stationA,stationB:s.stationB,type:s.type,speedLimit:s.speedLimit,active:s.active,xKm:s.xKm})); }
  loadFromSave(arr: PlayerSignalData[] | null | undefined): void {
    this.signals = (arr || []).map(d => {
      const s = new PlayerSignal(d);
      const n = parseInt(d.id?.replace('sig-', '') || '0');
      if (n >= nextSignalId) nextSignalId = n + 1;
      return s;
    });
  }
}
