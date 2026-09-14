import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole, RotationActionType } from '../rotation-v2-model.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { RotationV2Editor } from '../rotation-v2-editor.js';

function loc(id,name,stationId,dep,arr=null){return new ScheduledLocation({id,stationId,name,track:new TrackBinding({wayId:`w-${id}`,displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),arrivalSec:arr,departureSec:dep,dwellSec:0,stopCode:StopCode.C,arrivalOverride:arr!=null,departureOverride:dep!=null});}
function sched(sm,number,start=8*3600,end=9*3600,from='DN',to='LYD'){
 const r=sm.createDraft({number,name:number,category:TrainCategory.PASSENGER,maxSpeed:160}),v=r.currentVersion;
 v.locations=[loc(`${number}-a`,from,from,start),loc(`${number}-b`,to,to,null,end)];v.locations.forEach((x,i)=>x.order=i);v.state=ScheduleState.VALID;v.outboundPath.distanceKm=195;v.outboundPath.routePoints=[{lat:48,lon:2},{lat:48.1,lon:2.1}];v.outboundPath.legs=[{fromLocationId:v.locations[0].id,toLocationId:v.locations[1].id,distanceKm:195,routePoints:v.outboundPath.routePoints,segments:[]}];return r;
}
function game(){const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2),scheduleCreator={services:[],_invalidateActiveCache(){}};const g={scheduleV2,rotationV2,scheduleCreator,realismSettings:{physics:1},world:{getStationById(){return null;}},_currentDate:'2026-08-31',rameManager:{getAll(){return[];},getById(){return null;}},engine:{getParisTime(){return{hours:8,minutes:0,seconds:0}},getParisDate(){return'2026-08-31'}},saveState(){}};g.scheduleV2Runtime=new ScheduleV2Runtime(g);return g;}
function editor(g,r){const e=Object.create(RotationV2Editor.prototype);Object.assign(e,{game:g,ui:{},selectedRotationId:r?.id||'',selectedOccurrenceId:'',selectedMaterialId:'',activeView:'sheet',libraryTab:'schedules',searchQuery:'',selectedDate:'2026-08-31',materialSort:'number',_history:[],_future:[],_syncRuntimeNow(){},render(){}});return e;}

test('HOTFIX64 timetable with direct formation is a runtime train in simplified mode and rotation takes priority',()=>{
 const g=game(),rec=sched(g.scheduleV2,'17801');const loco=g.rotationV2.addVehicle({number:'BB22201',category:'locomotive',traction:'diesel',powerW:4000000,massKg:90000,lengthM:18,maxSpeed:160});
 g.rotationV2.setDirectAssignment(rec.id,rec.currentVersion.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]});
 assert.equal(g.scheduleV2Runtime._runtimeRotations().length,1,'simplified direct assignment is compiled as a runtime duty');assert.match(g.scheduleV2Runtime._runtimeRotations()[0].id,/^direct:/);
 const r=g.rotationV2.addRotation({name:'Dijon Lyon 01'});g.rotationV2.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id});g.rotationV2.setAssignedFormation(r.id,{members:[{vehicleId:loco.id,role:FormationRole.LEAD}]});
 assert.equal(g.scheduleV2Runtime._runtimeRotations().length,1);assert.equal(g.scheduleV2Runtime._runtimeRotations()[0].id,r.id,'real rotation suppresses direct wrapper');assert.equal(g.rotationV2.scheduleCoveredByRotation(rec.id,rec.currentVersion.id),true);
});

