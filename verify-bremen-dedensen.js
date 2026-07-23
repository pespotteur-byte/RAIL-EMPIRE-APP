import fs from 'fs';
const routes = JSON.parse(fs.readFileSync('/home/ubuntu/manual-routes.json', 'utf8'));
function haversine(lat1, lon1, lat2, lon2) {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const ded = {lat:52.40722, lon:9.52083};
for (const [name, pts] of Object.entries(routes)) {
  let best = Infinity, idx = -1;
  for (let i=0;i<pts.length;i++) { const d=haversine(pts[i].lat,pts[i].lon,ded.lat,ded.lon); if (d<best){best=d;idx=i;} }
  console.log(name, 'nearest to Dedensen at', idx, 'dist', best.toFixed(3), 'point', pts[idx]);
  // print refs around Dedensen
  for (let i=Math.max(0,idx-3); i<=Math.min(pts.length-1, idx+3); i++) {
    console.log(' ', i, 'ref', pts[i].ref, 'wayId', pts[i].wayId, 'tracks', pts[i].tracks, 'lat', pts[i].lat, 'lon', pts[i].lon);
  }
}
