import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RollingStockItem, RollingStockManager } from '../rolling-stock.js';
import { Rame, RameManager } from '../rame.js';

test('Matériel preserves explicit zero power for unpowered automotrice components', () => {
  const z = new RollingStockItem({id:'zr',name:'ZR trailer',category:'automotrice',traction:'electrique',maxSpeed:160,mass:50,power:0,length:25});
  assert.equal(z.power, 0);
  assert.equal(z.purchasePrice, 0);
});

test('Matériel load normalizes ids, prunes duplicates and finite-sanitizes old saves', () => {
  const m = new RollingStockManager();
  assert.doesNotThrow(() => m.loadFromSave({items:[
    {id:12,name:'A',category:'wagon',maxSpeed:120,mass:20,power:0,freightCapacity:0,length:10},
    {id:'12',name:'duplicate',category:'wagon',maxSpeed:120,mass:20,length:10},
    {id:'bad',name:'bad',category:'automotrice',maxSpeed:Infinity,mass:NaN,power:0,length:-4,passengerCapacity:-3},
    null,
  ],seriesCounters:{X:Infinity,Y:-3,Z:'5'}}));
  assert.equal(m.getAll().length, 2);
  assert.equal(m.getById('12').name, 'A');
  const bad=m.getById('bad');
  assert.ok(Number.isFinite(bad.maxSpeed) && bad.maxSpeed > 0);
  assert.ok(Number.isFinite(bad.mass) && bad.mass > 0);
  assert.equal(bad.power,0);
  assert.equal(bad.passengerCapacity,0);
  assert.deepEqual(m.seriesCounters,{X:0,Y:0,Z:5});
});

test('Rame explicit zero freight capacity never turns wagon tare into payload', () => {
  const r = new Rame({elementDetails:[{category:'wagon',maxSpeed:100,mass:20,tonnage:20,freightCapacity:0,length:10}]});
  assert.equal(r.totalFreightCapacity,0);
});

test('Rame old gross-tonnage fallback only uses gross minus empty mass when capacity is absent', () => {
  const r = new Rame({elementDetails:[{category:'wagon',maxSpeed:100,mass:20,tonnage:70,length:10}]});
  // normalizeElement materializes an explicit capacity=0 for current data, so modernized old rows fail safe.
  assert.equal(r.totalFreightCapacity,0);
});

test('Rame load survives malformed containers, normalizes ids and locations', () => {
  const m=new RameManager();
  assert.doesNotThrow(()=>m.loadFromSave(null));
  assert.deepEqual(m.getAll(),[]);
  assert.doesNotThrow(()=>m.loadFromSave([
    {id:7,name:'R',elements:['x'],elementDetails:[{name:'X',category:'locomotive',maxSpeed:120,mass:80,power:2000,length:20}],currentLocation:{lat:999,lon:'2.4',stationId:5}},
    {id:'7',name:'dup',elementDetails:[]},
    null,
  ]));
  assert.equal(m.getAll().length,1);
  const r=m.getById('7');
  assert.equal(r.currentLocation.lat,null);
  assert.equal(r.currentLocation.lon,2.4);
  assert.equal(r.currentLocation.stationId,'5');
  assert.equal(r.elements.length,r.elementDetails.length);
});

test('Rame can recover very old element-id-only save from rolling-stock details', () => {
  const stock=new RollingStockManager();
  stock.add({id:'loco',name:'L',category:'locomotive',maxSpeed:140,mass:80,power:3000,length:18});
  const rm=new RameManager();
  rm.loadFromSave([{id:'r',name:'Old',elements:['loco']}],stock);
  const r=rm.getById('r');
  assert.equal(r.elementDetails.length,1);
  assert.equal(r.totalPower,3000);
  assert.equal(r.elements[0],'loco');
});

test('Rame reconciliation clears missing depots/stations but keeps derived service marker when services are not supplied', () => {
  const rm=new RameManager();
  const r=rm.add({id:'r',name:'R',elementDetails:[{category:'locomotive',maxSpeed:100,mass:80,power:1000,length:15}],currentLocation:{depotId:'gone',stationId:'gone',serviceId:'v2-derived',lat:48,lon:2}});
  rm.reconcileReferences({depots:[{id:'d'}],stations:[{id:'s'}]});
  assert.equal(r.currentLocation.depotId,'');
  assert.equal(r.currentLocation.stationId,'');
  assert.equal(r.currentLocation.serviceId,'v2-derived');
});

test('Matériel/Rames UI carries MLG search and destructive-action guards', () => {
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  for(const key of ['mlgId','mlgSeriesName','mlgArchivePath','mlgCategory','mlgPathCategory','componentRole']) assert.match(ui,new RegExp(key));
  assert.match(ui,/Cette fiche appartient au catalogue de base/);
  assert.match(ui,/il est utilisé dans \$\{usedBy\.length\} rame/);
  assert.match(ui,/Impossible de supprimer une rame actuellement en service/);
  assert.match(ui,/(encore liée à \$\{rotationLinks\.length\} roulement|affectée à \$\{rotationLinks\.length\} ligne\(s\) de roulement)/);
  assert.match(main,/rameManager\.loadFromSave\(s\.rames, this\.rollingStock\)/);
});
