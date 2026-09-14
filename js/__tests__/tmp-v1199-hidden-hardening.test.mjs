import test from 'node:test';
import assert from 'node:assert/strict';
import { Unions } from '../unions.js';
import { Connections } from '../connections.js';
import { StationUpgrades } from '../station-upgrades.js';
import { JunctionManager } from '../junctions.js';
import { ShuntingManager } from '../shunting.js';
import { VoiePointManager } from '../voie-points.js';

const world={stations:[{id:'A',name:'A'},{id:'B',name:'B'}]};
const rameManager={getAll:()=>[{id:'R1'}]};

test('unions malformed save is finite and inactive strike is coherent',()=>{
 const u=new Unions();
 u.loadFromSave({satisfaction:Infinity,strikeActive:true,strikeDaysLeft:0,strikePercent:Infinity,_strikeHistory:[null,{date:3,duration:Infinity,cause:{},percent:-5}]});
 assert.equal(Number.isFinite(u.satisfaction),true);
 assert.equal(u.strikeActive,false);
 assert.equal(u.strikeDaysLeft,0);
 assert.equal(u.strikePercent,0);
 assert.equal(u._strikeHistory.length,1);
});

test('connections strict policy really means zero wait and malformed duplicates are pruned',()=>{
 const c=new Connections(); c.waitPolicy='strict'; assert.equal(c._getWaitTime(),0);
 c.loadFromSave({waitPolicy:'strict',transfers:[
  {id:'x',fromServiceId:'1',toServiceId:'2',stationId:'A',waitTime:Infinity},
  {id:'y',fromServiceId:'1',toServiceId:'2',stationId:'A'},
  {id:'z',fromServiceId:'2',toServiceId:'2',stationId:'A'}
 ],stats:{successfulTransfers:2,missedTransfers:3,totalTransfers:1}});
 assert.equal(c.transfers.length,1); assert.equal(c.transfers[0].waitTime,0); assert.equal(c.stats.totalTransfers,5);
});

test('connections recognizes a stopped feeder at the actual current stop',()=>{
 const c=new Connections(); c.waitPolicy='moderate'; c.addTransfer('F','T','B');
 // RC2: a bounded hold needs the receiver's booked departure; the previous
 // incomplete fixture supplied no receiver and could not prove a maximum wait.
 const feeder={id:'F',state:'stopped_at_station',currentStopIndex:2,delay:0,train:{_stoppedSinceGameTime:20},getCurrentStops:()=>[{stationId:'A',type:'arret',arrivalTime:10},{stationId:'B',type:'arret',arrivalTime:20}]};
 const receiver={id:'T',state:'waiting',currentStopIndex:0,stops:[{stationId:'B',type:'arret',departureTime:20}]};
 assert.equal(c.shouldWait('T','B',20,[feeder,receiver]),true);
 assert.equal(c.shouldWait('T','B',23,[feeder,receiver]),false);
});

test('station upgrades reject deleted stations and excessive modules',()=>{
 const s=new StationUpgrades();
 s.loadFromSave({upgrades:{A:{modules:Array(99).fill({type:'platform',builtAt:1}),totalInvested:Infinity},Z:{modules:[{type:'platform'}]},'__proto__':{modules:[]}}},world);
 assert.deepEqual(Object.keys(s.upgrades),['A']);
 const mods=s.upgrades.A.modules;
 const def=s.availableModules.platform;
 assert.ok(mods.length<=def.maxPerStation);
 assert.equal(Number.isFinite(s.upgrades.A.totalInvested),true);
});

test('junctions prune bad station/rame refs and invalid capacity',()=>{
 const j=new JunctionManager();
 j.loadFromSave({junctions:[{id:'J1',stationId:'A',state:'wat'},{id:'J1',stationId:'A'},{id:'J2',stationId:'Z'}],sidings:[{id:'S1',stationId:'A',capacity:-4,occupants:['R1','R1','BAD']},{id:'S2',stationId:'Z'}]},world,rameManager);
 assert.equal(j.junctions.length,1); assert.equal(j.junctions[0].state,'normal');
 assert.equal(j.sidings.length,1); assert.ok(j.sidings[0].capacity>=1); assert.deepEqual(j.sidings[0].occupants,['R1']);
});

test('shunting consumes a large delta across multiple phases without losing time',()=>{
 const s=new ShuntingManager();
 const op=s.startOperation('svc','A','D','general',100,10,{});
 assert.ok(op);
 const total=Object.values(op.phaseDurations).reduce((a,b)=>a+b,0);
 const done=s.update(total+10);
 assert.equal(done.length,1);
 assert.equal(s.getActiveOperations().length,0);
 assert.ok(s.stats.totalOperations>=1);
});

test('shunting malformed save stays finite and ignores completed/duplicate operations',()=>{
 const s=new ShuntingManager();
 s.loadFromSave({operations:[{id:'shunt-1',serviceId:'S',stationId:'A',tonnage:Infinity,wagons:Infinity,phaseIndex:Infinity},{id:'shunt-1',serviceId:'S2',stationId:'A'},{id:'shunt-2',serviceId:'S',stationId:'A',completed:true}],history:[{id:3,tonnage:Infinity,duration:NaN}],stats:{totalDuration:Infinity,totalOperations:3},_nextOpId:Infinity});
 assert.equal(s.operations.length,1);
 assert.ok(Number.isFinite(s.operations[0].tonnage)); assert.ok(Number.isFinite(s.operations[0].wagons));
 assert.ok(Number.isFinite(s.stats.totalDuration));
});

test('voie-points malformed compact save repairs zero-km route and rejects dangling endpoints',()=>{
 const v=new VoiePointManager();
 v.loadFromSave({_v:3,voiePoints:[{id:'P1',la:0,lo:0,v:'1'},{id:'P2',la:0,lo:4000,v:'1'},{id:'P2',la:0,lo:5000,v:'1'},{id:'BAD',la:99999999,lo:0}],troncons:[
  {id:'T1',a:'P1',b:'P2',d:0,w:Infinity,rt:{q:5,c:[0,0,0,4000],s:[80,80]}},
  {id:'T2',a:'P1',b:'MISSING',d:3},
  {id:'T1',a:'P1',b:'P2',d:2}
 ]},world);
 assert.equal(v.voiePoints.length,2); assert.equal(v.troncons.length,1);
 assert.ok(v.troncons[0].distance>0 && v.troncons[0].distance<10);
 assert.equal(v.troncons[0].wear,0);
});
