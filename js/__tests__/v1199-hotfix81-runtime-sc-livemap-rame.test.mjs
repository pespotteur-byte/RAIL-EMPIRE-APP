import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ActiveService } from '../schedule-creator.js';
import { fixture, tick } from './helpers/rc10-fixtures.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX81 passenger advance is no longer clamped to zero between timing points',()=>{
  const s=Object.create(ActiveService.prototype);
  s.currentStopIndex=1;
  s._v2OccurrenceId='';
  s._currentDate='2026-09-04';
  s.train={delay:0};
  s.rame=null;
  s.position=null;
  s._state={};
  s.getCurrentStops=()=>[
    {departureTime:100,arrivalTime:100},
    {arrivalTime:110,departureTime:110},
  ];
  s._v2ScheduleNowMinutes=()=>95;
  s._scheduleDiff=(a,b)=>a-b;
  s._isPassengerService=()=>true;
  s._updateContinuousDelay(95);
  assert.equal(s.delay,-5);
  assert.equal(s.train.delay,-5);
});

test('HOTFIX81 traction builds progressively instead of jumping to full acceleration',()=>{
  const s=Object.create(ActiveService.prototype);
  s.speed=0;
  s.serviceType='passager';
  s.rame={totalLength:200};
  s.train={length:200};
  s._brakeEffort=0;
  s._tractiveEffort=0;
  s._applyPhysicalSpeedTarget(100,3,4,0.1);
  assert.ok(s.speed>0);
  assert.ok(s.speed<0.3,'first 100 ms must be below instantaneous full 3 km/h/s acceleration');
  const first=s.speed;
  for(let i=0;i<30;i++)s._applyPhysicalSpeedTarget(100,3,4,0.1);
  assert.ok(s._tractiveEffort>0.9);
  assert.ok(s.speed>first+5);
});

test('HOTFIX81 station braking plans earlier than full-service last-moment curve',()=>{
  const s=Object.create(ActiveService.prototype);
  s.speed=160;
  s.train={decel:3.24};
  s._brakeBuildSeconds=()=>2;
  const physicalA=0.9;
  const cap=s._brakingCurveCapKmh(1200,0,120,physicalA,0.78);
  const oldBuild=(160/3.6)*2*0.5;
  const oldD=Math.max(0,1200-oldBuild);
  const oldCap=Math.sqrt(2*physicalA*oldD)*3.6;
  assert.ok(cap<oldCap,'comfort/service curve must command a lower speed sooner');
});

test('HOTFIX81 macro movement records rame mileage and continuous timing',()=>{
  const {s,game,rame}=fixture({speed:80});
  let wearCalls=0, timingCalls=0;
  const wear=s._trackWear, timing=s._updateContinuousDelay;
  s._trackWear=function(...args){wearCalls++;return wear.apply(this,args);};
  s._updateContinuousDelay=function(...args){timingCalls++;return timing.apply(this,args);};
  const before=Number(rame.totalKmRun)||0;
  tick(s,'macro',game,1);
  assert.ok(wearCalls>0,'movement must record material wear/mileage');
  assert.ok(rame.totalKmRun>before,'actual material mileage must increase');
  assert.ok(timingCalls>0,'continuous timing must be recomputed');
  assert.ok(Number.isFinite(s.train.delay));
});

test('HOTFIX81 normal-size sessions use camera-independent full physics',()=>{
  const src=read('js/main.js');
  assert.match(src,/if \(movingCount <= HIGH_BUDGET\)/);
  assert.match(src,/camera-independent simulation for ordinary sessions/);
  assert.match(src,/svc\._lod = 'high'/);
});

test('HOTFIX81 returning to LiveMap invalidates stale position/render caches',()=>{
  const src=read('js/ui.js');
  assert.match(src,/this\.game\._lastIdleMapRender = 0/);
  assert.match(src,/this\.game\._last3DMapRender = 0/);
  assert.match(src,/this\.game\._lastStoppedScan = 0/);
  assert.match(src,/this\.game\._visibleBuf\.length = 0/);
});

test('HOTFIX81 gameplay never falls back to implicit English/default browser voice',()=>{
  const src=read('js/ui.js');
  assert.match(src,/new LivemapTrainAnnouncer\(game, \{ allowLanguageFallback:false \}\)/);
});

test('HOTFIX81 short SC routes use railway corridor acquisition and strict detour sanity',()=>{
  const src=read('js/orm.js');
  assert.match(src,/source:'rail-corridor-tiny'/);
  assert.match(src,/const bufferKm=Math\.max\(3\.0,Math\.min\(5\.0,2\.8\+distKm\*0\.45\)\)/);
  assert.match(src,/const detourLimit=distKm<8\?Math\.max\(distKm\*2\.2,distKm\+2\.0\)/);
});

test('HOTFIX81 cache/build identity ships all runtime fixes',()=>{
  const build=read('scripts/build-file-bundle-v1199.cjs');
  const index=read('index.html');
  assert.match(build,/HOTFIX81-RUNTIME-SC-LIVEMAP-RAME-BUGFIXES/);
  assert.match(build,/const CACHE_VERSION = '1199repair24'/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
