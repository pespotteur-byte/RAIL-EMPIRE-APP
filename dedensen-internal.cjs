const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const TOTAL = Number(process.env.TOTAL) || 80;
const NO_INCIDENTS = process.env.NO_INCIDENTS === '1';
const OUT_DIR = '/home/ubuntu/dedensen-test';
const BASE_URL = process.env.URL || 'http://localhost:8080';
const URL = `${BASE_URL}/?benchmark=dedensen&benchmark_total=${TOTAL}&v=1784772841${NO_INCIDENTS ? '&no_incidents=1' : ''}`;

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

async function run(client) {
  const { Page, Runtime, Log, Network } = client;
  await Page.enable();
  await Runtime.enable();
  await Log.enable();
  try {
    await Network.enable();
    await Network.setBlockedURLs({ urls: ['*://api.open-meteo.com/*', '*://*.basemaps.cartocdn.com/*', '*://*.tile.openstreetmap.org/*', '*://*.tiles.openrailwaymap.org/*'] });
    log('Blocked external tile/weather URLs');
  } catch (e) { log('Network block failed', e.message); }

  Log.entryAdded(entry => {
    if (entry.entry.level === 'error' || entry.entry.level === 'warning') {
      const text = entry.entry.text || '';
      if (text.includes('429') || text.includes('ERR_INSUFFICIENT_RESOURCES') || text.includes('Open-Meteo') || text.includes('Failed to load resource')) return;
      log('[browser]', entry.entry.level, text);
    }
  });

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
  const maxMs = (Number(process.env.TIMEOUT_MIN) || (TOTAL * 300 + 2400)) * 1000;

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
        const files = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark.reportFiles)'));
        if (files && files.json && files.html) {
          fs.writeFileSync(path.join(OUT_DIR, files.jsonName), files.json);
          fs.writeFileSync(path.join(OUT_DIR, files.htmlName), files.html);
          log('Report files saved:', files.jsonName, files.htmlName);
        } else {
          log('No reportFiles found, falling back to report JSON');
          const report = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark.getReport())'));
          fs.writeFileSync(path.join(OUT_DIR, 'report-internal.json'), JSON.stringify(report, null, 2));
        }
      } catch (e) {
        log('Error saving report files', e.message);
      }
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
        CDP({ host: 'localhost', port: 29229 }, c => resolve(c)).on('error', reject);
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
