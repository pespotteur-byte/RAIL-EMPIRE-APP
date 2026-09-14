import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Router } from '../schedule-v2-routing.js';
import {
  SchedulePath, PerformanceProfile, TrainCategory, PerformanceMode,
  ScheduleV2Manager, ScheduledLocation, TrackBinding, assignResolvedLegsToPath,
} from '../schedule-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';
import { recalculateScheduleTiming, physicalTravelSecondsForLeg } from '../schedule-v2-timing.js';
import { applyLineMaxSpeedToVersion } from '../schedule-v2-editor.js';

function pt(lat,lon,wayId,maxSpeed,maxSpeedSource='OSM'){
  return {lat,lon,wayId,maxSpeed,maxSpeedSource,electrified:null,voltage:[],frequency:[],gauge:[],fallback:false};
}

test('HOTFIX65 terminus metadata-light on same way does not turn final segment into false FALLBACK_30',()=>{
  const router=new ScheduleV2Router({});
  const sameWay=[pt(48,2,'W',160,'OSM'),pt(48,2.01,'W',30,'FALLBACK_30')];
  const snap=router.snapshotRoute(sameWay);
  assert.equal(snap.segments.length,1);
  assert.equal(snap.segments[0].maxSpeed,160);
  assert.equal(snap.segments[0].maxSpeedSource,'OSM');
  assert.equal(snap.routePoints[1].maxSpeed,160);
  assert.equal(snap.routePoints[1].maxSpeedSource,'OSM');

  // A genuinely different unknown way stays unknown: no unsafe inheritance.
  const differentWay=[pt(48,2,'A',160,'OSM'),pt(48,2.01,'B',30,'FALLBACK_30')];
  const snap2=router.snapshotRoute(differentWay);
  assert.equal(snap2.segments[0].maxSpeedSource,'FALLBACK_30');
});

test('HOTFIX65 compact save reload keeps same-way terminus speed metadata inheritance',()=>{
  const route=[pt(48,2,'W',140,'OSM'),pt(48,2.01,'W',30,'FALLBACK_30')];
  const path=new SchedulePath({
    topologyRevision:1,resolvedRevision:1,
    legs:[{fromLocationId:'A',toLocationId:'B',routePoints:route,segments:[],distanceKm:0,physicalTravelSec:999,physicalTravelSignature:'old'}],
  });
  assert.equal(path.legs[0].routePoints[1].maxSpeed,140);
  assert.equal(path.legs[0].routePoints[1].maxSpeedSource,'OSM');
  assert.equal(path.legs[0].segments[0].maxSpeed,140);
  assert.equal(path.legs[0].segments[0].maxSpeedSource,'OSM');
  assert.equal(path.legs[0].physicalTravelSec,null);
  assert.equal(path.legs[0].physicalTravelSignature,'');
});

test('HOTFIX65 unknown ORM metadata is informational, not a fake route error',()=>{
  const mgr=new ScheduleV2Manager();
  const rec=mgr.createDraft({number:'HF65',category:TrainCategory.PASSENGER,maxSpeed:120});
  const v=rec.currentVersion;
  v.locations=[
    new ScheduledLocation({id:'A',kind:'STATION',stationId:'A',name:'A',order:0,dwellSec:0,departureSec:8*3600,track:new TrackBinding({wayId:'U',displayName:'1',lat:48,lon:2,snapLat:48,snapLon:2})}),
    new ScheduledLocation({id:'B',kind:'STATION',stationId:'B',name:'B',order:1,dwellSec:0,track:new TrackBinding({wayId:'U',displayName:'2',lat:48,lon:2.02,snapLat:48,snapLon:2.02})}),
  ];
  v.outboundPath.topologyRevision=1;
  const route=[pt(48,2,'U',30,'FALLBACK_30'),pt(48,2.02,'U',30,'FALLBACK_30')];
  const snap=new ScheduleV2Router({}).snapshotRoute(route);
  assignResolvedLegsToPath(v.outboundPath,[{id:'leg-A-B',fromLocationId:'A',toLocationId:'B',constraintIds:[],routeInputKey:'A>B',routePoints:snap.routePoints,segments:snap.segments,distanceKm:snap.distanceKm}],{resolvedRevision:1,error:''});
  recalculateScheduleTiming(v,{firstDepartureSec:8*3600});
  const report=validateScheduleVersion(v,{ormAvailable:true});
  const vmax=report.issues.find(x=>x.code==='VMAX_UNKNOWN');
  assert.ok(vmax);
  assert.equal(vmax.level,'UNKNOWN');
  assert.equal(report.unknowns.some(x=>x.code==='VMAX_UNKNOWN'),true);
  assert.equal(report.errors.length,0);
});

test('HOTFIX65 Vmax du sillon invalidates physical cache and changes running time',()=>{
  const profile=PerformanceProfile.genericForCategory(TrainCategory.PASSENGER,160);
  assert.equal(profile.mode,PerformanceMode.LINE_MAX_SPEED);
  const route=[pt(48,2,'W',200,'OSM'),pt(48,2.25,'W',200,'OSM')];
  const leg={routePoints:route,physicsRouteKey:'same-geometry',physicalTravelSec:null,physicalTravelSignature:''};
  const version={category:TrainCategory.PASSENGER,performanceProfile:profile,outboundPath:{legs:[leg]},lastRecalculatedAt:'old'};
  const fast=physicalTravelSecondsForLeg(leg,version.performanceProfile);
  assert.ok(fast>0);
  assert.ok(leg.physicalTravelSignature);
  const applied=applyLineMaxSpeedToVersion(version,80);
  assert.equal(applied,80);
  assert.equal(version.performanceProfile.maxSpeed,80);
  assert.equal(leg.physicalTravelSec,null);
  assert.equal(leg.physicalTravelSignature,'');
  const slow=physicalTravelSecondsForLeg(leg,version.performanceProfile);
  assert.ok(slow>fast,`expected V80 (${slow}s) to be slower than V160 (${fast}s)`);
});

test('HOTFIX65 route drawing keeps informational unknown metadata blue',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  assert.match(src,/Missing OSM[\s\S]*must not[\s\S]*recolour/);
  assert.match(src,/i\?\.level!==['"]ERROR['"]&&i\?\.level!==['"]WARNING['"]/);
  assert.doesNotMatch(src,/else if\(seg\.maxSpeedSource===['"]FALLBACK_30['"]\)col=YELLOW/);
  assert.match(src,/data-apply-vmax/);
  assert.match(src,/Vmax du sillon appliquée/);
});
