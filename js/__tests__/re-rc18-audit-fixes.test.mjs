import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StateTransaction,validateSaveDocument} from '../state-transaction.js';
import {IncidentManager} from '../incidents.js';
import {buildMovementDiagnostics} from '../movement-diagnostics.js';
import {RELEASE,BUILD_ID} from '../build-info.js';
import {installSaveSerializerWorker} from '../save-serializer-worker.js';
import {installIDB,localMemory} from '../../scripts/test-idb-harness.mjs';
const rngRef=fs.readFileSync(new URL('../incidents.js',import.meta.url),'utf8').match(/from\s+['"]([^'"]*rng\.js[^'"]*)['"]/)?.[1];
const {SeededRng,setGlobalRng}=await import(new URL(rngRef,new URL('../incidents.js',import.meta.url)));
const factory=installIDB();delete globalThis.Worker;
const {GameStorage}=await import('../storage.js');
function world(){return {stations:Array.from({length:100},(_,i)=>({id:`S${i}`,name:`Station ${i}`,lat:48+i*.001,lon:2})),tracks:[],getStationById(id){return this.stations.find(s=>s.id===id);}};}
function manager(){const m=new IncidentManager();m.setEnabledTypes(['law-enforcement'],56);return m;}
const step=(m,w,min)=>m.update(min%1440,[],null,w,`2026-09-${12+Math.floor(min/1440)}`,'summer',null,1);
for(const stop of [1,2,17,1439,1440,1441])test(`RC18 incidents: fresh-manager reload at minute ${stop} preserves next incidents, IDs and RNG`,()=>{
 const w=world(),m=manager(),rng=new SeededRng(20260912);setGlobalRng(rng);
 for(let t=0;t<=stop;t++)step(m,w,t);
 const save=JSON.parse(JSON.stringify({active:m.getActiveIncidentsSave(),cadence:m.getCadenceSave(),rng:rng.getState()}));
 for(let t=stop+1;t<=stop+4;t++)step(m,w,t);
 const expected={active:m.getActiveIncidentsSave(),cadence:m.getCadenceSave(),rng:rng.getState()};
 const n=manager();n.loadFromSave(save.active,w);n.loadCadenceSave(save.cadence);rng.setState(save.rng);
 for(let t=stop+1;t<=stop+4;t++)step(n,w,t);
 assert.deepEqual({active:n.getActiveIncidentsSave(),cadence:n.getCadenceSave(),rng:rng.getState()},expected);
});
test('RC18 incidents: re-observing the saved minute does not age an active incident twice',()=>{
 const w=world(),m=manager(),rng=new SeededRng(73);setGlobalRng(rng);for(let i=0;i<=4;i++)step(m,w,i);
 const saved=JSON.parse(JSON.stringify({active:m.getActiveIncidentsSave(),cadence:m.getCadenceSave()}));
 const n=manager();n.loadFromSave(saved.active,w);n.loadCadenceSave(saved.cadence);step(n,w,4);
 assert.deepEqual(n.getActiveIncidentsSave(),saved.active);
});
test('RC18 incidents: weather credit and scan cursor survive exact JSON roundtrip',()=>{
 const m=manager();m._weatherIncidentCredit['weather-wind']=.72;m._weatherIncidentLastAbsMinute=29821749;m._weatherSampleCursor=36;
 const key=m.predefinedTypes.find(t=>t.weatherTriggered).id;m._weatherIncidentCredit[key]=.83;
 const n=manager();n.loadCadenceSave(JSON.parse(JSON.stringify(m.getCadenceSave())));
 assert.equal(n._weatherIncidentCredit[key],.83);assert.equal(n._weatherIncidentLastAbsMinute,29821749);assert.equal(n._weatherSampleCursor,36);
});
test('RC18 incidents: old save migration clears stale cadence without a catch-up burst',()=>{
 const m=manager();m._incidentSpawnCredit=7;m._incidentSpawnLastAbsMinute=2;m.loadCadenceSave(undefined);
 assert.equal(m._incidentSpawnCredit,0);assert.equal(m._incidentSpawnLastAbsMinute,null);assert.equal(m._trySpawn(720,[],world(),'summer','2026-09-12'),0);
});
test('RC18 transaction restores nested references, deleted keys, Maps, Sets, Dates and array length',()=>{
 const child={amount:17},a={children:[child],map:new Map([['x',child]]),set:new Set([child]),time:new Date(300)};a.self=a;
 const tx=new StateTransaction();tx.captureRoot(a);a.children.length=0;a.children.push({amount:8});child.amount=99;child.other=1;a.map.clear();a.set.clear();a.time.setTime(400);delete a.self;a.extra=5;
 tx.rollback();assert.equal(a.children[0],child);assert.equal(child.amount,17);assert.equal(child.other,undefined);assert.equal(a.extra,undefined);assert.equal(a.self,a);assert.equal(a.map.get('x'),child);assert.ok(a.set.has(child));assert.equal(a.time.getTime(),300);
});
test('RC18 transaction release keeps committed values and frees the journal',()=>{const a={x:1};const tx=new StateTransaction();tx.captureRoot(a);a.x=2;tx.release();assert.equal(a.x,2);assert.equal(tx.objectCount,0);});
for(const [key,bad] of [['world',{nativeRefs:{}}],['scheduleV2',{schedules:{}}],['rotationsV2',{vehicles:{}}],['v2Runtime',{services:{}}],['incidentCadence',{schemaVersion:999}],['activeIncidents',{}]])test(`RC18 validation refuses malformed ${key}`,()=>assert.throws(()=>validateSaveDocument({companyName:'a',[key]:bad})));
test('RC18 validation accepts a supported legacy missing-section document',()=>assert.doesNotThrow(()=>validateSaveDocument({companyName:'a',economy:{balance:0}})));
test('RC18 delete: commit failure + clock rollback masks old data, then confirmed save becomes visible',async()=>{
 const s=new GameStorage(),now=Date.now;try{Date.now=()=>200000;assert.ok(await s.saveGame({rev:1}));Date.now=()=>1000;factory.failNextCommit=true;assert.equal(await s.deleteSave(),true);assert.equal(await s.loadGame(),null);assert.equal(await s.hasSaveAsync(),false);assert.ok(await s.saveGame({rev:2}));assert.equal((await s.loadGame()).rev,2);}finally{Date.now=now;}
});
test('RC18 delete reports double storage failure instead of claiming deletion',async()=>{
 const s=new GameStorage();await s.saveGame({rev:1});const local=globalThis.localStorage;globalThis.localStorage=localMemory(0);factory.failNextCommit=true;
 try{assert.equal(await s.deleteSave(),false);assert.match(s.lastError,/Échec/);}finally{globalThis.localStorage=local;await s.deleteSave();}
});
test('RC18 export snapshot stays coherent across an immediate caller mutation',async()=>{
 const s=new GameStorage(),state={economy:{total:20,categories:{fret:20}},route:[{lat:48,lon:2}]};
 const p=s.makeExportBlob(state);state.economy.total+=17;state.economy.categories.fret+=17;state.route[0].lat=49;
 const packed=await p,text=packed.ext==='.json.gz'?await new Response(packed.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text():await packed.blob.text();
 assert.deepEqual(JSON.parse(text),{economy:{total:20,categories:{fret:20}},route:[{lat:48,lon:2}]});
});
test('RC18 typed worker emits a portable compressed export without double JSON encoding',async()=>{
 const messages=[],scope={onmessage:null,postMessage:(v)=>messages.push(v)};installSaveSerializerWorker(scope);
 await scope.onmessage({data:{id:1,mode:'export',state:'{"balance":17}'}});const out=messages[0];assert.equal(out.ok,true);
 const json=out.gzip?await new Response(new Blob([out.buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).text():out.json;assert.deepEqual(JSON.parse(json),{balance:17});
});
test('RC18 worker validates request instead of serializing an accidental object as a snapshot',async()=>{const messages=[],scope={onmessage:null,postMessage:v=>messages.push(v)};installSaveSerializerWorker(scope);await scope.onmessage({data:{id:2,mode:'export',state:{}}});assert.equal(messages[0].ok,false);});
test('RC18 diagnostic, filename and package share the release constant',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8'));assert.equal(BUILD_ID,pkg.railEmpireBuild);assert.equal(RELEASE,pkg.railEmpireBuild.match(/RC\d+/)[0]);assert.equal(buildMovementDiagnostics({}).build,RELEASE);
 const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');assert.ok(ui.includes('Rail_Empire_${RELEASE}_mouvement_'));
});

// Broader regression probes found beyond the original seven audit issues.
const {DepotManager}=await import('../depot.js');
const {Rame}=await import('../rame.js');
function depotFixture(opId){
 const dm=new DepotManager(),economy={balance:1e8,expenses:[],addExpense(n,c,d){this.balance-=n;this.expenses.push({n,c,d});}};
 const depot=dm.add({type:'depot',name:'RC18',stationId:'A',tracks:4,cost:0,placementOnly:true,location:{lat:48,lon:2},infrastructure:['technicentre']},null);
 const rame=new Rame({id:'R18',name:'BB75000',elementDetails:[{elementId:'L18',category:'locomotive',traction:'diesel',length:20,maxSpeed:120,mass:90,power:2000}],currentLocation:{}});
 dm.enterRame(depot.id,rame,[]);rame.consumables.fuelL=0;
 depot.resourceStocks.diesel_l=100000;depot.resourceStocks.brake_cleaner_l=100;
 depot.partInventory.brake_pad_set=40;depot.partInventory.brake_disc=20;depot._syncLegacySpareParts();
 const dump=()=>JSON.stringify({depot:depot,balance:economy.balance,expenses:economy.expenses,operations:dm.depotOperations,rame:rame});
 return{dm,economy,depot,rame,dump};
}
for(const opId of ['refuel','brake_overhaul'])test(`RC18 late staff refusal for ${opId} spends no stock, parts, utilities or money`,()=>{
 const {dm,economy,depot,rame,dump}=depotFixture(opId),before=dump();let attempts=0;
 const staff={checkDepotStaff:()=>({ok:true,shortages:[]}),reserveDepotStaff:()=>{attempts++;return {ok:false};}};
 const result=dm.startDepotOperation(depot.id,rame,opId,economy,staff);
 assert.equal(attempts,1);assert.equal(result.ok,false);assert.equal(dump(),before);
});
test('RC18 late part refusal releases the staff reservation without consuming utilities',()=>{
 const {dm,economy,depot,rame,dump}=depotFixture('brake_overhaul'),before=dump();let reserved='',released='';
 const staff={checkDepotStaff:()=>({ok:true,shortages:[]}),reserveDepotStaff:(d,n,id)=>{reserved=id;return {ok:true,staffIds:['A']};},releaseDepotTask:id=>{released=id;}};
 const original=depot.consumeParts;depot.consumeParts=()=>false;
 try{assert.equal(dm.startDepotOperation(depot.id,rame,'brake_overhaul',economy,staff).ok,false);}finally{delete depot.consumeParts;}
 assert.ok(reserved);assert.equal(reserved,released);assert.equal(dump(),before);
});
test('RC18 transaction also restores state behind symbol properties',()=>{
 const sym=Symbol('nested'),nested={n:2},a={[sym]:nested};const tx=new StateTransaction();tx.captureRoot(a);nested.n=9;a[sym]={n:30};tx.rollback();assert.equal(a[sym],nested);assert.equal(nested.n,2);
});
test('RC18 incidents: 48 hours with four fresh-manager JSON reloads preserve every event and RNG',()=>{
 const w=world(),seed=430924,checkpoints=new Set([3,1439,1440,2017]);
 function run(reload){let m=manager();m.loadCadenceSave({schemaVersion:1,nextIncId:1});const rng=new SeededRng(seed);setGlobalRng(rng);const history=[];
  for(let minute=0;minute<2880;minute++){
   step(m,w,minute);history.push(JSON.stringify({active:m.getActiveIncidentsSave(),rng:rng.getState()}));
   if(reload&&checkpoints.has(minute)){const save=JSON.parse(JSON.stringify({active:m.getActiveIncidentsSave(),cadence:m.getCadenceSave(),rng:rng.getState()}));m=manager();m.loadFromSave(save.active,w);m.loadCadenceSave(save.cadence);rng.setState(save.rng);}
  }return{history,cadence:m.getCadenceSave(),rng:rng.getState()};
 }
 assert.deepEqual(run(true),run(false));
});

const {acquireImportUiLock}=await import('../import-ui-lock.js');
test('RC18 import interaction shield is safe in a headless domain environment',()=>{const old=globalThis.document;delete globalThis.document;try{const release=acquireImportUiLock();assert.equal(typeof release,'function');assert.doesNotThrow(release);}finally{if(old!==undefined)globalThis.document=old;}});
