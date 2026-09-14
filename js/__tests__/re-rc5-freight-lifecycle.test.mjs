import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.RE_COMPARE_ROOT?pathToFileURL(resolve(process.env.RE_COMPARE_ROOT)+'/'):new URL('../../',import.meta.url);
const {FreightManager}=await import(new URL('js/freight.js',base));
const {Economy}=await import(new URL('js/economy.js',base));
const {ActiveService,ScheduleCreator}=await import(new URL('js/schedule-creator.js',base));
const {ScheduleV2Runtime}=await import(new URL('js/schedule-v2-runtime.js',base));
function fixture(){
 const f=new FreightManager(),e=new Economy();
 const c=f.addContract({id:'C',cargoType:'coal',quantity:100,initialQuantity:100,fromId:'A',toId:'B',payment:1000,industrialClientId:'client'});
 const stops=[{stationId:'A',type:'arret'},{stationId:'M',type:'arret'},{stationId:'B',type:'arret'}];
 const s={id:'S',name:'Fret',rame:{id:'R',maxSpeed:100,totalMass:100,totalCapacity:0,totalFreightCapacity:100,elementDetails:[{category:'wagon',cargoTypes:['coal'],freightCapacity:100}]},assignedContractId:'C',serviceType:'fret',stops,currentStopIndex:0,state:'moving',train:{delay:0,breakdown:{type:'doors'}},_onboardPax:0,_onboardFreight:0,_contractFreight:0};
 const client={id:'client',satisfaction:80,marketShare:5,totalRevenue:0,totalTonnage:0};
 const game={freightManager:f,economy:e,cargoTypes:{recordContract(){},getTransportTariffPerTonne(){return 100;}},industrialClients:{clients:[client],stats:{totalRevenue:0,totalTonnage:0}},realismSettings:{}};
 s._contractFreight=f.reserveForService(c,s,100);
 return {f,e,c,s,game,client};
}
function withGame(game,fn){const old=globalThis.window;globalThis.window={game};try{return fn();}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}}
function arrive(x,station='B',index=2){x.s.currentStopIndex=index;withGame(x.game,()=>x.e.processStopRevenue(x.s,station,10,false,true,station,[]));}
test('RC5-ECO08: deactivating a client returns its onboard cargo at the next usable stop without payment',()=>{
 const x=fixture();x.f.cancelContractsForIndustrialClient('client');arrive(x,'M',1);
 assert.equal(x.s._contractFreight,0);assert.equal(x.c.inTransitQuantity,0);assert.equal(x.c.quantity,100);assert.equal(x.c.progress,0);
 assert.equal(x.e.revenue,0);assert.equal(x.client.totalRevenue,0);assert.equal(x.client.satisfaction,80);assert.equal(x.s._onboardFreight,0);
 assert.equal(x.e.history.filter(h=>h.type==='cargo_return').length,1);
 arrive(x,'B',2);assert.equal(x.e.history.filter(h=>h.type==='cargo_return').length,1);
});
test('RC5-ECO08: deleting an in-transit contract retains a tombstone until return, including save/reload',()=>{
 const x=fixture();x.f.removeContract('C');assert.equal(x.f.contracts.length,1);assert.equal(x.f.contracts[0].active,false);
 const saved=x.f.toSave();x.f.loadFromSave(saved);assert.equal(x.f.contracts[0].inTransitQuantity,100);
 arrive(x);assert.equal(x.f.contracts.length,0);assert.equal(x.s._contractFreight,0);assert.equal(x.e.revenue,0);
});
test('RC5-ECO08: freight whose old contract is already missing is not stuck on board',()=>{
 const x=fixture();x.f.contracts=[];arrive(x);assert.equal(x.s._contractFreight,0);assert.equal(x.e.revenue,0);
});
test('RC5-ECO08: technical and incompatible ITE stops do not perform a fictitious return',()=>{
 const x=fixture();x.c.active=false;x.s.stops[1].technicalLocationId='T';arrive(x,'M',1);assert.equal(x.s._contractFreight,100);assert.equal(x.c.inTransitQuantity,100);
 x.s._iteCargoMismatch=true;arrive(x);assert.equal(x.s._contractFreight,100);
 x.s._iteCargoMismatch=false;arrive(x);assert.equal(x.s._contractFreight,0);
});
test('RC5-ECO08: interrupted assigned freight cannot pay another compatible contract',()=>{
 const x=fixture();const other=x.f.addContract({id:'OTHER',cargoType:'coal',quantity:100,fromId:'X',toId:'B',payment:10000});x.c.active=false;
 const out=withGame(x.game,()=>x.f.fulfillAtStation(x.s,'B',100));assert.equal(out.remainingTonnes,100);assert.deepEqual(out.fulfilled,[]);assert.equal(other.quantity,100);
});
test('RC5-ECO08: editing the assignment does not relabel already loaded cargo',()=>{
 const x=fixture();const other=x.f.addContract({id:'OTHER',cargoType:'coal',quantity:100,fromId:'X',toId:'D',payment:2000});x.s.assignedContractId='OTHER';
 arrive(x);assert.equal(x.c.quantity,0);assert.equal(other.quantity,100);assert.equal(x.s._contractFreight,0);assert.equal(x.e.revenue,1000);
});
test('RC5-ECO08: service deletion releases its reservations and clears only contractual cargo',()=>{
 const x=fixture();x.s._onboardFreight=7;const creator=new ScheduleCreator();creator.services=[x.s];x.game.scheduleCreator=creator;
 withGame(x.game,()=>creator.removeService('S'));assert.equal(x.c.inTransitQuantity,0);assert.equal(x.c.quantity,100);assert.equal(x.s._contractFreight,0);assert.equal(x.s._onboardFreight,7);
 assert.equal(x.f.reserveForService(x.c,{id:'NEXT'},100),100);
});
test('RC5-ECO08: unrecovered cargo is returned when a service finally completes',()=>{
 const x=fixture();const s=new ActiveService({id:'S',name:'Fret',stops:[{stationId:'A',time:'10:00',type:'arret'},{stationId:'B',time:'10:30',type:'arret'}]},x.s.rame,{getStationById:()=>null});
 Object.assign(s,{_contractFreight:100,_contractCargoId:'C',assignedContractId:'C',_currentDate:'2026-09-11'});
 withGame(x.game,()=>s.completeService(x.e));assert.equal(x.c.inTransitQuantity,0);assert.equal(s._contractFreight,0);assert.equal(x.c.quantity,100);assert.equal(x.e.revenue,0);
});
test('RC5-ECO08: reconciliation releases vanished carriers but preserves pending runtime snapshots',()=>{
 const x=fixture();x.c.loadedByService={GHOST:40,S:60};x.s._contractFreight=60;
 const pending={id:'S',state:'moving',contractFreight:60};x.f.reconcileReservations([], [pending]);
 assert.deepEqual({...x.c.loadedByService},{S:60});assert.equal(pending.contractCargoId,'C');
 assert.equal(x.f.reserveForService(x.c,{id:'NEW'},100),40);
});
test('RC5-ECO08: live state overrides a duplicate pending snapshot and finished carriers are released',()=>{
 const x=fixture();x.s._contractFreight=40;x.f.reconcileReservations([x.s],[{id:'S',contractFreight:100,contractCargoId:'C'}]);
 assert.deepEqual({...x.c.loadedByService},{S:40});x.s.cancelled=true;x.f.reconcileReservations([x.s]);assert.equal(x.c.inTransitQuantity,0);assert.equal(x.s._contractFreight,0);
});
test('RC5-ECO08: reconstructed reservations cannot exceed remaining stock after a corrupt overbooking',()=>{
 const x=fixture();const a={id:'A',_contractFreight:80,_contractCargoId:'C'},b={id:'B',_contractFreight:80,_contractCargoId:'C'};
 x.f.reconcileReservations([a,b]);assert.equal(Object.values(x.c.loadedByService).reduce((a,b)=>a+b,0),100);assert.equal(x.c.quantity,100);
});
test('RC5-ECO08: zero-distance arrival still returns interrupted cargo, without a new delivery',()=>{
 const x=fixture();x.c.active=false;x.s.currentStopIndex=2;withGame(x.game,()=>x.e.processStopRevenue(x.s,'B',0,false,true,'B',[]));assert.equal(x.s._contractFreight,0);assert.equal(x.c.progress,0);assert.equal(x.e.revenue,0);
});
test('RC5-ECO08: runtime snapshots preserve cargo owner and normalise invalid quantities',()=>{
 const x=fixture();x.s._contractCargoId='C';x.s._v2OccurrenceId='O';x.game.scheduleCreator={services:[x.s]};x.game.rotationV2={vehicles:[]};
 const rt=new ScheduleV2Runtime(x.game);const data=rt.toSave();assert.equal(data.services[0].contractCargoId,'C');
 assert.equal(rt.loadFromSave(data),true);assert.equal(rt._pendingSnapshots.get('S').contractCargoId,'C');
 data.services[0].contractFreight=Infinity;assert.equal(rt.loadFromSave(data),true);assert.equal(rt._pendingSnapshots.get('S').contractFreight,0);
});
test('RC5-ECO08: compact legacy saves keep cargo ownership after a reassignment',()=>{
 const x=fixture();const world={getStationById:()=>null};const route=[{lat:48,lon:2,maxSpeed:100},{lat:48,lon:2.1,maxSpeed:100}];const s=new ActiveService({id:'S',name:'Fret',rameId:'R',assignedContractId:'OTHER',routes:[route],stops:[{stationId:'A',departureTime:600,arrivalTime:600,type:'arret'},{stationId:'B',departureTime:630,arrivalTime:630,type:'arret'}]},x.s.rame,world);
 Object.assign(s,{_contractFreight:100,_contractCargoId:'C',currentStopIndex:1,state:'moving',speed:50,position:{lat:48,lon:2.02}});const creator=new ScheduleCreator();creator.services=[s];
 const saved=creator.toSave();assert.equal(saved[0]._r.ci,1,'new cargo key must not overwrite the stop index');assert.equal(saved[0]._r.cgid,'C');
 const restored=new ScheduleCreator();withGame(x.game,()=>restored.loadFromSave(saved,{getById:()=>x.s.rame},world,605,'2026-09-11'));
 assert.equal(restored.services.length,1);const after=restored.services[0];assert.equal(after._contractCargoId,'C');assert.equal(after._contractFreight,100);assert.equal(after.assignedContractId,'OTHER');
 x.f.reconcileReservations(restored.services);assert.equal(x.c.inTransitQuantity,100);
});
test('RC5-ECO08: two carriers return a removed contract independently without losing the second ledger',()=>{
 const x=fixture();x.s._contractFreight=60;x.c.loadedByService={S:60,T:40};const second={id:'T',_contractFreight:40,_contractCargoId:'C'};
 x.f.removeContract('C');assert.equal(x.f.finishServiceCargo(x.s),60);assert.equal(x.f.contracts.length,1);assert.equal(x.c.inTransitQuantity,40);
 x.f.reconcileReservations([second]);assert.equal(x.c.inTransitQuantity,40);assert.equal(x.f.finishServiceCargo(second),40);assert.equal(x.f.contracts.length,0);
});
