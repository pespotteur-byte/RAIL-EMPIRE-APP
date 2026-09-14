import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleV2Manager, ScheduleState, TrainCategory, StopCode, LocationKind,
  ScheduleVersion, ScheduledLocation, TrackBinding, RouteConstraint, PerformanceProfile, formatScheduleClock,
  parseScheduleClock, OperatingCalendar, validateRoundTripPair,
} from '../schedule-v2-model.js';
import { validateScheduleVersion, applyValidationState } from '../schedule-v2-validation.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { recalculateScheduleTiming } from '../schedule-v2-timing.js';

test('J+N formatting and monotonic parsing', () => {
  assert.equal(formatScheduleClock(1*86400 + 1*3600 + 42*60), '01:42 (+1)');
  assert.equal(parseScheduleClock('01:42 (+2)'), 2*86400 + 1*3600 + 42*60);
  assert.equal(parseScheduleClock('01:00', 23*3600), 25*3600);
});

test('calendar exclusions and priority-ready matching', () => {
  const c = new OperatingCalendar({ startDate:'2026-07-01', endDate:'2026-08-31', weekdays:[0,1,2,3,4,5,6], excludedDates:['2026-07-14'] });
  assert.equal(c.matchesDate('2026-07-13'), true);
  assert.equal(c.matchesDate('2026-07-14'), false);
  assert.equal(c.matchesDate('2026-09-01'), false);
});

test('passenger stop codes are invalid and TAQ needs 5 min', () => {
  const mgr = new ScheduleV2Manager();
  const s = mgr.createDraft({ category: TrainCategory.PASSENGER });
  const v = s.currentVersion;
  const mk = (name, code, taq, dwell=120) => new ScheduledLocation({ kind:LocationKind.STATION, stationId:name, name, track:new TrackBinding({wayId:'1',displayName:'V1'}), stopCode:code, turnBack:taq, dwellSec:dwell });
  v.locations = [mk('A',StopCode.C,false), mk('B',StopCode.NONE,true,120)];
  v.outboundPath.routePoints = [{lat:0,lon:0},{lat:0.1,lon:0.1}];
  v.outboundPath.segments = [{wayId:'1',maxSpeed:100,maxSpeedSource:'OSM',electrified:true}];
  const r = validateScheduleVersion(v);
  assert.ok(r.errors.some(x => x.code === 'PASSENGER_STOP_CODE'));
  assert.ok(r.errors.some(x => x.code === 'TAQ_MIN_DWELL'));
});

test('valid draft can become VALID, zero automatic margin is immutable', () => {
  const mgr = new ScheduleV2Manager();
  const s = mgr.createDraft({ category: TrainCategory.FREIGHT });
  const v = s.currentVersion;
  v.locations = ['A','B'].map((name,i)=>new ScheduledLocation({ kind:LocationKind.STATION, order:i, stationId:name, name, track:{wayId:'1',displayName:`V${i+1}`,lat:0,lon:i?0.1:0,snapLat:0,snapLon:i?0.1:0}, arrivalSec:i?600:null, departureSec:i?600:0 }));
  v.outboundPath.routePoints = [{lat:0,lon:0,maxSpeed:100},{lat:0,lon:0.1,maxSpeed:100}];
  v.outboundPath.segments = [{wayId:'1',from:{lat:0,lon:0},to:{lat:0,lon:0.1},maxSpeed:100,maxSpeedSource:'OSM',electrified:true}];
  v.outboundPath.legs = [{id:'leg-a-b',fromLocationId:v.locations[0].id,toLocationId:v.locations[1].id,constraintIds:[],routePoints:[{lat:0,lon:0,maxSpeed:100},{lat:0,lon:0.1,maxSpeed:100}],segments:v.outboundPath.segments,distanceKm:11}];
  const report = validateScheduleVersion(v);
  assert.equal(report.canValidate, true);
  applyValidationState(v, report);
  assert.equal(v.state, ScheduleState.VALID);
  assert.equal(v.automaticMarginSec, 0);
});

