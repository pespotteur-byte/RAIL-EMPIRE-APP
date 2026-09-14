import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const mainSrc=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const mapSrc=fs.readFileSync(new URL('../map.js',import.meta.url),'utf8');
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
    assert.ok(den>1,'plane must remain in front of perspective camera');
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

test('HOTFIX26 provides a genuinely oblique close GPS camera and zoom 20',()=>{
  const far=compute3DPlaneGeometry(982,540,8.5);
  const close=compute3DPlaneGeometry(982,540,20);
  assert.ok(far.pitchDeg>=50);
  assert.ok(close.pitchDeg>=67.9);
  assert.ok(close.pitchDeg>far.pitchDeg+17);
  assert.equal(close.yComp,1.75);
  assert.ok(close.perspectivePx < Math.hypot(982,540)*1.3);
  assert.match(css,/perspective\(var\(--re3d-perspective,1400px\)\) scaleY\(var\(--re3d-ycomp,1\.75\)\) rotateX/);
  assert.match(uiSrc,/Math\.min\(20\.0, Number\(tm\.zoomLevel \|\| 11\)/);
  assert.match(mapSrc,/this\._satelliteMaxZoom = 20/);
});

test('HOTFIX26 projected overscan covers viewport corners at every tested bearing',()=>{
  for(const [w,h] of [[982,540],[1366,768],[1920,1080],[1280,1024],[800,600]]){
    for(const zoom of [8.5,11,14,17,20]){
      const g=compute3DPlaneGeometry(w,h,zoom);
      for(let bearing=0;bearing<180;bearing+=5){
        const q=transformedQuad(g,bearing);
        const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        assert.ok(corners.every(pt=>insideConvex(pt,q)),`${w}x${h} z${zoom} bearing ${bearing}`);
      }
    }
  }
});

test('HOTFIX26 decouples live motion from heavyweight raster repaints',()=>{
  assert.match(css,/translate3d\(var\(--re3d-pan-x,0px\),var\(--re3d-pan-y,0px\),0\)/);
  assert.match(css,/transition:transform 55ms linear/);
  assert.match(uiSrc,/_set3DMapPan\(dx, dy\)/);
  assert.match(uiSrc,/is3DPlanePanSafe\?\.\(dx, dy, this\._threeDCameraHeading, 14\)/);
  assert.match(uiSrc,/prepare3DMapAnchorForRender\(force = false\)/);
  assert.match(mainSrc,/threeDInterval = last3DCost > 220 \? 5000 : last3DCost > 130 \? 4000 : last3DCost > 75 \? 3000 : 2200/);
  assert.match(mainSrc,/threeDHeartbeatDue = threeDElapsed >= 8000/);
  assert.match(mainSrc,/threeDAnchorDue = !!this\.ui\?\._threeDMapNeedsReanchor/);
  assert.match(mainSrc,/prepare3DMapAnchorForRender\?\.\(\)/);
});

test('HOTFIX26 bundle/cache contract is current',()=>{
  assert.match(index,/style\.css\?v=1199re3d11/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep18/);
  assert.match(build,/HOTFIX26-COMPOSITOR-GPS-FOLLOW/);
  assert.match(build,/CACHE_VERSION = '1199dep18'/);
});