test('HOTFIX32 line formation is inherited while explicit service exceptions survive',()=>{
 const g=game(),rm=g.rotationV2,a=sched(g.scheduleV2,'17801'),b=sched(g.scheduleV2,'17806',10*3600,12*3600,'LYD','DN'),r=rm.addRotation({name:'R01'}),l1=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:1}),l2=rm.addVehicle({number:'BB22235',category:'locomotive',powerW:1}),coach=rm.addVehicle({number:'B11',category:'voiture'}),c=rm.addCoupon({name:'Coupon 301',vehicleIds:[coach.id]});
 const o1=rm.addOccurrence(r.id,{scheduleId:a.id,versionId:a.currentVersion.id}),o2=rm.addOccurrence(r.id,{scheduleId:b.id,versionId:b.currentVersion.id});
 rm.setAssignedFormation(r.id,{members:[{vehicleId:l1.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH,sourceCouponId:c.id}]});assert.equal(o1.formation.members[0].vehicleId,l1.id);assert.equal(o2.formation.members[1].sourceCouponId,c.id);
 o2.usesAssignedFormation=false;o2.formation.members=[{vehicleId:l2.id,role:FormationRole.LEAD,order:0}];rm.setAssignedFormation(r.id,{members:[{vehicleId:l1.id,role:FormationRole.LEAD}]});assert.equal(o2.formation.members[0].vehicleId,l2.id,'exception preserved');rm.setAssignedFormation(r.id,r.assignedFormation,{applyAll:true});assert.equal(o2.formation.members[0].vehicleId,l1.id,'force applies base to all');
});

test('HOTFIX32 CV contributes mass but not traction',()=>{
 const g=game(),rm=g.rotationV2,lead=rm.addVehicle({number:'BB1',category:'locomotive',powerW:3000000,massKg:80000}),cv=rm.addVehicle({number:'BB2',category:'locomotive',powerW:3000000,massKg:80000}),r=rm.addRotation({name:'CV'});rm.setAssignedFormation(r.id,{members:[{vehicleId:lead.id,role:FormationRole.LEAD},{vehicleId:cv.id,role:FormationRole.VEHICLE}]});const calc=r.assignedFormation.calculate(rm);assert.equal(calc.massKg,160000);assert.equal(calc.powerW,3000000);assert.deepEqual(calc.activeVehicleIds,[lead.id]);
});

test('HOTFIX32 split coupon remains a physical operation usable by another line',()=>{
 const g=game(),rm=g.rotationV2,rec=sched(g.scheduleV2,'5773'),r=rm.addRotation({name:'Paris Valence Nice'}),l=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:1}),n=rm.addVehicle({number:'NICE',category:'voiture'}),b=rm.addVehicle({number:'BRI',category:'voiture'}),c=rm.addCoupon({name:'Coupon Briançon',vehicleIds:[b.id]}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD},{vehicleId:n.id,role:FormationRole.COACH},{vehicleId:b.id,role:FormationRole.COACH,sourceCouponId:c.id}]}});rm.addAction(r.id,{type:RotationActionType.SPLIT,occurrenceId:o.id,locationOccurrenceId:rec.currentVersion.locations[1].id,vehicleIds:[b.id],couponIds:[c.id],durationSec:300});const iv=rm.materialIntervals(r.id,o.id).find(x=>x.vehicleId===b.id);assert.ok(iv);assert.equal(iv.reason,RotationActionType.SPLIT);
});

test('HOTFIX32 all-lines view shows simultaneous duties and player diagram vocabulary',()=>{
 const g=game(),rm=g.rotationV2,a=sched(g.scheduleV2,'17801',7*3600+40*60,9*3600+52*60),b=sched(g.scheduleV2,'17803',8*3600+40*60,10*3600+52*60),l1=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:1}),l2=rm.addVehicle({number:'BB22235',category:'locomotive',powerW:1}),r1=rm.addRotation({name:'Ligne 01'}),r2=rm.addRotation({name:'Ligne 02'});rm.addOccurrence(r1.id,{scheduleId:a.id,versionId:a.currentVersion.id,formation:{members:[{vehicleId:l1.id,role:FormationRole.LEAD}]}});rm.addOccurrence(r2.id,{scheduleId:b.id,versionId:b.currentVersion.id,formation:{members:[{vehicleId:l2.id,role:FormationRole.LEAD}]}});rm.recalculateRotation(r1.id);rm.recalculateRotation(r2.id);const e=editor(g,r1),html=e._renderAllLines();for(const x of ['Toutes les lignes','17801','17803','Ligne 01','Ligne 02'])assert.ok(html.includes(x),x);
});

