import CDP from 'chrome-remote-interface';
async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime } = client;
  await Runtime.enable();
  const expr = `(() => {
    const orm = window.game.orm;
    function haversine(lat1, lon1, lat2, lon2) {
      const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const graph = orm._ensureGraph();
    const junctions = [];
    for (const [key, node] of graph.nodes) {
      const refs = new Set();
      const wayIds = new Set();
      for (const e of node.edges || []) {
        if (e.ref) refs.add(e.ref);
        if (e.wayId) wayIds.add(e.wayId);
      }
      if (refs.has('1700') && refs.has('1750')) {
        const ded = {lat:52.40722, lon:9.52083};
        const d = haversine(node.lat, node.lon, ded.lat, ded.lon);
        const edges = (node.edges || []).map(e=>({to:e.to,wayId:e.wayId,ref:e.ref,tracks:e.tracks,service:e.service,usage:e.usage,maxSpeed:e.maxSpeed}));
        junctions.push({key, lat:node.lat, lon:node.lon, distToDed:d, edges});
      }
    }
    junctions.sort((a,b)=>a.distToDed-b.distToDed);
    return JSON.stringify({count:junctions.length, junctions: junctions.slice(0,10)});
  })()`;
  const r = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log(r.result?.value);
  await client.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
