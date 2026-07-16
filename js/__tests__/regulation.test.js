import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator, ActiveService } from '../schedule-creator.js';
import { StaffManager } from '../staff.js';
import { CantonManager } from '../simulation.js';
import { getGlobalRng, setGlobalRng, SeededRng } from '../rng.js?v=1784241352';

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

  it('INC-03 — incident en gare bloque le départ au même moment', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const world = makeWorld();
    const svc = makeService(sc, world, 'TGV 600', 'r1', 600);

    svc.train.incident = { effect: 'stop', name: 'Bagage abandonné' };
    sc.beginTick(601);
    svc.scheduleTick(601, '2024-01-01', economy);
    assert.equal(svc.state, 'waiting', 'le départ est bloqué par un incident stop');
    assert.equal(svc.train.delayReason, 'Bagage abandonné');
    assert.ok(svc.delay > 0, 'le retard est compté');

    svc.train.incident = null;
    sc.beginTick(601);
    svc.scheduleTick(601, '2024-01-01', economy);
    assert.equal(svc.state, 'moving', 'le train repart une fois l incident levé');
  });

  it('OCC-05 — écart de 2 min après libération du canton', () => {
    const mgr = new CantonManager();
    const route = [{ lat: 0, lon: 0, maxSpeed: 30 }, { lat: 0, lon: 0.005, maxSpeed: 30 }];
    const assignments = mgr.createRouteCantons(route);
    const c0 = assignments[0].cantonId;

    mgr.setTime(0);
    assert.equal(mgr.occupy(c0, 'A'), true);
    mgr.release(c0, 'A');

    mgr.setTime(1);
    assert.equal(mgr.reserve(c0, 'B'), false, '1 min après libération, canton non disponible');

    mgr.setTime(2);
    assert.equal(mgr.reserve(c0, 'B'), true, '2 min après libération, canton disponible');
    assert.equal(mgr.occupy(c0, 'B'), true);
  });

  it('RET-03 — retard au terminus : 1/3 chance d annuler le retour', () => {
    const prev = getGlobalRng();
    setGlobalRng(new SeededRng(0)); // random() == 0 => annulation
    try {
      const sc = new ScheduleCreator();
      global.window.game.scheduleCreator = sc;
      const world = makeWorld();
      const svc = sc.addService({
        name: 'T1',
        serviceType: 'passager',
        roundTrip: true,
        isReturnLeg: false,
        stops: [
          { stationId: 'A', type: 'arret', departureTime: 600, arrivalTime: 600 },
          { stationId: 'B', type: 'arret', departureTime: 700, arrivalTime: 700 },
        ],
        routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
      }, null, world);
      svc.delay = 15;
      svc.currentStopIndex = 2;
      svc.state = 'moving';
      svc.completeService({ processServiceRevenue() {} }, world.getStationById('B'), 0.1, 0);
      assert.equal(svc.state, 'cancelled', 'le retour est annulé');
      assert.equal(svc.cancelled, true);
      assert.equal(svc.delay, 0, 'le retard est effacé si annulé');
    } finally {
      setGlobalRng(prev);
    }
  });

  it('REG-01/02/04 — zones régulateurs et postes AC couvrent par axe', () => {
    const staff = new StaffManager();
    const econ = { balance: 100000, addExpense() {} };
    const zone = staff.addZone('Zone Paris', 48.85, 2.35, 150, 'l1');
    const regs = staff.hire(econ, 'Régulateur', 'regulateur', { count: 3 });
    for (const r of regs) r.assignedTo = zone.id;

    const sb = staff.addSignalBox({ name: 'Poste B', lat: 48.85, lon: 2.35, radiusKm: 10, lineId: 'l1' });
    const agents = staff.hire(econ, 'Agent circulation', 'agent_circulation', { count: 1 });
    agents[0].assignedTo = sb.id;

    const eff = staff.getRegulationEffects(48.85, 2.35, [], ['l1']);
    assert.equal(eff.regulator.name, 'Zone Paris', 'zone régulateur couverte');
    assert.equal(eff.signalBox.name, 'Poste B', 'signal box couverte');

    const staff2 = new StaffManager();
    staff2.addZone('Zone vide', 48.85, 2.35, 150, 'l1');
    const eff2 = staff2.getRegulationEffects(48.85, 2.35, [], ['l1']);
    assert.equal(eff2.regulator, null, 'pas assez de régulateurs = pas de couverture');
  });

  it('INC-03bis — incident stop sur la ligne annule le service après un blocage prolongé', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const world = makeWorld();
    const svc = sc.addService({
      name: 'TGV 600',
      rameId: 'r1',
      serviceType: 'passager',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 0, arrivalTime: 0 },
        { stationId: 'B', type: 'arret', departureTime: 60, arrivalTime: 60 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
    }, null, world);

    svc.state = 'moving';
    svc.currentStopIndex = 1;
    svc.position = { lat: 0.05, lon: 0 };
    svc._initializeState(svc.getCurrentRoute(), '1-0');
    svc.train.incident = { effect: 'stop', name: 'Avalanche' };

    // MoveUpdate is called 6 times per minute; simulate 200 minutes of blocked movement.
    for (let m = 1; m <= 200; m++) {
      for (let s = 0; s < 6; s++) svc.moveUpdate(10, m, []);
    }

    assert.equal(svc.state, 'cancelled', 'le service est annulé après blocage prolongé');
    assert.equal(svc.cancelled, true);
    assert.equal(svc.completed, true);
    assert.equal(svc.position, null, 'le train disparaît du réseau une fois annulé');
  });

  it('MNT-03 — panne bénigne limite la vitesse sans bloquer le train', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const world = makeWorld();
    const svc = sc.addService({
      name: 'TGV 600',
      rameId: 'r1',
      serviceType: 'passager',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 0, arrivalTime: 0 },
        { stationId: 'B', type: 'arret', departureTime: 60, arrivalTime: 60 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
    }, null, world);

    svc.state = 'moving';
    svc.currentStopIndex = 1;
    svc.position = { lat: 0.05, lon: 0 };
    svc._initializeState(svc.getCurrentRoute(), '1-0');
    svc.train.breakdown = { type: 'climatisation', time: 0 };

    let maxSpeed = 0;
    for (let m = 1; m <= 60; m++) {
      for (let s = 0; s < 6; s++) svc.moveUpdate(10, m, []);
      if (svc.speed > maxSpeed) maxSpeed = svc.speed;
    }

    assert.equal(svc.state, 'completed', 'le train termine malgré la panne bénigne');
    assert.ok(maxSpeed <= 80 + 1e-6, 'la vitesse est plafonnée à 80 km/h');
    assert.ok(maxSpeed > 0, 'le train avance malgré la panne');
  });

  it('MNT-04 — panne moteur arrête le service et l annule après blocage prolongé', () => {
    const sc = new ScheduleCreator();
    global.window.game.scheduleCreator = sc;
    const world = makeWorld();
    const svc = sc.addService({
      name: 'TGV 600',
      rameId: 'r1',
      serviceType: 'passager',
      stops: [
        { stationId: 'A', type: 'arret', departureTime: 0, arrivalTime: 0 },
        { stationId: 'B', type: 'arret', departureTime: 60, arrivalTime: 60 },
      ],
      routes: [[{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }]],
    }, null, world);

    svc.state = 'moving';
    svc.currentStopIndex = 1;
    svc.position = { lat: 0.05, lon: 0 };
    svc._initializeState(svc.getCurrentRoute(), '1-0');
    svc.train.breakdown = { type: 'moteur', time: 0 };

    for (let m = 1; m <= 200; m++) {
      for (let s = 0; s < 6; s++) svc.moveUpdate(10, m, []);
    }

    assert.equal(svc.state, 'cancelled', 'le service est annulé après panne prolongée sans secours');
    assert.equal(svc.cancelled, true);
  });
});
