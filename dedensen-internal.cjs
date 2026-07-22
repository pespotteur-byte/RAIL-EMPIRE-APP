const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const TOTAL = Number(process.env.TOTAL) || 80;
const OUT_DIR = '/home/ubuntu/dedensen-test';
const URL = `http://localhost:8080/?benchmark=dedensen&benchmark_total=${TOTAL}&v=1784731012`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_FILE = path.join(OUT_DIR, 'internal-driver.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr, opts = {}) {
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: false, ...opts });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result.value;
}

async function setDownloadPath(client, dir) {
  for (const domain of ['Browser', 'Page']) {
    try {
      if (!client[domain] || !client[domain].setDownloadBehavior) continue;
      await client[domain].setDownloadBehavior({ behavior: 'allow', downloadPath: dir, eventsEnabled: true });
      log('Download path set via', domain);
      return;
    } catch (e) {
      log(domain + '.setDownloadBehavior failed', e.message);
    }
  }
}

async function run(client) {
  const { Page, Runtime, Log } = client;
  await Page.enable();
  await Runtime.enable();
  await Log.enable();

  Page.downloadWillBegin(e => log('Download started', e.url || '', e.suggestedFilename || ''));
  Page.downloadProgress(e => { if (e.state === 'completed') log('Download completed', e.guid); });

  Log.entryAdded(entry => {
    if (entry.entry.level === 'error' || entry.entry.level === 'warning') {
      log('[browser]', entry.entry.level, entry.entry.text);
    }
  });

  await setDownloadPath(client, OUT_DIR);

  // Clean previous internal benchmark downloads
  try {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (f.startsWith('dedensen-report-')) fs.unlinkSync(path.join(OUT_DIR, f));
    }
  } catch (e) {}

  log('Navigating to', URL);
  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await Page.bringToFront();
  await sleep(3000);

  for (let i = 0; i < 60; i++) {
    const ready = await evaluate(Runtime, '!!window.__dedensenBenchmark');
    if (ready) break;
    await sleep(1000);
  }
  if (!await evaluate(Runtime, '!!window.__dedensenBenchmark')) {
    throw new Error('Benchmark API not created');
  }
  log('Benchmark started');

  const startTime = Date.now();
  const maxMs = (TOTAL * 240 + 600) * 1000;

  while (Date.now() - startTime < maxMs) {
    await sleep(60000);
    let state;
    try {
      state = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark.getState())'));
    } catch (e) {
      log('Error reading state', e.message);
      continue;
    }
    const elapsedMin = Math.floor((Date.now() - startTime) / 60000);
    log(`t=${elapsedMin}m completed=${state.completed}/${state.totalServices} moving=${state.moving} waiting=${state.waiting} stopped=${state.stopped}`);
    if (state.completed >= state.totalServices) {
      log('All finished');
      await sleep(3000);
      try {
        const report = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark.getReport())'));
        fs.writeFileSync(path.join(OUT_DIR, 'report-internal.json'), JSON.stringify(report, null, 2));
        log('Report JSON saved');
      } catch (e) {
        log('Error saving report JSON', e.message);
      }
      await sleep(10000);
      log('Downloads in', OUT_DIR, fs.readdirSync(OUT_DIR).filter(f => f.startsWith('dedensen-report-')));
      return;
    }
  }
  log('Timeout reached');
}

async function main() {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const client = await new Promise((resolve, reject) => {
        CDP({ host: 'localhost', port: 29229 }, (c) => resolve(c)).on('error', reject);
      });
      await run(client);
      client.close();
      process.exit(0);
    } catch (e) {
      log('FATAL attempt', attempts, e.message, e.stack);
      attempts++;
      await sleep(10000);
      log('Retrying CDP connection...');
    }
  }
  process.exit(1);
}

main();
