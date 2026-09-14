import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Editor } from '../schedule-v2-editor.js?v=1133';

test('Schedule V2 streams native OSM stations from its own viewport', async () => {
  const inserted=[]; const platforms=[]; let fetched=null; let draws=0; let hint='';
  const stationMap=new Map();
  const editor=Object.create(ScheduleV2Editor.prototype);
  editor.game={
    orm:{fetchStationsTiled:async(s,w,n,e)=>{fetched={s,w,n,e};return [
      {id:'osm-node-1',name:'Chateau-Thierry',lat:49.046,lon:3.403},
      {id:'osm-node-2',name:'Dormans',lat:49.077,lon:3.638},
    ];}},
    world:{_builtInStationCount:0,async setBuiltInGameplayStationsAsync(rows){for(const r of rows){inserted.push(r);stationMap.set(r.id,{...r,platforms:2});}this._builtInStationCount=stationMap.size;return rows.length;},getStationById:id=>stationMap.get(id)},
    platformManager:{initStation:(id)=>platforms.push(id)},
  };
  editor.version={locations:[]}; editor.returnVersion=null;
  editor.canvas={getBoundingClientRect:()=>({width:1000,height:600})};
  editor.tileMap={zoomLevel:10,screenToWorld:(x,y,w,h)=>x===0?{lat:48.9,lon:3.2}:{lat:49.2,lon:3.8},markDirty(){}};
  editor._stationStreamPromise=null; editor._stationStreamKey=''; editor._stationStreamTimer=0;
  editor.isOpen=()=>true; editor.draw=()=>{draws++;}; editor._setHint=t=>{hint=t;};
  editor._queueVisibleStationStream=()=>{};
  const n=await editor._streamVisibleNativeStations(true);
  assert.equal(n,2);
  assert.ok(fetched && fetched.s < 48.9 && fetched.n > 49.2 && fetched.w < 3.2 && fetched.e > 3.8);
  assert.deepEqual(inserted.map(x=>x.id),['osm-node-1','osm-node-2']);
  assert.deepEqual(platforms,['osm-node-1','osm-node-2']);
  assert.equal(draws,1);
  assert.match(hint,/Gares OSM chargées \(2\)/);
});

test('v1.1.34: fresh Schedule V2 preserves current Livemap location and zoom', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  editor.game={renderer:{tileMap:{centerLat:49.05,centerLon:3.52,zoomLevel:7}}};
  let dirty=0;
  editor.tileMap={centerLat:48.8,centerLon:2.5,zoomLevel:9,markDirty(){dirty++;}};
  assert.equal(editor._adoptMainViewport(),true);
  assert.equal(editor.tileMap.centerLat,49.05);
  assert.equal(editor.tileMap.centerLon,3.52);
  assert.equal(editor.tileMap.zoomLevel,7);
  assert.equal(dirty,1);
});
