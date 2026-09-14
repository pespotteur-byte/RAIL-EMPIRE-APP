import {ScheduleV2Manager,ScheduleState,ScheduledLocation,TrackBinding,OperatingCalendar} from './js/schedule-v2-model.js';
import {RotationV2Manager,FormationRole} from './js/rotation-v2-model.js';
function loc(id,s,t,arr=false){return new ScheduledLocation({id,stationId:s,name:s,track:new TrackBinding({displayName:'1',lat:48,lon:2}),arrivalSec:arr?t:null,departureSec:arr?null:t,arrivalOverride:arr,departureOverride:!arr});}
function sch(sm,n,cal){const r=sm.createDraft({number:n});const v=r.currentVersion;v.state=ScheduleState.VALID;v.calendarIds=[cal];v.locations=[loc(n+'a','A',8*3600),loc(n+'b','B',9*3600,true)];return r;}
const sm=new ScheduleV2Manager();sm.calendars.push(new OperatingCalendar({id:'wd',name:'WD',weekdays:[1,2,3,4,5]}),new OperatingCalendar({id:'we',name:'WE',weekdays:[0,6]}));
const rm=new RotationV2Manager(sm);const v=rm.addVehicle({number:'BB',category:'locomotive',powerW:1});
for(const [n,c] of [['WD','wd'],['WE','we']]){const s=sch(sm,n,c),r=rm.addRotation({name:n});rm.addOccurrence(r.id,{scheduleId:s.id,versionId:s.currentVersion.id,formation:{members:[{vehicleId:v.id,role:FormationRole.LEAD}]}});}
console.log(JSON.stringify(rm.validateMaterialConflicts(),null,2));
