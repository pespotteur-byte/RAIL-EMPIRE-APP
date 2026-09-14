import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,fixture,tick,ActiveService,Economy} from './helpers/rc10-fixtures.mjs';
const {materialResourceEffects:effects,consumeMaterialResources:consume,passengerSatisfactionScore:score}=await mod('consumable-effects');
const {Rame,RameManager}=await mod('rame');
const {DepotManager,Depot}=await mod('depot');
const stock=(traction='diesel',extra={})=>new Rame({id:'TEST',name:'Test',elementDetails:[{elementId:'L',category:'locomotive',traction,power:3000,mass:80,maxSpeed:160}],...extra});
for (const [cap,key,label] of [['fuelCapacityL','fuelL','Gazole'],['oilCapacityL','oilL','Huile moteur'],['coolantCapacityL','coolantL','refroidissement'],['gearboxOilCapacityL','gearboxOilL','transmission'],['hydraulicOilCapacityL','hydraulicOilL','hydraulique']]) {
 test(`RC10-RESOURCE ${key}: exhausted powered train is stopped, no fake breakdown; refill is live`,()=>{
  const r=stock();r.consumables[cap]=100;r.consumables[key]=0;
  assert.equal(effects(r,{electrified:false}).powerW,0);assert.match(effects(r,{electrified:false}).stopReason,new RegExp(label));
  r.consumables[key]=100;assert.equal(effects(r,{electrified:false}).powerW,3000000);
 });
}
for(const mode of ['full','macro'])test(`RC10-RESOURCE movement ${mode}: empty fuel brakes and refill recovers`,()=>{
 const {s,game,rame}=fixture({speed:80});rame.consumables={fuelCapacityL:100,fuelL:0};
 const initial=s.speed;tick(s,mode,game,1);assert.ok(s.speed<initial);assert.match(s.train.delayReason,/Gazole/);assert.equal(s.train.breakdown,null);
 for(let i=0;i<100&&s.speed>0;i++)tick(s,mode,game,1);
 assert.equal(s.speed,0);const distance=s.totalDistance;tick(s,mode,game,1);assert.equal(s.totalDistance,distance);
 rame.consumables.fuelL=100;tick(s,mode,game,1);assert.ok(s.speed>0);assert.ok(rame.consumables.fuelL<100);assert.equal(s.train.breakdown,null);
});
test('RC10-RESOURCE no departure with empty tank; refilled train can depart',()=>{
 const {s,game,rame}=fixture({speed:0});s.state='waiting';s.currentStopIndex=0;rame.consumables={fuelCapacityL:100,fuelL:0};
 s.scheduleTick(600,'2026-09-11',game.economy);assert.equal(s.state,'waiting');assert.match(s.train.delayReason,/Gazole/);
 rame.consumables.fuelL=100;s.scheduleTick(600,'2026-09-11',game.economy);assert.equal(s.state,'moving');
});
test('RC10-RESOURCE bimode has a thermal tank and uses no diesel under compatible wire',()=>{
 const r=stock('bimode');assert.equal(r.consumables.fuelCapacityL,3000);
 const f=r.consumables.fuelL;consume(r,100,{electrified:true});assert.equal(r.consumables.fuelL,f);
 consume(r,100,{electrified:false});assert.equal(r.consumables.fuelL,f-180);
 r.consumables.fuelL=0;assert.equal(effects(r,{electrified:true}).powerW,3000000);assert.equal(effects(r,{electrified:false}).powerW,0);
});
test('RC10-RESOURCE a diesel-electric locomotive is not a catenary-capable bimode',()=>{
 const r=stock('diesel-electric');consume(r,1,{electrified:true});assert.equal(r.consumables.fuelL,2998.2);
 r.consumables.fuelL=0;assert.equal(effects(r,{electrified:true}).powerW,0);
});
test('RC10-RESOURCE incompatible electric system selects bimode diesel, not free power',()=>{
 const r=stock('bimode');r.elementDetails[0].electricSystems=[{voltage:25000,frequency:50}];
 assert.equal(effects(r,{electrified:true,voltage:[1500],frequency:[0]}).fuelUnits,1);
 assert.equal(effects(r,{electrified:true,voltage:[25000],frequency:[50]}).fuelUnits,0);
 r.consumables.fuelL=0;assert.equal(effects(r,{electrified:true,voltage:[1500],frequency:[0]}).powerW,0);
});
test('RC10-RESOURCE mixed electric + diesel keeps only available electric power when fuel is empty',()=>{
 const r=stock();r.elementDetails.push({...r.elementDetails[0],elementId:'E',traction:'electric',power:4000});r.consumables.fuelL=0;
 assert.equal(effects(r,{electrified:true}).powerW,4000000);assert.equal(effects(r,{electrified:true}).stopReason,'');
 assert.equal(effects(r,{electrified:false}).powerW,0);
});
test('RC10-RESOURCE missing legacy levels do not immobilise every imported train',()=>{
 assert.equal(effects({totalPower:4000,traction:'diesel'},{electrified:false}).powerW,4000000);
 assert.equal(effects({totalPower:4000,traction:'diesel',consumables:{fuelCapacityL:100}},{electrified:false}).stopReason,'');
});
test('RC10-RESOURCE AdBlue is opt-in; only declared exhausted equipment derates diesel',()=>{
 const r=stock();assert.equal(r.consumables.adblueCapacityL,0);assert.equal(effects(r).powerW,3000000);
 r.consumables.adblueCapacityL=100;r.consumables.adblueL=0;assert.equal(effects(r).powerW,1500000);r.consumables.adblueL=1;assert.equal(effects(r).powerW,3000000);
});
for(const weather of ['rain','heavy_rain','storm','snow'])test(`RC10-RESOURCE sand/washer ${weather}: wet traction and visibility, not weaker brakes`,()=>{
 const r=stock();r.consumables.sandKg=0;r.consumables.washerL=0;
 assert.equal(effects(r,{},weather).tractionFactor,.7);assert.equal(effects(r,{},weather).speedCap,80);
 assert.equal(effects(r,{},'clear').tractionFactor,1);assert.equal(effects(r,{},'clear').speedCap,Infinity);
 const {s,rame}=fixture();rame.consumables={sandCapacityKg:100,sandKg:0};const wet=s._computePhysicsAccel({type:weather});rame.consumables.sandKg=100;const refilled=s._computePhysicsAccel({type:weather});assert.ok(wet.decel>0);assert.equal(wet.decel,refilled.decel);
});
test('RC10-RESOURCE finite consumption is clamped, independent of frame subdivision, no consumption at rest',()=>{
 const a=stock(),b=stock();for(let i=0;i<100;i++)consume(a,.1,{electrified:false});consume(b,10,{electrified:false});
 for(const key of Object.keys(a.consumables))assert.ok(Math.abs(a.consumables[key]-b.consumables[key])<1e-7,key);
 const snap=structuredClone(a.consumables);for(const d of [0,-10,NaN,Infinity])consume(a,d);assert.deepEqual(a.consumables,snap);
 consume(a,1e12,{electrified:false});for(const [key,v] of Object.entries(a.consumables))assert.ok(Number.isFinite(v)&&v>=0,key);
});
test('RC10-RESOURCE actual depot refuel operation restores traction only on completion',()=>{
 const r=stock(),dm=new DepotManager(),e=new Economy();r.consumables.fuelL=0;
 const d=new Depot({id:'D',built:true,tracks:1,equipmentInventory:{fuel_station:1},resourceStocks:{diesel_l:10000}});dm.depots.push(d);
 assert.equal(dm.enterRame(d.id,r,[]).ok,true);const op=dm.startDepotOperation(d.id,r,'refuel',e);assert.equal(op.ok,true,op.reason);
 assert.equal(effects(r).powerW,0);dm.updateDepotOperations(op.operation.totalMin,{getById:()=>r});assert.equal(effects(r).powerW,3000000);
 assert.equal(d.resourceStocks.diesel_l,7000);assert.equal(r.depotOperationId,'');
});
test('RC10-RESOURCE cleanliness and fluid levels round-trip without being refilled',()=>{
 const a=stock('bimode');a.consumables.fuelL=0;a.cleanliness={interior:13,exterior:21};const manager=new RameManager();manager.rames=[a];const loaded=new RameManager();loaded.loadFromSave(JSON.parse(JSON.stringify(manager.toSave())));const b=loaded.getById(a.id);
 assert.deepEqual(b.cleanliness,a.cleanliness);assert.equal(b.consumables.fuelL,0);assert.equal(effects(b,{electrified:false}).powerW,0);
});
test('RC10-RESOURCE satisfaction observes clean/dirty, delay and actual station bonuses',()=>{
 const r=stock();assert.equal(score(r,0,0),85);r.cleanliness={interior:0,exterior:0};assert.equal(score(r,0,0),55);assert.equal(score(r,60,0),25);assert.equal(score(r,60,.05),30);assert.equal(score(null,0,2),100);
});

test('RC10-RESOURCE unknown frequency is not silently DC; explicit DC remains incompatible with 25 kV AC',()=>{
 const r=stock('bimode');r.elementDetails[0].electricSystems=[{voltage:25000,frequency:50}];r.consumables.fuelL=0;
 for(const frequency of [undefined,[],[null],[''],['unknown']]) {
  const e=effects(r,{electrified:true,voltage:[25000],frequency});assert.equal(e.powerW,3000000);assert.equal(e.fuelUnits,0);
 }
 assert.equal(effects(r,{electrified:true,voltage:[25000],frequency:[0]}).powerW,0);
});
test('RC10-RESOURCE legacy explicit zero capacity is not refilled or invented on import',()=>{
 const r=stock('bimode',{consumables:{fuelCapacityL:0,fuelL:0}});
 assert.equal(r.consumables.fuelCapacityL,0);assert.equal(r.consumables.fuelL,0);
 consume(r,100,{electrified:false});assert.equal(r.consumables.fuelL,0);
 assert.equal(effects(r,{electrified:false}).powerW,3000000);
});
