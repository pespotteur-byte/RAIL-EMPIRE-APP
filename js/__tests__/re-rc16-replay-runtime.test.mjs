import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeGame,addValidSchedule,addDieselFormation} from './re-rc2-fixtures.mjs';
import {SimulationEngine} from '../engine.js';
import {ChronologicalClock} from '../chronological-clock.js';
import {fixture} from './helpers/rc10-fixtures.mjs';
const epoch=Date.parse('2026-09-12T21:55:00Z');
function setup(){
 const game=makeGame(),rec=addValidSchedule(game),rot=game.rotationV2.addRotation({name:'Replay'});
 const {loco}=addDieselFormation(game,rot,rec);game.engine=new SimulationEngine();game.engine.enableChronologicalReplay(null,epoch,epoch);
 globalThis.window={game};game.scheduleV2Runtime.sync(1435,'2026-09-12');
 assert.equal(game.scheduleCreator.services.length,1);return {game,loco,s:game.scheduleCreator.services[0]};
}
test('RC16 REPLAY exact V2 snapshot uses simulated capture time, not wall save time',()=>{
 const {game,s}=setup();s.position={lat:48.025,lon:2.025};s.speed=s.train.speed=17;s.totalDistance=3.5;
 const old=Date.now;let saved;try{Date.now=()=>epoch+86400000;saved=game.scheduleV2Runtime.toSave();}finally{Date.now=old;}
 assert.equal(saved.capturedAtUnixSec,epoch/1000);
 game.scheduleCreator.services=[];game.scheduleCreator._invalidateActiveCache();game.scheduleV2Runtime.loadFromSave(JSON.parse(JSON.stringify(saved)));
 try{Date.now=()=>epoch+86400000;game.scheduleV2Runtime.sync(1435,'2026-09-12');}finally{Date.now=old;}
 const restored=game.scheduleCreator.services[0];assert.ok(restored);assert.deepEqual(restored.position,{lat:48.025,lon:2.025});assert.equal(restored.speed,17);assert.equal(restored.totalDistance,3.5);
});
test('RC16 REPLAY inactive save remains exact after twelve real hours',()=>{
 const {game,s}=setup();s.speed=s.train.speed=0;s.train.incident={id:'STOP',name:'Obstacle',effect:'stop',active:true};
 const snap=JSON.parse(JSON.stringify(game.scheduleV2Runtime.toSave())),clock=game.engine.toClockSave(),before={...s.position};
 game.engine.enableChronologicalReplay(clock,epoch,epoch+12*3600000);game.scheduleCreator.services=[];game.scheduleCreator._invalidateActiveCache();game.scheduleV2Runtime.loadFromSave(snap);
 const old=Date.now;try{Date.now=()=>epoch+12*3600000;game.scheduleV2Runtime.sync(1435,'2026-09-12');}finally{Date.now=old;}
 assert.deepEqual(game.scheduleCreator.services[0].position,before);assert.equal(game.engine.getReplayDebtSeconds(),43200);
});
test('RC16 REPLAY actual train encounters and clears an intermediate incident even during one overdue update',()=>{
 function run(delayed){
  const f=fixture({speed:50}),c=new ChronologicalClock(null,epoch,epoch),events=[];
  const h={minute(){},second(ms){if(ms===epoch+5000){f.s.train.incident={id:'STOP',name:'Obstacle',effect:'stop',active:true};events.push('start');}if(ms===epoch+45000){f.s.train.incident=null;events.push('end');}},move(dt,ms){f.s.moveUpdate(dt,605+(ms-epoch)/60000,[f.s]);}};
  const advance=t=>{for(let i=0;c.cursorMs<t&&i<10000;i++)c.advance(t,h,100,1e9);assert.equal(c.cursorMs,t);};
  if(delayed)advance(epoch+60000);else for(let t=100;t<=60000;t+=100)advance(epoch+t);
  return {events,position:f.s.position,speed:f.s.speed,distance:f.s.totalDistance,reason:f.s.train.delayReason};
 }
 const delayed=run(true),continuous=run(false);assert.deepEqual(delayed,continuous);assert.deepEqual(delayed.events,['start','end']);
});
test('RC16 REPLAY production integration persists cursor, enables replay, and avoids visibility teleport',()=>{
 const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
 assert.match(source,/enableChronologicalReplay\(s\.physicsClock/);
 assert.match(source,/physicsClock: this\.engine\.toClockSave/);
 assert.match(source,/gapSec > 8 && !this\.engine\.chronologicalClock/);
 assert.match(source,/gameplayClock\.advance\(dateStr, this\.engine\?\.getSimulationEpochMs/);
});

test('RC16 REPLAY distant movement debt round-trips exactly and does not keep stale values',()=>{
 const {game,s}=setup();s._macroElapsed={medium:.6,low:1.3};const save=JSON.parse(JSON.stringify(game.scheduleV2Runtime.toSave()));
 assert.deepEqual(save.services[0].macroElapsed,{medium:.6,low:1.3});s._macroElapsed={medium:0,low:0};game.scheduleV2Runtime.loadFromSave(save);game.scheduleV2Runtime._restoreSnapshot(s,1435);
 assert.deepEqual(s._macroElapsed,{medium:.6,low:1.3});
 delete save.services[0].macroElapsed;game.scheduleV2Runtime.loadFromSave(save);game.scheduleV2Runtime._restoreSnapshot(s,1435);assert.deepEqual(s._macroElapsed,{medium:0,low:0});
});
test('RC16 REPLAY invalid movement debt rejects the whole import transaction',()=>{
 const {game}=setup(),runtime=game.scheduleV2Runtime;const valid=JSON.parse(JSON.stringify(runtime.toSave()));assert.equal(runtime.loadFromSave(valid),true);
 for(const value of [{medium:-1,low:0},{medium:0,low:Infinity},'no',[]]){const bad=structuredClone(valid);bad.services[0].macroElapsed=value;const pending=runtime._pendingSnapshots,key=runtime._lastSyncKey;assert.equal(runtime.loadFromSave(bad),false);assert.equal(runtime._pendingSnapshots,pending);assert.equal(runtime._lastSyncKey,key);}
});

test('RC16 REPLAY both automatic save and portable export include the applied physics cursor',()=>{
 const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const auto=source.slice(source.indexOf('    _saveStateNow(options'),source.indexOf('    saveState(options'));
 const portable=source.slice(source.indexOf('    async exportSaveFile()'),source.indexOf('    _collectPinnedNativeStationIds()'));
 for(const [name,block] of [['automatic',auto],['portable',portable]]){assert.ok(block.length>100,name);assert.match(block,/physicsClock: this\.engine\.toClockSave/);}
});

function statusMethod(){const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');const a=main.indexOf('    _updateV2RuntimeStatus() {'),b=main.indexOf('    secondTick(',a);assert.ok(a>=0&&b>a);return new Function('return ({'+main.slice(a,b)+'})._updateV2RuntimeStatus')();}
function statusFixture(debt,failed=''){const box={style:{},textContent:'',title:''};return {box,game:{engine:{getReplayDebtSeconds:()=>debt,chronologicalClock:{failed}}},document:{getElementById:id=>id==='re-chronological-status'?box:null}};}
test('RC16 REPLAY status has a real global DOM target and shows the pending duration',()=>{
 const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="re-chronological-status"/g)||[]).length,1);
 const f=statusFixture(3599.2),old=globalThis.document;try{globalThis.document=f.document;statusMethod().call(f.game);}finally{globalThis.document=old;}
 assert.equal(f.box.style.display,'block');assert.match(f.box.textContent,/3600 s restantes/);
});
test('RC16 REPLAY status presents a fault as literal text rather than markup',()=>{
 const f=statusFixture(0,'<img src=x onerror=alert(1)>'),old=globalThis.document;try{globalThis.document=f.document;statusMethod().call(f.game);}finally{globalThis.document=old;}
 assert.equal(f.box.textContent,'Simulation suspendue : <img src=x onerror=alert(1)>');assert.equal(f.box.innerHTML,undefined);
});
test('RC16 REPLAY status disappears after debt is settled without erasing sidebar diagnostics',()=>{
 const f=statusFixture(0),old=globalThis.document;f.box.textContent='Rattrapage';try{globalThis.document=f.document;statusMethod().call(f.game);}finally{globalThis.document=old;}
 assert.equal(f.box.style.display,'none');assert.equal(f.box.textContent,'');
});
