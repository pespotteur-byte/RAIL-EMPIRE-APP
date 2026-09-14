import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root = process.env.RE_BASE || path.resolve(import.meta.dirname, '../..');
const mod = n => import(pathToFileURL(path.join(root, 'js', n + '.js')));
const {PlatformManager} = await mod('line');
const {VoiePointManager} = await mod('voie-points');
const {ActiveService, ScheduleCreator, cantonManager} = await mod('schedule-creator');
const {ScheduleV2Manager, TrackBinding, ScheduledLocation, ScheduleState, TrainCategory, StopCode} = await mod('schedule-v2-model');
const {RotationV2Manager, FormationRole} = await mod('rotation-v2-model');
const {ScheduleV2Runtime} = await mod('schedule-v2-runtime');
const identity = (id='100', ref='', extra={}) => ({kind:'osm', id, trackRef:ref, lat:48, lon:2, ...extra});
function withGame(game, fn) { const old=globalThis.window; globalThis.window={game}; try { return fn(); } finally { if(old===undefined) delete globalThis.window; else globalThis.window=old; } }
function fixture() {
  for (const key of ['cantons','routeCantons','trainCantons','resourceCantons']) cantonManager[key].clear();
  const world={stations:[{id:'A',name:'A',lat:48,lon:2,platforms:3},{id:'B',name:'B',lat:48.01,lon:2,platforms:3}],tracks:[],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const game={world,platformManager:new PlatformManager(),voiePointManager:new VoiePointManager(),scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1,breakdown:0}};
  return game;
}
function service(game,{id='S',name='Nom libre',way='100',ref='',native='',lat=48,lon=2}={}) {
  const trackIdentity=native ? {...identity(native,ref,{lat,lon}),kind:'native'} : identity(way,ref,{lat,lon});
  const rame={id:'R-'+id,name:'R',maxSpeed:100,totalMass:100,totalPower:2000,totalLength:40,totalCapacity:0,totalFreightCapacity:0,elements:[],elementDetails:[]};
  const s=new ActiveService({id,rameId:rame.id,v2OccurrenceId:'O-'+id,v2RotationId:'ROT-'+id,v2BaseDate:'2026-09-11',stops:[{stationId:'A',type:'arret',departureTime:600,arrivalTime:600,platform:name,voiePointId:native||null,trackIdentity,lat,lon},{stationId:'B',type:'arret',arrivalTime:610,departureTime:610,platform:'B',trackIdentity:identity('200','',{lat:48.01,lon:2}),lat:48.01,lon:2}],routes:[[{lat:48,lon:2,wayId:way,maxSpeed:100,electrified:false},{lat:48.01,lon:2,wayId:'200',maxSpeed:100,electrified:false}]]},rame,game.world,null);
  s.position={lat,lon};s.state='waiting';game.scheduleCreator.services.push(s);return s;
}
function reserve(g,s,index=0){return withGame(g,()=>s._reserveArrivalResources(g.world.stations[index],s.stops[index]));}
function bound(pm,train,id,label,ref=''){return pm.assignPlatform('A',train,3,label,{exactPreferred:true,trackIdentity:identity(id,ref),displayName:label});}

