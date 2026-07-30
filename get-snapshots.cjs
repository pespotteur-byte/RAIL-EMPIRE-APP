const CDP = require('chrome-remote-interface');
const fs = require('fs');

const OUT = '/home/ubuntu/dedensen-test/snapshots-internal.json';

function log(...args) { console.log(...args); }

CDP({ host: 'localhost', port: 29229 }, async (client) => {
  const { Page, Runtime } = client;
  try {
    await Page.enable();
    await Runtime.enable();

    // The benchmark page may still be open; if not, nothing to do.
    const has = await Runtime.evaluate({ expression: '!!window.__dedensenBenchmark', returnByValue: true });
    if (!has.result.value) {
      log('No benchmark API found');
      client.close();
      process.exit(1);
    }

    log('Fetching snapshots...');
    const res = await Runtime.evaluate({
      expression: 'JSON.stringify(window.__dedensenBenchmark.snapshots)',
      returnByValue: true,
      timeout: 120000
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description);
    fs.writeFileSync(OUT, res.result.value);
    log('Saved', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
    client.close();
    process.exit(0);
  } catch (e) {
    log('FATAL', e.message, e.stack);
    client.close();
    process.exit(1);
  }
}).on('error', err => { log('CDP error', err); process.exit(1); });