test('generated train numbers are unique while internal ids remain independent', () => {
  const mgr = new ScheduleV2Manager();
  const a = mgr.createDraft({number:'17801'});
  const b = mgr.createDraft({number:'17801'});
  assert.notEqual(a.id,b.id);
  assert.equal(a.number,'17801');
  assert.notEqual(b.number,a.number);
  assert.equal(mgr.isTrainNumberAvailable('17801',a.id),true);
  assert.equal(mgr.isTrainNumberAvailable('17801',b.id),false);
});

test('Vmax profile uses fixed category standard', () => {
  const p = PerformanceProfile.genericForCategory(TrainCategory.HLP, 100);
  assert.equal(p.maxSpeed,100);
  assert.ok(p.powerW > 0);
  assert.ok(p.massKg > 0);
});

test('physical vehicle numbers and coupon names are unique', () => {
  const rm = new RotationV2Manager();
  rm.addVehicle({number:'BB 22201'});
  assert.throws(()=>rm.addVehicle({number:'BB 22201'}));
  const c1=rm.addVehicle({number:'C301-1',category:'coach',massKg:40000});
  const c2=rm.addVehicle({number:'C302-1',category:'coach',massKg:40000});
  rm.addCoupon({name:'Coupon 301',vehicleIds:[c1.id]});
  assert.throws(()=>rm.addCoupon({name:'coupon 301',vehicleIds:[c2.id]}));
});

test('CV adds mass but not traction power', () => {
  const rm = new RotationV2Manager();
  const a=rm.addVehicle({number:'BB 1',massKg:90000,powerW:5000000,maxSpeed:160});
  const b=rm.addVehicle({number:'BB 2',massKg:90000,powerW:5000000,maxSpeed:160});
  const f={ members:[{vehicleId:a.id,role:FormationRole.LEAD},{vehicleId:b.id,role:FormationRole.VEHICLE}] };
  const rot=rm.addRotation({name:'R'});
  const occ=rm.addOccurrence(rot.id,{scheduleId:'x',formation:f});
  const calc=occ.formation.calculate(rm);
  assert.equal(calc.massKg,180000);
  assert.equal(calc.powerW,5000000);
});

test('material double booking is blocking conflict', () => {
  const sm=new ScheduleV2Manager();
  const s=sm.createDraft({}); const v=s.currentVersion;
  v.locations=[new ScheduledLocation({departureSec:0}),new ScheduledLocation({arrivalSec:3600})];
  const rm=new RotationV2Manager(sm);
  const veh=rm.addVehicle({number:'X1',massKg:1000,powerW:1});
  const r1=rm.addRotation({name:'R1'}), r2=rm.addRotation({name:'R2'});
  rm.addOccurrence(r1.id,{scheduleId:s.id,versionId:v.id,formation:{members:[{vehicleId:veh.id,role:FormationRole.LEAD}]}});
  rm.addOccurrence(r2.id,{scheduleId:s.id,versionId:v.id,formation:{members:[{vehicleId:veh.id,role:FormationRole.LEAD}]}});
  const conflicts=rm.validateMaterialConflicts();
  const vehicleConflicts=conflicts.filter(c=>c.code==='VEHICLE_DOUBLE_BOOKED');
  assert.equal(vehicleConflicts.length,1);
  assert.equal(vehicleConflicts[0].vehicleId,veh.id);
  assert.ok(conflicts.some(c=>c.code==='SCHEDULE_DOUBLE_ASSIGNED'),'the same published timetable is also diagnosed as duplicated');
});

test('V2 save migrates supported legacy schema and rejects incompatible raw/future data', () => {
  const sm=new ScheduleV2Manager();
  assert.equal(sm.loadFromSave([{name:'legacy'}]),false,'raw pre-schema arrays remain unsupported');
  assert.equal(sm.loadFromSave({schemaVersion:1,schedules:[],calendars:[],roundTrips:[],technicalLocations:[]}),true,'schema 1 has an explicit migration path');
  assert.equal(sm.loadFromSave({schemaVersion:999,schedules:[]}),false,'unknown future schemas fail closed');
  const a=sm.createDraft({name:'A',number:'1'});
  const save=sm.toSave();
  const sm2=new ScheduleV2Manager();
  assert.equal(sm2.loadFromSave(save),true);
  assert.equal(sm2.schedules.length,1);
});

