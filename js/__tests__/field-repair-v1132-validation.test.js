import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Manager, ScheduledLocation, TrackBinding, LocationKind, TrainCategory, RouteConstraint } from '../schedule-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';

function baseVersion(stopCount=2){
  const mgr=new ScheduleV2Manager();
  const rec=mgr.createDraft({category:TrainCategory.FREIGHT});
  const v=rec.currentVersion;
  v.locations=Array.from({length:stopCount},(_,i)=>new ScheduledLocation({
    kind:LocationKind.STATION,stationId:`S${i}`,name:`S${i}`,order:i,
    track:new TrackBinding({wayId:'10',displayName:`V${i+1}`,lat:0,lon:i*0.01,snapLat:0,snapLon:i*0.01}),
    arrivalSec:i?i*600:null,departureSec:i*600,
  }));
  return v;
}
function leg(v,i){
  const a=v.locations[i],b=v.locations[i+1];
  return {id:`leg-${i}`,fromLocationId:a.id,toLocationId:b.id,constraintIds:[],routePoints:[{lat:0,lon:i*0.01},{lat:0,lon:(i+1)*0.01}],segments:[{wayId:'10',from:{lat:0,lon:i*0.01},to:{lat:0,lon:(i+1)*0.01},maxSpeed:120,maxSpeedSource:'OSM',electrified:true,gauge:[1435]}],distanceKm:1};
}
function assemble(v){
  v.outboundPath.legs=Array.from({length:v.locations.length-1},(_,i)=>leg(v,i));
  v.outboundPath.routePoints=v.outboundPath.legs.flatMap((l,i)=>i?l.routePoints.slice(1):l.routePoints);
  v.outboundPath.segments=v.outboundPath.legs.flatMap(l=>l.segments);
  v.performanceProfile.gauges=[1435];
}

test('v1.1.32 validation rejects a missing leg instead of accepting a partial global path',()=>{
  const v=baseVersion(3); assemble(v); v.outboundPath.legs.pop();
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='LEG_COUNT_MISMATCH'));
  assert.ok(r.errors.some(x=>x.code==='LEG_IDENTITY_MISMATCH'));
});

test('v1.1.32 validation rejects stale geometry after a failed recomputation',()=>{
  const v=baseVersion(2); assemble(v); v.outboundPath.error='Overpass indisponible';
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='ROUTE_RECOMPUTE_FAILED'));
});

test('v1.1.32 validation rejects wrong leg endpoint identities',()=>{
  const v=baseVersion(3); assemble(v); v.outboundPath.legs[1].fromLocationId=v.locations[0].id;
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='LEG_IDENTITY_MISMATCH'));
});

test('v1.1.32 validation rejects non-monotonic station chronology',()=>{
  const v=baseVersion(2); assemble(v); v.locations[0].departureSec=600; v.locations[1].arrivalSec=500; v.locations[1].departureSec=500;
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='NON_MONOTONIC_TIMING'));
});

test('v1.1.32 validation rejects known gauge incompatibility before runtime',()=>{
  const v=baseVersion(2); assemble(v); v.performanceProfile.gauges=[1435]; v.outboundPath.segments[0].gauge=[1000]; v.outboundPath.legs[0].segments[0].gauge=[1000];
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='GAUGE_INCOMPATIBLE'));
});

test('v1.1.32 validation requires every requested VIA to be carried by exactly one leg',()=>{
  const v=baseVersion(2); assemble(v); const c=new RouteConstraint({lat:0,lon:0.005,snapLat:0,snapLon:0.005,legIndex:0}); v.outboundPath.constraints=[c];
  const r=validateScheduleVersion(v);
  assert.equal(r.canValidate,false);
  assert.ok(r.errors.some(x=>x.code==='LEG_CONSTRAINT_MISMATCH'||x.code==='VIA_NOT_ROUTED'));
});
