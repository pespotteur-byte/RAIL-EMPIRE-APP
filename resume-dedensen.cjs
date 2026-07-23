const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/home/ubuntu/dedensen-test';
fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_FILE = path.join(OUT_DIR, 'resume-driver.log');

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

const CDP_HOST = 'localhost';
const CDP_PORT = 29229;

async function main() {
  const targets = await CDP.List({ host: CDP_HOST, port: CDP_PORT });
  const target = targets.find(t => t.url.includes('benchmark=dedensen'));
  if (!target) {
    log('No dedensen page found');
    process.exit(1);
  }
  log('Attaching to', target.id, target.url);

  const client = await CDP({ host: CDP_HOST, port: CDP_PORT, target: target.id });
  const { Page, Runtime, Log, Network } = client;
  await Page.enable();
  await Runtime.enable();
  await Log.enable();
  await Network.enable();
  try {
    await Network.setBlockedURLs({ urls: ['*://*.basemaps.cartocdn.com/*', '*://*.tile.openstreetmap.org/*'] });
    log('Blocked tile URLs');
  } catch (e) { log('Could not block URLs', e.message); }

  Log.entryAdded(entry => {
    if (entry.entry.level === 'error' || entry.entry.level === 'warning') {
      if (!entry.entry.text.includes('429')) log('[browser]', entry.entry.level, entry.entry.text);
    }
  });

  const startTime = Date.now();
  const maxMs = 5 * 3600 * 1000;
  while (Date.now() - startTime < maxMs) {
    await sleep(60000);
    let state;
    try {
      state = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark ? window.__dedensenBenchmark.getState() : null)'));
    } catch (e) {
      log('Error reading state', e.message);
      continue;
    }
    if (!state) { log('No benchmark API yet'); continue; }
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
        }
      } catch (e) { log('Error saving report files', e.message); }
      break;
    }
  }
  await client.close();
  log('Resume driver done');
}

main().catch(e => { log('Fatal', e.message); process.exit(1); });
