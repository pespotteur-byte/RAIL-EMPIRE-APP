import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DepotManager,
  DEPOT_RESOURCE_CATALOG,
  DEPOT_PART_CATALOG,
  DEPOT_OPERATION_CATALOG,
  DEPOT_EQUIPMENT_CATALOG,
  DEPOT_STAFF_CATALOG,
  DEPOT_TRACK_EXPANSION_COST,
} from '../depot.js';
import { Rame } from '../rame.js';
import { ActiveService } from '../schedule-creator.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=10_000_000)=>({balance,expenses:[],addExpense(amount,cat,label){this.balance-=amount;this.expenses.push({amount,cat,label});}});
const rame=(id='R1')=>new Rame({
  id,name:`BB 75000 ${id}`,
  elementDetails:[{elementId:`${id}-L`,catalogId:'X',name:'BB 75000',instanceName:`BB 75000 ${id}`,seriesName:'BB 75000',category:'locomotive',traction:'diesel',length:20,maxSpeed:120,mass:90,tonnage:90,power:2000}],
  depotId:'',currentLocation:{}
});

test('HOTFIX51 expands consumables, staff roles, equipment and spare-parts catalogues',()=>{
  for(const key of ['gearbox_oil_l','hydraulic_oil_l','washer_fluid_l','grease_kg','brake_cleaner_l','interior_cleaner_l','disinfectant_l','toilet_chemical_l','compressed_air_m3','wastewater_l']) assert.ok(DEPOT_RESOURCE_CATALOG[key],key);
  for(const key of ['mecanicien_diesel','technicien_traction_elec','specialiste_freinage','specialiste_essieux','agent_levage','agent_assainissement','magasinier']) assert.ok(DEPOT_STAFF_CATALOG[key],key);
  for(const key of ['lifting_jacks','underfloor_lathe','wash_plant','fuel_station','sand_station','fluid_station','inspection_pit','overhead_crane','brake_bench','roof_access']) assert.ok(DEPOT_EQUIPMENT_CATALOG[key],key);
  for(const key of ['turbocharger','traction_motor','wheelset','bogie_frame','brake_caliper','compressor','pantograph','battery_pack']) assert.ok(DEPOT_PART_CATALOG.some(p=>p.id===key),key);
});

test('HOTFIX51 player can buy real additional depot tracks and capacity follows immediately',()=>{
  const dm=new DepotManager(),eco=economy();
  const d=dm.add({type:'depot',name:'VSG DP',stationId:'VSG',tracks:2,cost:0,placementOnly:true,location:{lat:48.7,lon:2.4}},null);
  const before=eco.balance;
  const res=dm.addDepotTracks(d.id,3,eco);
  assert.equal(res.ok,true);
  assert.equal(res.count,3);
  assert.equal(d.tracks,5);
  assert.equal(d.trackOccupancy.length,5);
  assert.equal(before-eco.balance,3*DEPOT_TRACK_EXPANSION_COST);
  assert.equal(dm.getDepotOccupancy(d.id).capacity,5);
});

test('HOTFIX51 one installed fuel station means one simultaneous refuelling slot',()=>{
  const dm=new DepotManager(),eco=economy();
  const d=dm.add({type:'depot',name:'VSG DP',stationId:'VSG',tracks:3,cost:0,placementOnly:true,location:{lat:48.7,lon:2.4},infrastructure:[]},null);
  const r1=rame('R1'),r2=rame('R2');
  assert.equal(dm.enterRame(d.id,r1,[]).ok,true);
  assert.equal(dm.enterRame(d.id,r2,[]).ok,true);
  r1.consumables.fuelL=0;r2.consumables.fuelL=0;
  assert.equal(dm.buyEquipment(d.id,'fuel_station',eco).ok,true);
  assert.equal(dm.buyResource(d.id,'diesel_l',15000,eco).ok,true);
  const op1=dm.startDepotOperation(d.id,r1,'refuel',eco);
  assert.equal(op1.ok,true);
  assert.deepEqual(op1.operation.equipment,['fuel_station']);
  const blocked=dm.startDepotOperation(d.id,r2,'refuel',eco);
  assert.equal(blocked.ok,false);
  assert.match(blocked.reason,/Équipement occupé.*Station-service gazole/);
  assert.equal(dm.buyEquipment(d.id,'fuel_station',eco).ok,true);
  const op2=dm.startDepotOperation(d.id,r2,'refuel',eco);
  assert.equal(op2.ok,true);
  assert.equal(dm.getEquipmentAvailability(d.id,'fuel_station').busy,2);
});

test('HOTFIX51 underfloor wheel lathe is a functional prerequisite for reprofiling',()=>{
  const dm=new DepotManager(),eco=economy();
  const d=dm.add({type:'depot',name:'Atelier',stationId:'A',tracks:2,cost:0,placementOnly:true,infrastructure:[]},null);
  const r=rame('W');dm.enterRame(d.id,r,[]);
  let res=dm.startDepotOperation(d.id,r,'wheel_reprofile',eco);
  assert.equal(res.ok,false);
  assert.match(res.reason,/Tour en fosse/);
  assert.equal(dm.buyEquipment(d.id,'underfloor_lathe',eco).ok,true);
  res=dm.startDepotOperation(d.id,r,'wheel_reprofile',eco);
  assert.equal(res.ok,true);
  assert.deepEqual(res.operation.equipment,['underfloor_lathe']);
});

