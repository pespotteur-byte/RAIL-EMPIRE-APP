import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,fixture} from './helpers/rc10-fixtures.mjs';
const {DepotManager,Depot}=await mod('depot');
const {ScheduleV2Runtime}=await mod('schedule-v2-runtime');
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function setup(){
 const f=fixture({speed:0}),manager=new DepotManager();
 const depot=new Depot({id:'D',stationId:'A',built:true,type:'depot',tracks:2,rescueLocos:[{stockId:'L',stockName:'Diesel',traction:'diesel'}]});
 manager.depots=[depot];f.game.depotManager=manager;
 // RC17 requires real traction inputs rather than the previous hardcoded 2 km/h/s.
 f.game.rollingStock={getById:id=>id==='L'?{id:'L',name:'Diesel',category:'locomotive',traction:'diesel',power:2400,mass:84,length:20,maxSpeed:100}:null};
 f.game.rameManager={getById:id=>id===f.rame.id?f.rame:null};
 f.game.orm={findRoute:(lat,lon,toLat,toLon)=>[{lat,lon,wayId:'r'},{lat:(lat+toLat)/2,lon:lon+.001,wayId:'r'},{lat:toLat,lon:toLon,wayId:'r'}]};
 f.s.train.breakdown={type:'moteur'};
 const start=async()=>{const r=manager.dispatchRescue(f.world,f.s);await flush();r.position={...f.s.position};r.state='recovering';r._recoverTimer=0;manager.updateRescues(.1);await flush();return r;};
 return {...f,manager,depot,start};
}
async function finish(f,r){for(let n=0;n<1000&&r.state!=='done';n++)f.manager.updateRescues(1);assert.equal(r.state,'done',r.routeStatusMessage);}
test('RC15-TOW return physically updates the broken train at intermediate positions',async()=>{
 const f=setup(),origin={...f.s.position},r=await f.start();assert.equal(r.state,'returning');assert.equal(r.towAttached,true);
 for(let n=0;n<12;n++){f.manager.updateRescues(1);assert.deepEqual(f.s.position,r.position);assert.notEqual(f.s.position,r.position);assert.equal(f.s.train.speed,Math.round(r.speed));}
 assert.notDeepEqual(f.s.position,origin);assert.notDeepEqual(f.s.position,r.depotPosition);assert.equal(f.s.train.state,'remorqué');
});
test('RC15-TOW coupled service cannot also run its own physics or schedule',async()=>{
 const f=setup(),r=await f.start();f.manager.updateRescues(1);const before=JSON.stringify({position:f.s.position,speed:f.s.speed,stop:f.s.currentStopIndex,distance:f.s.totalDistance});
 f.s.moveUpdate(3,606,[f.s]);f.s.scheduleTick(606,'2026-09-12',f.game.economy);
 assert.equal(JSON.stringify({position:f.s.position,speed:f.s.speed,stop:f.s.currentStopIndex,distance:f.s.totalDistance}),before);assert.equal(f.manager.ownsServiceMovement(f.s.id),true);
});
test('RC15-TOW successful delivery parks material before queuing exactly one repair',async()=>{
 const f=setup(),r=await f.start();await finish(f,r);
 assert.equal(f.rame.currentLocation.depotId,'D');assert.ok(f.depot.findRameTrack('R'));assert.equal(f.rame.inMaintenance,true);
 assert.equal(f.s.position,null);assert.equal(f.s.cancelled,true);assert.equal(f.s.completed,true);assert.equal(f.s.train.inDepot,true);
 assert.equal(f.manager.repairQueue.length,1);assert.equal(f.manager.repairQueue[0].rameId,'R');assert.equal(f.manager.activeRescues.length,0);assert.equal(f.depot.rescueLocos[0].deployed,false);
 f.manager.updateRescues(1000);assert.equal(f.manager.repairQueue.length,1);
});
test('RC15-TOW full depot keeps the whole convoy and rescue locomotive held',async()=>{
 const f=setup(),r=await f.start();for(const slot of f.depot.trackOccupancy)slot.rameId='occupied-'+slot.track;
 for(let n=0;n<350;n++)f.manager.updateRescues(1);
 assert.equal(r.state,'returning');assert.equal(r.speed,0);assert.equal(f.s.cancelled,undefined);assert.match(r.routeStatusMessage,/complet/);assert.equal(f.manager.repairQueue.length,0);assert.equal(f.depot.rescueLocos[0].deployed,true);assert.deepEqual(f.s.position,r.position);
 f.depot.trackOccupancy[0].rameId='';await finish(f,r);assert.equal(f.manager.repairQueue.length,1);
});
test('RC15-TOW missing target cannot be magically delivered or free the locomotive',async()=>{
 const f=setup(),r=await f.start();const old={...r.position};f.game.scheduleCreator.services=[];f.manager.updateRescues(1000);
 assert.deepEqual(r.position,old);assert.equal(r.speed,0);assert.equal(r.state,'returning');assert.equal(f.manager.repairQueue.length,0);assert.equal(f.depot.rescueLocos[0].deployed,true);
});
test('RC15-TOW an un-stopped target is not attached when the timer expires',async()=>{
 const f=setup(),r=f.manager.dispatchRescue(f.world,f.s);await flush();r.state='recovering';r.position={...f.s.position};r._recoverTimer=0;f.s.speed=3;f.manager.updateRescues(1);await flush();
 assert.equal(r.state,'recovering');assert.notEqual(r.towAttached,true);assert.match(r.routeStatusMessage,/immobilisé/);
});
test('RC15-TOW save/load keeps ownership, route and material mileage without double counting',async()=>{
 const f=setup(),r=await f.start();f.manager.updateRescues(7);const before=f.rame.totalKmRun,saved=JSON.parse(JSON.stringify(f.manager.toSave()));
 f.manager.loadFromSave(saved);const restored=f.manager.activeRescues[0];assert.equal(restored.towAttached,true);assert.equal(restored.towRameId,'R');assert.equal(f.manager.ownsServiceMovement('S'),true);
 f.s.moveUpdate(7,606,[f.s]);assert.equal(f.rame.totalKmRun,before);f.manager.updateRescues(1);assert.ok(f.rame.totalKmRun>before);assert.deepEqual(f.s.position,restored.position);
});
test('RC15-TOW migration never teleports an old unaccompanied return onto its target',async()=>{
 const f=setup(),r=await f.start();r.towAttached=false;r.position={lat:48.001,lon:2};const pos={...f.s.position};f.manager.updateRescues(1);
 assert.equal(r.state,'routing');assert.deepEqual(f.s.position,pos);assert.deepEqual(r.targetPosition,pos);assert.equal(f.manager.repairQueue.length,0);
});
test('RC15-TOW rescue distance affects odometers, not booked service distance or fuel',async()=>{
 const f=setup();f.rame.consumables={fuelCapacityL:100,fuelL:42};const r=await f.start(),oldServiceKm=f.s.totalDistance,oldMaterialKm=f.rame.totalKmRun||0;
 f.manager.updateRescues(10);assert.ok(f.rame.totalKmRun>oldMaterialKm);assert.equal(f.s.totalDistance,oldServiceKm);assert.equal(f.rame.consumables.fuelL,42);assert.ok(r.towDistanceKm>0);
});
test('RC15-TOW repair cannot resume a cancelled service on its old timetable geometry',async()=>{
 const f=setup(),r=await f.start();await finish(f,r);f.s.resumeAfterRepair();assert.equal(f.s.cancelled,true);assert.equal(f.s.position,null);assert.equal(f.s.state,'cancelled');assert.equal(f.rame.currentLocation.depotId,'D');
});
test('RC15-TOW completed V2 rescue is persisted independently of the active repair timer',async()=>{
 const f=setup();f.s.id='v2:ROT:OCC:2026-09-12';f.s._v2OccurrenceId='OCC';const r=await f.start();await finish(f,r);
 assert.equal(f.manager.hasRescuedOccurrence(f.s.id),true);const save=JSON.parse(JSON.stringify(f.manager.toSave()));f.manager.loadFromSave(save);assert.equal(f.manager.hasRescuedOccurrence(f.s.id),true);
});
test('RC15-TOW detached snapshots of queued vehicle IDs and mission metadata',async()=>{
 const f=setup(),r=await f.start();r.towVehicleIds=['V'];const save=f.manager.toSave();r.towVehicleIds.push('X');assert.deepEqual(save.activeRescues[0].towVehicleIds,['V']);
});
test('RC15-TOW attached V2 snapshots remain exact while a mission owns the train',()=>{
 const f=setup(),runtime=new ScheduleV2Runtime(f.game);f.manager.activeRescues=[{id:'RESCUE',targetServiceId:'v2:R:O:2026-09-12',towAttached:true,state:'returning'}];
 const plan={startSec:0,endSec:1},snap={id:'v2:R:O:2026-09-12',state:'moving',delay:0};
 assert.equal(runtime._snapshotCanRestore(plan,snap,36000),true);assert.equal(runtime._snapshotCanExactRestore(plan,snap,36000),true);
});

