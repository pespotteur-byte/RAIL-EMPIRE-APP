import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import {
  ScheduleV2Manager, ScheduleVersion, ScheduleRecord, ScheduleState,
  OperatingCalendar, RoundTripGroup, assignResolvedLegsToPath,
} from '../schedule-v2-model.js';
import { RotationV2Manager, Rotation } from '../rotation-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';
import { ScheduleV2Revalidator } from '../schedule-v2-revalidation.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

function point(lat,lon,wayId='W'){ return {lat,lon,wayId,maxSpeed:160,maxSpeedSource:'OSM'}; }
function geoKm(a,b){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function seg(a,b,wayId='W',extra={}){return {wayId,from:{lat:a.lat,lon:a.lon},to:{lat:b.lat,lon:b.lon},distanceKm:geoKm(a,b),maxSpeed:160,maxSpeedSource:'OSM',gauge:[1435],...extra};}
function modernVersion(){
  const a=point(49,8,'A'),m=point(49.01,8,'M'),b=point(49.02,8,'B');
  const s1=seg(a,m,'A'),s2=seg(m,b,'B');
  const d1=s1.distanceKm,d2=s2.distanceKm;
  return new ScheduleVersion({
    id:'VER',state:ScheduleState.VALID,category:'PASSENGER',
    performanceProfile:{maxSpeed:160,massKg:300000,powerW:4000000,lengthM:180,gauges:[1435]},
    locations:[
      {id:'LA',order:0,stationId:'SA',name:'A',track:{wayId:'A',displayName:'1',lat:a.lat,lon:a.lon,snapLat:a.lat,snapLon:a.lon},departureSec:8*3600,dwellSec:0},
      {id:'LB',order:1,stationId:'SB',name:'B',track:{wayId:'B',displayName:'2',lat:b.lat,lon:b.lon,snapLat:b.lat,snapLon:b.lon},arrivalSec:8*3600+600,departureSec:8*3600+900,dwellSec:300},
    ],
    outboundPath:{topologyRevision:1,resolvedRevision:1,error:'',constraints:[],
      legs:[{id:'LEG',fromLocationId:'LA',toLocationId:'LB',constraintIds:[],routePoints:[a,m,b],segments:[s1,s2],distanceKm:d1+d2}],
      routePoints:[a,m,b],segments:[s1,s2],distanceKm:d1+d2}
  });
}
function codes(report){return new Set((report?.issues||[]).map(x=>x.code));}

// Architecture / boot contracts ------------------------------------------------
test('v1.1.86 boot never automatically revalidates schedules over ORM',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/scheduleV2Revalidator\?\.run\?\./);
  assert.doesNotMatch(main,/scheduleV2Revalidator\?\.run\s*\(/);
});

test('v1.1.86 topology streaming clears transient caches but preserves saved Schedule route memory',()=>{
  const orm=new ORMClient();
  const anchors=[{lat:49,lon:8,wayId:'A'},{lat:49.01,lon:8,wayId:'B'}];
  const route=[point(49,8,'A'),point(49.01,8,'B')];
  orm.rememberCursorRoute(anchors,route,{maxSpeed:160});
  orm.routeCache.set('x',[1]); orm._scheduleExactLegCache.set('y',{route:[1],at:Date.now()});
  orm._touchTopology();
  assert.equal(orm.routeCache.size,0);
  assert.equal(orm._scheduleExactLegCache.size,0);
  assert.ok(orm.recallCursorRoute(anchors,{maxSpeed:160})?.length===2);
});

// Exact track picker -----------------------------------------------------------
test('v1.1.86 incomplete resident + incomplete OSM-main cannot steal a parallel click from exact Overpass way',async()=>{
  const orm=new ORMClient(); const lat=49.5,rightLon=8.7,leftLon=rightLon-0.000055;
  const mk=(id,lon)=>({id,geometry:[{lat:lat-.001,lon},{lat:lat+.001,lon}],nodeIds:[id+'0',id+'1'],maxSpeed:160,maxSpeedSource:'OSM',gauge:[1435],tags:{railway:'rail'},railway:'rail',service:'',usage:'main'});
  const left=mk('LEFT',leftLon),right=mk('RIGHT',rightLon);
  orm.getLoadedRailwaysInBounds=()=>[left];
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[left]}); // API map bbox can be incomplete for a long through-way.
  orm.fetchArea=async()=>({ok:true,ways:[right]});
  const cs=await orm.getTrackCandidates(lat,rightLon,{radiusM:20,limit:8});
  assert.equal(cs[0]?.wayId,'RIGHT');
  assert.ok(cs[0]?.distanceM<0.5);
});

