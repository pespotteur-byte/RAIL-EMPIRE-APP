import test from 'node:test';
import assert from 'node:assert/strict';
import { RotationV2Manager, FormationRole } from '../rotation-v2-model.js';

const scheduleManager={getVersion(){return null;}};

test('rotation load normalizes identities, prunes ghosts and migrates legacy direct schedules to real lines',()=>{
 const rm=new RotationV2Manager(scheduleManager);
 const save={schemaVersion:4,
  vehicles:[{id:12,number:'L12',powerW:1,massKg:1000}],
  coupons:[{id:22,name:'C',vehicleIds:[12,12]}],
  rotations:[{id:32,name:'R',occurrences:[{id:42,scheduleId:52,versionId:62,formation:{members:[{vehicleId:12,role:FormationRole.LEAD},{vehicleId:12,role:FormationRole.ACTIVE_MULTIPLE}]}}],actions:[{id:72,occurrenceId:999,locationOccurrenceId:'x',vehicleIds:[12,12]},{id:73,occurrenceId:42,locationOccurrenceId:'x',vehicleIds:[12]}]}],
  directAssignments:[{id:82,scheduleId:52,versionId:62,formation:{members:[{vehicleId:12,role:FormationRole.LEAD}]}},{id:83,scheduleId:52,versionId:63,formation:{members:[{vehicleId:12,role:FormationRole.LEAD}]}}],stationCodes:{}};
 assert.equal(rm.loadFromSave(save),true);
 assert.equal(rm.vehicles[0].id,'12');
 assert.deepEqual(rm.coupons[0].vehicleIds,['12']);
 assert.equal(rm.rotations[0].id,'32');
 assert.equal(rm.rotations[0].occurrences[0].id,'42');
 assert.equal(rm.rotations[0].occurrences[0].scheduleId,'52');
 assert.deepEqual(rm.rotations[0].occurrences[0].formation.members.map(x=>x.vehicleId),['12','12']);
 assert.equal(rm.rotations[0].occurrences[0].formation.calculate(rm).massKg,1000);
 assert.deepEqual(rm.rotations[0].actions.map(x=>x.id),['73']);
 assert.equal(rm.directAssignments.length,0);
 assert.ok(rm.rotations.some(r=>r.name.startsWith('Migré —')&&r.occurrences.some(o=>o.scheduleId==='52'))===false,'existing rotation already covers legacy schedule 52');
 assert.equal(rm.getRotation('32')?.id,'32');
 assert.equal(rm.getVehicle('12')?.number,'L12');
});

test('materializeRameElement refresh does not oscillate its individual number',()=>{
 const rm=new RotationV2Manager(scheduleManager);
 const rame={id:'rame1',serialNumber:'R1',name:'R1',elements:['cat'],elementDetails:[{elementId:'e1',name:'Voiture 1',instanceName:'61 87',mass:40,length:26,maxSpeed:160,power:0}],currentLocation:{stationId:'A'}};
 const first=rm.materializeRameElement(rame,0,null);
 const n1=first.number;
 const second=rm.materializeRameElement(rame,0,null);
 const n2=second.number;
 const third=rm.materializeRameElement(rame,0,null);
 assert.equal(n1,'61 87');assert.equal(n2,n1);assert.equal(third.number,n1);
});
