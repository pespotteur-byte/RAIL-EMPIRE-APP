import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, addValidSchedule } from './re-rc2-fixtures.mjs';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleV2Revalidator } from '../schedule-v2-revalidation.js';
import { ScheduleVersion } from '../schedule-v2-model.js';
function fixture(){
 const game=makeGame();game.orm={_topologyEpoch:3};
 const v=addValidSchedule(game).currentVersion;
 const e=Object.create(ScheduleV2Editor.prototype);e.game=game;
 const path=v.outboundPath;path.resolvedRevision=path.topologyRevision;
 path.legs[0].routeInputKey=e._legRouteInputKey(v,path,0);
 return {game,v,e,path};
}
test('RC3-SC25-01: a changed traction profile invalidates an otherwise usable old path',()=>{
 const {v,e,path}=fixture();assert.equal(e._pathStructurallyCurrent(v,path),true);
 v.performanceProfile.traction=v.performanceProfile.traction==='diesel'?'electric':'diesel';
 assert.equal(e._pathStructurallyCurrent(v,path),false);
});
test('RC3-SC25-02: each physical compatibility input invalidates the old route',()=>{
 for(const [key,value] of Object.entries({gauges:[1000],electricSystems:[{voltage:12345,frequency:50}],loadingGauge:'GB1',axleLoad:12.3,metreLoad:5.7})){
  const {v,e,path}=fixture();v.performanceProfile[key]=value;
  assert.equal(e._pathStructurallyCurrent(v,path),false,key);
 }
});
test('RC3-SC25-03: labels, departure time and performance-only power do not discard physical geometry',()=>{
 const {v,e,path}=fixture();v.locations[0].track.displayName='Quai choisi';v.locations[0].track.trackRef='Label';
 v.locations[0].departureSec+=60;v.performanceProfile.powerW=7654321;
 assert.equal(e._pathStructurallyCurrent(v,path),true);
});
test('RC3-SC25-04: the ensure-ready flow reroutes a changed profile, not just its timetable',async()=>{
 const {v,e}=fixture();v.performanceProfile.traction='changed';e._activeVersion=()=>v;
 let calls=0;e._recomputeActivePath=async()=>{calls++;return true;};
 assert.equal(await e._ensureActivePathReady(),true);assert.equal(calls,1);
});
test('RC3-SC25-05: a cache lacking physical input identity is not silently accepted for a new profile',()=>{
 const {v,e,path}=fixture();delete path.legs[0].routeInputKey;
 assert.equal(e._pathStructurallyCurrent(v,path),false);
});
test('RC3-SC26-01: successful revalidation preserves shared route/cache keys through serialization',async()=>{
 const {game,v,e}=fixture();const rv=new ScheduleV2Revalidator(game);
 const route=[{lat:48.0002,lon:2.0002,wayId:'NEW-A',maxSpeed:120,electrified:false},{lat:48.1998,lon:2.1998,wayId:'NEW-B',maxSpeed:120,electrified:false}];
 route._resolvedAnchors=route.map((p,i)=>({...p,segmentIndex:i+2}));
 rv.router.routeBetweenBindings=async()=>route;
 rv.router.snapshotRoute=()=>({routePoints:route.map(p=>({...p})),segments:[{wayId:'NEW-A',from:route[0],to:route[1],distanceKm:26,maxSpeed:120,maxSpeedSource:'OSM',electrified:false,gauge:[1435]}],distanceKm:26});
 const result=await rv._rebuildVersion(v);assert.equal(result.ok,true,JSON.stringify(result));
 const restored=new ScheduleVersion(v.toJSON());const path=restored.outboundPath,leg=path.legs[0];
 assert.equal(leg.routeInputKey,e._legRouteInputKey(restored,path,0));
 assert.ok(leg.physicsRouteKey?.includes(leg.routeInputKey));
 assert.equal(e._pathStructurallyCurrent(restored,path),true);
});
test('RC3-SC26-02: a failed candidate never changes the live route/cache identity',async()=>{
 const {game,v}=fixture();const rv=new ScheduleV2Revalidator(game);const before=JSON.stringify(v.toJSON());
 rv.router.routeBetweenBindings=async()=>{const er=Error('broken topology');er.code='ORM_NO_CONNECTED_PATH';throw er;};
 assert.equal((await rv._rebuildVersion(v)).ok,false);assert.equal(JSON.stringify(v.toJSON()),before);
});