test('v1.1.86 AbortSignal reaches railway tile network work',async()=>{
  const orm=new ORMClient(); let seenSignal=null;
  orm.fetchArea=async(_s,_w,_n,_e,opts)=>{seenSignal=opts.signal; await new Promise((resolve,reject)=>{
    if(opts.signal?.aborted){const e=new Error('aborted');e.name='AbortError';return reject(e);}
    opts.signal?.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);},{once:true});
    setTimeout(resolve,5000);
  }); return {ok:true,ways:[]};};
  const ac=new AbortController();
  const p=orm._fetchRailTileResilient({south:49,west:8,north:49.01,east:8.01},0,{timeoutMs:5000,maxSplitDepth:0,maxEndpoints:1,signal:ac.signal});
  setTimeout(()=>ac.abort(),20);
  await assert.rejects(p,e=>e?.name==='AbortError');
  assert.equal(seenSignal,ac.signal);
});

// Canonical path / validation --------------------------------------------------
test('v1.1.86 canonical assembler makes map points, segments and kilometres one source of truth',()=>{
  const v=modernVersion(),p=v.outboundPath,leg=p.legs[0];
  p.routePoints=[];p.segments=[];p.distanceKm=999;
  assignResolvedLegsToPath(p,[leg],{resolvedRevision:p.topologyRevision,error:''});
  assert.equal(p.routePoints.length,3);assert.equal(p.segments.length,2);
  assert.ok(Math.abs(p.distanceKm-(leg.segments[0].distanceKm+leg.segments[1].distanceKm))<0.005);
  assert.equal(validateScheduleVersion(v,{ormAvailable:true}).canValidate,true);
});

test('v1.1.86 modern validation rejects missing segment, wrong endpoint and wrong kilometre counter',()=>{
  const missing=modernVersion(); missing.outboundPath.legs[0].segments.pop(); missing.outboundPath.segments.pop();
  assert.ok(codes(validateScheduleVersion(missing)).has('LEG_SEGMENT_COUNT_MISMATCH'));

  const endpoint=modernVersion(); endpoint.outboundPath.legs[0].segments[0].to={lat:48,lon:7}; endpoint.outboundPath.segments[0].to={lat:48,lon:7};
  assert.ok(codes(validateScheduleVersion(endpoint)).has('LEG_SEGMENT_ENDPOINT_MISMATCH'));

  const distance=modernVersion(); distance.outboundPath.distanceKm+=10;
  assert.ok(codes(validateScheduleVersion(distance)).has('PATH_DISTANCE_MISMATCH'));
});

test('v1.1.86 FALLBACK_30 is an UNKNOWN metadata warning, not an error and its geometry still validates',()=>{
  const v=modernVersion();
  for(const s of v.outboundPath.segments){s.maxSpeedSource='FALLBACK_30';s.maxSpeed=30;}
  for(const s of v.outboundPath.legs[0].segments){s.maxSpeedSource='FALLBACK_30';s.maxSpeed=30;}
  const r=validateScheduleVersion(v,{ormAvailable:true});
  assert.equal(r.errors.some(x=>x.code==='VMAX_UNKNOWN'),false);
  assert.equal(r.unknowns.some(x=>x.code==='VMAX_UNKNOWN'),true);
  assert.equal(r.canValidate,true);
});

// Editor avoids needless ORM reroute ------------------------------------------
test('v1.1.86 recomputeBoth retimes a structurally current route without calling ORM router',async()=>{
  const v=modernVersion();
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed.mode='OUTBOUND';ed.returnVersion=null;ed.game={weather:null};ed.renderPanel=()=>{};
  ed._activeVersion=()=>v;ed._activePath=()=>v.outboundPath;ed._constraintsForLeg=()=>[];
  // RC3: current geometry also carries proof of its physical routing inputs.
  v.outboundPath.legs.forEach((leg,i)=>{leg.routeInputKey=ed._legRouteInputKey(v,v.outboundPath,i);});
  let reroutes=0;ed._recomputeActivePath=async()=>{reroutes++;return true;};
  const ok=await ed._recomputeBoth();
  assert.equal(ok,true);assert.equal(reroutes,0);
});

// Editor state transactions ---------------------------------------------------
test('v1.1.86 failed undo leaves history/future stacks untouched',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);ed.history=[{id:'target'}];ed.future=[{id:'future'}];
  ed._currentUndoSnapshot=()=>({id:'current'});ed._restoreSnapshot=()=>false;
  assert.equal(ed.undo(),false);assert.deepEqual(ed.history,[{id:'target'}]);assert.deepEqual(ed.future,[{id:'future'}]);
});

