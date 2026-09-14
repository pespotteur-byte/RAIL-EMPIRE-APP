import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, ActiveService, tick} from './helpers/rc10-fixtures.mjs';

function traffic({myKm=1, otherKm=1.3, mySpeed=80, otherSpeed=60, split=false, parallel=false}={}) {
 const f=fixture({speed:mySpeed});
 const route=Array.from({length:201},(_,i)=>({lat:48+i*.001,lon:2,maxSpeed:120,maxSpeedSource:'OSM',electrified:true,wayId:split?(i<10?'west':'east'):'shared'}));
 f.world.stations[1].lat=48.2;
 const s=f.s;s.routes=[route];s.stops=s.stops.slice(0,2);s.stops[1].type='arret';s._initializeState(route,'1-0');s._setRouteProgressKm(route,myKm);
 const reverse=route.slice().reverse().map(p=>({...p,wayId:parallel?'parallel':p.wayId}));
 const other=new ActiveService({id:'OPPOSING',name:'Opposing',serviceType:'fret',stops:[s.stops[1],s.stops[0]],routes:[reverse]}, {...f.rame,id:'OTHER_R'},f.world,null);
 other.position={lat:48.2,lon:2};other.active=true;other.state='moving';other.currentStopIndex=1;other._initializeState(reverse,'1-0');other._setRouteProgressKm(reverse,other._state.cumDist[0]-otherKm);other.speed=other.train.speed=otherSpeed;other._economy=f.game.economy;
 f.game.scheduleCreator.services=[s,other];
 return {...f,route,other};
}

test('RC12-IPCS: caller fleet is used when the spatial index and cached neighbours are absent',()=>{
 const {s,other}=traffic();assert.equal(s._ipcsBlockCheck([s,other]),0);
});
test('RC12-IPCS: a partial neighbour cache does not hide the opposing train without a grid',()=>{
 const {s,other}=traffic();s._nearbyServices=[{id:'FAR',position:{lat:60,lon:2}}];assert.equal(s._ipcsBlockCheck([s,other]),0);
});
test('RC12-IPCS: an empty restored grid cannot mask physically present services',()=>{
 const {s,other,game}=traffic();game._serviceGrid=new Map();assert.equal(s._ipcsBlockCheck([s,other]),0);
});
test('RC12-IPCS: opposite headings that are moving apart do not retain a phantom stop',()=>{
 const {s,other}=traffic({myKm:1,otherKm:.9});s._nearbyServices=[other];assert.equal(s._ipcsBlockCheck([s,other]),null);
});
test('RC12-IPCS: compare track identity at the conflict, not on different current OSM ways',()=>{
 const {s,other}=traffic({myKm:.5,otherKm:1.7,mySpeed:160,otherSpeed:120,split:true});s._nearbyServices=[other];const cap=s._ipcsBlockCheck([s,other]);assert.ok(cap!==null&&cap>=0&&cap<160);
});
test('RC12-IPCS: distinct known parallel ways never become a face-to-face conflict',()=>{
 const {s,other}=traffic({parallel:true});s._nearbyServices=[other];assert.equal(s._ipcsBlockCheck([s,other]),null);
});
test('RC12-IPCS: same-direction traffic remains handled by the follower controller',()=>{
 const {s,other,route}=traffic();other.routes=[route];other._initializeState(route,'1-0');other._setRouteProgressKm(route,1.3);s._nearbyServices=[other];assert.equal(s._ipcsBlockCheck([s,other]),null);
});
test('RC12-IPCS: a cancelled opposite service is not a physical obstacle',()=>{
 const {s,other}=traffic();other.state='cancelled';s._nearbyServices=[other];assert.equal(s._ipcsBlockCheck([s,other]),null);
});
test('RC12-IPCS: take the strongest conflict rather than the first array entry',()=>{
 const {s,other}=traffic({myKm:1,otherKm:1.9,mySpeed:160,otherSpeed:30});
 const near=Object.assign(Object.create(Object.getPrototypeOf(other)),other,{id:'NEAR',_state:{...other._state},position:{...other.position}});
 near._setRouteProgressKm(near.routes[0],near._state.cumDist[0]-1.3);near.speed=near.train.speed=0;
 other.speed=30;other.train={...other.train,speed:30};s._nearbyServices=[other,near];
 const first=s._ipcsBlockCheck([s,other,near]);s._nearbyServices=[near,other];const second=s._ipcsBlockCheck([s,near,other]);assert.equal(first,second);
});
for(const mode of ['full','macro']) test(`RC12-IPCS: ${mode} real controller brakes two opposite freights without crossing`,()=>{
 const {s,other,game,route}=traffic({myKm:1,otherKm:4,mySpeed:100,otherSpeed:100,split:true});
 s.rame.totalLength=other.rame.totalLength=750;
 const dt=mode==='full'?.25:3;
 for(let elapsed=0;elapsed<180;elapsed+=dt){tick(s,mode,game,dt);tick(other,mode,game,dt);
  const front=s._getRouteProgressKm(s.position,route,s._state.index);
  const facing=s._projectRoutePosition(other.position,route,0,25).progressKm;
  assert.ok(facing-front>=.19,`unsafe separation ${facing-front} after ${elapsed}s`);
 }
 assert.ok(s.speed<1&&other.speed<1,`still approaching: ${s.speed}/${other.speed}`);
});

