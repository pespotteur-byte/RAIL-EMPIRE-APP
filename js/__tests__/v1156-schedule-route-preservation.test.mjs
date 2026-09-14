import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleVersion, TrainCategory } from '../schedule-v2-model.js';

const source=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');

function makeVersion(){
  return new ScheduleVersion({
    category:TrainCategory.FREIGHT,
    locations:[
      {id:'a',order:0,kind:'STATION',stationId:'A',name:'A',track:{lat:48,snapLat:48,lon:2,snapLon:2,displayName:'1'},departureSec:8*3600},
      {id:'b',order:1,kind:'STATION',stationId:'B',name:'B',track:{lat:48,snapLat:48,lon:2.01,snapLon:2.01,displayName:'1'},arrivalSec:8*3600+600,departureSec:8*3600+600},
    ],
    outboundPath:{
      routePoints:[{lat:48,lon:2,wayId:'w1'},{lat:48,lon:2.01,wayId:'w1'}],
      legs:[{id:'leg-a-b',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:[{lat:48,lon:2,wayId:'w1'},{lat:48,lon:2.01,wayId:'w1'}],segments:[{wayId:'w1',from:{lat:48,lon:2},to:{lat:48,lon:2.01},distanceKm:0.74,maxSpeed:120}],distanceKm:0.74}],
      segments:[{wayId:'w1',from:{lat:48,lon:2},to:{lat:48,lon:2.01},distanceKm:0.74,maxSpeed:120}],
      distanceKm:0.74,
    },
  });
}

function makeEditor(ver,{failure='NETWORK_UNAVAILABLE',code='ORM_NETWORK_UNAVAILABLE'}={}){
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed.game={orm:{_lastCursorRouteFailure:failure},weather:null};
  ed.router={routeBetweenBindings:async()=>{const e=new Error('temporary OSM failure');e.code=code;throw e;}};
  ed._activeVersion=()=>ver;
  ed._activePath=()=>ver.outboundPath;
  ed._setHint=()=>{}; ed._setActivePreview=()=>{}; ed._error=()=>{}; ed.renderPanel=()=>{}; ed.draw=()=>{};
  ed.busy=false;
  return ed;
}

test('v1.1.56 transient OSM failure preserves a previously resolved route for non-topology edits',async()=>{
  const ver=makeVersion();
  const before=JSON.stringify(ver.outboundPath.routePoints);
  const ed=makeEditor(ver);
  await ed._recomputeActivePath({topologyChanged:false});
  assert.equal(JSON.stringify(ver.outboundPath.routePoints),before);
  assert.equal(ver.outboundPath.error,'');
});

test('v1.1.56 topology edit + network failure keeps old geometry only as stale visual reference',async()=>{
  const ver=makeVersion();
  const before=JSON.stringify(ver.outboundPath.routePoints);
  const ed=makeEditor(ver);
  const ok=await ed._recomputeActivePath({topologyChanged:true});
  assert.equal(ok,false);
  assert.equal(JSON.stringify(ver.outboundPath.routePoints),before);
  assert.match(ver.outboundPath.error,/temporary OSM failure/i);
});

test('v1.1.84 real no-path suffix preserves the already resolved real-OSM prefix as partial geometry',async()=>{
  const ver=makeVersion();
  const beforePoints=JSON.stringify(ver.outboundPath.routePoints);
  const beforeLegs=ver.outboundPath.legs.length;
  const beforeDistance=ver.outboundPath.distanceKm;
  const ed=makeEditor(ver,{failure:'NO_CONNECTED_PATH',code:'ORM_NO_CONNECTED_PATH'});
  const ok=await ed._recomputeActivePath({topologyChanged:false});
  assert.equal(ok,false);
  assert.equal(JSON.stringify(ver.outboundPath.routePoints),beforePoints);
  assert.equal(ver.outboundPath.legs.length,beforeLegs);
  assert.equal(ver.outboundPath.distanceKm,beforeDistance);
  assert.match(ver.outboundPath.error,/temporary OSM failure/i);
});

test('v1.1.56 train/performance form edits are explicitly non-topology reroutes',()=>{
  const start=source.indexOf('  _bindPanelEvents(){');
  const end=source.indexOf('\n\n  _setReturnName',start);
  const block=source.slice(start,end);
  assert.match(block,/_recomputeActivePath\(\{topologyChanged:false\}\)/);
});

test('v1.1.56 empty ORM snapshots fail explicitly instead of becoming generic incomplete routes',()=>{
  assert.match(source,/ORM_EMPTY_ROUTE/);
  assert.match(source,/Liaison ORM vide pendant le recalcul/);
});

test('v1.1.56 FILE bundle contains transient-network route preservation logic',()=>{
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  assert.match(bundle,/topologyChanged/);
  assert.match(bundle,/dernier tracé ORM valide conservé/);
  assert.match(bundle,/ancien tracé conservé visuellement/);
  assert.match(bundle,/ORM_EMPTY_ROUTE/);
});
