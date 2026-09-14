import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';

function sampleRame(){
  return {
    id:'rame-demo',name:'Corail test',serialNumber:'R-42',elements:['cat-loco','cat-coach-a','cat-coach-b'],
    currentLocation:{depotId:'DEP',stationId:'',lat:48.1,lon:2.2},
    elementDetails:[
      {name:'BB 22200',instanceName:'BB 22201',category:'locomotive',traction:'electric',maxSpeed:160,mass:90,power:5600,length:17.5},
      {name:'Corail B11',instanceName:'B11-001',category:'voiture',traction:'none',maxSpeed:160,mass:42,power:0,length:26.4},
      {name:'Corail B11',instanceName:'B11-002',category:'voiture',traction:'none',maxSpeed:160,mass:42,power:0,length:26.4},
    ],
  };
}

const catalog={
  'cat-loco':{id:'cat-loco',name:'BB 22200',category:'locomotive',traction:'electric',maxSpeed:160,mass:90,power:5600,length:17.5,electricSystems:[{voltage:25000,frequency:50}],gauges:[1435]},
  'cat-coach-a':{id:'cat-coach-a',name:'Corail B11',category:'voiture',maxSpeed:160,mass:42,length:26.4,gauges:[1435]},
  'cat-coach-b':{id:'cat-coach-b',name:'Corail B11',category:'voiture',maxSpeed:160,mass:42,length:26.4,gauges:[1435]},
};

test('v1.1.51 materializes exact physical vehicles from a Rames-page consist without duplicates',()=>{
  const mgr=new RotationV2Manager();const rame=sampleRame();
  const loco=mgr.materializeRameElement(rame,0,catalog['cat-loco']);
  assert.equal(loco.sourceRameId,rame.id);assert.equal(loco.sourceRameElementIndex,0);assert.equal(loco.number,'BB 22201');assert.equal(loco.powerW,5_600_000);assert.deepEqual(loco.gauges,[1435]);
  assert.equal(mgr.materializeRameElement(rame,0,catalog['cat-loco']).id,loco.id);assert.equal(mgr.vehicles.length,1);
  const coupon=mgr.materializeRameCoupon(rame,[1,2],'Coupon Corail',id=>catalog[id]);
  assert.equal(coupon.sourceRameId,rame.id);assert.deepEqual(coupon.sourceRameElementIndexes,[1,2]);assert.equal(coupon.vehicleIds.length,2);assert.equal(mgr.vehicles.length,3);
  assert.deepEqual(mgr.getRameVehicles(rame.id).map(v=>v.sourceRameElementIndex),[0,1,2]);
});

test('v1.1.51 legacy physical vehicles with no Rame element link stay unlinked',()=>{
  const mgr=new RotationV2Manager();const v=mgr.addVehicle({number:'OLD',sourceRameId:'rame-demo',sourceRameElementIndex:null});assert.equal(v.sourceRameElementIndex,null);assert.equal(mgr.getRameElementVehicle('rame-demo',0),null);
});

test('v1.1.51 assigning a Rame to a rotation becomes the base formation and future occurrences inherit it',()=>{
  const mgr=new RotationV2Manager();const rame=sampleRame();
  for(let i=0;i<3;i++)mgr.materializeRameElement(rame,i,catalog[rame.elements[i]]);
  mgr.materializeRameCoupon(rame,[1,2],'Coupon Corail',id=>catalog[id]);
  const rot=mgr.addRotation({name:'Dijon Lyon'});mgr.assignRameToRotation(rot.id,rame);
  assert.equal(rot.assignedRameId,rame.id);assert.equal(rot.assignedFormation.members.length,3);
  assert.deepEqual(rot.assignedFormation.members.map(m=>m.role),[FormationRole.LEAD,FormationRole.COACH,FormationRole.COACH]);
  const occ=mgr.addOccurrence(rot.id,{scheduleId:'17801',versionId:'v1'});
  assert.equal(occ.formation.members.length,3);assert.deepEqual(occ.formation.members.map(m=>m.vehicleId),rot.assignedFormation.members.map(m=>m.vehicleId));
  assert.ok(occ.formation.members.slice(1).every(m=>m.sourceCouponId));
});

