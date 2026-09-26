/**
 * Tests oracle RC28 — étape 2 : vitesses de voie, signalisation, autorité de
 * mouvement, cantons partagés, dégagement de queue, route compilée, intégration.
 */
import { describe, expect, it } from 'vitest';
import { BlockManager } from './blocks.ts';
import { MovementAuthority } from './movement-authority.ts';
import { blockIndexAtKm, compileRoute, limitAtKm, poseAtKm, segmentIndexAtKm } from './rail-route.ts';
import { resolveRailSpeedLimits } from './rail-speed.ts';
import { Aspect, aspectFromOccupancy, aspectSpeedCapKmh, cantonLengthKm, visaSpeedCapKmh } from './signaling.ts';
import { SNAPSHOT_STRIDE, Simulation, SnapshotField, type TrainSpec } from './simulation.ts';
import { accelerationMs2, brakingDecelMs2, rearClearanceCaps, TailSpeedIndex, weatherAdhesion } from './train-physics.ts';

describe('rail-speed (oracle RC28)', () => {
  it('ligne inconnue → 160, voie de service → 30, FALLBACK_30 ignoré', () => {
    const lim = resolveRailSpeedLimits([
      { lat: 48, lon: 2 },
      { lat: 48.001, lon: 2, service: 'siding' },
      { lat: 48.002, lon: 2, maxSpeed: 30, maxSpeedSource: 'FALLBACK_30' },
    ]);
    expect(Array.from(lim)).toEqual([160, 30, 160]);
  });

  it('vitesse documentée héritée ≤ 1 km sur le même way, directionnelle respectée', () => {
    const lim = resolveRailSpeedLimits(
      [
        { lat: 48, lon: 2, wayId: 'w1', maxSpeed: 100, maxSpeedSource: 'OSM' },
        { lat: 48.005, lon: 2, wayId: 'w1' }, // ~556 m : hérite 100
        { lat: 48.02, lon: 2, wayId: 'w1' }, // ~2,2 km : plus d'héritage → 160
        { lat: 48.03, lon: 2, wayId: 'w2', maxSpeedForward: 120, maxSpeedBackward: 80, travelDirection: 'backward' },
      ],
      200,
    );
    expect(Array.from(lim)).toEqual([100, 100, 160, 80]);
  });
});

describe('signaling (oracle RC28)', () => {
  it('longueur de canton selon la vitesse de ligne', () => {
    expect([60, 100, 160, 200, 320].map(cantonLengthKm)).toEqual([0.5, 0.9, 1.2, 1.5, 2.0]);
  });
  it('visa vers un carré fermé : 10/20/30 km/h puis 0 dans la marge', () => {
    expect(visaSpeedCapKmh(500)).toBeNull();
    expect(visaSpeedCapKmh(250)).toBe(30);
    expect(visaSpeedCapKmh(150)).toBe(20);
    expect(visaSpeedCapKmh(80)).toBe(10);
    expect(visaSpeedCapKmh(20)).toBe(0);
  });
  it('aspects et plafonds', () => {
    expect(aspectFromOccupancy(false, false)).toBe(Aspect.Clear);
    expect(aspectFromOccupancy(false, true)).toBe(Aspect.Caution);
    expect(aspectFromOccupancy(true, false)).toBe(Aspect.Closed);
    expect(aspectSpeedCapKmh(Aspect.Clear, 160)).toBe(160);
    expect(aspectSpeedCapKmh(Aspect.Caution, 160)).toBe(60);
    expect(aspectSpeedCapKmh(Aspect.Closed, 160, 150)).toBe(20);
  });
});

describe('movement-authority (oracle RC28)', () => {
  it('STOP > CAUTION, plus basse limite, premier soumis en cas d’égalité', () => {
    const ma = new MovementAuthority();
    let d = ma.begin(160).decision();
    expect(d.status).toBe('GO');
    expect(d.speedLimitKmh).toBe(160);
    d = ma.begin(160).caution(60, 'A').caution(40, 'B').caution(40, 'C').decision();
    expect(d.status).toBe('CAUTION');
    expect(d.speedLimitKmh).toBe(40);
    expect(d.code).toBe('B');
    d = ma.begin(160).caution(40, 'B').stop('S').decision();
    expect(d.status).toBe('STOP');
    expect(d.code).toBe('S');
    expect(d.speedLimitKmh).toBe(0);
    d = ma.begin(160).limit(0, 'L0').decision();
    expect(d.status).toBe('STOP');
  });
});

