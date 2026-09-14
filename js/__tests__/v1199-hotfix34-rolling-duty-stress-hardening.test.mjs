import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode, OperatingCalendar } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';

function loc(id,station,sec,arrival=false,lat=48,lon=2){return new ScheduledLocation({id,stationId:station,name:station,track:new TrackBinding({wayId:`w-${id}`,displayName:'1',lat,lon,snapLat:lat,snapLon:lon}),arrivalSec:arrival?sec:null,departureSec:arrival?null:sec,dwellSec:0,stopCode:StopCode.C,arrivalOverride:arrival,departureOverride:!arrival});}
function schedule(sm,number,from,to,start,end,category=TrainCategory.PASSENGER,distance=100){const rec=sm.createDraft({number,name:number,category,maxSpeed:160}),v=rec.currentVersion;v.locations=[loc(`${number}-a`,from,start,false,48,2),loc(`${number}-b`,to,end,true,48.1,2.1)];v.locations.forEach((x,i)=>x.order=i);v.state=ScheduleState.VALID;v.outboundPath.distanceKm=distance;v.outboundPath.routePoints=[{lat:48,lon:2,wayId:`w-${number}`},{lat:48.1,lon:2.1,wayId:`w-${number}`}];v.outboundPath.legs=[{fromLocationId:v.locations[0].id,toLocationId:v.locations[1].id,distanceKm:distance,routePoints:v.outboundPath.routePoints,segments:[]}];return rec;}
function baseGame(){const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2),scheduleCreator=new ScheduleCreator();const world={stations:[],getStationById(id){return this.stations.find(x=>x.id===id)||null;}};const game={scheduleV2,rotationV2,scheduleCreator,world,realismSettings:{physics:1},rameManager:{getAll(){return[];},getById(){return null;}},engine:{getParisTime(){return{hours:8,minutes:30,seconds:0};},getParisDate(){return'2026-08-31';}},_currentDate:'2026-08-31',saveState(){}};game.scheduleV2Runtime=new ScheduleV2Runtime(game);return game;}

function assign(rm,rot,rec,vehicle,role=FormationRole.LEAD){return rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:vehicle.id,role}]}});}

test('HOTFIX34 catches a physical teleport between two different rolling lines before runtime',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:4400000});
  const a=schedule(sm,'17801','DIJ','LYO',8*3600,9*3600),b=schedule(sm,'17811','PAR','MAR',10*3600,11*3600),r1=rm.addRotation({name:'R Dijon'}),r2=rm.addRotation({name:'R Paris'});
  assign(rm,r1,a,v);assign(rm,r2,b,v);rm.recalculateRotation(r1.id);rm.recalculateRotation(r2.id);
  const gap=rm.validateMaterialConflicts().find(c=>c.code==='MATERIAL_LOCATION_GAP_GLOBAL'&&c.vehicleId===v.id);
  assert.ok(gap);assert.equal(gap.first.endLocationId,'LYO');assert.equal(gap.second.startLocationId,'PAR');assert.match(gap.message,/HLP\/acheminement/);
});

test('HOTFIX34 accepts a genuine cross-line handoff when both duties meet at the same station',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:4400000});
  const a=schedule(sm,'17801','DIJ','LYO',8*3600,9*3600),b=schedule(sm,'17806','LYO','DIJ',9*3600+15*60,10*3600+15*60),r1=rm.addRotation({name:'R1'}),r2=rm.addRotation({name:'R2'});
  assign(rm,r1,a,v);assign(rm,r2,b,v);rm.recalculateRotation(r1.id);rm.recalculateRotation(r2.id);
  assert.deepEqual(rm.validateMaterialConflicts(),[]);
});

test('HOTFIX34 an explicit HLP duty bridges geography between two otherwise incompatible lines',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5600000});
  const a=schedule(sm,'17801','DIJ','LYO',8*3600,9*3600),hlp=schedule(sm,'HLP01','LYO','PAR',9*3600+10*60,10*3600,TrainCategory.HLP,450),b=schedule(sm,'14001','PAR','MAR',10*3600+20*60,13*3600),r1=rm.addRotation({name:'TER'}),r2=rm.addRotation({name:'HLP'}),r3=rm.addRotation({name:'IC'});
  assign(rm,r1,a,v);assign(rm,r2,hlp,v);assign(rm,r3,b,v);for(const r of [r1,r2,r3])rm.recalculateRotation(r.id);
  assert.deepEqual(rm.validateMaterialConflicts(),[],'the explicit HLP is the physical bridge, so no teleport warning');
});

