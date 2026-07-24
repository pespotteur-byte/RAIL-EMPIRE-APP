import { haversineDistance } from './simulation.js?v=1784931680';
import { adminSync } from './admin-sync.js?v=1784931680';

const STORAGE_KEY = '__dedensenBenchmark';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generateHtml(report, snapshots) {
  const perTrainRows = (report.perTrain || []).map(t => {
    let status = t.earlyMinutes != null ? `AVANCE ${t.earlyMinutes} min` : (t.completed ? 'OK' : (t.cancelled ? 'ANNULÉ' : 'EN COURS'));
    let rowClass = '';
    if (t.earlyMinutes != null) rowClass = 'early';
    else if (t.cancelled) rowClass = 'cancelled';
    else if (t.completed) rowClass = 'ok';
    const breakdown = t.breakdown ? (t.breakdown.type || t.breakdown) : '';
    const incident = t.incident ? (t.incident.name || t.incident) : '';
    return `<tr class="${rowClass}">
      <td>${t.index ?? ''}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(t.type)}</td>
      <td>${esc(t.direction)}</td>
      <td>${esc(t.routeMode)}</td>
      <td>${t.scheduledDep ?? ''}</td>
      <td>${t.scheduledArr ?? ''}</td>
      <td>${t.actualArr ?? ''}</td>
      <td>${t.delayAtEnd ?? ''}</td>
      <td>${t.earlyMinutes != null ? t.earlyMinutes + ' min' : ''}</td>
      <td>${t.currentDelay ?? ''}</td>
      <td>${esc(status)}</td>
      <td>${esc(t.currentStopName || '')} (${t.currentStopIndex ?? ''})</td>
      <td>${(t.totalDistance || 0).toFixed(2)}</td>
      <td>${esc(breakdown)}</td>
      <td>${esc(incident)}</td>
      <td>${esc(t.delayReason)}</td>
    </tr>`;
  }).join('');

  const incidentMap = new Map();
  for (const snap of snapshots) {
    for (const inc of (snap.incidents || [])) {
      const id = inc.id || inc.name;
      if (!incidentMap.has(id)) {
        incidentMap.set(id, { ...inc, firstSeen: snap.time, lastSeen: snap.time, count: 0 });
      }
      const e = incidentMap.get(id);
      e.lastSeen = snap.time;
      e.count++;
    }
  }
  const incidentList = Array.from(incidentMap.values()).sort((a, b) => (b.count || 0) - (a.count || 0));

  const signalReasons = new Map();
  const trainSignalEvents = [];
  const lastSnapById = new Map();
  for (const snap of snapshots) {
    for (const s of (snap.services || [])) {
      const key = s.id;
      const prev = lastSnapById.get(key);
      const reason = s.delayReason || s.signalAlert;
      if (reason && reason !== 'Panne portes' && reason !== 'en panne' && reason !== 'Régulation du trafic') {
        const rKey = `${s.name} | ${reason}`;
        if (!signalReasons.has(rKey)) signalReasons.set(rKey, { name: s.name, reason, first: snap.time, last: snap.time, count: 0 });
        const e = signalReasons.get(rKey);
        e.last = snap.time; e.count++;
      }
      if (prev && s.signalAlert && s.signalAlert !== prev.signalAlert && s.signalAlert !== '') {
        trainSignalEvents.push({ time: snap.time, name: s.name, alert: s.signalAlert, speed: s.speed, delay: s.delay });
      }
      lastSnapById.set(key, s);
    }
  }

  const dds = report.ddsRecord || {};
  const door = report.doorRecord || {};

  const ddsTimeline = [];
  if (dds.serviceId) {
    for (const snap of snapshots) {
      const s = (snap.services || []).find(x => x.id === dds.serviceId);
      const r = (snap.rescues || []).find(x => x.targetServiceId === dds.serviceId);
      if (s || r) {
        ddsTimeline.push({ time: snap.time, state: s?.state, speed: s?.speed, delay: s?.delay, rescueState: r?.state, rescuePos: r?.position });
      }
    }
  }

  const doorTimeline = [];
  if (door.serviceId) {
    for (const snap of snapshots) {
      const s = (snap.services || []).find(x => x.id === door.serviceId);
      if (s) doorTimeline.push({ time: snap.time, state: s.state, speed: s.speed, delay: s.delay, breakdown: s.breakdown });
    }
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport Dedensen ${new Date().toISOString()}</title>
<style>
body { font-family: Arial, sans-serif; margin: 30px; font-size: 10px; }
h1, h2, h3 { color: #1e3a8a; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 3px; text-align: left; }
th { background: #e2e8f0; }
.early { background: #fecaca; font-weight: bold; }
.ok { background: #dcfce7; }
.cancelled { background: #fef9c3; }
.section { margin-top: 24px; }
pre { background: #f1f5f9; padding: 8px; overflow-x: auto; font-size: 9px; }
.sub { color: #475569; font-size: 9px; }
</style>
</head>
<body>
  <h1>Rapport scientifique - Corridor Hannover Hbf ↔ Wunstorf via Dedensen-Gümmer</h1>
  <p><strong>Date :</strong> ${new Date().toISOString()}<br>
  <strong>Trains total :</strong> ${report.summary.total} — Complétés : ${report.summary.completed} — Annulés : ${report.summary.cancelled} — En cours : ${report.summary.inProgress}<br>
  <strong>Objectif 0 avance :</strong> ${report.summary.earlyCount} train(s) en avance — Retard max final : ${report.summary.maxDelayMin} min</p>

  <div class="section">
    <h2>1. Données train par train</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Nom</th><th>Type</th><th>Direction</th><th>Tracé</th><th>Dép. th.</th><th>Arr. th.</th><th>Arr. réelle</th><th>Retard</th><th>Avance</th><th>Retard courant</th><th>Statut</th><th>Stop courant</th><th>Dist. km</th><th>Panne</th><th>Incident</th><th>Motif / alerte</th></tr>
      </thead>
      <tbody>
        ${perTrainRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>2. Incidents en cours de partie</h2>
    <p class="sub">Incidents actifs à la fin du test + incidents observés dans les snapshots (première/dernière minute vue, nombre de snapshots).</p>
    <table>
      <thead><tr><th>ID/Nom</th><th>Effet</th><th>Limite km/h</th><th>Premier vu</th><th>Dernier vu</th><th>Occurrences</th></tr></thead>
      <tbody>
        ${incidentList.map(i => `<tr><td>${esc(i.name || i.id)}</td><td>${esc(i.effect)}</td><td>${i.speedLimit ?? ''}</td><td>${i.firstSeen ?? ''}</td><td>${i.lastSeen ?? ''}</td><td>${i.count}</td></tr>`).join('')}
      </tbody>
    </table>
    <pre>${JSON.stringify(report.incidents || [], null, 2)}</pre>
  </div>

  <div class="section">
    <h2>3. Cantonnement / signalisation</h2>
    <p class="sub">Alertes et motifs de retard liés à la signalisation / occupation des voies observés dans les snapshots (uniquement les motifs explicites, hors pannes et régulation générique).</p>
    <table>
      <thead><tr><th>Train</th><th>Motif / alerte</th><th>Premier</th><th>Dernier</th><th>Occurrences</th></tr></thead>
      <tbody>
        ${Array.from(signalReasons.values()).sort((a,b)=>b.count-a.count).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.reason)}</td><td>${r.first}</td><td>${r.last}</td><td>${r.count}</td></tr>`).join('')}
      </tbody>
    </table>
    <h3>Transitions d'alertes signal (changement de message)</h3>
    <pre>${JSON.stringify(trainSignalEvents.slice(0, 200), null, 2)}</pre>
  </div>

  <div class="section">
    <h2>4. Rapport DDS</h2>
    <p><strong>DDS forcée (moteur) :</strong> ${dds.serviceId ? 'OUI' : 'NON'}</p>
    <pre>${JSON.stringify(dds || {}, null, 2)}</pre>
    <p><strong>Panne de porte forcée :</strong> ${door.serviceId ? 'OUI' : 'NON'}</p>
    <pre>${JSON.stringify(door || {}, null, 2)}</pre>
    <h3>Timeline DDS (train en panne moteur + secours)</h3>
    <pre>${JSON.stringify(ddsTimeline, null, 2)}</pre>
    <h3>Timeline panne de porte</h3>
    <pre>${JSON.stringify(doorTimeline, null, 2)}</pre>
    <h3>Secours / réparations à la fin</h3>
    <pre>${JSON.stringify(report.rescues || [], null, 2)}</pre>
  </div>

  <div class="section">
    <h2>5. Autres observations</h2>
    <h3>Travaux / ralentissements actifs à la fin</h3>
    <pre>${JSON.stringify(report.works || [], null, 2)}</pre>
    <h3>Messages UI (toasts)</h3>
    <pre>${JSON.stringify(report.toastLog || [], null, 2)}</pre>
    <h3>Erreurs / warnings console</h3>
    <pre>${JSON.stringify(report.consoleLog || [], null, 2)}</pre>
  </div>
</body>
</html>`;
}

export async function startDedensenBenchmark(g, config = {}) {
  if (!g) throw new Error('Aucune instance de jeu fournie à startDedensenBenchmark');

  // Désactiver les incidents aléatoires du jeu pour ne garder que
  // les événements forcés par le scénario (DDS, panne de portes, travaux).
  if (g.incidentManager) {
    g.incidentManager.setEnabledTypes([]);
    g.incidentManager.activeIncidents = [];
  }
  adminSync.setOptIn(false);
  adminSync.stopIncidentLoop();

  const TOTAL = config.total || 80;
  const noIncidents = config.noIncidents || false;
  const PILOT = TOTAL <= 8;

  const hLat = 52.376761, hLon = 9.741021;
  const dLat = 52.40722, dLon = 9.52083;
  const wLat = 52.422225, wLon = 9.450976;

  // Disable rendering/UI to free CPU while keeping the game loop alive
  if (g.renderer && g.renderer.render) g.renderer.render = () => {};
  if (g.ui) {
    g.ui.update = () => {};
    g.ui.refreshAll = () => {};
  }

  // Stop tile loading and weather API calls in benchmark mode to avoid 429/ERR_INSUFFICIENT_RESOURCES
  if (g.renderer && g.renderer.tileMap) {
    g.renderer.tileMap._processQueue = () => {};
    g.renderer.tileMap._baseQueue = [];
    g.renderer.tileMap._railQueue = [];
    g.renderer.tileMap.centerLat = hLat;
    g.renderer.tileMap.centerLon = hLon;
    g.renderer.tileMap.zoomLevel = 11;
    g.renderer.tileMap.markDirty();
  }
  if (g.weather) {
    g.weather.update = () => {};
    g.weather._queuePointFetch = () => {};
    g.weather._processPointFetchQueue = () => {};
    g.weather.getSpeedEffectsAt = () => ({ speedCap: Infinity, brakeFactor: 1, speedMult: 1, type: 'clear' });
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
  const hasteRouteAuto = await g.orm.findRoute(hLat, hLon, wLat, wLon);
  if (!hasteRouteAuto || hasteRouteAuto.length < 2) throw new Error('Route Haste non trouvée');
  const bremenRouteAuto = await g.orm.findConstrainedRoute(hLat, hLon, wLat, wLon, [bremenWp]);
  if (!bremenRouteAuto || bremenRouteAuto.length < 2) throw new Error('Route Bremen non trouvée');

  function nearestIndex(route, lat, lon) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < route.length; i++) {
      const di = Math.hypot(route[i].lat - lat, route[i].lon - lon);
      if (di < bestD) { bestD = di; best = i; }
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

  if (!noIncidents) {
    const works = [
      { name: 'Ralentissement Haste Dedensen', manualRoute: hasteRouteAuto.slice(Math.max(0, dedHasteIdx - 10), dedHasteIdx + 10), impact: 'slow', speedLimit: 60, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' },
      { name: 'Ralentissement Haste Wunstorf', manualRoute: hasteRouteAuto.slice(-30), impact: 'slow', speedLimit: 80, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' },
      { name: 'Ralentissement Bremen Dedensen', manualRoute: bremenRouteAuto.slice(Math.max(0, dedBremenIdx - 10), dedBremenIdx + 10), impact: 'slow', speedLimit: 60, startDate: dateStr, endDate: dateStr, startTime: '00:00', endTime: '23:59' }
    ];
    for (const w of works) g.worksManager.add(w);
  }

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
    return type === 'passager' ? makePassengerRame(i) : makeFreightRame(i);
  }

  const pt = g.engine.getParisTime();
  const startMinute = pt.hours * 60 + pt.minutes + 3;

  function routeDistanceKm(route) { return g.orm.getRouteDistance(route); }

  const dists = {
    hasteAutoHd: routeDistanceKm(hasteRouteAuto.slice(0, dedHasteIdx + 1)),
    hasteAutoDw: routeDistanceKm(hasteRouteAuto.slice(dedHasteIdx)),
    hasteManHd: routeDistanceKm(hasteManual.slice(0, dedHasteManualIdx + 1)),
    hasteManDw: routeDistanceKm(hasteManual.slice(dedHasteManualIdx)),
    bremenAuto: routeDistanceKm(bremenRouteAuto),
    bremenMan: routeDistanceKm(bremenManual)
  };

  function makeStops(type, dep, isHaste, isManual) {
    if (type === 'passager') {
      const hdDist = isManual ? dists.hasteManHd : dists.hasteAutoHd;
      const dwDist = isManual ? dists.hasteManDw : dists.hasteAutoDw;
      const hdMin = Math.ceil(hdDist / 120 * 60) + 1;
      const arrD = dep + hdMin;
      const depD = arrD + 2;
      const dwMin = Math.ceil(dwDist / 140 * 60) + 1;
      const arrW = depD + dwMin;
      return [
        { stationId: stationH.id, type: 'arret', arrivalTime: dep, departureTime: dep, platform: '1' },
        { stationId: stationD.id, type: 'arret', arrivalTime: arrD, departureTime: depD, platform: '1' },
        { stationId: stationW.id, type: 'arret', arrivalTime: arrW, departureTime: arrW, platform: '1' }
      ];
    } else {
      const totalDist = isManual ? dists.bremenMan : dists.bremenAuto;
      const totalMin = Math.ceil(totalDist / 90 * 60) + 2;
      const arrW = dep + totalMin;
      const arrD = dep + Math.floor(totalMin * 0.55);
      return [
        { stationId: stationH.id, type: 'arret', arrivalTime: dep, departureTime: dep, platform: '3' },
        { stationId: stationD.id, type: 'passage', arrivalTime: arrD, departureTime: arrD, platform: '3' },
        { stationId: stationW.id, type: 'arret', arrivalTime: arrW, departureTime: arrW, platform: '3' }
      ];
    }
  }

  const svcMeta = [];
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
      stops,
      routes: [route.slice(0, dedIdx + 1), route.slice(dedIdx)]
    };
    const svc = g.scheduleCreator.addService(data, rame, g.world);
    svc._dedensen = { index: i, isManual, direction, type, scheduledDep: dep, scheduledArr: stops[stops.length - 1].arrivalTime, rameName: rame.name, routeLengthKm: routeDistanceKm(route) };
    svcMeta.push({ id: svc.id, name: svc.name, index: i, isManual, direction, type, dep, arr: stops[stops.length - 1].arrivalTime, rameName: rame.name });
  }

  let forcedDDS = false;
  let forcedDoor = false;
  let ddsRecord = null;
  let doorRecord = null;

  function maybeForce(timeOfDay) {
    if (noIncidents) return;
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
  const snapshots = [];

  function getState() {
    const spt = g.engine.getParisTime();
    const nowMin = spt.hours * 60 + spt.minutes;
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
      services,
      rescues,
      incidents,
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
    const spt = g.engine.getParisTime();
    const nowMin = spt.hours * 60 + spt.minutes;
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
      perTrain,
      ddsRecord,
      doorRecord,
      rescues,
      incidents: g.incidentManager.activeIncidents.map(inc => ({ id: inc.id, name: inc.name, effect: inc.effect, serviceId: inc.serviceId, remaining: inc.remaining })),
      works: g.worksManager.getActive(dateStr, nowMin).map(w => ({ id: w.id, name: w.name, impact: w.impact, speedLimit: w.speedLimit })),
      toastLog: toastLog.slice(0),
      consoleLog: consoleLog.slice(0)
    };
  }

  function finish() {
    const report = getReport();
    const html = generateHtml(report, snapshots);
    const json = JSON.stringify(report, null, 2);
    const base = `dedensen-report-${TOTAL}-${Date.now()}`;
    downloadFile(`${base}.json`, json, 'application/json');
    downloadFile(`${base}.html`, html, 'text/html');

    const files = { jsonName: `${base}.json`, htmlName: `${base}.html`, json, html };
    api.reportFiles = files;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ done: true, timestamp: Date.now(), summary: report.summary }));
      localStorage.setItem(STORAGE_KEY + ':report', json);
      localStorage.setItem(STORAGE_KEY + ':html', html);
      localStorage.setItem(STORAGE_KEY + ':files', JSON.stringify({ jsonName: files.jsonName, htmlName: files.htmlName }));
    } catch (e) {}

    if (window.__dedensenBenchmark) window.__dedensenBenchmark.done = true;
    console.error = origErr;
    console.warn = origWarn;
    toastObs.disconnect();
  }

  function persistStatus(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        running: true,
        timestamp: Date.now(),
        summary: {
          total: state.totalServices,
          completed: state.completed,
          moving: state.moving,
          waiting: state.waiting
        }
      }));
    } catch (e) {}
  }

  // Hook engine minute tick to snapshot and finish detection
  const originalOnTick = g.engine.onTick;
  let finished = false;
  g.engine.onTick = (timeOfDay, dateString, pt) => {
    if (originalOnTick) originalOnTick(timeOfDay, dateString, pt);
    if (finished) return;
    const state = getState();
    snapshots.push(state);
    persistStatus(state);
    if (isDone()) {
      finished = true;
      finish();
    }
  };

  const api = {
    config: { total: TOTAL, pilot: PILOT, startMinute },
    svcMeta,
    snapshots,
    getState,
    isDone,
    getReport,
    generateHtml: (r, snaps) => generateHtml(r, snaps || snapshots),
    reportFiles: null,
    startTime: Date.now(),
    done: false
  };

  window.__dedensenBenchmark = api;
  // Keep legacy name for any external script still expecting it
  window.__dedensenTest = api;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ running: true, timestamp: Date.now(), total: TOTAL }));
  } catch (e) {}

  return api;
}

export function restoreDedensenReport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + ':report');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

window.__startDedensenBenchmark = (config = {}) => {
  if (!window.game) throw new Error('window.game non disponible');
  return startDedensenBenchmark(window.game, config);
};
