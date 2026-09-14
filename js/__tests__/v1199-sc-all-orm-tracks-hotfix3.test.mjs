import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { WorldRailCache } from '../world-rail-cache.js';

function way(id, railway, aLon, bLon, nodeA, nodeB, extra={}) {
  const tags={railway,...(extra.tags||{})};
  return {
    id:String(id), railway, geometry:[{lat:48,lon:aLon},{lat:48,lon:bLon}], nodeIds:[String(nodeA),String(nodeB)],
    maxSpeed:120,maxSpeedSource:'OSM',usage:extra.usage||'',service:extra.service||'',tags,
    railwayLifecycle:extra.railwayLifecycle,railwayBaseType:extra.railwayBaseType,
  };
}

test('HOTFIX3 Overpass vector query covers every track-like OpenRailwayMap class used by SC', async()=>{
  const orm=new ORMClient();
  let query='';
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async(_url,opts={})=>{
    query=decodeURIComponent(String(opts.body||'').replace(/^data=/,''));
    return {ok:true,status:200,json:async()=>({elements:[]})};
  };
  try{
    await orm.fetchArea(48,2,48.01,2.01,{forceNetwork:true,transient:true,maxEndpoints:1,raceEndpoints:0,attemptsPerEndpoint:1,timeoutMs:2000});
  }finally{globalThis.fetch=oldFetch;}
  for(const value of ['rail','narrow_gauge','preserved','light_rail','subway','tram','miniature','funicular','construction','proposed','disused','abandoned','razed']){
    assert.match(query,new RegExp(`(?:\\||\\()${value}(?:\\||\\))`),`missing ${value} in Overpass query`);
  }
});

test('HOTFIX3 parseWays and exact picker accept lifecycle/urban ORM tracks instead of hiding visible lines', async()=>{
  const orm=new ORMClient();
  const parsed=orm.parseWays({elements:[
    {type:'way',id:1,tags:{railway:'construction','construction:railway':'rail'},geometry:[{lat:48,lon:2},{lat:48,lon:2.01}],nodes:[1,2]},
    {type:'way',id:2,tags:{railway:'disused'},geometry:[{lat:48.01,lon:2},{lat:48.01,lon:2.01}],nodes:[3,4]},
    {type:'way',id:3,tags:{railway:'tram'},geometry:[{lat:48.02,lon:2},{lat:48.02,lon:2.01}],nodes:[5,6]},
  ]});
  assert.deepEqual(parsed.map(w=>w.railway),['construction','disused','tram']);
  assert.equal(parsed[0].railwayLifecycle,'construction');
  assert.equal(parsed[0].railwayBaseType,'rail');
  orm._ways.set('2',parsed[1]);
  const c=await orm.getTrackCandidates(48.01,2.005,{radiusM:100,limit:4,localOnly:true});
  assert.ok(c.some(x=>x.wayId==='2'&&x.railway==='disused'));
});

test('HOTFIX3 a ~15 km mixed ORM corridor resolves from only departure and arrival anchors', async()=>{
  const orm=new ORMClient();
  const ways=[
    way('A','rail',2.000,2.065,'1','2',{usage:'main'}),
    way('B','construction',2.065,2.130,'2','3',{usage:'main',tags:{'construction:railway':'rail'}}),
    way('C','rail',2.130,2.195,'3','4',{usage:'main'}),
  ];
  // Use production parser semantics on the lifecycle middle section.
  ways[1]=orm.parseWays({elements:[{type:'way',id:'B',tags:{railway:'construction','construction:railway':'rail',usage:'main',maxspeed:'120'},geometry:ways[1].geometry,nodes:ways[1].nodeIds}]}).at(0);
  const route=await orm._routeCursorAnchorChainOnWays(ways,[
    {lat:48,lon:2.002,wayId:'A',segmentIndex:0},
    {lat:48,lon:2.193,wayId:'C',segmentIndex:0},
  ],{allowFallback:false,allowSyntheticStitches:false,routeObjective:'distance',allowSignalRestrictedDirection:true});
  assert.ok(route?.length>=4,'two anchors should be enough to solve the corridor');
  assert.ok(route.some(p=>String(p.wayId)==='B'),'route must be able to traverse the visible construction-colored ORM section');
});

test('HOTFIX3 inactive ORM geometry is usable but cannot become an attractive accidental shortcut',()=>{
  const orm=new ORMClient();
  const active=orm._edgeCost({dist:10,railway:'rail',railwayLifecycle:'present',railwayBaseType:'rail'},null,{routeObjective:'distance'});
  const razed=orm._edgeCost({dist:1,railway:'razed',railwayLifecycle:'razed',railwayBaseType:'rail'},null,{routeObjective:'distance'});
  assert.ok(razed>active,'a 1 km razed shortcut must lose to 10 km of active railway unless explicitly forced');
});

test('HOTFIX3 world cache rejects old positive tiles built with the restricted three-class query', async()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  const t=c.tileAt(48,2);
  c._remember({key:t.key,row:t.row,col:t.col,complete:true,negative:false,ways:[way('old','rail',2,2.01,'1','2')],schema:'rail-empire-world-rail-v2',savedAt:Date.now()});
  const rec=await c.get(t);
  assert.equal(rec,null);
  assert.equal(c.stats().invalidatedLegacySchema,1);
});
