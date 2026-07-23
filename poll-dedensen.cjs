const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/home/ubuntu/dedensen-test';
fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_FILE = path.join(OUT_DIR, 'poll-driver.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr) {
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: false });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result.value;
}

async function main() {
  const targets = await CDP.List({ host: 'localhost', port: 29229 });
  const target = targets.find(t => t.url.includes('benchmark=dedensen'));
  if (!target) { log('No dedensen page'); process.exit(1); }
  log('Attached to', target.id);

  const client = await CDP({ host: 'localhost', port: 29229, target: target.id });
  const { Runtime, Network } = client;
  await Runtime.enable();
  await Network.enable();
  await Network.setBlockedURLs({ urls: ['*://*.basemaps.cartocdn.com/*', '*://*.tile.openstreetmap.org/*', '*://api.open-meteo.com/*'] }).catch(() => {});

  const startTime = Date.now();
  while (Date.now() - startTime < 6 * 3600 * 1000) {
    await sleep(300000); // 5 minutes
    try {
      const state = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark ? window.__dedensenBenchmark.getState() : null)'));
      if (!state) { log('No state'); continue; }
      const elapsedMin = Math.floor((Date.now() - startTime) / 60000);
      log(`t=${elapsedMin}m game=${state.time} completed=${state.completed}/${state.totalServices} moving=${state.moving} waiting=${state.waiting} stopped=${state.stopped} consoleErrors=${state.consoleLog.length}`);
      if (state.completed >= state.totalServices) {
        log('All finished');
        await sleep(2000);
        const files = JSON.parse(await evaluate(Runtime, 'JSON.stringify(window.__dedensenBenchmark.reportFiles)'));
        if (files && files.json && files.html) {
          fs.writeFileSync(path.join(OUT_DIR, files.jsonName), files.json);
          fs.writeFileSync(path.join(OUT_DIR, files.htmlName), files.html);
          log('Saved', files.jsonName, files.htmlName);
        }
        break;
      }
    } catch (e) {
      log('Error', e.message);
    }
  }
  await client.close();
  log('Done');
}

main().catch(e => { log('Fatal', e.message); process.exit(1); });
