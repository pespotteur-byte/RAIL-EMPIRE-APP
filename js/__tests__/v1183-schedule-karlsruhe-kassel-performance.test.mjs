import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';
import { RouteConstraint } from '../schedule-v2-model.js';

function mkWay(id, a, b, nodeA, nodeB, extra={}) {
  return {
    id:String(id),
    geometry:[{lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon}],
    nodeIds:[nodeA,nodeB],
    maxSpeed:200,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],
    tracks:2,usage:'main',service:'',railway:'rail',trafficMode:'',preferredDirection:'',bidirectional:'regular',oneway:'',
    trainProtection:{},name:'',ref:'',trackRef:'',tags:{},...extra,
  };
}

function syntheticLongChain(count=64) {
  // ~300 km north-east chain, deliberately exact OSM-style: adjacent ways share node IDs.
  const pts=[];
  for(let i=0;i<=count;i++) pts.push({lat:49.0069+i*(2.3058/count),lon:8.4037+i*(1.0760/count)});
  const ways=[];
  for(let i=0;i<count;i++) ways.push(mkWay(10000+i,pts[i],pts[i+1],`N${i}`,`N${i+1}`));
  return {pts,ways};
}

test('v1.1.83 Karlsruhe→Kassel class route uses bounded hierarchical corridor acquisition', async()=>{
  const orm=new ORMClient();
  const {pts,ways}=syntheticLongChain();
  const a={...pts[0],wayId:ways[0].id,segmentIndex:0};
  const b={...pts.at(-1),wayId:ways.at(-1).id,segmentIndex:0};
  const calls=[];
  orm.fetchRailwayTiles=async(tiles,_progress,options)=>{
    calls.push({tiles:tiles.length,options});
    return ways;
  };
  const route=await orm._findCursorLegLongDistance(a,b,{routeBudgetMs:180000,_deadlineTs:Date.now()+180000,maxSpeed:200});
  assert.ok(route?.length>=60,'the exact long OSM chain must be preserved, not collapsed to a coarse straight segment');
  assert.equal(calls.length,1,'a connected long route must stop after the first successful acquisition tier');
  assert.ok(calls[0].tiles<=8,`Karlsruhe→Kassel-size tier should use a small number of large corridor requests, got ${calls[0].tiles}`);
  assert.ok(calls[0].options.concurrency>=3,'long-route tiles should still be acquired concurrently');
  assert.equal(calls[0].options.maxEndpoints,2,'long-route tiles should hedge across two endpoints');
  assert.equal(calls[0].options.raceEndpoints,2,'long-route tiles should race endpoint responses');
  assert.equal(calls[0].options.maxSplitDepth,1,'only one bounded split rescue is allowed for a failed long-route tile');
  assert.ok(route.every(p=>!p.fallback),'no synthetic/fallback route point is allowed');
});

test('v1.1.83 long-route tile workers rotate Overpass endpoint priority', async()=>{
  const orm=new ORMClient();
  const seen=[];
  orm._fetchRailTileResilient=async(tile,_depth,options)=>{seen.push(options.endpointOffset);return [];};
  const tiles=Array.from({length:9},(_,i)=>({south:49+i*.01,north:49.01+i*.01,west:8,east:8.1}));
  await orm.fetchRailwayTiles(tiles,null,{allowPartial:true,concurrency:6,endpointOffset:1,deadlineTs:Date.now()+10000});
  assert.equal(seen.length,9);
  assert.deepEqual(new Set(seen),new Set([0,1,2]),'parallel tiles must not queue behind one first-choice server');
});

test('v1.1.83 global Schedule deadline stops new tile work fail-closed', async()=>{
  const orm=new ORMClient();
  const tiles=[{south:49,north:49.1,west:8,east:8.1}];
  await assert.rejects(
    orm.fetchRailwayTiles(tiles,null,{allowPartial:true,deadlineTs:Date.now()-1}),
    e=>e?.code==='TIME_BUDGET'
  );
});

test('v1.1.83 generic road oneway does not delete a railway direction',()=>{
  const orm=new ORMClient();
  const way={id:'1',maxSpeed:160,maxSpeedSource:'OSM',tags:{oneway:'yes'},oneway:'yes',preferredDirection:'',bidirectional:'',service:'',railway:'rail'};
  assert.equal(orm._edgeMetadata(way,true).directionForbidden,false);
  assert.equal(orm._edgeMetadata(way,false).directionForbidden,false);
  const railSingle={...way,oneway:'',tags:{},bidirectional:'no',preferredDirection:'forward'};
  assert.equal(orm._edgeMetadata(railSingle,true).directionForbidden,false);
  assert.equal(orm._edgeMetadata(railSingle,false).directionForbidden,true);
});

test('v1.1.83 RouteConstraint retains exact clicked OSM snapshot',()=>{
  const snap={wayId:'4321',segmentIndex:7,geometry:[{lat:49,lon:8},{lat:49.001,lon:8.001}],nodeIds:['A','B']};
  const via=new RouteConstraint({lat:49,lon:8,wayId:'4321',osmSnapshot:snap});
  assert.equal(via.segmentIndex,7);
  assert.deepEqual(via.osmSnapshot.nodeIds,['A','B']);
  assert.notEqual(via.osmSnapshot,snap,'snapshot must be cloned, not held by mutable reference');
});

