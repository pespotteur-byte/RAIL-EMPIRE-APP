import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RameManager } from '../rame.js';
import { RotationV2Manager } from '../rotation-v2-model.js';

function makeRame(){
  const rm=new RameManager();
  return rm.add({id:'rame-edit',name:'Test',elements:['loco','a','b'],elementDetails:[
    {name:'Loco',instanceName:'L1',category:'locomotive',traction:'diesel',power:2000,mass:80,tonnage:80,maxSpeed:120,length:18,purchasePrice:100},
    {name:'A',instanceName:'A1',category:'voiture',mass:40,tonnage:40,maxSpeed:120,length:25,purchasePrice:10},
    {name:'B',instanceName:'B1',category:'voiture',mass:40,tonnage:40,maxSpeed:120,length:25,purchasePrice:10},
  ]});
}

const catalog={
  loco:{id:'loco',name:'Loco',category:'locomotive',traction:'diesel',power:2000,mass:80,maxSpeed:120,length:18},
  a:{id:'a',name:'A',category:'voiture',mass:40,maxSpeed:120,length:25},
  b:{id:'b',name:'B',category:'voiture',mass:40,maxSpeed:120,length:25},
};

test('v1.1.52 gives every Rame element a stable persisted identity',()=>{
  const rm=new RameManager();const rame=makeRame();
  assert.equal(rame.elementDetails.length,3);
  assert.equal(new Set(rame.elementDetails.map(e=>e.elementId)).size,3);
  const save=new RameManager();save.loadFromSave([new RameManager().add({id:'r',elements:['x'],elementDetails:[{name:'x',elementId:'stable-x'}]}).constructor ? {id:'r',elements:['x'],elementDetails:[{name:'x',elementId:'stable-x'}]} : {}]);
  assert.equal(save.getById('r').elementDetails[0].elementId,'stable-x');
});

test('v1.1.52 reordering a Rame keeps physical vehicles and rotation formation attached to the same actual elements',()=>{
  const rame=makeRame();
  const old={elements:[...rame.elements],elementDetails:rame.elementDetails.map(e=>({...e}))};
  const mgr=new RotationV2Manager();
  for(let i=0;i<3;i++)mgr.materializeRameElement(rame,i,catalog[rame.elements[i]]);
  mgr.materializeRameCoupon(rame,[1,2],'Voitures',id=>catalog[id]);
  const rot=mgr.addRotation({name:'R'});mgr.assignRameToRotation(rot.id,rame);
  const oldVehicleByElement=new Map(rame.elementDetails.map((d,i)=>[d.elementId,mgr.getRameElementVehicle(rame.id,i).id]));
  // B, loco, A
  rame.elements=[old.elements[2],old.elements[0],old.elements[1]];
  rame.elementDetails=[old.elementDetails[2],old.elementDetails[0],old.elementDetails[1]];
  const result=mgr.syncRameAfterEdit(rame,old);
  assert.equal(result.linked,3);assert.equal(result.detached,0);assert.equal(result.rotationsUpdated,1);
  assert.deepEqual(mgr.getRameVehicles(rame.id).map(v=>v.id),rame.elementDetails.map(d=>oldVehicleByElement.get(d.elementId)));
  assert.deepEqual(rot.assignedFormation.members.map(m=>m.vehicleId),rame.elementDetails.map(d=>oldVehicleByElement.get(d.elementId)));
  const coupon=mgr.coupons[0];assert.deepEqual(coupon.sourceRameElementIndexes,[0,2]);
  assert.deepEqual(coupon.sourceRameElementIds,[rame.elementDetails[0].elementId,rame.elementDetails[2].elementId]);
});

test('v1.1.52 adding an unmaterialized element blocks stale Rame-assigned formations until material is created',()=>{
  const rame=makeRame();const old={elements:[...rame.elements],elementDetails:rame.elementDetails.map(e=>({...e}))};
  const mgr=new RotationV2Manager();for(let i=0;i<3;i++)mgr.materializeRameElement(rame,i,catalog[rame.elements[i]]);
  mgr.materializeRameCoupon(rame,[1,2],'Voitures',id=>catalog[id]);const rot=mgr.addRotation({name:'R'});mgr.assignRameToRotation(rot.id,rame);
  rame.elements.push('a');rame.elementDetails.push({...old.elementDetails[1],elementId:'new-car',instanceName:'A2'});
  const result=mgr.syncRameAfterEdit(rame,old);
  assert.equal(result.rotationsBlocked,1);assert.equal(rot.assignedRameId,rame.id);assert.equal(rot.assignedFormation.members.length,0);
});

test('v1.1.52 Rames UI exposes post-creation editing and left/right reorder controls',()=>{
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  assert.match(ui,/openRameEditor/);assert.match(ui,/moveRameElement/);assert.match(ui,/✎ Éditer/);
  assert.match(ui,/Déplacer vers la gauche/);assert.match(ui,/Déplacer vers la droite/);
  assert.match(ui,/_editingOriginalElementIds/);assert.match(ui,/syncRameAfterEdit/);
  assert.match(html,/rame-modal-title/);assert.match(html,/rame-edit-hint/);assert.match(css,/rame-move-btn/);
  assert.match(bundle,/openRameEditor/);assert.match(bundle,/syncRameAfterEdit/);assert.match(bundle,/Déplacer vers la gauche/);
});
