import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.RE_BASE||path.resolve(import.meta.dirname,'../..');
const mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));

const{GameplayClock}=await mod('gameplay-clock');const{ShuntingManager}=await mod('shunting');
test('RC6R-CLOCK-01: impossible civil dates are rejected, leap days retained',()=>{for(const d of ['2026-02-29','2026-04-31','2026-02-30'])assert.equal(GameplayClock.validDate(d),false,d);assert.equal(GameplayClock.validDate('2024-02-29'),true);});
test('RC6R-CLOCK-02: finite but out-of-range Date timestamp cannot crash save loading',()=>{const c=new GameplayClock();assert.doesNotThrow(()=>c.load({lastUpdateMs:1e30,dailyDate:'2026-02-30'}));assert.equal(c.lastUpdateMs,0);assert.equal(c.dailyDate,'');});
test('RC6R-CLOCK-03: invalid ledger date must not suppress a later legitimate daily task',()=>{const c=new GameplayClock();let count=0;c.runDailyTask('bank','9999-99-99',()=>count++);c.runDailyTask('bank','2026-09-11',()=>count++);assert.equal(count,1);assert.equal(c.completedTasks.bank,'2026-09-11');});
test('RC6R-CLOCK-04: invalid task dates restored from a save are discarded',()=>{const c=new GameplayClock();c.load({dailyDate:'2026-09-10',completedTasks:{bank:'2026-02-30',payroll:'2026-09-10'}});assert.equal(c.completedTasks.bank,undefined);assert.equal(c.completedTasks.payroll,'2026-09-10');});
test('RC6R-CLOCK-05: a wall-clock rewind does not replay elapsed minutes',()=>{const c=new GameplayClock();c.load({lastUpdateMs:1000000,dailyDate:'2026-09-11'});assert.equal(c.advance('2026-09-11',900000).elapsedMinutes,0);assert.equal(c.advance('2026-09-11',1060000).elapsedMinutes,1);});
test('RC6R-CLOCK-06: date batches preserve the complete ordered backlog without one unbounded array',()=>{const c=new GameplayClock();c.load({dailyDate:'2025-01-01',lastUpdateMs:Date.parse('2025-01-01T00:00:00Z')});const all=[];for(let i=0;i<20;i++){const a=c.advance('2026-01-01',Date.parse('2026-01-01T00:00:00Z'));assert.ok(a.dailyDates.length<=31);for(const d of a.dailyDates){all.push(d);c.markSettled(d);}if(!a.dailyDates.length)break;}assert.equal(all.length,365);assert.equal(new Set(all).size,365);assert.equal(all.at(-1),'2026-01-01');});
function shunt(){const m=new ShuntingManager();const op=m.startOperation('S','A','D','coal',100,2,{});return{m,op,total:Object.values(op.phaseDurations).reduce((a,b)=>a+b,0)};}
test('RC6R-SHUNT-01: a long catch-up only counts actual shunting time, not idle time after completion',()=>{const{m,op,total}=shunt();m.update(total+1000);assert.equal(m.history[0].duration,total);assert.equal(m.stats.totalDuration,total);assert.equal(op.phaseElapsed,0);});
test('RC6R-SHUNT-02: one large update and minute steps produce equal operation statistics',()=>{const a=shunt(),b=shunt();a.m.update(1000);for(let i=0;i<1000;i++)b.m.update(1);assert.deepEqual(a.m.stats,b.m.stats);assert.equal(a.m.history[0].duration,b.m.history[0].duration);});
test('RC6R-SHUNT-03: overshoot applies independently to two operations with different lengths',()=>{const{m,op,total}=shunt();const second=m.startOperation('T','B','D','coal',10000,50,{});const total2=Object.values(second.phaseDurations).reduce((a,b)=>a+b,0);m.update(10000);assert.equal(m.stats.totalDuration,total+total2);assert.equal(m.stats.totalOperations,2);});
test('RC6R-SHUNT-04: valid mid-operation save resumes without resetting elapsed work',()=>{const{m,total}=shunt();m.update(13.5);const c=new ShuntingManager();c.loadFromSave(JSON.parse(JSON.stringify(m.toSave())));c.update(total-13.5);assert.equal(c.stats.totalOperations,1);assert.equal(c.history[0].duration,total);});
test('RC6R-SHUNT-05: invalid deltas are non-mutating',()=>{const{m}=shunt();const before=JSON.stringify(m.toSave());for(const x of [0,-1,Infinity,NaN])m.update(x);assert.equal(JSON.stringify(m.toSave()),before);});
