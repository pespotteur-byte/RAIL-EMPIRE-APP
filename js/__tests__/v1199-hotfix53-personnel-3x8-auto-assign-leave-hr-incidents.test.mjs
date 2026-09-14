import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaffManager, STAFF_SHIFT_GROUPS, HR_INCIDENT_TYPES } from '../staff.js';
import { Unions } from '../unions.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=10_000_000)=>({
  balance,
  expenses:[],
  addExpense(amount,cat,label){this.balance-=Number(amount)||0;this.expenses.push({amount,cat,label});},
  getEffectiveFraudRate(){return 0;},
});

function fakeGame({depots=[],stations=[],services=[]}={}){
  return {
    economy:economy(),
    depotManager:{getDepots:()=>depots},
    world:{stations},
    scheduleCreator:{getActiveServices:()=>services},
    dashboard:{punctualityHistory:[]},
    engine:{getParisDate:()=> '2026-09-02'},
    _currentDate:'2026-09-02',
    saveState(){},
  };
}

function hire(sm, role, count=1, assignedTo=null){
  const eco=economy();
  return sm.hire(eco,'',role,{count,generateEach:true,assignedTo}) || [];
}

test('HOTFIX53 fixed operational staff are spread over three real 8-hour teams',()=>{
  const sm=new StaffManager();
  const people=hire(sm,'agent_maintenance',3,'D1');
  assert.equal(people.length,3);
  assert.deepEqual(people.map(x=>x.shiftGroup).sort(),[0,1,2]);
  for(const p of people)p.weeklyRestDay=6; // avoid weekly day-off in this deterministic check
  sm._tickFixedShiftStates(60,'2026-09-02',0);
  assert.equal(sm.getCurrentShiftGroup(60).id,0);
  assert.equal(people.filter(x=>x.onDuty).length,1);
  assert.equal(people.find(x=>x.shiftGroup===0).onDuty,true);
  sm._tickFixedShiftStates(500,'2026-09-02',0);
  assert.equal(sm.getCurrentShiftGroup(500).id,1);
  assert.equal(people.filter(x=>x.onDuty).length,1);
  assert.equal(people.find(x=>x.shiftGroup===1).onDuty,true);
  assert.equal(STAFF_SHIFT_GROUPS.map(x=>x.hours).join('|'),'00:00–08:00|08:00–16:00|16:00–00:00');
});

test('HOTFIX53 conductors are automatically allocated to trains and receive 16h rest after an 8h shift',()=>{
  const sm=new StaffManager();
  const [driver]=hire(sm,'conducteur',1);
  driver.shiftGroup=0;driver.weeklyRestDay=6;
  const svc={id:'svc-1',active:true,completed:false,cancelled:false,state:'waiting',stops:[{departureTime:60}],currentStopIndex:0};
  sm.rebalanceConductorShifts([svc]);
  sm.tickConductors([svc],0,'2026-09-02');
  assert.equal(driver.assignedTo,'svc-1');
  assert.equal(sm.hasAssignedConductor('svc-1'),true);
  svc.state='stopped_at_station';
  sm.tickConductors([svc],480,'2026-09-02');
  assert.equal(driver.assignedTo,null);
  assert.equal(driver.resting,true);
  assert.equal(driver.restType,'daily');
  assert.equal(driver.restRemainingMin,960);
});

test('HOTFIX53 background assignment distributes personnel to compatible workplaces',()=>{
  const sm=new StaffManager();
  const people=hire(sm,'agent_maintenance',4);
  const depots=[{id:'D1',name:'Dépôt 1',built:true},{id:'D2',name:'Dépôt 2',built:true}];
  const game=fakeGame({depots});
  const assigned=sm.autoAssignAll(game);
  assert.equal(assigned,4);
  assert.ok(people.every(p=>['D1','D2'].includes(p.assignedTo)));
  const counts=depots.map(d=>people.filter(p=>p.assignedTo===d.id).length);
  assert.ok(Math.abs(counts[0]-counts[1])<=1);
});

test('HOTFIX53 annual leave has a real 25-day bank, cannot go below zero, and returns staff after the block',()=>{
  const sm=new StaffManager();
  const [m]=hire(sm,'agent_gare',1);
  m.leaveYear=2026;m.leaveDaysRemaining=0;
  let r=sm.requestLeave(m.id,5,'2026-09-02');
  assert.equal(r.ok,false);
  assert.match(r.reason,/épuisé/i);
  m.leaveDaysRemaining=25;
  r=sm.requestLeave(m.id,5,'2026-09-02');
  assert.equal(r.ok,true);
  assert.equal(m.onLeave,true);
  assert.equal(m.leaveDaysRemaining,20);
  for(const d of ['2026-09-03','2026-09-04','2026-09-05','2026-09-06','2026-09-07']) sm.processDailyHR(fakeGame(),d,{random:()=>0.99});
  assert.equal(m.onLeave,false);
  assert.equal(m.leaveRemainingDays,0);
  assert.ok(m.nextLeaveDate>'2026-09-07');
});

test('HOTFIX53 planned leave is automatically started on its date and persists through save/load',()=>{
  const sm=new StaffManager();
  const [m]=hire(sm,'agent_maintenance',1,'D1');
  m.leaveYear=2026;m.leaveDaysRemaining=25;m.nextLeaveDate='2026-09-10';m.weeklyRestDay=6;
  const out=sm.processDailyHR(fakeGame({depots:[{id:'D1',name:'D1',built:true}]}),'2026-09-10',{random:()=>0.99});
  assert.equal(out.leaves,1);
  assert.equal(m.onLeave,true);
  assert.equal(m.leaveDaysRemaining,20);
  const saved=sm.toSave();
  const loaded=new StaffManager();loaded.loadFromSave(saved);
  const copy=loaded.staff.find(x=>x.id===m.id);
  assert.equal(copy.onLeave,true);
  assert.equal(copy.leaveRemainingDays,5);
  assert.equal(copy.leaveDaysRemaining,20);
});

