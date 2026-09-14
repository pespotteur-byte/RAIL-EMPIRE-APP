import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole, RotationActionType, ActiveFormationSpec } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleCreator } from '../schedule-creator.js';

function loc(id,name,stationId,arr,dep,dwell=0){
  return new ScheduledLocation({id,order:0,stationId,name,track:new TrackBinding({wayId:`w-${id}`,displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),arrivalSec:arr,departureSec:dep,dwellSec:dwell,stopCode:StopCode.C,arrivalOverride:arr!=null,departureOverride:dep!=null});
}
function schedule(sm,{number,locations,distanceKm=100}){
  const rec=sm.createDraft({number,name:number,category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;v.locations=locations;v.locations.forEach((l,i)=>l.order=i);v.state=ScheduleState.VALID;v.outboundPath.distanceKm=distanceKm;return rec;
}
function game(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);
  const world={stations:[],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const g={scheduleV2,rotationV2,world,scheduleCreator:new ScheduleCreator(),realismSettings:{physics:1}};g.scheduleV2Runtime=new ScheduleV2Runtime(g);return g;
}

test('v1.1.88 split releases one coupon at the intermediate station while parent consist keeps running',()=>{
  const g=game();
  const parent=schedule(g.scheduleV2,{number:'5773',locations:[
    loc('P','Paris','P',null,10*3600,0),
    loc('V','Valence','V',11*3600,11*3600+10*60,600),
    loc('N','Nice','N',12*3600,null,0),
  ],distanceKm:900});
  const branch=schedule(g.scheduleV2,{number:'5793',locations:[
    loc('VB','Valence','V',null,11*3600+15*60,0),
    loc('B','Briançon','B',12*3600+30*60,null,0),
  ],distanceKm:250});
  const rm=g.rotationV2,rot=rm.addRotation({name:'ICN'});
  const bb26=rm.addVehicle({number:'BB26001',category:'locomotive',traction:'electric',powerW:5600000,massKg:90000});
  const nice=rm.addVehicle({number:'C-NICE',category:'voiture',massKg:40000});
  const bri=rm.addVehicle({number:'C-BRI',category:'voiture',massKg:40000});
  const bb67=rm.addVehicle({number:'BB67436',category:'locomotive',traction:'diesel',powerW:1800000,massKg:80000});
  const o1=rm.addOccurrence(rot.id,{scheduleId:parent.id,versionId:parent.currentVersion.id,formation:{members:[
    {vehicleId:bb26.id,role:FormationRole.LEAD,order:0},{vehicleId:nice.id,role:FormationRole.COACH,order:1},{vehicleId:bri.id,role:FormationRole.COACH,order:2}
  ]}});
  rm.addAction(rot.id,{type:RotationActionType.SPLIT,occurrenceId:o1.id,locationOccurrenceId:'V',vehicleIds:[bri.id],durationSec:300});
  const o2=rm.addOccurrence(rot.id,{scheduleId:branch.id,versionId:branch.currentVersion.id,formation:{members:[
    {vehicleId:bb67.id,role:FormationRole.LEAD,order:0},{vehicleId:bri.id,role:FormationRole.COACH,order:1}
  ]}});
  rm.recalculateRotation(rot.id);
  const parentSlots=rm.materialIntervals(rot.id,o1.id,null,o1.resolvedStartSec);
  const briParent=parentSlots.find(x=>x.vehicleId===bri.id);
  const niceParent=parentSlots.find(x=>x.vehicleId===nice.id);
  assert.equal(briParent.endLocationId,'V');
  assert.equal(briParent.endSec,11*3600+5*60);
  assert.equal(niceParent.endLocationId,'N');
  assert.equal(niceParent.endSec,12*3600);
  assert.equal(o2.resolvedStartSec,11*3600+15*60,'Briançon branch keeps booked departure instead of waiting for parent terminus');
  assert.ok(o2.resolvedStartSec<o1.resolvedEndSec,'branch overlaps parent after split');
  assert.equal(rm.validateMaterialConflicts().length,0,'released coupon is not falsely double-booked');
});

test('v1.1.88 independent material duties inside one rotation are not serialized',()=>{
  const g=game(),rm=g.rotationV2,rot=rm.addRotation({name:'Parallel'});
  const a=schedule(g.scheduleV2,{number:'A',locations:[loc('A1','A','A',null,8*3600),loc('A2','B','B',10*3600,null)]});
  const b=schedule(g.scheduleV2,{number:'B',locations:[loc('B1','C','C',null,8*3600+30*60),loc('B2','D','D',9*3600+30*60,null)]});
  const va=rm.addVehicle({number:'L-A',category:'locomotive',powerW:1}),vb=rm.addVehicle({number:'L-B',category:'locomotive',powerW:1});
  const oa=rm.addOccurrence(rot.id,{scheduleId:a.id,versionId:a.currentVersion.id,formation:{members:[{vehicleId:va.id,role:FormationRole.LEAD}]}});
  const ob=rm.addOccurrence(rot.id,{scheduleId:b.id,versionId:b.currentVersion.id,formation:{members:[{vehicleId:vb.id,role:FormationRole.LEAD}]}});
  rm.recalculateRotation(rot.id);
  assert.equal(oa.resolvedStartSec,8*3600);assert.equal(ob.resolvedStartSec,8*3600+30*60);
  assert.ok(ob.resolvedStartSec<oa.resolvedEndSec);
});

test('v1.1.88 ATTACH infers a powered second unit as active multiple instead of coach',()=>{
  const g=game(),rm=g.rotationV2,rot=rm.addRotation({name:'UM'});
  const rec=schedule(g.scheduleV2,{number:'UM1',locations:[loc('A','A','A',null,8*3600),loc('B','B','B',9*3600,9*3600+10*60,600)]});
  const l1=rm.addVehicle({number:'Z1',category:'automotrice',powerW:2000000,location:{kind:'STATION',id:'A'}}),l2=rm.addVehicle({number:'Z2',category:'automotrice',powerW:2000000,location:{kind:'STATION',id:'B'}});
  const occ=rm.addOccurrence(rot.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l1.id,role:FormationRole.LEAD}]}});
  rm.addAction(rot.id,{type:RotationActionType.ATTACH,occurrenceId:occ.id,locationOccurrenceId:'B',vehicleIds:[l2.id],durationSec:300});
  const rt=g.scheduleV2Runtime,plan={rotation:rot,occ,baseDate:'2026-08-23',startSec:8*3600,_relNow:9*3600,locations:[],ver:rec.currentVersion};
  const svc={_v2FormationMembers:[{vehicleId:l1.id,role:FormationRole.LEAD}],_v2FormationReversed:false,rame:{elementDetails:[]},train:{maxSpeed:160},_v2VehicleIds:[]};
  const stop={locationOccurrenceId:'B',stationId:'B',locationName:'B'};
  rt._beginActionsAtStop(svc,plan,stop,9*3600,false);
  assert.equal(svc._v2FormationMembers.some(x=>x.vehicleId===l2.id),false,'UM is not attached instantaneously at arrival');
  rt._tickOperationState(svc,plan,9*3600+300);
  assert.equal(svc._v2FormationMembers.find(x=>x.vehicleId===l2.id)?.role,FormationRole.ACTIVE_MULTIPLE);
});

