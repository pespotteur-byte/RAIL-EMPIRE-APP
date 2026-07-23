import fs from 'fs';
const data = JSON.parse(fs.readFileSync('/home/ubuntu/routes-dedensen.json', 'utf8'));
const route = data.h2haste_full;
const w = {lat:52.422225, lon:9.450976};
function haversine(lat1, lon1, lat2, lon2) {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
let bestIdx = -1, bestDist = Infinity;
for (let i=0;i<route.length;i++) {
  const d = haversine(route[i].lat, route[i].lon, w.lat, w.lon);
  if (d < bestDist) { bestDist=d; bestIdx=i; }
}
console.log('nearest to Wunstorf at index', bestIdx, 'dist km', bestDist, 'point', route[bestIdx]);
const ded = {lat:52.40722, lon:9.52083};
for (let i=Math.max(0,bestIdx-5); i<=Math.min(route.length-1,bestIdx+5); i++) {
  const d = haversine(route[i].lat, route[i].lon, ded.lat, ded.lon);
  console.log(i, route[i].lat, route[i].lon, 'ref', route[i].ref, 'wayId', route[i].wayId, 'tracks', route[i].tracks, 'distDed', d.toFixed(3));
}
