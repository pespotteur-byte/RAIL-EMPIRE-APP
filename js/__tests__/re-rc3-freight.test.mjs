import test from 'node:test';
import assert from 'node:assert/strict';
import { FreightManager } from '../freight.js';
import { Economy } from '../economy.js';
import { ActiveService, ScheduleCreator } from '../schedule-creator.js';
import { UI } from '../ui.js';
const rame=()=>({id:'R',name:'R',maxSpeed:100,totalMass:100,totalPower:1000,totalCapacity:0,totalFreightCapacity:100,elementDetails:[{category:'wagon',cargoTypes:['coal'],freightCapacity:100}],elements:[]});
const stop=(stationId,type='arret',extra={})=>({stationId,type,departureTime:600,arrivalTime:600,...extra});
function fixture(stops=[stop('A'),stop('B')]){
 const f=new FreightManager();f.addContract({id:'C',cargoType:'coal',cargoName:'Charbon',quantity:100,initialQuantity:100,fromId:'A',toId:'B',from:'A',to:'B',payment:1000});
 const e=new Economy();const s={id:'S',name:'S',rame:rame(),assignedContractId:'C',serviceType:'fret',stops,currentStopIndex:0,train:{delay:0,breakdown:{type:'doors'}},_onboardPax:0,_onboardFreight:0,_contractFreight:0};
 const game={freightManager:f,economy:e,cargoTypes:{recordContract(){},getTransportTariffPerTonne(){return 0;}},realismSettings:{breakdown:0}};
 return {f,e,s,game,c:f.contracts[0]};
}
function withGame(game,fn){const old=globalThis.window;globalThis.window={game};try{return fn();}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}}
test('RC3-ECO06-01: origin must be an actual commercial stop, not an unrelated or technical point',()=>{
 for(const stops of [[stop('X'),stop('B')],[stop('A','passage'),stop('B')],[stop('A','arret',{technicalLocationId:'T'}),stop('B')]]){
  const {f,c,s}=fixture(stops);const r=f.validateAssignment(c,s);assert.equal(r.ok,false);assert.equal(r.code,'ORIGIN_NOT_SERVED');
 }
});
test('RC3-ECO06-02: destination must occur after loading, not before it or as a passing point',()=>{
 for(const stops of [[stop('B'),stop('A')],[stop('A'),stop('B','passage')],[stop('A'),stop('X')]]){
  const {f,c,s}=fixture(stops);assert.equal(f.validateAssignment(c,s).ok,false);
 }
});
test('RC3-ECO06-03: wagon compatibility and non-commercial service categories are enforced',()=>{
 const {f,c,s}=fixture();s.rame.elementDetails[0].cargoTypes=['diesel'];assert.equal(f.validateAssignment(c,s).code,'CARGO_INCOMPATIBLE');
 s.rame=rame();for(const type of ['hlp','tm','work','evo','w']){s.serviceType=type;assert.equal(f.validateAssignment(c,s).code,'NON_COMMERCIAL_SERVICE');}
});
test('RC3-ECO06-04: an intermediate origin can really load and deliver, within remaining capacity',()=>{
 const {f,e,s,game,c}=fixture([stop('X'),stop('A'),stop('B')]);s.currentStopIndex=1;s._onboardFreight=20;
 assert.equal(f.validateAssignment(c,s).ok,true);
 withGame(game,()=>{
  e.processStopRevenue(s,'A',1,false,false,'A',[]);
  const loaded=s._contractFreight;assert.ok(loaded>0);assert.ok(loaded<=100);assert.ok(s._onboardFreight+loaded<=100);
  assert.equal(c.progress,0);assert.equal(c.inTransitQuantity,loaded);
  s.currentStopIndex=2;e.processStopRevenue(s,'B',1,false,true,'B',[]);
  assert.equal(s._contractFreight,0);assert.equal(c.quantity,100-loaded);assert.equal(c.progress,loaded/100);
 });
});
test('RC3-ECO06-05: an invalid imported journey cannot load at its origin',()=>{
 const {f,e,s,game,c}=fixture([stop('A'),stop('X')]);withGame(game,()=>e.processStopRevenue(s,'A',0,true,false,'A',[]));
 assert.equal(s._contractFreight,0);assert.deepEqual(Object.keys(c.loadedByService),[]);
});
test('RC3-ECO06-06: service creation rejects bad assignments without removing an existing service',()=>{
 const {s,game}=fixture([stop('A'),stop('X')]);const sc=new ScheduleCreator();sc.services=[{id:'original'}];
 withGame(game,()=>assert.throws(()=>sc.addService({...s,rameId:'R'},s.rame,{getStationById:()=>null}),/doit s’arrêter/));
 assert.deepEqual(sc.services.map(s=>s.id),['original']);
});
test('RC3-ECO07-01: loading is zero delivered progress, partial deliveries alone advance it',()=>{
 const {f,s,game,c}=fixture();f.reserveForService(c,s,40);assert.equal(c.progress,0);
 withGame(game,()=>{f.fulfillAtStation(s,'B',40);assert.equal(c.progress,.4);f.fulfillAtStation(s,'B',60);assert.equal(c.progress,1);});
});
test('RC3-ECO07-02: driving cannot overwrite delivered-quantity progress',()=>{
 const {s,game,c}=fixture();s.totalDistance=87;s.plannedDistance=100;s._state={};
 c.quantity=60;
 withGame(game,()=>ActiveService.prototype._trackWear.call(s,1,600));
 assert.equal(c.progress,.4);
});
test('RC3-ECO07-03: old distance/half-loaded progress is migrated from quantities on load',()=>{
 const {f,c}=fixture();const raw=f.toSave();raw[0].progress=.87;raw[0].quantity=75;
 f.loadFromSave(raw);assert.equal(f.contracts[0].progress,.25);
 const raw2=f.toSave();raw2[0].active=false;raw2[0].quantity=100;raw2[0].progress=1;
 f.loadFromSave(raw2);assert.equal(f.contracts[0].progress,0);
});
test('RC3-ECO07-04: the sidebar uses a 0..100 percent bar and distinguishes unfulfilled cancellations',()=>{
 const {f,game,c}=fixture();c.quantity=50;
 f.addContract({id:'cancelled',cargoType:'coal',quantity:100,active:false,fromId:'A',toId:'B'});
 const old=globalThis.document;const box={innerHTML:''};globalThis.document={getElementById:id=>id==='freight-list'?box:null};
 try{UI.prototype.updateFreightTab.call({game});assert.match(box.innerHTML,/width:50%/);assert.match(box.innerHTML,/Complétés \(0\)/);assert.match(box.innerHTML,/Annulés \/ interrompus \(1\)/);}finally{globalThis.document=old;}
});
test('RC3-ECO06-07: a repeated origin and destination are resolved in their order of traversal',()=>{
 const {f,c,s}=fixture([stop('B'),stop('A'),stop('B')]);const r=f.validateAssignment(c,s);assert.equal(r.ok,true);assert.equal(r.originIndex,1);assert.equal(r.destinationIndex,2);
});
