import CDP from 'chrome-remote-interface';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime } = client;
  await Runtime.enable();
  const expr = `(async () => {
    const orm = window.game.orm;
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const h = {lat:52.376761, lon:9.741021};
    const w = {lat:52.422225, lon:9.450976};
    const j1 = {lat:52.4228637, lon:9.4464493};
    const j2 = {lat:52.4230796, lon:9.4431787};
    function summarize(label, pts) {
      if (!Array.isArray(pts)) return {label, error: String(pts)};
      const dist = pts.reduce((s,p,i)=> i? s+haversine(pts[i-1].lat, pts[i-1].lon, p.lat, p.lon):0,0);
      const refs = [...new Set(pts.map(p=>p.ref||''))];
      const wayIds = [...new Set(pts.map(p=>p.wayId).filter(Boolean))].slice(0,6);
      return {label, count:pts.length, dist: Math.round(dist*1000)/1000, refs, wayIds, start: pts[0], end: pts[pts.length-1]};
    }
    const rhj1 = await orm.findRoute(h.lat, h.lon, j1.lat, j1.lon);
    const rhj2 = await orm.findRoute(h.lat, h.lon, j2.lat, j2.lon);
    const rj1w = await orm.findRoute(j1.lat, j1.lon, w.lat, w.lon);
    const rj2w = await orm.findRoute(j2.lat, j2.lon, w.lat, w.lon);
    return JSON.stringify({
      h2j1: summarize('h2j1', rhj1),
      h2j2: summarize('h2j2', rhj2),
      j1w: summarize('j1w', rj1w),
      j2w: summarize('j2w', rj2w),
    });
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result?.value);
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
