import CDP from 'chrome-remote-interface';

const target = parseInt(process.argv[2] || '100000', 10);

async function run() {
  const client = await CDP({port: 29229});
  const {Runtime, Page} = client;
  await Page.enable();
  await Page.navigate({url: 'http://localhost:8000/'});
  await new Promise(r => setTimeout(r, 3000));
  for (let i=0; i<50; i++) {
    const r = await Runtime.evaluate({expression: 'typeof window.game !== "undefined"', returnByValue:true});
    if (r.result?.value) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const start = await Runtime.evaluate({expression: `(() => {
    const g = window.game;
    if (!g) return 'no game';
    g.account.companyName='TestCo';
    g.startGame(null);
    const w = g.world;
    w.addStation({name:'A', lat:48.86, lon:2.35});
    w.addStation({name:'B', lat:48.84, lon:2.40});
    w.addStation({name:'C', lat:48.82, lon:2.45});
    return 'ok';
  })()`, returnByValue:true});
  console.log('start', start.result?.value);

  const expr = `(() => {
    const g = window.game;
    const sc = g.scheduleCreator; const rm = g.rameManager; const w = g.world;
    const [A,B,C] = w.stations;
    const route = [
      {lat:A.lat, lon:A.lon, maxSpeed:160, electrified:true, tracks:1},
      {lat:(A.lat+B.lat)/2, lon:(A.lon+B.lon)/2, maxSpeed:160},
      {lat:(B.lat+C.lat)/2, lon:(B.lon+C.lon)/2, maxSpeed:160},
      {lat:C.lat, lon:C.lon, maxSpeed:160}
    ];
    const stops = [{stationId:A.id, type:'arret', departureTime:0, arrivalTime:0}, {stationId:B.id, type:'arret', departureTime:5, arrivalTime:3}, {stationId:C.id, type:'arret', departureTime:10, arrivalTime:8}];
    const t0 = performance.now();
    while (sc.services.length < ${target}) {
      const i = sc.services.length;
      const rame = rm.add({name:'R'+i, elementDetails:[{category:'locomotive',maxSpeed:160,power:4000,mass:80,traction:'electrique',length:20,tonnage:80}]});
      sc.addService({name:'S'+i, rameId:rame.id, stops, routes:[route], serviceType:'HLP'}, rame, w);
    }
    const createMs = performance.now() - t0;
    const pt = g.engine.getParisTime(); const date = g.engine.getParisDate();
    const t1 = performance.now(); g.tick(0, date, pt); const tickMs = performance.now()-t1;
    for (let i=0;i<20;i++) { const m0=performance.now(); g.moveTick(0.1, i*0.1); performance.now()-m0; }
    let total=0, min=Infinity, max=0;
    for (let i=20;i<80;i++) {
      const m0=performance.now(); g.moveTick(0.1, i*0.1); const ms=performance.now()-m0;
      total+=ms; min=Math.min(min,ms); max=Math.max(max,ms);
    }
    const mem = performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null;
    return JSON.stringify({count:sc.services.length, moving:sc.getMovingServices().length, createMs:Math.round(createMs), tickMs:Math.round(tickMs), avg:(total/60).toFixed(2), min:min.toFixed(2), max:max.toFixed(2), mem});
  })()`;
  const res = await Runtime.evaluate({expression: expr, returnByValue: true, awaitPromise: true, timeout: 180000});
  console.log('result', res.result?.value || res);
  await client.close();
}
run().catch(e => { console.error(e); process.exit(1); });
