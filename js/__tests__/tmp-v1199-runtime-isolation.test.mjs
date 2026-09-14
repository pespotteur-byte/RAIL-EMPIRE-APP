import test from 'node:test';
import assert from 'node:assert/strict';
import {ScheduleV2Runtime} from '../schedule-v2-runtime.js';

function game(){
  const rotations=[
    {id:'bad',name:'Bad',enabled:true,calendarId:'',occurrences:[]},
    {id:'good',name:'Good',enabled:true,calendarId:'',occurrences:[]},
  ];
  return {
    rotationV2:{rotations,directAssignments:[]},
    scheduleV2:{calendars:[],getSchedule(){return {number:'1'};}},
    scheduleCreator:{services:[]},
  };
}

test('one broken rotation plan cannot abort later rotations',()=>{
  const g=game(); const rt=new ScheduleV2Runtime(g);
  let goodSeen=false;
  rt._roughLookback=()=>0; rt._rotationRuns=()=>true;
  rt._plansForRotationDate=(r)=>{if(r.id==='bad')throw new Error('broken'); goodSeen=true; return [];};
  rt._finalizeServices=()=>{}; rt._pruneSeasonallyInactive=()=>{};
  rt.sync(600,'2026-08-25');
  assert.equal(goodSeen,true);
  assert.ok(rt.alerts.some(a=>a.code==='ROTATION_RUNTIME_PLAN_FAILED'));
});

test('one compile failure cannot abort later due plans',()=>{
  const g=game(); const rt=new ScheduleV2Runtime(g);
  const mk=(id,start)=>({rotation:{id,name:id},occ:{id:'o',scheduleId:'s'},baseDate:'2026-08-25',ver:{},startSec:start,endSec:start+3600,prepStartSec:start-60});
  rt._runtimeRotations=()=>[{id:'R',enabled:true,calendarId:'',occurrences:[]}];
  rt._roughLookback=()=>0; rt._rotationRuns=()=>true; rt._plansForRotationDate=()=>[mk('bad',36000),mk('good',36001)];
  rt._snapshotCanRestore=()=>false; rt._finalizeServices=()=>{}; rt._pruneSeasonallyInactive=()=>{};
  const compiled=[]; rt._compile=(p)=>{if(p.rotation.id==='bad')throw new Error('compile boom'); compiled.push(p.rotation.id);};
  // 600 min = 36000 s
  rt.sync(600,'2026-08-25');
  assert.deepEqual(compiled,['good']);
  assert.ok(rt.alerts.some(a=>a.code==='V2_COMPILE_FAILED_ISOLATED'));
});
