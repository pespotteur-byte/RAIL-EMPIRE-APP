import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleVersion, ScheduledLocation, TrackBinding, RouteConstraint } from '../schedule-v2-model.js';

test('HOTFIX4 can arm a VIA explicitly between two already-existing stops without removing either stop',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const locations=[{id:'a',name:'Paris'},{id:'b',name:'Dijon'},{id:'c',name:'Lyon'}];
  let hint='';
  ed._activeVersion=()=>({locations});
  ed._updateManualTraceButton=()=>{};
  ed._setHint=(text)=>{hint=String(text||'');};
  ed._viaNext=true;ed._technicalNext=true;ed._constraintEdit={id:'old'};ed._manualTraceMode=true;ed._manualTraceLegIndex=0;
  ed.prepareViaForLeg(1);
  assert.equal(ed._forcedConstraintLegIndex,1);
  assert.equal(ed._viaNext,false);
  assert.equal(ed._technicalNext,false);
  assert.equal(ed._constraintEdit,null);
  assert.equal(ed._manualTraceMode,false);
  assert.equal(ed._manualTraceLegIndex,null);
  assert.deepEqual(locations.map(x=>x.name),['Paris','Dijon','Lyon'],'arming a VIA must not mutate stops');
  assert.match(hint,/Dijon → Lyon/);
  assert.match(hint,/arrêts restent en place/);
});

test('HOTFIX4 panel exposes a visible + VIA control for every inter-stop leg',()=>{
  const source=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  assert.match(source,/data-via-between=/);
  assert.match(source,/sv2-leg-edit/);
  assert.match(source,/Ajouter un point de passage entre ces deux arrêts sans supprimer les arrêts/);
  assert.match(source,/prepareViaForLeg\(Number\(el\.dataset\.viaBetween\)\)/);
});


test('HOTFIX4 inserting a VIA on an existing leg reroutes only that leg and reuses untouched downstream legs',async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const track=(wayId,name,lat,lon)=>new TrackBinding({wayId,displayName:name,lat,lon,snapLat:lat,snapLon:lon,osmSnapshot:{wayId,railway:'rail'}});
  const ver=new ScheduleVersion();
  ver.locations=[
    new ScheduledLocation({id:'A',order:0,stationId:'A',name:'A',track:track('WA','1',48.0,2.0),departureSec:8*3600,dwellSec:0}),
    new ScheduledLocation({id:'B',order:1,stationId:'B',name:'B',track:track('WB','1',48.1,2.1),dwellSec:60}),
    new ScheduledLocation({id:'C',order:2,stationId:'C',name:'C',track:track('WC','1',48.2,2.2),dwellSec:60}),
  ];
  const path=ver.outboundPath;
  const via=new RouteConstraint({id:'V',order:0,lat:48.05,lon:2.08,snapLat:48.05,snapLon:2.08,wayId:'WV',legIndex:0,osmSnapshot:{wayId:'WV',railway:'rail'}});
  path.constraints=[via];
  const mkSeg=(wayId,a,b)=>({wayId,from:{lat:a.lat,lon:a.lon},to:{lat:b.lat,lon:b.lon},maxSpeed:120,maxSpeedSource:'OSM',electrified:false,gauge:[1435],distanceKm:1});
  const A={lat:48.0,lon:2.0,wayId:'WA'},B={lat:48.1,lon:2.1,wayId:'WB'},C={lat:48.2,lon:2.2,wayId:'WC'};
  path.legs=[
    {id:'old-ab',fromLocationId:'A',toLocationId:'B',constraintIds:[],routeInputKey:'stale-before-via',routePoints:[A,B],segments:[mkSeg('OLD',A,B)],distanceKm:1},
    {id:'bc',fromLocationId:'B',toLocationId:'C',constraintIds:[],routePoints:[B,C],segments:[mkSeg('BC',B,C)],distanceKm:1},
  ];
  ed._activeVersion=()=>ver;ed._activePath=()=>path;
  // The untouched B→C leg gets its current physical key, therefore it is cacheable.
  path.legs[1].routeInputKey=ed._legRouteInputKey(ver,path,1);
  let calls=0;
  ed.router={
    routeBetweenBindings:async(start,end,constraints)=>{calls++;assert.equal(start.wayId,'WA');assert.equal(end.wayId,'WB');assert.deepEqual(constraints.map(x=>x.id),['V']);const V={lat:48.05,lon:2.08,wayId:'WV'};return {routePoints:[A,V,B],segments:[mkSeg('AB1',A,V),mkSeg('AB2',V,B)],distanceKm:2};},
    snapshotRoute:r=>r,
  };
  ed._routingOptions=()=>({});ed._setHint=()=>{};ed._setActivePreview=()=>{};ed._reportCanProceedToValidation=()=>true;ed._error=e=>{throw e;};
  ed.game={weather:null,orm:{_lastCursorRouteFailure:''}};
  const ok=await ed._recomputeActivePath();
  assert.equal(ok,true);
  assert.equal(calls,1,'only the edited A→B leg should invoke the router');
  assert.equal(path.legs.length,2);
  assert.deepEqual(path.legs[0].constraintIds,['V']);
  assert.equal(path.legs[1].fromLocationId,'B');
  assert.equal(path.legs[1].toLocationId,'C');
  assert.equal(path.legs[1].segments[0].wayId,'BC','untouched B→C geometry must be preserved');
});

test('HOTFIX4 inserted VIA is attached to the chosen existing leg and triggers route recomputation without stop mutation',async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  const locations=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
  const ver={locations};
  const path={constraints:[]};
  let recomputed=0;
  ed._activeVersion=()=>ver;ed._activePath=()=>path;
  ed._exactTrackBinding=async()=>({wayId:'W42',snapLat:48.1,snapLon:2.2,trackRef:'',segmentIndex:0,osmSnapshot:{id:'W42',segmentIndex:0,geometry:[{lat:48.1,lon:2.2},{lat:48.11,lon:2.21}]}});
  ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed._setHint=()=>{};ed.draw=()=>{};ed.renderPanel=()=>{};ed._autosaveSoon=()=>{};
  ed._recomputeActivePath=async()=>{recomputed++;return true;};
  await ed._addConstraint(48.1,2.2,null,1);
  assert.equal(path.constraints.length,1);
  assert.equal(path.constraints[0].legIndex,1,'VIA must belong to B→C, not the last/default leg by accident');
  assert.equal(String(path.constraints[0].wayId),'W42');
  assert.equal(recomputed,1);
  assert.deepEqual(locations.map(x=>x.id),['a','b','c']);
});


test('HOTFIX4 packaged FILE bundle contains long-range routing and inter-stop VIA insertion',()=>{
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(bundle,/FULL-AUDIT-TAXONOMY-CROSSSYSTEM-SC-HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(bundle,/schedule-long-range-windowed/);
  assert.match(bundle,/INSÉRER VIA/);
  assert.match(bundle,/data-via-between/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
