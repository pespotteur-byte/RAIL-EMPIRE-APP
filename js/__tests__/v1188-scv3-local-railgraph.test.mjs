import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { RailGraphPack } from '../railgraph-pack.js';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const packDir=path.resolve(here,'../../test-fixtures/scv3-railgraph/pack');
const manifest=JSON.parse(fs.readFileSync(path.join(packDir,'manifest.json'),'utf8'));
let importSerial=0;

function makePack(opts={}){
  globalThis.__RAILNET_TRACK_PACK__=manifest;
  return new RailGraphPack({basePath:'',maxLoadedShards:opts.maxLoadedShards,maxResidentBytes:opts.maxResidentBytes,maxConcurrentShardLoads:opts.maxConcurrentShardLoads,scriptLoader:async(_src,{meta})=>{
    const u=pathToFileURL(path.join(packDir,meta.file)).href+`?t=${++importSerial}`;
    await import(u);
  }});
}
function binding(wayId,lat,lon,segmentIndex=0){return {wayId:String(wayId),lat,lon,snapLat:lat,snapLon:lon,segmentIndex};}

// This fixture spans several local shards, contains a shorter-looking service
// siding, a disconnected railway, and a tram which the builder must exclude.
test('SCV3 pack is prepared from exact railway geometry and excludes strict tram',async()=>{
  const pack=makePack(); await pack.ready();
  assert.equal(pack.prepared,true);
  assert.equal(pack.manifest.stats.ways,5);
  assert.ok(pack.manifest.stats.shards>=3);
  const ways=await pack.ensureForAnchors([binding(100,49,8.405),binding(102,49,8.425)],{neighborRing:0});
  assert.ok(ways.some(w=>String(w.id)==='100'));
  assert.ok(ways.some(w=>String(w.id)==='102'));
  assert.equal(ways.some(w=>String(w.id)==='900'),false);
});

test('SCV3 Schedule route uses local RailGraph only and never calls OSM/Overpass',async()=>{
  const orm=new ORMClient(); const pack=makePack(); await pack.ready(); orm.setRailGraphPack(pack);
  let network=0;
  orm.fetchArea=async()=>{network++;throw new Error('network forbidden');};
  orm.fetchSmallOsmMapArea=async()=>{network++;throw new Error('network forbidden');};
  orm.fetchRailwayTiles=async()=>{network++;throw new Error('network forbidden');};
  const router=new ScheduleV2Router(orm);
  const route=await router.routeBetweenBindings(binding(100,49,8.405,0),binding(102,49,8.425,0),[],{maxSpeed:160});
  assert.ok(route?.length>=4);
  assert.equal(network,0);
  assert.ok(route.every(p=>!p.fallback));
  assert.ok(route.some(p=>String(p.wayId)==='101'),'main railway continuation must be used');
  assert.equal(route.some(p=>String(p.wayId)==='200'),false,'service siding must lose to normal main route');
});

test('SCV3 local track picker returns physical track metadata without network',async()=>{
  const orm=new ORMClient(); const pack=makePack(); await pack.ready(); orm.setRailGraphPack(pack);
  orm.fetchArea=async()=>{throw new Error('network forbidden');};
  orm.fetchSmallOsmMapArea=async()=>{throw new Error('network forbidden');};
  const c=await orm.getTrackCandidates(49,8.405,{radiusM:30,limit:4,localOnly:true});
  assert.ok(c.length);
  assert.equal(c[0].wayId,'100');
  assert.equal(c[0].trackRef,'1');
});

test('SCV3 does not invent a blue/straight connector across a real source topology gap',async()=>{
  const orm=new ORMClient(); const pack=makePack(); await pack.ready(); orm.setRailGraphPack(pack);
  const r=await orm.findRouteViaLocalRailGraphAnchors([
    binding(100,49,8.405,0), binding(300,49.05,8.505,0)
  ],{allowSyntheticStitches:false,allowFallback:false,routeObjective:'distance'});
  assert.equal(r,null);
  assert.equal(orm._lastCursorRouteFailure,'SOURCE_TOPOLOGY_GAP');
});

