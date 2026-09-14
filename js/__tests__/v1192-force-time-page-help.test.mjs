import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  ScheduleV2Manager, TrainCategory, LocationKind, ScheduledLocation,
} from '../schedule-v2-model.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { Tutorial, PAGE_HELP_LABELS } from '../tutorial.js';

function validShortTimingVersion(){
  const mgr=new ScheduleV2Manager();
  const rec=mgr.createDraft({category:TrainCategory.FREIGHT,number:'17801'});
  const v=rec.currentVersion;
  const a=new ScheduledLocation({kind:LocationKind.STATION,order:0,stationId:'DIJON',name:'Dijon',track:{wayId:'A',displayName:'Voie 1',lat:47.32,lon:5.03,snapLat:47.32,snapLon:5.03},departureSec:0});
  const b=new ScheduledLocation({kind:LocationKind.STATION,order:1,stationId:'BEAUNE',name:'Beaune',track:{wayId:'B',displayName:'Voie 1',lat:47.02,lon:4.85,snapLat:47.02,snapLon:4.85},arrivalSec:600,departureSec:600,arrivalOverride:true,computedArrivalSec:1200,computedDepartureSec:600});
  v.locations=[a,b];
  v.outboundPath.routePoints=[{lat:47.32,lon:5.03,maxSpeed:160},{lat:47.02,lon:4.85,maxSpeed:160}];
  v.outboundPath.segments=[{wayId:'MAIN',from:{lat:47.32,lon:5.03},to:{lat:47.02,lon:4.85},maxSpeed:160,maxSpeedSource:'OSM',electrified:true}];
  v.outboundPath.legs=[{id:'leg-dijon-beaune',fromLocationId:a.id,toLocationId:b.id,constraintIds:[],routePoints:v.outboundPath.routePoints,segments:v.outboundPath.segments,distanceKm:37}];
  v.outboundPath.distanceKm=37;
  return {mgr,rec,v};
}

test('v1.1.92 short player running time is blocking until explicitly forced',()=>{
  const {v}=validShortTimingVersion();
  const report=validateScheduleVersion(v);
  const issue=report.issues.find(i=>i.code==='MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE');
  assert.ok(issue);
  assert.equal(issue.level,'ERROR');
  assert.equal(report.canValidate,false);
  assert.equal(issue.data.forced,false);
});

test('v1.1.92 explicit force downgrades only the short-running-time issue to warning',()=>{
  const {v}=validShortTimingVersion();
  v.allowShorterThanPhysicalTiming=true;
  const report=validateScheduleVersion(v);
  const issue=report.issues.find(i=>i.code==='MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE');
  assert.ok(issue);
  assert.equal(issue.level,'WARNING');
  assert.equal(issue.data.forced,true);
  assert.equal(report.errors.some(i=>i.code==='MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'),false);
  const json=v.toJSON();
  assert.equal(json.allowShorterThanPhysicalTiming,true,'override must survive save/load');
});

test('v1.1.92 editor permits reaching the force dialog only for short-time errors',()=>{
  const ed=Object.create(ScheduleV2Editor.prototype);
  assert.equal(ed._reportCanProceedToValidation({errors:[{code:'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'}]}),true);
  assert.equal(ed._reportCanProceedToValidation({errors:[{code:'TRACK_MISSING'}]}),false);
  assert.equal(ed._reportCanProceedToValidation({errors:[{code:'MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE'},{code:'ELECTRIC_INCOMPATIBLE'}]}),false);
});

test('v1.1.92 every navigation page has a contextual help guide',()=>{
  const root=new URL('../../',import.meta.url);
  const index=readFileSync(new URL('index.html',root),'utf8');
  const pages=[...index.matchAll(/class="nav-btn(?: active)?" data-page="([^"]+)"/g)].map(m=>m[1]);
  const tutorial=new Tutorial();
  assert.ok(pages.length>=15);
  for(const page of pages){
    assert.ok(PAGE_HELP_LABELS[page],`missing label for ${page}`);
    assert.ok(Array.isArray(tutorial.pageGuides[page])&&tutorial.pageGuides[page].length>=2,`missing detailed guide for ${page}`);
  }
});

test('v1.1.92 help buttons are visible globally, per page and inside Schedule Creator',()=>{
  const root=new URL('../../',import.meta.url);
  const index=readFileSync(new URL('index.html',root),'utf8');
  const ui=readFileSync(new URL('js/ui.js',root),'utf8');
  const sc=readFileSync(new URL('js/schedule-v2-editor.js',root),'utf8');
  const css=readFileSync(new URL('style.css',root),'utf8');
  assert.match(index,/btn-header-help/);
  assert.match(index,/>Tutoriel</);
  assert.match(ui,/setupPageHelpButtons/);
  assert.match(ui,/Aide \/ Tutoriel/);
  assert.match(sc,/data-page-help="schedules"/);
  assert.match(css,/\.page-help-btn/);
});

test('v1.1.92 contextual help supports screenshots and ships a Roulements example',()=>{
  const root=new URL('../../',import.meta.url);
  const tutorial=readFileSync(new URL('js/tutorial.js',root),'utf8');
  assert.match(tutorial,/tutorial-media/);
  assert.match(tutorial,/img\/tutorial\/roulements-v3\.webp/);
  assert.equal(existsSync(new URL('img/tutorial/roulements-v3.webp',root)),true);
});


test('v1.1.92 packaged build identity and help/force code survive FILE bundle',()=>{
  const root=new URL('../../',import.meta.url);
  const version=readFileSync(new URL('VERSION.txt',root),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
  const index=readFileSync(new URL('index.html',root),'utf8');
  const bundle=readFileSync(new URL('js/rail-empire.file.bundle.js',root),'utf8');
  assert.equal(version,'1.1.99');
  assert.equal(pkg.version,'1.1.99');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(bundle,/Rail Empire v1\.1\.99 FILE:\/\/ CORE bundle/);
  assert.match(bundle,/FULL-AUDIT-TAXONOMY-CROSSSYSTEM-SC-HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(bundle,/Forcer et valider quand même/);
  assert.match(bundle,/setupPageHelpButtons/);
  assert.match(bundle,/startPage/);
});
