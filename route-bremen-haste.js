import fs from 'fs';
const data = JSON.parse(fs.readFileSync('/home/ubuntu/routes-dedensen.json', 'utf8'));
function haversine(lat1, lon1, lat2, lon2) {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function distOf(pts) { return pts.reduce((s,p,i)=> i? s+haversine(pts[i-1].lat, pts[i-1].lon, p.lat, p.lon):0,0); }
const h2w = data.h2w_full;
const h2haste = data.h2haste_full;
const w = h2w[h2w.length-1];
const bremenToW = h2haste.slice(0, 600).concat([w]);
const hasteToW = h2haste.slice(0, 600).concat([w]); // same? haste route to Wunstorf? Actually h2haste already passes Wunstorf but continues. Truncating to 599 approximates Wunstorf.
console.log('bremen route to Wunstorf:', bremenToW.length, 'dist', distOf(bremenToW).toFixed(3));
const hasteRoute = h2w.slice(); // standard H->W (Haste direction)
console.log('haste route to Wunstorf:', hasteRoute.length, 'dist', distOf(hasteRoute).toFixed(3));
// Save to file
fs.writeFileSync('/home/ubuntu/manual-routes.json', JSON.stringify({
  bremenRoute: bremenToW,
  hasteRoute: hasteRoute,
}, null, 2));
console.log('saved manual-routes.json');
