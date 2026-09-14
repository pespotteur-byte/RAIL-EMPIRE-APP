import assert from 'node:assert/strict';
import { TileMap } from './js/map.js';
import { compute3DPlaneGeometry } from './js/renderer.js';

const tm=new TileMap();
tm.zoomLevel=30; tm._lastRoundedZoom=30; tm._zoomSettled=true; tm._lastQueueZoom=30;
let fetched=0;
tm._fetchTile=()=>{fetched++;};
const t={loaded:false,error:false};
tm._baseQueue.push({tile:t,url:'x',z:20,viewZ:30});
tm._drainPool(tm._baseQueue,30,false);
assert.equal(fetched,1);

function quad(g,bearingDeg){
 const half=g.width/2*g.planeScale, rz=-bearingDeg*Math.PI/180, rx=g.pitchDeg*Math.PI/180, out=[];
 for(const [x0,y0] of [[-half,-half],[half,-half],[half,half],[-half,half]]){
  const x1=x0*Math.cos(rz)-y0*Math.sin(rz), y1=x0*Math.sin(rz)+y0*Math.cos(rz);
  const y2=y1*Math.cos(rx)*g.yComp, z2=y1*Math.sin(rx), den=g.perspectivePx-z2;
  assert.ok(den>1); const f=g.perspectivePx/den; out.push([x1*f,y2*f]);
 } return out;
}
function inside([x,y],poly){let pos=false,neg=false;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%poly.length];const c=(x2-x1)*(y-y1)-(y2-y1)*(x-x1);if(c>1e-6)pos=true;if(c<-1e-6)neg=true;if(pos&&neg)return false;}return true;}
for(const [w,h] of [[982,540],[1366,768],[1920,1080],[1280,1024],[800,600]]){
 for(const z of [20,22.5,25,27.5,30]){
  const g=compute3DPlaneGeometry(w,h,z);
  for(let b=0;b<180;b+=5){const q=quad(g,b); const cs=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]; assert.ok(cs.every(p=>inside(p,q)),`${w}x${h} z${z} b${b}`);}
 }
}
console.log('HOTFIX27 extra QA PASS: z30 queue + all-angle coverage');
