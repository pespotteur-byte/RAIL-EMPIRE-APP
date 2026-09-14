import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,Economy,PlatformManager} from './helpers/rc10-fixtures.mjs';
const {StationUpgrades}=await mod('station-upgrades');
const {DepotManager,Depot}=await mod('depot');
const {Rame}=await mod('rame');
const {FreightManager}=await mod('freight');
const {SeededRng,setGlobalRng}=await mod('rng');
function setup(){
 const world={stations:[{id:'A',name:'A',lat:48,lon:2,platforms:2,type:'voyageur'},{id:'B',name:'B',lat:48.1,lon:2,platforms:2,type:'voyageur'},{id:'F',name:'Fret',lat:48.2,lon:2,platforms:3,type:'fret'}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
 const dm=new DepotManager(),pm=new PlatformManager(),u=new StationUpgrades(),e=new Economy();u.connectRuntime(world,dm,pm);return {world,dm,pm,u,e};
}
const buy=(f,type,id='A')=>assert.equal(f.u.buyModule(id,type,f.e),true,`buy ${type}`);
const withGame=(game,fn)=>{const old=globalThis.window;globalThis.window={game};try{return fn();}finally{globalThis.window=old;}};
test('RC10-STATION platform module increases real allocation, not only its UI label',()=>{
 const f=setup();const first=f.pm.assignPlatform('A','T1',2,null),second=f.pm.assignPlatform('A','T2',2,null);assert.notEqual(first,null);assert.notEqual(second,null);assert.equal(f.pm.assignPlatform('A','T3',2,null),null);
 const money=f.e.balance;buy(f,'platform');assert.equal(f.e.balance,money-15000);assert.equal(f.world.stations[0].platforms,2);assert.notEqual(f.pm.assignPlatform('A','T3',2,null),null);assert.equal(f.pm.assignPlatform('A','T4',2,null),null);
});
test('RC10-STATION repeated synchronisation and import never multiply paid capacity',()=>{
 const f=setup();buy(f,'platform');const saved=JSON.parse(JSON.stringify(f.u.toSave()));const cash=f.e.balance;
 for(let i=0;i<20;i++){f.u.loadFromSave(saved,f.world);f.u.syncRuntime();f.pm.initStation('A',2);assert.equal(f.pm.getStatus('A').total,3);}
 assert.equal(f.e.balance,cash);assert.equal(f.world.stations[0].platforms,2);
});
test('RC10-STATION importing a save without upgrades removes stale capacity from the previous game',()=>{
 const f=setup();buy(f,'platform');assert.equal(f.pm.getStatus('A').total,3);f.u.loadFromSave(null,f.world);assert.equal(f.pm.getStatus('A').total,2);
});
test('RC10-STATION new numbered capacity never bypasses an occupied native OSM track',()=>{
 const f=setup(),identity={kind:'osm',id:'way-22',trackRef:'',lat:48,lon:2};
 assert.notEqual(f.pm.assignPlatform('A','T1',2,'Alpha',{trackIdentity:identity}),null);buy(f,'platform');
 assert.equal(f.pm.assignPlatform('A','T2',2,'Renamed',{trackIdentity:identity}),null);
});
test('RC10-STATION a garage module creates a real empty depot slot with no free workshop equipment or extra bill',()=>{
 const f=setup(),before=f.e.balance;buy(f,'depot');assert.equal(f.dm.depots.length,1);const d=f.dm.depots[0];
 assert.equal(d.tracks,1);assert.equal(d.stationId,'A');assert.equal(d.freeTrackCount(),1);assert.equal(f.e.balance,before-25000);
 assert.deepEqual(d.equipmentInventory,{});assert.ok(Object.values(d.resourceStocks).every(x=>x===0));assert.deepEqual(d.railSections,[]);
});
test('RC10-STATION garage growth preserves occupancy and enforces remaining capacity',()=>{
 const f=setup();buy(f,'depot');const d=f.dm.depots[0],r1=new Rame({id:'R1'}),r2=new Rame({id:'R2'});
 assert.equal(f.dm.enterRame(d.id,r1).ok,true);assert.equal(f.dm.enterRame(d.id,r2).ok,false);const loc=structuredClone(r1.currentLocation);
 buy(f,'depot');assert.equal(d.tracks,2);assert.deepEqual(r1.currentLocation,loc);assert.equal(d.trackOccupancy[0].rameId,'R1');assert.equal(f.dm.enterRame(d.id,r2).ok,true);
});
test('RC10-STATION garage save/load is idempotent, preserving separately purchased extension and occupied slots',()=>{
 const f=setup();buy(f,'depot');const d=f.dm.depots[0],r=new Rame({id:'R'});f.dm.enterRame(d.id,r);assert.equal(f.dm.addDepotTracks(d.id,2,f.e).ok,true);
 const ds=JSON.parse(JSON.stringify(f.dm.toSave())),us=JSON.parse(JSON.stringify(f.u.toSave()));
 f.dm.loadFromSave(ds);f.u.loadFromSave(us,f.world);f.u.syncRuntime();assert.equal(f.dm.depots.length,1);assert.equal(f.dm.depots[0].tracks,3);assert.equal(f.dm.depots[0].trackOccupancy[0].rameId,'R');
 buy(f,'depot');assert.equal(f.dm.depots[0].tracks,4);assert.equal(f.dm.depots[0].stationUpgradeTracks,2);
});
test('RC10-STATION unrelated depot id collision does not steal or resize the depot',()=>{
 const f=setup();const original=new Depot({id:'station-garage:A',built:true,stationId:'B',tracks:6});f.dm.depots.push(original);buy(f,'depot');assert.equal(f.dm.depots.length,2);assert.equal(original.tracks,6);assert.equal(original.stationId,'B');assert.notEqual(f.dm.depots[1].id,original.id);
});
test('RC10-STATION failed purchases are atomic: caps, invalid station, prototype keys and insufficient funds',()=>{
 const f=setup();for(const key of ['constructor','__proto__','prototype','missing'])assert.equal(f.u.buyModule('A',key,f.e),false);
 assert.equal(f.u.buyModule('missing','platform',f.e),false);for(let i=0;i<6;i++)buy(f,'platform');const before=f.e.balance;assert.equal(f.u.buyModule('A','platform',f.e),false);assert.equal(f.e.balance,before);
 f.e.balance=0;assert.equal(f.u.buyModule('A','depot',f.e),false);assert.equal(f.dm.depots.length,0);
});
test('RC10-STATION imported malicious module names do not become inherited definitions',()=>{
 const f=setup();f.u.loadFromSave({upgrades:{A:{modules:[{type:'constructor'},{type:'__proto__'},{type:'platform'}]}}},f.world);assert.equal(f.u.getExtraPlatforms('A'),1);assert.equal(f.u.getStation('A').totalInvested,15000);
});
test('RC10-STATION freight terminal changes actual handling; existing freight stations and built ITEs remain valid',()=>{
 const f=setup();assert.equal(f.u.canHandleFreight('A'),false);assert.equal(f.u.canHandleFreight('F'),true);assert.equal(f.u.canHandleFreight('missing'),false);
 buy(f,'freight');assert.equal(f.u.canHandleFreight('A'),true);f.dm.depots.push(new Depot({id:'I',type:'ite-fret',stationId:'B',built:false}));assert.equal(f.u.canHandleFreight('B'),false);f.dm.depots[0].built=true;assert.equal(f.u.canHandleFreight('B'),true);f.world.stations[1].closed=true;assert.equal(f.u.canHandleFreight('B'),false);
});
function freightFixture(){const f=setup(),fm=new FreightManager();fm.addContract({id:'C',cargoType:'coal',cargoName:'Charbon',quantity:100,initialQuantity:100,fromId:'A',toId:'B',from:'A',to:'B',payment:1000});
 const s={id:'S',name:'Train',serviceType:'fret',rame:{totalCapacity:0,totalMass:100,maxSpeed:100,elementDetails:[{category:'wagon',cargoTypes:['coal'],freightCapacity:100}]},stops:[{stationId:'A',type:'arret'},{stationId:'B',type:'arret'}],currentStopIndex:0,train:{delay:0},assignedContractId:'C'};
 const g={stationUpgrades:f.u,freightManager:fm,cargoTypes:{getTransportTariffPerTonne:()=>10},economy:f.e,realismSettings:{breakdown:0}};return {...f,fm,s,g};}
test('RC10-STATION no phantom freight loading at a passenger-only station',()=>{
 const f=freightFixture();withGame(f.g,()=>f.e.processStopRevenue(f.s,'A',0,true,false,'A',[]));assert.equal(f.s._contractFreight,0);assert.equal(f.s._onboardFreight,0);
 buy(f,'freight');withGame(f.g,()=>f.e.processStopRevenue(f.s,'A',0,true,false,'A',[]));assert.ok(f.s._contractFreight>0);
});
test('RC10-STATION missing destination terminal retains cargo and unpaid contract, never deletes or pays it',()=>{
 const f=freightFixture();buy(f,'freight');withGame(f.g,()=>f.e.processStopRevenue(f.s,'A',0,true,false,'A',[]));const onboard=f.s._contractFreight;f.s.currentStopIndex=1;
 withGame(f.g,()=>f.e.processStopRevenue(f.s,'B',10,false,true,'B',[]));assert.equal(f.s._contractFreight,onboard);assert.equal(f.fm.contracts[0].progress,0);assert.equal(f.e.revenue,0);
 buy(f,'freight','B');withGame(f.g,()=>f.e.processStopRevenue(f.s,'B',10,false,true,'B',[]));assert.equal(f.s._contractFreight,0);assert.ok(f.fm.contracts[0].progress>0);assert.ok(f.e.revenue>0);
});
function passenger(){return {id:'P',name:'Passenger',serviceType:'passager',rame:{totalCapacity:1000,totalMass:100,maxSpeed:160,cleanliness:{interior:100,exterior:100}},stops:[{stationId:'A',type:'arret'},{stationId:'B',type:'arret'}],currentStopIndex:0,train:{delay:0}};}
test('RC10-STATION dirty cars reduce new demand under the same random draw without deleting through passengers',()=>{
 const f=setup(),g={stationUpgrades:f.u},clean=passenger(),dirty=passenger();dirty.rame.cleanliness={interior:0,exterior:0};
 for(const s of [clean,dirty]){setGlobalRng(new SeededRng(17));withGame(g,()=>f.e.processStopRevenue(s,'A',0,true,false,'A',[]));}
 assert.ok(clean._onboardPax>dirty._onboardPax);assert.ok(Math.abs(dirty._onboardPax-clean._onboardPax*.7)<=1);assert.equal(f.e.passengerSatisfaction,null);
});
test('RC10-STATION real alighting passengers contribute weighted satisfaction; hall/screens/restaurant/wifi are live',()=>{
 const f=setup(),g={stationUpgrades:f.u};const finish=(pax,dirty=false)=>{const s=passenger();s.currentStopIndex=1;s._onboardPax=pax;if(dirty)s.rame.cleanliness={interior:0,exterior:0};withGame(g,()=>f.e.processStopRevenue(s,'B',10,false,true,'B',[]));};
 finish(100);assert.equal(f.e.passengerSatisfaction,85);for(const m of ['hall','display','restaurant','wifi'])buy(f,m,'B');finish(100,true);
 assert.equal(f.e.passengerSatisfactionSamples,200);assert.equal(f.e.passengerSatisfaction,(85+55+13)/2);
 const restored=new Economy();restored.loadFromSave(JSON.parse(JSON.stringify(f.e.toSave())));assert.equal(restored.passengerSatisfaction,f.e.passengerSatisfaction);
});
test('RC10-STATION malformed satisfaction saves stay finite and bounded',()=>{
 const e=new Economy();e.loadFromSave({passengerSatisfactionSamples:NaN,passengerSatisfactionPoints:Infinity});assert.equal(e.passengerSatisfaction,null);
 e.loadFromSave({passengerSatisfactionSamples:10,passengerSatisfactionPoints:1e30});assert.equal(e.passengerSatisfaction,100);
});
