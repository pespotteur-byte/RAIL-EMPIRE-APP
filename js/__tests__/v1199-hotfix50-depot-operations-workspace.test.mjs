import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DepotManager, DEPOT_RESOURCE_CATALOG, DEPOT_PART_CATALOG, DEPOT_OPERATION_CATALOG } from '../depot.js';
import { Rame } from '../rame.js';
import { RotationV2Manager } from '../rotation-v2-model.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=1_000_000)=>({balance,expenses:[],addExpense(amount,cat,label){this.balance-=amount;this.expenses.push({amount,cat,label});}});
const rame=(id='R1')=>new Rame({id,name:'BB 75000 rame',elementDetails:[{elementId:`${id}-L`,catalogId:'X',name:'BB 75000',instanceName:'BB 75001',seriesName:'BB 75000',category:'locomotive',traction:'diesel',length:20,maxSpeed:120,mass:90,tonnage:90,power:2000}],depotId:'',currentLocation:{}});

test('HOTFIX50 home depot assignment never moves a rame automatically',()=>{
  const dm=new DepotManager(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:2,cost:0,placementOnly:true,location:{lat:47.3,lon:5.0}},null); const r=rame();
  assert.equal(dm.assignRameHome(r,d.id),true);
  assert.equal(r.depotId,d.id); assert.equal(r.currentLocation.depotId,'');
  assert.equal(r.elementDetails[0].homeDepotId,d.id);
});

test('HOTFIX50 only explicit player admission occupies depot tracks and capacity is enforced',()=>{
  const dm=new DepotManager(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:1,cost:0,placementOnly:true,location:{lat:47.3,lon:5.0}},null); const r1=rame('R1'),r2=rame('R2');
  assert.equal(dm.enterRame(d.id,r1,[]).ok,true); assert.equal(d.occupancyCount(),1); assert.equal(r1.currentLocation.depotId,d.id);
  assert.equal(dm.enterRame(d.id,r2,[]).ok,false);
  assert.equal(dm.leaveRame(d.id,r1).ok,true); assert.equal(d.occupancyCount(),0);
});

test('HOTFIX50 active service blocks manual depot admission',()=>{
  const dm=new DepotManager(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:2,cost:0},null); const r=rame();
  const res=dm.enterRame(d.id,r,[{rame:r,state:'moving',completed:false,cancelled:false}]); assert.equal(res.ok,false); assert.equal(d.occupancyCount(),0);
});

test('HOTFIX50 depot resources cost money and refuelling consumes stocked diesel',()=>{
  const dm=new DepotManager(), eco=economy(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:2,cost:0,infrastructure:['technicentre']},null); const r=rame(); dm.enterRame(d.id,r,[]);
  r.consumables.fuelL=0; const buy=dm.buyResource(d.id,'diesel_l',6000,eco); assert.equal(buy.ok,true); assert.ok(eco.expenses.length>0);
  const before=d.resourceStocks.diesel_l; const op=dm.startDepotOperation(d.id,r,'refuel',eco); assert.equal(op.ok,true); assert.ok(d.resourceStocks.diesel_l<before); dm.updateDepotOperations(999,null);
});

test('HOTFIX50 heavy engine operation selects the real BB75000 engine reference',()=>{
  const dm=new DepotManager(), eco=economy(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:2,cost:0,infrastructure:['technicentre']},null); const r=rame(); dm.enterRame(d.id,r,[]); r.pendingDefects=['moteur'];
  const real=DEPOT_PART_CATALOG.find(p=>p.id==='engine_mtu_16v4000_r41'); assert.ok(real); assert.equal(dm.buyPart(d.id,real.id,1,eco).ok,true);
  const op=dm.startDepotOperation(d.id,r,'engine_replace',eco); assert.equal(op.ok,true); assert.equal(op.operation.parts[real.id],1); dm.updateDepotOperations(999,r=>r);
});


test('HOTFIX50 depot storage is distinct from maintenance and blocks service as depot state',()=>{
  const dm=new DepotManager(); const d=dm.add({type:'depot',name:'Dijon',stationId:'DIJ',tracks:2,cost:0},null); const r=rame();
  const svc={rame:r,train:{inMaintenance:false,inDepot:false},state:'waiting',completed:false,cancelled:false};
  assert.equal(dm.enterRame(d.id,r,[svc]).ok,true);
  assert.equal(r.inMaintenance,false,'parking must not set maintenance');
  assert.equal(svc.train.inMaintenance,false,'service must not be mislabelled maintenance');
  assert.equal(svc.train.inDepot,true,'service is blocked by physical depot presence');
  assert.equal(dm.leaveRame(d.id,r,[svc]).ok,true);
  assert.equal(svc.train.inDepot,false);
});