test('v1.1.86 recomputeBoth always restores editor direction after exception',async()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);ed.mode='RETURN';ed.returnVersion={};ed.renderPanel=()=>{};ed._error=()=>{};
  ed._ensureActivePathReady=async()=>{throw new Error('boom');};
  assert.equal(await ed._recomputeBoth(),false);assert.equal(ed.mode,'RETURN');
});

// Transactional persistence ---------------------------------------------------
test('v1.1.86 invalid Schedule save cannot erase current live schedules',()=>{
  const mgr=new ScheduleV2Manager();const live=mgr.createDraft({number:'100'});const before=mgr.toSave();
  const bad=structuredClone(before);bad.schedules[0].currentVersionId='DEAD_VERSION';
  assert.equal(mgr.loadFromSave(bad),false);
  assert.equal(mgr.schedules.length,1);assert.equal(mgr.schedules[0].id,live.id);assert.equal(mgr.schedules[0].number,'100');
});

test('v1.1.86 invalid Rotation save cannot erase current live rotations',()=>{
  const mgr=new RotationV2Manager(new ScheduleV2Manager());mgr.rotations.push(new Rotation({id:'LIVE',name:'Live'}));
  const bad={schemaVersion:2,vehicles:[{id:'DUP',number:'1'},{id:'DUP',number:'2'}],coupons:[],rotations:[],directAssignments:[]};
  assert.equal(mgr.loadFromSave(bad),false);
  assert.equal(mgr.rotations.length,1);assert.equal(mgr.rotations[0].id,'LIVE');
});

test('v1.1.86 failed frequency generation rolls back every partial copy',()=>{
  const mgr=new ScheduleV2Manager();const src=mgr.createDraft({number:'100'});
  const before=JSON.stringify(mgr.toSave());const real=mgr.duplicateSchedule.bind(mgr);let calls=0;
  mgr.duplicateSchedule=(...args)=>{calls++;if(calls===2)throw new Error('copy failure');return real(...args);};
  assert.throws(()=>mgr.duplicateScheduleFrequency(src.id,{intervalSec:300,totalCount:3}),/copy failure/);
  assert.equal(JSON.stringify(mgr.toSave()),before);
});

test('v1.1.86 failed round-trip generation is atomic',()=>{
  const mgr=new ScheduleV2Manager();const out=mgr.createDraft({number:'100'}),ret=mgr.createDraft({number:'101'});
  out.currentVersion.locations=[
    {id:'OA',order:0,stationId:'A',name:'A',track:{wayId:'A',displayName:'1',lat:49,lon:8},departureSec:1000,dwellSec:0},
    {id:'OB',order:1,stationId:'B',name:'B',track:{wayId:'B',displayName:'1',lat:49.1,lon:8},arrivalSec:2000,departureSec:2000,dwellSec:0},
  ].map(x=>new (modernVersion().locations[0].constructor)(x));
  ret.currentVersion.locations=[
    {id:'RB',order:0,stationId:'B',name:'B',track:{wayId:'B',displayName:'1',lat:49.1,lon:8},departureSec:2400,dwellSec:0},
    {id:'RA',order:1,stationId:'A',name:'A',track:{wayId:'A',displayName:'1',lat:49,lon:8},arrivalSec:3400,departureSec:3400,dwellSec:0},
  ].map(x=>new (modernVersion().locations[0].constructor)(x));
  const group=mgr.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:300});
  const before=JSON.stringify(mgr.toSave());const real=mgr.duplicateSchedule.bind(mgr);let calls=0;
  mgr.duplicateSchedule=(...args)=>{calls++;if(calls===2)throw new Error('return copy failure');return real(...args);};
  assert.throws(()=>mgr.duplicateRoundTrip(group.id,{intervalSec:3600,horizonSec:3600}),/return copy failure/);
  assert.equal(JSON.stringify(mgr.toSave()),before);
});

test('v1.1.86 Rotation load migration failure cannot replace live state',()=>{
  const sm=new ScheduleV2Manager(),mgr=new RotationV2Manager(sm);mgr.rotations.push(new Rotation({id:'LIVE',name:'Live'}));
  const data={schemaVersion:2,vehicles:[],coupons:[],directAssignments:[],rotations:[{id:'NEW',name:'New',occurrences:[{id:'O',scheduleId:'S',versionId:'V',dateOffsetDays:1}]}]};
  mgr._canonicalizeOccurrenceDayOffset=()=>{throw new Error('migration failure');};
  assert.equal(mgr.loadFromSave(data),false);assert.equal(mgr.rotations.length,1);assert.equal(mgr.rotations[0].id,'LIVE');
});