test('Schedule duplication rekeys location/VIA ids and can shift a valid timetable', () => {
  const mgr = new ScheduleV2Manager();
  const rec = mgr.createDraft({ number: '17801', name: 'Base' });
  const v = rec.currentVersion;
  v.locations = [
    new ScheduledLocation({ id:'old-a', order:0, stationId:'A', name:'A', track:{wayId:'1',displayName:'V1'}, departureSec:1000 }),
    new ScheduledLocation({ id:'old-b', order:1, stationId:'B', name:'B', track:{wayId:'2',displayName:'V2'}, arrivalSec:2000, departureSec:2120 }),
  ];
  v.outboundPath.constraints = [new RouteConstraint({id:'old-via',order:0,wayId:'9',lat:1,lon:1,legIndex:0})];
  v.outboundPath.legs = [{id:'old-leg',fromLocationId:'old-a',toLocationId:'old-b',constraintIds:['old-via'],routePoints:[{lat:0,lon:0},{lat:1,lon:1}],segments:[],distanceKm:1}];
  v.state = ScheduleState.VALID;
  const copy = mgr.duplicateSchedule(rec.id,{state:ScheduleState.VALID,numberDelta:2,timeShiftSec:3600});
  assert.equal(copy.number,'17803');
  assert.notEqual(copy.currentVersion.locations[0].id,'old-a');
  assert.notEqual(copy.currentVersion.outboundPath.constraints[0].id,'old-via');
  assert.equal(copy.currentVersion.outboundPath.legs[0].fromLocationId,copy.currentVersion.locations[0].id);
  assert.equal(copy.currentVersion.locations[0].departureSec,4600);
});

test('rotation operation window adds sequential actions and overlaps parallel ones', () => {
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'1'});const v=rec.currentVersion;
  v.locations=[new ScheduledLocation({id:'A',stationId:'A',name:'A',track:{wayId:'1',displayName:'V1'},departureSec:0,dwellSec:1200}),new ScheduledLocation({id:'B',stationId:'B',name:'B',track:{wayId:'2',displayName:'V2'},arrivalSec:3600})];
  const rm=new RotationV2Manager(sm);const rot=rm.addRotation({name:'R'});const occ=rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});
  const a=rm.addVehicle({number:'A'}),b=rm.addVehicle({number:'B'}),c=rm.addVehicle({number:'C'});
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'A',vehicleIds:[a.id],durationSec:300,forcedExecutionMode:'SEQUENTIAL'});
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'A',vehicleIds:[b.id],durationSec:300,forcedExecutionMode:'SEQUENTIAL'});
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'A',vehicleIds:[c.id],durationSec:300,forcedExecutionMode:'PARALLEL'});
  assert.equal(rm.operationWindowSec(rot.id,occ.id,'A'),600);
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'A',vehicleIds:[b.id],durationSec:300});
  assert.equal(rm.operationWindowSec(rot.id,occ.id,'A'),900);
});


