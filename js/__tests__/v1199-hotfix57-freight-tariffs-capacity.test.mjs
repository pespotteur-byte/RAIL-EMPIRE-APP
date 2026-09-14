import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FreightManager } from '../freight.js';
import { CargoTypeManager } from '../cargo-types.js';
import { Rame } from '../rame.js';
import { IndustrialClients } from '../industrial-clients.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

function mixedRame(){return new Rame({id:'M',name:'Mixte',elementDetails:[
 {category:'locomotive',mass:85,tonnage:85,freightCapacity:0,cargoTypes:[],maxSpeed:120,length:20,power:5000},
 {category:'wagon',mass:20,tonnage:80,freightCapacity:60,cargoTypes:['coal'],maxSpeed:100,length:15},
 {category:'wagon',mass:22,tonnage:82,freightCapacity:60,cargoTypes:['diesel'],maxSpeed:100,length:15},
 {category:'wagon',mass:22,tonnage:82,freightCapacity:60,cargoTypes:['diesel'],maxSpeed:100,length:15},
]});}

test('HOTFIX57 mixed consist capacity is cargo-specific',()=>{
 const f=new FreightManager(),r=mixedRame();
 assert.equal(r.totalFreightCapacity,180);
 assert.equal(f.getRameCargoCapacity(r,'coal'),60);
 assert.equal(f.getRameCargoCapacity(r,'diesel'),120);
 assert.equal(f.getRameCargoCapacity(r,{cargoType:'coal',cargoTypes:['coal'],diffuse:false}),60);
});

test('HOTFIX57 zero-capacity labelled wagon cannot satisfy or enlarge a contract',()=>{
 const f=new FreightManager();
 const r=new Rame({elementDetails:[
  {category:'wagon',mass:20,freightCapacity:0,cargoTypes:['coal'],maxSpeed:100,length:10},
  {category:'wagon',mass:20,freightCapacity:50,cargoTypes:['diesel'],maxSpeed:100,length:10},
 ]});
 assert.equal(f.getRameCargoCapacity(r,'coal'),0);
 assert.equal(f.isContractCompatibleWithRame({cargoType:'coal',cargoTypes:['coal']},r),false);
 assert.deepEqual(f.getRameCargoTypes(r),['diesel']);
});

test('HOTFIX57 Rame exposes exact per-cargo capacity map',()=>{
 const r=mixedRame();
 assert.equal(r.freightCapacityByCargo.coal,60);
 assert.equal(r.freightCapacityByCargo.diesel,120);
 assert.equal(r.getFreightCapacityForCargo('coal'),60);
 assert.equal(r.maxGrossMass,r.totalMass+180);
});

test('HOTFIX57 cargo page tariff helper is authoritative',()=>{
 const c=new CargoTypeManager();
 assert.equal(c.getTransportTariffPerTonne('coal'),25);
 assert.equal(c.getTransportTariffPerTonne('__missing__'),0);
});

test('HOTFIX57 generated generic contracts use tonnes as physical operational unit',()=>{
 const src=read('js/freight.js');
 assert.match(src,/unit: 't'/);
 assert.match(src,/payment = quantity \* cargo\.pricePerUnit/);
});

test('HOTFIX57 industrial contracts use Marchandises tariff when available',()=>{
 const src=read('js/industrial-clients.js');
 assert.match(src,/getTransportTariffPerTonne/);
 assert.match(src,/effectiveTariff/);
 assert.match(read('js/main.js'),/generateDailyContracts\(this\.freightManager, this\.world, this\.cargoTypes\)/);
});

test('HOTFIX57 generic freight revenue no longer uses legacy 0.08 euro per tonne-km',()=>{
 const src=read('js/economy.js');
 assert.match(src,/getTransportTariffPerTonne/);
 assert.match(src,/fret \$\{cType \|\| 'non typé'\}/);
 assert.doesNotMatch(src,/genericRevenue = Math\.round\(freightUnload \* distFromPrev \* this\.freightPricePerTKm\)/);
});

test('HOTFIX57 Rames UI distinguishes tare and shows capacity by merchandise',()=>{
 const src=read('js/ui.js');
 assert.match(src,/Masse à vide:/);
 assert.match(src,/Capacité par marchandise/);
 assert.match(read('js/cargo-types.js'),/Tarif RE \/ t/);
});