// Cascading model edits -------------------------------------------------------
test('v1.1.86 deleting a technical stop remaps VIA legs and marks preserved geometry stale',()=>{
  const mgr=new ScheduleV2Manager();const rec=mgr.createDraft({number:'1'}),v=rec.currentVersion;
  const Loc=modernVersion().locations[0].constructor;
  v.locations=[
    new Loc({id:'A',order:0,stationId:'A',name:'A',track:{wayId:'A',displayName:'1',lat:49,lon:8}}),
    new Loc({id:'T',order:1,kind:'TECHNICAL',technicalLocationId:'TECH',name:'T',track:{wayId:'T',displayName:'T',lat:49.01,lon:8}}),
    new Loc({id:'B',order:2,stationId:'B',name:'B',track:{wayId:'B',displayName:'1',lat:49.02,lon:8}}),
  ];
  const C=(new ScheduleVersion()).outboundPath.constraints.constructor; // keep test independent of private helpers
  v.outboundPath.constraints=[{id:'V0',order:0,legIndex:0,lat:49.005,lon:8,wayId:'X'},{id:'V1',order:1,legIndex:1,lat:49.015,lon:8,wayId:'Y'}].map(x=>({ ...x }));
  v.outboundPath.topologyRevision=5;v.outboundPath.resolvedRevision=5;v.state=ScheduleState.VALID;
  mgr.technicalLocations.push({id:'TECH',name:'T'});
  const res=mgr.removeTechnicalLocation('TECH',{cascade:true});
  assert.equal(res.ok,true);assert.deepEqual(v.locations.map(x=>x.id),['A','B']);
  assert.deepEqual(v.outboundPath.constraints.map(x=>x.legIndex),[0,0]);assert.deepEqual(v.outboundPath.constraints.map(x=>x.id),['V0','V1']);
  assert.equal(v.outboundPath.topologyRevision,6);assert.equal(v.outboundPath.resolvedRevision,5);assert.equal(v.state,ScheduleState.NEEDS_REPAIR);
});

// Transactional revalidation --------------------------------------------------
test('v1.1.86 topology failure during explicit revalidation preserves last known-good live geometry',async()=>{
  const ver=modernVersion(),before=JSON.stringify(ver.outboundPath.toJSON());
  const game={orm:{_lastCursorRouteFailure:'NO_CONNECTED_PATH'},weather:null,scheduleV2:{schedules:[]},rotationV2:{rotations:[]}};
  const rv=new ScheduleV2Revalidator(game);
  rv.router.routeBetweenBindings=async()=>{const e=new Error('no path');e.code='ORM_NO_CONNECTED_PATH';throw e;};
  const res=await rv._rebuildVersion(ver);
  assert.equal(res.ok,false);assert.equal(res.preserved,true);
  assert.equal(JSON.stringify(ver.outboundPath.toJSON()),before);
});

// Calendar references ---------------------------------------------------------
test('v1.1.86 calendar removal detaches schedule/rotation references and recalculates affected rotation once',()=>{
  const sm=new ScheduleV2Manager();const cal=sm.addCalendar({id:'CAL'});const rec=sm.createDraft({number:'1'});rec.currentVersion.calendarIds=[cal.id];rec.currentVersion.state=ScheduleState.VALID;
  const rm=new RotationV2Manager(sm);rm.rotations.push(new Rotation({id:'R1',calendarId:'CAL',occurrences:[{id:'O1',sequence:0,scheduleId:rec.id,versionId:rec.currentVersion.id}]}));
  let recalc=0;rm.recalculateRotation=(id)=>{assert.equal(id,'R1');recalc++;return rm.getRotation(id);};
  const out=sm.removeCalendar('CAL',{rotationManager:rm});
  assert.equal(out.ok,true);assert.deepEqual(rec.currentVersion.calendarIds,[]);assert.equal(rec.currentVersion.state,ScheduleState.NEEDS_REPAIR);assert.equal(rm.rotations[0].calendarId,'');assert.equal(rm.rotations[0].enabled,false);assert.equal(recalc,1);
});

