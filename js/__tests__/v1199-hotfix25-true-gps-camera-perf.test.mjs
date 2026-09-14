import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const mainSrc=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');

function transformedQuad(geom,bearingDeg){
  const half=geom.width/2*geom.planeScale;
  const rz=bearingDeg*Math.PI/180;
  const rx=geom.pitchDeg*Math.PI/180;
  const d=geom.perspectivePx;
  const out=[];
  for(const [x0,y0] of [[-half,-half],[half,-half],[half,half],[-half,half]]){
    const x1=x0*Math.cos(rz)-y0*Math.sin(rz);
    const y1=x0*Math.sin(rz)+y0*Math.cos(rz);
    const y2=y1*Math.cos(rx)*geom.yComp;
    const z2=y1*Math.sin(rx);
    const f=d/(d-z2);
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

test('HOTFIX25 uses a visibly perspective GPS camera',()=>{
  const far=compute3DPlaneGeometry(982,540,8.5);
  const close=compute3DPlaneGeometry(982,540,17.5);
  assert.ok(far.perspectivePx>=1295 && far.perspectivePx<=1305);
  assert.ok(far.pitchDeg>=48);
  assert.ok(close.pitchDeg>=57.9);
  assert.ok(close.pitchDeg>far.pitchDeg);
  assert.equal(far.yComp,1.6);
  assert.match(css,/perspective\(var\(--re3d-perspective,1300px\)\) scaleY\(var\(--re3d-ycomp,1\.6\)\) rotateX/);
  assert.doesNotMatch(css,/perspective\(5000px\) rotateX/);
});

test('HOTFIX25 real overscan covers all viewport corners with strong perspective',()=>{
  for(const [w,h] of [[982,540],[1366,768],[1920,1080],[1280,1024]]){
    for(const zoom of [8.5,11,13.5,15.5,17.5]){
      const g=compute3DPlaneGeometry(w,h,zoom);
      for(let bearing=0;bearing<180;bearing+=5){
        const q=transformedQuad(g,bearing);
        const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        assert.ok(corners.every(pt=>insideConvex(pt,q)),`${w}x${h} z${zoom} bearing ${bearing}`);
      }
    }
  }
});

test('HOTFIX25 cuts raster pixel cost and ignores dirty-spam between GPS frames',()=>{
  const oldLike=Math.hypot(982,540)/Math.cos(44*Math.PI/180)*1.08;
  const g=compute3DPlaneGeometry(982,540,15.5);
  assert.ok(g.width < oldLike*0.9,`new ${g.width}, old-like ${oldLike}`);
  assert.match(rendererSrc,/const dpr = threeD \? 1\.0 : baseDpr;/);
  assert.match(mainSrc,/threeDInterval = last3DCost > 220 \? 650 : last3DCost > 130 \? 450 : last3DCost > 75 \? 320 : 220/);
  assert.match(mainSrc,/const shouldRender = threeDFollowActive\s*\? threeDFrameDue/);
  assert.doesNotMatch(mainSrc,/threeDFollowActive\s*\? \(this\.renderer\.needsRender \|\| threeDFrameDue/);
  assert.match(mainSrc,/this\.renderer\._last3DRenderCostMs/);
});

test('HOTFIX25 keeps center-follow arrow and extends close zoom',()=>{
  assert.match(rendererSrc,/p = \{ x:this\.viewportWidth \/ 2, y:this\.viewportHeight \/ 2/);
  assert.match(uiSrc,/Math\.min\(17\.5, Number\(tm\.zoomLevel \|\| 11\)/);
  assert.match(index,/style\.css\?v=1199re3d10/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep17/);
  assert.match(build,/1199dep17/);
});
