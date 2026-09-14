import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaffManager, normalizeMaterialFamily, materialFamilyFromItem, MATERIAL_AUTHORIZATION_RULES } from '../staff.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const economy=(balance=1_000_000)=>({balance,expenses:[],addExpense(amount,cat,label){this.balance-=Number(amount)||0;this.expenses.push({amount:Number(amount)||0,cat,label});}});
const svc=(id,families)=>({id,active:true,completed:false,cancelled:false,state:'waiting',stops:[{departureTime:60}],currentStopIndex:0,rame:{elementDetails:families.map((f,i)=>({category:'locomotive',power:2000,realIdentitySeries:f,name:`${f} ${i+1}`}))}});

test('HOTFIX54 canonical family collapses variants to one licence family',()=>{
  assert.equal(normalizeMaterialFamily('BB 27000'),'BB27000');
  assert.equal(materialFamilyFromItem({realIdentitySeries:'BB 27000',name:'BB 27143'}),'BB27000');
  assert.equal(materialFamilyFromItem({realIdentitySeries:'DB Class 185',name:'BR 185 001'}),'BR185');
  assert.equal(materialFamilyFromItem({seriesName:'AGC — BiBi',name:'B 82500'}),'AGC');
});

test('HOTFIX54 authorization training is paid, completes, persists and expires by date',()=>{
  const sm=new StaffManager(),eco=economy();
  const [d]=sm.hire(eco,'Alice','conducteur',{count:1}); d.assignedTo=null; d.resting=false; d.onLeave=false; d.absenceRemainingDays=0; d.trainingRemainingDays=0;
  const before=eco.balance;
  const r=sm.startMaterialAuthorization(d.id,'BB 27000',eco,'2026-09-02');
  assert.equal(r.ok,true); assert.equal(before-eco.balance,MATERIAL_AUTHORIZATION_RULES.trainingCost);
  for(const date of ['2026-09-03','2026-09-04']) sm.processDailyHR({},date,{random:()=>1});
  assert.equal(sm.hasMaterialAuthorization(d,'BB27000','2026-09-04'),true);
  const auth=sm.getMaterialAuthorizations(d,'2026-09-04').find(a=>a.family==='BB27000');
  assert.ok(auth?.validUntil>'2026-09-04');
  const saved=sm.toSave(), loaded=new StaffManager(); loaded.loadFromSave(saved);
  const copy=loaded.staff.find(x=>x.id===d.id);
  assert.equal(loaded.hasMaterialAuthorization(copy,'BB27000','2026-09-04'),true);
  assert.equal(loaded.hasMaterialAuthorization(copy,'BB27000','2099-01-01'),false);
});

test('HOTFIX54 driver needs every powered family in a mixed formation',()=>{
  const sm=new StaffManager(),eco=economy(); const [d]=sm.hire(eco,'Bob','conducteur',{count:1}); d.assignedTo=null;
  d.materialAuthorizations=[{family:'BB27000',obtainedDate:'2026-01-01',validUntil:'2028-01-01'}];
  const s=svc('S1',['BB 27000','BB 37000']);
  let c=sm.canConductorDriveService(d,s,'2026-09-02');
  assert.equal(c.ok,false); assert.deepEqual(c.missing,['BB37000']);
  d.materialAuthorizations.push({family:'BB37000',obtainedDate:'2026-01-01',validUntil:'2028-01-01'});
  c=sm.canConductorDriveService(d,s,'2026-09-02'); assert.equal(c.ok,true);
});

test('HOTFIX54 auto assignment skips an unqualified driver and uses a qualified one',()=>{
  const sm=new StaffManager(),eco=economy();
  const [bad]=sm.hire(eco,'Bad','conducteur',{count:1}); const [good]=sm.hire(eco,'Good','conducteur',{count:1});
  for(const d of [bad,good]){d.assignedTo=null;d.shiftGroup=0;d.weeklyRestDay=6;d.onDuty=true;d.resting=false;}
  good.materialAuthorizations=[{family:'BB27000',obtainedDate:'2026-01-01',validUntil:'2028-01-01'}];
  const s=svc('S1',['BB 27000']);
  sm.tickConductors([s],60,'2026-09-02',{});
  assert.equal(bad.assignedTo,null); assert.equal(good.assignedTo,'S1');
});

test('HOTFIX54 missing-driver reason names the required family',()=>{
  const sm=new StaffManager(),eco=economy(); const [d]=sm.hire(eco,'NoAuth','conducteur',{count:1}); d.assignedTo=null;
  const reason=sm.getMissingConductorReason(svc('S1',['BB 27000']),'2026-09-02',{});
  assert.match(reason,/aucun conducteur habilité BB27000/);
});

test('HOTFIX54 legacy save migration grants only already-owned powered families once',()=>{
  const sm=new StaffManager(),eco=economy(); const [d]=sm.hire(eco,'Legacy','conducteur',{count:1}); d.materialAuthorizations=[];
  const legacy=sm.toSave(); delete legacy.materialAuthorizationSchemaVersion;
  const loaded=new StaffManager(); loaded.loadFromSave(legacy);
  const game={
    rameManager:{getAll:()=>[{elementDetails:[
      {catalogId:'bb27',category:'locomotive'},
      {catalogId:'coach',category:'voiture'}
    ]}]},
    rotationV2:{vehicles:[{catalogId:'bb37',category:'locomotive'}]},
    rollingStock:{getById:(id)=>({
      bb27:{id:'bb27',category:'locomotive',realIdentitySeries:'BB 27000',name:'BB 27143'},
      bb37:{id:'bb37',category:'locomotive',realIdentitySeries:'BB 37000',name:'BB 37012'},
      coach:{id:'coach',category:'voiture',seriesName:'Corail'}
    }[id]||null)}
  };
  const r=loaded.migrateLegacyMaterialAuthorizations(game,'2026-09-02');
  assert.equal(r.migrated,true); assert.equal(r.families,2); assert.equal(r.grants,2);
  const copy=loaded.staff.find(x=>x.id===d.id);
  assert.equal(loaded.hasMaterialAuthorization(copy,'BB27000','2026-09-02'),true);
  assert.equal(loaded.hasMaterialAuthorization(copy,'BB37000','2026-09-02'),true);
  assert.equal(loaded.migrateLegacyMaterialAuthorizations(game,'2026-09-02').migrated,false);
  const savedAgain=loaded.toSave(); assert.equal(savedAgain.materialAuthorizationSchemaVersion,1);
});

test('HOTFIX54 UI exposes searchable family authorizations and bundle hooks',()=>{
  const staff=read('js/staff.js'), css=read('style.css'), main=read('js/main.js'), sc=read('js/schedule-creator.js');
  assert.match(staff,/Habilitations matériel/); assert.match(staff,/staff-auth-search/); assert.match(staff,/BB27000/); assert.match(staff,/startMaterialAuthorization/);
  assert.match(staff,/canConductorDriveService/); assert.match(css,/staff-auth-grid/);
  assert.match(main,/tickConductors\(activeSchedules, timeOfDay, dateStr, this\)/);
  assert.match(sc,/aucun conducteur habilité|getMissingConductorReason/);
});

test('HOTFIX54 FILE bundle/cache exposes material family runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js'),index=read('index.html');
  assert.match(bundle,/HOTFIX54-MATERIAL-FAMILY-AUTHORIZATIONS/);
  assert.match(bundle,/startMaterialAuthorization/);
  assert.match(bundle,/canConductorDriveService/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(index,/style\.css\?v=1199re3d14/);
});