test('HOTFIX50 materialized locomotives and coupons persist their own home depot',()=>{
  const rm=new RotationV2Manager(); const r=rame();
  r.elementDetails.push({...r.elementDetails[0],elementId:'R1-C1',instanceName:'Voiture 1',name:'Voiture',category:'voiture',traction:'none',power:0});r.elements.push('COACH');
  r.elementDetails[0].homeDepotId='DEP-A';r.elementDetails[1].homeDepotId='DEP-A';
  const loco=rm.materializeRameElement(r,0),coupon=rm.materializeRameCoupon(r,[1],'Coupon A');
  assert.equal(loco.homeDepotId,'DEP-A');assert.equal(coupon.homeDepotId,'DEP-A');
  assert.equal(rm.setVehicleHomeDepot(loco.id,'DEP-B'),true);assert.equal(loco.homeDepotId,'DEP-B');
  assert.equal(rm.setCouponHomeDepot(coupon.id,'DEP-C'),true);assert.equal(coupon.homeDepotId,'DEP-C');assert.equal(rm.getVehicle(coupon.vehicleIds[0]).homeDepotId,'DEP-C');
  const saved=rm.toSave();const loaded=new RotationV2Manager();assert.equal(loaded.loadFromSave(saved),true);assert.equal(loaded.getVehicle(loco.id).homeDepotId,'DEP-B');assert.equal(loaded.getCoupon(coupon.id).homeDepotId,'DEP-C');
});

test('HOTFIX50 UI exposes clear searchable depot workspace and separated home/presence concepts',()=>{
  const ui=read('js/ui.js'), css=read('style.css'), sc=read('js/schedule-creator.js'), rt=read('js/schedule-v2-runtime.js'), renderer=read('js/renderer.js');
  assert.match(ui,/port d'attache et présence physique/i);
  assert.match(ui,/L’affectation ne déplace jamais le matériel/);
  assert.match(ui,/Rechercher une rame, locomotive, voiture, wagon/);
  assert.match(ui,/Matériel matérialisé des roulements/);
  assert.match(ui,/Rechercher une locomotive, un véhicule ou un coupon de roulement/);
  assert.match(ui,/Occupation des voies de garage/);
  assert.match(ui,/Rechercher une voie, une rame ou une opération/);
  assert.match(ui,/coût eau\/énergie/);
  assert.match(ui,/valeur stock consommé/);
  assert.match(ui,/Maintenance & avitaillement/);
  assert.match(ui,/Stocks & pièces/);
  assert.match(ui,/Les opérations réservent réellement les agents affectés à ce dépôt/);
  assert.match(ui,/Une rame simplement garée n’est pas marquée « en maintenance »/);
  assert.match(css,/\.depot-master\{/);
  assert.match(css,/\.depot-track-grid\{/);
  assert.match(sc,/inDepot: rame \? !!rame\.currentLocation\?\.depotId/);
  assert.match(sc,/_movementStop\('DEPOT'/);
  assert.match(rt,/ROTATION_RAME_DEPOT/);
  assert.match(renderer,/svc\.train\?\.inDepot/);
});

test('HOTFIX50 operation and resource catalog covers cleaning, fluids, sand, fuel and heavy work',()=>{
  for(const key of ['diesel_l','sand_kg','engine_oil_l','coolant_l','water_l','electricity_kwh']) assert.ok(DEPOT_RESOURCE_CATALOG[key]);
  for(const key of ['refuel','sand_fill','fluid_service','exterior_wash','interior_clean','wheel_reprofile','engine_replace']) assert.ok(DEPOT_OPERATION_CATALOG[key]);
});


test('HOTFIX50 FILE bundle exposes operational depot workspace and distinct depot state',()=>{
  const bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(bundle,/HOTFIX50-DEPOT-OPERATIONS-WORKSPACE/);
  assert.match(bundle,/ROTATION_RAME_DEPOT/);
  assert.match(bundle,/Matériel matérialisé des roulements/);
  assert.match(bundle,/inDepot/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