test('HOTFIX34 mutually exclusive weekday/weekend rotations may share one physical locomotive',()=>{
  const sm=new ScheduleV2Manager();sm.calendars.push(new OperatingCalendar({id:'wd',name:'Semaine',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[1,2,3,4,5]}));sm.calendars.push(new OperatingCalendar({id:'we',name:'Week-end',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[0,6]}));
  const rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'Z24501',category:'automotrice',powerW:2000000}),a=schedule(sm,'TER-WD','DIJ','LYO',8*3600,9*3600),b=schedule(sm,'TER-WE','DIJ','LYO',8*3600,9*3600),r1=rm.addRotation({name:'Semaine',calendarId:'wd'}),r2=rm.addRotation({name:'Weekend',calendarId:'we'});
  assign(rm,r1,a,v);assign(rm,r2,b,v);assert.deepEqual(rm.validateMaterialConflicts(),[]);
});

test('HOTFIX34 overlapping calendars still block a true double booking',()=>{
  const sm=new ScheduleV2Manager();sm.calendars.push(new OperatingCalendar({id:'all',name:'Tous',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[0,1,2,3,4,5,6]}));sm.calendars.push(new OperatingCalendar({id:'mon',name:'Lundi',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[1]}));
  const rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'Z24501',category:'automotrice',powerW:2000000}),a=schedule(sm,'A','DIJ','LYO',8*3600,9*3600),b=schedule(sm,'B','DIJ','LYO',8*3600+10*60,9*3600+10*60),r1=rm.addRotation({name:'Tous',calendarId:'all'}),r2=rm.addRotation({name:'Lundi',calendarId:'mon'});
  assign(rm,r1,a,v);assign(rm,r2,b,v);assert.ok(rm.validateMaterialConflicts().some(c=>c.code==='VEHICLE_DOUBLE_BOOKED'&&c.vehicleId===v.id));
});

test('HOTFIX34 editor validation exposes missing, disabled and disjoint calendars before runtime',()=>{
  const sm=new ScheduleV2Manager();sm.calendars.push(new OperatingCalendar({id:'wd',name:'Semaine',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[1,2,3,4,5]}));sm.calendars.push(new OperatingCalendar({id:'we',name:'Week-end',startDate:'2026-01-01',endDate:'2026-12-31',weekdays:[0,6]}));sm.calendars.push(new OperatingCalendar({id:'off',name:'Off',enabled:false}));
  const rm=new RotationV2Manager(sm),v=rm.addVehicle({number:'BB',category:'locomotive',powerW:1}),rec=schedule(sm,'CAL','A','B',8*3600,9*3600);rec.currentVersion.calendarIds=['we'];
  const disjoint=rm.addRotation({name:'Disjoint',calendarId:'wd'});assign(rm,disjoint,rec,v);assert.ok(rm.validateRotation(disjoint.id).some(i=>i.code==='ROTATION_SCHEDULE_CALENDAR_DISJOINT'));
  const missing=rm.addRotation({name:'Missing',calendarId:'gone'});assign(rm,missing,rec,v);assert.ok(rm.validateRotation(missing.id).some(i=>i.code==='ROTATION_CALENDAR_MISSING'));
  const off=rm.addRotation({name:'Off',calendarId:'off'});assign(rm,off,rec,v);assert.ok(rm.validateRotation(off.id).some(i=>i.code==='ROTATION_CALENDAR_DISABLED'));
});

