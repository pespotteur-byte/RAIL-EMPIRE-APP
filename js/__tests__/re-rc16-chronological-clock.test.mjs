import test from 'node:test';
import assert from 'node:assert/strict';
import {ChronologicalClock} from '../chronological-clock.js';
import {SimulationEngine} from '../engine.js';
import {GameplayClock} from '../gameplay-clock.js';
import {fixture} from './helpers/rc10-fixtures.mjs';
const base=Date.parse('2026-09-12T21:59:58Z');
function collect(clock){const events=[];let seconds=0;return {events,get seconds(){return seconds;},handlers:{minute:ms=>events.push(['m',ms]),second:ms=>events.push(['s',ms]),move:(dt,ms)=>{seconds+=dt;events.push(['p',ms,dt]);}}};}
function drain(clock,target,handlers){let n=0;while(clock.cursorMs<target){const moved=clock.advance(target,handlers,100000,1e9);assert.ok(moved>0,'no progress');assert.ok(++n<1000);}clock.advance(target,handlers,100000,1e9);}
test('RC16 CLOCK overdue minute/second/physics callbacks remain chronologically interleaved',()=>{
 const c=new ChronologicalClock(null,base,base),out=collect(c);drain(c,base+65000,out.handlers);
 const times=out.events.map(e=>e[1]);assert.deepEqual(times,times.slice().sort((a,b)=>a-b));
 assert.ok(Math.abs(out.seconds-65)<1e-9);assert.equal(c.debtSeconds,0);
 assert.equal(out.events.filter(e=>e[0]==='m').length,3);
 const midnight=Date.parse('2026-09-12T22:00:00Z');assert.deepEqual(out.events.filter(e=>e[1]===midnight).map(e=>e[0]),['m','s','p']);
});
test('RC16 CLOCK bounded frame retains all offline debt, with no discarded seconds',()=>{
 const c=new ChronologicalClock(null,base,base),out=collect(c);assert.equal(c.advance(base+86400000,out.handlers,7,1e9),7);
 assert.equal(c.cursorMs,base+700);assert.equal(c.debtSeconds,86399.3);assert.ok(JSON.stringify(c.snapshot()).length<240);
});
test('RC16 CLOCK backwards wall correction never reverses or replays committed events',()=>{
 const c=new ChronologicalClock(null,base,base),out=collect(c);drain(c,base+500,out.handlers);const len=out.events.length;
 c.advance(base-100000,out.handlers);assert.equal(c.cursorMs,base+500);assert.equal(out.events.length,len);
});
test('RC16 CLOCK save/reload mid-backlog yields exactly the uninterrupted event sequence',()=>{
 const continuous=new ChronologicalClock(null,base,base),expected=collect(continuous);drain(continuous,base+62000,expected.handlers);
 const first=new ChronologicalClock(null,base,base),actual=collect(first);first.advance(base+62000,actual.handlers,127,1e9);
 const resumed=new ChronologicalClock(JSON.parse(JSON.stringify(first.snapshot())),base,base+62000);drain(resumed,base+62000,actual.handlers);
 assert.deepEqual(actual.events,expected.events);
});
test('RC16 CLOCK irregular imported cursor ends at exact second boundaries',()=>{
 const c=new ChronologicalClock(null,base+950,base+950),out=collect(c);drain(c,base+2000,out.handlers);
 assert.ok(Math.abs(out.seconds-1.05)<1e-10);assert.deepEqual(out.events.filter(e=>e[0]==='s').map(e=>e[1]),[base+950,base+1000,base+2000]);
});
test('RC16 CLOCK invalid/future stored cursor cannot generate negative time',()=>{
 for(const cursor of [NaN,Infinity,-1,base+1e8,'2026']){const c=new ChronologicalClock({version:1,cursorMs:cursor},base,base);assert.equal(c.cursorMs,base);}
});
test('RC16 CLOCK handler failure stops without consuming its movement or auto-retrying',()=>{
 const c=new ChronologicalClock(null,base,base);let calls=0;
 const h={minute(){},second(){},move(){calls++;throw Error('fault');}};
 assert.throws(()=>c.advance(base+1000,h),/fault/);assert.equal(c.cursorMs,base);assert.equal(c.failed,'fault');assert.equal(c.advance(base+1000,h),0);assert.equal(calls,1);
});
for(const [label,start] of [['spring','2026-03-29T00:59:59Z'],['autumn','2026-10-25T00:59:59Z'],['midnight','2026-09-12T21:59:59Z']])test(`RC16 CLOCK ${label} transition preserves elapsed duration and Paris fields`,()=>{
 const epoch=Date.parse(start),e=new SimulationEngine();e.enableChronologicalReplay(null,epoch,epoch);const points=[];
 e.onSecondTick=(min,date,pt)=>points.push([min,date,pt.hours,pt.minutes,pt.seconds]);
 const old=Date.now;try{Date.now=()=>epoch+2000;for(let n=0;e.getSimulationEpochMs()<epoch+2000&&n<100;n++)e.update();}finally{Date.now=old;}
 assert.equal(e.chronologicalClock.cursorMs,epoch+2000);assert.equal(e.discardedPhysicsSeconds,0);
 if(label==='spring')assert.deepEqual(points.map(p=>p[2]),[1,3,3]);
 if(label==='autumn')assert.deepEqual(points.map(p=>p[2]),[2,2,2]);
 if(label==='midnight')assert.deepEqual(points.map(p=>p[1]),['2026-09-12','2026-09-13','2026-09-13']);
});
test('RC16 CLOCK real engine carries same timestamps into schedule and movement',()=>{
 const e=new SimulationEngine();e.enableChronologicalReplay(null,base,base);const events=[];
 e.onTick=(min,date)=>events.push(['minute',min,date]);e.onSecondTick=(min,date)=>events.push(['second',min,date]);e.onMoveTick=(dt,min)=>events.push(['move',min,e.getParisDate(),dt]);
 const old=Date.now;try{Date.now=()=>base+3200;e.update();}finally{Date.now=old;}
 const moves=events.filter(x=>x[0]==='move');assert.ok(moves.length>0&&moves.length<=32);assert.equal(moves[0][1],1439+58/60);assert.equal(moves[0][2],'2026-09-12');
});
test('RC16 CLOCK process ledger advances by simulated minutes, not the entire gap at first callback',()=>{
 const c=new ChronologicalClock(null,base,base),ledger=new GameplayClock();ledger.load({lastUpdateMs:base,dailyDate:'2026-09-12'});const elapsed=[];
 const e=new SimulationEngine();e.enableChronologicalReplay(c.snapshot(),base,base);
 e.onTick=(_,date)=>elapsed.push(ledger.advance(date,e.getSimulationEpochMs()).elapsedMinutes);
 const old=Date.now;try{Date.now=()=>base+3600000;for(let n=0;elapsed.length<2&&n<100;n++)e.update();}finally{Date.now=old;}
 // RC19 removes the old 50-step speed cap, not any intermediate minute.
 assert.deepEqual(elapsed.slice(0,2),[0,2/60]);
 assert.ok(elapsed.slice(2).every(value=>value===1));
 assert.ok(e.getReplayDebtSeconds()>0 && e.getReplayDebtSeconds()<3600);
});
test('RC16 CLOCK actual train state matches continuous versus delayed replay on a fixed route',()=>{
 function run(chunked){const f=fixture({speed:30}),epoch=Date.parse('2026-09-12T08:05:00Z'),c=new ChronologicalClock(null,epoch,epoch);const h={minute(){},second(){},move:(dt,ms)=>f.s.moveUpdate(dt,605+(ms-epoch)/60000,[f.s])};
  if(chunked)for(let t=100;t<=10000;t+=100)drain(c,epoch+t,h);else drain(c,epoch+10000,h);
  return {position:f.s.position,speed:f.s.speed,distance:f.s.totalDistance,state:f.s.state};}
 assert.deepEqual(run(false),run(true));
});

