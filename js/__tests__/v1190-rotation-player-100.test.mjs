import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode, OperatingCalendar } from '../schedule-v2-model.js';
import { RotationV2Manager, FormationRole, RotationActionType } from '../rotation-v2-model.js';
import { RotationV2Editor } from '../rotation-v2-editor.js';

function loc(id,name,stationId,arr,dep,dwell=0){
  return new ScheduledLocation({id,stationId,name,track:new TrackBinding({wayId:`w-${id}`,displayName:'V1',lat:48,lon:2,snapLat:48,snapLon:2}),arrivalSec:arr,departureSec:dep,dwellSec:dwell,stopCode:StopCode.C,arrivalOverride:arr!=null,departureOverride:dep!=null});
}
function schedule(sm,{number,locations,legs=[],distanceKm=0,calendarIds=[]}){
  const rec=sm.createDraft({number,name:number,category:TrainCategory.PASSENGER,maxSpeed:160});
  const v=rec.currentVersion;v.locations=locations;v.locations.forEach((l,i)=>l.order=i);v.state=ScheduleState.VALID;v.calendarIds=[...calendarIds];v.outboundPath.distanceKm=distanceKm||legs.reduce((s,l)=>s+l.distanceKm,0);v.outboundPath.legs=legs;return rec;
}
function game(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2),rames=[];
  return {scheduleV2,rotationV2,saveState(){},_currentDate:'2026-08-23',engine:{getParisTime(){return {hours:0,minutes:0,seconds:0};},getParisDate(){return '2026-08-23';}},world:{getStationById(){return null;}},rameManager:{getAll(){return rames;},getById(id){return rames.find(r=>r.id===id)||null;},_rows:rames}};
}
function editor(g,rot){const e=Object.create(RotationV2Editor.prototype);Object.assign(e,{game:g,ui:{},selectedRotationId:rot?.id||'',selectedOccurrenceId:'',selectedMaterialId:'',activeView:'rotation',libraryTab:'schedules',searchQuery:'',selectedDate:'',_history:[],_future:[],_syncRuntimeNow(){},render(){}});return e;}

test('v1.1.90 persists editable operational station codes and migrates schema 3 saves',()=>{
  const g=game(),rm=g.rotationV2,L=loc('L','Lyon Part-Dieu','lyd',0,0),D=loc('D','Dijon','dn',0,0),e=editor(g);
  assert.equal(e._stationCode(L),'LYD');assert.equal(e._stationCode(D),'DN');
  rm.setStationCode(L,'XLYD');assert.equal(e._stationCode(L),'XLYD');
  const save=rm.toSave();assert.equal(save.schemaVersion,6);assert.equal(save.stationCodes['station:lyd'],'XLYD');
  const rm2=new RotationV2Manager();assert.equal(rm2.loadFromSave(save),true);assert.equal(rm2.getStationCode(L),'XLYD');
  const legacy={...save,schemaVersion:3};delete legacy.stationCodes;const rm3=new RotationV2Manager();assert.equal(rm3.loadFromSave(legacy),true);assert.deepEqual(rm3.stationCodes,{});
});

test('v1.1.90 material day view filters duties by selected real date and calendars',()=>{
  const g=game(),sm=g.scheduleV2,rm=g.rotationV2,sun=new OperatingCalendar({name:'Dimanche',weekdays:[0]}),mon=new OperatingCalendar({name:'Lundi',weekdays:[1]});sm.calendars.push(sun,mon);
  const recSun=schedule(sm,{number:'SUN',calendarIds:[sun.id],locations:[loc('S1','Dijon','DN',null,8*3600),loc('S2','Lyon','LYD',9*3600,null)]}),recMon=schedule(sm,{number:'MON',calendarIds:[mon.id],locations:[loc('M1','Dijon','DN',null,10*3600),loc('M2','Lyon','LYD',11*3600,null)]});
  const v=rm.addVehicle({number:'BB1',category:'locomotive',powerW:1}),rSun=rm.addRotation({name:'Sun',calendarId:sun.id}),rMon=rm.addRotation({name:'Mon',calendarId:mon.id});rm.addOccurrence(rSun.id,{scheduleId:recSun.id,versionId:recSun.currentVersion.id,formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD}]}});rm.addOccurrence(rMon.id,{scheduleId:recMon.id,versionId:recMon.currentVersion.id,formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD}]}});
  const e=editor(g,rSun);e.selectedDate='2026-08-23';assert.deepEqual(e._globalMaterialIntervals(v.id).map(x=>x.rotation.name),['Sun']);e.selectedDate='2026-08-24';assert.deepEqual(e._globalMaterialIntervals(v.id).map(x=>x.rotation.name),['Mon']);
});

