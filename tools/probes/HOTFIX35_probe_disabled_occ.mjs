import {ScheduleV2Manager,ScheduleState,ScheduledLocation,TrackBinding} from './js/schedule-v2-model.js';
import {RotationV2Manager,FormationRole} from './js/rotation-v2-model.js';
import {ScheduleV2Runtime} from './js/schedule-v2-runtime.js';
function loc(id,s,t,a=false){return new ScheduledLocation({id,stationId:s,name:s,track:new TrackBinding({displayName:'1',lat:48,lon:2}),arrivalSec:a?t:null,departureSec:a?null:t,arrivalOverride:a,departureOverride:!a});}
const sm=new ScheduleV2Manager(),rm=new RotationV2Manager(sm);const rec=sm.createDraft({number:'X'}),v=rec.currentVersion;v.state=ScheduleState.VALID;v.locations=[loc('a','A',28800),loc('b','B',32400,true)];const veh=rm.addVehicle({number:'BB',category:'locomotive',powerW:1});const r=rm.addRotation({name:'R'});const o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:v.id,formation:{members:[{vehicleId:veh.id,role:FormationRole.LEAD}]},enabled:false});rm.recalculateRotation(r.id);
console.log('occ enabled',o.enabled,'intervals',rm.materialIntervals(r.id,o.id).length,'conflicts usage?',rm.validateMaterialConflicts());
const game={scheduleV2:sm,rotationV2:rm,scheduleCreator:{services:[]},rameManager:{getById(){return null}},realismSettings:{physics:1}};const rt=new ScheduleV2Runtime(game);console.log('plans',rt.planRotationForDate(r,'2026-08-31').map(p=>({error:p.error,start:p.startSec})));
