import CDP from 'chrome-remote-interface';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime, Page } = client;
  await Runtime.enable();
  await Page.enable();
  const url = 'http://localhost:8080/?dedensen=' + Date.now();
  await Page.navigate({ url });
  await new Promise(r => setTimeout(r, 5000));
  for (let i = 0; i < 80; i++) {
    const r = await Runtime.evaluate({ expression: 'typeof window.game !== "undefined" && window.game.orm && window.game.orm._ensureGraph', returnByValue: true });
    if (r.result?.value) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const expr = `(async () => {
    const orm = window.game.orm;
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    function routeInfo(label, pts) {
      if (!Array.isArray(pts)) return {label, error: 'not array', raw: String(pts)};
      let dist = 0;
      for (let i = 1; i < pts.length; i++) dist += haversine(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
      const ded = {lat:52.40722, lon:9.52083};
      const nearDed = pts.findIndex(p => haversine(p.lat,p.lon,ded.lat,ded.lon) < 1);
      const ways = [...new Set(pts.filter(p => p.wayId).map(p => p.wayId))].slice(0,10);
      return {label, count: pts.length, dist: Math.round(dist*1000)/1000, nearDed, ways, start: pts[0], end: pts[pts.length-1]};
    }
    const h = {lat:52.376761, lon:9.741021};
    const w = {lat:52.422225, lon:9.450976};
    const ded = {lat:52.40722, lon:9.52083};
    const has = {lat:52.37917, lon:9.38861};
    const bremen = {lat:53.0793, lon:8.8017};
    const rh = await orm.findRoute(h.lat, h.lon, w.lat, w.lon);
    const rwh = await orm.findRoute(w.lat, w.lon, h.lat, h.lon);
    const rhb = await orm.findRoute(h.lat, h.lon, bremen.lat, bremen.lon);
    const rhh = await orm.findRoute(h.lat, h.lon, has.lat, has.lon);
    const h2wDed = rh.filter((p,i)=> i===0 || i===rh.length-1 || (p.lat>52.35 && p.lat<52.45 && p.lon>9.35 && p.lon<9.65));
    return JSON.stringify({
      h2w: routeInfo('h2w', rh),
      w2h: routeInfo('w2h', rwh),
      h2bremen: routeInfo('h2bremen', rhb),
      h2haste: routeInfo('h2haste', rhh),
      h2wDed: h2wDed.map((p,i)=>({i,lat:p.lat,lon:p.lon,tracks:p.tracks||1,wayId:p.wayId,name:p.name||'',ref:p.ref||'',service:p.service||'',maxSpeed:p.maxSpeed})),
    });
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result?.value || JSON.stringify(r));
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
