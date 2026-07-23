import CDP from 'chrome-remote-interface';
import fs from 'fs';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime } = client;
  await Runtime.enable();
  const routes = JSON.parse(fs.readFileSync('/home/ubuntu/manual-routes.json','utf8'));
  const wp = routes.bremenRoute[550];
  const expr = `(async () => {
    const orm = window.game.orm;
    const h={lat:52.376761,lon:9.741021};
    const w={lat:52.422225,lon:9.450976};
    const wp={lat:${wp.lat},lon:${wp.lon}};
    const r = await orm.findConstrainedRoute(h.lat,h.lon,w.lat,w.lon,[wp]);
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const dist = r.reduce((s,p,i)=> i? s+haversine(r[i-1].lat,r[i-1].lon,p.lat,p.lon):0,0);
    const refs = {};
    for (const p of r) refs[p.ref||'none']=(refs[p.ref||'none']||0)+1;
    const ded={lat:52.40722,lon:9.52083};
    const dedIdx = r.findIndex(p=> haversine(p.lat,p.lon,ded.lat,ded.lon)<0.1);
    return JSON.stringify({count:r.length, dist, refs, dedIdx, dedPoint:r[dedIdx]||null, fallback: r.some(p=>p.fallback)});
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue:true, awaitPromise:true });
  console.log(r.result?.value);
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