// Interactive exact Schedule routing must not scan historical spatial IndexedDB tiles.
test('v1.1.86 exact Schedule leg skips broad timestamp-ordered persistent scan',async()=>{
  const orm=new ORMClient();
  let persistentScans=0,tileFetches=0;
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._loadPersistentRailwaysInBounds=async()=>{persistentScans++;throw new Error('broad persistent scan must not run');};
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[]});
  const a={lat:49,lon:8,wayId:'W',segmentIndex:0},b={lat:49.02,lon:8,wayId:'W',segmentIndex:0};
  const way={id:'W',geometry:[{lat:49,lon:8},{lat:49.02,lon:8}],nodeIds:['N1','N2'],maxSpeed:160,maxSpeedSource:'OSM',gauge:[1435],tags:{railway:'rail'},railway:'rail',service:'',usage:'main'};
  orm.fetchRailwayTiles=async()=>{tileFetches++;return [way];};
  const route=await orm._findCursorLegLocal(a,b,{_scheduleExact:true,_deadlineTs:Date.now()+10000});
  assert.equal(persistentScans,0);
  assert.ok(tileFetches>=1);
  assert.ok(route?.length>=2);
});

test('v1.1.86 compact exact multi-VIA edit also skips broad persistent history scan',async()=>{
  const orm=new ORMClient();let scans=0,direct=0;
  orm.getLoadedRailwaysInBounds=()=>[];orm._loadPersistentRailwaysInBounds=async()=>{scans++;return [];};
  const ways=[
    {id:'A',geometry:[{lat:49,lon:8},{lat:49.01,lon:8}],nodeIds:['N0','N1'],maxSpeed:160,maxSpeedSource:'OSM',railway:'rail',tags:{railway:'rail'}},
    {id:'B',geometry:[{lat:49.01,lon:8},{lat:49.02,lon:8}],nodeIds:['N1','N2'],maxSpeed:160,maxSpeedSource:'OSM',railway:'rail',tags:{railway:'rail'}},
  ];
  orm.fetchSmallOsmMapArea=async()=>{direct++;return {ok:true,ways};};
  const anchors=[{lat:49,lon:8,wayId:'A',segmentIndex:0},{lat:49.01,lon:8,wayId:'A',segmentIndex:0},{lat:49.02,lon:8,wayId:'B',segmentIndex:0}];
  const route=await orm.findRouteViaCursorAnchors(anchors,{allowFallback:false,_deadlineTs:Date.now()+10000});
  assert.equal(scans,0);assert.equal(direct,1);assert.ok(route?.length>=2);
});

// Tile diagnostics are batch-local even when another concurrent batch finishes later.
test('v1.1.86 railway tile fetch returns immutable batch-local diagnostics',async()=>{
  const orm=new ORMClient();
  orm._fetchRailTileResilient=async(tile)=>{
    await new Promise(r=>setTimeout(r,Number(tile.delay||0)));
    if(tile.fail)throw new Error('tile failed');
    return [{id:String(tile.id),geometry:[{lat:49,lon:8},{lat:49.01,lon:8}],nodeIds:['A','B']}];
  };
  const a=orm.fetchRailwayTiles([{id:'A',south:0,west:0,north:1,east:1,delay:20},{id:'X',south:0,west:0,north:1,east:1,fail:true,delay:5}],null,{allowPartial:true,concurrency:2});
  const b=orm.fetchRailwayTiles([{id:'B',south:0,west:0,north:1,east:1,delay:1}],null,{allowPartial:true,concurrency:1});
  const [ra,rb]=await Promise.all([a,b]);
  assert.deepEqual(ra._fetchStats,{requested:2,failed:1,ways:1});
  assert.deepEqual(rb._fetchStats,{requested:1,failed:0,ways:1});
  assert.equal(Object.isFrozen(ra._fetchStats),true);
});

// Journey prefetch must consume its own fetch stats, not a racing global diagnostic.
test('v1.1.86 journey prefetch completeness uses returned batch stats',async()=>{
  const orm=new ORMClient();
  const anchors=[{lat:49,lon:8,wayId:'A'},{lat:50,lon:8.5,wayId:'B'}];
  orm.fetchRailwayTiles=async()=>{
    const out=[{id:'A',geometry:[{lat:49,lon:8},{lat:49.5,lon:8.25}],nodeIds:[1,2]},{id:'B',geometry:[{lat:49.5,lon:8.25},{lat:50,lon:8.5}],nodeIds:[2,3]}];
    Object.defineProperty(out,'_fetchStats',{value:{requested:3,failed:0,ways:2},enumerable:false});
    orm._lastRailTileFetchStats={requested:99,failed:99,ways:0};
    return out;
  };
  const res=await orm.prefetchScheduleJourney(anchors,{_deadlineTs:Date.now()+60000});
  assert.equal(res.complete,true);assert.equal(res.failed,0);
});

