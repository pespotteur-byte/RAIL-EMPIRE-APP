import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

const editorSource=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
const ormSource=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');

test('v1.1.46 Schedule Creator exposes an OSM-engine overlay toggle',()=>{
  assert.match(editorSource,/data-act="engine-osm"/);
  assert.match(editorSource,/◉ OSM moteur/);
  assert.match(editorSource,/_drawEngineOsm\s*\(\s*ctx\s*,\s*w\s*,\s*h\s*\)/);
  assert.match(editorSource,/OSM moteur activé/);
});

test('v1.1.46 engine overlay is detail-only and cannot redraw continent-wide rail',()=>{
  assert.match(editorSource,/zoomLevel\s*\|\|\s*0\)\s*<\s*11/);
  assert.match(editorSource,/getLoadedRailwaysInBounds\s*\(\s*b\.south\s*,\s*b\.west\s*,\s*b\.north\s*,\s*b\.east\s*,\s*\{\s*limit\s*:\s*16000\s*\}\s*\)/);
  assert.doesNotMatch(editorSource,/_ensureGraph\(\).*_drawEngineOsm/s);
});

test('v1.1.46 resident OSM viewport lookup uses bbox tiles and only a bounded _ways fallback',()=>{
  assert.match(ormSource,/getLoadedRailwaysInBounds/);
  assert.match(ormSource,/for \(const box of this\._loadedBboxes \|\| \[\]\)/);
  const method=ormSource.slice(ormSource.indexOf('getLoadedRailwaysInBounds'),ormSource.indexOf('// Small, resilient viewport fetch'));
  assert.match(method,/this\._ways\.size <= fallbackScanLimit/);
});

test('v1.1.46 resident viewport lookup filters and deduplicates exact OSM ways',()=>{
  const orm=new ORMClient();
  const a={id:101,geometry:[{lat:49.040,lon:3.405},{lat:49.041,lon:3.410}],service:'',tags:{railway:'rail'}};
  const b={id:102,geometry:[{lat:49.050,lon:3.450},{lat:49.051,lon:3.455}],service:'siding',tags:{railway:'rail',service:'siding'}};
  orm.areaCache.set('tile-a',[a,b]);
  orm.areaCache.set('tile-b',[a]);
  orm._loadedBboxes=[
    {key:'tile-a',south:49.0,west:3.35,north:49.10,east:3.50},
    {key:'tile-b',south:49.0,west:3.35,north:49.10,east:3.50},
  ];
  const hit=orm.getLoadedRailwaysInBounds(49.035,3.400,49.045,3.420);
  assert.deepEqual(hit.map(w=>w.id),[101]);
});

test('v1.1.46 viewport fetch is resilient and explicitly partial-safe',()=>{
  assert.match(ormSource,/async fetchRailwayViewport/);
  assert.match(ormSource,/allowPartial\s*:\s*true/);
  assert.match(ormSource,/concurrency\s*:\s*2/);
  assert.match(ormSource,/attemptsPerEndpoint\s*:\s*1/);
});

test('v1.1.46 manual trace asks for engine OSM refresh',()=>{
  const start=editorSource.indexOf('toggleManualTrace() {');
  const tail=editorSource.slice(start,start+3500);
  assert.match(tail,/_queueVisibleEngineOsm\s*\(\s*true\s*\)/);
});
