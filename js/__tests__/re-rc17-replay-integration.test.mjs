import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialFixture,reload} from './helpers/rc17-cross-system-fixtures.mjs';
import {ChronologicalClock} from '../chronological-clock.js';import {GameplayClock} from '../gameplay-clock.js';
import {SeededRng,setGlobalRng} from '../rng.js';import {setGlobalRng as setVersionedRng} from '../rng.js?v=1784250033';
import {Bank} from '../bank.js';import {Unions} from '../unions.js';import {IndustrialClients} from '../industrial-clients.js';import {IncidentManager} from '../incidents.js';import {SeasonalSchedule} from '../seasonal.js';import {ShuntingManager} from '../shunting.js';import {cantonManager} from '../schedule-creator.js';
const EPOCH=Date.parse('2026-08-24T22:00:00Z');
const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
function method(name,next){const a=source.indexOf('    '+name+'('),b=source.indexOf('    '+next+'(',a);assert.ok(a>=0&&b>a);return new Function('return ({'+source.slice(a,b)+'}).'+name)();}
const tick=method('tick','gameLoop'),move=method('moveTick','_forceV2RuntimeSyncNow'),second=method('secondTick','tick');
function run({deferred=false,reloads=[],seconds=1800}={}){
 for(const key of ['cantons','routeCantons','trainCantons','resourceCantons'])cantonManager[key].clear();
 let game=initialFixture(),clock=new ChronologicalClock(null,EPOCH,EPOCH),rng=new SeededRng(789),events=[],diagnostics=[],moves=0,lastSecond=-1;
 const wallet=()=>game.economy.balance;
 function wire(previous){
  globalThis.window={game};setGlobalRng(rng);setVersionedRng(rng);game.rng=rng;game.cantonManager=cantonManager;
  game.bank=previous?.bank||new Bank();game.unions=previous?.unions||new Unions();game.industrialClients=previous?.industrialClients||new IndustrialClients();
  game.seasonal=previous?.seasonal||new SeasonalSchedule();game.incidentManager=previous?.incidentManager||new IncidentManager();
  // No spontaneous new external incident/weather input in an equivalence run.
  // Active local work zones, freight, ITE, staff and saved deterministic RNG are real.
  game.incidentManager.enabledTypes=new Set();game.incidentManager.disabled=true;
  game.shuntingManager=previous?.shuntingManager||new ShuntingManager();
  if(!previous)game.shuntingManager.startOperation('SHUNT','B','ITE-C','grain',100,2,{});
  game.gameplayClock=previous?.gameplayClock||new GameplayClock();
  if(!previous)game.gameplayClock.load({lastUpdateMs:EPOCH,dailyDate:'2026-08-25'});
  game.engine={getSimulationEpochMs:()=>clock.cursorMs,getReplayDebtSeconds:()=>Math.max(3,clock.debtSeconds)};
  game.diagnostics={record:(code,e)=>diagnostics.push([code,String(e)])};
  game._updateV2RuntimeStatus=()=>{};game._streamNativeOSMViewport=()=>{};
  game.dashboard={record(){}};game.graphMarche={record(){}};
  game.tick=tick;game.moveTick=move;game.secondTick=second;
  game.renderer=null;game._lastCantonCleanup=performance.now();
 }
 wire();const initialBalance=wallet();
 const when=ms=>{const t=(ms-EPOCH)/1000;return {tod:(t/60)%1440,date:new Date(EPOCH+7200000+Math.floor(t/86400)*86400000).toISOString().slice(0,10),second:Math.floor(t)%60};};
 const getSvc=()=>game.scheduleCreator.services[0];
 const observe=()=>{const s=getSvc();const key=s.state+':'+s.currentStopIndex+':'+(s.train.stoppedAt?.id||'');if(key!==events.at(-1)?.key)events.push({key,ms:clock.cursorMs,position:s.position?{...s.position}:null,balance:wallet()});};
 const callbacks={minute(ms){const t=when(ms);tick.call(game,t.tod,t.date,{});observe();},second(ms){const t=when(ms);second.call(game,t.tod,t.date,{seconds:t.second});lastSecond=ms;},move(dt,ms){moves++;const t=when(ms);move.call(game,dt,t.tod);observe();}};
 const end=EPOCH+seconds*1000;
 function advance(target){do{clock.advance(target,callbacks,5000,1e9);}while(clock.cursorMs<target);}
 const checkpoints=[...reloads.map(t=>EPOCH+t*1000),end];
 for(const target of checkpoints){
  if(deferred)advance(target);else{for(let ms=clock.cursorMs+100;ms<=target;ms+=100)advance(ms);}
  if(target<end){
   const beforeService=getSvc();const pos=getSvc().position?{...getSvc().position}:null;
   game.gameplayClock.freightGenerationMinute=game.freightManager.lastGenTime;
   const savedClock=JSON.parse(JSON.stringify(clock.snapshot())),seed=rng.getState(),old=game,t=when(target);
   game=reload(old,t.tod);clock=new ChronologicalClock(savedClock,target,end);rng=new SeededRng(seed);
   const ledger=new GameplayClock();ledger.load(JSON.parse(JSON.stringify(old.gameplayClock.toSave())));
   const bank=new Bank();bank.loadFromSave(JSON.parse(JSON.stringify(old.bank.toSave())));
   const shunting=new ShuntingManager();shunting.loadFromSave(JSON.parse(JSON.stringify(old.shuntingManager.toSave())));
   wire({...old,bank,shuntingManager:shunting,gameplayClock:ledger});game.freightManager.lastGenTime=ledger.freightGenerationMinute;assert.deepEqual(getSvc().position,pos,'no reload teleport');
  }
 }
 assert.deepEqual(diagnostics,[],'production tick must not silently swallow subsystem errors');
 game.gameplayClock.freightGenerationMinute=game.freightManager.lastGenTime;
 const s=getSvc();return {events,moves,lastSecond,state:s.state,index:s.currentStopIndex,position:s.position,distance:s.totalDistance,speed:s.speed,balance:wallet(),initialBalance,
   revenue:{...game.economy.revenueByCategory},cargo:game.freightManager.contracts.find(c=>c.id==='F1')?.quantity,
   physicalLocation:game.rameManager.getById('R').currentLocation,ledger:game.gameplayClock.toSave(),shunting:game.shuntingManager.stats,rng:rng.getState()};
}
test('RC17 TIME05 actual minute/second/movement loops: continuous and deferred trip have identical stops, freight, ITE, work zone and money',()=>{const a=run(),b=run({deferred:true});assert.deepEqual(b,a);assert.equal(a.cargo,0);assert.ok(a.revenue.fret>=2000);assert.equal(a.state,'completed');assert.ok(a.events.some(e=>e.key.includes(':B')));assert.ok(a.events.some(e=>e.key.includes(':C')));assert.equal(a.physicalLocation.stationId,'D');});
test('RC17 TIME05 two JSON reloads during running and ITE dwell preserve the continuous outcome',()=>{const a=run(),b=run({deferred:true,reloads:[55,540]});assert.deepEqual(b,a);});
test('RC17 TIME05 48 hours through real gameplay ticks: no missed stop, duplicate freight or daily settlement',()=>{const a=run({deferred:false,seconds:48*3600}),b=run({deferred:true,reloads:[55,540,3700],seconds:48*3600});assert.deepEqual(b,a);assert.equal(a.ledger.dailyDate,'2026-08-27');assert.equal(a.cargo,0);assert.equal(a.moves,1728000);assert.equal(a.shunting.totalOperations,1);});
