import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTurnback,normalizeTurnbackState,CAB_CHANGE_SECONDS} from '../formation-turnback.js';
import {Rame} from '../rame.js';
import {ActiveService,ScheduleCreator,ServiceStop,cantonManager} from '../schedule-creator.js';
import {PlatformManager} from '../line.js';
import {fixture as basic} from './helpers/rc10-fixtures.mjs';
import {makeGame,addValidSchedule,addDieselFormation} from './re-rc2-fixtures.mjs';
import {FormationMember,FormationRole} from '../rotation-v2-model.js';
const loco={elementId:'L',catalogId:'L',category:'locomotive',power:3000,mass:80,length:20,maxSpeed:120,traction:'diesel',flipped:false};
const wagon={elementId:'W',catalogId:'W',category:'wagon',power:0,mass:30,length:20,maxSpeed:120,flipped:false};
const cab={...wagon,elementId:'C',catalogId:'C',category:'voiture',isDrivingTrailer:true};
function f(elements=[loco,cab],{terminal=false,taq=true,departure=610,day='2026-09-11',arrive=605}={}){
 const base=basic();const {game,world}=base;
 const rame=new Rame({id:'RC11',elementDetails:elements,currentLocation:{stationId:'A',lat:48,lon:2}});
 const incoming=[{lat:48,lon:2,wayId:'physical',maxSpeed:60,bidirectional:'regular'},{lat:48.01,lon:2,wayId:'physical',maxSpeed:60,bidirectional:'regular'}];
 const stops=[{stationId:'A',type:'arret',arrivalTime:600,departureTime:600},{stationId:'B',type:'arret',arrivalTime:arrive,departureTime:departure,turnBack:taq}];
 if(!terminal)stops.push({stationId:'A',type:'arret',arrivalTime:630,departureTime:630});
 const s=new ActiveService({id:'TURN',rameId:rame.id,name:'TAQ',serviceType:'hlp',stops,routes:terminal?[incoming]:[incoming,[...incoming].reverse()]},rame,world,null);
 game.scheduleCreator=new ScheduleCreator();game.scheduleCreator.services=[s];game.platformManager=new PlatformManager();globalThis.window={game};
 s.active=true;s.state='moving';s.train.state='moving';s.currentStopIndex=1;s._currentDate=day;s.position={lat:48.01,lon:2};s.speed=s.train.speed=0;s._initializeState(incoming,'1-0');
 s.arriveAtStation(world.getStationById('B'),arrive,null);
 return{s,game,world,rame,incoming,day,arrive};
}
const tick=(x,time,day=x.day)=>x.s.scheduleTick(time,day,null);
test('RC11-TAQ01 a locomotive alone and a driving trailer permit cab changes; an ordinary wagon does not',()=>{
 for(const es of [[loco],[loco,cab],[loco,{...loco,elementId:'L2'}],[{...loco,category:'automotrice'}]])assert.equal(assessTurnback(es).allowed,true);
 assert.equal(assessTurnback([loco,wagon]).mode,'runaround_required');assert.equal(assessTurnback([]).mode,'unknown_formation');assert.equal(assessTurnback([cab]).mode,'missing_traction');
 assert.equal(assessTurnback([loco,{...cab,hasCab:false}]).allowed,false);
});
test('RC11-TAQ02 a non-reversible formation remains stopped even beyond the two-hour forced departure limit',()=>{
 const x=f([loco,wagon]);const pos={...x.s.position},elements=structuredClone(x.rame.elementDetails);tick(x,610);tick(x,750);
 assert.equal(x.s.state,'stopped_at_station');assert.equal(x.s.speed,0);assert.deepEqual(x.s.position,pos);assert.deepEqual(x.rame.elementDetails,elements);assert.match(x.s.train.delayReason,/remise en tête/);assert.equal(x.s._turnbackState.applied,false);
 assert.notEqual(x.game.platformManager.getPlatformForTrain('B',x.s.id),null);
});
test('RC11-TAQ03 five minutes are measured from real arrival, never from the booked clock',()=>{
 const x=f([loco,cab],{arrive:608,departure:610});tick(x,610);assert.equal(x.s.state,'stopped_at_station');tick(x,612.99);assert.equal(x.s.state,'stopped_at_station');tick(x,613);assert.equal(x.s.state,'moving');assert.equal(x.s._turnbackState.applied,true);
});
test('RC11-TAQ04 the opposite cab becomes the head without adding distance or releasing the occupied station',()=>{
 const x=f(),oldHead={...x.s.position},distance=x.s.totalDistance,mass=x.rame.totalMass,length=x.rame.totalLength;
 tick(x,609.99);assert.deepEqual(x.s.position,oldHead);tick(x,610);
 assert.equal(x.rame.elementDetails[0].elementId,'C');assert.equal(x.rame.elementDetails[1].elementId,'L');assert.equal(x.rame.elementDetails[0].flipped,true);
 assert.equal(x.rame.totalLength,length);assert.equal(x.rame.totalMass,mass);assert.equal(x.s.totalDistance,distance);assert.equal(x.s.speed,0);
 const metres=(oldHead.lat-x.s.position.lat)*Math.PI/180*6371000;assert.ok(Math.abs(metres-length)<.05);
 assert.notEqual(x.game.platformManager.getPlatformForTrain('B',x.s.id),null);assert.ok(x.s._departureResourceHold);
 const before=x.s.position.lat;for(let i=0;i<30;i++)x.s.moveUpdate(.1,610+i/600,x.game.scheduleCreator.services);assert.ok(x.s.position.lat<before,'departing away from the opposite cab, not retracing the consist');
});
test('RC11-TAQ05 repeated calls cannot reverse the formation twice',()=>{
 const x=f();tick(x,610);const state=structuredClone(x.s._turnbackState),details=structuredClone(x.rame.elementDetails),pos={...x.s.position};
 x.s.state='stopped_at_station';x.s.currentStopIndex=2;assert.equal(x.s._turnbackDepartureReady(x.s.stops[1],611,x.day),true);assert.deepEqual(x.rame.elementDetails,details);assert.deepEqual(x.s.position,pos);assert.deepEqual(x.s._turnbackState,state);
});
test('RC11-TAQ06 a route on another physical track cannot be used to hide a run-around',()=>{
 const x=f();x.s.routes[1]=[{lat:48.01,lon:2.001,wayId:'other'},{lat:48,lon:2.001,wayId:'other'}];const pos={...x.s.position};tick(x,610);
 assert.equal(x.s.state,'stopped_at_station');assert.equal(x.s._turnbackState.applied,false);assert.deepEqual(x.s.position,pos);assert.match(x.s.train.delayReason,/voie occupée/);
});
test('RC11-TAQ07 insufficient geometry under the rear fails closed, not by shortening the train',()=>{
 const x=f([{...loco,length:2000}]);tick(x,610);assert.equal(x.s.state,'stopped_at_station');assert.match(x.s.train.delayReason,/géométrie insuffisante/);assert.equal(x.rame.totalLength,2000);
});
test('RC11-TAQ08 no cab change can complete while the physical train still has speed',()=>{
 const x=f();x.s.speed=x.s.train.speed=12;const details=structuredClone(x.rame.elementDetails);assert.equal(x.s._turnbackDepartureReady(x.s.stops[1],610,x.day),false);assert.equal(x.s.speed,12);assert.deepEqual(x.rame.elementDetails,details);
});
test('RC11-TAQ09 a terminal TAQ keeps its platform for the operation then finishes',()=>{
 const x=f([loco],{terminal:true});assert.equal(x.s.completed,false);tick(x,609);assert.equal(x.s.completed,false);tick(x,610);assert.equal(x.s.completed,true);assert.equal(x.game.platformManager.getPlatformForTrain('B',x.s.id),null);
});
test('RC11-TAQ10 actual cab-change time survives midnight',()=>{
 const x=f([loco],{arrive:1438,departure:3});tick(x,2,'2026-09-12');assert.equal(x.s.state,'stopped_at_station');tick(x,3,'2026-09-12');assert.equal(x.s.state,'moving',JSON.stringify({turnback:x.s._turnbackState,reason:x.s.train.delayReason,day:x.s._legacyOperatingDay,date:x.s._currentDate,dep:x.s.getCurrentStops()[1].departureTime}));
});
test('RC11-TAQ11 formation changes during the operation restart its physical preparation',()=>{
 const x=f();tick(x,607);x.rame.elementDetails[1]={...x.rame.elementDetails[1],elementId:'OTHER'};tick(x,608);tick(x,610);assert.equal(x.s.state,'stopped_at_station');tick(x,613);assert.equal(x.s.state,'moving');
});
test('RC11-TAQ12 TAQ stays a mandatory stop through optional-stop and adjusted-stop conversion',()=>{
 const x=f();x.s.stops[1].stopCode='[S]';x.s.stops[1].turnBack=true;const adjusted=x.s._buildAdjustedStops(x.s.stops,()=>0);assert.equal(adjusted[1].type,'arret');assert.notEqual(adjusted[1]._skipped,true);assert.equal(adjusted[1].turnBack,true);
});
test('RC11-TAQ13 saved commands and cab-change timelines are detached, validated and retained',()=>{
 const x=f();const sc=x.game.scheduleCreator,raw=sc.toSave()[0],expanded=sc._expandCompactService(JSON.parse(JSON.stringify(raw)));
 assert.equal(expanded.stops[1].turnBack,true);assert.equal(new ActiveService(expanded,x.rame,x.world,null).stops[1].turnBack,true);
 assert.equal(expanded._runtime.turnbackState.readyAtSec-expanded._runtime.turnbackState.startedAtSec,CAB_CHANGE_SECONDS);
 const copied=normalizeTurnbackState(expanded._runtime.turnbackState);copied.applied=true;assert.equal(x.s._turnbackState.applied,false);
 assert.equal(normalizeTurnbackState({...copied,readyAtSec:copied.startedAtSec+1}),null);assert.equal(normalizeTurnbackState({...copied,key:''}),null);
});
test('RC11-TAQ14 V2 compilation no longer drops the TAQ flag',()=>{
 const g=makeGame(),r=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'TAQ'});addDieselFormation(g,rot,r);r.currentVersion.locations[1].turnBack=true;r.currentVersion.locations[1].dwellSec=300;r.currentVersion.locations[1].departureSec+=300;globalThis.window={game:g};g.scheduleV2Runtime.sync(1429,'2026-08-16');assert.equal(g.scheduleCreator.services[0].stops[1].turnBack,true);
});
test('RC11-TAQ15 a reversed V2 occurrence cannot silently lead with an ordinary wagon',()=>{
 const g=makeGame(),r=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'reverse'}),{occ}=addDieselFormation(g,rot,r);
 const w=g.rotationV2.addVehicle({number:'W',category:'wagon',massKg:30000,lengthM:20,maxSpeed:120});occ.formation.members.push(new FormationMember({vehicleId:w.id,role:FormationRole.WAGON}));occ.reversed=true;globalThis.window={game:g};g.scheduleV2Runtime.sync(1429,'2026-08-16');
 assert.equal(g.scheduleCreator.services.length,0);assert.ok(g.scheduleV2Runtime.alerts.some(a=>a.code==='TURNBACK_FORMATION_INCOMPATIBLE'));
});
test('RC11-TAQ16 composition operations finish before the cab-change clock starts',()=>{
 const x=f();x.s._turnbackState=null;x.s._v2OperationState={locationOccurrenceId:x.s.stops[1].locationOccurrenceId,completed:false,failed:false};tick(x,610);assert.equal(x.s._turnbackState,null);x.s._v2OperationState.completed=true;tick(x,615);assert.equal(x.s.state,'stopped_at_station');tick(x,620);assert.equal(x.s.state,'moving');
});

