import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation } from '../schedule-v2-model.js';

function seed(rec, dep=6*3600+40*60, from='A', to='B'){
  const v=rec.currentVersion;
  v.state=ScheduleState.VALID;
  v.locations=[
    new ScheduledLocation({stationId:from,name:from,track:{wayId:from==='A'?'11':'22',displayName:'Voie 1'},departureSec:dep}),
    new ScheduledLocation({stationId:to,name:to,track:{wayId:to==='B'?'22':'11',displayName:'Voie 2'},arrivalSec:dep+3600}),
  ];
  v.outboundPath.routePoints=[{lat:0,lon:0},{lat:1,lon:1}];
  v.outboundPath.segments=[{wayId:'11'},{wayId:'22'}];
}

test('frequency +2 numbering is mirrored inside train names that contain the source number',()=>{
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'17801',name:'TER 17801 Dijon → Lyon'}); seed(rec);
  const made=sm.duplicateScheduleFrequency(rec.id,{intervalSec:300,totalCount:4,includeOriginal:true});
  assert.deepEqual(made.map(x=>x.number),['17803','17805','17807']);
  assert.deepEqual(made.map(x=>x.name),['TER 17803 Dijon → Lyon','TER 17805 Dijon → Lyon','TER 17807 Dijon → Lyon']);
});

test('linked round-trip +2/+1 numbering is mirrored in outbound and return names',()=>{
  const sm=new ScheduleV2Manager();
  const out=sm.createDraft({number:'17801',name:'TER 17801 Dijon → Lyon'});
  const ret=sm.createDraft({number:'17802',name:'TER 17802 Lyon → Dijon'});
  seed(out,6*3600+40*60,'A','B'); seed(ret,9*3600,'B','A');
  const g=sm.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:600});
  const [pair]=sm.duplicateRoundTrip(g.id,{intervalSec:300,horizonSec:300,maxPairs:1});
  assert.equal(pair.outbound.number,'17803');
  assert.equal(pair.outbound.name,'TER 17803 Dijon → Lyon');
  assert.equal(pair.return.number,'17804');
  assert.equal(pair.return.name,'TER 17804 Lyon → Dijon');
});

test('duplication leaves a descriptive name untouched when it does not contain the train number',()=>{
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'17801',name:'Dijon → Lyon'}); seed(rec);
  const copy=sm.duplicateSchedule(rec.id,{preserveState:true,numberDelta:2,timeShiftSec:300});
  assert.equal(copy.number,'17803');
  assert.equal(copy.name,'Dijon → Lyon');
});

test('explicit duplicate name override wins over automatic number mirroring',()=>{
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'17801',name:'TER 17801 Dijon → Lyon'}); seed(rec);
  const copy=sm.duplicateSchedule(rec.id,{preserveState:true,numberDelta:2,name:'Train spécial'});
  assert.equal(copy.number,'17803');
  assert.equal(copy.name,'Train spécial');
});