function curvedTraffic(opposite) {
 const f=fixture({speed:300});
 const route=[];
 for(let i=0;i<=100;i++)route.push({lat:48+i*.0001,lon:2,wayId:'curve'});
 for(let i=1;i<=20;i++)route.push({lat:48.01,lon:2+i*.0001,wayId:'curve'});
 for(let i=1;i<=100;i++)route.push({lat:48.01-i*.0001,lon:2.002,wayId:'curve'});
 const s=f.s;s.routes=[route];s._initializeState(route,'1-0');s._setRouteProgressKm(route,.2);
 const otherRoute=opposite?route.slice().reverse():route;
 const other=new ActiveService({id:'CURVED_OTHER',stops:s.stops.slice(0,2),routes:[otherRoute]}, {...f.rame,id:'CURVED_R'},f.world,null);
 other.active=true;other.state='moving';other.currentStopIndex=1;other.position={lat:otherRoute[0].lat,lon:otherRoute[0].lon};other._initializeState(otherRoute,'1-0');
 other._setRouteProgressKm(otherRoute,opposite?other._state.cumDist[0]-1.7:1.7);
 other.speed=other.train.speed=250;s._nearbyServices=[other];f.game.scheduleCreator.services=[s,other];
 return {s,other};
}
test('RC12-IPCS: a same-direction train after a hairpin is not mistaken for opposing traffic',()=>{
 const {s,other}=curvedTraffic(false);assert.equal(s._ipcsBlockCheck([s,other]),null);
});
test('RC12-IPCS: a genuine opposing train after a hairpin remains protected',()=>{
 const {s,other}=curvedTraffic(true);const cap=s._ipcsBlockCheck([s,other]);assert.ok(cap!==null&&cap>=0&&cap<300);
});

function parallelLatitudeFixture(points=201,offset=.0004){
 const f=fixture({speed:100}),s=f.s;
 const route=Array.from({length:points},(_,i)=>({lat:48,lon:2+i*.02/(points-1),wayId:'shared'}));
 s.routes=[route];s.position={lat:48,lon:2};s._initializeState(route,'1-0');s._setRouteProgressKm(route,.3);
 const reverse=route.slice().reverse().map(p=>({...p,lat:p.lat+offset}));
 const other=new ActiveService({id:'LAT_OTHER',stops:s.stops.slice(0,2),routes:[reverse]}, {...f.rame,id:'LAT_R'},f.world,null);
 other.active=true;other.state='moving';other.currentStopIndex=1;other.position={...reverse[0]};other._initializeState(reverse,'1-0');other._setRouteProgressKm(reverse,other._state.cumDist[0]-.6);other.speed=other.train.speed=100;
 s._nearbyServices=[other,...Array.from({length:3},(_,i)=>({id:'FAR_'+i,position:{lat:60+i,lon:2}}))];
 f.game.scheduleCreator.services=[s,...s._nearbyServices];return {...f,route,other,reverse};
}
test('RC12-IPCS: broad latitude guard retains candidates inside the 50 m projection tolerance',()=>{
 const f=parallelLatitudeFixture();assert.equal(f.s._ipcsBlockCheck(f.game.scheduleCreator.services),0);
});
test('RC12-IPCS: optional broad phase is recomputed after in-place geometry changes',()=>{
 const f=parallelLatitudeFixture();assert.equal(f.s._ipcsBlockCheck(f.game.scheduleCreator.services),0);
 for(const p of [...f.route,...f.reverse])p.lat+=.002;f.s.position.lat+=.002;f.other.position.lat+=.002;
 assert.equal(f.s._ipcsBlockCheck(f.game.scheduleCreator.services),0);
});
test('RC12-IPCS: dense routes keep the complete narrow-phase conflict check',()=>{
 const f=parallelLatitudeFixture(4097);assert.equal(f.s._ipcsBlockCheck(f.game.scheduleCreator.services),0);
});
