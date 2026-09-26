/**
 * Protocole thread principal ⇄ worker de simulation.
 *
 * Le snapshot (positions/vitesses) circule dans un ArrayBuffer transféré, jamais
 * copié : le worker l'envoie, l'UI le lit puis le renvoie (`recycle`). Deux
 * tampons suffisent (un en lecture côté UI, un en écriture côté worker).
 */
import type { TrainDetail, TrainSpec } from './simulation.ts';
import type { WeatherCondition } from './train-physics.ts';

export interface StationInput {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export type MainToWorker =
  | { type: 'init'; tickS: number; snapshotHz: number }
  | { type: 'stations'; stations: StationInput[] }
  | { type: 'addTrain'; spec: TrainSpec }
  | { type: 'removeTrain'; id: string }
  | { type: 'run'; running: boolean }
  | { type: 'timeScale'; scale: number }
  | { type: 'recycle'; buffer: ArrayBuffer }
  | { type: 'weather'; weather: WeatherCondition }
  | { type: 'inspect'; id: string }
  | { type: 'stats' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'trains'; ids: string[]; labels: string[] }
  | { type: 'snapshot'; buffer: ArrayBuffer; count: number; simTime: number }
  | { type: 'stats'; simTime: number; trains: number; stations: number; cantons: number; lastStepMs: number; ticksPerSecond: number }
  | { type: 'trainDetail'; detail: TrainDetail | null }
  | { type: 'error'; message: string };
