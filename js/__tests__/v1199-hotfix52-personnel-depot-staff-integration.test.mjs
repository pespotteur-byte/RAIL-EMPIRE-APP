import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaffManager, STAFF_ROLES } from '../staff.js';
import { DepotManager, DEPOT_STAFF_CATALOG } from '../depot.js';
import { Rame } from '../rame.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=10_000_000)=>({balance,expenses:[],addExpense(amount,cat,label){this.balance-=amount;this.expenses.push({amount,cat,label});},formatAmount(n){return `${Math.round(n)} €`;}});
const rame=(id='R1')=>new Rame({id,name:`BB 75000 ${id}`,elementDetails:[{elementId:`${id}-L`,catalogId:'X',name:'BB 75000',instanceName:`BB 75000 ${id}`,seriesName:'BB 75000',category:'locomotive',traction:'diesel',length:20,maxSpeed:120,mass:90,tonnage:90,power:2000}],depotId:'',currentLocation:{}});

function depotReady(dm,eco,name='VSG'){
  const d=dm.add({type:'depot',name,stationId:name,tracks:4,cost:0,placementOnly:true,location:{lat:48.7,lon:2.4},infrastructure:['technicentre']},null);
  dm.buyResource(d.id,'diesel_l',30000,eco);
  return d;
}

test('HOTFIX52 all depot catalogue jobs are real StaffManager hire roles',()=>{
  for(const [id,def] of Object.entries(DEPOT_STAFF_CATALOG)){
    assert.ok(STAFF_ROLES[id],id);
    assert.equal(STAFF_ROLES[id].label,def.label);
    assert.equal(STAFF_ROLES[id].assignTo,'depot');
    assert.equal(STAFF_ROLES[id].depotRole,true);
    assert.ok(STAFF_ROLES[id].salary>0);
    assert.ok(STAFF_ROLES[id].hiringCost>0);
  }
});

test('HOTFIX52 hiring can directly attach depot specialists to their workplace',()=>{
  const sm=new StaffManager(),eco=economy();
  const hired=sm.hire(eco,'','specialiste_essieux',{count:2,nationality:'fr',generateEach:true,assignedTo:'DEP-1'});
  assert.equal(hired.length,2);
  assert.equal(hired.every(x=>x.assignedTo==='DEP-1'),true);
  assert.equal(sm.getDepotStaffAvailability('DEP-1','specialiste_essieux').free,2);
});

test('HOTFIX52 depot operation is blocked when required assigned staff is missing',()=>{
  const dm=new DepotManager(),sm=new StaffManager(),eco=economy(),d=depotReady(dm,eco),r=rame();
  dm.enterRame(d.id,r,[]);r.consumables.fuelL=0;
  const res=dm.startDepotOperation(d.id,r,'refuel',eco,sm);
  assert.equal(res.ok,false);
  assert.match(res.reason,/Personnel insuffisant/);
  assert.match(res.reason,/Agent d’avitaillement/);
});

test('HOTFIX52 starting an operation reserves assigned staff and completion releases them',()=>{
  const dm=new DepotManager(),sm=new StaffManager(),eco=economy(),d=depotReady(dm,eco),r=rame();
  dm.enterRame(d.id,r,[]);r.consumables.fuelL=0;
  const [agent]=sm.hire(eco,'Alice','agent_avitaillement',{count:1,assignedTo:d.id});
  const op=dm.startDepotOperation(d.id,r,'refuel',eco,sm);
  assert.equal(op.ok,true);
  assert.deepEqual(op.operation.staffIds,[agent.id]);
  assert.equal(agent.busyTaskId,op.operation.id);
  assert.equal(sm.getDepotStaffAvailability(d.id,'agent_avitaillement').free,0);
  dm.updateDepotOperations(999,null,sm);
  assert.equal(agent.busyTaskId,'');
  assert.equal(sm.getDepotStaffAvailability(d.id,'agent_avitaillement').free,1);
});

test('HOTFIX52 one free specialist cannot serve two simultaneous jobs',()=>{
  const dm=new DepotManager(),sm=new StaffManager(),eco=economy(),d=depotReady(dm,eco),r1=rame('A'),r2=rame('B');
  dm.enterRame(d.id,r1,[]);dm.enterRame(d.id,r2,[]);r1.consumables.fuelL=0;r2.consumables.fuelL=0;
  dm.buyEquipment(d.id,'fuel_station',eco); // second fuel slot; legacy technicentre already provided one
  sm.hire(eco,'Solo','agent_avitaillement',{count:1,assignedTo:d.id});
  assert.equal(dm.startDepotOperation(d.id,r1,'refuel',eco,sm).ok,true);
  const blocked=dm.startDepotOperation(d.id,r2,'refuel',eco,sm);
  assert.equal(blocked.ok,false);
  assert.match(blocked.reason,/Personnel insuffisant/);
});

