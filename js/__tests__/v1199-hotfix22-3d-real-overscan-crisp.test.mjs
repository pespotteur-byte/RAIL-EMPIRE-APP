import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

function transformedQuad(viewW,viewH,geom,bearingDeg,scale=1.04,perspective=5000){
  const half=geom.width/2*scale;
  const rz=bearingDeg*Math.PI/180;
  const rx=geom.pitchDeg*Math.PI/180;
  const out=[];
  for(const [x0,y0] of [[-half,-half],[half,-half],[half,half],[-half,half]]){
    const x1=x0*Math.cos(rz)-y0*Math.sin(rz);
    const y1=x0*Math.sin(rz)+y0*Math.cos(rz);
    const y2=y1*Math.cos(rx);
    const z2=y1*Math.sin(rx);
    const f=perspective/(perspective-z2);
    out.push([x1*f,y2*f]);
  }
  return out;
}
function insideConvex([x,y],poly){
  const signs=[];
  for(let i=0;i<poly.length;i++){
    const [x1,y1]=poly[i], [x2,y2]=poly[(i+1)%poly.length];
    signs.push((x2-x1)*(y-y1)-(y2-y1)*(x-x1));
  }
  return signs.every(v=>v>=-1e-6)||signs.every(v=>v<=1e-6);
}

test('HOTFIX22 real square plane covers all four viewport corners at every bearing and zoom',()=>{
  const sizes=[[982,540],[1366,768],[1920,1080],[1280,1024]];
  for(const [w,h] of sizes){
    for(const zoom of [8.5,10.5,11.5,13.5,15.5]){
      const geom=compute3DPlaneGeometry(w,h,zoom);
      assert.equal(geom.width,geom.height);
      assert.ok(geom.width>w && geom.height>h);
      for(let bearing=0;bearing<180;bearing+=5){
        const q=transformedQuad(w,h,geom,bearing);
        const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        assert.ok(corners.every(pt=>insideConvex(pt,q)),`uncovered corner ${w}x${h} z${zoom} bearing ${bearing}`);
      }
    }
  }
});

test('HOTFIX22 pitch gets flatter when zoomed out and stronger when zoomed in',()=>{
  const far=compute3DPlaneGeometry(982,540,8.5);
  const normal=compute3DPlaneGeometry(982,540,11.5);
  const close=compute3DPlaneGeometry(982,540,15.5);
  assert.ok(far.pitchDeg<normal.pitchDeg);
  assert.ok(normal.pitchDeg<close.pitchDeg);
  assert.ok(far.pitchDeg>=18 && close.pitchDeg<=34);
});

test('HOTFIX22 uses real rendered overscan instead of giant CSS enlargement',()=>{
  assert.match(rendererSrc,/const planeSize = Math\.ceil\(diagonal \/ Math\.max\(0\.55, Math\.cos\(pitchRad\)\) \* 1\.12\)/);
  assert.match(rendererSrc,/this\.canvas\.style\.left = planeLeft \+ 'px'/);
  assert.match(rendererSrc,/markerPlane\.style\.width = renderW \+ 'px'/);
  assert.match(css,/rotateX\(var\(--re3d-pitch,26deg\)\)/);
  assert.match(css,/scale\(var\(--re3d-plane-scale,1\.04\)\)/);
  assert.doesNotMatch(css,/--re3d-plane-scale,2\.5/);
});

test('HOTFIX22 keeps selected train at geometric viewport centre with oversized plane',()=>{
  const g=compute3DPlaneGeometry(982,540,11.5);
  assert.ok(Math.abs((g.left+g.width/2)-982/2)<1e-9);
  assert.ok(Math.abs((g.top+g.height/2)-540/2)<1e-9);
  assert.match(rendererSrc,/p = \{ x:this\.viewportWidth \/ 2, y:this\.viewportHeight \/ 2/);
});

test('HOTFIX22 sharp mode uses one-higher source tiles and bounded DPR without 1.5x tile buffer',()=>{
  assert.match(rendererSrc,/Math\.min\(1\.75, Math\.max\(baseDpr, 1\.25\)\)/);
  assert.match(rendererSrc,/setRenderQuality\?\.\(threeD \? 1 : 0, threeD \? 1\.08 : 1\)/);
  assert.doesNotMatch(rendererSrc,/threeD \? 1\.5 : 1/);
});

test('HOTFIX22 zoom step recomputes physical plane and projection exactly once',()=>{
  assert.match(uiSrc,/zoom changes the GPS pitch[\s\S]*?renderer\?\.resize\?\.\(\)/);
});

test('HOTFIX22 cache identities select rebuilt bundle and CSS',()=>{
  assert.match(build,/HOTFIX22-3D-REAL-OVERSCAN-CRISP/);
  assert.match(build,/CACHE_VERSION = '1199dep15'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep15/);
  assert.match(index,/style\.css\?v=1199re3d8/);
});