test('RC8-TRACK-01: the same ORM way renamed twice remains one occupied resource',()=>{
 const pm=new PlatformManager();assert.notEqual(bound(pm,'S1','100','Alpha'),null);assert.equal(bound(pm,'S2','100','Beta'),null);assert.equal(pm.getStatus('A').used,1);
});
test('RC8-TRACK-02: distinct ORM ways with the same display name are not the same track',()=>{
 const pm=new PlatformManager();assert.notEqual(bound(pm,'S1','100','Identique'),null);assert.notEqual(bound(pm,'S2','101','Identique'),null);assert.equal(pm.getStatus('A').used,2);
});
test('RC8-TRACK-03: real ORM ref aliases legacy numeric platform occupation',()=>{
 const pm=new PlatformManager();pm.assignPlatform('A','legacy',3,'1',{exactPreferred:true});assert.equal(bound(pm,'new','100','Nom personnel','V1'),null);
});
test('RC8-TRACK-04: legacy request is also blocked after physical reservation',()=>{
 const pm=new PlatformManager();assert.notEqual(bound(pm,'new','100','Nom personnel','V1'),null);assert.equal(pm.assignPlatform('A','legacy',3,1,{exactPreferred:true}),null);
});
test('RC8-TRACK-05: ORM segments split on the same real track ref share their resource',()=>{
 const pm=new PlatformManager();bound(pm,'S1','100','Alpha','1 bis');assert.equal(bound(pm,'S2','101','Beta','1 bis'),null);
});
test('RC8-TRACK-06: a changed real ref does not split a previously registered way',()=>{
 const pm=new PlatformManager();bound(pm,'S1','100','Alpha','1');pm.releasePlatform('A','S1');bound(pm,'S2','100','Beta','2');assert.equal(bound(pm,'S3','100','Gamma','1'),null);
});
test('RC8-TRACK-07: display-name collisions do not change physical ownership',()=>{
 const pm=new PlatformManager();bound(pm,'S1','100','V2','1');assert.equal(pm.getPlatformForTrain('A','S1'),1);assert.equal(pm.getStatus('A').assignments[0].platform,'V2');assert.notEqual(pm.assignPlatform('A','S2',3,2,{exactPreferred:true}),null);
});
test('RC8-TRACK-08: exact request by the same owner cannot silently switch tracks',()=>{
 const pm=new PlatformManager();pm.assignPlatform('A','S',3,1,{exactPreferred:true});assert.equal(pm.assignPlatform('A','S',3,2,{exactPreferred:true}),null);assert.equal(pm.getPlatformForTrain('A','S'),1);
});
test('RC8-TRACK-09: native matching uses actual trackRef, not editable display name',()=>{
 const g=fixture();const vp=g.voiePointManager.addVoiePoint({id:'vp1',stationId:'A',voie:'1',lat:48,lon:2});const s=service(g,{name:'Mon quai',ref:'V1'});assert.equal(reserve(g,s),true);assert.equal(vp.occupiedBy,s.id);assert.equal(s.stops[0].platform,'Mon quai');assert.equal(s.train.platform,'Mon quai');
});
test('RC8-TRACK-10: selected native ID survives label editing',()=>{
 const g=fixture();const vp=g.voiePointManager.addVoiePoint({id:'vp1',stationId:'A',voie:'A',lat:48,lon:2});const s=service(g,{native:'vp1',name:'Nom libre'});assert.equal(reserve(g,s),true);assert.equal(vp.occupiedBy,s.id);assert.equal(s.stops[0].platform,'Nom libre');
});
test('RC8-TRACK-11: only a unique native snap <=2m may identify an unreferenced way',()=>{
 const g=fixture();const vp=g.voiePointManager.addVoiePoint({id:'vp1',stationId:'A',voie:'1',lat:48,lon:2});g.voiePointManager.addVoiePoint({id:'vp2',stationId:'A',voie:'2',lat:48,lon:2.0001});const s=service(g);assert.equal(reserve(g,s),true);assert.equal(vp.occupiedBy,s.id);
});
test('RC8-TRACK-12: ambiguous native snaps are rejected rather than chosen by display name',()=>{
 const g=fixture();for(const [id,voie]of [['v1','1'],['v2','2']])g.voiePointManager.addVoiePoint({id,stationId:'A',voie,lat:48,lon:2});const s=service(g,{name:'1'});assert.equal(reserve(g,s),false);assert.equal(g.voiePointManager.voiePoints.filter(v=>v.occupiedBy).length,0);
});
test('RC8-TRACK-13: missing native ID is not invented in the fallback platform manager',()=>{
 const g=fixture();const s=service(g,{native:'missing'});assert.equal(reserve(g,s),false);assert.equal(g.platformManager.getPlatformForTrain('A',s.id),null);
});
test('RC8-TRACK-14: native ID belonging to another station cannot be reserved',()=>{
 const g=fixture();const vp=g.voiePointManager.addVoiePoint({id:'wrong',stationId:'B',voie:'1',lat:48.01,lon:2});const s=service(g,{native:'wrong'});assert.equal(reserve(g,s),false);assert.equal(vp.occupiedBy,null);
});
test('RC8-TRACK-15: original and optional-stop copies retain exact physical identity',()=>{
 const g=fixture();const s=service(g,{name:'Alpha',ref:'1'});assert.deepEqual(s.stops[0].trackIdentity,identity('100','1'));const copies=s._buildAdjustedStops();assert.deepEqual(copies[0].trackIdentity,identity('100','1'));assert.notEqual(copies[0].trackIdentity,s.stops[0].trackIdentity);
});
test('RC8-TRACK-16: real ActiveServices conflict on renamed bindings, not labels',()=>{
 const g=fixture();const a=service(g,{id:'A',name:'Alpha'});const b=service(g,{id:'B',name:'Beta'});assert.equal(reserve(g,a),true);assert.equal(reserve(g,b),false);assert.equal(b._platformAssignment,null);assert.equal(a.train.platform,'Alpha');
});
test('RC8-TRACK-17: train can release its physical resource and another renamed binding acquires it',()=>{
 const g=fixture();const a=service(g,{id:'A',name:'Alpha'});const b=service(g,{id:'B',name:'Beta'});assert.equal(reserve(g,a),true);withGame(g,()=>a._releaseAllPhysicalResources());assert.equal(reserve(g,b),true);assert.equal(b.train.platform,'Beta');
});
test('RC8-TRACK-18: head departure retains physical resource identity until rear clearance',()=>{
 const g=fixture();const a=service(g,{name:'Alpha',ref:'1'});assert.equal(reserve(g,a),true);withGame(g,()=>a._beginDepartureResourceHold('A'));assert.deepEqual(a._departureResourceHold.trackIdentity,identity('100','1'));assert.equal(a._departureResourceHold.displayName,'Alpha');
});
test('RC8-TRACK-19: native binding survives TrackBinding save/load without depending on a way ID',()=>{
 const b=new TrackBinding({voiePointId:'vp-42',displayName:'Nom',lat:48,lon:2});const copy=new TrackBinding(JSON.parse(JSON.stringify(b)));assert.equal(copy.voiePointId,'vp-42');
});
function addRuntimeSchedule(g,{label='Nom éditable',way='100',native=''}={}){
 const rec=g.scheduleV2.createDraft({number:'100',category:TrainCategory.FREIGHT,maxSpeed:100});const v=rec.currentVersion;
 v.locations=[new ScheduledLocation({id:'la',stationId:'A',name:'A',track:new TrackBinding({voiePointId:native,wayId:way,trackRef:'1',displayName:label,lat:48,lon:2}),departureSec:36000,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'lb',stationId:'B',name:'B',track:new TrackBinding({wayId:'200',displayName:'B',lat:48.01,lon:2}),arrivalSec:36600,departureSec:36600,dwellSec:0,stopCode:StopCode.S})];
 const pts=[{lat:48,lon:2,wayId:way,maxSpeed:100,electrified:false},{lat:48.01,lon:2,wayId:'200',maxSpeed:100,electrified:false}];v.outboundPath.legs=[{id:'leg',fromLocationId:'la',toLocationId:'lb',routePoints:pts,segments:[],distanceKm:1.112}];v.outboundPath.routePoints=pts;v.outboundPath.segments=[];v.state=ScheduleState.VALID;
 const rot=g.rotationV2.addRotation({name:'R'});const loco=g.rotationV2.addVehicle({number:'D',category:'locomotive',traction:'diesel',maxSpeed:100,massKg:80000,powerW:2000000,lengthM:20});g.rotationV2.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]}});return rec;
}
function runtimeFixture(){const g=fixture();g.scheduleV2=new ScheduleV2Manager();g.rotationV2=new RotationV2Manager(g.scheduleV2);g.scheduleV2Runtime=new ScheduleV2Runtime(g);return g;}
test('RC8-TRACK-20: actual V2 compilation transmits the original ORM identity',()=>{
 const g=runtimeFixture();addRuntimeSchedule(g);withGame(g,()=>g.scheduleV2Runtime.sync(599,'2026-09-11'));assert.equal(g.scheduleCreator.services.length,1);const s=g.scheduleCreator.services[0];assert.deepEqual(s.stops[0].trackIdentity,identity('100','1'));assert.equal(s.stops[0].platform,'Nom éditable');assert.equal(s.train.platform,'Nom éditable');
});
test('RC8-TRACK-21: restored display metadata cannot redirect a bound service to another platform',()=>{
 const g=runtimeFixture();addRuntimeSchedule(g);withGame(g,()=>g.scheduleV2Runtime.sync(599,'2026-09-11'));const s=g.scheduleCreator.services[0];const snap=g.scheduleV2Runtime.toSave().services.find(x=>x.id===s.id);snap.platformAssignment={stationId:'A',platform:'Autre voie',source:'PLATFORM_MANAGER'};snap.state='waiting';snap.position={lat:48,lon:2};g.scheduleV2Runtime._pendingSnapshots.set(s.id,snap);withGame(g,()=>g.scheduleV2Runtime._restoreSnapshot(s));assert.equal(s.stops[0].platform,'Nom éditable');assert.deepEqual(s.stops[0].trackIdentity,identity('100','1'));
});