test('AR duplication creates +2/+1 numbering, shifts timetable and can append to an existing rotation', () => {
  const sm = new ScheduleV2Manager();
  const out = sm.createDraft({number:'17801',name:'Dijon → Lyon'});
  const ret = sm.createDraft({number:'17802',name:'Lyon → Dijon'});
  const seed = (rec, dep, from='A', to='B') => {
    const v=rec.currentVersion;
    v.state=ScheduleState.VALID;
    v.locations=[
      new ScheduledLocation({stationId:from,name:from,track:{wayId:'1',displayName:'V1'},departureSec:dep}),
      new ScheduledLocation({stationId:to,name:to,track:{wayId:'2',displayName:'V2'},arrivalSec:dep+1800}),
    ];
    v.outboundPath.routePoints=[{lat:0,lon:0},{lat:0.1,lon:0.1}];
  };
  seed(out,6*3600+40*60,'A','B'); seed(ret,8*3600,'B','A');
  const group=sm.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:1200});
  const rm=new RotationV2Manager(sm); const rot=rm.addRotation({name:'Bourgogne R1'});
  const made=sm.duplicateRoundTrip(group.id,{intervalSec:3600,horizonSec:7200,rotationId:rot.id},rm);
  assert.equal(made.length,2);
  assert.equal(made[0].outbound.number,'17803');
  assert.equal(made[0].return.number,'17804');
  assert.equal(made[1].outbound.number,'17805');
  assert.equal(made[1].return.number,'17806');
  assert.equal(made[0].outbound.currentVersion.firstDepartureSec,out.currentVersion.firstDepartureSec+3600);
  assert.equal(rot.occurrences.length,4);
});

test('real assigned material recalculates duration and pushes the following occurrence', () => {
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'100',category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;
  const a=new ScheduledLocation({stationId:'A',name:'A',track:{wayId:'1',displayName:'1'},departureSec:0});
  const b=new ScheduledLocation({stationId:'B',name:'B',track:{wayId:'2',displayName:'2'}});
  v.locations=[a,b];
  v.outboundPath.routePoints=[{lat:48,lon:2,maxSpeed:160},{lat:48.18,lon:2,maxSpeed:160}];
  v.outboundPath.legs=[{fromLocationId:a.id,toLocationId:b.id,routePoints:v.outboundPath.routePoints}];
  recalculateScheduleTiming(v,{firstDepartureSec:0});
  v.state=ScheduleState.VALID;
  const referenceDuration=v.lastArrivalSec-v.firstDepartureSec;
  const rm=new RotationV2Manager(sm);
  const slow=rm.addVehicle({number:'Slow 1',category:'LOCOMOTIVE',massKg:90000,powerW:1000000,maxSpeed:60,lengthM:20,traction:'diesel'});
  const rot=rm.addRotation({name:'R'});
  const formation={members:[{vehicleId:slow.id,role:FormationRole.LEAD}]};
  const o1=rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation});
  const o2=rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id,formation});
  rm.recalculateRotation(rot.id);
  assert.ok((o1.resolvedEndSec-o1.resolvedStartSec)>referenceDuration);
  assert.equal(o2.resolvedStartSec,o1.resolvedEndSec);
  assert.ok(o1.warnings.some(w=>w.code==='MATERIAL_TOO_SLOW'&&w.approvalRequired===false));
  assert.equal(rm.timingMismatchNeedsApproval(o1),false);
});

test('rotation validation catches operation windows that no longer fit after timetable edit', () => {
  const sm=new ScheduleV2Manager();
  const rec=sm.createDraft({number:'OP1'}); const v=rec.currentVersion;
  v.state=ScheduleState.VALID;
  v.locations=[
    new ScheduledLocation({id:'A',stationId:'A',name:'A',track:{wayId:'1',displayName:'V1'},departureSec:0,dwellSec:300}),
    new ScheduledLocation({id:'B',stationId:'B',name:'B',track:{wayId:'2',displayName:'V2'},arrivalSec:1800,departureSec:2100,dwellSec:300}),
    new ScheduledLocation({id:'C',stationId:'C',name:'C',track:{wayId:'3',displayName:'V3'},arrivalSec:3600,dwellSec:0}),
  ];
  const rm=new RotationV2Manager(sm); const rot=rm.addRotation({name:'R'}); const occ=rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:v.id});
  const a=rm.addVehicle({number:'A'}),b=rm.addVehicle({number:'B'});
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'B',vehicleIds:[a.id],durationSec:300,forcedExecutionMode:'SEQUENTIAL'});
  rm.addAction(rot.id,{occurrenceId:occ.id,locationOccurrenceId:'B',vehicleIds:[b.id],durationSec:300,forcedExecutionMode:'SEQUENTIAL'});
  const issues=rm.validateRotation(rot.id);
  assert.ok(issues.some(i=>i.code==='OPERATION_DWELL_TOO_SHORT'&&i.requiredSec===600));
});

