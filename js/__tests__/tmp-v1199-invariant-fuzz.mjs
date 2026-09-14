import test from 'node:test';
import assert from 'node:assert/strict';
import { DepotManager } from '../depot.js';
import { ITEModules } from '../ite-modules.js';
import { Dashboard } from '../dashboard.js';
import { GraphMarche } from '../graph-marche.js';
import { StaffManager } from '../staff.js';
import { Weather } from '../weather.js';
import { SeasonalSchedule } from '../seasonal.js';
import { CargoTypeManager } from '../cargo-types.js';
import { FreightManager } from '../freight.js';
import { Bank } from '../bank.js';
import { Economy } from '../economy.js';

function assertFiniteDeep(value,path='root',seen=new Set()){
  if(typeof value==='number') assert.ok(Number.isFinite(value), `${path} non-finite: ${value}`);
  if(!value || typeof value!=='object' || seen.has(value)) return;
  seen.add(value);
  if(value instanceof Map || value instanceof Set) { for(const [k,v] of value instanceof Map?value.entries():[...value].map(x=>[x,x])) assertFiniteDeep(v,`${path}.${String(k)}`,seen); return; }
  for(const [k,v] of Object.entries(value)) {
    if(typeof v==='function') continue;
    if(path==='bank' && k==='maxLoans') continue; // Infinity is intentional: no hard count limit.
    assertFiniteDeep(v,`${path}.${k}`,seen);
  }
}

const cases=[
 ['depot',()=>new DepotManager(),{depots:[{id:'depot-1',stationId:'s',type:'depot',built:true,cost:'Infinity',tracks:'Infinity',spareParts:{moteur:'Infinity'},iteTracks:[{name:'x',length:'Infinity'}]}],activeRescues:[{id:'rescue-1',depotId:'depot-1',stockId:'x',_routeRetrySec:'Infinity'}],maintenanceQueue:[{rameId:'r',depotId:'depot-1',remainingMin:'Infinity',totalMin:'Infinity'}],repairQueue:[{serviceId:'s',depotId:'depot-1',remainingMin:'Infinity',totalMin:'Infinity'}]}],
 ['ite',()=>new ITEModules(),{installations:{'depot-1':{modules:[{type:'crane',builtAt:'Infinity'}],totalInvested:'Infinity',level:'Infinity',totalTonnageHandled:'Infinity',totalRevenue:'Infinity'}}}],
 ['dashboard',()=>new Dashboard(),{punctualityHistory:[{time:Infinity,value:Infinity}],revenueHistory:[{time:Infinity,value:Infinity}],passengerHistory:[{time:Infinity,value:Infinity}],kmHistory:[{time:Infinity,value:Infinity}],lastRecordTime:Infinity}],
 ['graph',()=>new GraphMarche(),{history:[{time:Infinity,lat:Infinity,lon:Infinity,distance:Infinity}],positions:{x:{lat:Infinity,lon:Infinity,distance:Infinity}},serviceColors:{x:'bad'}}],
 ['staff',()=>new StaffManager(),{staff:[{id:'staff-1',role:'conducteur',salary:Infinity,shiftWorkedMin:Infinity,weeklyWorkedMin:Infinity,restRemainingMin:Infinity,lat:Infinity,lon:Infinity}],zones:[{id:'z',lat:Infinity,lon:Infinity,radiusKm:Infinity}],signalBoxes:[{id:'s',lat:Infinity,lon:Infinity,radiusKm:Infinity}],_lastTickTime:Infinity}],
 ['weather',()=>new Weather(),{temperature:Infinity,humidity:Infinity,windSpeed:Infinity,windDirection:Infinity,precipitation:Infinity,visibility:Infinity,pressure:Infinity,dewpoint:Infinity,_lastLat:Infinity,_lastLon:Infinity}],
 ['seasonal',()=>new SeasonalSchedule(),{serviceOverrides:{x:{summer:{freq:Infinity},winter:{freq:-Infinity}}},peakServices:[{id:'x',frequency:Infinity}]}],
 ['cargo',()=>new CargoTypeManager(),{stats:{totalContracts:Infinity,totalTonnage:Infinity,totalRevenue:Infinity,byCategory:{x:{contracts:Infinity,tonnage:Infinity,revenue:Infinity}}},customTypes:[{type:'x',categoryKey:'y',name:'z',pricePerUnit:Infinity}]}],
 ['freight',()=>new FreightManager(),[{id:'fret-1',cargoType:'x',quantity:Infinity,initialQuantity:Infinity,payment:Infinity,unitPrice:Infinity,progress:Infinity}]],
 ['bank',()=>new Bank(),{loans:[{id:'l1',type:'short',remaining:Infinity,daysLeft:Infinity,totalDays:Infinity,principal:Infinity,totalDue:Infinity,rate:Infinity,dailyPayment:Infinity}],startingBalance:Infinity}],
 ['economy',()=>new Economy(),{balance:Infinity,revenue:Infinity,expenses:Infinity,penalties:Infinity,ticketPricePerKm:Infinity,freightPricePerTKm:Infinity,totalPassengers:Infinity,totalFreightTonnes:Infinity,totalTicketsSold:Infinity,totalTicketRevenue:Infinity,totalFraudFines:Infinity,fraudRate:Infinity,_currentDayRevenue:Infinity,_currentDayExpenses:Infinity}],
];
for(const [name,make,payload] of cases)test(`loaded state finite: ${name}`,()=>{const m=make();m.loadFromSave(payload);assertFiniteDeep(m,name);});
