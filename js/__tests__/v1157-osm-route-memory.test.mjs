import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

function simpleWay(id=700){
  return {
    id,railway:'rail',maxSpeed:120,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[25000],frequency:[50],gauge:[1435],loadingGauge:'',axleLoad:null,metreLoad:null,
    tracks:1,usage:'main',service:'',trafficMode:'',preferredDirection:'',bidirectional:'regular',oneway:'',trainProtection:{},
    name:'',ref:'',trackRef:'1',tags:{railway:'rail','railway:track_ref':'1'},nodeIds:[1,2,3],
    geometry:[{lat:48.9500,lon:3.4000},{lat:48.9500,lon:3.4050},{lat:48.9500,lon:3.4100}],
  };
}

function rememberedRoute(){
  const r=[
    {lat:48.95,lon:3.4002,wayId:'700',maxSpeed:120,maxSpeedSource:'OSM',electrified:true,gauge:[1435],tags:{railway:'rail'}},
    {lat:48.95,lon:3.4050,wayId:'700',maxSpeed:120,maxSpeedSource:'OSM',electrified:true,gauge:[1435],tags:{railway:'rail'}},
    {lat:48.95,lon:3.4098,wayId:'700',maxSpeed:120,maxSpeedSource:'OSM',electrified:true,gauge:[1435],tags:{railway:'rail'}},
  ];
  r._resolvedAnchors=[{lat:48.95,lon:3.4002,wayId:'700'},{lat:48.95,lon:3.4098,wayId:'700'}];
  return r;
}

test('v1.1.57 saved Schedule V2 geometry hydrates zero-network cursor route memory',async()=>{
  const orm=new ORMClient();
  const manager={schedules:[{versions:[{
    locations:[
      {id:'a',track:{lat:48.95,lon:3.4002,snapLat:48.95,snapLon:3.4002,wayId:'700'}},
      {id:'b',track:{lat:48.95,lon:3.4098,snapLat:48.95,snapLon:3.4098,wayId:'700'}},
    ],
    state:'VALID',
    performanceProfile:{maxSpeed:120,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435]},
    outboundPath:{topologyRevision:1,resolvedRevision:1,error:'',constraints:[],legs:[{fromLocationId:'a',toLocationId:'b',routePoints:rememberedRoute()}]},
  }]}]};
  assert.equal(orm.hydrateCursorRouteMemoryFromSchedules(manager),1);
  let network=0;
  orm.fetchSmallOsmMapArea=async()=>{network++;return {ok:false,ways:[]};};
  orm.fetchArea=async()=>{network++;return {ok:false,ways:[]};};
  const route=await orm.findRouteViaCursorAnchors([
    {lat:48.95,lon:3.4002,wayId:'700'},
    {lat:48.95,lon:3.4098,wayId:'700'},
  ],{allowFallback:false,maxSpeed:120,traction:'electric',electricSystems:[{voltage:25000,frequency:50}],gauges:[1435]});
  assert.ok(route?.length>=2);
  assert.equal(route._fromScheduleRouteMemory,true);
  assert.equal(network,0,'saved schedule geometry must be used before external HTTP');
});

test('v1.1.86 exact interactive route does not scan historical spatial IndexedDB records',async()=>{
  const orm=new ORMClient();
  orm._cacheReady=Promise.resolve(true);
  const way=simpleWay();let spatial=0,network=0;
  orm._persistentCache.getIntersecting=async()=>{spatial++;return [{ways:[way]}];};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm.fetchSmallOsmMapArea=async()=>{network++;return {ok:true,ways:[way]};};
  const route=await orm.findRouteViaCursorAnchors([
    {lat:48.95,lon:3.4002,wayId:'700'},
    {lat:48.95,lon:3.4098,wayId:'700'},
  ],{allowFallback:false});
  assert.ok(route?.length>=2);
  assert.equal(spatial,0,'interactive exact route must not deserialize timestamp-ordered historical tiles');
  assert.equal(network,1);
});

test('v1.1.57 source hydrates route memory after loading a save',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(main,/hydrateCursorRouteMemoryFromSchedules/);
  const orm=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(orm,/getIntersecting/);
  assert.match(orm,/spatial-persistent-cache/);
  assert.match(orm,/routeMemory\s*:\s*true/);
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  assert.match(bundle,/hydrateCursorRouteMemoryFromSchedules/);
  assert.match(bundle,/spatial-persistent-cache/);
  assert.match(bundle,/routeMemory\s*:\s*true/);
});