test('HOTFIX51 equipment, tracks and expanded resource data survive depot save/load',()=>{
  const dm=new DepotManager(),eco=economy();
  const d=dm.add({type:'depot',name:'Persist',stationId:'P',tracks:2,cost:0,placementOnly:true,infrastructure:[]},null);
  dm.addDepotTracks(d.id,2,eco);
  dm.buyEquipment(d.id,'wash_plant',eco);
  dm.buyEquipment(d.id,'lifting_jacks',eco);
  dm.buyResource(d.id,'washer_fluid_l',250,eco);
  const saved=dm.toSave();
  const loaded=new DepotManager();
  loaded.loadFromSave(saved);
  const d2=loaded.getDepotById(d.id);
  assert.ok(d2);
  assert.equal(d2.tracks,4);
  assert.equal(d2.trackOccupancy.length,4);
  assert.equal(d2.equipmentCount('wash_plant'),1);
  assert.equal(d2.equipmentCount('lifting_jacks'),1);
  assert.equal(d2.resourceStocks.washer_fluid_l,250);
});

test('HOTFIX51 UI wires every depot search and exposes track/equipment purchases',()=>{
  const ui=read('js/ui.js'),css=read('style.css');
  assert.match(ui,/_wireDepotSearchInputs\(root\)/);
  assert.match(ui,/addEventListener\('input'/);
  assert.match(ui,/filterDepotRows\(input,input\.dataset\.depotFilter,input\.dataset\.depotKey\)/);
  assert.match(ui,/Rechercher un dépôt/);
  assert.match(ui,/Rechercher une ITE/);
  assert.match(ui,/Rechercher une rame, locomotive, voiture, wagon/);
  assert.match(ui,/Rechercher une voie, une rame ou une opération/);
  assert.match(ui,/Rechercher fosse, levage, tour en fosse, lavage, station-service/);
  assert.match(ui,/Rechercher gazole, sable, huile, produit de nettoyage/);
  assert.match(ui,/Rechercher une pièce, une référence, un moteur, bogie, frein/);
  assert.match(ui,/Rechercher un métier, une spécialité ou une opération/);
  assert.match(ui,/\+ 1 voie/);
  assert.match(ui,/\+ 5 voies/);
  assert.match(ui,/buyDepotEquipment/);
  assert.match(css,/\.depot-equipment-grid/);
});

test('HOTFIX51 requested depot equipment is visible and operational UI is data-backed',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/Équipements techniques du dépôt/);
  assert.match(ui,/Les équipements sont fonctionnels/);
  assert.match(ui,/a\.free.*a\.busy/s);
  assert.match(ui,/Consommations réelles du dépôt/);
  assert.match(ui,/resourceUsage/);
  assert.match(ui,/expenseLedger/);
  assert.match(ui,/Postes & compétences du dépôt/);
});

test('HOTFIX51 point creator delegates detailed facilities to the depot management page',()=>{
  const point=read('js/depot-ite-point-editor.js');
  assert.match(point,/équipements.*page Dépôts & ITE/i);
  assert.match(point,/infrastructure:\[\]/);
  assert.doesNotMatch(point,/value="technicentre"/);
  assert.doesNotMatch(point,/value="rotonde"/);
});

test('HOTFIX51 rolling stock has the extra fluid levels and mileage consumes them',()=>{
  const rameSrc=read('js/rame.js'),sc=read('js/schedule-creator.js');
  assert.match(rameSrc,/gearboxOilCapacityL/);
  assert.match(rameSrc,/hydraulicOilCapacityL/);
  assert.match(rameSrc,/washerCapacityL/);
  // RC10 extracted the resource rules: assert the real call and real mileage
  // effect instead of requiring every field name to live in the old module.
  assert.match(sc,/consumeMaterialResources\(this\.rame, distKm/);
  const r=rame(),before={...r.consumables};
  ActiveService.prototype._trackWear.call({rame:r,train:{breakdown:{type:'portes'}}},10,600);
  for (const key of ['gearboxOilL','hydraulicOilL','washerL']) {
    assert.ok(r.consumables[key]<before[key],key);
    assert.ok(r.consumables[key]>=0,key);
  }
});

test('HOTFIX51 FILE bundle exposes equipment/track/search runtime and cache',()=>{
  const bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(bundle,/HOTFIX51-DEPOT-EQUIPMENT-TRACKS-SEARCH-WIRING/);
  assert.match(bundle,/Tour en fosse/);
  assert.match(bundle,/Station-service gazole/);
  assert.match(bundle,/addDepotTracks/);
  assert.match(bundle,/_wireDepotSearchInputs/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
