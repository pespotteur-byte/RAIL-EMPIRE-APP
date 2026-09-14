import test from 'node:test';
import assert from 'node:assert/strict';
import {mod,root,fixture,tick,atEndpoint,cantonManager,ActiveService} from './helpers/rc10-fixtures.mjs';
import {readFileSync} from 'node:fs';
import path from 'node:path';
// Execute the exact built method without the unrelated DOM bootstrap at module import.
const mainSource=readFileSync(path.join(root,'js/main.js'),'utf8');
const method=mainSource.slice(mainSource.indexOf('    moveTick(dt, timeOfDay) {'),mainSource.indexOf('    _forceV2RuntimeSyncNow() {'));
assert.ok(method.includes('runMacroCadence'));
const moveTick=new Function('return ({'+method+'}).moveTick')();
function snapshot(s){return {speed:s.speed,position:s.position,stop:s.currentStopIndex,state:s.state,completed:s.completed,distance:s.totalDistance,progress:s._state?.progress,index:s._state?.index,authority:s.train.movementAuthority,reason:s.train.delayReason,km:s.rame.totalKmRun,levels:s.rame.consumables};}
function run(mode,config,setup=()=>{}){const f=fixture(config);setup(f);for(let i=0;i<40;i++)tick(f.s,mode,f.game,.25);return snapshot(f.s);}
for(const [label,config,setup] of [
 ['normal',{speed:80},()=>{}],['station endpoint',{speed:80,kind:'arret'},f=>atEndpoint(f.s,f.routes[0])],
 ['passage',{speed:80,kind:'passage'},f=>atEndpoint(f.s,f.routes[0])],['uphill',{speed:80,grade:'30‰',power:100},()=>{}],
 ['unpowered',{speed:80,power:0},()=>{}],['empty fuel',{speed:80},f=>f.rame.consumables={fuelCapacityL:100,fuelL:0}],
 ['stop incident',{speed:80},f=>f.s.train.incident={id:'I',effect:'stop',name:'Obstacle',active:true}],
 ['maintenance',{speed:80},f=>f.rame.inMaintenance=true],
])test(`RC10-MOTION identical full/macro controller on ${label}`,()=>assert.deepEqual(run('full',config,setup),run('macro',config,setup)));
test('RC10-MOTION endpoint brake is applied once, not doubled by the macro controller',()=>{
 const f=fixture({speed:80,kind:'arret'});atEndpoint(f.s,f.routes[0]);tick(f.s,'full',f.game,.1);const full=f.s.speed;
 const m=fixture({speed:80,kind:'arret'});atEndpoint(m.s,m.routes[0]);tick(m.s,'macro',m.game,.1);assert.equal(m.s.speed,full);assert.ok(full<80&&full>79);
});
// The real game loop is retained; the material controllers are probes in these
// timing-only tests. This proves clock accounting, not physical train safety.
function cadence(){
 const f=fixture({speed:0}),g=f.game;g.cantonManager=cantonManager;g.depotManager={updateRescues(){}};g.incidentManager={checkTrainPositions(){}};g._streamNativeOSMViewport=()=>{};
 const original=f.s,route=f.routes[0],trains=Array.from({length:600},(_,i)=>({...original,id:'P'+i,position:{lat:48,lon:2},_state:{...original._state},_routeKey:'A>B',_macroElapsed:{medium:0,low:0},_lodDist:0,elapsed:0,calls:0,
 getCurrentRoute(){return route;},_currentFrontKm(){return i/100;},moveUpdate(dt){this.elapsed+=dt;this.calls++;},moveMacro(dt){this.elapsed+=dt;this.calls++;}}));
 g.scheduleCreator={services:trains,getActiveServices:()=>trains,getMovingServices:()=>trains};g._lastCantonCleanup=performance.now();globalThis.window={game:g};
 return {g,trains,step:(n=1)=>{for(let i=0;i<n;i++)moveTick.call(g,.1,600);}};
}
test('RC10-MOTION promotion flushes pending low-LOD time once, demotion cannot replay it',()=>{
 const {g,trains,step}=cadence();step(20);assert.ok(Math.abs(trains[0].elapsed-2)<1e-8);assert.equal(trains[0]._macroElapsed.low,0); // RC17: no camera-dependent debt
 g.scheduleCreator.getMovingServices=()=>trains.slice(0,400);step();assert.ok(Math.abs(trains[0].elapsed-2.1)<1e-8);assert.equal(trains[0]._macroElapsed.low,0);
 g.scheduleCreator.getMovingServices=()=>trains;step(30);assert.ok(Math.abs(trains[0].elapsed-5.1)<1e-8);
});
test('RC10-MOTION all-low 600 trains account for elapsed time plus pending time, without array-index dependence',()=>{
 const {g,trains,step}=cadence();step(19);g.scheduleCreator.services.reverse();step(28);for(const s of trains)assert.ok(Math.abs(s.elapsed+s._macroElapsed.low+s._macroElapsed.medium-4.7)<1e-8);
});
for(const mode of ['full','macro'])test(`RC10-MOTION shared line ${mode}: follower brakes behind an immobilised 750 m freight`,()=>{
 const {s:leader,game,world}=fixture({speed:0});
 const route=Array.from({length:251},(_,i)=>({lat:48+i*.001,lon:2,maxSpeed:100,maxSpeedSource:'OSM',electrified:true,wayId:'shared-line'}));
 world.stations[1].lat=48.25;leader.routes=[route];leader.stops=leader.stops.slice(0,2);leader.rame.totalLength=750;leader.currentStopIndex=1;
 leader.position={lat:48.05,lon:2};leader._initializeState(route,'1-0');leader._setRouteProgressKm(route,5);leader.speed=leader.train.speed=0;leader.train.incident={id:'BLOCK',effect:'stop',name:'Incident',active:true};
 const rame={...leader.rame,id:'FOLLOW_R',totalLength:750,totalPower:4000};
 const follower=new ActiveService({id:'FOLLOW',name:'Follower',serviceType:'fret',stops:leader.stops,routes:[route]},rame,world,null);
 follower.active=true;follower.state='moving';follower.currentStopIndex=1;follower.position={lat:48.005,lon:2};follower._initializeState(route,'1-0');follower._setRouteProgressKm(route,1);follower.speed=follower.train.speed=80;follower._economy=game.economy;follower._currentDate='2026-09-11';
 game.scheduleCreator.services=[leader,follower];const dt=mode==='full'?.1:3;
 for(let time=0;time<360;time+=dt){tick(leader,mode,game,dt);tick(follower,mode,game,dt);
  assert.ok(follower._currentFrontKm(route)<=leader._currentFrontKm(route)-.75+1e-6,`overlap ${mode} at ${time}s`);
 }
 assert.ok(follower.speed<1,`follower still moving at ${follower.speed}`);assert.ok(follower._currentFrontKm(route)>1);
});
