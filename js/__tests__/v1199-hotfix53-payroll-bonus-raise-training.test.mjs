import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaffManager, STAFF_TRAINING_CATALOG } from '../staff.js';
import { Unions } from '../unions.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=1_000_000)=>({
  balance,expenses:[],
  addExpense(amount,cat,label){this.balance-=Number(amount)||0;this.expenses.push({amount:Number(amount)||0,cat,label});},
  getEffectiveFraudRate(){return 0;},
});
const hire=(sm,eco,role='agent_maintenance')=>(sm.hire(eco,'Test Agent',role,{count:1})||[])[0];

test('HOTFIX53 payroll is really paid once per game date and survives save/load deduplication',()=>{
  const sm=new StaffManager(),eco=economy();
  const a=hire(sm,eco,'agent_maintenance'),b=hire(sm,eco,'conducteur');
  a.dailySalary=150;b.dailySalary=180;
  const before=eco.balance;
  const first=sm.processDailySalaries(eco,'2026-09-02');
  assert.equal(first.processed,true);assert.equal(first.total,330);assert.equal(before-eco.balance,330);
  const expenseCount=eco.expenses.filter(x=>x.cat==='salaires').length;
  const duplicate=sm.processDailySalaries(eco,'2026-09-02');
  assert.equal(duplicate.processed,false);assert.equal(eco.expenses.filter(x=>x.cat==='salaires').length,expenseCount);
  const saved=sm.toSave(),loaded=new StaffManager();loaded.loadFromSave(saved);
  const eco2=economy();
  assert.equal(loaded.processDailySalaries(eco2,'2026-09-02').processed,false);
  assert.equal(loaded.processDailySalaries(eco2,'2026-09-03').processed,true);
  assert.equal(loaded.payrollHistory.at(-1).amount,330);
});

test('HOTFIX53 salary raises change the real next payroll and improve individual satisfaction',()=>{
  const sm=new StaffManager(),eco=economy(),m=hire(sm,eco,'agent_maintenance');
  const base=sm.getMemberSalary(m),sat=m.satisfaction;
  const r=sm.raiseSalary(m.id,10,'2026-09-02');
  assert.equal(r.ok,true);assert.equal(sm.getMemberSalary(m),Math.round(base*1.10));assert.ok(m.satisfaction>sat);
  const payroll=sm.processDailySalaries(eco,'2026-09-03');
  assert.equal(payroll.total,sm.getMemberSalary(m));
});

test('HOTFIX53 player bonuses debit cash, are logged and boost satisfaction',()=>{
  const sm=new StaffManager(),eco=economy(),m=hire(sm,eco,'agent_maintenance');
  const before=eco.balance,sat=m.satisfaction;
  const r=sm.giveBonus(m.id,500,eco,'2026-09-02');
  assert.equal(r.ok,true);assert.equal(before-eco.balance,500);assert.equal(m.totalBonuses,500);assert.ok(m.satisfaction>sat);
  assert.ok(eco.expenses.some(x=>x.cat==='primes_personnel'));
  assert.ok(sm.hrEvents.some(x=>x.type==='bonus'&&x.staffId===m.id));
});

test('HOTFIX53 training costs money, makes the employee unavailable, completes over game days and raises skill/satisfaction',()=>{
  const sm=new StaffManager(),eco=economy(),m=hire(sm,eco,'mecanicien_diesel');
  const skill=m.skillLevel,sat=m.satisfaction,before=eco.balance;
  const def=STAFF_TRAINING_CATALOG.expertise;
  const r=sm.startTraining(m.id,'expertise',eco,'2026-09-02');
  assert.equal(r.ok,true);assert.equal(before-eco.balance,def.cost);assert.equal(m.trainingRemainingDays,def.days);assert.equal(m.onDuty,false);
  const depot={id:'D1',name:'Dépôt',built:true,type:'depot'};m.assignedTo='D1';m.shiftGroup=0;m.weeklyRestDay=6;
  sm._tickFixedShiftStates(60,'2026-09-02',0);assert.equal(m.onDuty,false);
  for(let day=3;day<3+def.days;day++)sm.processDailyHR({},`2026-09-${String(day).padStart(2,'0')}`,{random:()=>1});
  assert.equal(m.trainingRemainingDays,0);assert.equal(m.trainingId,'');assert.equal(m.skillLevel,skill+def.skillGain);assert.equal(m.satisfaction,sat+def.satisfactionGain);
  assert.ok(sm.hrEvents.some(x=>x.type==='training_end'&&x.staffId===m.id));
});

