import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI } from '../ui.js';
import { FreightManager } from '../freight.js';
const { OperationalDiagnostics } = await import('../operational-diagnostics.js').catch(()=>({}));
function create(...args){assert.equal(typeof OperationalDiagnostics,'function','bounded operational diagnostics must be available');return new OperationalDiagnostics(...args);}
function quiet(fn){const old=console.warn;console.warn=()=>{};try{return fn();}finally{console.warn=old;}}
test('RC3-QA01-01: repeated failures count every occurrence but log at most once per interval',()=>{
 const d=create();const messages=[];const old=console.warn;console.warn=(...a)=>messages.push(a);
 try{d.record('STAFF',new Error('example'),1000);d.record('STAFF',new Error('example'),1001);d.record('STAFF',new Error('example'),60999);assert.equal(messages.length,1);d.record('STAFF',new Error('example'),61000);assert.equal(messages.length,2);assert.equal(d.snapshot()[0].count,4);}finally{console.warn=old;}
});
test('RC3-QA01-02: unique codes, message sizes and retained exception data stay bounded',()=>quiet(()=>{
 const d=create(3);for(let i=0;i<10;i++)d.record('ERR_'+i,new Error('x'.repeat(1000)),i);
 assert.equal(d.snapshot().length,3);assert.deepEqual(d.snapshot().map(x=>x.code),['ERR_9','ERR_8','ERR_7']);assert.equal(d.snapshot()[0].message.length,500);
 assert.ok(d.snapshot().every(x=>!('stack'in x)&&!('error'in x)));const row=d.snapshot()[0];row.message='mutated';assert.notEqual(d.snapshot()[0].message,'mutated');d.clear();assert.deepEqual(d.snapshot(),[]);
}));
test('RC3-QA01-03: broken logging or unstringifiable errors cannot crash the simulation',()=>{
 const d=create();const old=console.warn;console.warn=()=>{throw Error('logger failed');};
 try{assert.doesNotThrow(()=>d.record('ERR',{toString(){throw Error('bad stringify');}},5));assert.equal(d.snapshot()[0].message,'Erreur non sérialisable');}finally{console.warn=old;}
});
function gameFixture(){
 const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');const begin=source.indexOf('    tick(timeOfDay, dateStr, pt) {');const end=source.indexOf('    gameLoop() {',begin);assert.ok(begin>=0&&end>begin);
 // Execute the actual compiled game tick without booting its browser constructor.
 const Harness=new Function(`return class {${source.slice(begin,end)}}`)();const g=new Harness();const records=[];let downstream=0;
 Object.assign(g,{gameplayClock:{advance:()=>({elapsedMinutes:1,dailyDates:[]})},seasonal:{checkSeason(){}},_updateV2RuntimeStatus(){},scheduleCreator:{services:[],getActiveServices:()=>[],beginTick(){},refreshMovingCache(){}},staffManager:{tickWorkforce(){throw Error('injected workforce failure');},tickRegulateurs(){},tickConductors(){},tickControleurs(){}},incidentManager:{activeIncidents:[],update(){}},worksManager:{update:()=>false},depotManager:{updateRepairs:()=>({repaired:[],maintainedIds:[]}),updateDepotOperations(){}},world:{stations:[]},freightManager:new FreightManager(),cantonManager:{cleanup(){}},weather:{update(){},getLatestRadarPath:()=>''},shuntingManager:{update(){}},dashboard:{record(){downstream++;}},graphMarche:{record(){}},diagnostics:{record:(...args)=>records.push(args)}});
 return{g,records,downstream:()=>downstream};
}
test('RC3-QA01-04: real game tick records failed workforce updates and continues other managers',()=>{
 const {g,records,downstream}=gameFixture();assert.doesNotThrow(()=>g.tick(601,'2026-09-11',{}));assert.doesNotThrow(()=>g.tick(602,'2026-09-11',{}));assert.equal(downstream(),2);assert.equal(records.length,2);assert.ok(records.every(([code,error])=>code==='STAFF_WORKFORCE'&&error.message==='injected workforce failure'));
});
test('RC3-QA01-05: several independent failures remain distinguishable within the actual game tick',()=>{
 const {g,records,downstream}=gameFixture();g.weather.update=()=>{throw Error('weather unavailable');};g.shuntingManager.update=()=>{throw Error('shunting issue');};g.tick(601,'2026-09-11',{});
 assert.equal(downstream(),1);assert.deepEqual(records.map(x=>x[0]),['STAFF_WORKFORCE','WEATHER','SHUNTING']);
});
test('RC3-QA01-06: sidebar renders historical counters with escaped error text',()=>{
 const old=globalThis.document;const box={innerHTML:'',style:{}};globalThis.document={getElementById:()=>box};const ui=Object.create(UI.prototype);ui.game={timeOfDay:600,_currentDate:'2026-09-11',scheduleV2Runtime:{diagnose:()=>({summary:'OK',items:[]})},diagnostics:{snapshot:()=>[{code:'STAFF',count:7,message:'<img src=x onerror=bad()> & error'}]}};
 try{ui.updateV2RuntimeSidebar();assert.match(box.innerHTML,/7 erreur\(s\) observée\(s\)/);assert.match(box.innerHTML,/&lt;img/);assert.doesNotMatch(box.innerHTML,/<img/);assert.match(box.innerHTML,/&amp; error/);}finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
