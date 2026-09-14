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

const garbage=[null,undefined,0,1,'x',[],{}, {x:1}, {length:3}, [null,1,'x',{},[]]];
const factories=[
 ['line',()=>new LineManager(),x=>x],['sillon',()=>new SillonManager(),x=>x],['depot',()=>new DepotManager(),x=>x],
 ['ite',()=>new ITEModules(),x=>x],['incident',()=>new IncidentManager(),x=>x],['works',()=>new WorksManager(),x=>x],
 ['dashboard',()=>new Dashboard(),x=>x],['graph',()=>new GraphMarche(),x=>x],['staff',()=>new StaffManager(),x=>x],
 ['weather',()=>new Weather(),x=>x],['seasonal',()=>new SeasonalSchedule(),x=>x],['cargo',()=>new CargoTypeManager(),x=>x],
 ['freight',()=>new FreightManager(),x=>x],['bank',()=>new Bank(),x=>x],['economy',()=>new Economy(),x=>x],
];
for(const [name,make] of factories)test(`malformed load never throws: ${name}`,()=>{
 for(const g of garbage){const m=make();assert.doesNotThrow(()=>m.loadFromSave(g));}
});
