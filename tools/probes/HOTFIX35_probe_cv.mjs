import {ScheduleV2Manager,ScheduleState,ScheduledLocation,TrackBinding} from './js/schedule-v2-model.js';
import {RotationV2Manager,FormationRole} from './js/rotation-v2-model.js';
const sm=new ScheduleV2Manager();const rec=sm.createDraft({number:'CV'}),ver=rec.currentVersion;ver.state=ScheduleState.VALID;ver.locations=[new ScheduledLocation({id:'a',stationId:'A',name:'A',track:new TrackBinding({displayName:'1'}),departureSec:0}),new ScheduledLocation({id:'b',stationId:'B',name:'B',track:new TrackBinding({displayName:'1'}),arrivalSec:3600})];
const rm=new RotationV2Manager(sm),bb=rm.addVehicle({number:'BB',category:'locomotive',powerW:4e6}),r=rm.addRotation({name:'R'});rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:ver.id});rm.setAssignedFormation(r.id,{members:[{vehicleId:bb.id,role:FormationRole.VEHICLE}]});
console.log('role',r.assignedFormation.members[0].role,'issues',rm.validateRotation(r.id).map(x=>x.code));
