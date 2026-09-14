import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.RE_BASE||path.resolve(import.meta.dirname,'../..');
const mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));
const {ActiveService,cantonManager}=await mod('schedule-creator');
const {Economy}=await mod('economy');
const {PlatformManager}=await mod('line');
const {VoiePointManager}=await mod('voie-points');
function reset(){for(const k of ['cantons','routeCantons','trainCantons','resourceCantons'])cantonManager[k].clear();}
function fixture({kind='passage',power=4000,speed=80,grade=0}={}){
 reset();const stations=[{id:'A',name:'A',lat:48,lon:2,platforms:2},{id:'B',name:'B',lat:48.01,lon:2,platforms:2},{id:'C',name:'C',lat:48.11,lon:2,platforms:2}];
 const world={stations,tracks:[],getStationById(id){return this.stations.find(x=>x.id===id)||null;}};
 const pt=s=>({...s,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,wayId:'way-'+s.id,incline:grade});
 const routes=[[pt(stations[0]),pt(stations[1])],[pt(stations[1]),pt(stations[2])]];
 const rame={id:'R',maxSpeed:160,totalPower:power,totalMass:1000,totalLength:300,totalCapacity:0,totalFreightCapacity:0,traction:'diesel',elementDetails:[],currentLocation:{stationId:'A'}};
 const s=new ActiveService({id:'S',name:'S',serviceType:'fret',stops:[{stationId:'A',type:'arret',departureTime:600,arrivalTime:600},{stationId:'B',type:kind,arrivalTime:605,departureTime:605},{stationId:'C',type:'arret',arrivalTime:630,departureTime:630}],routes},rame,world,null);
 const game={world,economy:new Economy(),scheduleCreator:{services:[s]},realismSettings:{breakdown:0,physics:1},platformManager:new PlatformManager()};
 globalThis.window={game};s.active=true;s.state='moving';s.currentStopIndex=1;s._currentDate='2026-09-11';s.speed=s.train.speed=speed;s.position={lat:48.005,lon:2};s._economy=game.economy;s._initializeState(routes[0],'1-0');
 return {s,game,world,routes,rame};
}
function atEndpoint(s,route){s._state.index=route.length-1;s._state.progress=0;s.position={lat:route.at(-1).lat,lon:route.at(-1).lon};}
function tick(s,mode,game,dt=.1){if(mode==='full')s.moveUpdate(dt,605,game.scheduleCreator.services);else s.moveMacro(dt,605,game.economy,game.scheduleCreator.services);}
for(const mode of ['full','macro'])for(const kind of ['passage','waypoint']){
 test(`RC7-PASS-${mode}-${kind}: reaching a pass-through endpoint must not trigger a station brake`,()=>{
  const {s,game,routes}=fixture({kind});atEndpoint(s,routes[0]);const before=s.speed;tick(s,mode,game);
  assert.equal(s.currentStopIndex,2);assert.equal(s.state,'moving');assert.equal(s.speed,before);assert.equal(s.train.stoppedAt,null);
 });
 test(`RC7-PASS-cross-${mode}-${kind}: crossing the last vertex advances to the next leg without stopping`,()=>{
  const {s,game,routes}=fixture({kind});s._setRouteProgressKm(routes[0],s._state.cumDist[0]-0.0001);const before=s.speed;tick(s,mode,game);
  assert.equal(s.currentStopIndex,2);assert.ok(s.speed>=before-.01);assert.equal(s.state,'moving');assert.equal(game.economy.totalPassengers,0);
 });
}
for(const mode of ['full','macro']){
 test(`RC7-PASS-stop-${mode}: a genuine station endpoint still finishes braking`,()=>{const {s,game,routes}=fixture({kind:'arret'});atEndpoint(s,routes[0]);tick(s,mode,game);assert.equal(s.currentStopIndex,1);assert.ok(s.speed<80);});
 test(`RC7-PHYS-zero-${mode}: an unpowered consist cannot accelerate on level track`,()=>{const {s,game}=fixture({power:0,speed:0});const p={...s.position};tick(s,mode,game,1);assert.equal(s.speed,0);assert.deepEqual(s.position,p);});
 test(`RC7-PHYS-grade-${mode}: insufficient power must reduce speed in an uphill segment`,()=>{const {s,game}=fixture({power:100,speed:80,grade:'30‰'});const a=s._computePhysicsAccel({type:'clear'});assert.ok(a.accel<0,`net acceleration was ${a.accel}`);tick(s,mode,game,.5);assert.ok(s.speed<80,`speed stayed ${s.speed}`);});
}
test('RC7-PHYS-controller: negative net acceleration acts even at the current speed target',()=>{const {s}=fixture({speed:80});s._applyPhysicalSpeedTarget(80,-.5,3,1);assert.equal(s.speed,79.5);});
test('RC7-PHYS-coasting: a zero-power moving consist loses speed to resistance',()=>{const {s}=fixture({power:0,speed:80});const a=s._computePhysicsAccel({type:'clear'});assert.ok(a.accel<0);});
test('RC7-TAIL: macro obeys the same rear-clearance speed as full movement',()=>{
 const {s,game,rame}=fixture({speed:30});rame.totalLength=750;
 const route=Array.from({length:101},(_,i)=>({lat:48+i*.0001,lon:2,maxSpeed:i<20?30:160,maxSpeedSource:'OSM',wayId:'one'}));
 s.routes[0]=route;s.position={lat:route[25].lat,lon:2};s._initializeState(route,'1-0');s._setRouteProgressKm(route,s._state.cumDist[0]-s._state.cumDist[25]);
 assert.equal(s._getInfraSpeedLimit(route,25,0,750),30);tick(s,'macro',game,1);assert.ok(s.speed<=30+1e-9,`macro speed ${s.speed}`);
});
for(const label of ['A','1 bis','V1M'])test(`RC7-TRACK: explicit native track ${label} is never silently replaced`,()=>{
 const {s,game,world}=fixture();const vpm=new VoiePointManager();game.voiePointManager=vpm;
 const free=vpm.addVoiePoint({id:'free',lat:48.01,lon:2,stationId:'B',voie:'2'});
 s._v2OccurrenceId='O';const stop=s.stops[1];stop.type='arret';stop.platform=label;stop.voiePointId=null;
 assert.equal(s._reserveArrivalResources(world.stations[1],stop),false);assert.equal(free.occupiedBy,null);assert.equal(stop.platform,label);
});
test('RC7-TRACK: an explicit point from a different station is refused',()=>{
 const {s,game,world}=fixture();const vpm=new VoiePointManager();game.voiePointManager=vpm;
 vpm.addVoiePoint({id:'B1',lat:48.01,lon:2,stationId:'B',voie:'1'});const other=vpm.addVoiePoint({id:'C1',lat:48.11,lon:2,stationId:'C',voie:'1'});
 const stop=s.stops[1];stop.type='arret';stop.voiePointId=other.id;stop.platform='1';
 assert.equal(s._reserveArrivalResources(world.stations[1],stop),false);assert.equal(other.occupiedBy,null);
});
test('RC7-TRACK: automatic legacy choice remains possible without an explicit point/label',()=>{const{s,game,world}=fixture();const vpm=new VoiePointManager();game.voiePointManager=vpm;const free=vpm.addVoiePoint({id:'B1',lat:48.01,lon:2,stationId:'B',voie:'1'});const stop=s.stops[1];stop.type='arret';stop.platform='';assert.equal(s._reserveArrivalResources(world.stations[1],stop),true);assert.equal(free.occupiedBy,s.id);});
test('RC7-PASS-safety: anticipating a real stop beyond a passage retains its braking curve',()=>{
 const{s,routes,world}=fixture();world.stations[2].lat=48.0101;s.routes[1]=[{...routes[0].at(-1)},{...routes[0].at(-1),lat:48.0101}];
 s._setRouteProgressKm(routes[0],s._state.cumDist[0]-.01);const cap=s._passageLookAheadCap(routes[0],605);assert.ok(cap!==null&&cap<40,`cap ${cap}`);
});
test('RC7-PASS-safety: a lower limit just beyond a passage is anticipated before the junction',()=>{
 const{s,routes}=fixture();s.routes[1]=s.routes[1].map(p=>({...p,maxSpeed:30}));s._setRouteProgressKm(routes[0],s._state.cumDist[0]-.02);
 const cap=s._passageLookAheadCap(routes[0],605);assert.ok(cap!==null&&cap<=30.01);
});
for(const mode of ['full','macro'])for(const issue of ['missing','disconnected'])test(`RC7-PASS-invalid-${mode}-${issue}: no invented continuation or teleport`,()=>{
 const{s,game,routes}=fixture();if(issue==='missing')s.routes[1]=[];else s.routes[1]=s.routes[1].map(p=>({...p,lon:3}));atEndpoint(s,routes[0]);tick(s,mode,game);
 assert.equal(s.currentStopIndex,1);assert.equal(s.state,'blocked_route');assert.equal(s.speed,0);assert.equal(s.position.lon,2);assert.ok(!s.completed);
});
test('RC7-PASS-tail: passing a timing point carries occupied approach cantons onto the next leg',()=>{
 const{s,game,routes}=fixture();atEndpoint(s,routes[0]);s._syncCantonFootprint(routes[0]);const before=new Set(cantonManager.getTrackedCantons(s.id));assert.ok(before.size>0);tick(s,'full',game);
 assert.ok(s._carryoverCantonIds?.size>0);for(const id of before)assert.ok(s._carryoverCantonIds.has(id));
});
test('RC7-TRACK: native voie 1 accepts the V1 alias without fallback',()=>{const{s,game,world}=fixture();game.voiePointManager=new VoiePointManager();const vp=game.voiePointManager.addVoiePoint({id:'B1',lat:48.01,lon:2,stationId:'B',voie:'1'});s.stops[1].type='arret';s.stops[1].platform='V1';s._v2OccurrenceId='O';assert.equal(s._reserveArrivalResources(world.stations[1],s.stops[1]),true);assert.equal(vp.occupiedBy,s.id);});
test('RC7-ECO-return: explicit return geometry, not the outward route, determines distance and toll metadata',()=>{
 const{s,game,world}=fixture({kind:'arret',speed:0});
 s.isReturnLeg=true;s.currentStopIndex=1;
 s._returnRoutes=[[{lat:48.01,lon:2,maxSpeed:80},{lat:48.01,lon:2.2,maxSpeed:80},{lat:48,lon:2,maxSpeed:80}]];
 s._returnStopsData=[{stationId:'B',type:'arret',arrivalTime:600,departureTime:600},{stationId:'A',type:'arret',arrivalTime:630,departureTime:630}];s._adjustedStops=null;
 let captured=null;const economy={processStopRevenue(...args){captured=args;},processServiceRevenue(){}};s.arriveAtStation(world.stations[0],630,economy);
 assert.ok(captured);assert.ok(captured[2]>20,`return billed ${captured[2]} km`);assert.equal(captured[6].length,3);assert.ok(captured[6].every(p=>p.maxSpeed===80));
});
for(const mode of ['full','macro'])test(`RC7-PASS-rear-${mode}: an approach speed restriction survives a non-stop leg transition until the whole train clears`,()=>{
 const{s,game,routes,rame}=fixture({speed:30});rame.totalLength=750;routes[0].forEach(p=>p.maxSpeed=30);s._resolvedSpeedCache=new WeakMap();atEndpoint(s,routes[0]);tick(s,mode,game);
 assert.equal(s.currentStopIndex,2);assert.equal(s._getPassageTailSpeedLimit(),30);
 tick(s,mode,game,1);assert.ok(s.speed<=30+1e-8,`speed ${s.speed}`);
 s.totalDistance+=.751;assert.equal(s._getPassageTailSpeedLimit(),Infinity);
});
test('RC7-PASS-rear-save: compact save/reload preserves approach limits without sharing mutable objects',async()=>{
 const{ScheduleCreator}=await mod('schedule-creator');const{s,game,world,rame,routes}=fixture({speed:30});rame.totalLength=750;routes[0].forEach(p=>p.maxSpeed=30);s._resolvedSpeedCache=new WeakMap();atEndpoint(s,routes[0]);tick(s,'full',game);
 const creator=new ScheduleCreator();creator.services=[s];s.rameId=rame.id;const saved=creator.toSave();assert.ok(saved[0]._r.pth.length);assert.notEqual(saved[0]._r.pth[0],s._passageTailSpeedHolds[0]);
 const restored=new ScheduleCreator();restored.loadFromSave(saved,{getById:()=>rame},world,605,'2026-09-11');assert.equal(restored.services.length,1);assert.equal(restored.services[0]._getPassageTailSpeedLimit(),30);
});
test('RC7-PASS-rear-v2: runtime save carries its own copy of the rear restriction queue',async()=>{
 const{ScheduleV2Runtime}=await mod('schedule-v2-runtime');const{s,game}=fixture();s._v2OccurrenceId='O';s._passageTailSpeedHolds=[{endTravelKm:10,limitKmh:30}];game.rotationV2={vehicles:[]};
 const runtime=new ScheduleV2Runtime(game);const saved=runtime.toSave();assert.deepEqual(saved.services[0].passageTailSpeedHolds,s._passageTailSpeedHolds);assert.notEqual(saved.services[0].passageTailSpeedHolds[0],s._passageTailSpeedHolds[0]);
 assert.equal(runtime.loadFromSave(saved),true);assert.deepEqual(runtime._pendingSnapshots.get(s.id).passageTailSpeedHolds,s._passageTailSpeedHolds);
});
test('RC7-PASS-rear-reset: a completed/cancelled service does not leak speed restrictions into its next occurrence',()=>{const{s}=fixture();s._passageTailSpeedHolds=[{endTravelKm:10,limitKmh:30}];s._releaseAllPhysicalResources();assert.equal(s._passageTailSpeedHolds.length,0);});
for(const mode of ['full','macro'])for(const end of [false,true])test(`RC7-OVERLAP-${mode}-${end?'endpoint':'segment'}: a coarse step never crosses the real rear of a stationary leader`,()=>{
 const{s,game,routes}=fixture({speed:80});const route=routes[0],length=s._state.cumDist[0];const front=end?length-.06:.3;const leaderKm=end?length:.36;
 s._setRouteProgressKm(route,front);s.totalDistance=front;
 const leader={id:'LEADER',state:'stopped_at_station',speed:0,active:true,rame:{totalLength:20},train:{length:20,speed:0},position:{lat:48+(leaderKm/length)*.01,lon:2},_stationaryRoute:route,_stationaryRouteIndex:0,_state:{cachedRoute:route,index:0}};
 game.scheduleCreator.services.push(leader);const found=s._findPhysicalLeader(game.scheduleCreator.services,route,6);assert.ok(found);const bound=found.frontProgressKm-.02-.03;const old=s.totalDistance;
 tick(s,mode,game,3);assert.ok(s.totalDistance-old<=bound-front+1e-9,`advanced ${s.totalDistance-old}, allowed ${bound-front}`);assert.ok(s._currentFrontKm(route)<=bound+1e-9);assert.equal(s.currentStopIndex,1);assert.equal(s.speed,0);
});
test('RC7-PASS-rear-v2-restore: exact runtime restoration reinstates the active restriction queue',async()=>{
 const{ScheduleV2Runtime}=await mod('schedule-v2-runtime');const{s,game}=fixture();s._v2OccurrenceId='O';s._passageTailSpeedHolds=[{endTravelKm:10,limitKmh:30}];game.rotationV2={vehicles:[],getVehicle:()=>null};
 const runtime=new ScheduleV2Runtime(game), saved=runtime.toSave();s._passageTailSpeedHolds=[];assert.equal(runtime.loadFromSave(saved),true);assert.equal(runtime._restoreSnapshot(s,605),true);assert.equal(s._getPassageTailSpeedLimit(),30);
});
test('RC7-PASS-rear-rollback: failed catch-up restores the rear restriction as well as the physical position',async()=>{
 const{ScheduleV2Runtime}=await mod('schedule-v2-runtime');const{s,game}=fixture();const runtime=new ScheduleV2Runtime(game);const old={...s.position};s._passageTailSpeedHolds=[{endTravelKm:10,limitKmh:30}];s._syncCantonFootprint=()=>false;
 const plan={startSec:36000,endSec:37800,locations:s.stops.map(stop=>({arrivalSec:stop.arrivalTime*60,departureSec:stop.departureTime*60}))};
 const result=runtime._catchUpFreshCompile(s,plan,36120);assert.equal(result.mode,'blocked');assert.deepEqual(s.position,old);assert.equal(s._getPassageTailSpeedLimit(),30);
});
test('RC7-LOD-reset: clearing a route state also invalidates its grouping key',()=>{const{s}=fixture();assert.ok(s._routeKey);s._resetState();assert.equal(s._routeKey,null);});
for(const large of [false,true])test(`RC7-LOD-real-loop-${large?'601':'1'}: next leg is initialized before camera/LOD dispatch without a three-second pause`,async()=>{
 const{readFileSync}=await import('node:fs');const source=readFileSync(path.join(root,'js/main.js'),'utf8');const a=source.indexOf('    moveTick(dt, timeOfDay) {'),b=source.indexOf('    _forceV2RuntimeSyncNow()',a);assert.ok(a>=0&&b>a);const H=new Function(`return class {${source.slice(a,b)}}`)();
 const{s,game,routes}=fixture({speed:30});s.currentStopIndex=2;s.position={lat:48.01,lon:2};s._resetState();
 // A stale key from a restored/custom service must be tolerated as well.
 s._routeKey='stale-previous-leg';
 const services=[s];if(large)for(let i=0;i<600;i++)services.push({id:'F'+i,position:{lat:60+i*.02,lon:10},state:'moving',currentStopIndex:1,isReturnLeg:false,_routeKey:'F'+i,_state:{cachedRoute:routes[1],legKey:'1-0'},train:{speed:0},moveMacro(){},getCurrentRoute:()=>routes[1]});
 const g=Object.assign(new H(),game,{cantonManager,depotManager:{updateRescues(){}},incidentManager:{checkTrainPositions(){}},_lastCantonCleanup:performance.now(),_streamNativeOSMViewport(){},renderer:{logicalWidth:100,logicalHeight:100,tileMap:{screenToWorld:(x,y)=>({lat:48.05-y*.002,lon:1.9+x*.002})}},scheduleCreator:{services,getActiveServices:()=>services,getMovingServices:()=>services}});globalThis.window.game=g;
 const before=s.totalDistance;g.moveTick(.1,605);assert.equal(s._lod,'high');assert.equal(s._state.legKey,'2-0');assert.equal(s._state.cachedRoute,routes[1]);assert.ok(s.totalDistance>before,`no advance in first next-leg tick: ${s.totalDistance}`);
});
for(const mode of ['full','macro'])test(`RC7-STATION-rear-${mode}: an intermediate station dwell does not release the approach speed under the rear`,()=>{
 const{s,game,world,rame,routes}=fixture({kind:'arret',speed:0});rame.totalLength=750;routes[0].forEach(p=>p.maxSpeed=30);s._resolvedSpeedCache=new WeakMap();atEndpoint(s,routes[0]);s.arriveAtStation(world.stations[1],605,game.economy);
 assert.equal(s.state,'stopped_at_station');assert.equal(s._getPassageTailSpeedLimit(),30);s.state='moving';s.speed=s.train.speed=30;const before=s.totalDistance;tick(s,mode,game,1);assert.ok(s.speed<=30+1e-8);assert.ok(s.totalDistance>before);
});
