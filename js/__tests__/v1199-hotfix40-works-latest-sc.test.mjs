import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorksV2Editor } from '../works-v2-editor.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

test('HOTFIX40 Works V2 uses current SC FUTURE A4.3 map technology instead of stale picker fork',()=>{
  const src=fs.readFileSync(path.join(root,'js','works-v2-editor.js'),'utf8');
  assert.match(src,/ScheduleV2Editor/);
  assert.match(src,/SC FUTURE A4\.3/);
  assert.match(src,/_exactTrackBinding/);
  assert.match(src,/chooseTrackCandidatesAtCursor/);
  assert.match(src,/OSM moteur/);
  assert.match(src,/OSM monde/);
  assert.match(src,/OSM zone/);
  assert.match(src,/wv2-station-search/);
  assert.match(src,/wv2-place-search/);
  assert.match(src,/devicePixelRatio/);
  assert.doesNotMatch(src,/_pickCandidate\(/);
});

test('Works V2 exact track binding is literally delegated to the current Schedule Creator implementation',()=>{
  assert.equal(WorksV2Editor.prototype._exactTrackBinding.toString().includes('ScheduleV2Editor.prototype._exactTrackBinding'),true);
  assert.equal(WorksV2Editor.prototype._drawStations.toString().includes('ScheduleV2Editor.prototype._drawStations'),true);
  assert.equal(WorksV2Editor.prototype._drawEngineOsm.toString().includes('ScheduleV2Editor.prototype._drawEngineOsm'),true);
});

test('Works V2 exact click accepts only vector geometry under the 5 px cursor tolerance',async()=>{
  const ed=Object.create(WorksV2Editor.prototype);
  ed._routeGeneration=0;ed._routeAbortController=null;
  ed.tileMap={
    getPixelsPerKm:()=>1000,
    latLonToPixel:(lat,lon)=>({x:Number(lon)*1000,y:Number(lat)*1000}),
  };
  ed.router={chooseTrackCandidatesAtCursor:async()=>[
    {wayId:'42',trackRef:'1',geometry:[{lat:0,lon:0},{lat:0,lon:.02}],segmentIndex:0,snapLat:0,snapLon:.01},
  ]};
  const hit=await ed._exactTrackBinding(0.003,0.01,''); // 3 px above the vector line
  assert.equal(hit.wayId,'42');
  assert.equal(hit.trackRef,'1');
  await assert.rejects(()=>ed._exactTrackBinding(0.006,0.01,''),/5 px/); // 6 px: current SC refuses it
});