// Journey prefetch completeness ----------------------------------------------
test('v1.1.86 incomplete journey prefetch is never reused as trusted complete cache',async()=>{
  const orm=new ORMClient();const anchors=[{lat:49,lon:8,wayId:'A'},{lat:50,lon:8.5,wayId:'B'}];let calls=0;
  orm.fetchRailwayTiles=async()=>{calls++;orm._lastRailTileFetchStats={failed:calls===1?1:0};return [{id:'A',geometry:[{lat:49,lon:8},{lat:49.5,lon:8.25}],nodeIds:[1,2]},{id:'B',geometry:[{lat:49.5,lon:8.25},{lat:50,lon:8.5}],nodeIds:[2,3]}];};
  const first=await orm.prefetchScheduleJourney(anchors,{_deadlineTs:Date.now()+60000});assert.equal(first.complete,false);
  const second=await orm.prefetchScheduleJourney(anchors,{_deadlineTs:Date.now()+60000});
  assert.equal(calls,2,'incomplete cache must trigger a fresh prefetch');assert.equal(second.complete,true);
});


// Runtime save restoration ----------------------------------------------------
test('v1.1.86 malformed runtime save cannot clear live pending snapshots or vehicle busy locks',()=>{
  const vehicle={id:'V1',_v2BusyUntilEpoch:123456};
  const game={rotationV2:{vehicles:[vehicle],getVehicle(id){return id==='V1'?vehicle:null;}},scheduleCreator:{services:[]}};
  const rt=new ScheduleV2Runtime(game);
  rt._pendingSnapshots.set('LIVE',{id:'LIVE',state:'moving'});rt._snapshotCapturedAtUnixSec=42;
  const ok=rt.loadFromSave({schemaVersion:3,capturedAtUnixSec:99,busyVehicles:[{id:'V1',busyUntilEpoch:999}],services:[{id:'DUP'},{id:'DUP'}]});
  assert.equal(ok,false);assert.equal(rt._pendingSnapshots.has('LIVE'),true);assert.equal(rt._snapshotCapturedAtUnixSec,42);assert.equal(vehicle._v2BusyUntilEpoch,123456);
});

test('v1.1.86 valid runtime save commits snapshots and busy locks atomically',()=>{
  const v1={id:'V1',_v2BusyUntilEpoch:111},v2={id:'V2',_v2BusyUntilEpoch:222};
  const vehicles=[v1,v2];const game={rotationV2:{vehicles,getVehicle(id){return vehicles.find(v=>v.id===id)||null;}},scheduleCreator:{services:[]}};
  const rt=new ScheduleV2Runtime(game);rt._pendingSnapshots.set('OLD',{id:'OLD'});
  const ok=rt.loadFromSave({schemaVersion:3,capturedAtUnixSec:100,busyVehicles:[{id:'V2',busyUntilEpoch:999}],services:[{id:'S1',position:{lat:49,lon:8},vehicleIds:[],formationMembers:[]}]});
  assert.equal(ok,true);assert.deepEqual([...rt._pendingSnapshots.keys()],['S1']);assert.equal(rt._snapshotCapturedAtUnixSec,100);assert.equal(v1._v2BusyUntilEpoch,undefined);assert.equal(v2._v2BusyUntilEpoch,999);
});


test('v1.1.86 Schedule V2 forbids a pure same-track back-up inside one leg',async()=>{
  let seen=null;
  const orm={async findRouteViaCursorAnchors(_anchors,opts){seen=opts;return [{lat:49,lon:8,wayId:'W'},{lat:49.01,lon:8,wayId:'W'}];},isFallbackRoute(){return false;},_lastCursorRouteFailure:''};
  const router=new ScheduleV2Router(orm);
  await router.routeBetweenBindings({lat:49,lon:8,wayId:'W'},{lat:49.01,lon:8,wayId:'W'});
  assert.equal(seen.forbidPureBackup,true);
});

