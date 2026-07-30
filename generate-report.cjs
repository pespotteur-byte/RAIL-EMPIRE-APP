const fs = require('fs');
const CDP = require('chrome-remote-interface');
const path = require('path');

const OUT_DIR = '/home/ubuntu/dedensen-test';
const REPORT_JSON = path.join(OUT_DIR, 'report-internal.json');
const SNAPSHOTS_JSON = path.join(OUT_DIR, 'snapshots-internal.json');
const HTML_OUT = path.join(OUT_DIR, 'report-internal.html');
const PDF_OUT = path.join(OUT_DIR, 'report-internal.pdf');

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function printPdf(html, outputPath) {
  const client = await new Promise((resolve, reject) => {
    CDP({ host: 'localhost', port: 29229 }, c => resolve(c)).on('error', reject);
  });
  const { Page } = client;
  await Page.enable();
  const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  await Page.navigate({ url });
  await Page.loadEventFired();
  await sleep(2000);
  const { data } = await Page.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px; margin-left:1cm; width:100%;"><span class="url"></span> — <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));
  client.close();
}

async function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  const snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_JSON, 'utf8'));
  const html = generateHtml(report, snapshots);
  fs.writeFileSync(HTML_OUT, html);
  console.log('HTML written:', HTML_OUT, (fs.statSync(HTML_OUT).size / 1024).toFixed(1) + ' KB');
  await printPdf(html, PDF_OUT);
  console.log('PDF written:', PDF_OUT, (fs.statSync(PDF_OUT).size / 1024).toFixed(1) + ' KB');
}

main().catch(e => { console.error(e); process.exit(1); });
