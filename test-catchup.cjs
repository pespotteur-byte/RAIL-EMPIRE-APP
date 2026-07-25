const CDP = require('chrome-remote-interface');

const BASE = 'http://localhost:8001';
const URL_HOME = `${BASE}/?v=1784931693`;

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

  const user = 'catchup' + Math.floor(Math.random() * 100000);
  await evaluate(Runtime, `document.getElementById('login-username').value='${user}'`);
  await evaluate(Runtime, "document.getElementById('login-password').value='pass1234'");
  await evaluate(Runtime, "document.getElementById('btn-register').click()");
  await sleep(1500);

  await evaluate(Runtime, "document.getElementById('login-name').value='CatchUpCo'");
  await evaluate(Runtime, "document.getElementById('btn-new-game').click()");
  await sleep(2500);

  // Get initial time and simulate an absence of 35 minutes
  const initial = await evaluate(Runtime, `({t: game._gameTime, d: game._currentDate})`);
  console.log('initial time:', initial);

  await evaluate(Runtime, 'game.saveState()');
  await sleep(1000);

  const fakeState = {
    saveTime: Date.now() - 35 * 60 * 1000,
    gameTime: initial.t,
    gameDate: initial.d,
  };
  console.log('fakeState:', fakeState);

  await evaluate(Runtime, `game.catchUpToRealTime(${JSON.stringify(fakeState)})`);
  await sleep(1000);

  const after = await evaluate(Runtime, `({t: game._gameTime, d: game._currentDate, paris: game.engine.getFormattedTime()})`);
  console.log('after time:', after);

  // Check that 35 min were added (modulo 1440)
  const expectedTotal = initial.t + 35;
  const expectedTime = ((expectedTotal % 1440) + 1440) % 1440;
  const expectedDays = Math.floor(expectedTotal / 1440);
  if (after.t === expectedTime && (after.d === initial.d || expectedDays > 0)) {
    console.log('TEST PASSED: catch-up advanced by 35 minutes');
  } else {
    console.log('TEST FAILED: expected', expectedTime, 'got', after.t);
  }

  await client.close();
}

main().catch(e => { console.error('Fatal', e); process.exit(1); });