test('new schedule versions keep content but receive independent stop/VIA identities', () => {
  const sm=new ScheduleV2Manager(); const rec=sm.createDraft({number:'V1'}); const v1=rec.currentVersion;
  const a=new ScheduledLocation({id:'loc-a',stationId:'A',name:'A',track:{wayId:'1',displayName:'1'}});
  const b=new ScheduledLocation({id:'loc-b',stationId:'B',name:'B',track:{wayId:'2',displayName:'2'}});
  v1.locations=[a,b]; v1.outboundPath.constraints=[new RouteConstraint({id:'via-a',wayId:'9',legIndex:0})];
  v1.outboundPath.legs=[{id:'leg-a',fromLocationId:a.id,toLocationId:b.id,constraintIds:['via-a'],routePoints:[]}];
  const v2=rec.createVersion();
  assert.equal(v2.locations[0].name,'A');
  assert.notEqual(v2.locations[0].id,v1.locations[0].id);
  assert.notEqual(v2.outboundPath.constraints[0].id,v1.outboundPath.constraints[0].id);
  assert.equal(v2.outboundPath.legs[0].fromLocationId,v2.locations[0].id);
});

test('cursor-position station binding is valid without an OSM way id', () => {
  const t = new TrackBinding({displayName:'Voie 2',lat:49.0385,lon:3.4099,snapLat:49.0385,snapLon:3.4099});
  assert.equal(t.wayId,'');
  assert.equal(t.complete,true);
  const sm=new ScheduleV2Manager();const rec=sm.createDraft({category:TrainCategory.PASSENGER});const v=rec.currentVersion;
  v.locations=[
    new ScheduledLocation({stationId:'A',name:'A',track:{displayName:'1',lat:49.0,lon:3.4,snapLat:49.0,snapLon:3.4},departureSec:0}),
    new ScheduledLocation({stationId:'B',name:'B',track:{displayName:'2',lat:49.1,lon:3.5,snapLat:49.1,snapLon:3.5},arrivalSec:600}),
  ];
  v.outboundPath.routePoints=[{lat:49,lon:3.4},{lat:49.1,lon:3.5}];
  v.outboundPath.segments=[{wayId:'real-way',maxSpeed:100,maxSpeedSource:'OSM',electrified:true}];
  const report=validateScheduleVersion(v);
  assert.equal(report.issues.some(i=>i.code==='TRACK_MISSING'),false);
});


test('V1.1.30 validation groups repeated preferred-direction warnings into one player-facing issue',()=>{
  const v=new ScheduleVersion({category:TrainCategory.FREIGHT});
  v.locations=[
    new ScheduledLocation({id:'wa',stationId:'A',name:'A',track:new TrackBinding({displayName:'V1',lat:48,lon:2}),departureSec:3600}),
    new ScheduledLocation({id:'wb',stationId:'B',name:'B',track:new TrackBinding({displayName:'V2',lat:48.1,lon:2.1}),arrivalSec:4000,departureSec:4120}),
  ];
  v.outboundPath.routePoints=[{lat:48,lon:2},{lat:48.05,lon:2.05},{lat:48.1,lon:2.1}];
  v.outboundPath.segments=[
    {wayId:'100',fallback:false,maxSpeedSource:'OSM',electrified:false,preferredDirection:'forward',_againstPreferredDirection:true,voltage:[],frequency:[]},
    {wayId:'101',fallback:false,maxSpeedSource:'OSM',electrified:false,preferredDirection:'forward',_againstPreferredDirection:true,voltage:[],frequency:[]},
  ];
  const r=validateScheduleVersion(v);
  const warnings=r.issues.filter(i=>i.code==='AGAINST_PREFERRED_DIRECTION');
  assert.equal(warnings.length,1);
  assert.equal(warnings[0].data.sectionCount,2);
  assert.deepEqual(warnings[0].data.wayIds,['100','101']);
});


