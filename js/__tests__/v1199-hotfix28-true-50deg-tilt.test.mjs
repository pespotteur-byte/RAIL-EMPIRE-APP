import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

function transformedQuad(g,bearingDeg){
  const half=g.width/2*g.planeScale;
  const rz=-bearingDeg*Math.PI/180;
  const rx=g.pitchDeg*Math.PI/180;
  const out=[];
  for(const [x0,y0] of [[-half,-half],[half,-half],[half,half],[-half,half]]){
    const x1=x0*Math.cos(rz)-y0*Math.sin(rz);
    const y1=x0*Math.sin(rz)+y0*Math.cos(rz);
    const y2=y1*Math.cos(rx)*g.yComp;
    const z2=y1*Math.sin(rx);
    const den=g.perspectivePx-z2;
    assert.ok(den>1,'plane remains in front of camera');
    const f=g.perspectivePx/den;
    out.push([x1*f,y2*f]);
  }
  return out;
}
function insideConvex([x,y],poly){
  let pos=false,neg=false;
  for(let i=0;i<poly.length;i++){
    const [x1,y1]=poly[i], [x2,y2]=poly[(i+1)%poly.length];
    const c=(x2-x1)*(y-y1)-(y2-y1)*(x-x1);
    if(c>1e-6) pos=true;
    if(c<-1e-6) neg=true;
    if(pos&&neg) return false;
  }
  return true;
}

test('HOTFIX28 uses a genuine fixed 50 degree tilt without vertical flattening',()=>{
  for(const zoom of [8.5,11,20,25,30]){
    const g=compute3DPlaneGeometry(982,540,zoom);
    assert.equal(g.pitchDeg,50);
    assert.equal(g.yComp,1);
  }
  assert.match(css,/scaleY\(var\(--re3d-ycomp,1\)\) rotateX\(var\(--re3d-pitch,50deg\)\)/);
});

test('HOTFIX28 true 50 degree plane still covers every viewport corner',()=>{
  for(const [w,h] of [[982,540],[1366,768],[1920,1080],[1280,1024],[800,600]]){
    for(const zoom of [8.5,11,20,25,30]){
      const g=compute3DPlaneGeometry(w,h,zoom);
      for(let bearing=0;bearing<180;bearing+=5){
        const q=transformedQuad(g,bearing);
        const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        assert.ok(corners.every(pt=>insideConvex(pt,q)),`${w}x${h} z${zoom} bearing ${bearing}`);
      }
    }
  }
});

test('HOTFIX28 build/cache identity is current',()=>{
  assert.match(index,/style\.css\?v=1199re3d12/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep20/);
  assert.match(build,/HOTFIX28-TRUE-50DEG-TILT/);
  assert.match(build,/CACHE_VERSION = '1199dep20'/);
});
