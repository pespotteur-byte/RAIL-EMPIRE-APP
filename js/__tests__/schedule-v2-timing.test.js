import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Manager, ScheduledLocation, TrainCategory, PerformanceProfile } from '../schedule-v2-model.js';
import { calculatePhysicalTravelSeconds, recalculateScheduleTiming } from '../schedule-v2-timing.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';

const route=[{lat:48,lon:2,maxSpeed:100},{lat:48.09,lon:2,maxSpeed:100}];

test('physical timing is seconds and adds zero automatic margin',()=>{
  const p=PerformanceProfile.genericForCategory(TrainCategory.PASSENGER,100);
  const sec=calculatePhysicalTravelSeconds(route,p);
  assert.ok(sec>0);
  assert.ok(sec<3600);
});

test('manual time override is preserved and downstream calculation uses it',()=>{
  const sm=new ScheduleV2Manager(); const rec=sm.createDraft({category:TrainCategory.PASSENGER,maxSpeed:100}); const v=rec.currentVersion;
  const a=new ScheduledLocation({name:'A',stationId:'A',track:{wayId:'1',displayName:'1'},departureSec:8*3600,departureOverride:true});
  const b=new ScheduledLocation({name:'B',stationId:'B',track:{wayId:'2',displayName:'2'},dwellSec:120});
  const c=new ScheduledLocation({name:'C',stationId:'C',track:{wayId:'3',displayName:'3'},dwellSec:120});
  v.locations=[a,b,c];
  v.outboundPath.legs=[{fromLocationId:a.id,toLocationId:b.id,routePoints:route},{fromLocationId:b.id,toLocationId:c.id,routePoints:route}];
  recalculateScheduleTiming(v);
  const physicalB=b.computedArrivalSec;
  b.applyManualDeparture((b.departureSec||0)+300);
  recalculateScheduleTiming(v);
  assert.equal(b.departureSec,b.computedDepartureSec+300);
  assert.ok(c.computedArrivalSec>=b.departureSec);
  assert.equal(v.automaticMarginSec,0);
  assert.ok(physicalB>8*3600);
});

test('known incompatible electric system blocks reference profile validation',()=>{
  const sm=new ScheduleV2Manager(); const rec=sm.createDraft({}); const v=rec.currentVersion;
  v.performanceProfile=new PerformanceProfile({traction:'electric',electricSystems:[{voltage:25000,frequency:50}]});
  v.locations=['A','B'].map((x,i)=>new ScheduledLocation({stationId:x,name:x,track:{wayId:String(i+1),displayName:'V'},departureSec:i?500:0,arrivalSec:i?500:null}));
  v.outboundPath.routePoints=route;
  v.outboundPath.segments=[{wayId:'1',maxSpeed:100,maxSpeedSource:'OSM',electrified:true,voltage:[15000],frequency:[16.7]}];
  const report=validateScheduleVersion(v);
  assert.ok(report.errors.some(x=>x.code==='ELECTRIC_INCOMPATIBLE'));
});