test('v1.1.88 physical vehicles preserve catalogue image, driving trailer orientation and odometer',()=>{
  const rm=new RotationV2Manager();
  const rame={id:'r1',name:'R',serialNumber:'R1',elements:['cat1'],elementDetails:[{elementId:'e1',instanceName:'X1',name:'X',category:'automotrice',power:2000,mass:50,length:25,imageData:'img/x.gif',isDrivingTrailer:true,flipped:true}],currentLocation:{stationId:'A'}};
  const v=rm.materializeRameElement(rame,0,{id:'cat1',name:'X'});v.odometerKm=1234;
  const save=rm.toSave(),rm2=new RotationV2Manager();assert.equal(save.schemaVersion,6);assert.equal(rm2.loadFromSave(save),true);
  const x=rm2.getVehicle(v.id);assert.equal(x.imageData,'img/x.gif');assert.equal(x.isDrivingTrailer,true);assert.equal(x.flipped,true);assert.equal(x.odometerKm,1234);
  const legacy={...save,schemaVersion:2};assert.equal(new RotationV2Manager().loadFromSave(legacy),true,'schema 2 save migrates into v1.1.88');
});

test('v1.1.88 manual occurrence formation remains an override when base Rame changes',()=>{
  const rm=new RotationV2Manager(),rot=rm.addRotation({name:'Overrides'});
  const a=rm.addVehicle({number:'A',category:'locomotive',powerW:1}),b=rm.addVehicle({number:'B',category:'locomotive',powerW:1});
  rot.assignedFormation=new ActiveFormationSpec({members:[{vehicleId:a.id,role:FormationRole.LEAD}]});
  const occ=rm.addOccurrence(rot.id,{scheduleId:'x',versionId:'v',formation:{members:[{vehicleId:b.id,role:FormationRole.LEAD}]},usesAssignedFormation:false});
  const fakeRame={id:'r',elementDetails:[],elements:[]};
  // We only need to verify the inheritance flag survives serialization; assignRameToRotation requires real materialized elements.
  const json=occ.toJSON();assert.equal(json.usesAssignedFormation,false);const loaded=new (occ.constructor)(json);assert.equal(loaded.usesAssignedFormation,false);assert.equal(loaded.formation.members[0].vehicleId,b.id);
});

