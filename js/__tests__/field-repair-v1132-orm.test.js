import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Revalidator } from '../schedule-v2-revalidation.js';
import { ScheduleV2Manager, ScheduleState, ScheduledLocation, TrackBinding, TrainCategory, StopCode } from '../schedule-v2-model.js';
import { RotationV2Manager } from '../rotation-v2-model.js';

function mockResponse(data){return {ok:true,status:200,async json(){return data;}};}

test('Overpass HTTP-200 remark is a network failure and is never cached as an empty rail tile',async()=>{
  const orm=new ORMClient();orm._cacheReady=Promise.resolve();let saves=0;orm._saveCachedArea=async()=>{saves++;};orm._loadCachedArea=async()=>null;
  const old=global.fetch;global.fetch=async()=>mockResponse({remark:'runtime error: Query timed out',elements:[]});
  try{const res=await orm.fetchArea(48,2,48.1,2.1,{withStatus:true,attemptsPerEndpoint:1,timeoutMs:2500});assert.equal(res.ok,false);assert.equal(saves,0);assert.equal(orm.areaCache.size,0);}finally{global.fetch=old;}
});

test('Overpass HTTP-200 remark is never cached as an empty station tile',async()=>{
  const orm=new ORMClient();orm._cacheReady=Promise.resolve();let saves=0;orm._saveCachedArea=async()=>{saves++;};orm._loadCachedArea=async()=>null;
  const old=global.fetch;global.fetch=async()=>mockResponse({remark:'runtime error: Query timed out',elements:[]});
  try{const res=await orm.fetchStationsArea(48,2,48.1,2.1,{withStatus:true});assert.equal(res.ok,false);assert.equal(saves,0);assert.equal(orm._stationAreaCache.size,0);}finally{global.fetch=old;}
});

test('loading new OSM ways invalidates existing routeCache',async()=>{
  const orm=new ORMClient();orm._cacheReady=Promise.resolve();orm._loadCachedArea=async()=>null;orm._saveCachedArea=async()=>{};orm.routeCache.set('stale',[1,2]);
  const old=global.fetch;global.fetch=async()=>mockResponse({elements:[{type:'way',id:1,tags:{railway:'rail'},nodes:[1,2],geometry:[{lat:48,lon:2},{lat:48.01,lon:2.01}]}]});
  try{const r=await orm.fetchArea(48,2,48.02,2.02,{withStatus:true,attemptsPerEndpoint:1});assert.equal(r.ok,true);assert.equal(orm.routeCache.has('stale'),false);}finally{global.fetch=old;}
});

test('different avoidStationPairs sets never collide in route cache',async()=>{
  const orm=new ORMClient();orm._ensureGraphAsync=async()=>({nodes:new Map(),edges:new Map()});orm.fetchArea=async()=>[];orm._maxFallbackKm=0;
  const a=[{latA:48,lonA:2,latB:48.1,lonB:2.1}],b=[{latA:49,lonA:3,latB:49.1,lonB:3.1}];
  await orm.findRoute(48,2,48.2,2.2,{allowFallback:false,avoidStationPairs:a});
  await orm.findRoute(48,2,48.2,2.2,{allowFallback:false,avoidStationPairs:b});
  assert.equal(orm.routeCache.size,2);
});

test('OSM station parser keeps multimodal train=yes and native osm identity',()=>{
  const orm=new ORMClient();const out=orm._parseStations({elements:[
    {type:'node',id:1,lat:48,lon:2,tags:{railway:'station',train:'yes',subway:'yes',name:'Multimodal',uic_ref:'123'}},
    {type:'node',id:2,lat:48.1,lon:2.1,tags:{public_transport:'station',train:'yes',name:'RER'}},
    {type:'node',id:3,lat:48.2,lon:2.2,tags:{railway:'station',subway:'yes',train:'no',name:'Metro only'}},
  ]});
  assert.ok(out.some(s=>s.id==='osm-node-1'&&!s.urbanTransit&&s.uicRef==='123'));
  assert.ok(out.some(s=>s.id==='osm-node-2'&&!s.urbanTransit));
  assert.ok(out.some(s=>s.id==='osm-node-3'&&s.urbanTransit));
});

function revalidationGame(){
  const scheduleV2=new ScheduleV2Manager(),rotationV2=new RotationV2Manager(scheduleV2);
  const game={scheduleV2,rotationV2,orm:{_lastCursorRouteFailure:''},weather:null,saveState(){},ui:{}};
  const rec=scheduleV2.createDraft({number:'RV',category:TrainCategory.FREIGHT,maxSpeed:120});const v=rec.currentVersion;
  v.locations=[new ScheduledLocation({id:'a',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'OLD-A',displayName:'1',lat:48,lon:2,snapLat:48, snapLon:2}),departureSec:8*3600,dwellSec:0,stopCode:StopCode.C}),new ScheduledLocation({id:'b',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'OLD-B',displayName:'1',lat:48.1,lon:2.1,snapLat:48.1,snapLon:2.1}),arrivalSec:8*3600+600,departureSec:8*3600+720,dwellSec:120,stopCode:StopCode.S,arrivalOverride:true,departureOverride:true})];
  v.outboundPath.routePoints=[{lat:48,lon:2,wayId:'OLD-A'},{lat:48.1,lon:2.1,wayId:'OLD-B'}];v.outboundPath.legs=[{id:'old',fromLocationId:'a',toLocationId:'b',constraintIds:[],routePoints:v.outboundPath.routePoints,segments:[],distanceKm:10}];v.state=ScheduleState.VALID;
  return {game,rec,v};
}

test('revalidation persists newly resolved wayIds/snaps into station bindings',async()=>{
  const {game,v}=revalidationGame();const rev=new ScheduleV2Revalidator(game);
  const route=[{lat:48.0002,lon:2.0002,wayId:'NEW-A',maxSpeed:120,electrified:false},{lat:48.0998,lon:2.0998,wayId:'NEW-B',maxSpeed:120,electrified:false}];
  route._resolvedAnchors=[{lat:48.0002,lon:2.0002,wayId:'NEW-A'},{lat:48.0998,lon:2.0998,wayId:'NEW-B'}];
  rev.router.routeBetweenBindings=async()=>route;rev.router.snapshotRoute=()=>({routePoints:route.map(x=>({...x})),segments:[{wayId:'NEW-A',maxSpeed:120,maxSpeedSource:'OSM',electrified:false,gauge:[1435]}],distanceKm:10});
  const r=await rev._rebuildVersion(v);assert.equal(r.ok,true);assert.equal(v.locations[0].track.wayId,'NEW-A');assert.equal(v.locations[1].track.wayId,'NEW-B');assert.equal(v.locations[0].track.snapLat,48.0002);
});

test('network failure defers revalidation and preserves a previously VALID route',async()=>{
  const {game,v}=revalidationGame();game.orm._lastCursorRouteFailure='NETWORK_TIMEOUT';const before=JSON.stringify(v.outboundPath.toJSON());const rev=new ScheduleV2Revalidator(game);rev.router.routeBetweenBindings=async()=>{throw new Error('Overpass timeout');};
  const result=await rev.run();assert.equal(result.deferred,true);assert.equal(v.state,ScheduleState.VALID);assert.equal(JSON.stringify(v.outboundPath.toJSON()),before);
});