test('RC16 CLOCK reload after backwards wall correction retains cursor and previously known target',()=>{
 const c=new ChronologicalClock(null,base,base);c.advance(base+100000,{minute(){},second(){},move(){}},15,1e9);
 const next=new ChronologicalClock(c.snapshot(),base-1000,base-1000);
 assert.equal(next.cursorMs,c.cursorMs);assert.equal(next.targetMs,c.targetMs);assert.equal(next.debtSeconds,c.debtSeconds);
});
test('RC16 CLOCK saved fault cannot silently retry a partially applied operation after reload',()=>{
 const c=new ChronologicalClock(null,base,base);let calls=0;const h={minute(){calls++;throw Error('partial');},second(){},move(){}};
 assert.throws(()=>c.advance(base+1000,h));const e=new SimulationEngine();e.enableChronologicalReplay(c.snapshot(),base,base+1000);
 assert.equal(e.paused,true);e.onTick=()=>calls++;e.update();assert.equal(calls,1);assert.equal(e.toClockSave().failed,'partial');
});

test('RC16 CLOCK forty-eight hours retain every second, minute and daily settlement without an event queue',()=>{
 const start=Date.parse('2026-09-12T21:59:00Z'),target=start+48*3600000,c=new ChronologicalClock(null,start,start),ledger=new GameplayClock();ledger.load({lastUpdateMs:start,dailyDate:'2026-09-12'});
 let seconds=0,minutes=0,moves=0,totalDt=0;const days=[];
 const handlers={minute(ms){minutes++;const date=GameplayClock.parisDate(ms);const step=ledger.advance(date,ms);for(const d of step.dailyDates){ledger.runDailyTask('test',d,()=>days.push(d));ledger.markSettled(d);}},second(){seconds++;},move(dt){moves++;totalDt+=dt;}};
 c.advance(target,handlers,12345,1e9);const resumed=new ChronologicalClock(c.snapshot(),start,target);drain(resumed,target,handlers);
 assert.equal(seconds,172801);assert.equal(minutes,2881);assert.equal(moves,1728000);assert.ok(Math.abs(totalDt-172800)<1e-4);assert.deepEqual(days,['2026-09-13','2026-09-14']);assert.equal(resumed.debtSeconds,0);assert.ok(JSON.stringify(resumed.snapshot()).length<240);
});