test('HOTFIX52 multi-skill maintenance requires the full team',()=>{
  const dm=new DepotManager(),sm=new StaffManager(),eco=economy(),d=depotReady(dm,eco),r=rame('F');
  dm.enterRame(d.id,r,[]);
  dm.buyPart(d.id,'brake_pad_set',4,eco);dm.buyPart(d.id,'brake_disc',2,eco);dm.buyResource(d.id,'brake_cleaner_l',20,eco);
  sm.hire(eco,'','specialiste_freinage',{count:1,generateEach:true,assignedTo:d.id});
  sm.hire(eco,'','technicien_pneumatique',{count:1,generateEach:true,assignedTo:d.id});
  let res=dm.startDepotOperation(d.id,r,'brake_overhaul',eco,sm);
  assert.equal(res.ok,false);assert.match(res.reason,/Spécialiste freinage : 1\/2/);
  sm.hire(eco,'','specialiste_freinage',{count:1,generateEach:true,assignedTo:d.id});
  res=dm.startDepotOperation(d.id,r,'brake_overhaul',eco,sm);
  assert.equal(res.ok,true);assert.equal(res.operation.staffIds.length,3);
});

test('HOTFIX52 staff busy reservations persist and reconcile against depot operations',()=>{
  const sm=new StaffManager(),eco=economy();
  const [m]=sm.hire(eco,'Tech','agent_maintenance',{assignedTo:'D1'});
  m.busyTaskId='depot-op-77';m.busyTaskLabel='Visite';
  const save=sm.toSave(),loaded=new StaffManager();loaded.loadFromSave(save);
  assert.equal(loaded.staff[0].busyTaskId,'depot-op-77');
  loaded.reconcileDepotTaskReservations([]);assert.equal(loaded.staff[0].busyTaskId,'');
  loaded.staff[0].busyTaskId='';loaded.reconcileDepotTaskReservations([{id:'depot-op-88',depotId:'D1',label:'Essai',state:'running',staffIds:[loaded.staff[0].id]}]);
  assert.equal(loaded.staff[0].busyTaskId,'depot-op-88');
});


test('HOTFIX52 optional auto-assignment balances unassigned depot staff only when player clicks it',()=>{
  const sm=new StaffManager(),eco=economy();
  sm.hire(eco,'','agent_lavage',{count:3,generateEach:true});
  const depots=[{id:'D1',name:'A',type:'depot',built:true},{id:'D2',name:'B',type:'depot',built:true}];
  const n=sm.autoAssignDepotStaff(depots);assert.equal(n,3);
  assert.equal(sm.getDepotStaff('D1','agent_lavage').length,2);
  assert.equal(sm.getDepotStaff('D2','agent_lavage').length,1);
});
test('HOTFIX52 Personnel UI is searchable, grouped and exposes depot teams',()=>{
  const src=read('js/staff.js'),css=read('style.css');
  assert.match(src,/Catalogue des métiers/);
  assert.match(src,/Rechercher mécanicien, nettoyage, essieux/);
  assert.match(src,/Équipes des dépôts/);
  assert.match(src,/Auto-affecter aux dépôts/);
  assert.match(src,/Rechercher un agent, métier, dépôt, tâche/);
  assert.match(src,/staff-department-filter/);
  assert.match(src,/staff-status-filter/);
  assert.match(src,/Affectation initiale/);
  assert.match(src,/En opération dépôt/);
  assert.match(css,/\.staff-role-catalog/);
  assert.match(css,/\.staff-person-row/);
  assert.match(css,/\.staff-depot-summary-grid/);
});

test('HOTFIX52 depot UI reports real assigned/free/busy staff and operation shortage',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/getDepotStaffAvailability/);
  assert.match(ui,/PERSONNEL MANQUANT/);
  assert.match(ui,/Les opérations réservent réellement les agents affectés à ce dépôt/);
  assert.match(ui,/Ouvrir Personnel/);
  assert.match(ui,/personnelRequired===true\?this\.game\.staffManager:null/);
  assert.match(ui,/startDepotOperation\(depotId,r,opId,this\.game\.economy,staff\)/);
});

test('HOTFIX52 game tick releases depot staff and load reconciles reservations',()=>{
  const main=read('js/main.js');
  assert.match(main,/updateDepotOperations\?\.\(elapsedMinutes, this\.rameManager, this\.staffManager\)/);
  assert.match(main,/reconcileDepotTaskReservations\?\.\(this\.depotManager\.depotOperations/);
});

test('HOTFIX52 FILE bundle/cache contains the integrated personnel runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(bundle,/HOTFIX52-PERSONNEL-DEPOT-STAFF-INTEGRATION/);
  assert.match(bundle,/Personnel insuffisant/);
  assert.match(bundle,/Catalogue des métiers/);
  assert.match(bundle,/specialiste_essieux/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
