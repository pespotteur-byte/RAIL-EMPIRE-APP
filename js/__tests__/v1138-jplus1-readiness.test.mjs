import assert from 'node:assert/strict';
import { parseScheduleClock, ScheduleState, ScheduledLocation, ScheduleVersion, PerformanceProfile } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { validateScheduleVersion } from '../schedule-v2-validation.js';

let n=0; const ok=(cond,msg)=>{n++;assert.ok(cond,msg);console.log(`ok ${n} - ${msg}`);};

// 1) Normal downstream midnight rollover remains automatic.
ok(parseScheduleClock('00:10',23*3600+55*60)===86400+10*60,'downstream 23:55 -> 00:10 becomes J+1');
// 2) First departure retime never infers J+1 from the OLD field value.
ok(parseScheduleClock('01:05',16*3600+19*60,{inferRollover:false,defaultDay:0})===65*60,'first departure 16:19 -> 01:05 stays on J');
// 3) Explicit (+1) remains authoritative.
ok(parseScheduleClock('01:05 (+1)',0,{inferRollover:false,defaultDay:0})===86400+65*60,'explicit (+1) is preserved');

function makeVersion(first=16*3600+19*60){
  const a=new ScheduledLocation({name:'A',order:0,departureSec:first,computedDepartureSec:first,departureOverride:true,track:{displayName:'V1',lat:48,lon:2}});
  const b=new ScheduledLocation({name:'B',order:1,arrivalSec:16*3600+30*60,computedArrivalSec:16*3600+30*60,arrivalOverride:true,departureSec:16*3600+32*60,computedDepartureSec:16*3600+32*60,departureOverride:true,dwellSec:120,track:{displayName:'V1',lat:48.001,lon:2.001}});
  const v=new ScheduleVersion({state:ScheduleState.VALID,performanceProfile:PerformanceProfile.genericForCategory('PASSENGER',160).toJSON(),locations:[a.toJSON(),b.toJSON()],outboundPath:{legs:[{fromLocationId:a.id,toLocationId:b.id,routePoints:[{lat:48,lon:2,maxSpeed:160},{lat:48.001,lon:2.001,maxSpeed:160}]}]}});
  return v;
}

// 4) Editing first departure shifts downstream manual overrides by the same delta.
{
  const v=makeVersion(); const a=v.locations[0],b=v.locations[1];
  const ed=Object.create(ScheduleV2Editor.prototype);
  Object.assign(ed,{game:{weather:null},_activeVersion:()=>v,_snapshot:()=>{},_markRecordChanged:()=>{},renderPanel:()=>{},draw:()=>{},_autosaveSoon:()=>{},_error:e=>{throw e;}});
  ed._handleStopField({target:{dataset:{stop:`${a.id}:dep`},value:'01:05'}});
  ok(a.departureSec===65*60 && b.arrivalSec===76*60 && b.departureSec===78*60,'retiming origin shifts downstream manual overrides without false J+1');
  const report=validateScheduleVersion(v,{ormAvailable:true});
  ok(!report.issues.some(i=>i.code==='NON_MONOTONIC_TIMING'||i.code==='NEGATIVE_DWELL'),'retimed schedule no longer creates false J+1 validation ordering errors');
}

// 5/6) Legacy dateOffsetDays is canonicalized once: preserve old shift on J, drop duplicate when timetable already J+1.
{
  const verJ={firstDepartureSec:3600,lastArrivalSec:7200,locations:[],outboundPath:{legs:[]}};
  const sm={getVersion:()=>verJ}; const rm=new RotationV2Manager(sm); const r=rm.addRotation({name:'R'}); const o=rm.addOccurrence(r.id,{scheduleId:'s',versionId:'v',dateOffsetDays:1}); rm.recalculateRotation(r.id);
  ok(o.dateOffsetDays===0 && o.offsetSec===86400 && o.resolvedStartSec===90000,'legacy day offset on J is folded into offsetSec exactly once');
  const verJ1={firstDepartureSec:86400+3600,lastArrivalSec:86400+7200,locations:[],outboundPath:{legs:[]}};
  const sm2={getVersion:()=>verJ1}; const rm2=new RotationV2Manager(sm2); const r2=rm2.addRotation({name:'R2'}); const o2=rm2.addOccurrence(r2.id,{scheduleId:'s',versionId:'v',dateOffsetDays:1}); rm2.recalculateRotation(r2.id);
  ok(o2.dateOffsetDays===0 && o2.offsetSec===0 && o2.resolvedStartSec===90000,'legacy day offset is discarded when timetable already carries (+1)');
}

// 7/8/9) Operational readiness is separate from schedule VALID state.
{
  const ver={id:'v',state:ScheduleState.VALID}; const rec={id:'s'};
  const fakeRm={rotations:[],getVehicle:()=>null,validateRotation:()=>[]};
  const ed=Object.create(ScheduleV2Editor.prototype);ed.game={rotationV2:fakeRm,realismSettings:{rotationsRequired:true}};
  ok(ed._operationalReadiness(rec,ver).code==='UNASSIGNED','VALID schedule with no rotation is NON AFFECTE');
  const occ={scheduleId:'s',versionId:'v',formation:{members:[]}};fakeRm.rotations=[{id:'r',enabled:true,occurrences:[occ]}];
  ok(ed._operationalReadiness(rec,ver).code==='NO_MATERIAL','assigned occurrence with empty formation is SANS MATERIEL');
  occ.formation.members=[{vehicleId:'loco',role:FormationRole.LEAD}];fakeRm.getVehicle=id=>id==='loco'?{id}:null;
  ok(ed._operationalReadiness(rec,ver).code==='READY','VALID + rotation + active traction is PRET A CIRCULER');
}

// 10) Livemap diagnostics exposes a valid but unassigned schedule instead of silence.
{
  const game={rotationV2:{rotations:[]},scheduleV2:{schedules:[{id:'s',number:'123',name:'Test',currentVersion:{state:'VALID'}}]},scheduleCreator:{services:[]},realismSettings:{rotationsRequired:true}};
  const rt=new ScheduleV2Runtime(game); const d=rt.diagnose(60,'2026-08-17');
  ok(d.items.some(x=>x.status.includes('HORS ROULEMENT')),'runtime diagnostics explicitly report valid unassigned schedules');
}
console.log(`1..${n}`);