test('SCV3 corridor expansion has no fixed 0..3 retry limit',()=>{
  const source=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(source,/for\(let ring=0;;ring\+\+\)/);
  assert.doesNotMatch(source,/const rings=\[0,1,2,3\]/);
});


test('SCV3 bounds resident shard memory and can reload an evicted shard',async()=>{
  const pack=makePack({maxLoadedShards:16});await pack.ready();
  // Force a tiny effective cap after construction (constructor keeps a safe production floor).
  pack.maxLoadedShards=2;
  await pack._loadIndexes([0,1,2,3]);
  assert.equal(pack.loadedShards.size,4);
  const evicted=pack.trimCache();
  assert.equal(evicted,2);
  assert.equal(pack.loadedShards.size,2);
  assert.ok(pack.ways.size>0);
  const before=new Set(pack.loadedShards);
  const missing=[0,1,2,3].find(i=>!before.has(pack._shardId(i)));
  assert.notEqual(missing,undefined);
  await pack._loadShardIndex(missing);
  assert.ok(pack.loadedShards.has(pack._shardId(missing)));
  const orm=new ORMClient();orm.setRailGraphPack(pack);
  const route=await orm.findRouteViaLocalRailGraphAnchors([binding(100,49,8.405),binding(102,49,8.425)],{allowSyntheticStitches:false});
  assert.ok(route?.length>=4);
  assert.ok(pack.loadedShards.size<=pack.maxLoadedShards);
});


test('SCV3 does not retain an oversized exact graph after routing',async()=>{
  const orm=new ORMClient();const pack=makePack();await pack.ready();orm.setRailGraphPack(pack);
  orm._schedulePackedGraphCacheMaxWays=1;orm._schedulePackedGraphCacheMaxNodes=2;
  const route=await orm.findRouteViaLocalRailGraphAnchors([binding(100,49,8.405),binding(102,49,8.425)],{allowSyntheticStitches:false});
  assert.ok(route?.length>=4);
  assert.equal(orm._schedulePackedGraphCache,null);
});


test('SCV3 prepared pack cannot have its track click stolen by stale resident ORM ways',async()=>{
  const orm=new ORMClient();const pack=makePack();await pack.ready();orm.setRailGraphPack(pack);
  orm._ways.set('STALE',{id:'STALE',geometry:[{lat:49,lon:8.405},{lat:49.001,lon:8.405}],nodeIds:['S1','S2'],railway:'rail',trackRef:'X',tags:{railway:'rail'}});
  const c=await orm.getTrackCandidates(49,8.405,{radiusM:30,limit:4,localOnly:true});
  assert.ok(c.length);
  assert.equal(c[0].wayId,'100');
  assert.equal(c.some(x=>x.wayId==='STALE'),false);
});


test('SCV3 always loads exact anchor cells even when coarse corridor omits them',async()=>{
  const pack=makePack();await pack.ready();
  pack._coarseRoute=()=>({distanceKm:1,nodePath:[],shardIndexes:[]});
  const ways=await pack.ensureForAnchors([binding(100,49,8.405),binding(102,49,8.425)],{neighborRing:0});
  assert.ok(ways.some(w=>String(w.id)==='100'),'departure anchor cell must be present');
  assert.ok(ways.some(w=>String(w.id)==='102'),'arrival anchor cell must be present');
});


test('SCV3 upgrades a partial duplicate way to the complete same-way geometry',async()=>{
  const pack=new RailGraphPack({basePath:'',scriptLoader:async(_src,{meta})=>{
    globalThis.__RAILNET_TRACK_SHARDS__=globalThis.__RAILNET_TRACK_SHARDS__||Object.create(null);
    const partial={id:'W',geometry:[{lat:49,lon:8},{lat:49,lon:8.01}],nodeIds:['1','2'],tags:{railway:'rail'}};
    const full={id:'W',geometry:[{lat:49,lon:8},{lat:49,lon:8.01},{lat:49,lon:8.02}],nodeIds:['1','2','3'],tags:{railway:'rail'}};
    globalThis.__RAILNET_TRACK_SHARDS__[String(meta.id)]={id:String(meta.id),ways:[Number(meta.order)===0?partial:full]};
  }});
  pack.manifest={prepared:true,shards:[{id:'A',file:'a',order:0},{id:'B',file:'b',order:1}],grid:{cellDeg:1,cells:{}},coarse:{nodes:[],edges:[]}};
  await pack._loadShardIndex(0);assert.deepEqual(pack.ways.get('W').nodeIds,['1','2']);
  await pack._loadShardIndex(1);assert.deepEqual(pack.ways.get('W').nodeIds,['1','2','3']);
});


