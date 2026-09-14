import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SchedulePath,ScheduleV2Manager,ScheduledLocation,TrackBinding,TrainCategory,PerformanceProfile} from '../schedule-v2-model.js';
import {recalculateScheduleTiming,physicalTravelSecondsForLeg} from '../schedule-v2-timing.js';
import {ScheduleV2Editor} from '../schedule-v2-editor.js';

function points(n=2000){
  return Array.from({length:n},(_,i)=>({lat:48+i*0.00001,lon:2+i*0.00001,wayId:`w${Math.floor(i/50)}`,maxSpeed:160,maxSpeedSource:'OSM',tags:{}}));
}
function segments(pts){return pts.slice(1).map((p,i)=>({wayId:p.wayId,from:pts[i],to:p,distanceKm:0.0015,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,voltage:[25000],frequency:[50],gauge:[1435],tags:{}}));}

test('HOTFIX8 compact SchedulePath save stores continental geometry once on canonical legs and rebuilds global view',()=>{
  const pts=points(4000),segs=segments(pts);
  const path=new SchedulePath({topologyRevision:1,resolvedRevision:1,distanceKm:600,routePoints:pts,segments:segs,legs:[{id:'L',fromLocationId:'A',toLocationId:'B',routeInputKey:'route-A-B',physicsRouteKey:'phys-A-B',routePoints:pts,segments:segs,distanceKm:600}]});
  const saved=path.toJSON();
  assert.equal(saved.geometryStorage,'LEGS_CANONICAL');
  assert.equal(saved.routePoints.length,0);
  assert.equal(saved.segments.length,0);
  assert.equal(saved.legs[0].routePoints.length,0);
  assert.equal(saved.legs[0].routePointStorage,'SC8P1');
  assert.equal(saved.legs[0].routePacked.count,pts.length);
  assert.equal(saved.legs[0].segments.length,0);
  assert.equal(saved.legs[0].segmentStorage,'DERIVED_FROM_POINTS');
  const restored=new SchedulePath(saved);
  assert.equal(restored.routePoints.length,pts.length);
  assert.equal(restored.segments.length,segs.length);
  assert.equal(restored.legs[0].segments.length,segs.length);
  assert.equal(restored.legs[0].routePoints[123].wayId,pts[123].wayId);
  assert.ok(Math.abs(restored.legs[0].routePoints[123].lat-pts[123].lat)<1e-6);
  assert.equal(restored.legs[0].routeInputKey,'route-A-B');
  assert.equal(restored.legs[0].physicsRouteKey,'phys-A-B');
  const compactBytes=JSON.stringify(saved).length;
  const legacyBytes=JSON.stringify({...saved,routePoints:path.routePoints,segments:path.segments}).length;
  assert.ok(compactBytes<legacyBytes*0.72,`compact=${compactBytes} legacy=${legacyBytes}`);
});

test('HOTFIX8 dwell retiming reuses cached physical travel and does not touch continental geometry again',()=>{
  const pts=points(2500);
  const a=new ScheduledLocation({id:'A',order:0,stationId:'A',name:'A',track:new TrackBinding({lat:48,lon:2,snapLat:48,snapLon:2}),departureSec:8*3600,dwellSec:0});
  const b=new ScheduledLocation({id:'B',order:1,stationId:'B',name:'B',track:new TrackBinding({lat:49,lon:3,snapLat:49,snapLon:3}),dwellSec:300});
  const profile=PerformanceProfile.genericForCategory(TrainCategory.PASSENGER,160);
  const version={locations:[a,b],performanceProfile:profile,outboundPath:{legs:[{id:'L',fromLocationId:'A',toLocationId:'B',routeInputKey:'AB',physicsRouteKey:'AB-r1',routePoints:pts,distanceKm:300}],error:''},normalize(){this.locations.forEach((l,i)=>l.order=i);}};
  recalculateScheduleTiming(version,{firstDepartureSec:8*3600,weather:{current:'clear'}});
  const leg=version.outboundPath.legs[0];
  assert.ok(leg.physicalTravelSec>0);
  assert.match(leg.physicalTravelSignature,/phys9/);
  const original=leg.routePoints;
  leg.routePoints=new Proxy(original,{get(target,prop,recv){if(prop==='length')return target.length;throw new Error(`geometry touched:${String(prop)}`);}});
  b.dwellSec=420;
  assert.doesNotThrow(()=>recalculateScheduleTiming(version,{firstDepartureSec:8*3600,weather:{current:'clear'}}));
  profile.maxSpeed=120;
  assert.throws(()=>recalculateScheduleTiming(version,{firstDepartureSec:8*3600,weather:{current:'clear'}}),/geometry touched/);
});