test('HOTFIX64 source contract keeps advanced rolling duties while beginner mode is optional',()=>{
 const ed=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8'),sc=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8'),rt=fs.readFileSync(new URL('../schedule-v2-runtime.js',import.meta.url),'utf8'),tutorial=fs.readFileSync(new URL('../tutorial.js',import.meta.url),'utf8');
 for(const token of ['Lignes de roulement','Toutes les lignes','Diagramme réel','Formation affectée à la ligne','Locs / EM','Coupons','Journée matériel','Former une UM','Séparer l’UM','CV'])assert.ok(ed.includes(token)||sc.includes(token),token);
 for(const token of ['Mode simple — affecter une rame','PRÊT · MODE SIMPLE','RAME À AFFECTER'])assert.ok(sc.includes(token),token);
 assert.ok(rt.includes('directAssignments'));assert.ok(rt.includes('rotationsRequired'));
 assert.ok(tutorial.includes('Les <b>Roulements sont facultatifs</b>'));
 assert.ok(tutorial.includes('Personnel est facultatif'));
});

test('HOTFIX32 material day uses the same real white-grey diagram vocabulary requested by the player',()=>{
 const g=game(),rm=g.rotationV2,rec=sched(g.scheduleV2,'17803',7*3600+40*60,9*3600+52*60),r=rm.addRotation({name:'R01'});
 const loco=rm.addVehicle({number:'BB22201',name:'BB 22200',category:'locomotive',powerW:4000000,massKg:90000,odometerKm:1200});
 const pilot=rm.addVehicle({number:'B5uxh',name:'Voiture-pilote',category:'voiture',isDrivingTrailer:true,massKg:42000});
 const o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0},{vehicleId:pilot.id,role:FormationRole.COACH,order:1}]}});rm.recalculateRotation(r.id);
 const e=editor(g,r);e.selectedMaterialId=`vehicle:${loco.id}`;e.activeView='material';
 let html=e._renderMaterialView(r);
 for(const token of ['rv4-material-sheet','Même schéma graphique que le roulement','17803','BB22201','DN','LYD','km ce jour','rv3-real-leadline loco'])assert.ok(html.includes(token),token);
 o.reversed=true;rm.recalculateRotation(r.id);html=e._renderMaterialView(r);assert.ok(html.includes('rv3-real-leadline pilot'),'réversibilité en tête = trait fin');
 const src=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
 assert.ok(src.includes('.rv4-material-track .rv3-real-leadline.loco{height:5px}'));
 assert.ok(src.includes('.rv4-material-track .rv3-real-leadline.pilot{height:2px}'));
});

test('HOTFIX32 one line may chain return trips and a different final destination with one physical formation',()=>{
 const g=game(),rm=g.rotationV2,a=sched(g.scheduleV2,'17803',7*3600+40*60,9*3600+52*60,'DN','LYD'),b=sched(g.scheduleV2,'17806',10*3600+16*60,12*3600+28*60,'LYD','DN'),c=sched(g.scheduleV2,'883421',13*3600,15*3600+30*60,'DN','CMF'),r=rm.addRotation({name:'Dijon Lyon puis Chambéry'}),l=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:4000000}),coach=rm.addVehicle({number:'B11',category:'voiture'}),cp=rm.addCoupon({name:'Coupon 301',vehicleIds:[coach.id]});
 rm.addOccurrence(r.id,{scheduleId:a.id,versionId:a.currentVersion.id});rm.addOccurrence(r.id,{scheduleId:b.id,versionId:b.currentVersion.id});rm.addOccurrence(r.id,{scheduleId:c.id,versionId:c.currentVersion.id});rm.setAssignedFormation(r.id,{members:[{vehicleId:l.id,role:FormationRole.LEAD},{vehicleId:coach.id,role:FormationRole.COACH,sourceCouponId:cp.id}]});rm.recalculateRotation(r.id);
 assert.equal(r.occurrences.length,3);for(const o of r.occurrences){assert.equal(o.formation.members[0].vehicleId,l.id);assert.equal(o.formation.members[1].sourceCouponId,cp.id);}assert.equal(g.scheduleV2Runtime._runtimeRotations()[0].occurrences.length,3);
});

