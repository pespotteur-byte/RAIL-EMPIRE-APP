import test from 'node:test';
import assert from 'node:assert/strict';
import {materialTrackLocation,materialTrackMismatch} from '../material-track-location.js';
import {Rame} from '../rame.js';
import {RotationV2Manager,PhysicalVehicle} from '../rotation-v2-model.js';
import {ScheduleCreator,ActiveService,ServiceStop} from '../schedule-creator.js';
import {makeGame,addValidSchedule,addDieselFormation} from './re-rc2-fixtures.mjs';
import {fixture} from './helpers/rc10-fixtures.mjs';
const native=(id,ref='')=>({kind:'native',id,trackRef:ref,lat:null,lon:null});
const osm=(id,ref='')=>({kind:'osm',id,trackRef:ref,lat:null,lon:null});
const tracks=[{id:'A1',stationId:'A',voie:'1',lat:48,lon:2},{id:'A2',stationId:'A',voie:'2',lat:48,lon:2.001},{id:'B1',stationId:'B',voie:'1',lat:48.01,lon:2}];
const loc=(id,platform=id)=>({trackIdentity:native(id),voiePointId:id,platform});
function scoped(g,fn){const old=globalThis.window;globalThis.window={game:g};try{return fn();}finally{globalThis.window=old;}}

