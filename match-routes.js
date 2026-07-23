import fs from 'fs';
const data = JSON.parse(fs.readFileSync('/home/ubuntu/routes-dedensen.json', 'utf8'));
function haversine(lat1, lon1, lat2, lon2) {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const h2w = data.h2w_full;
const h2haste = data.h2haste_full;
for (const idx of [594, 595, 599, 600, 603, 604]) {
  const p = h2haste[idx];
  let best = -1, bestD = Infinity;
  for (let i=0;i<h2w.length;i++) {
    const d = haversine(p.lat, p.lon, h2w[i].lat, h2w[i].lon);
    if (d<bestD) { bestD=d; best=i; }
  }
  console.log('h2haste idx', idx, 'lat', p.lat, 'lon', p.lon, 'ref', p.ref, 'wayId', p.wayId, 'nearest h2w idx', best, 'dist', bestD, h2w[best]);
}
