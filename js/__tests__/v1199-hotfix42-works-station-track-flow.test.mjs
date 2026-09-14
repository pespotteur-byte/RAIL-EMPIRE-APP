import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorksV2Editor } from '../works-v2-editor.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';
import { WorksManager } from '../works.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

test('HOTFIX42 Works V2 authors a section as station A -> track A -> station B -> track B',()=>{
  const src=fs.readFileSync(path.join(root,'js','works-v2-editor.js'),'utf8');
  assert.match(src,/mode\s*=\s*'station-start'/);
  assert.match(src,/mode\s*=\s*start\s*\?\s*'track-start'\s*:\s*'track-end'/);
  assert.match(src,/mode\s*=\s*'station-end'/);
  assert.match(src,/Travaux entre \$\{a\} et \$\{b\}/);
  assert.match(src,/prefetchRailNetworkNearStation/);
});

test('HOTFIX42 station selection preloads the same local RailGraph used by Schedule Creator before track picking',async()=>{
  const calls=[];
  const ed=Object.create(WorksV2Editor.prototype);
  ed.zones=[{id:'z',name:'Section 1',autoName:true,startStation:null,endStation:null,startBinding:null,endBinding:null,constraints:[],route:[],segments:[],distanceKm:0,error:''}];
  ed.activeZoneId='z';
  ed.game={world:{prefetchRailNetworkNearStation:async(st,r)=>calls.push([st.id,r])}};
  ed.tileMap={centerLat:0,centerLon:0,zoomLevel:9,markDirty(){}};
  ed._setStatus=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._queueVisibleEngineOsm=()=>{};
  const st={id:'A',name:'Alpha',lat:48,lon:2};
  await ed._selectEndpointStation(st,'start');
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'A');
  assert.equal(calls[0][1],0.8);
  assert.equal(ed.mode,'track-start');
  assert.equal(ed.zones[0].startStation.name,'Alpha');
  assert.equal(ed.tileMap.zoomLevel,17);
});

test('HOTFIX42 exact micro-section on the same OSM way can be resolved locally even at about 10 metres',async()=>{
  const geom=[{lat:48,lon:2},{lat:48,lon:2.0002}];
  const z={
    startStation:{id:'A',name:'Alpha',lat:48,lon:2},endStation:{id:'B',name:'Beta',lat:48,lon:2.00013},constraints:[],
    startBinding:{wayId:'42',trackRef:'1',snapLat:48,snapLon:2,segmentIndex:0,osmSnapshot:{geometry:geom,maxSpeed:80,trackRef:'1'}},
    endBinding:{wayId:'42',trackRef:'1',snapLat:48,snapLon:2.00013,segmentIndex:0,osmSnapshot:{geometry:geom,maxSpeed:80,trackRef:'1'}},
    route:[],segments:[],distanceKm:0,error:''
  };
  const ed=Object.create(WorksV2Editor.prototype);
  ed.game={world:{prefetchRailNetworkNearStation:async()=>true}};
  ed.router=new ScheduleV2Router({});
  ed.router.routeBetweenBindings=async()=>{throw new Error('full router must not be needed for this same-way micro section');};
  ed._setStatus=()=>{};ed.draw=()=>{};ed._queueVisibleEngineOsm=()=>{};ed._routeAbortController=null;ed._engineOsmRenderCache={key:'',ways:[],switches:[]};
  const ok=await ed._recompute(z);
  assert.equal(ok,true);
  assert.ok(z.route.length>=2);
  assert.ok(z.distanceKm>0 && z.distanceKm<0.03,`distance=${z.distanceKm}`);
  assert.equal(z.segments[0].wayId,'42');
});


test('HOTFIX42 Works save/load keeps station A/B identity and human-readable labels',()=>{
  const m=new WorksManager();
  m.add({name:'RVB',startDate:'2026-09-01',endDate:'2026-09-01',startTime:'00:00',endTime:'23:59',recurrence:'once',zones:[{
    name:'Travaux entre Alpha et Beta',startStation:{id:'A',name:'Alpha',lat:48,lon:2},endStation:{id:'B',name:'Beta',lat:48.001,lon:2.001},
    startBinding:{wayId:'42',lat:48,lon:2,snapLat:48,snapLon:2},endBinding:{wayId:'42',lat:48.001,lon:2.001,snapLat:48.001,snapLon:2.001},
    route:[{lat:48,lon:2,wayId:'42'},{lat:48.001,lon:2.001,wayId:'42'}],segments:[{wayId:'42'}],distanceKm:.13,impact:'slow',speedLimit:60,direction:'both'
  }]});
  const m2=new WorksManager();m2.loadFromSave(m.toSave());const z=m2.getAll()[0].zones[0];
  assert.equal(z.startStation.name,'Alpha');assert.equal(z.endStation.name,'Beta');
  assert.equal(z.stationA,'Alpha');assert.equal(z.stationB,'Beta');
});

test('HOTFIX42 FILE bundle/cache contains station->track Works flow and micro-section fix',()=>{
  const bundle=fs.readFileSync(path.join(root,'js','rail-empire.file.bundle.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(bundle,/Travaux entre/);
  assert.match(bundle,/prefetchRailNetworkNearStation/);
  assert.match(bundle,/station-start/);
  assert.match(bundle,/sameWayMicroRoute/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
