import type { MainToWorker, StationInput, TrainDetail, TrainSpec, WeatherCondition, WorkerToMain } from '@re/core';
import SimWorker from '@re/core/sim.worker?worker&inline';
import { signal } from '@preact/signals';

export interface SnapshotView {
  data: Float32Array;
  count: number;
  simTime: number;
}

/**
 * Façade thread principal du worker de simulation. Le dernier snapshot reçu est
 * exposé tel quel ; le tampon précédent repart au worker (zéro copie).
 */
export class SimClient {
  readonly ready = signal(false);
  readonly trains = signal<{ ids: string[]; labels: string[] }>({ ids: [], labels: [] });
  readonly stats = signal<Extract<WorkerToMain, { type: 'stats' }> | null>(null);
  readonly running = signal(false);
  readonly timeScale = signal(1);
  readonly error = signal<string | null>(null);
  readonly snapshotSeq = signal(0);
  readonly detail = signal<TrainDetail | null>(null);
  private readonly worker: Worker;
  private snapshot: SnapshotView = { data: new Float32Array(0), count: 0, simTime: 0 };
  private snapshotBuffer: ArrayBuffer = new ArrayBuffer(0);
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(tickS = 0.1, snapshotHz = 10) {
    this.worker = new SimWorker();
    this.worker.onmessage = (ev: MessageEvent<WorkerToMain>) => {
      this.onMessage(ev.data);
    };
    this.worker.onerror = (ev) => {
      this.error.value = ev.message;
    };
    this.send({ type: 'init', tickS, snapshotHz });
    this.statsTimer = setInterval(() => {
      this.send({ type: 'stats' });
    }, 1000);
  }

  get latest(): SnapshotView {
    return this.snapshot;
  }

  addStations(stations: StationInput[]): void {
    this.send({ type: 'stations', stations });
  }
  addTrain(spec: TrainSpec): void {
    this.send({ type: 'addTrain', spec });
  }
  removeTrain(id: string): void {
    this.send({ type: 'removeTrain', id });
  }
  setRunning(running: boolean): void {
    this.running.value = running;
    this.send({ type: 'run', running });
  }
  setTimeScale(scale: number): void {
    this.timeScale.value = scale;
    this.send({ type: 'timeScale', scale });
  }
  setWeather(weather: WeatherCondition): void {
    this.send({ type: 'weather', weather });
  }
  inspect(id: string): void {
    this.send({ type: 'inspect', id });
  }

  destroy(): void {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.worker.terminate();
  }

  private send(m: MainToWorker, transfer?: ArrayBuffer[]): void {
    if (transfer) this.worker.postMessage(m, transfer);
    else this.worker.postMessage(m);
  }

  private onMessage(m: WorkerToMain): void {
    switch (m.type) {
      case 'ready':
        this.ready.value = true;
        break;
      case 'trains':
        this.trains.value = { ids: m.ids, labels: m.labels };
        break;
      case 'snapshot': {
        const previous = this.snapshotBuffer;
        this.snapshotBuffer = m.buffer;
        this.snapshot = { data: new Float32Array(m.buffer), count: m.count, simTime: m.simTime };
        this.snapshotSeq.value++;
        this.send({ type: 'recycle', buffer: previous }, [previous]);
        break;
      }
      case 'stats':
        this.stats.value = m;
        break;
      case 'trainDetail':
        this.detail.value = m.detail;
        break;
      case 'error':
        this.error.value = m.message;
        break;
    }
  }
}