test('v1.1.51 Rame material links and rotation assignment survive save/load',()=>{
  const mgr=new RotationV2Manager();const rame=sampleRame();for(let i=0;i<3;i++)mgr.materializeRameElement(rame,i,catalog[rame.elements[i]]);mgr.materializeRameCoupon(rame,[1,2],'Coupon Corail',id=>catalog[id]);const rot=mgr.addRotation({name:'Persist'});mgr.assignRameToRotation(rot.id,rame);
  const saved=mgr.toSave(),loaded=new RotationV2Manager();assert.equal(loaded.loadFromSave(saved),true);
  assert.equal(loaded.getRameElementVehicle(rame.id,0)?.number,'BB 22201');assert.deepEqual(loaded.coupons[0].sourceRameElementIndexes,[1,2]);assert.equal(loaded.rotations[0].assignedRameId,rame.id);assert.equal(loaded.rotations[0].assignedFormation.members.length,3);
});

test('v1.1.51 Rotation UI and FILE bundle expose visual Rame-to-material and global Rame assignment workflows',()=>{
  const source=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  for(const text of [source,bundle]){assert.match(text,/Rame → matériel/);assert.match(text,/Affecter une rame/);assert.match(text,/Créer le coupon sélectionné/);assert.match(text,/assignRameToRotation/);assert.match(text,/materializeRameCoupon/);assert.match(text,/rv2-rame-strip/);}
  assert.match(source,/data-rame-el/);
});


test('v1.1.51 blocks a rotation bound to a Rames-page consist while that Rame is in maintenance',()=>{
  const mgr=new RotationV2Manager();const rame=sampleRame();
  const rot=mgr.addRotation({name:'Maintenance test',assignedRameId:rame.id});
  rame.inMaintenance=true;
  const game={rotationV2:mgr,rameManager:{getById:id=>id===rame.id?rame:null},scheduleV2:{calendars:[]}};
  const runtime=new ScheduleV2Runtime(game);
  assert.deepEqual(runtime._runtimeRotations(),[]);
  assert.ok(runtime.alerts.some(a=>a.code==='ROTATION_RAME_MAINTENANCE'&&a.rotationId===rot.id));
});

test('HOTFIX32 detects whole-Rame double booking between two genuine rotation lines',()=>{
  const versions={
    'r1-v':{id:'r1-v',state:'VALID',firstDepartureSec:100,lastArrivalSec:300,locations:[{id:'A'}],outboundPath:{routePoints:[],legs:[]}},
    'r2-v':{id:'r2-v',state:'VALID',firstDepartureSec:150,lastArrivalSec:250,locations:[{id:'A'}],outboundPath:{routePoints:[],legs:[]}},
  };
  const scheduleManager={getVersion:(scheduleId,versionId)=>versions[versionId]||null};
  const mgr=new RotationV2Manager(scheduleManager);const rame=sampleRame();
  for(let i=0;i<3;i++)mgr.materializeRameElement(rame,i,catalog[rame.elements[i]]);
  mgr.materializeRameCoupon(rame,[1,2],'Coupon Corail',id=>catalog[id]);
  const r1=mgr.addRotation({name:'R01'});mgr.assignRameToRotation(r1.id,rame);mgr.addOccurrence(r1.id,{scheduleId:'s1',versionId:'r1-v'});
  const r2=mgr.addRotation({name:'R02'});mgr.assignRameToRotation(r2.id,rame);mgr.addOccurrence(r2.id,{scheduleId:'s2',versionId:'r2-v'});
  const conflicts=mgr.validateMaterialConflicts();
  assert.ok(conflicts.some(c=>(c.code==='RAME_DOUBLE_BOOKED'&&c.rameId===rame.id)||c.code==='VEHICLE_DOUBLE_BOOKED'));
});