test('HOTFIX32 several rolling lines coexist so several TER can exist at the same time',()=>{
 const g=game(),rm=g.rotationV2,a=sched(g.scheduleV2,'17803',7*3600+40*60,9*3600+52*60),b=sched(g.scheduleV2,'17805',8*3600+40*60,10*3600+52*60),l1=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:1}),l2=rm.addVehicle({number:'BB22235',category:'locomotive',powerW:1}),r1=rm.addRotation({name:'Table 1'}),r2=rm.addRotation({name:'Table 2'});
 rm.addOccurrence(r1.id,{scheduleId:a.id,versionId:a.currentVersion.id});rm.addOccurrence(r2.id,{scheduleId:b.id,versionId:b.currentVersion.id});rm.setAssignedFormation(r1.id,{members:[{vehicleId:l1.id,role:FormationRole.LEAD}]});rm.setAssignedFormation(r2.id,{members:[{vehicleId:l2.id,role:FormationRole.LEAD}]});
 assert.equal(g.scheduleV2Runtime._runtimeRotations().length,2);const e=editor(g,r1),html=e._renderAllLines();for(const x of ['17803','17805','Table 1','Table 2','Les trains simultanés apparaissent réellement en parallèle'])assert.ok(html.includes(x),x);
});

test('HOTFIX32 Paris-Valence split can hand the Briancon coupon to a new locomotive on another line',()=>{
 const g=game(),rm=g.rotationV2;
 const parisVal=sched(g.scheduleV2,'ICN5773',6*3600,9*3600,'PAZ','VAL'),valBrian=sched(g.scheduleV2,'ICN5793',9*3600+20*60,13*3600,'VAL','BRI');
 const locNice=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:5600000}),locBrian=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:4400000}),niceCar=rm.addVehicle({number:'NICE-A',category:'voiture'}),briCar=rm.addVehicle({number:'BRI-A',category:'voiture'}),cpNice=rm.addCoupon({name:'Coupon Nice',vehicleIds:[niceCar.id]}),cpBrian=rm.addCoupon({name:'Coupon Briançon',vehicleIds:[briCar.id]});
 const trunk=rm.addRotation({name:'Paris → Valence → Nice'}),branch=rm.addRotation({name:'Valence → Briançon'});
 const o1=rm.addOccurrence(trunk.id,{scheduleId:parisVal.id,versionId:parisVal.currentVersion.id});rm.setAssignedFormation(trunk.id,{members:[{vehicleId:locNice.id,role:FormationRole.LEAD},{vehicleId:niceCar.id,role:FormationRole.COACH,sourceCouponId:cpNice.id},{vehicleId:briCar.id,role:FormationRole.COACH,sourceCouponId:cpBrian.id}]});
 rm.addAction(trunk.id,{type:RotationActionType.SPLIT,occurrenceId:o1.id,locationOccurrenceId:parisVal.currentVersion.locations[1].id,couponIds:[cpBrian.id],vehicleIds:[briCar.id],durationSec:300});
 rm.addOccurrence(branch.id,{scheduleId:valBrian.id,versionId:valBrian.currentVersion.id});rm.setAssignedFormation(branch.id,{members:[{vehicleId:locBrian.id,role:FormationRole.LEAD},{vehicleId:briCar.id,role:FormationRole.COACH,sourceCouponId:cpBrian.id}]});
 rm.recalculateRotation(trunk.id);rm.recalculateRotation(branch.id);
 const trunkIv=rm.materialIntervals(trunk.id,o1.id).find(x=>x.vehicleId===briCar.id),branchOcc=branch.occurrences[0],branchIv=rm.materialIntervals(branch.id,branchOcc.id).find(x=>x.vehicleId===briCar.id);
 assert.equal(trunkIv.endLocationId,'VAL');assert.equal(branchIv.startLocationId,'VAL');assert.ok(trunkIv.endSec<=branchIv.startSec,'coupon physically released before branch departure');assert.equal(rm.validateMaterialConflicts().length,0,'same coupon may continue on another line after a non-overlapping split');
});