test('RC11-TRACK01 same station does not mean same physical track',()=>{
 assert.equal(materialTrackMismatch(loc('A1'),loc('A2'),'A',tracks),true);
 assert.equal(materialTrackMismatch(loc('A1','old'),loc('A1','renamed'),'A',tracks),false);
 assert.equal(materialTrackMismatch(loc('A1'),loc('B1'),'A',tracks),true);
});
test('RC11-TRACK02 actual references alias OSM way splits, not renamed display labels',()=>{
 assert.equal(materialTrackMismatch({trackIdentity:osm('10','1')},{trackIdentity:osm('11','V01')},'A'),false);
 assert.equal(materialTrackMismatch({trackIdentity:osm('10'),platform:'Gleis X'},{trackIdentity:osm('11'),platform:'Gleis X'},'A'),true);
 assert.equal(materialTrackMismatch({trackIdentity:osm('10','1')},{trackIdentity:osm('10','renamed')},'A'),false);
});
test('RC11-TRACK03 a native identity bridges only to the unique physical OSM track',()=>{
 assert.equal(materialTrackMismatch(loc('A1'),{trackIdentity:osm('10','1')},'A',tracks),false);
 assert.equal(materialTrackMismatch(loc('A1'),{trackIdentity:osm('10','2')},'A',tracks),true);
});
test('RC11-TRACK04 unknown old starting locations are assignable once but a known identity cannot be erased',()=>{
 assert.equal(materialTrackMismatch({},loc('A1'),'A',tracks),false);
 assert.equal(materialTrackMismatch(loc('A1'),{},'A',tracks),true);
 assert.equal(materialTrackMismatch({platform:'V1'},{platform:'1'},'A'),false);
 assert.equal(materialTrackMismatch({platform:'1'},{platform:'2'},'A'),true);
});
test('RC11-TRACK05 normalized locations are detached from mutable schedule bindings',()=>{
 const value={track:{wayId:'10',trackRef:'1',displayName:'hello',snapLat:48,snapLon:2}};
 const result=materialTrackLocation(value);value.track.trackRef='2';assert.equal(result.trackIdentity.trackRef,'1');
 const copied=materialTrackLocation(result);copied.trackIdentity.id='99';assert.equal(result.trackIdentity.id,'10');
});
test('RC11-TRACK06 Rame and physical vehicle retain their track through JSON without null coordinates becoming zero',()=>{
 const r=new Rame({id:'R',name:'R',currentLocation:{stationId:'A',lat:null,lon:null,...loc('A1')}});
 const copy=new Rame(JSON.parse(JSON.stringify(r)));assert.equal(copy.currentLocation.trackIdentity.id,'A1');assert.equal(copy.currentLocation.lat,null);
 const v=new PhysicalVehicle({id:'V',location:{kind:'STATION',id:'A',lat:null,lon:null,...loc('A1')}});
 assert.equal(new PhysicalVehicle(JSON.parse(JSON.stringify(v))).location.trackIdentity.id,'A1');
 assert.equal(new ServiceStop('A','arret',600,600,null,1,'',{lat:null,lon:null}).lat,null);
});
test('RC11-TRACK07 refreshing material specifications does not teleport a detached physical element',()=>{
 const rm=new RotationV2Manager();const r=new Rame({id:'R',elements:['D'],elementDetails:[{category:'locomotive',name:'D',power:1000,length:20,mass:80}],currentLocation:{stationId:'A',...loc('A1')}});
 const v=rm.materializeRameElement(r,0);v.location={kind:'STATION',id:'B',lat:48.01,lon:2,...loc('B1')};v.available=false;v._v2OperationOwnerServiceId='OWNER';v._v2BusyUntilEpoch=9999;
 r.elementDetails[0].power=2500;const refreshed=rm.materializeRameElement(r,0);assert.equal(refreshed,v);assert.equal(v.location.id,'B');assert.equal(v.location.trackIdentity.id,'B1');assert.equal(v.powerW,2500000);assert.equal(v.available,false);assert.equal(v._v2OperationOwnerServiceId,'OWNER');assert.equal(v._v2BusyUntilEpoch,9999);
});
test('RC11-TRACK08 V2 runtime refuses a formation parked on another physical track',()=>{
 const g=makeGame(),rec=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'tracks'}),{loco}=addDieselFormation(g,rot,rec);
 loco.location={kind:'STATION',id:'A',lat:48,lon:2,trackIdentity:osm('99'),platform:'other'};
 scoped(g,()=>g.scheduleV2Runtime.sync(1429,'2026-08-16'));
 assert.equal(g.scheduleCreator.services.length,0);assert.ok(g.scheduleV2Runtime.alerts.some(a=>a.code==='MATERIAL_TRACK_TRANSFER_REQUIRED'));
 assert.equal(loco.location.trackIdentity.id,'99');assert.equal(loco.available,true);
});
test('RC11-TRACK09 V2 runtime accepts a renamed but physically identical origin',()=>{
 const g=makeGame(),rec=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'tracks'}),{loco}=addDieselFormation(g,rot,rec);
 loco.location={kind:'STATION',id:'A',lat:48,lon:2,trackIdentity:osm('10'),platform:'renamed'};
 scoped(g,()=>g.scheduleV2Runtime.sync(1429,'2026-08-16'));
 assert.equal(g.scheduleCreator.services.length,1);assert.equal(g.scheduleCreator.services[0].stops[0].trackIdentity.id,'10');
});
test('RC11-TRACK10 legacy departure is blocked on the actual wrong track without moving the material',()=>{
 const f=fixture();f.s.state='waiting';f.s.currentStopIndex=0;f.s.position=null;f.s.stops[0].trackIdentity=osm('10');f.rame.currentLocation={stationId:'A',lat:48,lon:2,trackIdentity:osm('99')};
 scoped(f.game,()=>f.s.scheduleTick(600,'2026-09-11',f.game.economy));
 assert.notEqual(f.s.state,'moving');assert.equal(f.s.speed,0);assert.match(f.s.train.delayReason,/changement de voie/);assert.equal(f.rame.currentLocation.trackIdentity.id,'99');
});
test('RC11-TRACK11 returning duty cannot bypass the origin continuity guard',()=>{
 const f=fixture();f.s.state='stopped_at_station';f.s.isReturnLeg=true;f.s.currentStopIndex=0;f.s._nextDepartureTime=600;f.s.returnStops=[new ServiceStop('A','arret',600,600,null,'2','',{trackIdentity:osm('20')}),new ServiceStop('B','arret',630,630)];f.rame.currentLocation={stationId:'A',trackIdentity:osm('10')};
 const before={...f.s.position};scoped(f.game,()=>f.s.scheduleTick(600,'2026-09-11',f.game.economy));
 assert.equal(f.s.state,'stopped_at_station');assert.deepEqual(f.s.position,before);assert.equal(f.s._nextDepartureTime,600);assert.match(f.s.train.delayReason,/changement de voie/);
});
test('RC11-TRACK12 an implicit return uses the same physical tracks, including their exact coordinates',()=>{
 const f=fixture();for(const [i,s] of f.s.stops.entries()){s.trackIdentity=osm('w'+i,''+i);s.platform=''+(i+1);s.lat=48+i*.0003;s.lon=2;}
 const ret=f.s.buildReturnStops();for(let i=0;i<ret.length;i++){const original=f.s.stops.at(-1-i);assert.deepEqual(ret[i].trackIdentity,original.trackIdentity);assert.equal(ret[i].platform,original.platform);assert.equal(ret[i].lat,original.lat);}
});
test('RC11-TRACK13 compact legacy save/load and adjusted stops preserve physical identity',()=>{
 const f=fixture(),sc=new ScheduleCreator();sc.services=[f.s];f.s.stops[0].trackIdentity=osm('10','1');f.s.stops[0].lat=48;f.s.stops[0].lon=2;
 f.s._adjustedStops=f.s._buildAdjustedStops();const raw=sc.toSave();assert.equal(raw[0].st[0].ti.id,'10');assert.equal(raw[0]._r.as[0].ti.id,'10');
 const expanded=sc._expandCompactService(JSON.parse(JSON.stringify(raw[0])));const svc=new ActiveService(expanded,f.rame,f.world,null);
 assert.equal(svc.stops[0].trackIdentity.id,'10');assert.equal(svc.stops[0].lat,48);assert.equal(expanded._runtime._adjustedStops[0].trackIdentity.id,'10');
});
test('RC11-TRACK14 rebuilding a repeated trip preserves the selected track',()=>{
 const f=fixture();f.s.stops[0].trackIdentity=osm('10','1');f.s.stops[0].lat=48;f.s.stops[0].lon=2;
 const rebuilt=f.s._rebuildStopsFromTime(800);assert.equal(rebuilt[0].trackIdentity.id,'10');assert.equal(rebuilt[0].lat,48);
});

