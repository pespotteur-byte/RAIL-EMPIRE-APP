const CDP = require('chrome-remote-interface');

const BASE = 'http://localhost:8001';
const URL_HOME = `${BASE}/?v=1784931680`;

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

  // Clear local state and load login screen
  await Page.navigate({ url: URL_HOME });
  await Page.loadEventFired();
  await sleep(1500);
  await evaluate(Runtime, "localStorage.clear()");

  const user = 'cdptest' + Math.floor(Math.random() * 100000);
  await evaluate(Runtime, `document.getElementById('login-username').value='${user}'`);
  await evaluate(Runtime, "document.getElementById('login-password').value='pass1234'");
  await evaluate(Runtime, "document.getElementById('btn-register').click()");
  await sleep(1500);

  const authVisible = await evaluate(Runtime, "document.getElementById('auth-section').style.display");
  console.log('auth section display:', authVisible);
  if (authVisible === 'block') {
    const msg = await evaluate(Runtime, "document.getElementById('auth-message').textContent");
    throw new Error('Registration failed: ' + msg);
  }

  // Start new game
  await evaluate(Runtime, "document.getElementById('login-name').value='CDPTestCo'");
  await evaluate(Runtime, "document.getElementById('btn-new-game').click()");
  await sleep(3000);

  const gameOk = await evaluate(Runtime, '!!window.game');
  console.log('game started:', gameOk);

  // Save state
  await evaluate(Runtime, 'game.saveState()');
  await sleep(1500);

  const token = await evaluate(Runtime, "localStorage.getItem('re_api_token')");
  console.log('token present:', !!token);

  // Reload and load
  await Page.navigate({ url: URL_HOME });
  await Page.loadEventFired();
  await sleep(2000);

  const gameVisible = await evaluate(Runtime, "document.getElementById('game-section').style.display");
  console.log('game section display after reload:', gameVisible);

  const loadVisible = await evaluate(Runtime, "document.getElementById('btn-load-game').style.display");
  console.log('load button display after reload:', loadVisible);
  if (loadVisible !== 'block') {
    const nameVal = await evaluate(Runtime, "document.getElementById('login-name').value");
    console.log('login name value:', nameVal);
    if (nameVal !== 'CDPTestCo') throw new Error('Load button not visible and company name not restored');
  }
  await evaluate(Runtime, "document.getElementById('btn-load-game').click()");
  await sleep(3000);

  const loadedName = await evaluate(Runtime, 'game.account.companyName');
  console.log('Loaded companyName:', loadedName);
  if (loadedName === 'CDPTestCo') {
    console.log('TEST PASSED: register/save/load across reload works');
  } else {
    throw new Error('Company name mismatch: ' + loadedName);
  }

  await client.close();
}

main().catch(e => { console.error('Fatal', e); process.exit(1); });