test('RC11-TAQ17 a saved pending V2 cab change is restored rather than restarted or skipped',()=>{
 const g=makeGame(),r=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'snapshot'});addDieselFormation(g,rot,r);r.currentVersion.locations[1].turnBack=true;globalThis.window={game:g};g.world.tracks=[];g.platformManager=new PlatformManager();
 g.scheduleV2Runtime.sync(1429,'2026-08-16');const s=g.scheduleCreator.services[0];s._currentDate='2026-08-17';s.currentStopIndex=1;s.state='moving';s.position={lat:48.2,lon:2.2};s.speed=s.train.speed=0;s._initializeState(s.routes[0],'1-0');s.arriveAtStation(g.world.getStationById('B'),10,null);
 assert.ok(s._turnbackState);const clock=s._turnbackState.readyAtSec;const saved=g.scheduleV2Runtime.toSave();assert.equal(g.scheduleV2Runtime.loadFromSave(saved),true);s._turnbackState=null;s._v2FormationReversed=true;assert.equal(g.scheduleV2Runtime._restoreSnapshot(s,1452),true);
 assert.equal(s._turnbackState.readyAtSec,clock);assert.equal(s._turnbackState.applied,false);assert.equal(s._v2FormationReversed,false);
 s.scheduleTick(14,'2026-08-17',null);assert.equal(s.completed,false);s.scheduleTick(15,'2026-08-17',null);assert.equal(s.completed,true);
});
test('RC11-TAQ18 malformed V2 cab-change snapshots are rejected without clearing valid pending state',()=>{
 const g=makeGame(),r=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'bad snapshot'});addDieselFormation(g,rot,r);globalThis.window={game:g};g.scheduleV2Runtime.sync(1429,'2026-08-16');const good=g.scheduleV2Runtime.toSave();assert.equal(g.scheduleV2Runtime.loadFromSave(good),true);const size=g.scheduleV2Runtime._pendingSnapshots.size;
 const bad=structuredClone(good);bad.services[0].turnbackState={key:'x',signature:'s',mode:'cab_change',startedAtSec:0,readyAtSec:1,applied:true};assert.equal(g.scheduleV2Runtime.loadFromSave(bad),false);assert.equal(g.scheduleV2Runtime._pendingSnapshots.size,size);
});
test('RC11-TAQ19 an automatic return cannot omit the cab change',()=>{
 const x=f([loco,cab],{terminal:true,taq:false});const s=x.s;s.completed=false;s.state='moving';s.roundTrip=true;s.currentStopIndex=s.stops.length;s.position={lat:48.01,lon:2};s.train.stoppedAt=x.world.getStationById('B');s._stationaryRoute=x.incoming;s.terminusWait=0;s._lastArrivalTime=605;s.completeService(null,x.world.getStationById('B'),48.01,2);
 assert.equal(s.isReturnLeg,true);tick(x,605);assert.equal(s.state,'stopped_at_station');tick(x,610);assert.equal(s.state,'moving');assert.equal(x.rame.elementDetails[0].elementId,'C');
});
test('RC11-TAQ20 automatic return retains intermediate TAQ commands and does not change cab twice at the terminal',()=>{
 const x=f([loco,cab],{terminal:true,taq:true});const s=x.s;s.roundTrip=true;s.completed=false;s.state='moving';s.currentStopIndex=s.stops.length;s._stationaryRoute=x.incoming;s.position={lat:48.01,lon:2};s.terminusWait=0;s._lastArrivalTime=605;s._turnbackState=null;
 s.completeService(null,x.world.getStationById('B'),48.01,2);assert.equal(s.returnStops[0].turnBack,true);tick(x,610);assert.equal(s.state,'moving');assert.equal(x.rame.elementDetails[0].elementId,'C');const id=s._turnbackState.key;tick(x,611);assert.equal(s._turnbackState.key,id);assert.equal(x.rame.elementDetails[0].elementId,'C');
});

test('RC11-TAQ21 restoring cab direction on an unassigned legacy service cannot create a fictitious rame or throw',()=>{
 const g=makeGame();const s=g.scheduleCreator.addService({id:'RC11_UNASSIGNED',v2OccurrenceId:'O',v2RotationId:'R',v2BaseDate:'2026-08-16',stops:[{stationId:'A',type:'arret',arrivalTime:600,departureTime:605}],routes:[]},null,g.world);
 s.state='stopped_at_station';s.train._stoppedSinceGameTime=600;s._v2FormationReversed=false;const save=g.scheduleV2Runtime.toSave();assert.equal(g.scheduleV2Runtime.loadFromSave(save),true);assert.equal(g.scheduleV2Runtime._restoreSnapshot(s,602),true);assert.equal(s.rame,null);assert.equal(s.train._stoppedSinceGameTime,600);
});