test('HOTFIX53 a driver cannot be sent to training while responsible for a train',()=>{
  const sm=new StaffManager(),eco=economy(),m=hire(sm,eco,'conducteur');m.assignedTo='svc-1';
  const r=sm.startTraining(m.id,'eco_conduite',eco,'2026-09-02');
  assert.equal(r.ok,false);assert.match(r.reason,/terminer son service/i);
});

test('HOTFIX53 training staff are excluded from depot capacity and safe dismissal waits until training ends',()=>{
  const sm=new StaffManager(),eco=economy(),m=hire(sm,eco,'agent_maintenance');m.assignedTo='D1';m.shiftGroup=0;m.weeklyRestDay=6;
  sm.startTraining(m.id,'perfectionnement',eco,'2026-09-02');
  sm._tickFixedShiftStates(60,'2026-09-02',0);
  const a=sm.getDepotStaffAvailability('D1','agent_maintenance');assert.equal(a.training,1);assert.equal(a.free,0);
  const fire=sm.requestFire(m.id,'2026-09-02');assert.equal(fire.ok,true);assert.equal(fire.pending,true);assert.ok(sm.staff.some(x=>x.id===m.id));
});

test('HOTFIX53 individual satisfaction contributes to social climate / strike calculation',()=>{
  const sm=new StaffManager(),eco=economy(2_000_000),m=hire(sm,eco,'agent_maintenance');
  m.satisfaction=100;m.socialRisk=0;m.weeklyRestDay=6;m.lastWeeklyRestDate='2026-09-01';
  const unions=new Unions(),game={economy:eco,staffManager:sm,scheduleCreator:{getActiveServices:()=>[]},dashboard:{punctualityHistory:[]},engine:{getParisDate:()=> '2026-09-02'}};
  unions.dailyUpdate(game,{random:()=>1});
  const high=unions.satisfaction;
  const unions2=new Unions();m.satisfaction=20;unions2.dailyUpdate(game,{random:()=>1});
  assert.ok(high>unions2.satisfaction);
});

test('HOTFIX53 UI exposes a dedicated searchable compensation/training workspace',()=>{
  const staff=read('js/staff.js'),css=read('style.css');
  assert.match(staff,/Rémunération & formation/);assert.match(staff,/staff-development-search/);assert.match(staff,/Verser prime/);assert.match(staff,/Augmenter/);assert.match(staff,/Envoyer/);
  assert.match(staff,/Dernière paie/);assert.match(staff,/Satisfaction moyenne/);assert.match(staff,/Compétence/);assert.match(css,/staff-development-grid/);assert.match(css,/staff-payroll-grid/);
});

test('HOTFIX53 game loop passes the date into idempotent payroll and bundle uses final cache',()=>{
  const main=read('js/main.js'),bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(main,/processDailySalaries\(this\.economy, settlementDate\)/);
  assert.match(bundle,/HOTFIX53-PERSONNEL-3X8-AUTO-ASSIGN-LEAVE-HR-INCIDENTS-PAYROLL-BONUS-RAISE-TRAINING/);
  assert.match(bundle,/giveBonus\(/);assert.match(bundle,/raiseSalary\(/);assert.match(bundle,/startTraining\(/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
