import CDP from 'chrome-remote-interface';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime } = client;
  await Runtime.enable();
  const expr = `(() => {
    const orm = window.game.orm;
    const ded = {lat:52.40722, lon:9.52083};
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const graph = orm._ensureGraph();
    const ways = new Map();
    if (!graph || !graph.nodes) return JSON.stringify({error:'no graph'});
    for (const [key, node] of graph.nodes) {
      const d = haversine(ded.lat, ded.lon, node.lat, node.lon);
      if (d > 0.8) continue;
      for (const e of node.edges || []) {
        const wkey = e.wayId || e.ref || 'unknown';
        const entry = ways.get(wkey) || { wayId: e.wayId, ref: e.ref, name: e.name, tracks: e.tracks, service: e.service, usage: e.usage, count:0, near: Infinity };
        entry.count++;
        entry.near = Math.min(entry.near, d);
        ways.set(wkey, entry);
      }
    }
    const arr = Array.from(ways.values()).sort((a,b)=>a.near-b.near).slice(0,30);
    return JSON.stringify({ded, count: arr.length, ways: arr});
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log(r.result?.value);
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
