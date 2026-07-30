window.__dedensenSetup = async function (config) {
  const g = window.game;
  if (!g) throw new Error('window.game non disponible');

  const TOTAL = config.total || 80;
  const PILOT = TOTAL <= 8;

  const hLat = 52.376761, hLon = 9.741021;
  const dLat = 52.40722, dLon = 9.52083;
  const wLat = 52.422225, wLon = 9.450976;

  // La boucle de rendu native est désactivée ; le driver CDP va piloter
  // engine.update() depuis Node pour éviter le throttling des timers du
  // navigateur et maintenir une cadence fixe.
  window.requestAnimationFrame = () => {};

  g.startGame(null);
  await new Promise(r => setTimeout(r, 800));

  // Centrer la carte sur le corridor pour que tous les trains soient en high-LOD
  if (g.renderer && g.renderer.tileMap) {
    g.renderer.tileMap.centerLat = hLat;
    g.renderer.tileMap.centerLon = hLon;
    g.renderer.tileMap.zoomLevel = 11;
    g.renderer.tileMap.markDirty();
  }

  // Désactiver le rendu graphique et les mises à jour UI pendant le test
  // pour libérer du CPU et maintenir la simulation en temps réel.
  if (g.renderer && g.renderer.render) g.renderer.render = () => {};
  if (g.ui) {
    g.ui.update = () => {};
    g.ui.refreshAll = () => {};
  }

  const stationH = g.world.addStation({
    name: 'Hannover Hbf',
    lat: hLat, lon: hLon,
    platforms: 12,
    platformNames: ['1','2','3','4','5','6','7','8','9','10','11','12'],
    type: 'voyageur'
  });
  const stationD = g.world.addStation({
    name: 'Dedensen Gümmer',
    lat: dLat, lon: dLon,
    platforms: 4,
    platformNames: ['1','2','3','4'],
    type: 'voyageur'
  });
  const stationW = g.world.addStation({
    name: 'Wunstorf',
    lat: wLat, lon: wLon,
    platforms: 5,
    platformNames: ['1','2','3','4','5'],
    type: 'voyageur'
  });

  g.depotManager.add({
    name: 'Hannover-Lehrte Depot',
    stationId: stationH.id,
    type: 'depot',
    cost: 0,
    infrastructure: ['technicentre', 'rotonde'],
    spareParts: { moteur: 5, climatisation: 5, fanaux: 5, freins: 5, portes: 5 },
    rescueLocos: [
      { stockId: 'rescue-diesel-1', stockName: 'Vossloh G6', traction: 'diesel', deployed: false },
      { stockId: 'rescue-elec-1', stockName: 'BR 193', traction: 'electrique', deployed: false }
    ]
  }, g.economy);

  await g.orm._ensureGraph();

  const bremenWp = { lat: 52.4068396, lon: 9.5216823 };
  let hasteRouteAuto = await g.orm.findRoute(hLat, hLon, wLat, wLon);
  if (!hasteRouteAuto || hasteRouteAuto.length < 2) throw new Error('Route Haste non trouvée');
  let bremenRouteAuto = await g.orm.findConstrainedRoute(hLat, hLon, wLat, wLon, [bremenWp]);
  if (!bremenRouteAuto || bremenRouteAuto.length < 2) throw new Error('Route Bremen non trouvée');

  function nearestIndex(route, lat, lon) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = Math.hypot(route[i].lat - lat, route[i].lon - lon);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  const dedHasteIdx = nearestIndex(hasteRouteAuto, dLat, dLon);
  const dedBremenIdx = nearestIndex(bremenRouteAuto, dLat, dLon);

  function decimate(pts, step, mustInclude) {
    const set = new Set([0, pts.length - 1, ...mustInclude]);
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      if (set.has(i) || i % step === 0) out.push(pts[i]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  const hasteManual = decimate(hasteRouteAuto, 4, [dedHasteIdx]);
  const bremenManual = decimate(bremenRouteAuto, 4, [dedBremenIdx]);
  const dedHasteManualIdx = nearestIndex(hasteManual, dLat, dLon);
  const dedBremenManualIdx = nearestIndex(bremenManual, dLat, dLon);

  const dateStr = g.engine.getParisDate();
  const works = [
    { name: 'Ralentissement Haste Dedensen', manualRoute: hasteRouteAuto.slice(Math.max(0, dedHasteIdx - 10), dedHasteIdx + 10), impact: 'slow', speedLimit: 60, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' },
    { name: 'Ralentissement Haste Wunstorf', manualRoute: hasteRouteAuto.slice(-30), impact: 'slow', speedLimit: 80, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' },
    { name: 'Ralentissement Bremen Dedensen', manualRoute: bremenRouteAuto.slice(Math.max(0, dedBremenIdx - 10), dedBremenIdx + 10), impact: 'slow', speedLimit: 60, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' }
  ];
  for (const w of works) g.worksManager.add(w);

  function makePassengerRame(i) {
    const ed = [{ category: 'locomotive', maxSpeed: 160, power: 6000, mass: 80, traction: 'electrique', length: 20, tonnage: 80 }];
    for (let c = 0; c < 6; c++) ed.push({ category: 'voiture', maxSpeed: 160, power: 0, mass: 45, traction: 'none', length: 25, tonnage: 45, passengerCapacity: 90 });
    return g.rameManager.add({ name: `Rame-P-${i}`, elementDetails: ed, currentLocation: { stationId: stationH.id, depotId: '', serviceId: '', lat: hLat, lon: hLon } });
  }

  function makeFreightRame(i) {
    const ed = [{ category: 'locomotive', maxSpeed: 120, power: 4000, mass: 90, traction: 'electrique', length: 20, tonnage: 90 }];
    for (let c = 0; c < 10; c++) ed.push({ category: 'wagon', maxSpeed: 120, power: 0, mass: 30, traction: 'none', length: 15, tonnage: 30, freightCapacity: 30 });
    return g.rameManager.add({ name: `Rame-F-${i}`, elementDetails: ed, currentLocation: { stationId: stationH.id, depotId: '', serviceId: '', lat: hLat, lon: hLon } });
  }

  function routeDistanceKm(route) { return g.orm.getRouteDistance(route); }

  const toastLog = [];
  const consoleLog = [];
  const origErr = console.error, origWarn = console.warn;
  console.error = (...args) => { consoleLog.push({ time: Date.now(), type: 'error', text: args.map(a => String(a)).join(' ') }); origErr.apply(console, args); };
  console.warn = (...args) => { consoleLog.push({ time: Date.now(), type: 'warn', text: args.map(a => String(a)).join(' ') }); origWarn.apply(console, args); };

  const toastObs = new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === 'toast-container') {
          const childObs = new MutationObserver(childMuts => {
            for (const cm of childMuts) {
              for (const n of cm.addedNodes) {
                if (n.nodeType === 1) toastLog.push({ time: Date.now(), text: n.textContent || '' });
              }
            }
          });
          childObs.observe(node, { childList: true });
        } else if (node.matches && node.matches('#toast-container *')) {
          toastLog.push({ time: Date.now(), text: node.textContent || '' });
        }
      }
    }
  });
  toastObs.observe(document.body, { childList: true, subtree: true });

  function newRame(type, i) {
    if (type === 'passager') return makePassengerRame(i);
    return makeFreightRame(i);
  }

  const pt = g.engine.getParisTime();
  const startMinute = pt.hours * 60 + pt.minutes + 3;
  const svcMeta = [];

  const hasteAutoHdRoute = hasteRouteAuto.slice(0, dedHasteIdx + 1);
  const hasteAutoDwRoute = hasteRouteAuto.slice(dedHasteIdx);
  const hasteManHdRoute = hasteManual.slice(0, dedHasteManualIdx + 1);
  const hasteManDwRoute = hasteManual.slice(dedHasteManualIdx);
  const dists = {
    hasteAutoHd: g.orm.getRouteDistance(hasteAutoHdRoute),
    hasteAutoDw: g.orm.getRouteDistance(hasteAutoDwRoute),
    hasteManHd: g.orm.getRouteDistance(hasteManHdRoute),
    hasteManDw: g.orm.getRouteDistance(hasteManDwRoute),
    bremenAuto: g.orm.getRouteDistance(bremenRouteAuto),
    bremenMan: g.orm.getRouteDistance(bremenManual)
  };

  // Objectif 0 avance : on programme légèrement large pour ne jamais arriver en avance.
  // Vitesse moyenne retenue : Haste HD 65 km/h, DW 75 km/h ; fret Bremen 50 km/h.
  function makeStops(type, dep, isHaste, isManual) {
    if (type === 'passager') {
      const hdDist = isManual ? dists.hasteManHd : dists.hasteAutoHd;
      const dwDist = isManual ? dists.hasteManDw : dists.hasteAutoDw;
      const hdMin = Math.ceil(hdDist / 120 * 60) + 1; // +1 min de marge à l'arrivée
      const arrD = dep + hdMin;
      const depD = arrD + 2; // arrêt commercial Dedensen
      const dwMin = Math.ceil(dwDist / 140 * 60) + 1;
      const arrW = depD + dwMin;
      return [
        { stationId: stationH.id, type: 'arret', arrivalTime: dep, departureTime: dep, platform: '1' },
        { stationId: stationD.id, type: 'arret', arrivalTime: arrD, departureTime: depD, platform: '1' },
        { stationId: stationW.id, type: 'arret', arrivalTime: arrW, departureTime: arrW, platform: '1' }
      ];
    } else {
      const totalDist = isManual ? dists.bremenMan : dists.bremenAuto;
      const totalMin = Math.ceil(totalDist / 90 * 60) + 2; // marge terminus
      const arrW = dep + totalMin;
      const arrD = dep + Math.floor(totalMin * 0.55);
      return [
        { stationId: stationH.id, type: 'arret', arrivalTime: dep, departureTime: dep, platform: '3' },
        { stationId: stationD.id, type: 'passage', arrivalTime: arrD, departureTime: arrD, platform: '3' },
        { stationId: stationW.id, type: 'arret', arrivalTime: arrW, departureTime: arrW, platform: '3' }
      ];
    }
  }

  for (let i = 0; i < TOTAL; i++) {
    const isPassenger = (i % 2 === 0);
    const isHaste = isPassenger;
    const isManual = (i % 4 >= 2);
    const type = isPassenger ? 'passager' : 'fret';
    const direction = isHaste ? 'Haste' : 'Bremen';
    const dep = startMinute + i;
    const rame = newRame(type, i);
    const route = isHaste ? (isManual ? hasteManual : hasteRouteAuto) : (isManual ? bremenManual : bremenRouteAuto);
    const dedIdx = isHaste ? (isManual ? dedHasteManualIdx : dedHasteIdx) : (isManual ? dedBremenManualIdx : dedBremenIdx);
    const stops = makeStops(type, dep, isHaste, isManual);
    const data = {
      name: `H-W ${String(i + 1).padStart(2, '0')} ${type === 'passager' ? 'PAX' : 'FRET'} ${direction} ${isManual ? 'MAN' : 'AUTO'}`,
      serviceType: type,
      rameId: rame.id,
      active: true,
      stops: stops,
      routes: [route.slice(0, dedIdx + 1), route.slice(dedIdx)]

    };
    const svc = g.scheduleCreator.addService(data, rame, g.world);
    svc._dedensen = { index: i, isManual, direction, type, scheduledDep: dep, scheduledArr: stops[stops.length - 1].arrivalTime, rameName: rame.name, routeLengthKm: g.orm.getRouteDistance(route) };
    svcMeta.push({ id: svc.id, name: svc.name, index: i, isManual, direction, type, dep, arr: stops[stops.length - 1].arrivalTime, rameName: rame.name });
  }

  let forcedDDS = false;
  let forcedDoor = false;
  let ddsRecord = null;
  let doorRecord = null;

  function maybeForce(timeOfDay) {
    const svcs = g.scheduleCreator.services;
    if (!forcedDDS && timeOfDay >= startMinute + 8) {
      const movingFreight = svcs.find(s => s._dedensen && s._dedensen.type === 'fret' && s.state === 'moving');
      if (movingFreight) {
        movingFreight.train.breakdown = { type: 'moteur', time: timeOfDay };
        forcedDDS = true;
        ddsRecord = { serviceId: movingFreight.id, name: movingFreight.name, time: timeOfDay, type: 'moteur' };
      }
    }
    if (!forcedDoor && timeOfDay >= startMinute + 12) {
      const movingPass = svcs.find(s => s._dedensen && s._dedensen.type === 'passager' && s.state === 'moving');
      if (movingPass) {
        movingPass.train.breakdown = { type: 'portes', time: timeOfDay };
        forcedDoor = true;
        doorRecord = { serviceId: movingPass.id, name: movingPass.name, time: timeOfDay, type: 'portes' };
      }
    }
  }

  const allServiceIds = svcMeta.map(s => s.id);

  function getState() {
    const pt = g.engine.getParisTime();
    const nowMin = pt.hours * 60 + pt.minutes;
    maybeForce(nowMin);

    const services = g.scheduleCreator.services.map(s => ({
      id: s.id,
      name: s.name,
      state: s.state,
      currentStopIndex: s.currentStopIndex,
      speed: s.train?.speed ?? 0,
      delay: s.delay ?? 0,
      delayReason: s.train?.delayReason || '',
      signalAlert: s.train?.signalAlert || null,
      breakdown: s.train?.breakdown ? s.train.breakdown.type : null,
      incident: s.train?.incident ? { name: s.train.incident.name, effect: s.train.incident.effect, speedLimit: s.train.incident.speedLimit } : null,
      completed: s.completed,
      cancelled: s.cancelled
    }));

    const rescues = g.depotManager.activeRescues.map(r => ({
      id: r.id,
      state: r.state,
      targetServiceId: r.targetServiceId,
      targetServiceName: r.targetServiceName,
      rescueType: r.rescueType,
      stockId: r.stockId,
      position: r.position,
      speed: r.speed
    }));

    const incidents = g.incidentManager.activeIncidents.map(inc => ({
      id: inc.id,
      name: inc.name,
      typeId: inc.typeId,
      effect: inc.effect,
      speedLimit: inc.speedLimit,
      remaining: inc.remaining,
      serviceId: inc.serviceId,
      trainId: inc.trainId,
      stationA: inc.stationA,
      stationB: inc.stationB
    }));

    const activeWorks = g.worksManager.getActive(dateStr, nowMin).map(w => ({
      id: w.id,
      name: w.name,
      impact: w.impact,
      speedLimit: w.speedLimit,
      stationA: w.stationA,
      stationB: w.stationB
    }));

    return {
      time: nowMin,
      date: dateStr,
      iso: new Date().toISOString(),
      totalServices: allServiceIds.length,
      completed: services.filter(s => s.completed).length,
      cancelled: services.filter(s => s.cancelled).length,
      moving: services.filter(s => s.state === 'moving').length,
      waiting: services.filter(s => s.state === 'waiting').length,
      stopped: services.filter(s => s.state === 'stopped_at_station').length,
      services: services,
      rescues: rescues,
      incidents: incidents,
      works: activeWorks,
      toastLog: toastLog.slice(-50),
      consoleLog: consoleLog.slice(-50),
      dds: ddsRecord,
      door: doorRecord
    };
  }

  function isDone() {
    const svcs = g.scheduleCreator.services;
    if (!svcs || svcs.length < TOTAL) return false;
    const finished = svcs.filter(s => s.completed || s.cancelled).length;
    return finished >= TOTAL;
  }

  function getReport() {
    const svcs = g.scheduleCreator.services;
    const pt = g.engine.getParisTime();
    const nowMin = pt.hours * 60 + pt.minutes;
    const perTrain = svcs.map(s => {
      const d = s._dedensen || {};
      const isCompleted = s.completed && !s.cancelled;
      const actualArr = isCompleted ? (s._lastArrivalTime ?? null) : null;
      const delayAtEnd = (actualArr != null) ? (actualArr - d.scheduledArr) : null;
      const earlyMinutes = (delayAtEnd != null && delayAtEnd < 0) ? (-delayAtEnd) : null;
      const currentDelay = isCompleted ? 0 : (s.delay ?? 0);
      const finalPos = s.position ? { lat: s.position.lat, lon: s.position.lon } : null;
      const currentStop = s.getCurrentStops ? s.getCurrentStops()[s.currentStopIndex] : null;
      return {
        id: s.id,
        name: s.name,
        index: d.index,
        type: d.type,
        direction: d.direction,
        routeMode: d.isManual ? 'manuel' : 'auto',
        rameName: d.rameName,
        scheduledDep: d.scheduledDep,
        scheduledArr: d.scheduledArr,
        actualArr,
        delayAtEnd,
        earlyMinutes,
        currentDelay,
        currentStopIndex: s.currentStopIndex ?? 0,
        currentStopName: currentStop?.name || (currentStop?.stationId ? g.world.getStationById(currentStop.stationId)?.name : ''),
        completed: s.completed,
        cancelled: s.cancelled,
        state: s.state,
        totalDistance: s.totalDistance ?? 0,
        maxSpeed: s.rame?.maxSpeed ?? 0,
        finalPosition: finalPos,
        delayReason: s.train?.delayReason || '',
        breakdown: s.train?.breakdown || null,
        incident: s.train?.incident || null,
        breakdownEvents: [],
        incidentEvents: []
      };
    });

    const rescues = g.depotManager.activeRescues.concat(g.depotManager.repairQueue || []).map(r => ({
      id: r.id,
      state: r.state,
      targetServiceId: r.targetServiceId,
      targetServiceName: r.targetServiceName,
      rescueType: r.rescueType,
      stockId: r.stockId
    }));

    return {
      testEnd: { timeMin: nowMin, date: dateStr, realTime: new Date().toISOString() },
      summary: {
        total: TOTAL,
        completed: svcs.filter(s => s.completed && !s.cancelled).length,
        cancelled: svcs.filter(s => s.cancelled).length,
        inProgress: svcs.filter(s => !s.completed && !s.cancelled).length,
        earlyCount: perTrain.filter(t => t.earlyMinutes != null && t.earlyMinutes > 0).length,
        maxDelayMin: Math.max(0, ...perTrain.map(t => t.delayAtEnd || 0)),
        ddsTriggered: !!ddsRecord,
        doorTriggered: !!doorRecord
      },
      perTrain: perTrain,
      ddsRecord: ddsRecord,
      doorRecord: doorRecord,
      rescues: rescues,
      incidents: g.incidentManager.activeIncidents.map(inc => ({ id: inc.id, name: inc.name, effect: inc.effect, serviceId: inc.serviceId, remaining: inc.remaining })),
      works: g.worksManager.getActive(dateStr, nowMin).map(w => ({ id: w.id, name: w.name, impact: w.impact, speedLimit: w.speedLimit })),
      toastLog: toastLog.slice(0),
      consoleLog: consoleLog.slice(0)
    };
  }

  window.__dedensenTest = {
    config: { total: TOTAL, pilot: PILOT, startMinute },
    svcMeta,
    getState,
    isDone,
    getReport
  };

  return { total: TOTAL, startMinute, stationHId: stationH.id, stationWId: stationW.id, routes: { haste: hasteRouteAuto.length, bremen: bremenRouteAuto.length } };
};