describe('BlockManager', () => {
  const A = { cantonId: 'c1', startIndex: 0, endIndex: 1, startKm: 0, endKm: 1, trackSig: 'w', resourceIds: ['r1', 'r2'] };
  const B = { cantonId: 'c2', startIndex: 0, endIndex: 1, startKm: 0, endKm: 1, trackSig: 'w', resourceIds: ['r2'] };

  it('occupation exclusive, ressources partagées, libération, propriétaires disparus', () => {
    const gone = new Set<string>();
    const bm = new BlockManager({ isGone: (id) => gone.has(id) });
    bm.register([A, B]);
    expect(bm.cantonCount).toBe(2);
    expect(bm.occupy('c1', 'T1')).toBe(true);
    expect(bm.occupy('c1', 'T1')).toBe(true);
    expect(bm.reserve('c1', 'T2')).toBe(false);
    expect(bm.reserve('c2', 'T2')).toBe(false); // r2 partagé avec c1
    expect(bm.conflictFor('c2', 'T2')?.owner).toBe('T1');
    bm.release('c1', 'T1');
    expect(bm.reserve('c2', 'T2')).toBe(true);
    expect(bm.occupy('c1', 'T3')).toBe(false); // réservé par T2 via r2
    gone.add('T2');
    expect(bm.occupy('c1', 'T3')).toBe(true);
    expect(bm.heldBy('T3')).toEqual(['c1']);
    bm.releaseAll('T3');
    expect(bm.occupant('c1')).toBeNull();
  });
});

describe('train-physics', () => {
  const p = { massKg: 400_000, powerW: 6_000_000, lengthM: 200, brakeServiceMs2: 0.8 };
  it('adhérence météo et bornes de traction/freinage', () => {
    expect(weatherAdhesion('clear')).toBe(0.33);
    expect(weatherAdhesion('snow')).toBe(0.15);
    expect(accelerationMs2(p, 0)).toBeGreaterThan(0.3);
    expect(accelerationMs2(p, 80)).toBeLessThan(accelerationMs2(p, 10));
    expect(brakingDecelMs2(p, 'clear')).toBe(0.8);
    expect(brakingDecelMs2(p, 'snow')).toBeCloseTo(0.15 * 9.81 * 0.5, 6);
  });

  it('dégagement de queue : l’ancienne limite persiste sur la longueur de la rame', () => {
    const distance = new Float64Array([100, 100, 100, 100, 100]);
    const original = new Float64Array([60, 60, 120, 120, 120]);
    const up = new Uint8Array([0, 0, 1, 0, 0]);
    const caps = rearClearanceCaps(distance, original, up, 150);
    expect(Array.from(caps)).toEqual([0, 0, 60, 60, 0]);
  });

  it('TailSpeedIndex : minimum sous la rame, y compris à travers les blocs', () => {
    const n = 200;
    const seg = new Float64Array(n).fill(0.1);
    const sp = new Float64Array(n + 1).fill(160);
    sp[10] = 40;
    const idx = new TailSpeedIndex(seg, sp);
    expect(idx.minimum(9, 0.5, 0)).toBe(40);
    expect(idx.minimum(12, 0.5, 400)).toBe(40); // queue à 250 m → couvre le sommet 10
    expect(idx.minimum(12, 0.5, 100)).toBe(160);
    expect(idx.minimum(150, 0.2, 14_500)).toBe(40); // saut de bloc
  });
});

describe('compileRoute', () => {
  it('km cumulés, cantons, arrêts et pose', () => {
    const r = compileRoute(
      [
        { lat: 48, lon: 2, stopId: 'A', maxSpeed: 100, maxSpeedSource: 'OSM', wayId: 'w' },
        { lat: 48.02, lon: 2, wayId: 'w' },
        { lat: 48.04, lon: 2, stopId: 'B', wayId: 'w' },
      ],
      160,
    );
    expect(r.vertexCount).toBeGreaterThanOrEqual(3);
    expect(r.totalKm).toBeCloseTo(4.45, 1);
    expect(r.stops.map((s) => s.stationId)).toEqual(['A', 'B']);
    expect(r.stops[1]?.km).toBeCloseTo(r.totalKm, 9);
    expect(limitAtKm(r, 0.5)).toBe(100);
    // densification : cantons ≤ 0,9 km (ligne 100) puis ≤ 1,2 km (ligne 160)
    expect(r.blocks.length).toBeGreaterThanOrEqual(3);
    expect(r.blocks[0]?.startKm).toBe(0);
    expect(r.blocks.at(-1)?.endKm).toBeCloseTo(r.totalKm, 9);
    for (let i = 1; i < r.blocks.length; i++) expect(r.blocks[i]?.startKm).toBeCloseTo(r.blocks[i - 1]?.endKm ?? -1, 9);
    expect(blockIndexAtKm(r.blocks, 0)).toBe(0);
    expect(blockIndexAtKm(r.blocks, r.totalKm)).toBe(r.blocks.length - 1);
    expect(segmentIndexAtKm(r, r.totalKm)).toBe(r.vertexCount - 2);
    const pose = { x: 0, y: 0, heading: 0 };
    poseAtKm(r, 1, pose);
    expect(pose.heading).toBeCloseTo(Math.PI / 2, 3); // plein nord
  });
});