test('HOTFIX53 individual HR incidents really trigger and create an absence/event',()=>{
  const sm=new StaffManager();
  const [m]=hire(sm,'agent_gare',1);
  m.leaveYear=2026;m.leaveDaysRemaining=25;m.weeklyRestDay=6;
  const rng={random:()=>0};
  const out=sm.processDailyHR(fakeGame(),'2026-09-02',rng);
  assert.equal(out.processed,true);
  assert.equal(out.incidents,1);
  assert.equal(m.absenceType,'sick_leave');
  assert.ok(m.absenceRemainingDays>=HR_INCIDENT_TYPES.sick_leave.minDays);
  assert.ok(sm.hrEvents.some(e=>e.staffId===m.id&&e.type==='incident'));
});

test('HOTFIX53 social movement/strike check can trigger without requiring a conductor and is date-deduplicated',()=>{
  const u=new Unions();
  const staffMember={id:'S1',role:'agent_maintenance',socialRisk:0,shiftWorkedMin:0,lastWeeklyRestDate:'2026-09-02',hireDate:Date.now()};
  const game={
    economy:{balance:-1000},
    staffManager:{staff:[staffMember],getDailySalaryExpense:()=>50,getByRole:()=>[]},
    scheduleCreator:{getActiveServices:()=>[]},dashboard:{punctualityHistory:[]},
    engine:{getParisDate:()=> '2026-09-02'},_currentDate:'2026-09-02',
  };
  const rng={random:()=>0};
  const first=u.dailyUpdate(game,rng);
  assert.equal(first,true);
  assert.equal(u.strikeActive,true);
  assert.equal(u.strikePercent,80);
  assert.equal(u._strikeHistory.length,1);
  const days=u.strikeDaysLeft;
  const second=u.dailyUpdate(game,rng);
  assert.equal(second,false);
  assert.equal(u.strikeDaysLeft,days);
  assert.equal(u._strikeHistory.length,1);
});

test('HOTFIX53 dismissal works for assigned staff and waits safely for an active task/service',()=>{
  const sm=new StaffManager();
  const [fixed]=hire(sm,'agent_maintenance',1,'D1');
  let r=sm.requestFire(fixed.id,'2026-09-02');
  assert.deepEqual(r,{ok:true,pending:false});
  assert.equal(sm.staff.some(x=>x.id===fixed.id),false);

  const [busy]=hire(sm,'agent_maintenance',1,'D1');
  busy.busyTaskId='op-1';busy.busyTaskLabel='Reprofilage';
  r=sm.requestFire(busy.id,'2026-09-02');
  assert.equal(r.ok,true);assert.equal(r.pending,true);assert.equal(busy.pendingDismissal,true);
  busy.busyTaskId='';busy.busyTaskLabel='';
  assert.equal(sm._processPendingDismissals('2026-09-02'),1);
  assert.equal(sm.staff.some(x=>x.id===busy.id),false);

  const [driver]=hire(sm,'conducteur',1);
  driver.assignedTo='svc-x';
  r=sm.requestFire(driver.id,'2026-09-02');
  assert.equal(r.pending,true);
  driver.assignedTo=null;
  assert.equal(sm._processPendingDismissals('2026-09-02'),1);
  assert.equal(sm.dismissalHistory.length,3);
});

test('HOTFIX53 UI is reorganized around overview, assignments, 3x8/leave, social incidents and roster',()=>{
  const src=read('js/staff.js'),css=read('style.css');
  for(const txt of ['Vue générale','Embauche & métiers','Affectations','3×8 & congés','Social & incidents','Effectifs','Réaffecter maintenant','Affectation automatique','Congé 5j','Licencier']) assert.match(src,new RegExp(txt.replace(/[×&]/g,m=>m==='×'?'×':'&')));
  assert.match(src,/Rechercher un agent, métier, dépôt, tâche/);
  assert.match(src,/Équipe A/);assert.match(src,/Équipe B/);assert.match(src,/Équipe C/);
  assert.match(src,/25 jours\/an/);
  assert.match(css,/\.staff-tabs/);assert.match(css,/\.staff-shift-grid/);assert.match(css,/\.staff-status\.leave/);
});

test('HOTFIX53 game loop, train gate and unions are wired to the personnel simulation',()=>{
  const main=read('js/main.js'),sc=read('js/schedule-creator.js'),unions=read('js/unions.js');
  assert.match(main,/tickWorkforce\(this, activeSchedules, timeOfDay, dateStr\)/);
  assert.match(sc,/personnel : conducteur indisponible/);
  assert.match(sc,/hasAssignedConductor/);
  assert.match(unions,/dailyUpdate\(game, rng = getGlobalRng\(\), settlementDate\)/);
  assert.match(unions,/realStaffCount > 0/);
  assert.match(unions,/_lastDailyDate/);
});


test('HOTFIX53 FILE bundle/cache contains the complete RH runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(bundle,/HOTFIX53-PERSONNEL-3X8-AUTO-ASSIGN-LEAVE-HR-INCIDENTS/);
  assert.match(bundle,/Affectation automatique/);
  assert.match(bundle,/Arrêt maladie/);
  assert.match(bundle,/Repos conducteur/);
  assert.match(bundle,/Licenciement programmé/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
