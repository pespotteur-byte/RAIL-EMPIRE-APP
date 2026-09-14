import test from 'node:test';
import assert from 'node:assert/strict';
import {assignResolvedLegsToPath,SchedulePath,ScheduleVersion,ScheduledLocation,TrackBinding,PerformanceProfile} from '../schedule-v2-model.js';
import {validateScheduleVersion} from '../schedule-v2-validation.js';
import {ScheduleV2Runtime} from '../schedule-v2-runtime.js';
const n=140000;
let version;
function fixture(){
 if(version)return version;
 const routePoints=Array.from({length:n+1},(_,i)=>({lat:48,lon:2+i*.00001,wayId:'rail',maxSpeed:160,maxSpeedSource:'OSM'}));
 const segments=Array.from({length:n},()=>({wayId:'rail',maxSpeed:160,maxSpeedSource:'OSM',electrified:true,gauge:[1435],voltage:[25000],frequency:[50],loadingGauge:'GC',axleLoad:22.5,metreLoad:8,railway:'rail'}));
 const locations=[routePoints[0],routePoints[n]].map((p,i)=>new ScheduledLocation({id:i?'b':'a',stationId:i?'B':'A',name:i?'B':'A',order:i,departureSec:28800+i*7200,arrivalSec:i?36000:null,dwellSec:0,track:new TrackBinding({...p,snapLat:p.lat,snapLon:p.lon,displayName:'1'})}));
 const path=new SchedulePath({topologyRevision:1,resolvedRevision:1});
 assignResolvedLegsToPath(path,[{id:'L',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints,segments,distanceKm:0}]);
 version=new ScheduleVersion({name:'Dense route',locations:[]});version.locations=locations;version.outboundPath=path;
 version.performanceProfile=new PerformanceProfile({massKg:500000,powerW:5000000,maxSpeedKmh:160,lengthM:200,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435],loadingGauge:'GA',axleLoad:20,metreLoad:6});
 return version;
}
test('RC4-SC30: 140000 segments assemble without exceeding JavaScript argument limits',()=>{
 const v=fixture();assert.equal(v.outboundPath.routePoints.length,n+1);assert.equal(v.outboundPath.segments.length,n);assert.ok(v.outboundPath.distanceKm>100);
});
test('RC4-SC30: dense geometry retains end points and all physical constraints',()=>{
 const p=fixture().outboundPath;assert.equal(p.routePoints.at(-1).lon,2+n*.00001);
 for(const i of [0,70000,139999]){assert.deepEqual(p.segments[i].gauge,[1435]);assert.equal(p.segments[i].electrified,true);assert.equal(p.segments[i].maxSpeed,160);assert.deepEqual(p.segments[i].voltage,[25000]);}
 assert.equal(p.legs[0].segments.length,n);
});
test('RC4-SC30: the real V2 validator handles the entire canonical long path',()=>{
 const result=validateScheduleVersion(fixture());assert.ok(result);
 assert.ok(!result.issues.some(i=>/PATH_.*MISMATCH/.test(i.code)),JSON.stringify(result.issues.slice(0,5)));
});
test('RC4-SC30: the runtime integrity gate does not fail on the same dense path',()=>{
 const runtime=Object.create(ScheduleV2Runtime.prototype);
 assert.equal(runtime._routeIntegrityProblem({ver:fixture()}),'');
});