test('v1.1.90 daily kilometres use exact routed legs when material splits mid-service',()=>{
  const g=game(),rm=g.rotationV2,sm=g.scheduleV2,A=loc('A','Paris','PA',null,8*3600),V=loc('V','Valence','VA',9*3600,9*3600+10*60,600),N=loc('N','Nice','NI',10*3600,null),rec=schedule(sm,{number:'5773',locations:[A,V,N],legs:[{fromLocationId:'A',toLocationId:'V',distanceKm:500},{fromLocationId:'V',toLocationId:'N',distanceKm:300}],distanceKm:800}),r=rm.addRotation({name:'ICN'}),loco=rm.addVehicle({number:'BB26001',category:'locomotive',powerW:1}),bri=rm.addVehicle({number:'BRI',category:'voiture'}),occ=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:loco.id,role:FormationRole.LEAD},{vehicleId:bri.id,role:FormationRole.COACH}]}});rm.addAction(r.id,{type:RotationActionType.SPLIT,occurrenceId:occ.id,locationOccurrenceId:'V',vehicleIds:[bri.id],durationSec:300});rm.recalculateRotation(r.id);
  const slot=rm.materialIntervals(r.id,occ.id,null,occ.resolvedStartSec).find(x=>x.vehicleId===bri.id),e=editor(g,r);assert.equal(Math.round(e._intervalDistanceKm({...slot,occ})),500);const locoSlot=rm.materialIntervals(r.id,occ.id,null,occ.resolvedStartSec).find(x=>x.vehicleId===loco.id);assert.equal(Math.round(e._intervalDistanceKm({...locoSlot,occ})),800);
});

test('v1.1.90 complete Rame is selectable as one daily duty until its elements split',()=>{
  const g=game(),rm=g.rotationV2,sm=g.scheduleV2,rame={id:'rame-1',name:'Corail 04',serialNumber:'R04',elementDetails:[{name:'BB'},{name:'V1'}]};g.rameManager._rows.push(rame);
  const rec=schedule(sm,{number:'17801',locations:[loc('A','Dijon','DN',null,8*3600),loc('B','Lyon','LYD',9*3600,null)],distanceKm:195}),r=rm.addRotation({name:'R'}),l=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:1,sourceRameId:rame.id,sourceRameElementIndex:0}),c=rm.addVehicle({number:'V1',category:'voiture',sourceRameId:rame.id,sourceRameElementIndex:1}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD},{vehicleId:c.id,role:FormationRole.COACH}]}});rm.recalculateRotation(r.id);const e=editor(g,r),slots=e._globalRameIntervals(rame.id);assert.equal(slots.length,1);assert.equal(slots[0].startSec,8*3600);assert.equal(slots[0].endSec,9*3600);e.selectedMaterialId=`rame:${rame.id}`;assert.ok(e._renderMaterialView(r).includes('Journée rame complète'));
});

test('v1.1.90 Rever leading-end logic distinguishes locomotive from driving trailer',()=>{
  const g=game(),rm=g.rotationV2,r=rm.addRotation({name:'Rever'}),rec=schedule(g.scheduleV2,{number:'17801',locations:[loc('A','A','A',null,8*3600),loc('B','B','B',9*3600,null)]}),l=rm.addVehicle({number:'BB22201',category:'locomotive',powerW:1}),coach=rm.addVehicle({number:'B11',category:'voiture'}),pilot=rm.addVehicle({number:'B5uxh',category:'voiture',isDrivingTrailer:true}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:rec.currentVersion.id,formation:{members:[{vehicleId:l.id,role:FormationRole.LEAD,order:0},{vehicleId:coach.id,role:FormationRole.COACH,order:1},{vehicleId:pilot.id,role:FormationRole.COACH,order:2}]}});const e=editor(g,r);assert.equal(e._leadingInfo(o).type,'loco');o.reversed=true;assert.equal(e._leadingInfo(o).type,'pilot');const html=e._renderTimeline(r,true);assert.ok(html.includes('rv3-real-sheet'));assert.ok(html.includes('rv3-real-leadline pilot'));
});

test('v1.1.90 editor exposes real sheet, Rame day, date selector, editable station codes and dedicated UM commands',()=>{
  const src=fs.readFileSync(new URL('../rotation-v2-editor.js',import.meta.url),'utf8');
  for(const token of ['Diagramme réel','Journée rame complète','data-rv3-select="date"','edit-station-code','Former une UM','Séparer l’UM','FORM_UM','SPLIT_UM','rv3-real-leadline','km ce jour','data-tab="rames"'])assert.ok(src.includes(token),token);
});