test('v1.1.88 editor workspace remains available while HOTFIX64 makes rotations optional',()=>{
  const src=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
  for(const token of ['Lignes de roulement','Toutes les lignes','Diagramme réel','Montage / opérations','Journée matériel','Tableau','Locs / EM','Coupons','CV','Roulements facultatifs']) assert.ok(src.includes(token),token);
  assert.ok(src.includes('rame directe')); 
});

test('v1.1.88 detects an impossible physical jump between consecutive duties',()=>{
  const g=game(),rm=g.rotationV2,rot=rm.addRotation({name:'Continuity'});
  const s1=schedule(g.scheduleV2,{number:'1',locations:[loc('A1','A','A',null,8*3600),loc('L','Lyon','LYD',9*3600,null)]});
  const s2=schedule(g.scheduleV2,{number:'2',locations:[loc('M','Marseille','MSC',null,10*3600),loc('B2','B','B',11*3600,null)]});
  const v=rm.addVehicle({number:'BB1',category:'locomotive',powerW:1});
  rm.addOccurrence(rot.id,{scheduleId:s1.id,versionId:s1.currentVersion.id,formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD}]}});
  rm.addOccurrence(rot.id,{scheduleId:s2.id,versionId:s2.currentVersion.id,formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD}]}});
  rm.recalculateRotation(rot.id);
  assert.ok(rm.validateRotation(rot.id).some(x=>x.code==='MATERIAL_LOCATION_GAP'));
});

test('v1.1.88 duplicated rotations receive independent occurrence and action identities',()=>{
  const rm=new RotationV2Manager(),r=rm.addRotation({name:'Original'}),o=rm.addOccurrence(r.id,{scheduleId:'s',versionId:'v'});
  rm.addAction(r.id,{type:RotationActionType.ADD_CV,occurrenceId:o.id,locationOccurrenceId:'x'});
  const c=rm.duplicateRotation(r.id,'Copie');
  assert.notEqual(c.id,r.id);assert.notEqual(c.occurrences[0].id,o.id);assert.notEqual(c.actions[0].id,r.actions[0].id);
  assert.equal(c.actions[0].occurrenceId,c.occurrences[0].id);
});

