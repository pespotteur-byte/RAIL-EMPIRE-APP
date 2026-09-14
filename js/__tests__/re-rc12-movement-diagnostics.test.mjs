import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMovementDiagnostics} from '../movement-diagnostics.js';
function service(id,speed=80){return{id,name:'Train '+id,active:true,state:'moving',speed,position:{lat:48,lon:2},currentStopIndex:1,train:{speed,delayReason:'<incident>',movementAuthority:{status:'GO',speedLimitKmh:Infinity}},_state:{index:0,progress:.2,legKey:'1-0',cachedRoute:[{lat:48,lon:2,wayId:'w',maxSpeed:120},{lat:49,lon:2}]},_macroElapsed:{medium:0,low:2},rame:{id:'R',totalLength:750,totalMass:1400},stops:[{}, {stationId:'B',type:'arret',arrivalTime:660}]};}
test('RC12-DIAG: snapshot captures a slow train, its authority, route identity and pending LOD time',()=>{
 const s=service('A',12),d=buildMovementDiagnostics({running:true,timeOfDay:600,_currentDate:'2026-09-12',ui:{activePage:'staff'},scheduleCreator:{services:[s]}},1000);assert.equal(d.counts.slowMoving,1);assert.equal(d.services[0].speedKmh,12);assert.equal(d.services[0].pendingMacroSec.low,2);assert.equal(d.services[0].route.legKey,'1-0');assert.equal(d.services[0].route.expectedLegKey,'1-0');assert.equal(d.context.page,'staff');assert.equal(d.exportedAtMs,1000);
});
test('RC12-DIAG: no geometry, catalogue, account or storage payload is exported',()=>{
 const s=service('A');s._state.cachedRoute=Array.from({length:100000},()=>({lat:48,lon:2}));s.rame.secret='DO_NOT_EXPORT';const d=buildMovementDiagnostics({account:{name:'DO_NOT_EXPORT'},storage:{password:'DO_NOT_EXPORT'},world:{largeData:'DO_NOT_EXPORT'},scheduleCreator:{services:[s]}});const json=JSON.stringify(d);assert.ok(json.length<4000);assert.ok(!json.includes('DO_NOT_EXPORT'));assert.equal(d.services[0].route.pointCount,100000);
});
test('RC12-DIAG: bounded sample prioritizes blocked and slow services without dropping fleet counts',()=>{
 const list=Array.from({length:2000},(_,i)=>service('F'+i));list.push(service('SLOW',12));const blocked=service('BLOCKED',0);blocked.train.movementAuthority.status='STOP';list.push(blocked);const d=buildMovementDiagnostics({scheduleCreator:{services:list}},0,10);assert.equal(d.services.length,10);assert.equal(d.counts.active,2002);assert.equal(d.truncated,1992);assert.equal(d.services[0].id,'BLOCKED');assert.equal(d.services[1].id,'SLOW');
});
test('RC12-DIAG: modifying a diagnostic cannot modify the game',()=>{
 const s=service('A'),before=JSON.stringify(s),d=buildMovementDiagnostics({scheduleCreator:{services:[s]}});d.services[0].position.lat=0;d.services[0].route.key='changed';d.services[0].pendingMacroSec.low=999;assert.equal(JSON.stringify(s),before);
});
test('RC12-DIAG: finished/inactive services are counted but not presented as currently blocked',()=>{
 const list=[service('A'),{...service('B'),active:false},{...service('C'),completed:true},{...service('D'),cancelled:true}];const d=buildMovementDiagnostics({scheduleCreator:{services:list}});assert.equal(d.counts.total,4);assert.equal(d.counts.active,1);assert.equal(d.sampled,1);
});
test('RC12-DIAG: missing, malformed and cyclic irrelevant data do not break JSON export',()=>{
 const s=service('A');s.cycle=s;s.rame.cycle=s;const d=buildMovementDiagnostics({scheduleCreator:{services:[null,{},s]},depotManager:{activeRescues:[null,{id:'r',state:'routing',_routeAccessDenied:true,routeStatusMessage:'Refus'}]}});assert.doesNotThrow(()=>JSON.stringify(d));assert.equal(d.counts.invalidEntries,2);assert.equal(d.rescues[1].accessDenied,true);assert.equal(buildMovementDiagnostics(null).counts.total,0);
});
test('RC12-DIAG: non-finite telemetry becomes null rather than leaking misleading values',()=>{
 const s=service('A',NaN);s.position.lat=999;s._state.progress=Infinity;const d=buildMovementDiagnostics({scheduleCreator:{services:[s]}},NaN);assert.equal(d.services[0].speedKmh,null);assert.equal(d.services[0].position,null);assert.equal(d.services[0].route.progress,null);assert.equal(d.exportedAtMs,null);
});
test('RC12-DIAG: rescue sample and long names/messages are bounded',()=>{
 const s=service('x'.repeat(10000));s.train.delayReason='z'.repeat(10000);const d=buildMovementDiagnostics({scheduleCreator:{services:[s]},depotManager:{activeRescues:Array.from({length:150},(_,i)=>({id:String(i)}))}});assert.equal(d.services[0].id.length,180);assert.equal(d.services[0].delayReason.length,300);assert.equal(d.rescues.length,100);assert.equal(d.rescuesTruncated,50);
});
