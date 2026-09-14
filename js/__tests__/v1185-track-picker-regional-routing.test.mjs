import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function mkWay(id,lat0,lon0,lat1,lon1,nodeA='A',nodeB='B'){
  return {id:String(id),geometry:[{lat:lat0,lon:lon0},{lat:lat1,lon:lon1}],nodeIds:[nodeA,nodeB],maxSpeed:160,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',preferredDirection:'',bidirectional:'regular',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{railway:'rail'}};
}

test('v1.1.85 precise click does not let incomplete resident parallel track shadow real clicked OSM way',async()=>{
  const orm=new ORMClient();
  const lat=49.5, rightLon=8.700000;
  // Left track is ~4 m west and is the only resident vector way.
  const leftLon=rightLon-0.000055;
  const left=mkWay('LEFT',lat-0.001,leftLon,lat+0.001,leftLon,'L0','L1');
  const right=mkWay('RIGHT',lat-0.001,rightLon,lat+0.001,rightLon,'R0','R1');
  orm.getLoadedRailwaysInBounds=()=>[left];
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[left,right],source:'osm-main-test'});
  orm.fetchArea=async()=>{throw new Error('Overpass should not be needed after direct OSM confirms both tracks');};
  const cs=await orm.getTrackCandidates(lat,rightLon,{radiusM:20,limit:8});
  assert.ok(cs.length>=2);
  assert.equal(cs[0].wayId,'RIGHT');
  assert.ok(cs[0].distanceM<0.5);
});

test('v1.1.85 railway tile wrapper forwards hedged endpoint options to fetchArea',async()=>{
  const orm=new ORMClient();
  let seen=null;
  orm.fetchArea=async(_s,_w,_n,_e,opts)=>{seen=opts;return {ok:true,ways:[],source:'test'};};
  await orm._fetchRailTileResilient({south:49,west:8,north:49.1,east:8.1},0,{timeoutMs:3100,attemptsPerEndpoint:1,maxSplitDepth:0,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:240,deadlineTs:Date.now()+5000,endpointOffset:1});
  assert.equal(seen.maxEndpoints,2);
  assert.equal(seen.raceEndpoints,2);
  assert.equal(seen.hedgeDelayMs,240);
  assert.equal(seen.endpointOffset,1);
});

test('v1.1.85 regional 40 km corridor uses hedged tiles and bounded split rescue',async()=>{
  const orm=new ORMClient();
  const a={lat:49.55,lon:8.67,wayId:'A',segmentIndex:0};
  const b={lat:49.90,lon:8.65,wayId:'B',segmentIndex:0};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._loadPersistentRailwaysInBounds=async()=>[];
  let seen=null;
  orm.fetchRailwayTiles=async(_tiles,_p,opts)=>{seen=opts;return [mkWay('A',49.55,8.67,49.7,8.66,'N0','N1'),mkWay('B',49.7,8.66,49.90,8.65,'N1','N2')];};
  orm._routeCursorCandidatesOnWays=async()=>[{lat:a.lat,lon:a.lon,wayId:'A'},{lat:b.lat,lon:b.lon,wayId:'B'}];
  const r=await orm._findCursorLegLocal(a,b,{_deadlineTs:Date.now()+10000,maxSpeed:160});
  assert.ok(r?.length>=2);
  assert.equal(seen.maxEndpoints,2);
  assert.equal(seen.raceEndpoints,2);
  assert.equal(seen.maxSplitDepth,1);
  assert.ok(seen.concurrency<=4);
});

test('v1.1.85 regional exact leg uses continuous real-OSM bbox rescue before giving up',async()=>{
  const orm=new ORMClient();
  const a={lat:49.55,lon:8.67,wayId:'A',segmentIndex:0};
  const b={lat:49.90,lon:8.65,wayId:'B',segmentIndex:0};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._loadPersistentRailwaysInBounds=async()=>[];
  orm.fetchRailwayTiles=async()=>[];
  let broad=0;
  orm._findCursorLegBroadArea=async()=>{broad++;return [{lat:a.lat,lon:a.lon,wayId:'A'},{lat:b.lat,lon:b.lon,wayId:'B'}];};
  const r=await orm._findCursorLegLocal(a,b,{_deadlineTs:Date.now()+10000,maxSpeed:160});
  assert.ok(r?.length>=2);
  assert.equal(broad,1);
});
