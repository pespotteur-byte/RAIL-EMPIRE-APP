import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { GlobalStationCatalog } from '../global-stations.js';
import { World } from '../world.js';
import { Renderer } from '../renderer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const stationDir = path.join(root, 'data/railnet/stations');

async function loadPack() {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = globalThis;
  vm.runInThisContext(fs.readFileSync(path.join(stationDir, 'manifest.js'), 'utf8'));
  globalThis.document = {
    head: { appendChild(script) {
      try {
        const rel = String(script.src).replace(/^data\/railnet\/stations\//, '');
        vm.runInThisContext(fs.readFileSync(path.join(stationDir, rel), 'utf8'));
        queueMicrotask(() => script.onload?.());
      } catch (e) { queueMicrotask(() => script.onerror?.(e)); }
    } },
    createElement() { return { src:'', async:false, onload:null, onerror:null, remove(){} }; },
  };
  try { return await new GlobalStationCatalog().load(); }
  finally {
    delete globalThis.__RAILNET_WORLD_STATION_PACK__;
    delete globalThis.__RAILNET_WORLD_STATION_SHARD__;
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
}

function ctx() {
  const calls={fillRect:0,arc:0,fillText:0};
  return {calls, fillStyle:'',strokeStyle:'',lineWidth:1,font:'', beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){}, arc(){calls.arc++;},fillRect(){calls.fillRect++;},fillText(){calls.fillText++;}};
}

test('v1.1.34+: real embedded station pack is fully loaded into gameplay world', async () => {
  const refs=await loadPack();
  assert.ok(refs.length>=17817);
  const world=new World();
  const n=await world.setBuiltInGameplayStationsAsync(refs,null,5000);
  assert.equal(n,refs.length);
  assert.equal(world.stations.length,refs.length);
  assert.equal(world.referenceStations.length,0);
});

test('v1.1.34: minimum zoom draws every gameplay station, no LOD dedupe', async () => {
  const refs=await loadPack();
  const world=new World();
  await world.setBuiltInGameplayStationsAsync(refs,null,5000);
  const r=Object.create(Renderer.prototype);
  r.tileMap={zoomLevel:5,screenToWorld(){throw new Error('zoom 5 must not viewport-filter stations');}};
  r.logicalWidth=1200; r.logicalHeight=800;
  r.latLonToScreen=()=>({x:600,y:400});
  const c=ctx();
  r.drawStations(c,world,null,true);
  assert.equal(c.calls.fillRect,refs.length);
  assert.equal(c.calls.arc,0);
  assert.equal(c.calls.fillText,0);
});

test('v1.1.34: startup loads all-zoom baseline before local OSM stream', () => {
  const main=fs.readFileSync(path.join(root,'js/main.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(index.includes('data/railnet/stations/manifest.js?v=1152'));
  assert.ok(main.includes('_ensureAllZoomGameplayStations() {'));
  assert.ok((main.match(/await this\._ensureAllZoomGameplayStations\(\)/g)||[]).length >= 3, 'new/load/import must await the complete station baseline');
  assert.ok(main.includes("this._ensureAllZoomGameplayStations().catch"), 'login screen must preload the baseline in background');
  assert.ok(!main.includes('zoomez à 10+ pour charger le réseau et les gares jouables'));
});
