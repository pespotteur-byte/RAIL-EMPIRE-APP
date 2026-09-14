import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');
const tutorial = fs.readFileSync(new URL('../tutorial.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');
const coreBundle = fs.readFileSync(new URL('../rail-empire.file.bundle.js', import.meta.url), 'utf8');

test('HOTFIX9 adds optional 3D GPS follow controls without introducing heavyweight Three.js/Babylon dependencies', () => {
  assert.match(index, /id="re3d-stage"/);
  assert.match(index, /id="re3d-marker-plane"/);
  assert.match(index, /data-re3d-action="exit"/);
  assert.match(ui, /enable3DFollow\(\)/);
  assert.match(ui, /disable3DFollow\(\)/);
  assert.doesNotMatch(ui + renderer + index, /three\.js|THREE\.|WebGLRenderer|babylon/i);
});

test('HOTFIX9 keeps train icons as flat GPS billboards on a tilted map plane', () => {
  assert.match(css, /perspective\(5000px\) rotateX\(var\(--re3d-pitch,26deg\)\)[\s\S]*scale\(var\(--re3d-plane-scale,1\.04\)\)/);
  assert.match(css, /\.re3d-train-marker[\s\S]*rotateX\(var\(--re3d-counter-pitch,-26deg\)\)[\s\S]*scale\(var\(--re3d-billboard-scale,\.9615\)\)/);
  assert.match(renderer, /sync3DMarkers\(services\)/);
  assert.match(renderer, /const maxMarkers = 96/);
  assert.match(renderer, /chosen\.push\(selected\)/);
  assert.match(renderer, /--re3d-heading/);
});

test('HOTFIX9 is a read/follow mode and restores the previous 2D map state', () => {
  assert.match(css, /#main-area\.re3d-active #game-canvas[\s\S]*pointer-events:none/);
  assert.match(css, /#main-area\.re3d-active \.map-controls[\s\S]*display:none/);
  assert.match(ui, /this\._threeDPreviousMapState = \{/);
  assert.match(ui, /tm\.setSatelliteEnabled\?\.\(true\)/);
  assert.match(ui, /tm\.setSatelliteEnabled\?\.\(prev\.satellite\)/);
  assert.match(ui, /if \(prev\.basic !== tm\.basicMode\) tm\.toggleBasic\(\)/);
});

test('HOTFIX9 atmosphere follows game time and weather without extra weather network requirements', () => {
  assert.match(ui, /_sync3DAtmosphere\(force = false\)/);
  assert.match(ui, /weather\?\.current/);
  assert.match(ui, /this\.game\.timeOfDay/);
  for (const weather of ['rain','snow','storm','fog','heat']) assert.match(css, new RegExp(`re3d-${weather}`));
  assert.match(ui, /atmosphere\.style\.backgroundColor/);
  assert.match(ui, /do not apply CSS filters to the full map canvas/);
  assert.match(tutorial, /Vue 3D GPS optionnelle/);
});

test('HOTFIX9 selected train panel exposes 3D toggle and service completion cleans it up', () => {
  assert.match(ui, /id="lvp-3d-toggle"/);
  assert.match(ui, /data-re3d-action=\"toggle\"/);
  assert.match(ui, /action === 'toggle'/);
  assert.match(ui, /if \(this\._threeDFollowActive\) this\.disable3DFollow\(\)/);
  assert.match(renderer, /clear3DMarkers\(\)/);
});

test('HOTFIX9 bundle/cache identity is bumped so FILE mode cannot reuse HOTFIX8 core', () => {
  assert.match(build, /HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(build, /CACHE_VERSION = '1199dep\d+'/);
  assert.match(index, /rail-empire\.file\.bundle\.js\?v=1199dep\d+/);
  assert.match(index, /style\.css\?v=1199re3d7/);
  assert.match(coreBundle, /HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(coreBundle, /enable3DFollow\(\)/);
  assert.match(coreBundle, /sync3DMarkers\(services\)/);
});

test('RC21 GPS preserves explicitly selected original OSM and restores player map state', async () => {
  const { UI } = await import('../ui.js');
  class CL {
    constructor(){ this.s=new Set(); }
    add(...v){ for(const x of v)this.s.add(x); }
    remove(...v){ for(const x of v)this.s.delete(x); }
    toggle(v,on){ if(on===undefined) on=!this.s.has(v); on?this.s.add(v):this.s.delete(v); return on; }
    contains(v){ return this.s.has(v); }
  }
  const makeEl=()=>({classList:new CL(),style:{},className:'',textContent:'',innerHTML:'',checked:false});
  const els={
    'main-area':makeEl(),'page-map':makeEl(),'re3d-controls':makeEl(),'re3d-mode-badge':makeEl(),
    're3d-weather-chip':makeEl(),'game-canvas':makeEl(),'re3d-atmosphere':makeEl(),
    'toggle-satellite':makeEl(),'toggle-orm':makeEl(),'toggle-basic':makeEl(),'toggle-weather':makeEl(),
  };
  for(const id of ['re3d-controls','re3d-mode-badge','re3d-weather-chip']) els[id].classList.add('hidden');
  const prevDocument=globalThis.document, prevRaf=globalThis.requestAnimationFrame;
  globalThis.document={getElementById:id=>els[id]||null,querySelector:()=>null};
  globalThis.requestAnimationFrame=(fn)=>{ fn(); return 1; };
  const tm={zoomLevel:9,satelliteEnabled:false,basicMode:true,railEnabled:false,weatherEnabled:true,centerLat:0,centerLon:0,
    toggleBasic(){this.basicMode=!this.basicMode;this.railEnabled=!this.basicMode;},
    setSatelliteEnabled(v){this.satelliteEnabled=!!v;},setWeatherEnabled(v){this.weatherEnabled=!!v;},markDirty(){this.dirty=true;}};
  const renderer={tileMap:tm,requestRender(){},resize(){},clear3DMarkers(){this.cleared=true;}};
  const obj=Object.create(UI.prototype);
  Object.assign(obj,{game:{renderer,weather:{current:'rain',temperature:9,windSpeed:12,cloudCover:90,precipitation:2},timeOfDay:22*60},selectedService:{id:'S',position:{lat:50,lon:5}},_threeDFollowActive:false,_threeDLabels:true,_threeDAtmosphereKey:'',_followService:null});
  assert.equal(obj.enable3DFollow(),true);
  assert.equal(obj._threeDFollowActive,true);
  assert.equal(tm.satelliteEnabled,false);
  assert.equal(tm.basicMode,true);
  assert.equal(tm.railEnabled,false);
  assert.ok(tm.zoomLevel>=10.25 && tm.zoomLevel<=11.5);
  assert.ok(els['main-area'].classList.contains('re3d-active'));
  assert.ok(els['main-area'].classList.contains('re3d-rain'));
  obj.disable3DFollow();
  assert.equal(obj._threeDFollowActive,false);
  assert.equal(tm.satelliteEnabled,false);
  assert.equal(tm.basicMode,true);
  assert.equal(tm.railEnabled,false);
  assert.equal(tm.weatherEnabled,true);
  assert.equal(tm.zoomLevel,9);
  assert.equal(renderer.cleared,true);
  globalThis.document=prevDocument; globalThis.requestAnimationFrame=prevRaf;
});
