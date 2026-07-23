import CDP from 'chrome-remote-interface';
import fs from 'fs';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime } = client;
  await Runtime.enable();
  const expr = `(async () => {
    const orm = window.game.orm;
    const h = {lat:52.376761, lon:9.741021};
    const w = {lat:52.422225, lon:9.450976};
    const has = {lat:52.37917, lon:9.38861};
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    function routeInfo(label, pts) {
      const dist = pts.reduce((s,p,i)=> i? s+haversine(pts[i-1].lat, pts[i-1].lon, p.lat, p.lon):0,0);
      const refs = {};
      for (const p of pts) { refs[p.ref||'none'] = (refs[p.ref||'none']||0)+1; }
      return {label, count:pts.length, dist, refs, start: pts[0], end: pts[pts.length-1]};
    }
    const h2w = await orm.findRoute(h.lat, h.lon, w.lat, w.lon);
    const w2h = await orm.findRoute(w.lat, w.lon, h.lat, h.lon);
    const h2haste = await orm.findRoute(h.lat, h.lon, has.lat, has.lon);
    return JSON.stringify({h2w: routeInfo('h2w', h2w), w2h: routeInfo('w2h', w2h), h2haste: routeInfo('h2haste', h2haste), h2w_full: h2w, h2haste_full: h2haste}, null, 2);
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
  fs.writeFileSync('/home/ubuntu/routes-dedensen.json', r.result?.value || '{}');
  console.log('saved');
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