test('HOTFIX34 stress: twelve independent lines compile twelve simultaneous physical trains',()=>{
  const g=baseGame(),rm=g.rotationV2;const plans=[];
  for(let i=0;i<12;i++){
    const from=`S${i}`,to=`T${i}`,rec=schedule(g.scheduleV2,`ST${String(i+1).padStart(2,'0')}`,from,to,8*3600,9*3600,i%4===3?TrainCategory.FREIGHT:TrainCategory.PASSENGER,80+i);
    const loco=rm.addVehicle({number:`L${i+1}`,category:'locomotive',traction:'diesel',powerW:3000000,massKg:80000,location:{kind:'STATION',id:from,lat:48,lon:2}});
    const trailer=rm.addVehicle({number:`C${i+1}`,category:i%4===3?'wagon':'voiture',powerW:0,massKg:40000,location:{kind:'STATION',id:from,lat:48,lon:2}});
    const coupon=rm.addCoupon({name:`Coupon ${i+1}`,vehicleIds:[trailer.id]});const rot=rm.addRotation({name:`Ligne ${i+1}`});
    rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD},{vehicleId:trailer.id,role:i%4===3?FormationRole.WAGON:FormationRole.COACH,sourceCouponId:coupon.id}]}});rm.recalculateRotation(rot.id);
    const plan=g.scheduleV2Runtime.planRotationForDate(rot,'2026-08-31')[0];plan._relNow=8*3600+30*60;plans.push(plan);
  }
  assert.equal(rm.validateMaterialConflicts().length,0);
  for(const p of plans)g.scheduleV2Runtime._compile(p);
  assert.equal(g.scheduleCreator.services.length,12);assert.equal(new Set(g.scheduleCreator.services.flatMap(s=>s._v2VehicleIds||[])).size,24,'every physical object belongs to exactly one live service');
  assert.equal(g.scheduleCreator.services.filter(s=>s.serviceType==='fret'||String(s.serviceType).toLowerCase().includes('fret')).length,3,'freight uses the same rolling-duty architecture');
});

test('HOTFIX34 stress validation remains practical with 60 lines / 120 physical vehicles',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm);
  for(let i=0;i<60;i++){const from=`A${i}`,to=`B${i}`,rec=schedule(sm,`P${i}`,from,to,6*3600+(i%12)*300,7*3600+(i%12)*300),l=rm.addVehicle({number:`BB${10000+i}`,category:'locomotive',powerW:4000000}),c=rm.addVehicle({number:`W${i}`,category:i%3?'voiture':'wagon'}),r=rm.addRotation({name:`R${i}`});rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD},{vehicleId:c.id,role:i%3?FormationRole.COACH:FormationRole.WAGON}]}});}
  const t0=performance.now(),conflicts=rm.validateMaterialConflicts(),elapsed=performance.now()-t0;assert.equal(conflicts.length,0);assert.ok(elapsed<750,`60-line validation took ${elapsed.toFixed(1)} ms`);
});

test('HOTFIX34 detects a daily J+1 self-overlap for a service longer than 24 hours',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm),rec=schedule(sm,'NIGHT-LONG','PAR','NIC',8*3600,33*3600),v=rm.addVehicle({number:'BB26000',category:'locomotive',powerW:5600000}),r=rm.addRotation({name:'Quotidien'});assign(rm,r,rec,v);
  const conflict=rm.validateMaterialConflicts().find(c=>c.code==='VEHICLE_DOUBLE_BOOKED'&&c.vehicleId===v.id&&c.second?.dayShift===1);assert.ok(conflict,'the J train still occupies the locomotive when the J+1 copy wants it');
});

test('HOTFIX34 does not invent J+1 overlap for an ordinary overnight train shorter than 24 hours',()=>{
  const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm),rec=schedule(sm,'NIGHT-OK','PAR','NIC',23*3600,25*3600+30*60),v=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5600000}),r=rm.addRotation({name:'Quotidien'});assign(rm,r,rec,v);
  assert.equal(rm.validateMaterialConflicts().filter(c=>c.code==='VEHICLE_DOUBLE_BOOKED').length,0);
});

test('HOTFIX34 source and UI expose global continuity diagnostics without changing player architecture',()=>{
  const model=fs.readFileSync(new URL('../rotation-v2-model.js',import.meta.url),'utf8'),editor=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
  assert.ok(model.includes('MATERIAL_LOCATION_GAP_GLOBAL'));assert.ok(model.includes('_rotationsCanRunWithDayShift'));assert.match(editor,/geo\s*=\s*c\.code\s*===\s*'MATERIAL_LOCATION_GAP_GLOBAL'/);assert.ok(editor.includes('Prévoir un HLP/CV'));
  for(const token of ['Toutes les lignes','Diagramme réel','Journée matériel','Formation affectée à la ligne'])assert.ok(editor.includes(token),token);
});
