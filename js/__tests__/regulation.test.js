import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator, ActiveService } from '../schedule-creator.js';
import { StaffManager } from '../staff.js';

const economy = {
  processStopRevenue() {},
  processServiceRevenue() {},
};

function makeWorld() {
  return {
    stations: [
      { id: 'A', name: 'Paris', lat: 0, lon: 0 },
      { id: 'B', name: 'Lyon', lat: 0.1, lon: 0 },
    ],
    tracks: [],
    getStationById(id) { return this.stations.find(s => s.id === id); },
  };
}

function makeService(sc, world, name, rameId, departureTime) {
  return sc.addService({
    name,
    rameId,
    serviceType: 'passager',
    stops: [
      { stationId: 'A', type: 'arret', departureTime, arrivalTime: departureTime },
      { stationId: 'B', type: 'arret', departureTime: departureTime + 60, arrivalTime: departureTime + 60 },
    ],
    routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
  }, null, world);
}

function makeVoieManager() {
  const voiePoints = [
    { id: 'vp-B-1', lat: 0.1, lon: 0, voie: '1', stationId: 'B', occupiedBy: null },
  ];
  return {
    voiePoints,
    getVoiePointById(id) {
      return voiePoints.find(v => v.id === id) || null;
    },
    getStationVoiePoints(stationId) {
      return voiePoints.filter(vp => vp.stationId === stationId);
    },
    getStationVoiePoint(stationId, voie) {
      return voiePoints.find(vp => vp.stationId === stationId && vp.voie === voie) || null;
    },
    isVoiePointOccupied(id, excludeTrainId) {
      const vp = voiePoints.find(v => v.id === id);
      return vp && vp.occupiedBy !== null && vp.occupiedBy !== excludeTrainId;
    },
    occupyVoiePoint(id, trainId) {
      const vp = voiePoints.find(v => v.id === id);
      if (vp) vp.occupiedBy = trainId;
    },
    releaseAllVoiePointsForTrain(trainId) {
      for (const vp of voiePoints) {
        if (vp.occupiedBy === trainId) vp.occupiedBy = null;
      }
    },
    releaseAllForTrain() {},
  };
}

function makePlatformManager() {
  return {
    assignPlatform(stationId, trainId, platforms, preferred) { return preferred || '1'; },
    releasePlatform() {},
  };
}

describe('Validation PR? — gameplay / signalisation / régulation', () => {
  beforeEach(() => {
    global.window = {
      game: {
        scheduleCreator: null,
        economy,
        realismSettings: { delayTolerance: 30 },
      },
    };
  });

  it('OCC-03 — priorité au départ au voyageur dont le départ est le plus tôt', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const world = makeWorld();
    const svc1 = makeService(sc, world, 'TGV 600', 'r1', 600);
    const svc2 = makeService(sc, world, 'TGV 605', 'r2', 605);

    sc.beginTick(605);
    svc1.scheduleTick(605, '2024-01-01', economy);
    svc2.scheduleTick(605, '2024-01-01', economy);

    assert.equal(svc1.state, 'moving', 'le train le plus tôt doit partir');
    assert.equal(svc2.state, 'waiting', 'le train plus tardif doit attendre');

    sc.beginTick(606);
    svc2.scheduleTick(606, '2024-01-01', economy);
    assert.equal(svc2.state, 'moving', 'le second train part après le premier');
  });

  it('REG-03 — garage temporaire pour train retardé et non prioritaire', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const staff = new StaffManager();
    const world = makeWorld();
    const svc1 = makeService(sc, world, 'TGV 600', 'r1', 600);
    const svc2 = makeService(sc, world, 'TGV 700', 'r2', 700);
    // Fenêtres de service suffisantes pour que les deux soient "due" à 740
    svc1.stops[1].departureTime = 900;
    svc1.stops[1].arrivalTime = 900;
    svc2.stops[1].departureTime = 1000;
    svc2.stops[1].arrivalTime = 1000;

    const active = sc.getActiveServices();
    sc.beginTick(740);
    staff.tickRegulateurs(active, 740, '2024-01-01', { delayTolerance: 30 });
    svc1.scheduleTick(740, '2024-01-01', economy);
    svc2.scheduleTick(740, '2024-01-01', economy);

    assert.equal(svc1.state, 'moving', 'le train prioritaire part');
    assert.ok(svc2._garageUntil && svc2._garageUntil > 740, 'le second train est mis au garage');
    assert.equal(svc2.state, 'waiting', 'le second train ne part pas immédiatement');

    // Au garageUntil le train seul en gare peut repartir
    const garageUntil = svc2._garageUntil;
    sc.beginTick(garageUntil);
    staff.tickRegulateurs(sc.getActiveServices(), garageUntil, '2024-01-01', { delayTolerance: 30 });
    svc2.scheduleTick(garageUntil, '2024-01-01', economy);
    assert.equal(svc2.state, 'moving', 'le train garé repart après le garageUntil');
  });

  it('OCC-01/02 — occupation de gare bloque le second train si aucune voie libre', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const vpm = makeVoieManager();
    const pm = makePlatformManager();
    global.window.game.voiePointManager = vpm;
    global.window.game.platformManager = pm;
    const world = makeWorld();
    const stopsABC = [
      { stationId: 'A', type: 'arret', departureTime: 0, arrivalTime: 0 },
      { stationId: 'B', type: 'arret', departureTime: 10, arrivalTime: 10 },
      { stationId: 'C', type: 'arret', departureTime: 30, arrivalTime: 30 },
    ];
    const routes = [
      [{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }],
      [{ lat: 0.1, lon: 0 }, { lat: 0.2, lon: 0 }],
    ];

    const svc1 = sc.addService({ name: 'Train 1', rameId: 'r1', serviceType: 'passager', stops: stopsABC, routes }, null, world);
    const svc2 = sc.addService({ name: 'Train 2', rameId: 'r2', serviceType: 'passager', stops: stopsABC, routes }, null, world);
    svc1.state = 'moving';
    svc1.currentStopIndex = 1;
    svc1.position = { lat: 0, lon: 0 };
    svc2.state = 'moving';
    svc2.currentStopIndex = 1;
    svc2.position = { lat: 0, lon: 0 };

    const stationB = world.getStationById('B');
    svc1.arriveAtStation(stationB, 10, economy);
    assert.equal(svc1.state, 'stopped_at_station');
    assert.equal(vpm.isVoiePointOccupied('vp-B-1', svc2.id), true, 'la voie est occupée par le train 1');

    svc2.arriveAtStation(stationB, 10, economy);
    assert.equal(svc2.state, 'moving', 'le train 2 reste en approche car la voie est occupée');
    assert.equal(svc2.train.blockedBy, true);
    assert.equal(svc2.train.delayReason, 'attente voie libre en gare');

    // Libération de la voie
    vpm.releaseAllVoiePointsForTrain(svc1.id);
    svc2.arriveAtStation(stationB, 11, economy);
    assert.equal(svc2.state, 'stopped_at_station', 'le train 2 entre en gare une fois la voie libre');
  });
});
