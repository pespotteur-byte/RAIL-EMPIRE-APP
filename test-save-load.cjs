const CDP = require('chrome-remote-interface');

const BASE = 'http://localhost:8001';
const URL_BENCH = `${BASE}/?benchmark=dedensen&benchmark_total=10&no_incidents=1&v=1784772841`;
const URL_HOME = `${BASE}/?v=1784931689`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr) {
  const wrapped = `(async () => { return ${expr}; })()`;
  const res = await Runtime.evaluate({ expression: wrapped, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result.value;
}

async function waitFor(Runtime, expr, timeoutMs = 60000, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(Runtime, expr);
    if (ok) return true;
    await sleep(intervalMs);
  }
  throw new Error('Timeout waiting for: ' + expr);
}

async function main() {
  const client = await new Promise((resolve, reject) => {
    CDP({ host: 'localhost', port: 29229 }, c => resolve(c)).on('error', reject);
  });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();

  console.log('Navigating to benchmark');
  await Page.navigate({ url: URL_BENCH });
  await Page.loadEventFired();
  await sleep(2000);
  await waitFor(Runtime, '!!window.game && !!window.__dedensenBenchmark', 60000, 1000);
  console.log('Benchmark started');
  await sleep(3000);

  console.log('Saving state manually');
  const beforeSave = await evaluate(Runtime, 'JSON.stringify({companyName: game.account.companyName, time: game.engine?.gameTime})');
  console.log('Before save:', beforeSave);
  await evaluate(Runtime, 'game.saveState()');
  await sleep(2000);

  // Ensure remote save exists
  const saveRes = await fetch(`${BASE}/load/rail-empire-save`);
  if (!saveRes.ok) throw new Error('Remote save not created: ' + saveRes.status);
  const saved = await saveRes.json();
  console.log('Remote save companyName:', saved.companyName);

  console.log('Reloading home page');
  await Page.navigate({ url: URL_HOME });
  await Page.loadEventFired();
  await sleep(2000);

  const hasSave = await evaluate(Runtime, 'await game.storage.hasSave()');
  console.log('hasSave after reload:', hasSave);
  const loadVisible = await evaluate(Runtime, "document.getElementById('btn-load-game').style.display");
  console.log('Load button display:', loadVisible);
  const loginName = await evaluate(Runtime, "document.getElementById('login-name').value");
  console.log('Login name:', loginName);

  if (hasSave && loadVisible === 'block') {
    console.log('Clicking load');
    await evaluate(Runtime, "document.getElementById('btn-load-game').click()");
    await sleep(3000);
    const loadedName = await evaluate(Runtime, 'game.account.companyName');
    console.log('Loaded companyName:', loadedName);
    if (loadedName === saved.companyName) {
      console.log('TEST PASSED: save/load across page change works');
    } else {
      console.log('TEST FAILED: companyName mismatch');
    }
  } else {
    console.log('TEST FAILED: load not available');
  }

  await client.close();
}

main().catch(e => { console.error('Fatal', e); process.exit(1); });
