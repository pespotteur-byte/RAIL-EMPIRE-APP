import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Editor } from '../schedule-v2-editor.js?v=1134';
import { World } from '../world.js?v=1134';

function makeStations(n=17817){
  return Array.from({length:n},(_,i)=>({id:`st-${i}`,name:`Station ${i}`,lat:48,lon:2,platforms:2,type:'voyageur'}));
}

test('v1.1.34: startup waits for full European gameplay-station bootstrap', () => {
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(index,/data\/railnet\/stations\/manifest\.js/);
  assert.match(main,/await this\._ensureAllZoomGameplayStations\(\)/);
  assert.match(main,/this\._ensureAllZoomGameplayStations\(\)\.catch/);
  assert.match(main,/world\.setBuiltInGameplayStationsAsync\(stations/);
  assert.doesNotMatch(main,/zoomez à 10\+ pour charger le réseau et les gares jouables/);
});

test('v1.1.34: Schedule Creator draws every gameplay station at minimum zoom', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  const stations=makeStations();
  editor.game={world:{stations}};
  editor.tileMap={zoomLevel:5,latLonToPixel(){return {x:500,y:300};},screenToWorld(){throw new Error('minimum zoom must not spatial-query away stations');}};
  const calls={fillRect:0,arc:0,fillText:0};
  const ctx={fillStyle:'',strokeStyle:'',lineWidth:1,font:'',shadowColor:'',shadowBlur:0,save(){},restore(){},beginPath(){},arc(){calls.arc++;},fill(){},stroke(){},fillRect(){calls.fillRect++;},fillText(){calls.fillText++;}};
  editor._drawStations(ctx,1000,600);
  assert.equal(calls.fillRect,17817);
  assert.equal(calls.arc,0);
  assert.equal(calls.fillText,0);
});

test('v1.1.34: Schedule Creator preserves Livemap zoom 5', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  editor.game={renderer:{tileMap:{centerLat:49.05,centerLon:3.52,zoomLevel:5}}};
  editor.tileMap={centerLat:0,centerLon:0,zoomLevel:9,minZoom:5,maxZoom:20,markDirty(){}};
  assert.equal(editor._adoptMainViewport(),true);
  assert.equal(editor.tileMap.zoomLevel,5);
  assert.equal(editor.tileMap.centerLat,49.05);
  assert.equal(editor.tileMap.centerLon,3.52);
});

test('v1.1.34: local OSM enrichment does not duplicate an existing bootstrap station', async () => {
  const w=new World();
  await w.setBuiltInGameplayStationsAsync([{id:'tl-1',name:'Dormans',lat:49.077,lon:3.638,uicRef:'8711652'}]);
  const before=w.stations.length;
  const res=await w.mergeNativeOSMGameplayStationsAsync([{id:'osm-node-99',osmType:'node',osmId:99,name:'Dormans',lat:49.07705,lon:3.63802,uicRef:'8711652'}]);
  assert.equal(w.stations.length,before);
  assert.equal(res.added,0);
  assert.equal(res.enriched,1);
  assert.equal(w.getStationById('tl-1').osmNativeId,'osm-node-99');
});
