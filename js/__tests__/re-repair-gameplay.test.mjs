import test from 'node:test';
import assert from 'node:assert/strict';
import { GameplayClock } from '../gameplay-clock.js';
import { SimulationEngine } from '../engine.js';
import { Economy } from '../economy.js';
import { FreightManager } from '../freight.js';
import { Bank } from '../bank.js';
import { StaffManager } from '../staff.js';
import { Weather } from '../weather.js';
import { IncidentManager } from '../incidents.js';
import { SeededRng, setGlobalRng } from '../rng.js';
import { ActiveService, ServiceStop } from '../schedule-creator.js';

const withGame = async (game, work) => { const old=globalThis.window; globalThis.window={game}; try { return await work(); } finally { if(old===undefined)delete globalThis.window;else globalThis.window=old; } };
const timestamp = s => Date.parse(s);
const freightRame = () => ({totalCapacity:0,maxSpeed:100,totalMass:100,elementDetails:[{category:'wagon',cargoTypes:['coal'],freightCapacity:100},{category:'wagon',cargoTypes:['diesel'],freightCapacity:100}]});
const contract = (id='c', cargoType='coal', quantity=100) => ({id,cargoType,fromId:'A',toId:'B',quantity,initialQuantity:quantity,payment:quantity*10});

test('RE repair: a missed midnight is settled, without inventing pre-save charges',()=>{
 const c=new GameplayClock();c.load(undefined,timestamp('2026-09-10T21:59:00Z'));
 assert.equal(c.dailyDate,'2026-09-10');
 const a=c.advance('2026-09-11',timestamp('2026-09-10T22:02:00Z'));
 assert.equal(a.elapsedMinutes,3);assert.deepEqual(a.dailyDates,['2026-09-11']);
 c.markSettled('2026-09-11');assert.deepEqual(c.advance('2026-09-11',timestamp('2026-09-10T22:03:00Z')).dailyDates,[]);
});
test('RE repair: partial daily failure and reload do not double-charge successful tasks',()=>{
 const c=new GameplayClock();c.load(undefined,timestamp('2026-09-10T20:00:00Z'));
 let debit=0;c.runDailyTask('bank','2026-09-11',()=>debit++);
 assert.throws(()=>c.runDailyTask('ite','2026-09-11',()=>{throw Error('fault');}));
 const restored=new GameplayClock();restored.load(c.toSave());
 restored.runDailyTask('bank','2026-09-11',()=>debit++);
 restored.runDailyTask('ite','2026-09-11',()=>debit++);
 assert.equal(debit,2);assert.deepEqual(restored.advance('2026-09-13',timestamp('2026-09-13T20:00:00Z')).dailyDates,['2026-09-11','2026-09-12','2026-09-13']);
});
test('RE repair: elapsed durations are real minutes across Paris DST, calendar days are separate',()=>{
 const c=new GameplayClock();c.load(undefined,timestamp('2026-03-29T00:30:00Z'));
 const a=c.advance('2026-03-29',timestamp('2026-03-29T01:30:00Z'));
 assert.equal(a.elapsedMinutes,60);assert.deepEqual(a.dailyDates,[]);
});
test('RE repair: engine ticks an identical minute on a new day',()=>{
 const e=new SimulationEngine();let date=new Date('2026-09-10T12:00:00Z');
 e.getParisTime=()=>({hours:12,minutes:0,seconds:0,date});
 const calls=[];e.onTick=(_,d)=>calls.push(d);e.update();date=new Date('2026-09-11T12:00:00Z');e.update();
 assert.deepEqual(calls,['2026-09-10','2026-09-11']);
});
test('RE repair: loan settlement is date-idempotent through save/load',()=>{
 const b=new Bank(),e=new Economy();assert.ok(b.borrow(e,'small'));
 b.processDailyRepayments(e,'2026-09-11');const balance=e.balance,remaining=b.loans[0].remaining;
 const restored=new Bank();restored.loadFromSave(b.toSave());restored.processDailyRepayments(e,'2026-09-11');
 assert.equal(e.balance,balance);assert.equal(restored.loans[0].remaining,remaining);
 restored.processDailyRepayments(e,'2026-09-12');assert.ok(e.balance<balance);
});
test('RE repair: zero RNG state is not an absorbing all-zero sequence',()=>{
 for(const rng of [new SeededRng(0),new SeededRng(1)]) {
  rng.setState(0);const values=Array.from({length:8},()=>rng.random());
  assert.ok(values.some(v=>v>0));assert.equal(new Set(values).size,8);
 }
});
test('RE repair: zero staff satisfaction remains zero',()=>{
 const s=new StaffManager();s.staff=[{satisfaction:0},{satisfaction:100}];assert.equal(s.getAverageStaffSatisfaction(),50);
});
test('RE repair: origin arrival at midnight is not replaced by departure',()=>{
 const stop=new ServiceStop('A','arret',4,0);assert.equal(stop.arrivalTime,0);assert.equal(stop.departureTime,4);
});
test('RE repair: maintenance stops both full and macro movement',()=>{
 for(const method of ['moveUpdate','moveMacro']) {
  const s={active:true,state:'moving',position:{lat:48,lon:2},train:{inMaintenance:true,speed:50},rame:{},speed:50,_movementStop(code){this.code=code;}};
  ActiveService.prototype[method].call(s,1,100,[]);assert.equal(s.speed,0);assert.equal(s.train.speed,0);assert.equal(s.code,'MAINTENANCE');
 }
});
test('RE repair: repaired mid-line train resumes movement, blocked route stays blocked',()=>{
 for(const state of ['moving','blocked_route']){
  const s={state,train:{breakdown:{type:'moteur'},speed:0},position:{lat:48,lon:2},_state:{cachedRoute:[{},{}]},currentStopIndex:1};
  ActiveService.prototype.resumeAfterRepair.call(s);assert.equal(s.state,state);assert.equal(s.train.breakdown,null);assert.equal(s._brakeEffort,0);
 }
});
test('RE repair: live camera weather is not substituted for unknown distant weather',()=>{
 const w=new Weather();w._liveDataAvailable=true;w.current='snow';
 const state=w.getAt(43.3,5.4);assert.equal(state.type,'clear');assert.equal(state.live,false);
});
test('RE repair: incident duration consumes the real elapsed minutes',()=>{
 const m=new IncidentManager();m.activeIncidents=[{id:'i',active:true,remaining:30}];
 m._trySpawn=()=>{};m._tryWeatherIncidents=()=>{};m.checkTrainPositions=()=>{};m._clearTrackFlags=()=>{};
 m.update(2,[],null,{},'2026-09-11',null,null,180);assert.equal(m.activeIncidents.length,0);
});
test('RE repair: through passengers pay all kilometres, not only their last leg',()=>{
 const e=new Economy();setGlobalRng(new SeededRng(19));
 const s={rame:{totalCapacity:100,maxSpeed:160,totalMass:100},stops:[{},{},{}],currentStopIndex:1,train:{delay:0},serviceType:'passager',name:'T',_onboardPax:100,_onboardFreight:0,_contractFreight:0};
 e.processStopRevenue(s,'B',100,false,false,'B',[]);
 const billedB=e.totalTicketRevenue; const liability=s._onboardPassengerKm; const count=s._onboardPax;
 s.currentStopIndex=2;e.processStopRevenue(s,'C',100,false,true,'C',[]);
 assert.equal(e.totalTicketRevenue,billedB+Math.round((liability+count*100)*0.12));
 assert.equal(s._onboardPassengerKm,0);assert.equal(s._onboardPax,0);
});
test('RE repair: late passengers lose 25%, not 50%, excluding infrastructure costs',()=>{
 const run=delay=>{
  const e=new Economy();e.addExpense=()=>true;setGlobalRng(new SeededRng(19));
  const s={rame:{totalCapacity:100,maxSpeed:160,totalMass:100},stops:[{},{}],currentStopIndex:1,train:{delay},serviceType:'passager',name:'T',_onboardPax:100,_onboardFreight:0,_contractFreight:0};
  const start=e.balance;e.processStopRevenue(s,'B',100,false,true,'B',[]);return e.balance-start;
 };
 const normal=run(0),late=run(10000);assert.equal(late,normal-Math.round(normal*0.25));
});
test('RE repair: technical stops preserve passengers and accrued kilometres without sales',()=>{
 const e=new Economy();const s={rame:{totalCapacity:100,maxSpeed:160,totalMass:100},stops:[{},{technicalLocationId:'bif-x'},{}],currentStopIndex:1,train:{delay:0},serviceType:'passager',name:'T',_onboardPax:100,_onboardFreight:0,_contractFreight:0};
 e.processStopRevenue(s,'Technical',40,false,false,'bif-x',[]);
 assert.equal(e.totalPassengers,0);assert.equal(e.totalTicketRevenue,0);assert.equal(s._onboardPax,100);assert.equal(s._onboardPassengerKm,4000);
});
test('RE repair: two trains cannot reserve the same contract quantity and save preserves reservations',()=>{
 const f=new FreightManager();f.addContract(contract());const c=f.contracts[0];
 assert.equal(f.reserveForService(c,{id:'t1'},80),80);assert.equal(f.reserveForService(c,{id:'t2'},80),20);
 const copy=new FreightManager();copy.loadFromSave(f.toSave());assert.equal(copy.reserveForService(copy.contracts[0],{id:'t3'},80),0);
 copy.releaseForService('t1');assert.equal(copy.reserveForService(copy.contracts[0],{id:'t3'},80),80);
});
test('RE repair: reserved cargo cannot be stolen by generic delivery',async()=>{
 const f=new FreightManager();f.addContract(contract());const c=f.contracts[0];f.reserveForService(c,{id:'t1'},100);
 await withGame({freightManager:f,cargoTypes:{recordContract(){}}},()=>{
  const result=f.fulfillAtStation({id:'t2',rame:freightRame()},'B',100);assert.equal(result.remainingTonnes,100);assert.equal(c.quantity,100);
  const delivered=f.fulfillAtStation({id:'t1',rame:freightRame(),assignedContractId:c.id},'B',100);assert.equal(delivered.remainingTonnes,0);assert.equal(c.quantity,0);assert.deepEqual(Object.keys(c.loadedByService),[]);
 });
});
test('RE repair: a mixed consist unloads a compatible assigned cargo in a non-first wagon',async()=>{
 const f=new FreightManager();f.addContract(contract('diesel-contract','diesel'));
 await withGame({freightManager:f,cargoTypes:{recordContract(){}}},()=>{
  const result=f.fulfillAtStation({id:'t',rame:freightRame(),assignedContractId:'diesel-contract'},'B',100);
  assert.equal(result.remainingTonnes,0);assert.equal(f.contracts[0].active,false);
 });
});
