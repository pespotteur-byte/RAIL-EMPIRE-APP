const CDP = require('chrome-remote-interface');

const BASE = 'http://localhost:8001';
const URL_HOME = `${BASE}/?v=1784931689`;
const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evaluate(Runtime, expr) {
  const wrapped = `(async () => { window.__lastEvalResult = undefined; window.__lastEvalError = undefined; try { ${expr}; return window.__lastEvalResult; } catch (e) { window.__lastEvalError = e.message; throw e; } })()`;
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

  const user = 'livery' + Math.floor(Math.random() * 100000);
  await evaluate(Runtime, `document.getElementById('login-username').value='${user}'`);
  await evaluate(Runtime, "document.getElementById('login-password').value='pass1234'");
  await evaluate(Runtime, "document.getElementById('btn-register').click()");
  await sleep(1500);

  await evaluate(Runtime, "document.getElementById('login-name').value='LiveryCo'");
  await evaluate(Runtime, "document.getElementById('btn-new-game').click()");
  await sleep(3000);

  // Upload livery directly via manager
  const l = await evaluate(Runtime, `
    const blob = await fetch('${PNG_DATA}').then(r => r.blob());
    const file = new File([blob], 'red.png', { type: 'image/png' });
    const base = game.rollingStock.getAll()[0];
    window.__lastEvalResult = await game.liveryManager.upload(file, 'RougeVif', base?.id || 'stock-1', base?.name || 'Base')
  `);
  console.log('upload result:', l);

  // Create a rame with the livery and a stock element
  const rame = await evaluate(Runtime, `
    const stock = game.rollingStock.getAll()[0];
    const r = game.rameManager.add({
      name: 'RougeVif',
      liveryId: ${l.id},
      liveryName: 'RougeVif',
      elements: [stock.id],
      elementDetails: [{
        name: stock.name, instanceName: stock.name, seriesName: stock.seriesName || '',
        category: stock.category, traction: stock.traction || '',
        maxSpeed: stock.maxSpeed || 160, tonnage: stock.tonnage || 0,
        mass: stock.mass || stock.tonnage || 0, power: stock.power || 0,
        passengerCapacity: stock.passengerCapacity || 0, freightCapacity: stock.freightCapacity || 0,
        length: stock.length || 20, imageData: stock.imageData || '',
        purchasePrice: stock.purchasePrice || 0,
        wagonSubCategory: stock.wagonSubCategory || '',
        flipped: false,
      }],
    });
    window.__lastEvalResult = { id: r.id, name: r.name, liveryId: r.liveryId }
  `);
  console.log('rame:', rame);

  // Create a fake service to draw
  const svc = await evaluate(Runtime, `
    const r = game.rameManager.getById('${rame.id}');
    const world = game.world;
    const s = game.scheduleCreator.addService({
      name: r.name,
      rameId: r.id,
      serviceType: 'passager',
      stops: [{ stationId: world.stations[0]?.id || 's1', type: 'arret', departureTime: 0, arrivalTime: 0 }],
      routes: [[{ lat: 48.85, lon: 2.35 }, { lat: 48.86, lon: 2.35 }]],
    }, r, world);
    s.state = 'moving';
    s.position = { lat: 48.85, lon: 2.35 };
    s.train = { speed: 0, delay: 0, blockedBy: false, breakdown: null, category: 'voyageur', color: '#3b82f6' };
    s.category = 'voyageur';
    window.__lastEvalResult = { id: s.id, rameId: s.rameId }
  `);
  console.log('service:', svc);

  // Draw on a spare canvas to trigger livery load
  await evaluate(Runtime, `
    game.renderer.tileMap.centerLat = 48.85;
    game.renderer.tileMap.centerLon = 2.35;
    game.renderer.tileMap.zoom = 12;
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    const svc = game.scheduleCreator.getActiveServices().find(s => s.id === '${svc.id}');
    const p = game.renderer.latLonToScreen(48.85, 2.35);
    game.renderer._drawTrainIcon(ctx, {x:100, y:100}, 'voyageur', '#3b82f6', 6, 'moving', Math.PI/2, svc.rame);
    await new Promise(r => setTimeout(r, 500));
    game.renderer._drawTrainIcon(ctx, {x:100, y:100}, 'voyageur', '#3b82f6', 6, 'moving', Math.PI/2, svc.rame);
    await new Promise(r => setTimeout(r, 500));
    window.__lastEvalResult = { liveryCacheSize: game.renderer._liveryCache.size, imgLoaded: game.renderer._liveryCache.has(${l.id}) && game.renderer._liveryCache.get(${l.id}).complete }
  `);
  console.log('draw result:', 'see console');

  await sleep(1000);
  const final = await evaluate(Runtime, `window.__lastEvalResult = { cacheSize: game.renderer._liveryCache.size, loaded: game.renderer._liveryCache.has(${l.id}) && game.renderer._liveryCache.get(${l.id}).complete }`);
  console.log('final:', final);

  if (final.cacheSize >= 1 && final.loaded) {
    console.log('TEST PASSED: livery uploaded and drawn');
  } else {
    console.log('TEST FAILED: livery not loaded in renderer');
  }

  await client.close();
}

main().catch(e => { console.error('Fatal', e); process.exit(1); });
