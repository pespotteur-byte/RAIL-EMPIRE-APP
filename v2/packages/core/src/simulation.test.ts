import { describe, expect, it } from 'vitest';
import type { MainToWorker, WorkerToMain } from './protocol.ts';
import { SimHost, type Scheduler } from './sim-host.ts';
import { SNAPSHOT_STRIDE, Simulation, SnapshotField, type TrainSpec } from './simulation.ts';

const STATIONS = [
  { id: 'PAR', name: 'Paris-Gare-de-Lyon', lat: 48.8443, lon: 2.3744 },
  { id: 'DIJ', name: 'Dijon-Ville', lat: 47.3233, lon: 5.0273 },
  { id: 'LYO', name: 'Lyon-Part-Dieu', lat: 45.7606, lon: 4.8598 },
];

const TGV: TrainSpec = {
  id: 'T1',
  label: 'TGV 6601',
  route: ['PAR', 'DIJ', 'LYO'],
  maxSpeedKmh: 300,
  physics: { massKg: 385_000, powerW: 12_000_000, lengthM: 200, brakeServiceMs2: 0.7 },
  dwellS: 60,
  loop: true,
};

describe('Simulation v0', () => {
  it('un train parcourt sa route, s’arrête en gare puis repart', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    expect(sim.addTrain(TGV)).toBe(true);
    expect(sim.addTrain({ ...TGV, id: 'T2', route: ['PAR', 'INCONNUE'] })).toBe(false);

    const snap = new Float32Array(SNAPSHOT_STRIDE);
    // dwell initial 60 s à Paris
    for (let i = 0; i < 590; i++) sim.step(0.1);
    sim.writeSnapshot(snap);
    expect(snap[SnapshotField.Dwelling]).toBe(1);
    expect(snap[SnapshotField.Speed]).toBe(0);

    // 20 minutes : en route vers Dijon, vitesse plafonnée à 300 km/h
    for (let i = 0; i < 12_000; i++) sim.step(0.1);
    sim.writeSnapshot(snap);
    expect(snap[SnapshotField.Dwelling]).toBe(0);
    expect(snap[SnapshotField.Speed] ?? 0).toBeCloseTo(300 / 3.6, 1);
    expect(snap[SnapshotField.NextStop]).toBe(1);

    // Paris→Dijon ≈ 262 km : après 1 h 15 il est à Dijon ou reparti vers Lyon
    for (let i = 0; i < 33_000; i++) sim.step(0.1);
    sim.writeSnapshot(snap);
    expect(snap[SnapshotField.NextStop]).toBe(2);
    expect(snap[SnapshotField.RouteKm] ?? 0).toBeGreaterThan(260);
  });

  it('la vitesse ne dépasse jamais la vitesse d’arrêt possible (freinage)', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    sim.addTrain({ ...TGV, dwellS: 0 });
    const snap = new Float32Array(SNAPSHOT_STRIDE);
    let maxSpeed = 0;
    let arrived = false;
    for (let i = 0; i < 60_000 && !arrived; i++) {
      sim.step(0.1);
      sim.writeSnapshot(snap);
      maxSpeed = Math.max(maxSpeed, snap[SnapshotField.Speed] ?? 0);
      if (snap[SnapshotField.NextStop] === 2) arrived = true;
    }
    expect(arrived).toBe(true);
    expect(maxSpeed).toBeLessThanOrEqual(300 / 3.6 + 1e-3);
  });

  it('10 000 trains × 1 tick tiennent dans le budget CPU', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    for (let i = 0; i < 10_000; i++) sim.addTrain({ ...TGV, id: `T${i}`, dwellS: 0 });
    for (let i = 0; i < 10; i++) sim.step(0.1);
    const snap = new Float32Array(10_000 * SNAPSHOT_STRIDE);
    expect(sim.writeSnapshot(snap)).toBe(10_000);
    expect(sim.stats().lastStepMs).toBeLessThan(50);
  });
});

describe('SimHost', () => {
  function fakeScheduler(): Scheduler & { tick(ms: number): void } {
    let t = 0;
    let cb: (() => void) | null = null;
    let every = 0;
    let next = 0;
    return {
      now: () => t,
      setInterval(c, ms) {
        cb = c;
        every = ms;
        next = t + ms;
        return 1;
      },
      clearInterval() {
        cb = null;
      },
      tick(ms) {
        const end = t + ms;
        while (cb && next <= end) {
          t = next;
          cb();
          next += every;
        }
        t = end;
      },
    };
  }

  it('publie des snapshots à la cadence demandée et recycle les tampons', () => {
    const out: WorkerToMain[] = [];
    const sched = fakeScheduler();
    const host = new SimHost((m) => out.push(m), sched);
    const send = (m: MainToWorker) => {
      host.handle(m);
    };
    send({ type: 'init', tickS: 0.1, snapshotHz: 5 });
    send({ type: 'stations', stations: STATIONS });
    send({ type: 'addTrain', spec: { ...TGV, dwellS: 0 } });
    send({ type: 'run', running: true });
    sched.tick(1000);
    const snaps = out.flatMap((m) => (m.type === 'snapshot' ? [m] : []));
    // 2 tampons seulement : sans recyclage, au plus 2 snapshots partent
    expect(snaps.length).toBe(2);
    expect(out.some((m) => m.type === 'trains')).toBe(true);
    for (const s of snaps) send({ type: 'recycle', buffer: s.buffer });
    sched.tick(1000);
    expect(out.filter((m) => m.type === 'snapshot').length).toBe(4);
    send({ type: 'stats' });
    const stats = out.at(-1);
    expect(stats?.type).toBe('stats');
    if (stats?.type === 'stats') {
      expect(stats.simTime).toBeCloseTo(2, 5);
      expect(stats.trains).toBe(1);
    }
    send({ type: 'run', running: false });
    sched.tick(1000);
    expect(out.filter((m) => m.type === 'snapshot').length).toBe(4);
  });
});