test('v1.1.83 local 3+ VIA topology loading is chain-wide, never per-leg', async()=>{
  const orm=new ORMClient();
  const pts=[
    {lat:49.00690,lon:8.40370},
    {lat:49.01200,lon:8.40800},
    {lat:49.01800,lon:8.41400},
    {lat:49.02400,lon:8.42000},
  ];
  const ways=pts.slice(0,-1).map((p,i)=>mkWay(200+i,p,pts[i+1],`K${i}`,`K${i+1}`));
  const anchors=pts.map((p,i)=>({...p,wayId:String(200+Math.min(i,2)),segmentIndex:0}));
  let mainCalls=0,overpassCalls=0;
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._loadPersistentRailwaysInBounds=async()=>[];
  orm.fetchSmallOsmMapArea=async()=>{mainCalls++;return {ok:false,ways:[],switches:[],source:'test-offline-main'};};
  orm.fetchArea=async()=>{overpassCalls++;return {ok:true,ways,source:'test-overpass'};};
  const route=await orm.findRouteViaCursorAnchors(anchors,{maxSpeed:160,routeBudgetMs:180000});
  assert.ok(route?.length>=4);
  assert.equal(mainCalls,1,'OSM-main must be one compact request for the entire local VIA chain');
  assert.equal(overpassCalls,1,'successful Overpass topology must be loaded once for the entire chain, not once per VIA');
});

test('v1.1.83 router exposes the 3-minute budget failure distinctly', async()=>{
  const orm={
    _lastCursorRouteFailure:'',
    async findRouteViaCursorAnchors(){this._lastCursorRouteFailure='TIME_BUDGET';return null;},
    isFallbackRoute(){return false;},
  };
  const router=new ScheduleV2Router(orm);
  const a={lat:49,lon:8,wayId:'1'},b={lat:51,lon:9,wayId:'2'};
  await assert.rejects(router.routeBetweenBindings(a,b,[],{}),e=>e?.code==='ORM_TIME_BUDGET');
});

test('v1.1.83 a failed 120+ km exact leg never falls back into the legacy giant A/B rectangle', async()=>{
  const orm=new ORMClient();
  let longCalls=0,persistentScans=0;
  orm._findCursorLegLongDistance=async()=>{longCalls++;orm._lastCursorRouteFailure='NO_CONNECTED_PATH';return null;};
  orm._loadPersistentRailwaysInBounds=async()=>{persistentScans++;return [];};
  const a={lat:49.0069,lon:8.4037,wayId:'1',segmentIndex:0};
  const b={lat:51.3127,lon:9.4797,wayId:'2',segmentIndex:0};
  const r=await orm.findRouteViaCursorAnchors([a,b],{routeBudgetMs:180000,maxSpeed:200});
  assert.equal(r,null);
  assert.equal(longCalls,1);
  assert.equal(persistentScans,0,'hierarchical long-route failure must not trigger the old huge whole-chain persistent scan');
});

test('v1.1.83 restores v1.1.77 sub-1.2 m endpoint micro-stitch without mutating OSM geometry', async()=>{
  const orm=new ORMClient();
  const a0={lat:49,lon:8},a1={lat:49.001,lon:8.001};
  const b0={lat:49.001006,lon:8.001006},b1={lat:49.002,lon:8.002}; // <1 m crack
  const w1=mkWay('A',a0,a1,'A0','A1');
  const w2=mkWay('B',b0,b1,'B0','B1');
  const before=JSON.stringify([w1.geometry,w2.geometry]);
  const route=await orm._routeCursorCandidatesOnWays([w1,w2],{...a0,wayId:'A',segmentIndex:0},{...b1,wayId:'B',segmentIndex:0},{maxSpeed:160});
  assert.ok(route?.length>=3,'near-coincident compatible endpoints should remain connected as in v1.1.77');
  assert.equal(JSON.stringify([w1.geometry,w2.geometry]),before,'topology repair must never mutate authoritative OSM geometry');
  assert.ok(route.some(p=>p.topologyStitch==='endpoint-node') || route.length>=3);
});

test('v1.1.83 v1.1.79 turnout projection rescue is lazy and bounded', async()=>{
  const orm=new ORMClient();
  // Branch endpoint lands ~1 m from the INTERIOR of the main way at a shallow turnout angle.
  const main=mkWay('MAIN',{lat:49,lon:8},{lat:49,lon:8.02},'M0','M1');
  const branch=mkWay('BR',{lat:49.00020,lon:8.0000},{lat:48.999991,lon:8.0100},'B0','B1');
  let rescueCalls=0;
  const real=orm._applyLazyEndpointSegmentStitch.bind(orm);
  orm._applyLazyEndpointSegmentStitch=(...args)=>{rescueCalls++;return real(...args);};
  const r=await orm._routeCursorCandidatesOnWays(
    [main,branch],
    {lat:branch.geometry[0].lat,lon:branch.geometry[0].lon,wayId:'BR',segmentIndex:0},
    {lat:main.geometry[1].lat,lon:main.geometry[1].lon,wayId:'MAIN',segmentIndex:0},
    {maxSpeed:160}
  );
  assert.equal(rescueCalls,1,'projection stitch must run only after the strict graph fails');
  assert.ok(r?.length>=3,'turnout-like endpoint→segment crack should be repaired in graph only');
});

test('v1.1.83 healthy connected route never invokes endpoint→segment projection rescue', async()=>{
  const orm=new ORMClient();
  const w=mkWay('OK',{lat:49,lon:8},{lat:49.01,lon:8.01},'X','Y');
  let rescueCalls=0;orm._applyLazyEndpointSegmentStitch=()=>{rescueCalls++;return 0;};
  const r=await orm._routeCursorCandidatesOnWays([w],{lat:49,lon:8,wayId:'OK',segmentIndex:0},{lat:49.01,lon:8.01,wayId:'OK',segmentIndex:0},{maxSpeed:160});
  assert.ok(r?.length>=2);assert.equal(rescueCalls,0);
});
