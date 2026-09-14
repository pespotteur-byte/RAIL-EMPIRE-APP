import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ActiveService,tick} from './helpers/rc10-fixtures.mjs';
function setup(reverse=false){
 const f=fixture({speed:30}),s=f.s;
 const route=Array.from({length:101},(_,i)=>({lat:48+i*.001,lon:2,wayId:'shared',maxSpeed:100,electrified:true}));
 s.routes=[route];s.stops=s.stops.slice(0,2);s._initializeState(route,'1-0');s._setRouteProgressKm(route,1);
 const r=reverse?route.slice().reverse():route;
 const other=new ActiveService({id:'OTHER',stops:s.stops,routes:[r]}, {...f.rame,id:'R2',totalLength:20},f.world,null);
 other.active=true;other.state='moving';other.currentStopIndex=1;other.position={...r[0]};other._initializeState(r,'1-0');
 other._setRouteProgressKm(r,reverse?other._state.cumDist[0]-1.05:1.05);other.speed=other.train.speed=0;
 s._nearbyServices=[other];f.game.scheduleCreator.services=[s,other];
 return {...f,other,route};
}
for(const reverse of [false,true]) test(`RC16 stale ${reverse?'opposing':'leader'} removed from fleet cannot hold a service`,()=>{
 const f=setup(reverse);f.game.scheduleCreator.services=[f.s];
 assert.equal(reverse?f.s._ipcsBlockCheck([f.s]):f.s._proximityBlockCheck([f.s]),null);
});
for(const grid of [false,true]) test(`RC16 replacement with same ID uses the new object, stale grid=${grid}`,()=>{
 const f=setup();const live=Object.assign(Object.create(Object.getPrototypeOf(f.other)),f.other,{position:{lat:60,lon:2}});
 if(grid)f.game._serviceGrid=new Map([['2400,100',[f.other]]]);
 f.game.scheduleCreator.services=[f.s,live];assert.equal(f.s._proximityBlockCheck(f.game.scheduleCreator.services),null);
});
test('RC16 empty authoritative fleet ignores an old cached neighbour',()=>{const f=setup();assert.deepEqual(f.s._safetyCandidatePool([],6),[]);});
test('RC16 new obstacle is not hidden by a populated obsolete spatial grid',()=>{const f=setup();f.s._nearbyServices=[];f.game._serviceGrid=new Map([['0,0',[{id:'DEAD'}]]]);assert.notEqual(f.s._proximityBlockCheck([f.s,f.other]),null);});
test('RC16 mid-frame array replacement invalidates candidate membership',()=>{
 const f=setup(),fleet=[f.s,f.other];f.game._safetyFleetFrame={services:fleet,length:2,members:new Map([[f.s,0],[f.other,1]])};
 f.game._serviceGrid=new Map([['2400,100',[f.other]]]);fleet[1]={...f.other,position:{lat:60,lon:2}};
 assert.equal(f.s._proximityBlockCheck(fleet),null);
});
test('RC16 current stopped train is still protected after removing ghosts',()=>{const f=setup();assert.notEqual(f.s._proximityBlockCheck([f.s,f.other]),null);});
for(const mode of ['full','macro'])test(`RC16 ${mode} train resumes actual progress after cached obstacle removal`,()=>{
 const f=setup();f.game.scheduleCreator.services=[f.s];const start=f.s._currentFrontKm(f.route);
 for(let n=0;n<40;n++)tick(f.s,mode,f.game,.25);
 assert.ok(f.s._currentFrontKm(f.route)>start+.07);assert.ok(f.s.speed>30,`still held at ${f.s.speed}`);
});

test('RC16 proximity broad phase skips impossible parallel projections, never a real leader',()=>{
 const {s,game,routes}=fixture({speed:80});
 const route=Array.from({length:201},(_,i)=>({lat:48,lon:2+i*.001,wayId:'same',maxSpeed:100}));
 s.position={lat:48,lon:2};s._initializeState(route,'1-0');
 const others=Array.from({length:20},(_,i)=>({id:'other'+i,state:'moving',position:{lat:48+.002+i*.001,lon:2.01},speed:0,train:{speed:0},_state:{cachedRoute:route,index:0},rame:{totalLength:100}}));
 game.scheduleCreator.services=[s,...others];let projections=0;const original=s._projectRoutePosition.bind(s);s._projectRoutePosition=(...args)=>{projections++;return original(...args);};
 assert.equal(s._findPhysicalLeader(game.scheduleCreator.services,route,6),null);assert.equal(projections,1);
 others[0].position={lat:48,lon:2.01};assert.equal(s._findPhysicalLeader(game.scheduleCreator.services,route,6)?.service,others[0]);
});
test('RC16 proximity broad phase is not retained across an in-place route edit',()=>{
 const {s,game}=fixture({speed:80});const route=Array.from({length:20},(_,i)=>({lat:48,lon:2+i*.001,wayId:'same',maxSpeed:100}));s.position={lat:48,lon:2};s._initializeState(route,'1-0');
 const others=Array.from({length:5},(_,i)=>({id:'mutate'+i,state:'moving',position:{lat:48.003+i*.001,lon:2.01},speed:0,train:{speed:0},_state:{cachedRoute:route,index:0},rame:{totalLength:100}}));
 game.scheduleCreator.services=[s,...others];assert.equal(s._findPhysicalLeader(game.scheduleCreator.services,route,6),null);
 for(const point of route)point.lat=48.003;s.position.lat=48.003;s._initializeState(route,'new');assert.equal(s._findPhysicalLeader(game.scheduleCreator.services,route,6)?.service,others[0]);
});
