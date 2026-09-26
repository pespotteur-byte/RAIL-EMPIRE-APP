/**
 * Boucle d'exécution de la simulation, indépendante du transport : le worker
 * lui passe les messages et une fonction `post`. Testable en Node sans Worker.
 */
import type { MainToWorker, WorkerToMain } from './protocol.ts';
import { SNAPSHOT_STRIDE, Simulation } from './simulation.ts';

export interface Scheduler {
  setInterval(cb: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  now(): number;
}

export class SimHost {
  readonly sim = new Simulation();
  private readonly post: (m: WorkerToMain, transfer?: ArrayBuffer[]) => void;
  private readonly scheduler: Scheduler;
  private tickS = 0.1;
  private snapshotEveryTicks = 1;
  private timeScale = 1;
  private running = false;
  private timer: unknown = null;
  private tickCounter = 0;
  private accumulator = 0;
  private lastWall = 0;
  private ticksSince = 0;
  private tpsWindowStart = 0;
  private ticksPerSecond = 0;
  private readonly freeBuffers: ArrayBuffer[] = [];
  private trainsDirty = false;

  constructor(post: (m: WorkerToMain, transfer?: ArrayBuffer[]) => void, scheduler: Scheduler) {
    this.post = post;
    this.scheduler = scheduler;
  }

  handle(m: MainToWorker): void {
    switch (m.type) {
      case 'init':
        this.tickS = m.tickS;
        this.snapshotEveryTicks = Math.max(1, Math.round(1 / (m.tickS * m.snapshotHz)));
        this.freeBuffers.length = 0;
        this.freeBuffers.push(new ArrayBuffer(0), new ArrayBuffer(0));
        this.post({ type: 'ready' });
        break;
      case 'stations':
        this.sim.addStations(m.stations);
        break;
      case 'addTrain':
        if (this.sim.addTrain(m.spec)) this.trainsDirty = true;
        break;
      case 'removeTrain':
        if (this.sim.removeTrain(m.id)) this.trainsDirty = true;
        break;
      case 'run':
        this.setRunning(m.running);
        break;
      case 'timeScale':
        this.timeScale = Math.max(0, m.scale);
        break;
      case 'recycle':
        if (this.freeBuffers.length < 2) this.freeBuffers.push(m.buffer);
        break;
      case 'weather':
        this.sim.setWeather(m.weather);
        break;
      case 'inspect':
        this.post({ type: 'trainDetail', detail: this.sim.trainDetail(m.id) });
        break;
      case 'stats':
        this.postStats();
        break;
    }
  }

  /** Une itération de la boucle : rattrape le temps écoulé par pas fixes. */
  pump(): void {
    const wall = this.scheduler.now();
    const elapsed = Math.min(0.5, (wall - this.lastWall) / 1000) * this.timeScale;
    this.lastWall = wall;
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator >= this.tickS && steps < 50) {
      this.sim.step(this.tickS);
      this.accumulator -= this.tickS;
      this.tickCounter++;
      this.ticksSince++;
      steps++;
      if (this.tickCounter % this.snapshotEveryTicks === 0) this.sendSnapshot();
    }
    if (wall - this.tpsWindowStart >= 1000) {
      this.ticksPerSecond = (this.ticksSince * 1000) / Math.max(1, wall - this.tpsWindowStart);
      this.ticksSince = 0;
      this.tpsWindowStart = wall;
    }
  }

  private setRunning(running: boolean): void {
    if (running === this.running) return;
    this.running = running;
    if (running) {
      this.lastWall = this.scheduler.now();
      this.tpsWindowStart = this.lastWall;
      this.timer = this.scheduler.setInterval(() => {
        this.pump();
      }, Math.max(4, Math.round((this.tickS * 1000) / 2)));
      this.sendSnapshot();
    } else if (this.timer !== null) {
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private sendSnapshot(): void {
    if (this.trainsDirty) {
      this.post({ type: 'trains', ids: this.sim.trainIds(), labels: this.sim.trainLabels() });
      this.trainsDirty = false;
    }
    let buffer = this.freeBuffers.pop();
    if (!buffer) return; // l'UI n'a pas encore rendu les tampons : on saute ce snapshot
    const needed = this.sim.trainCount * SNAPSHOT_STRIDE * 4;
    if (buffer.byteLength < needed) buffer = new ArrayBuffer(Math.max(needed, 64 * SNAPSHOT_STRIDE * 4));
    const view = new Float32Array(buffer, 0, Math.floor(buffer.byteLength / 4));
    const count = this.sim.writeSnapshot(view);
    this.post({ type: 'snapshot', buffer, count, simTime: this.sim.time }, [buffer]);
  }

  private postStats(): void {
    const s = this.sim.stats();
    this.post({ type: 'stats', ...s, ticksPerSecond: this.ticksPerSecond });
  }
}
