import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation } from '../schedule-v2-model.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');

function seed(rec, dep=6*3600+40*60, from='dijon', to='lyon'){
  const v=rec.currentVersion;
  v.state=ScheduleState.VALID;
  v.locations=[
    new ScheduledLocation({stationId:from,name:from==='dijon'?'Dijon Ville':'Lyon Part-Dieu',track:{wayId:'11',displayName:'Voie 1'},departureSec:dep}),
    new ScheduledLocation({stationId:to,name:to==='lyon'?'Lyon Part-Dieu':'Dijon Ville',track:{wayId:'22',displayName:'Voie A'},arrivalSec:dep+7200}),
  ];
  v.outboundPath.routePoints=[{lat:47.3,lon:5.0},{lat:45.76,lon:4.86}];
  v.outboundPath.segments=[{wayId:'11'},{wayId:'22'}];
  return v;
}

test('v1.1.67 single schedule frequency creates +5 min departures with +2 numbering and fresh ids',()=>{
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'17801',name:'Dijon → Lyon'}); seed(rec);
  const made=sm.duplicateScheduleFrequency(rec.id,{intervalSec:300,totalCount:4,includeOriginal:true});
  assert.equal(made.length,3);
  assert.deepEqual(made.map(x=>x.number),['17803','17805','17807']);
  assert.deepEqual(made.map(x=>x.currentVersion.firstDepartureSec),[rec.currentVersion.firstDepartureSec+300,rec.currentVersion.firstDepartureSec+600,rec.currentVersion.firstDepartureSec+900]);
  assert.ok(made.every(x=>x.id!==rec.id));
  assert.ok(made.every(x=>x.currentVersion.state===ScheduleState.VALID));
  assert.ok(made.every(x=>x.currentVersion.locations[0].id!==rec.currentVersion.locations[0].id));
});

test('v1.1.67 frequency until mode stops on the requested departure horizon',()=>{
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'EC 170',name:'Berlin'}); seed(rec,18*3600+55*60);
  const until=rec.currentVersion.firstDepartureSec+20*60;
  const made=sm.duplicateScheduleFrequency(rec.id,{intervalSec:5*60,untilDepartureSec:until});
  assert.equal(made.length,4);
  assert.equal(made.at(-1).currentVersion.firstDepartureSec,until);
});

test('v1.1.67 linked round-trip frequency can be bounded by exact pair count',()=>{
  const sm=new ScheduleV2Manager();
  const out=sm.createDraft({number:'17801',name:'Dijon → Lyon'}),ret=sm.createDraft({number:'17802',name:'Lyon → Dijon'});
  seed(out,6*3600+40*60,'dijon','lyon'); seed(ret,9*3600,'lyon','dijon');
  const g=sm.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:600});
  const made=sm.duplicateRoundTrip(g.id,{intervalSec:300,horizonSec:3600,maxPairs:3});
  assert.equal(made.length,3);
  assert.deepEqual(made.map(x=>x.outbound.number),['17803','17805','17807']);
  assert.deepEqual(made.map(x=>x.return.number),['17804','17806','17808']);
});

test('v1.1.67 UI exposes schedule search, frequency dialog and safe rame duplication',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
  const editor=fs.readFileSync(path.join(root,'js/schedule-v2-editor.js'),'utf8');
  const bundle=fs.readFileSync(path.join(root,'js/rail-empire.file.bundle.js'),'utf8');
  assert.match(index,/id="schedules-search"/);
  assert.match(ui,/duplicateRame\(id\)/);
  assert.match(ui,/data-dup-rame/);
  assert.match(ui,/_duplicatingRameSourceId/);
  assert.match(ui,/elementId:this\._newRameElementId\(\)/);
  assert.match(editor,/Dupliquer \/ créer une fréquence/);
  assert.match(editor,/duplicateScheduleFrequency/);
  assert.match(editor,/schedules-search/);
  assert.match(editor,/Aucune rame directe ni affectation de roulement n’est recopiée/);
  assert.match(bundle,/Rail Empire v1\.1\.99 FILE:\/\/ CORE bundle/);
  assert.match(bundle,/Dupliquer \/ créer une fréquence/);
  assert.match(bundle,/duplicateScheduleFrequency/);
  assert.match(bundle,/duplicateRame/);
});

test('v1.1.67 identity and FILE cache are bumped',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const version=fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim();
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(version,'1.1.99');
  assert.equal(pkg.version,'1.1.99');
  assert.match(index,/Rail Empire v1\.1\.99/);
  assert.match(index,/V1\.1\.99/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
