const CDP = require('chrome-remote-interface');

const BASE = 'http://localhost:8001';
const URL_HOME = `${BASE}/?v=1784931685`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr) {
  const wrapped = `(async () => { return ${expr}; })()`;
  const res = await Runtime.evaluate({ expression: wrapped, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result.value;
}

async function main() {
  const client = await new Promise((resolve, reject) => {
    CDP({ host: 'localhost', port: 29229 }, c => resolve(c)).on('error', reject);
  });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();

  await Page.navigate({ url: URL_HOME });
  await Page.loadEventFired();
  await sleep(1500);
  await evaluate(Runtime, "localStorage.clear()");

  const user = 'loadcatch' + Math.floor(Math.random() * 100000);
  await evaluate(Runtime, `document.getElementById('login-username').value='${user}'`);
  await evaluate(Runtime, "document.getElementById('login-password').value='pass1234'");
  await evaluate(Runtime, "document.getElementById('btn-register').click()");
  await sleep(1500);

  await evaluate(Runtime, "document.getElementById('login-name').value='LoadCatchCo'");
  await evaluate(Runtime, "document.getElementById('btn-new-game').click()");
  await sleep(2500);

  const initial = await evaluate(Runtime, `({t: game._gameTime, d: game._currentDate})`);
  console.log('initial time:', initial);

  // Save state to server with a fake 45-min-old saveTime
  const state = await evaluate(Runtime, `game.saveState()`);
  state.saveTime = Date.now() - 45 * 60 * 1000;
  state.gameTime = initial.t;
  state.gameDate = initial.d;

  const token = await evaluate(Runtime, "localStorage.getItem('re_api_token')");
  const res = await fetch(`${BASE}/save/rail-empire-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error('Save failed: ' + res.status);
  console.log('saved with old timestamp');

  // Reload and load
  await Page.navigate({ url: URL_HOME });
  await Page.loadEventFired();
  await sleep(2000);
  await evaluate(Runtime, "document.getElementById('btn-load-game').click()");
  await sleep(4000);

  const after = await evaluate(Runtime, `({t: game._gameTime, d: game._currentDate, running: game.running, paris: game.engine.getFormattedTime()})`);
  console.log('after load time:', after);

  const expectedTotal = initial.t + 45;
  const expectedTime = ((expectedTotal % 1440) + 1440) % 1440;
  if (after.t === expectedTime && after.running) {
    console.log('TEST PASSED: load with 45-min catch-up works');
  } else {
    console.log('TEST FAILED: expected', expectedTime, 'got', after.t);
  }

  await client.close();
}

main().catch(e => { console.error('Fatal', e); process.exit(1); });