test('v1.1.86 a direction reversal between scheduled legs requires TAQ at the intermediate stop',()=>{
  const a=point(49,8,'A'),b=point(49,8.01,'B'),c=point(49,8,'C');const s1=seg(a,b,'A'),s2=seg(b,c,'C');
  const v=new ScheduleVersion({state:ScheduleState.VALID,category:'PASSENGER',performanceProfile:{maxSpeed:160,massKg:200000,powerW:3000000,gauges:[1435]},locations:[
    {id:'A',order:0,stationId:'A',name:'A',track:{wayId:'A',displayName:'1',lat:a.lat,lon:a.lon,snapLat:a.lat,snapLon:a.lon},departureSec:1000},
    {id:'B',order:1,stationId:'B',name:'B',track:{wayId:'B',displayName:'1',lat:b.lat,lon:b.lon,snapLat:b.lat,snapLon:b.lon},arrivalSec:1100,departureSec:1500,dwellSec:400,turnBack:false},
    {id:'C',order:2,stationId:'C',name:'C',track:{wayId:'C',displayName:'1',lat:c.lat,lon:c.lon,snapLat:c.lat,snapLon:c.lon},arrivalSec:1600,departureSec:1700,dwellSec:100}],outboundPath:{topologyRevision:1,resolvedRevision:1,constraints:[],legs:[
      {id:'L1',fromLocationId:'A',toLocationId:'B',constraintIds:[],routePoints:[a,b],segments:[s1],distanceKm:s1.distanceKm},
      {id:'L2',fromLocationId:'B',toLocationId:'C',constraintIds:[],routePoints:[b,c],segments:[s2],distanceKm:s2.distanceKm}],routePoints:[a,b,c],segments:[s1,s2],distanceKm:s1.distanceKm+s2.distanceKm}});
  let report=validateScheduleVersion(v,{ormAvailable:true});assert.ok(codes(report).has('UNPLANNED_TURNBACK'));
  v.locations[1].turnBack=true;report=validateScheduleVersion(v,{ormAvailable:true});assert.equal(codes(report).has('UNPLANNED_TURNBACK'),false);
});

// Long-distance topology healing ---------------------------------------------
function railWay(id,a,b,nodeA,nodeB){
  return {id:String(id),geometry:[{lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon}],nodeIds:[nodeA,nodeB],
    maxSpeed:200,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,electrified:true,electrifiedMode:'contact_line',
    voltage:[15000],frequency:[16.7],gauge:[1435],tracks:2,usage:'main',service:'',railway:'rail',trafficMode:'',preferredDirection:'',
    bidirectional:'regular',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{railway:'rail'}};
}
function longRailChain(count=8){
  const pts=[];for(let i=0;i<=count;i++)pts.push({lat:49+i*(2.7/count),lon:8+i*(1.1/count)});
  const ways=[];for(let i=0;i<count;i++)ways.push(railWay(`L${i}`,pts[i],pts[i+1],`N${i}`,`N${i+1}`));
  return {pts,ways};
}

test('v1.1.86 long route heals one failed middle tile instead of returning false NO_CONNECTED_PATH',async()=>{
  const orm=new ORMClient();const {pts,ways}=longRailChain();let calls=0,repairOptions=null;
  const missing=ways[3];
  orm.fetchRailwayTiles=async(_tiles,_progress,options)=>{
    calls++;
    if(calls===1){
      const out=ways.filter(w=>w!==missing);
      Object.defineProperty(out,'_fetchStats',{value:{requested:8,failed:1,ways:out.length},enumerable:false});
      Object.defineProperty(out,'_fetchFailures',{value:Object.freeze([{tile:{south:50,west:8,north:50.4,east:8.5},code:'NETWORK',message:'busy'}]),enumerable:false});
      return out;
    }
    repairOptions=options;
    const out=[missing];
    Object.defineProperty(out,'_fetchStats',{value:{requested:2,failed:0,ways:1},enumerable:false});
    Object.defineProperty(out,'_fetchFailures',{value:Object.freeze([]),enumerable:false});
    return out;
  };
  const a={...pts[0],wayId:ways[0].id,segmentIndex:0},b={...pts.at(-1),wayId:ways.at(-1).id,segmentIndex:0};
  const route=await orm._findCursorLegLongDistance(a,b,{_deadlineTs:Date.now()+30000,maxSpeed:200});
  assert.ok(route?.length>=ways.length+1,'300 km exact chain must survive a transient missing middle tile');
  assert.equal(calls,2,'failed middle tile should be healed before widening/re-downloading the corridor');
  assert.equal(repairOptions.maxEndpoints,3);assert.equal(repairOptions.raceEndpoints,3);
  assert.equal(orm._lastCursorRouteDiagnostics.successPhase,'hole-heal');
});

