const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const TOTAL = Number(process.env.TOTAL) || 80;
const PILOT = TOTAL <= 8;
const RESUME = process.env.RESUME === '1';
const POLL_MS = 60000;
const ENGINE_MS = 200;
const OUT_DIR = '/home/ubuntu/dedensen-test';
fs.mkdirSync(OUT_DIR, { recursive: true });
const STATE_FILE = path.join(OUT_DIR, 'state.jsonl');
const REPORT_FILE = path.join(OUT_DIR, 'report.json');
const LOG_FILE = path.join(OUT_DIR, 'driver.log');
const HTML_FILE = path.join(OUT_DIR, 'report.html');
const PDF_FILE = path.join(OUT_DIR, 'report.pdf');

function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr, opts = {}) {
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: false, ...opts });
  if (res.exceptionDetails) {
    const text = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
    throw new Error(`Runtime.evaluate exception: ${text}`);
  }
  return res.result.value;
}

async function waitForGame(Runtime, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ready = await evaluate(Runtime, '!!window.game && !!window.game.orm');
    if (ready) return true;
    await sleep(1000);
  }
  throw new Error('window.game not ready');
}

CDP({ host: 'localhost', port: 29229 }, async (client) => {
  const { Page, Runtime, Log } = client;
  try {
    await Page.enable();
    await Runtime.enable();
    await Log.enable();

    Log.entryAdded((entry) => {
      if (entry.entry.level === 'error' || entry.entry.level === 'warning') {
        log('[browser]', entry.entry.level, entry.entry.text);
      }
    });

    if (!RESUME) {
      log('Navigating to local build with cache-bust...');
      await Page.navigate({ url: 'http://localhost:8080/?v=1784731011' });
      await Page.loadEventFired();
      await Page.bringToFront();
      await sleep(2000);

      log('Waiting for game...');
      await waitForGame(Runtime, 60000);

      const injectPath = path.join(__dirname, 'dedensen-inject.js');
      const injectCode = fs.readFileSync(injectPath, 'utf8');
      const setupExpr = `${injectCode}\n; (async () => { return await window.__dedensenSetup({total: ${TOTAL}}); })();`;
      log('Injecting scenario script...');
      const setupRes = await Runtime.evaluate({ expression: setupExpr, awaitPromise: true, returnByValue: true, timeout: 120000 });
      if (setupRes.exceptionDetails) {
        const text = setupRes.exceptionDetails.exception?.description || setupRes.exceptionDetails.text;
        throw new Error(`Setup failed: ${text}`);
      }
      log('Setup OK', JSON.stringify(setupRes.result.value));
    } else {
      log('Resume mode: attaching to existing page');
      await waitForGame(Runtime, 60000);
    }

    const startTime = Date.now();
    const maxTestMs = PILOT ? 60 * 60 * 1000 : (TOTAL * 240 + 600) * 1000;

    // Boucle de simulation pilotée par Node : appelle engine.update() toutes
    // les 100 ms pour éviter le throttling des timers du navigateur.
    let engineLoopDone = false;
    async function engineLoop() {
      while (!engineLoopDone) {
        const loopStart = Date.now();
        try {
          await evaluate(Runtime, 'window.game.engine.update()');
        } catch (e) {
          // ignorer les erreurs de page fermée en fin de test
        }
        const elapsed = Date.now() - loopStart;
        const wait = Math.max(0, ENGINE_MS - elapsed);
        await sleep(wait);
      }
    }
    engineLoop().catch(e => log('engineLoop error', e.message));

    if (!RESUME) fs.writeFileSync(STATE_FILE, '');

    let lastState = null;
    while (true) {
      await sleep(POLL_MS);
      const elapsedMs = Date.now() - startTime;

      const stateJson = await evaluate(Runtime, 'JSON.stringify(window.__dedensenTest.getState())');
      const state = JSON.parse(stateJson);
      lastState = state;
      fs.appendFileSync(STATE_FILE, JSON.stringify(state) + '\n');

      const done = await evaluate(Runtime, 'window.__dedensenTest.isDone()');

      const elapsedMin = Math.floor(elapsedMs / 60000);
      log(`t=${elapsedMin}m done=${done} completed=${state.completed}/${state.totalServices} moving=${state.moving} stopped=${state.stopped} cancelled=${state.cancelled} rescues=${state.rescues.length} incidents=${state.incidents.length} works=${state.works.length}`);

      if (done || elapsedMs > maxTestMs) {
        log('Test ending. Reason:', done ? 'all finished' : 'timeout');
        engineLoopDone = true;
        const reportJson = await evaluate(Runtime, 'JSON.stringify(window.__dedensenTest.getReport())');
        const report = JSON.parse(reportJson);
        fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
        log('Report saved', REPORT_FILE);
        generateHtml(report);
        await printPdf(client, HTML_FILE, PDF_FILE);
        break;
      }
    }
  } catch (e) {
    log('FATAL', e.message, e.stack);
    engineLoopDone = true;
    try {
      const reportJson = await evaluate(Runtime, 'JSON.stringify(window.__dedensenTest.getReport())');
      fs.writeFileSync(REPORT_FILE, reportJson);
      const report = JSON.parse(reportJson);
      generateHtml(report);
      await printPdf(client, HTML_FILE, PDF_FILE);
    } catch (_) {}
  } finally {
    engineLoopDone = true;
    client.close();
  }
}).on('error', (err) => {
  log('CDP connection error', err);
  process.exit(1);
});

function readSnapshots() {
  if (!fs.existsSync(STATE_FILE)) return [];
  const lines = fs.readFileSync(STATE_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtml(report) {
  const snapshots = readSnapshots();

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
      <td>${t.totalDistance.toFixed(2)}</td>
      <td>${esc(breakdown)}</td>
      <td>${esc(incident)}</td>
      <td>${esc(t.delayReason)}</td>
    </tr>`;
  }).join('');

  // Section 2: incidents observed over time
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

  // Section 3: canton / signalisation observations
  const signalReasons = new Map();
  const trainSignalEvents = [];
  let lastSnapById = new Map();
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

  // DDS timeline from snapshots
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

  const html = `<!DOCTYPE html>
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
  fs.writeFileSync(HTML_FILE, html);
}

async function printPdf(client, htmlFile, pdfFile) {
  const { Page } = client;
  await Page.navigate({ url: 'file://' + htmlFile });
  await Page.loadEventFired();
  await new Promise(r => setTimeout(r, 1000));
  const pdfBase64 = await Page.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
  });
  fs.writeFileSync(pdfFile, Buffer.from(pdfBase64.data, 'base64'));
  log('PDF saved', pdfFile);
}