test('SCV3 96 MiB memory governor preserves the exact route quality',async()=>{
  const a=new ORMClient(),b=new ORMClient();
  const unrestricted=makePack({maxResidentBytes:512*1024*1024,maxConcurrentShardLoads:6});
  const capped=makePack({maxResidentBytes:96*1024*1024,maxConcurrentShardLoads:2});
  await unrestricted.ready();await capped.ready();a.setRailGraphPack(unrestricted);b.setRailGraphPack(capped);
  const anchors=[binding(100,49,8.405,0),binding(102,49,8.425,0)];
  const r1=await a.findRouteViaLocalRailGraphAnchors(anchors,{allowSyntheticStitches:false});
  const r2=await b.findRouteViaLocalRailGraphAnchors(anchors,{allowSyntheticStitches:false});
  assert.ok(r1?.length>=4&&r2?.length>=4);
  assert.deepEqual(r2.map(p=>String(p.wayId??'')),r1.map(p=>String(p.wayId??'')),'memory cap must not change the physical route');
  assert.ok(capped.stats().residentBytes<=capped.stats().maxResidentBytes);
  assert.equal(capped.stats().maxResidentBytes,96*1024*1024);
  assert.equal(capped.stats().maxConcurrentShardLoads,2);
});

test('SCV3 memory governor fails closed before loading an exact corridor that cannot fit',async()=>{
  const huge=JSON.parse(JSON.stringify(manifest));
  huge.shards=huge.shards.map(x=>({...x,runtimeEstimateBytes:12*1024*1024}));
  globalThis.__RAILNET_TRACK_PACK__=huge;
  const pack=new RailGraphPack({basePath:'',maxResidentBytes:8*1024*1024,maxConcurrentShardLoads:1,scriptLoader:async()=>{throw new Error('must fail before shard IO');}});
  await pack.ready();
  await assert.rejects(
    pack.ensureForAnchors([binding(100,49,8.405),binding(102,49,8.425)],{neighborRing:0}),
    e=>e?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED'&&e.requiredBytes>e.budgetBytes
  );
  assert.equal(pack.loadedShards.size,0);
  assert.equal(pack.ways.size,0);
});


test('SCV3 memory pressure is reported explicitly and never falls back to fake geometry',async()=>{
  const orm=new ORMClient();
  const err=Object.assign(new Error('too large'),{code:'RAILGRAPH_MEMORY_BUDGET_EXCEEDED',requiredBytes:140*1024*1024,budgetBytes:96*1024*1024});
  orm.setRailGraphPack({prepared:true,ready:async()=>({prepared:true}),ensureForAnchors:async()=>{throw err;},trimCache:()=>0});
  const route=await orm.findRouteViaLocalRailGraphAnchors([binding(100,49,8.405),binding(102,49,8.425)],{allowFallback:false,allowSyntheticStitches:false});
  assert.equal(route,null);
  assert.equal(orm._lastCursorRouteFailure,'RAILGRAPH_MEMORY_BUDGET_EXCEEDED');
  assert.equal(orm._lastRoutingFailure?.budgetBytes,96*1024*1024);
});


test('ScheduleV2Router exposes memory budget failure instead of generic no-path',async()=>{
  const orm=new ORMClient();
  orm.findRouteViaLocalRailGraphAnchors=async()=>{orm._lastCursorRouteFailure='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';orm._lastRoutingFailure={requiredBytes:140*1024*1024,budgetBytes:96*1024*1024};return null;};
  orm.isFallbackRoute=()=>false;
  const router=new ScheduleV2Router(orm);
  await assert.rejects(
    router.routeBetweenBindings(binding(100,49,8.405),binding(102,49,8.425),[],{}),
    e=>e?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED'&&/140 Mo nécessaires/.test(e.message)&&/96 Mo autorisés/.test(e.message)
  );
});
