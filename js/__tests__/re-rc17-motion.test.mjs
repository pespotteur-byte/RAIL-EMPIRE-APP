import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,root,cantonManager} from './helpers/rc10-fixtures.mjs';
const source=fs.readFileSync(path.join(root,'js/main.js'),'utf8');
const a=source.indexOf('    moveTick(dt, timeOfDay) {'),b=source.indexOf('    _forceV2RuntimeSyncNow() {',a);
const moveTick=new Function('return ({'+source.slice(a,b)+'}).moveTick')();
function gameFixture(view){
 const f=fixture({speed:12}),g=f.game;
 const route=Array.from({length:201},(_,i)=>({lat:48+i*.001,lon:2,wayId:'main',maxSpeed:100,electrified:true}));
 f.world.stations[1].lat=48.2;f.s.routes=[route];f.s.stops=f.s.stops.slice(0,2);f.s.stops[1].type='arret';
 f.s._initializeState(route,'1-0');f.s._setRouteProgressKm(route,1);f.s._nearbyServices=[{id:'GHOST',position:{...f.s.position},speed:0}];
 const idle=Array.from({length:600},(_,i)=>({id:'P'+i,position:null,_state:null,state:'moving',_macroElapsed:{medium:0,low:0},moveMacro(){}}));
 const fleet=[f.s,...idle];g.scheduleCreator={services:fleet,getActiveServices:()=>fleet,getMovingServices:()=>fleet};
 g.cantonManager=cantonManager;g.depotManager={updateRescues(){}};g.incidentManager={checkTrainPositions(){}};g._streamNativeOSMViewport=()=>{};g._lastCantonCleanup=performance.now();
 const setView=v=>{g.renderer=v==='off'?null:{logicalWidth:1024,logicalHeight:768,tileMap:{zoomLevel:7,screenToWorld(x,y){const lat=v==='far'?60:48;return {lat:lat+(y-384)/400,lon:2+(x-512)/400};}}};};
 setView(view);return {...f,g,route,setView,step:(n=1)=>{for(let i=0;i<n;i++)moveTick.call(g,.1,606);}};
}
function run(view){const f=gameFixture(view);for(let i=0;i<600;i++){if(view==='switch'&&i%50===0)f.setView(i%100===0?'off':'near');f.step();}return {position:f.s.position,speed:f.s.speed,distance:f.s.totalDistance,effort:f.s._tractiveEffort};}
for(const view of ['off','far','switch'])test(`RC17 LM03 601 services: ${view} equals visible continuous physics`,()=>{
 const actual=run(view),expected=run('near');assert.deepEqual(actual,expected);assert.ok(actual.speed>30,'not stuck at 12 km/h');assert.ok(actual.distance>.3);
});
for(const issue of ['removed','changed-position','same-id-replacement'])test(`RC17 LM03 stale troncon ${issue} cannot hold current front`,()=>{
 const f=fixture({speed:12});const stale={id:'OLD',occupiedBy:'OTHER'};f.s._cachedTroncon=stale;f.s._cachedTronconTime=performance.now();let calls=0;
 f.game.voiePointManager={troncons:issue==='removed'?[]:[{...stale}],getTronconAtPosition(){calls++;return null;},releaseTroncon(){},releaseTronconReservation(){},getVoieAtPosition(){return null;}};
 const before=f.s.totalDistance;f.s.moveUpdate(.1,605,[f.s]);assert.ok(calls>0);assert.equal(f.s._cachedTroncon,null);assert.ok(f.s.totalDistance>before);assert.ok(f.s.speed>=12);
});
test('RC17 LM03 true current troncon conflict remains a stop authority',()=>{
 const f=fixture({speed:0});const real={id:'REAL',occupiedBy:'OTHER'};f.game.voiePointManager={troncons:[real],getTronconAtPosition:()=>real,isTronconOccupied:()=>true,checkCisaillement:()=>null,occupyTroncon:()=>false,releaseTroncon(){},releaseTronconReservation(){},getVoieAtPosition(){return null;}};
 const before={...f.s.position};f.s.moveUpdate(.1,605,[f.s]);assert.deepEqual(f.s.position,before);assert.equal(f.s.speed,0);assert.ok(f.s.train.blockedBy);
});
test('RC17 LM03 camera transitions never give a service a new multi-second physics step',()=>{
 const f=gameFixture('off');const sizes=[],original=f.s.moveUpdate.bind(f.s);f.s.moveUpdate=(dt,...args)=>{sizes.push(dt);return original(dt,...args);};f.s.moveMacro=(dt,time)=>{sizes.push(dt);return original(dt,time,f.g.scheduleCreator.services);};
 f.step(50);f.setView('near');f.step(50);f.setView('far');f.step(50);assert.equal(sizes.length,150);assert.ok(sizes.every(dt=>Math.abs(dt-.1)<1e-12));
});