describe('Simulation — cantonnement et autorité', () => {
  const STATIONS = [
    { id: 'A', name: 'A', lat: 48, lon: 2 },
    { id: 'B', name: 'B', lat: 48.3, lon: 2 },
  ];
  const base: TrainSpec = {
    id: 'X',
    label: 'X',
    route: ['A', 'B'],
    maxSpeedKmh: 160,
    physics: { massKg: 200_000, powerW: 4_000_000, lengthM: 100, brakeServiceMs2: 0.9 },
    dwellS: 0,
    loop: false,
  };

  it('un train suiveur reste derrière le train de tête sans jamais entrer dans son canton', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    expect(sim.addTrain({ ...base, id: 'lead' })).toBe(true);
    expect(sim.addTrain({ ...base, id: 'follow', maxSpeedKmh: 160 })).toBe(true);
    const snap = new Float32Array(2 * SNAPSHOT_STRIDE);
    let followMoved = false;
    let sawStopBySignal = false;
    for (let i = 0; i < 20_000; i++) {
      sim.step(0.1);
      sim.writeSnapshot(snap);
      const leadKm = snap[SnapshotField.RouteKm] ?? 0;
      const followKm = snap[SNAPSHOT_STRIDE + SnapshotField.RouteKm] ?? 0;
      expect(followKm).toBeLessThanOrEqual(leadKm + 1e-9);
      if (followKm > 0.01) followMoved = true;
      const d = sim.trainDetail('follow');
      if (d && d.status !== 'GO' && d.code.startsWith('SIGNAL')) sawStopBySignal = true;
      // aucun canton n'a deux occupants : le suiveur ne partage jamais le canton de tête
      const lead = sim.trainDetail('lead');
      if (lead && !lead.dwelling && d && !d.dwelling && followKm > 0) {
        expect(leadKm - followKm).toBeGreaterThan(0);
      }
    }
    expect(followMoved).toBe(true);
    expect(sawStopBySignal).toBe(true);
    expect(sim.trainDetail('lead')?.dwelling).toBe(true);
  });

  it('la limite de ligne s’applique sous toute la rame et la météo réduit le freinage', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    sim.addTrain({
      ...base,
      legs: [
        [
          { lat: 48, lon: 2, wayId: 'w', maxSpeed: 60, maxSpeedSource: 'OSM' },
          { lat: 48.05, lon: 2, wayId: 'w', maxSpeed: 160, maxSpeedSource: 'OSM' },
          { lat: 48.3, lon: 2, wayId: 'w', maxSpeed: 160, maxSpeedSource: 'OSM' },
        ],
      ],
    });
    sim.setWeather('snow');
    const snap = new Float32Array(SNAPSHOT_STRIDE);
    for (let i = 0; i < 3000; i++) {
      sim.step(0.1);
      sim.writeSnapshot(snap);
      const km = snap[SnapshotField.RouteKm] ?? 0;
      const v = (snap[SnapshotField.Speed] ?? 0) * 3.6;
      // tant que la queue (100 m) n'a pas franchi le point à ~5,56 km, 60 km/h max
      if (km < 5.56 + 0.1) expect(v).toBeLessThanOrEqual(60 + 1e-6);
    }
    const d = sim.trainDetail('X');
    expect(d?.speedKmh ?? 0).toBeGreaterThan(60);
    expect(brakingDecelMs2(base.physics, 'snow')).toBeLessThan(base.physics.brakeServiceMs2 ?? 1);
  });

  it('boucle : retournement au terminus, cantons libérés', () => {
    const sim = new Simulation();
    sim.addStations(STATIONS);
    sim.addTrain({ ...base, loop: true, dwellS: 10 });
    let reversed = false;
    for (let i = 0; i < 40_000 && !reversed; i++) {
      sim.step(0.1);
      const d = sim.trainDetail('X');
      if (d?.nextStop === 'A') reversed = true;
    }
    expect(reversed).toBe(true);
    const d = sim.trainDetail('X');
    expect(d?.blocksHeld).toBe(1);
  });
});