test('RC15-TOW restore uses the diversion geometry, never the old scheduled leg',async()=>{
 const f=setup(),r=await f.start();f.manager.updateRescues(10);const expected={...r.position},runtime=new ScheduleV2Runtime(f.game);
 runtime._pendingSnapshots.set(f.s.id,{id:f.s.id,state:'moving',position:expected,speed:r.speed,currentStopIndex:1,stateIndex:r.routeIndex,stateProgress:0.2,vehicleIds:[],train:{breakdown:{type:'moteur'}}});
 assert.equal(runtime._restoreSnapshot(f.s,606),true);assert.equal(f.s._state.cachedRoute,r.returnRoute);assert.notEqual(f.s._state.cachedRoute,f.s.getCurrentRoute());assert.deepEqual(f.s.position,expected);assert.equal(f.s.train.state,'remorqué');assert.equal(f.s.train.movementAuthority.code,'RESCUE_TOW');
});
test('RC15-TOW rotation composition operations are frozen while the rescue owns the train',async()=>{
 const f=setup(),r=await f.start(),runtime=new ScheduleV2Runtime(f.game);let calls=0;
 f.s._v2OperationState={locationOccurrenceId:'X',windowStartRelSec:0,entries:[{actionId:'A',started:true,actualEndRelSec:1,applied:false}]};runtime._applyOneOperationAction=()=>{calls++;return true;};
 runtime._tickOperationState(f.s,{rotation:{actions:[{id:'A'}]}},100000);assert.equal(calls,0);assert.equal(f.s._v2OperationState.entries[0].applied,false);assert.equal(r.towAttached,true);
});
test('RC15-TOW missing registered material or a deleted depot stops before either position moves',async()=>{
 const f=setup(),r=await f.start(),before={...r.position};f.depot.built=false;f.manager.updateRescues(500);assert.deepEqual(r.position,before);assert.deepEqual(f.s.position,before);assert.equal(r.speed,0);assert.equal(f.manager.repairQueue.length,0);
});
test('RC15-TOW changed consist is not silently replaced halfway through a rescue',async()=>{
 const f=setup(),r=await f.start(),before={...r.position};f.s._v2DirectRameId='OTHER';f.manager.updateRescues(500);assert.deepEqual(r.position,before);assert.equal(r.speed,0);assert.match(r.routeStatusMessage,/incohérente/);assert.equal(f.manager.repairQueue.length,0);
});
test('RC15-TOW a displaced attached target is not teleported to the rescue',async()=>{
 const f=setup(),r=await f.start(),before={...r.position};f.s.position={lat:49,lon:3};f.manager.updateRescues(500);assert.deepEqual(r.position,before);assert.deepEqual(f.s.position,{lat:49,lon:3});assert.equal(r.speed,0);assert.equal(f.manager.repairQueue.length,0);
});
test('RC15-TOW depot exit is blocked during emergency repair, including after queue reload',async()=>{
 const f=setup(),r=await f.start();await finish(f,r);const saved=JSON.parse(JSON.stringify(f.manager.toSave()));f.manager.loadFromSave(saved);assert.equal(f.manager.leaveRame('D',f.rame).ok,false);assert.equal(f.rame.currentLocation.depotId,'D');
 f.manager.getDepotById('D').addPart('engine_generic',1);const result=f.manager.updateRepairs(30);assert.equal(result.repaired.length,1);assert.equal(result.repaired[0].rameId,'R');f.rame.inMaintenance=false;f.s.resumeAfterRepair();assert.equal(f.s.train.inMaintenance,false);assert.equal(f.s.cancelled,true);assert.equal(f.manager.leaveRame('D',f.rame).ok,true);
});
test('RC15-TOW repairing without spare parts never releases the material',async()=>{
 const f=setup(),r=await f.start();await finish(f,r);f.depot.spareParts={};const result=f.manager.updateRepairs(1000);assert.equal(result.repaired.length,0);assert.equal(f.manager.leaveRame('D',f.rame).ok,false);assert.equal(f.manager.repairQueue.length,1);
});
test('RC15-TOW actual outbound, five-minute intervention, return and repair lifecycle',async()=>{
 const f=setup(),r=f.manager.dispatchRescue(f.world,f.s);await flush();const origin={...f.s.position};let elapsed=0;for(;elapsed<500&&r.state!=='recovering';elapsed++)f.manager.updateRescues(1);
 assert.equal(r.state,'recovering');assert.deepEqual(f.s.position,origin);assert.notEqual(r.towAttached,true);const duration=r._recoverTimer*60;assert.ok(duration>=299);f.manager.updateRescues(duration-1);assert.equal(r.state,'recovering');f.manager.updateRescues(1);await flush();assert.equal(r.towAttached,true);await finish(f,r);assert.equal(f.s.cancelled,true);assert.equal(f.rame.currentLocation.depotId,'D');assert.equal(f.manager.repairQueue.length,1);
});
test('RC15-TOW the actual main load reconciliation keeps emergency repair flags and depot coordinates',async()=>{
 const {readFileSync}=await import('node:fs');const {root}=await import('./helpers/rc10-fixtures.mjs');const source=readFileSync(root+'/js/main.js','utf8');const a=source.indexOf('        {\n            const queued = new Set('),b=source.indexOf('        if (s.activeIncidents)',a);assert.ok(a>=0&&b>a);
 const reconcile=new Function(source.slice(a,b));const f=setup(),r=await f.start();await finish(f,r);const position={...f.rame.currentLocation};f.rame.inMaintenance=false;f.game.rameManager.getAll=()=>[f.rame];reconcile.call(f.game);assert.equal(f.rame.inMaintenance,true);assert.equal(f.rame.currentLocation.lat,position.lat);assert.equal(f.rame.currentLocation.lon,position.lon);
});