test('HOTFIX8 stop-field undo snapshot is timing-only and keeps route geometry by identity',()=>{
  const mgr=new ScheduleV2Manager();
  const rec=mgr.createDraft({number:'T8',name:'Opera',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;
  v.locations=[new ScheduledLocation({id:'A',order:0,name:'A',stationId:'A',track:{lat:48,lon:2,snapLat:48,snapLon:2},departureSec:1000,dwellSec:0}),new ScheduledLocation({id:'B',order:1,name:'B',stationId:'B',track:{lat:49,lon:3,snapLat:49,snapLon:3},arrivalSec:2000,departureSec:2300,dwellSec:300})];
  const pts=points(20000);v.outboundPath.routePoints=pts;v.outboundPath.legs=[{id:'L',fromLocationId:'A',toLocationId:'B',routePoints:pts,segments:[],distanceKm:500}];
  const ed=Object.create(ScheduleV2Editor.prototype);Object.assign(ed,{game:{scheduleV2:mgr},record:rec,version:v,mode:'OUTBOUND',history:[],future:[],_pendingRotationScheduleIds:new Set(),renderPanel(){},draw(){},_autosaveSoon(){}});
  ed._snapshotTiming();
  assert.equal(ed.history.length,1);assert.equal(ed.history[0].kind,'TIMING');assert.equal('schedule' in ed.history[0],false);assert.equal(JSON.stringify(ed.history[0]).includes('routePoints'),false);
  const identity=v.outboundPath.routePoints;
  v.locations[1].dwellSec=900;
  assert.equal(ed.undo(),true);
  assert.equal(v.outboundPath.routePoints,identity);
  assert.equal(v.locations[1].dwellSec,300);
});

test('HOTFIX8 editor drawing streams Canvas path without temporary pts array',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const drawRouteAt=src.search(/_drawRoute\s*\(ctx\s*,\s*route/);
  const drawPathAt=src.search(/_drawPath\s*\(ctx\s*,\s*path/);
  assert.ok(drawRouteAt>=0 && drawPathAt>drawRouteAt,'draw-route block must exist');
  const block=src.slice(drawRouteAt,drawPathAt);
  assert.doesNotMatch(block,/const\s+pts\s*=\s*\[\]/);
  assert.match(block,/ctx\.beginPath\(\)/);
});

test('HOTFIX8 V2 runtime shares canonical leg route arrays instead of cloning every OSM point',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-runtime.js',import.meta.url),'utf8');
  assert.match(src,/routes\.push\(leg\.routePoints\)/);
  assert.doesNotMatch(src,/routes\.push\(leg\.routePoints\.map\(p=>\(\{\.\.\.p\}\)\)\)/);
});

test('HOTFIX8 continental path shares global object graph with canonical legs after 12k points',async()=>{
  const {assignResolvedLegsToPath}=await import('../schedule-v2-model.js');
  const pts=points(13050),segs=segments(pts);
  const path=new SchedulePath({topologyRevision:1,resolvedRevision:0});
  assignResolvedLegsToPath(path,[{id:'L',fromLocationId:'A',toLocationId:'B',routePoints:pts,segments:segs,distanceKm:900}],{resolvedRevision:1});
  assert.equal(path.globalGeometryShared,true);
  assert.strictEqual(path.routePoints[100],path.legs[0].routePoints[100]);
  assert.strictEqual(path.segments[100],path.legs[0].segments[100]);
  const saved=path.toJSON();assert.equal(saved.routePoints.length,0);assert.equal(saved.segments.length,0);
  const restored=new SchedulePath(saved);assert.equal(restored.globalGeometryShared,true);assert.strictEqual(restored.routePoints[100],restored.legs[0].routePoints[100]);
});

test('HOTFIX8 timetable physics caps continental cell count and skips unused segment-time array',()=>{
  const timing=fs.readFileSync(new URL('../schedule-v2-timing.js',import.meta.url),'utf8');
  const physics=fs.readFileSync(new URL('../train-physics.js',import.meta.url),'utf8');
  assert.match(timing,/totalM\s*\/\s*45000/);
  assert.match(timing,/collectSegmentTimes\s*:\s*false/);
  assert.match(physics,/params\.collectSegmentTimes\s*!==\s*false/);
});


test('HOTFIX8 game autosave is single-flight so repeated timetable edits cannot stack whole-state worker clones',()=>{
  const src=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const saveNowAt=src.search(/_saveStateNow\s*\(options\s*=\s*null\)/);
  const saveStateAt=src.search(/\nsaveState\s*\(options\s*=\s*null\)|\n\s*saveState\s*\(options\s*=\s*null\)/);
  assert.ok(saveNowAt>=0 && saveStateAt>saveNowAt,'save-state block must exist');
  const block=src.slice(saveNowAt,saveStateAt);
  assert.match(block,/if \(this\._saveWritePromise\)/);
  assert.match(block,/this\._saveAfterWrite = true/);
  assert.match(block,/this\._saveWritePromise = writePromise/);
  assert.match(block,/this\.saveState\(\{\s*lowMemory\s*:\s*followLow\s*,\s*routePointCount\s*:\s*followPoints\s*\}\)/);
});

test('HOTFIX8 autosave marks continental schedules low-memory and main game does not retain the full save snapshot',()=>{
  const editor=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(editor,/saveState\?\.\(\{\s*lowMemory\s*,\s*routePointCount\s*\}\)/);
  assert.match(main,/this\._saveLowMemoryPending/);
  assert.match(main,/const saveMeta\s*=\s*\{\s*saveTime\s*:\s*state\.saveTime\s*,\s*lowMemory\s*\}/);
  assert.match(main,/return saveMeta;/);
  assert.doesNotMatch(main,/this\._lastSaveState\s*=\s*state/);
});

// RC13 deliberately changes the old *raw JSON* requirement: retain the no-worker-copy
// safety property, but compress low-memory saves instead of enforcing quota exhaustion.
test('HOTFIX8 / RC13 large save avoids worker copy while retaining binary compression',async()=>{
  const {installIDB,openDB,get}=await import('../../scripts/test-idb-harness.mjs');
  installIDB();let workerCalls=0;globalThis.Worker=class{constructor(){workerCalls++;throw new Error('must not clone');}};
  try {
    const {GameStorage}=await import('../storage.js?hotfix8-rc13');const storage=new GameStorage();await storage._ready;
    const path=new SchedulePath({topologyRevision:1,resolvedRevision:1,distanceKm:600,legs:[{id:'L',fromLocationId:'A',toLocationId:'B',routePoints:points(13001),distanceKm:600}]});
    const state={scheduleV2:{schedules:[{versions:[{outboundPath:path.toJSON()}]}]}};
    assert.equal(await storage.saveGame(state),true);assert.equal(workerCalls,0);
    const db=await openDB('rail-empire-save-db','saves');const row=await get(db,'saves','main');
    assert.ok(row.stored instanceof Blob);assert.equal(row.codec,'RE13/gzip');
    assert.ok(row.stored.size<new Blob([JSON.stringify(state)]).size);
    assert.deepEqual(await storage.loadGame(),state);
  } finally {delete globalThis.Worker;}
});
