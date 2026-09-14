import test from 'node:test';
import assert from 'node:assert/strict';
import { LineManager } from '../line.js';
import { SillonManager } from '../sillon.js';
import { DepotManager } from '../depot.js';
import { ITEModules } from '../ite-modules.js';
import { IncidentManager } from '../incidents.js';
import { WorksManager } from '../works.js';
import { Dashboard } from '../dashboard.js';
import { GraphMarche } from '../graph-marche.js';
import { StaffManager } from '../staff.js';
import { Weather } from '../weather.js';
import { SeasonalSchedule } from '../seasonal.js';
import { CargoTypeManager } from '../cargo-types.js';
import { FreightManager } from '../freight.js';
import { Bank } from '../bank.js';
import { Economy } from '../economy.js';

const cases = [
 ['line', ()=>new LineManager(), [ {id:123,stops:['a','b'],trackIds:[]}, {id:{},stops:['a','b']} ]],
 ['sillon', ()=>new SillonManager(), [ {id:123,name:'x',fromStationId:'a',toStationId:'b',route:[{lat:0,lon:0},{lat:1,lon:1}],distance:1} ]],
 ['depot', ()=>new DepotManager(), {depots:[{id:123,stationId:'s',type:'depot',lat:0,lon:0,built:true}],activeRescues:[{id:123,depotId:123,stockId:{}}],maintenanceQueue:[{remainingMin:'x'}],repairQueue:[{remainingMin:'x'}]}],
 ['ite', ()=>new ITEModules(), {installations:{x:{modules:[{type:'crane',builtAt:'x'}],level:'Infinity',totalInvested:'Infinity',totalTonnageHandled:'Infinity',totalRevenue:'Infinity'}}}],
 ['incident', ()=>new IncidentManager(), [{id:123,typeId:'obstacle',active:true,stationA:'a',stationB:'b'}]],
 ['works', ()=>new WorksManager(), [{id:123,startDate:'2026-01-01',endDate:'2026-01-02',stationA:'a',stationB:'b',route:[{lat:0,lon:0},{lat:1,lon:1}]}]],
 ['dashboard', ()=>new Dashboard(), {punctualityHistory:[{time:'x',value:'Infinity'},null], revenueHistory:'bad', passengerHistory:[{value:NaN}], kmHistory:[{value:Infinity}]}],
 ['graph', ()=>new GraphMarche(), {mode:'wat', history:[{serviceId:{},lat:'x',lon:Infinity,time:NaN}], colors:{x:'javascript:bad'},positions:{x:{lat:999,lon:999}},stationAId:{},stationBId:[]}],
 ['staff', ()=>new StaffManager(), {staff:[{id:123,role:'conducteur',available:'x',assignedTo:{},lat:999,lon:-999}],zones:[{id:123,lat:999,lon:999,radiusKm:-4}],signalBoxes:[{id:123}],_lastTickTime:Infinity}],
 ['weather', ()=>new Weather(), {_lastLat:'Infinity',_lastLon:'NaN',temperature:'Infinity',humidity:-999,windSpeed:'x'}],
 ['seasonal', ()=>new SeasonalSchedule(), {mode:{},summerStart:{month:99,day:99},serviceOverrides:{x:{summer:{active:'x',freq:Infinity}}},peakServices:[{id:123}]}],
 ['cargo', ()=>new CargoTypeManager(), {stats:{totalContracts:Infinity,totalTonnage:'Infinity',totalRevenue:NaN,byCategory:{x:{contracts:Infinity,tonnage:NaN,revenue:'x'}}},customTypes:[{type:123,name:{},categoryKey:[]}]}],
 ['freight', ()=>new FreightManager(), [{id:123,cargoType:{},cargoTypes:{},quantity:'Infinity',payment:'NaN',fromId:{},toId:[]}]],
 ['bank', ()=>new Bank(), {loans:[{id:123,type:{},remaining:'Infinity',daysLeft:'x'}],startingBalance:'Infinity'}],
 ['economy', ()=>new Economy(), {balance:'Infinity',revenue:'x',ticketPricePerKm:'0',history:[{amount:'Infinity'}],dailySnapshots:[{revenue:'Infinity'}]}],
];
for (const [name, make, payload] of cases) {
 test(`structured malformed load does not throw: ${name}`,()=>{ const m=make(); assert.doesNotThrow(()=>m.loadFromSave(payload)); });
}