async function physicalV2(){
 const {makeGame,addValidSchedule,addDieselFormation}=await import('./re-rc2-fixtures.mjs');const {RameManager}=await mod('rame');
 const game=makeGame();game.world.tracks=[];const rec=addValidSchedule(game),rot=game.rotationV2.addRotation({name:'Physical rescue'}),{loco,occ}=addDieselFormation(game,rot,rec);
 globalThis.window={game};game.rameManager=new RameManager();game.depotManager=new DepotManager();const depot=new Depot({id:'D',stationId:'A',built:true,type:'depot',tracks:2,rescueLocos:[{stockId:'L',stockName:'Rescue diesel',traction:'diesel'}]});game.depotManager.depots=[depot];
 game.rollingStock={getById:id=>id==='L'?{id:'L',name:'Diesel',category:'locomotive',traction:'diesel',power:2400,mass:84,length:20,maxSpeed:100}:null};
 game.orm={findRoute:(lat,lon,toLat,toLon)=>[{lat,lon,wayId:'r'},{lat:(lat+toLat)/2,lon:lon+.001,wayId:'r'},{lat:toLat,lon:toLon,wayId:'r'}]};
 game.scheduleV2Runtime.sync(1430,'2026-09-12');assert.equal(game.scheduleCreator.services.length,1,JSON.stringify(game.scheduleV2Runtime.alerts));const s=game.scheduleCreator.services[0];s.position={lat:48.005,lon:2};s.state='moving';s.currentStopIndex=1;s.speed=s.train.speed=0;s.train.breakdown={type:'moteur'};
 const r=game.depotManager.dispatchRescue(game.world,s);await flush();r.position={...s.position};r.state='recovering';r._recoverTimer=0;game.depotManager.updateRescues(.1);await flush();
 return {game,rec,rot,loco,occ,s,r,manager:game.depotManager,depot};
}
test('RC15-TOW true V2 individual vehicles are parked durably without creating a duplicate rame',async()=>{
 const f=await physicalV2(),beforeIds=f.game.rotationV2.vehicles.map(v=>v.id);await finish(f,f.r);assert.equal(f.game.rameManager.rames.length,0);assert.deepEqual(f.game.rotationV2.vehicles.map(v=>v.id),beforeIds);assert.equal(f.loco.location.kind,'DEPOT');assert.equal(f.loco.location.id,'D');assert.equal(f.loco.available,false);
 const groups=f.manager.getRescuedFormations('D');assert.equal(groups.length,1);assert.deepEqual(groups[0].vehicleIds,[f.loco.id]);assert.equal(groups[0].repairing,true);assert.ok(f.depot.findRameTrack(groups[0].id));
 const saved=JSON.parse(JSON.stringify(f.manager.toSave()));f.manager.loadFromSave(saved);assert.deepEqual(f.manager.getRescuedFormations('D'),groups);assert.equal(f.manager.isVehicleUnderRepair(f.loco.id),true);
});
test('RC15-TOW actual V2 snapshot restores the diverted route, vehicle IDs and busy ownership',async()=>{
 const f=await physicalV2();f.manager.updateRescues(10);const before={...f.s.position},saved=f.game.scheduleV2Runtime.toSave(),depotSave=f.manager.toSave();
 f.game.scheduleCreator.services=[];f.game.scheduleCreator._invalidateActiveCache();f.manager.loadFromSave(JSON.parse(JSON.stringify(depotSave)));f.game.scheduleV2Runtime.loadFromSave(JSON.parse(JSON.stringify(saved)));f.game.scheduleV2Runtime.sync(1431,'2026-09-12');
 assert.equal(f.game.scheduleCreator.services.length,1,JSON.stringify(f.game.scheduleV2Runtime.alerts));const restored=f.game.scheduleCreator.services[0];assert.deepEqual(restored.position,before);assert.equal(restored._state.cachedRoute,f.manager.activeRescues[0].returnRoute);assert.deepEqual(restored._v2VehicleIds,[f.loco.id]);assert.equal(f.loco.available,false);f.manager.updateRescues(1);assert.notDeepEqual(restored.position,before);
});
test('RC15-TOW cancelled V2 occurrence is not compiled again after rescue and reload',async()=>{
 const f=await physicalV2();await finish(f,f.r);const id=f.s.id,save=JSON.parse(JSON.stringify(f.manager.toSave()));f.game.scheduleCreator.services=[];f.game.scheduleCreator._invalidateActiveCache();f.manager.loadFromSave(save);f.game.scheduleV2Runtime.loadFromSave({schemaVersion:1,services:[]});f.game.scheduleV2Runtime.sync(1432,'2026-09-12');assert.equal(f.game.scheduleCreator.services.some(s=>s.id===id),false);assert.equal(f.loco.location.id,'D');
});
test('RC15-TOW runtime cannot reset availability for an individually repaired engine',async()=>{
 const f=await physicalV2();await finish(f,f.r);f.loco.available=true;const plan={rotation:f.rot,occ:f.occ,locations:[{location:{technicalLocationId:'D',track:{snapLat:48,snapLon:2}}}],baseDate:'2026-09-12',startSec:86000};const result=f.game.scheduleV2Runtime._usableMembers(plan,null,'new-duty');assert.equal(result.notReady,true);assert.equal(f.loco.available,false);assert.equal(result.members.length,0);assert.ok(f.game.scheduleV2Runtime.alerts.some(a=>a.code==='MATERIAL_EMERGENCY_REPAIR'));
});
test('RC15-TOW physical formation bay is released only after repair and an actual new location',async()=>{
 const f=await physicalV2();await finish(f,f.r);const id=f.manager.getRescuedFormations('D')[0].id;f.manager.reconcileRescuedFormations();assert.ok(f.depot.findRameTrack(id));f.depot.addPart('engine_generic',1);assert.equal(f.manager.updateRepairs(30).repaired.length,1);
 f.manager.reconcileRescuedFormations();assert.ok(f.depot.findRameTrack(id));f.loco.location={kind:'STATION',id:'B',lat:48.2,lon:2.2};f.manager.reconcileRescuedFormations();assert.equal(f.manager.getRescuedFormations('D').length,0);assert.equal(f.depot.findRameTrack(id),null);
});
test('RC15-TOW malformed or duplicate parked formation records do not create additional bays',async()=>{
 const f=await physicalV2();await finish(f,f.r);const save=JSON.parse(JSON.stringify(f.manager.toSave()));save.rescuedFormations.push({...save.rescuedFormations[0]},null,{id:'fake',depotId:'D',vehicleIds:[f.loco.id]});f.manager.loadFromSave(save);assert.equal(f.manager.getRescuedFormations('D').length,1);assert.equal(f.manager.getDepotOccupancy('D').used,1);
});
