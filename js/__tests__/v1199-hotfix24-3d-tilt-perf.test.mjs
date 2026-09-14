import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute3DPlaneGeometry } from '../renderer.js';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const rendererSrc=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const mainSrc=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const terrainSrc=fs.readFileSync(new URL('../terrain3d.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');

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

test('HOTFIX24 default GPS view is visibly tilted, not near-flat',()=>{
  const far=compute3DPlaneGeometry(982,540,8.5);
  const normal=compute3DPlaneGeometry(982,540,11);
  const close=compute3DPlaneGeometry(982,540,15.5);
  assert.ok(far.pitchDeg>=32);
  assert.ok(normal.pitchDeg>=35);
  assert.ok(close.pitchDeg<=44);
  assert.ok(far.pitchDeg<normal.pitchDeg && normal.pitchDeg<close.pitchDeg);
  assert.match(css,/perspective\(5000px\) rotateX\(var\(--re3d-pitch,26deg\)\) rotateZ/);
});

test('HOTFIX24 overscan still covers the viewport at all tested bearings',()=>{
  for(const [w,h] of [[982,540],[1366,768],[1920,1080],[1280,1024]]){
    for(const zoom of [8.5,10.5,11.5,13.5,15.5]){
      const geom=compute3DPlaneGeometry(w,h,zoom);
      for(let bearing=0;bearing<180;bearing+=5){
        const q=transformedQuad(w,h,geom,bearing);
        const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        assert.ok(corners.every(pt=>insideConvex(pt,q)),`${w}x${h} z${zoom} bearing ${bearing}`);
      }
    }
  }
});

test('HOTFIX24 lightweight mode is the default and DEM remains optional',()=>{
  assert.match(uiSrc,/this\._threeDReliefEnabled = false;/);
  assert.match(index,/data-re3d-action="relief" class="wide">/);
  assert.doesNotMatch(index,/data-re3d-action="relief" class="wide active"/);
});

test('HOTFIX24 throttles expensive 3D full-map redraws to 10 Hz',()=>{
  assert.match(mainSrc,/threeDFrameDue = !this\._last3DMapRender \|\| now - this\._last3DMapRender >= 100/);
  assert.match(mainSrc,/threeDFollowActive[\s\S]*?this\.renderer\.needsRender \|\| threeDFrameDue/);
  assert.match(uiSrc,/now - this\._threeDLastMapFollowAt >= 100/);
});

test('HOTFIX24 removes high-cost 3D tile supersampling and caps backing DPR',()=>{
  assert.match(rendererSrc,/const dpr = threeD \? Math\.min\(1\.35, Math\.max\(baseDpr, 1\.0\)\) : baseDpr;/);
  assert.match(rendererSrc,/this\.tileMap\.setRenderQuality\?\.\(0, 1\);/);
  assert.match(rendererSrc,/const maxMarkers = 64;/);
  assert.match(terrainSrc,/Math\.min\(1\.35, Math\.max\(1\.0, window\.devicePixelRatio\|\|1\)\)/);
  assert.match(terrainSrc,/this\._demMaxTiles = 20;/);
  assert.doesNotMatch(rendererSrc,/setRenderQuality\?\.\(threeD \? 1 : 0/);
});

test('HOTFIX24 keeps followed arrow in true screen space and marker relocation is valid',()=>{
  assert.match(rendererSrc,/p = \{ x:this\.viewportWidth \/ 2, y:this\.viewportHeight \/ 2/);
  assert.match(rendererSrc,/const targetLayer = isPinnedFollow \? followLayer : layer;[\s\S]*?targetLayer\.appendChild\(rec\.root\)/);
  const pre3D=rendererSrc.slice(0,rendererSrc.indexOf('sync3DMarkers(services)'));
  assert.doesNotMatch(pre3D,/isPinnedFollow \? followLayer : layer/);
});

test('HOTFIX24 cache and bundle identities are current',()=>{
  assert.match(build,/HOTFIX24-3D-TILT-PERF/);
  assert.match(build,/CACHE_VERSION = '1199dep16'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199dep16/);
  assert.match(index,/style\.css\?v=1199re3d9/);
  assert.match(bundle,/_threeDReliefEnabled = false/);
  assert.match(bundle,/threeDFrameDue = !this\._last3DMapRender/);
});