test('RC11-TRACK15 a real same-station HLP route transfers the locomotive between distinct tracks',()=>{
 const g=makeGame(),rec=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'HLP transfer'}),{loco}=addDieselFormation(g,rot,rec);
 g.world.tracks=[];const v=rec.currentVersion;v.locations[0].departureSec=36000;v.locations[1].stationId='A';v.locations[1].arrivalSec=36600;v.locations[1].departureSec=36600;v.locations[1].dwellSec=0;
 v.locations[1].track.lat=v.locations[1].track.snapLat=48;v.locations[1].track.lon=v.locations[1].track.snapLon=2.004;
 const route=[{lat:48,lon:2,maxSpeed:30,wayId:'10',electrified:false},{lat:48.001,lon:2.002,maxSpeed:30,wayId:'junction',electrified:false},{lat:48,lon:2.004,maxSpeed:30,wayId:'11',electrified:false}];v.outboundPath.legs[0].routePoints=route;v.outboundPath.routePoints=route;v.outboundPath.legs[0].distanceKm=.37;
 loco.location={kind:'STATION',id:'A',lat:48,lon:2,trackIdentity:osm('10')};
 scoped(g,()=>{
  g.scheduleV2Runtime.sync(599,'2026-08-16');const s=g.scheduleCreator.services[0];assert.ok(s,'physical transfer compiled');
  let visitedOtherPoint=false;
  for(let k=0;k<1800&&!s.completed;k++){
   const now=600+k/120;s.scheduleTick(now,'2026-08-16',null);s.moveUpdate(.5,now,g.scheduleCreator.services);
   if(s.position&&s.position.lon>2.0001&&s.position.lon<2.0039)visitedOtherPoint=true;
  }
  assert.ok(visitedOtherPoint,'real intermediary positions reached, not an instantaneous relocation');assert.equal(s.completed,true,JSON.stringify({state:s.state,reason:s.train.delayReason,pos:s.position,speed:s.speed,idx:s.currentStopIndex}));
  g.scheduleV2Runtime._finalizeServices('2026-08-16',615);
  assert.equal(loco.location.id,'A');assert.equal(loco.location.trackIdentity.id,'11');assert.equal(loco.available,true);assert.ok(Math.abs(loco.location.lon-2.004)<1e-6);
  assert.equal(g.scheduleV2Runtime._knownLocationMismatch(loco,{location:{stationId:'A',track:{wayId:'11'}}}),false);
  assert.equal(g.scheduleV2Runtime._knownLocationMismatch(loco,{location:{stationId:'A',track:{wayId:'10'}}}),true);
 });
});
test('RC11-TRACK16 cancellation on the line cannot relocate physical stock to its next booked station',()=>{
 const g=makeGame(),rec=addValidSchedule(g),rot=g.rotationV2.addRotation({name:'cancel'}),{loco}=addDieselFormation(g,rot,rec);
 scoped(g,()=>{g.scheduleV2Runtime.sync(1429,'2026-08-16');const s=g.scheduleCreator.services[0];s.currentStopIndex=1;s.state='cancelled';s.cancelled=true;s.position={lat:48.1,lon:2.1};s.train.stoppedAt=null;g.scheduleV2Runtime._finalizeServices('2026-08-17',15);
 assert.equal(loco.location.kind,'TECHNICAL');assert.equal(loco.location.lat,48.1);assert.notEqual(loco.location.id,'A');assert.notEqual(loco.location.id,'B');assert.equal(g.scheduleV2Runtime._knownLocationMismatch(loco,{location:{stationId:'B'}}),true);});
});
test('RC11-TRACK17 platform and departure-tail identity survive legacy runtime compaction',()=>{
 const f=fixture(),sc=new ScheduleCreator();sc.services=[f.s];f.s._platformAssignment={stationId:'A',platform:'@osm:10',source:'PLATFORM_MANAGER',trackIdentity:osm('10','1'),displayName:'name'};f.s._departureResourceHold={stationId:'A',platform:'@osm:10',platformSource:'PLATFORM_MANAGER',startTravelKm:0,trackIdentity:osm('10','1'),displayName:'name'};
 const rt=sc._expandCompactService(JSON.parse(JSON.stringify(sc.toSave()[0])))._runtime;
 assert.equal(rt.platformAssignment.trackIdentity.id,'10');assert.equal(rt.departureResourceHold.trackIdentity.id,'10');
});