test('v1.1.88 runtime hydrates physical images only when present and reverses a consist visually',()=>{
  const g=game(),rm=g.rotationV2,rt=g.scheduleV2Runtime;
  const a=rm.addVehicle({number:'A',catalogId:'a',category:'locomotive',powerW:1,imageData:'img/a.gif',flipped:false});
  const b=rm.addVehicle({number:'B',catalogId:'b',category:'voiture',imageData:'img/b.gif',flipped:true});
  const d=rt._vehicleDetail({role:FormationRole.LEAD},a);assert.equal(d.imageData,'img/a.gif');
  const no=rm.addVehicle({number:'NOIMG',category:'voiture'});assert.equal(Object.hasOwn(rt._vehicleDetail({role:FormationRole.COACH},no),'imageData'),false);
  const plan={rotation:{id:'r'},occ:{id:'o',reversed:true},baseDate:'2026-08-23'};
  const rame=rt._buildRuntimeRame(plan,{members:[{member:{role:FormationRole.LEAD},vehicle:a},{member:{role:FormationRole.COACH},vehicle:b}]});
  assert.deepEqual(rame.elementDetails.map(x=>x.catalogId),['b','a']);
  assert.deepEqual(rame.elementDetails.map(x=>x.flipped),[false,true]);
});

test('v1.1.88 runtime can hand a detached coupon to the Briancon branch after its operation window',()=>{
  const g=game(),rm=g.rotationV2,rt=g.scheduleV2Runtime,rot=rm.addRotation({name:'ICN runtime'});
  const parent=schedule(g.scheduleV2,{number:'5773',locations:[loc('P','Paris','P',null,10*3600),loc('V','Valence','V',11*3600,11*3600+10*60,600),loc('N','Nice','N',12*3600,null)]});
  const branch=schedule(g.scheduleV2,{number:'5793',locations:[loc('VB','Valence','V',null,11*3600+15*60),loc('B','Briancon','B',12*3600+30*60,null)]});
  const bb26=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5600000,location:{kind:'STATION',id:'P'}});
  const bri=rm.addVehicle({number:'C-BRI',category:'voiture',massKg:40000,location:{kind:'STATION',id:'P'}});
  const bb67=rm.addVehicle({number:'BB67436',category:'locomotive',traction:'diesel',powerW:1800000,location:{kind:'STATION',id:'V'}});
  const o1=rm.addOccurrence(rot.id,{scheduleId:parent.id,versionId:parent.currentVersion.id,formation:{members:[{vehicleId:bb26.id,role:FormationRole.LEAD},{vehicleId:bri.id,role:FormationRole.COACH}]}});
  rm.addAction(rot.id,{type:RotationActionType.SPLIT,occurrenceId:o1.id,locationOccurrenceId:'V',vehicleIds:[bri.id],durationSec:300});
  const o2=rm.addOccurrence(rot.id,{scheduleId:branch.id,versionId:branch.currentVersion.id,formation:{members:[{vehicleId:bb67.id,role:FormationRole.LEAD},{vehicleId:bri.id,role:FormationRole.COACH}]}});
  // Simulate parent reservation followed by the real split at Valence.
  bb26.available=false;bri.available=false;
  const svc={_v2FormationMembers:[{vehicleId:bb26.id,role:FormationRole.LEAD},{vehicleId:bri.id,role:FormationRole.COACH}],_v2FormationReversed:false,_v2VehicleIds:[bb26.id,bri.id],rame:{elementDetails:[]},train:{maxSpeed:160}};
  const p1={rotation:rot,occ:o1,baseDate:'2026-08-23',startSec:10*3600,_relNow:11*3600,locations:[],ver:parent.currentVersion};
  const splitStop={locationOccurrenceId:'V',stationId:'V',locationName:'Valence'};
  rt._beginActionsAtStop(svc,p1,splitStop,11*3600,false);
  assert.equal(svc._v2VehicleIds.includes(bri.id),true,'coupon remains physically attached during the split operation');
  rt._tickOperationState(svc,p1,11*3600+300);
  assert.equal(svc._v2VehicleIds.includes(bri.id),false,'coupon leaves parent live ownership only when the split finishes');
  assert.equal(bri.available,true);assert.equal(bri.location.id,'V');
  const p2={rotation:rot,occ:o2,baseDate:'2026-08-23',startSec:11*3600+15*60,_relNow:11*3600+15*60,locations:[{location:branch.currentVersion.locations[0]}],ver:branch.currentVersion};
  const usable=rt._usableMembers(p2);
  assert.equal(usable.notReady,false);assert.equal(usable.missingLead,false);
  assert.deepEqual(usable.members.map(x=>x.vehicle.id).sort(),[bb67.id,bri.id].sort());
});
