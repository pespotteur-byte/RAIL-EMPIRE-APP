import {ScheduleV2Manager,ScheduledLocation} from './js/schedule-v2-model.js';
import {RotationV2Manager,RotationActionType} from './js/rotation-v2-model.js';
const sm=new ScheduleV2Manager(),rec=sm.createDraft({number:'OP'}),ver=rec.currentVersion;ver.locations=[new ScheduledLocation({id:'A',stationId:'A',name:'A',track:{displayName:'1'},departureSec:0,dwellSec:1200})];
const rm=new RotationV2Manager(sm),r=rm.addRotation({name:'R'}),o=rm.addOccurrence(r.id,{scheduleId:rec.id,versionId:ver.id});const w=rm.addVehicle({number:'W',category:'voiture'}),c=rm.addCoupon({name:'C301',vehicleIds:[w.id]});
rm.addAction(r.id,{type:RotationActionType.DETACH,occurrenceId:o.id,locationOccurrenceId:'A',couponIds:[c.id],durationSec:300});
rm.addAction(r.id,{type:RotationActionType.ATTACH,occurrenceId:o.id,locationOccurrenceId:'A',couponIds:[c.id],durationSec:300});
console.log('window',rm.operationWindowSec(r.id,o.id,'A'));