test('v1.1.86 railway tile result exposes immutable failed envelopes for targeted healing',async()=>{
  const orm=new ORMClient();
  orm._fetchRailTileResilient=async(tile)=>{if(tile.fail)throw new Error('down');return [railWay('OK',{lat:49,lon:8},{lat:49.01,lon:8},'A','B')];};
  const out=await orm.fetchRailwayTiles([
    {south:49,west:8,north:49.1,east:8.1},
    {south:49.1,west:8,north:49.2,east:8.1,fail:true},
  ],null,{allowPartial:true,concurrency:2});
  assert.equal(out._fetchFailures.length,1);assert.equal(out._fetchFailures[0].tile.fail,true);
  assert.equal(Object.isFrozen(out._fetchFailures),true);assert.equal(Object.isFrozen(out._fetchFailures[0].tile),true);
});

test('v1.1.86 reciprocal aligned 3 m OSM endpoint gap is repaired only in the routing graph',async()=>{
  const orm=new ORMClient();
  const w1=railWay('G1',{lat:49,lon:8},{lat:49.001,lon:8},'A','B');
  const w2=railWay('G2',{lat:49.001027,lon:8},{lat:49.002,lon:8},'C','D'); // ~3 m
  const before=JSON.stringify([w1.geometry,w2.geometry]);
  const route=await orm._routeCursorCandidatesOnWays([w1,w2],{lat:49,lon:8,wayId:'G1',segmentIndex:0},{lat:49.002,lon:8,wayId:'G2',segmentIndex:0},{maxSpeed:160});
  assert.ok(route?.length>=3);assert.ok(route.some(p=>p.topologyStitch==='endpoint-gap-safe')||route.length>=3);
  assert.equal(JSON.stringify([w1.geometry,w2.geometry]),before,'safe gap repair must never mutate OSM geometry');
});

test('v1.1.86 3 m side-by-side parallel tracks are never welded by safe gap rescue',async()=>{
  const orm=new ORMClient();
  const lonGap=0.000041;
  const left=railWay('P1',{lat:49,lon:8},{lat:49.001,lon:8},'A','B');
  const right=railWay('P2',{lat:49,lon:8+lonGap},{lat:49.001,lon:8+lonGap},'C','D');
  const route=await orm._routeCursorCandidatesOnWays([left,right],{lat:49,lon:8,wayId:'P1',segmentIndex:0},{lat:49.001,lon:8+lonGap,wayId:'P2',segmentIndex:0},{maxSpeed:160});
  assert.equal(route,null);
});

test('v1.1.86 incomplete widest long-distance topology is NETWORK_UNAVAILABLE, never false NO_CONNECTED_PATH',async()=>{
  const orm=new ORMClient();const {pts,ways}=longRailChain();
  orm.fetchRailwayTiles=async(tiles)=>{
    const out=[];
    Object.defineProperty(out,'_fetchStats',{value:{requested:tiles.length,failed:tiles.length,ways:0},enumerable:false});
    Object.defineProperty(out,'_fetchFailures',{value:Object.freeze(tiles.map(tile=>({tile:{...tile},code:'NETWORK',message:'down'}))),enumerable:false});
    return out;
  };
  const r=await orm._findCursorLegLongDistance({...pts[0],wayId:ways[0].id,segmentIndex:0},{...pts.at(-1),wayId:ways.at(-1).id,segmentIndex:0},{_deadlineTs:Date.now()+30000});
  assert.equal(r,null);assert.equal(orm._lastCursorRouteFailure,'NETWORK_UNAVAILABLE');
});

test('v1.1.86 incomplete 5 km corridor is NETWORK_UNAVAILABLE, never false NO_CONNECTED_PATH',async()=>{
  const orm=new ORMClient();orm.getLoadedRailwaysInBounds=()=>[];
  orm.fetchRailwayTiles=async(tiles)=>{
    const out=[];Object.defineProperty(out,'_fetchStats',{value:{requested:tiles.length,failed:tiles.length,ways:0},enumerable:false});return out;
  };
  const a={lat:49,lon:8,wayId:'A',segmentIndex:0},b={lat:49.045,lon:8,wayId:'B',segmentIndex:0};
  const r=await orm._findCursorLegLocal(a,b,{_scheduleExact:true,_deadlineTs:Date.now()+10000});
  assert.equal(r,null);assert.equal(orm._lastCursorRouteFailure,'NETWORK_UNAVAILABLE');
});

test('v1.1.86 failed regional broad-area fetch remains a network error',async()=>{
  const orm=new ORMClient();
  orm.fetchArea=async()=>({ok:false,ways:[],error:new Error('overpass down')});
  const r=await orm._findCursorLegBroadArea({lat:49,lon:8,wayId:'A'},{lat:49.4,lon:8.2,wayId:'B'},{_deadlineTs:Date.now()+10000});
  assert.equal(r,null);assert.equal(orm._lastCursorRouteFailure,'NETWORK_UNAVAILABLE');
});
