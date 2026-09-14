import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers/rc10-fixtures.mjs';
const {DepotManager,Depot}=await mod('depot');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(findRoute=()=>[{lat:48,lon:2},{lat:48.01,lon:2}]){
 const manager=new DepotManager(),depot=new Depot({id:'D',stationId:'A',built:true,type:'depot',rescueLocos:[{stockId:'L1',traction:'diesel',deployed:false},{stockId:'L2',traction:'diesel',deployed:false}]});manager.depots=[depot];
 const world={getStationById:id=>id==='A'?{id:'A',lat:48,lon:2}:null};
 const broken={id:'BROKEN',position:{lat:48.01,lon:2},train:{breakdown:{type:'moteur'}},getCurrentRoute:()=>[{electrified:false},{electrified:false}]};
 const game={orm:{findRoute},depotManager:manager,scheduleCreator:{services:[broken]}};globalThis.window={game};
 return {manager,depot,world,broken,game,send:()=>manager.dispatchRescue(world,broken)};
}

test('RC12-RESCUE: duplicate incident/breakdown dispatch returns the same mission',async()=>{
 let calls=0;const f=setup(()=>{calls++;return [{lat:48,lon:2},{lat:48.01,lon:2}];});const first=f.send(),second=f.send();await flush();assert.equal(first,second);assert.equal(f.manager.activeRescues.length,1);assert.equal(calls,1);assert.equal(f.depot.rescueLocos.filter(x=>x.deployed).length,1);
});
test('RC12-RESCUE: synchronous route exception cannot escape or strand the in-flight flag',async()=>{
 const f=setup(()=>{throw Error('sync provider failure');});let r;assert.doesNotThrow(()=>r=f.send());await flush();assert.equal(r.state,'routing');assert.equal(r._routeRequestInFlight,false);assert.ok(r._routeRetrySec>=30);assert.match(r.routeStatusMessage,/sync provider failure/);
});
test('RC12-RESCUE: successful routing preserves every route point and detaches mutable input',async()=>{
 const route=[{lat:48,lon:2,wayId:'a',maxSpeed:30},{lat:48.005,lon:2,wayId:'a',electrified:false},{lat:48.01,lon:2,wayId:'b'}];const f=setup(()=>route),r=f.send();await flush();assert.equal(r.state,'en_route');assert.deepEqual(r.route,route);route[1].lat=0;assert.equal(r.route[1].lat,48.005);
});
for(const [label,route] of [
 ['invalid interior coordinate',[{lat:48,lon:2},{lat:NaN,lon:2},{lat:48.01,lon:2}]],
 ['synthetic interior connector',[{lat:48,lon:2},{lat:48.005,lon:2,synthetic:true},{lat:48.01,lon:2}]],
 ['wrong origin',[{lat:49,lon:2},{lat:48.01,lon:2}]],
 ['wrong destination',[{lat:48,lon:2},{lat:49,lon:2}]],
 ['single point',[{lat:48,lon:2}]],
 ['degenerate route',[{lat:48,lon:2},{lat:48,lon:2}]],
])test(`RC12-RESCUE: reject ${label} rather than falsely arriving`,async()=>{
 const f=setup(()=>route),r=f.send();await flush();assert.equal(r.state,'routing');assert.equal(r.route,null);assert.equal(r.speed,0);assert.ok(r._routeRetrySec>=30);
});
test('RC12-RESCUE: missing/invalid depot origin does not consume an available locomotive',()=>{
 const f=setup();f.world.getStationById=()=>null;assert.equal(f.send(),null);assert.ok(f.depot.rescueLocos.every(x=>!x.deployed));
});
test('RC12-RESCUE: invalid target coordinates do not allocate a mission',()=>{
 const f=setup();for(const p of [{lat:999,lon:2},{lat:NaN,lon:2},{lat:48,lon:Infinity},{lat:null,lon:2}]){f.broken.position=p;assert.equal(f.send(),null);}assert.equal(f.manager.activeRescues.length,0);
});
test('RC12-RESCUE: no second rescue is dispatched while the service is already in repair',()=>{
 const f=setup();f.manager.repairQueue=[{serviceId:'BROKEN'}];assert.equal(f.send(),null);assert.equal(f.manager.activeRescues.length,0);
});
test('RC12-RESCUE: a callback from before load cannot activate an obsolete mission',async()=>{
 let resolve;const f=setup(()=>new Promise(r=>resolve=r)),r=f.send();await flush();const save=JSON.parse(JSON.stringify(f.manager.toSave()));f.manager.loadFromSave(save);resolve([{lat:48,lon:2},{lat:48.01,lon:2}]);await flush();assert.equal(r.state,'routing');assert.equal(f.manager.activeRescues[0].state,'routing');assert.equal(f.manager.activeRescues[0]._routeRequestInFlight,false);
});
test('RC12-RESCUE: a target still braking during route acquisition invalidates that route',async()=>{
 let resolve;const f=setup(()=>new Promise(r=>resolve=r)),r=f.send();await flush();f.broken.position={lat:48.02,lon:2};resolve([{lat:48,lon:2},{lat:48.01,lon:2}]);await flush();assert.equal(r.state,'routing');assert.equal(r.route,null);assert.deepEqual(r.targetPosition,f.broken.position);
});
test('RC12-RESCUE: HTTP 403 stops automatic routing even after a large simulation delta',async()=>{
 let calls=0;const f=setup(()=>{calls++;throw Object.assign(Error('Forbidden'),{status:403});}),r=f.send();await flush();f.manager.updateRescues(100000);await flush();assert.equal(calls,1);assert.equal(r._routeAccessDenied,true);assert.equal(f.manager.resumeRescueRouting(r.id),false);assert.match(r.routeStatusMessage,/403/);
});
test('RC12-RESCUE: denial and wall-clock retry deadline survive save/load',async()=>{
 const f=setup(()=>{throw Object.assign(Error('Forbidden'),{status:403});}),r=f.send();await flush();const before=r._routeRetryAtMs;f.manager.loadFromSave(JSON.parse(JSON.stringify(f.manager.toSave())));const loaded=f.manager.activeRescues[0];assert.equal(loaded._routeAccessDenied,true);assert.equal(loaded._routeRetryAtMs,before);assert.ok(loaded._routeRetrySec>=900);assert.equal(f.manager.resumeRescueRouting(loaded.id),false);
});
test('RC12-RESCUE: manual retry is possible after the denial cooldown and only on explicit request',async()=>{
 let calls=0;const f=setup(()=>{calls++;if(calls===1)throw Object.assign(Error('denied'),{status:403});return [{lat:48,lon:2},{lat:48.01,lon:2}];}),r=f.send();await flush();r._routeRetryAtMs=Date.now()-1;r._routeRetrySec=0;f.manager.updateRescues(1);await flush();assert.equal(calls,1);assert.equal(f.manager.resumeRescueRouting(r.id),true);await flush();assert.equal(calls,2);assert.equal(r.state,'en_route');
});
test('RC12-RESCUE: Retry-After of a rate-limited provider is retained',async()=>{
 const f=setup(()=>{throw {status:429,response:{headers:{get:()=> '1200'}}};}),r=f.send();await flush();assert.ok(r._routeRetrySec>=1200);assert.equal(r._routeAccessDenied,false);f.manager.updateRescues(5000);await flush();assert.ok(r._routeRetryAtMs>Date.now());
});
test('RC12-RESCUE: a save snapshot is independent of later position/route movement',async()=>{
 const f=setup(),r=f.send();await flush();const snapshot=f.manager.toSave();r.position.lat=49;r.route[0].lat=50;r.targetPosition.lon=3;assert.equal(snapshot.activeRescues[0].position.lat,48);assert.equal(snapshot.activeRescues[0].route[0].lat,48);assert.equal(snapshot.activeRescues[0].targetPosition.lon,2);
});
test('RC12-RESCUE: restoring a malformed route refuses the whole path rather than bridging its gap',async()=>{
 const f=setup(),r=f.send();await flush();const save=JSON.parse(JSON.stringify(f.manager.toSave()));save.activeRescues[0].route.splice(1,0,{lat:null,lon:2});f.manager.loadFromSave(save);const loaded=f.manager.activeRescues[0];assert.equal(loaded.route,null);assert.equal(loaded.state,'routing');assert.equal(loaded.speed,0);
});
test('RC12-RESCUE: recovering with a missing timer requires the full default five minutes',async()=>{
 const f=setup(),r=f.send();await flush();r.state='recovering';r.position={...r.targetPosition};delete r._recoverTimer;f.manager.updateRescues(1);assert.equal(r.state,'recovering');assert.ok(r._recoverTimer>4.9);
});
test('RC12-RESCUE: non-finite or negative time cannot poison the route position/speed',async()=>{
 const f=setup(),r=f.send();await flush();const before=JSON.stringify(r);for(const dt of [NaN,Infinity,-Infinity,-1,0])f.manager.updateRescues(dt);assert.equal(JSON.stringify(r),before);
});
test('RC12-RESCUE: moving target at the end of the outbound route requires a new leg',async()=>{
 const f=setup(),r=f.send();await flush();f.broken.position={lat:48.02,lon:2};r.position={lat:48.0099,lon:2};r.speed=10;f.manager.updateRescues(10);assert.equal(r.state,'routing');assert.equal(r.speed,0);assert.equal(r.route,null);assert.equal(r.targetPosition.lat,48.02);
});
test('RC12-RESCUE: target movement interrupts an already started recovery timer',async()=>{
 const f=setup(),r=f.send();await flush();r.state='recovering';r.position={lat:48.01,lon:2};r._recoverTimer=2;f.broken.position={lat:48.02,lon:2};f.manager.updateRescues(60);assert.equal(r.state,'routing');assert.equal(r._recoverTimer,5);assert.equal(f.manager.repairQueue.length,0);
});
test('RC12-RESCUE: missing or null restored recovery duration does not instantly complete',async()=>{
 const f=setup(),r=f.send();await flush();const data=JSON.parse(JSON.stringify(f.manager.toSave()));data.activeRescues[0].state='recovering';data.activeRescues[0].position={lat:48.01,lon:2};data.activeRescues[0]._recoverTimer=null;f.manager.loadFromSave(data);f.manager.updateRescues(1);assert.equal(f.manager.activeRescues[0].state,'recovering');assert.ok(f.manager.activeRescues[0]._recoverTimer>4.9);
});
test('RC12-RESCUE: corrupted large route index cannot finish a mission still at origin',async()=>{
 const f=setup(),r=f.send();await flush();const data=JSON.parse(JSON.stringify(f.manager.toSave()));data.activeRescues[0].routeIndex=99999;f.manager.loadFromSave(data);assert.equal(f.manager.activeRescues[0].state,'routing');assert.equal(f.manager.activeRescues[0].routeIndex,0);assert.equal(f.manager.repairQueue.length,0);
});
test('RC12-RESCUE: duplicate restored targets free the unused second locomotive',async()=>{
 const f=setup(),r=f.send();await flush();const data=JSON.parse(JSON.stringify(f.manager.toSave()));data.activeRescues.push({...data.activeRescues[0],id:'rescue-999',stockId:'L2'});f.manager.loadFromSave(data);assert.equal(f.manager.activeRescues.length,1);assert.equal(f.manager.depots[0].rescueLocos.find(l=>l.stockId==='L2').deployed,false);
});
test('RC12-RESCUE: completed missions in an old save no longer reserve their locomotives',async()=>{
 const f=setup(),r=f.send();await flush();const data=JSON.parse(JSON.stringify(f.manager.toSave()));data.activeRescues[0].state='done';f.manager.loadFromSave(data);assert.equal(f.manager.activeRescues.length,0);assert.ok(f.manager.depots[0].rescueLocos.every(l=>!l.deployed));
});
test('RC12-RESCUE: return route obeys the same endpoint validation as the outbound route',async()=>{
 const f=setup(),r=f.send();await flush();r.state='recovering';r.position={lat:48.01,lon:2};r._recoverTimer=0;f.manager.updateRescues(1);await flush();assert.equal(r.state,'routing_return');assert.equal(r.returnRoute,null);assert.equal(f.manager.repairQueue.length,0);
});
test('RC12-RESCUE: map descriptors expose routing reason and manual retry eligibility',async()=>{
 const f=setup(()=>{throw {status:403};}),r=f.send();await flush();let card=f.manager.getRescueServices()[0];assert.match(card.train.delayReason,/403/);assert.equal(card.rescueCanRetry,false);r._routeRetryAtMs=Date.now()-1;card=f.manager.getRescueServices()[0];assert.equal(card.rescueCanRetry,true);
});
