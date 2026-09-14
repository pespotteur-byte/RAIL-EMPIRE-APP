import test from 'node:test';
import assert from 'node:assert/strict';
import { FreightManager } from '../freight.js';
import { CargoTypeManager } from '../cargo-types.js';
import { IndustrialClients } from '../industrial-clients.js';

test('freight load normalizes legacy numeric identities and rejects cargo-less phantom contracts',()=>{
  const f=new FreightManager();
  f.loadFromSave([
    {id:12,cargoType:'coal',quantity:10,initialQuantity:10,fromId:1,toId:2,payment:100,active:true},
    {id:'bad',quantity:50,fromId:'1',toId:'2',payment:9999,active:true},
  ]);
  assert.equal(f.contracts.length,1);
  assert.equal(f.contracts[0].id,'12');
  assert.equal(f.contracts[0].fromId,'1');
  assert.equal(f.contracts[0].toId,'2');
});

test('NaN unload can never mutate a freight contract',()=>{
  const f=new FreightManager();
  f.addContract({id:'c1',cargoType:'coal',quantity:10,initialQuantity:10,fromId:'A',toId:'B',payment:100});
  global.window={game:{cargoTypes:{recordContract(){}},industrialClients:{clients:[],stats:{}}}};
  const svc={rame:{elementDetails:[{cargoTypes:['coal']}]}};
  const out=f.fulfillAtStation(svc,'B',NaN);
  assert.equal(out.remainingTonnes,0);
  assert.equal(f.contracts[0].quantity,10);
  delete global.window;
});

test('explicit 0 satisfaction and market share stay zero before service quality delta',()=>{
  const f=new FreightManager();
  f.addContract({id:'c1',cargoType:'coal',quantity:10,initialQuantity:10,fromId:'A',toId:'B',payment:100,industrialClientId:'client-1'});
  const client={id:'client-1',satisfaction:0,marketShare:0,totalTonnage:0,totalRevenue:0};
  global.window={game:{cargoTypes:{recordContract(){}},industrialClients:{clients:[client],stats:{totalTonnage:0,totalRevenue:0}}}};
  f.fulfillAtStation({rame:{elementDetails:[{category:'wagon',freightCapacity:10,cargoTypes:['coal']}]},assignedContractId:'c1'},'B',10,false,false);
  assert.equal(client.satisfaction,5);
  assert.equal(client.marketShare,0.5);
  delete global.window;
});

test('loading a second save removes previous player custom cargo types/categories',()=>{
  const c=new CargoTypeManager();
  const added=c.addCustomType({name:'Test Cargo',categoryKey:'__new__',categoryName:'Ma catégorie',type:'custom-test'});
  assert.equal(added.ok,true); assert.ok(c.getTypeInfo('custom-test'));
  c.loadFromSave({stats:{},customTypes:[]});
  assert.equal(c.getTypeInfo('custom-test'),null);
});

test('industrial load derives current client count rather than trusting stale save counter',()=>{
  const m=new IndustrialClients();
  const type=m.getIndustryTypes()[0].type;
  m.loadFromSave({clients:[{id:'client-1',type,stationId:'A',depotId:'D',active:true,dailyTonnage:10}],stats:{totalClients:999}});
  assert.equal(m.stats.totalClients,1);
});