test('RC8-TRACK-22: speculative follower reservation can be found through a real-ref alias',()=>{
 const g=fixture();const lead=service(g,{id:'lead',name:'Alpha',ref:'1'});const tail=service(g,{id:'tail',name:'Beta',ref:'1'});
 assert.equal(reserve(g,tail),true);lead.position={lat:48.0001,lon:2};tail.position={lat:48.003,lon:2};lead.state=tail.state='moving';tail.train.delayReason='espacement';tail.getNextStop=()=>tail.stops[0];tail._findPhysicalLeader=()=>({service:lead});
 assert.equal(reserve(g,lead),true);assert.equal(g.platformManager.getPlatformForTrain('A',lead.id),1);assert.equal(tail._platformAssignment,null);
});
test('RC8-TRACK-23: an occupied station is never preempted by an approaching renamed service',()=>{
 const g=fixture();const a=service(g,{id:'a',ref:'1'});const b=service(g,{id:'b',ref:'1'});assert.equal(reserve(g,a),true);a.state='stopped_at_station';a.train.stoppedAt=g.world.stations[0];a.getNextStop=()=>a.stops[0];a._findPhysicalLeader=()=>({service:b});assert.equal(reserve(g,b),false);assert.equal(g.platformManager.getPlatformForTrain('A','a'),1);
});
test('RC8-TRACK-24: native resource reservation does not move the exact ORM arrival berth',()=>{
 const g=fixture();g.voiePointManager.addVoiePoint({id:'vp1',stationId:'A',voie:'1',lat:48.0008,lon:2});const s=service(g,{ref:'1',lat:48.0001,lon:2});assert.equal(reserve(g,s),true);s.currentStopIndex=0;withGame(g,()=>s.arriveAtStation(g.world.stations[0],600,null));assert.equal(s.position.lat,48.0001);assert.equal(s.rame.currentLocation.lat,48.0001);
});
test('RC8-TRACK-25: new manager can restore a rear hold under a different canonical alias key',()=>{
 const g=fixture();const s=service(g,{ref:'1'});s._departureResourceHold={stationId:'A',platform:'@osm:100',platformSource:'PLATFORM_MANAGER',voiePointId:null,trackIdentity:identity('100','1'),displayName:'Alpha',startTravelKm:0};s.train.delayReason='';withGame(g,()=>s._restoreHeldDepartureSafety());assert.equal(s._departureResourceHold.platform,1);assert.notEqual(s.train.delayReason,'ressource gare à restaurer');assert.equal(g.platformManager.assignPlatform('A','other',3,1,{exactPreferred:true}),null);
});
test('RC8-TRACK-26: departure occupancy persists until the actual rear has cleared',()=>{
 const g=fixture();const a=service(g,{id:'a',name:'Alpha',ref:'1'});const b=service(g,{id:'b',name:'Beta',ref:'1'});assert.equal(reserve(g,a),true);withGame(g,()=>a._beginDepartureResourceHold('A'));a.totalDistance=.020;withGame(g,()=>a._releaseDepartureResourcesIfTailClear());assert.equal(reserve(g,b),false);a.totalDistance=.200;withGame(g,()=>a._releaseDepartureResourcesIfTailClear());assert.equal(reserve(g,b),true);
});
test('RC8-TRACK-27: physical assignment snapshots are detached from the running service',()=>{
 const g=runtimeFixture();addRuntimeSchedule(g);withGame(g,()=>g.scheduleV2Runtime.sync(599,'2026-09-11'));const s=g.scheduleCreator.services[0];withGame(g,()=>s._beginDepartureResourceHold('A'));const saved=g.scheduleV2Runtime.toSave();const snap=saved.services.find(x=>x.id===s.id);assert.ok(snap.platformAssignment.trackIdentity);snap.platformAssignment.trackIdentity.id='999';snap.departureResourceHold.trackIdentity.trackRef='999';assert.equal(s._platformAssignment.trackIdentity.id,'100');assert.equal(s._departureResourceHold.trackIdentity.trackRef,'1');
});
test('RC8-TRACK-28: safety track references remain physical after a player-facing rename',()=>{
 const g=fixture();const a=service(g,{ref:'1',name:'Deux'});assert.equal(reserve(g,a),true);assert.equal(a._stationaryPhysicalTrackRef(),'1');a.train.platform='Trois';assert.equal(a._stationaryPhysicalTrackRef(),'1');
});
test('RC8-TRACK-29: unknown physical refs are not inferred from display names for safety',()=>{
 const g=fixture();const a=service(g,{name:'1'});assert.equal(reserve(g,a),true);assert.equal(a._stationaryPhysicalTrackRef(),null);
});
test('RC8-TRACK-30: canonical reservations stay unique under 400 deterministic rename/release operations',()=>{
 const pm=new PlatformManager(),owners=new Map();let seed=98765;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<400;i++){const way=String(100+Math.floor(random()*12));const owner='T'+i;const old=owners.get(way);const got=bound(pm,owner,way,'nom'+(i%3));assert.equal(got===null,old!=null,`iteration ${i}`);if(got!==null)owners.set(way,owner);if(random()<.45&&owners.has(way)){pm.releasePlatform('A',owners.get(way));owners.delete(way);}assert.equal(pm.getStatus('A').used,owners.size);}
});
test('RC8-TRACK-31: legacy names use renamed real-ref aliases rather than opening a second resource',()=>{
 const pm=new PlatformManager();bound(pm,'S1','100','Alpha','1');pm.releasePlatform('A','S1');bound(pm,'S2','100','Beta','2');assert.equal(pm.assignPlatform('A','S3',3,2,{exactPreferred:true}),null);pm.releasePlatform('A','S2');assert.notEqual(pm.assignPlatform('A','S3',3,2,{exactPreferred:true}),null);assert.equal(bound(pm,'S4','100','Gamma','1'),null);
});
test('RC8-TRACK-32: released custom labels are not inherited by a later legacy owner',()=>{
 const pm=new PlatformManager();bound(pm,'S1','100','Alpha','1');pm.releasePlatform('A','S1');pm.assignPlatform('A','S2',3,1,{exactPreferred:true});assert.equal(String(pm.getStatus('A').assignments[0].platform),'1');
});
test('RC8-TRACK-33: numeric-looking large refs remain distinct beyond floating-point precision',()=>{
 const pm=new PlatformManager();const a='9007199254740992',b='9007199254740993';assert.notEqual(bound(pm,'S1','100','Alpha',a),null);assert.notEqual(bound(pm,'S2','101','Beta',b),null);assert.equal(pm.assignPlatform('A','S3',3,a,{exactPreferred:true}),null);assert.equal(pm.getStatus('A').used,2);
});
test('RC8-TRACK-34: identity imports reject malformed IDs and non-coordinate objects',async()=>{
 const {normalizeStationTrackIdentity:n,canonicalTrackRef}=await mod('station-track-identity');for(const v of [null,[],{kind:'other',id:'1'},{kind:'osm',id:'way/'},{kind:'native',id:'bad\nname'},{kind:'osm',id:Infinity}])assert.equal(n(v),null);assert.deepEqual(n({kind:'osm',id:'way/123',lat:{value:48},lon:[2]}),{kind:'osm',id:'123',trackRef:'',lat:null,lon:null});assert.equal(canonicalTrackRef('Voie 001'),'1');assert.notEqual(canonicalTrackRef('9007199254740992'),canonicalTrackRef('9007199254740993'));
});
test('RC8-TRACK-35: actual editor choice preserves native and ORM identifiers before compilation',async()=>{
 const {ScheduleV2Editor}=await mod('schedule-v2-editor');const b=ScheduleV2Editor.prototype._trackBindingFromChoice.call({}, {candidate:{voiePointId:'vp1',wayId:'100',trackRef:'1',lat:48,lon:2},displayName:'Mon nom'});assert.equal(b.voiePointId,'vp1');assert.equal(b.wayId,'100');assert.equal(b.displayName,'Mon nom');
});