test('round-trip pair validation enforces B→A continuity and terminal layover', () => {
  const sm=new ScheduleV2Manager();
  const out=sm.createDraft({number:'1001'}), ret=sm.createDraft({number:'1002'});
  const make=(rec,a,b,dep,arr)=>{
    const v=rec.currentVersion;
    v.locations=[
      new ScheduledLocation({stationId:a,name:a,track:{lat:48,lon:2,displayName:'1'},departureSec:dep}),
      new ScheduledLocation({stationId:b,name:b,track:{lat:48.01,lon:2.01,displayName:'2'},arrivalSec:arr}),
    ];
    return v;
  };
  const ov=make(out,'A','B',1000,2000);
  const rv=make(ret,'B','A',2300,3300);
  assert.equal(validateRoundTripPair(ov,rv,{terminalLayoverSec:300}).length,0);
  rv.locations[0].stationId='C';
  rv.locations[1].stationId='D';
  const mismatch=validateRoundTripPair(ov,rv,{terminalLayoverSec:300});
  assert.ok(mismatch.some(i=>i.code==='ROUND_TRIP_TERMINAL_MISMATCH'));
  assert.ok(mismatch.some(i=>i.code==='ROUND_TRIP_ORIGIN_MISMATCH'));
  rv.locations[0].stationId='B'; rv.locations[1].stationId='A'; rv.locations[0].departureSec=2200;
  assert.ok(validateRoundTripPair(ov,rv,{terminalLayoverSec:300}).some(i=>i.code==='ROUND_TRIP_TURNAROUND_TOO_SHORT'));
});

test('round-trip duplication refuses a pair that does not return to the outbound origin', () => {
  const sm=new ScheduleV2Manager();
  const seed=(rec,a,b,dep)=>{
    const v=rec.currentVersion;v.state=ScheduleState.VALID;
    v.locations=[
      new ScheduledLocation({stationId:a,name:a,track:{lat:48,lon:2,displayName:'1'},departureSec:dep}),
      new ScheduledLocation({stationId:b,name:b,track:{lat:48.01,lon:2.01,displayName:'2'},arrivalSec:dep+600}),
    ];
    v.outboundPath.routePoints=[{lat:48,lon:2},{lat:48.01,lon:2.01}];
  };
  const out=sm.createDraft({number:'1001'}),ret=sm.createDraft({number:'1002'});
  seed(out,'A','B',1000);seed(ret,'C','D',2000);
  const g=sm.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id});
  assert.throws(()=>sm.duplicateRoundTrip(g.id,{intervalSec:3600,horizonSec:3600}),/retour doit/i);
});


test('round-trip duplication keeps absolute J+1 timing across midnight', () => {
  const sm=new ScheduleV2Manager();
  const seed=(rec,from,to,dep,arr)=>{
    const v=rec.currentVersion;v.state=ScheduleState.VALID;
    v.locations=[
      new ScheduledLocation({stationId:from,name:from,track:{lat:48,lon:2,displayName:'1'},departureSec:dep}),
      new ScheduledLocation({stationId:to,name:to,track:{lat:48.01,lon:2.01,displayName:'2'},arrivalSec:arr}),
    ];
  };
  const out=sm.createDraft({number:'17801'}),ret=sm.createDraft({number:'17802'});
  seed(out,'A','B',23*3600+30*60,23*3600+50*60);
  seed(ret,'B','A',24*3600+10*60,24*3600+30*60);
  const g=sm.addRoundTrip({outboundScheduleId:out.id,returnScheduleId:ret.id,terminalLayoverSec:20*60});
  const made=sm.duplicateRoundTrip(g.id,{intervalSec:3600,horizonSec:7200});
  assert.equal(made[0].outbound.number,'17803');
  assert.equal(formatScheduleClock(made[0].outbound.currentVersion.firstDepartureSec),'00:30 (+1)');
  assert.equal(made[0].return.number,'17804');
  assert.equal(formatScheduleClock(made[0].return.currentVersion.firstDepartureSec),'01:10 (+1)');
});
