import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WorldRailCache } from '../world-rail-cache.js';
import { ORMClient } from '../orm.js';

function way(id,a=[47.30,5.00],b=[47.35,5.08]){
  return {id:String(id),railway:'rail',geometry:[{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}],nodeIds:[`${id}a`,`${id}b`],tags:{railway:'rail'}};
}

const env=[{south:47.20,west:5.00,north:47.30,east:5.10}];

test('v1.1.94 a single zero-way response can never become a permanent complete world tile',async()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  const tile=c.tileAt(47.3,5.0);
  assert.equal(await c.put(tile,[],{source:'one HTTP 200',complete:true}),false);
  assert.equal(await c.get(tile),null);
  const s=c.stats();
  assert.equal(s.memoryTiles,0);
  assert.equal(s.rejectedEmpty,1);
});

test('v1.1.99 HOTFIX3 legacy world-cache schemas are rejected automatically',async()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  const tile=c.tileAt(47.3,5.0);
  c._remember({key:tile.key,row:tile.row,col:tile.col,complete:true,ways:[],schema:'rail-empire-world-rail-v1',savedAt:Date.now()-1000});
  assert.equal(await c.get(tile),null);
  assert.equal(c.stats().memoryTiles,0);
  assert.equal(c.stats().invalidatedLegacySchema,1);
});

test('v1.1.94 only independently verified empty cells may be negative-cached, and they expire',async()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  const tile=c.tileAt(0,0);
  assert.equal(await c.putVerifiedEmpty(tile,{confirmations:1}),false);
  assert.equal(await c.putVerifiedEmpty(tile,{confirmations:2,ttlMs:5*60*1000}),true);
  const live=await c.get(tile);
  assert.equal(live?.negative,true);
  assert.equal(live?.ways?.length,0);
  c._memory.get(tile.key).expiresAt=Date.now()-1;
  assert.equal(await c.get(tile),null);
  assert.ok(c.stats().expiredEmpty>=1);
});

test('v1.1.94 a second independent endpoint can recover rail after a false empty first response',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  let firstCalls=0,verifyCalls=0;
  orm._fetchRailTileResilient=async()=>{firstCalls++;return [];};
  orm.fetchArea=async()=>{verifyCalls++;return {ok:true,ways:[way('DIJON-BEAUNE')],source:'independent-endpoint'};};
  const out=await orm.fetchWorldRailwayTiles(env,null,{allowPartial:false,concurrency:1});
  assert.equal(firstCalls,1);
  assert.equal(verifyCalls,1);
  assert.ok(out.some(w=>w.id==='DIJON-BEAUNE'));
  const cached=await cache.cachedWaysForEnvelopes(env);
  assert.equal(cached.complete,true);
  assert.ok(cached.ways.some(w=>w.id==='DIJON-BEAUNE'));
  assert.equal(cached.tiles.some(t=>cache._memory.get(t.key)?.negative===true),false);
});

test('v1.1.94 two independent empty observations create only a short-lived verified negative tile',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  let firstCalls=0,verifyCalls=0;
  orm._fetchRailTileResilient=async()=>{firstCalls++;return [];};
  orm.fetchArea=async()=>{verifyCalls++;return {ok:true,ways:[],source:'independent-empty'};};
  const first=await orm.fetchWorldRailwayTiles(env,null,{allowPartial:false,concurrency:1});
  assert.equal(first.length,0);
  assert.equal(firstCalls,1);
  assert.equal(verifyCalls,1);
  const cells=cache.tilesForEnvelopes(env);
  assert.equal(cells.length,1);
  const rec=await cache.get(cells[0]);
  assert.equal(rec?.negative,true);
  assert.equal(rec?.emptyConfirmations,2);
  assert.ok(Number(rec?.expiresAt)>Date.now());
  await orm.fetchWorldRailwayTiles(env,null,{allowPartial:false,concurrency:1});
  assert.equal(firstCalls,1,'verified negative cache should avoid immediate repeated network calls');
  assert.equal(verifyCalls,1);
});

test('v1.1.94 an empty response that cannot be independently verified remains missing and is retried later',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  let firstCalls=0,verifyCalls=0;
  orm._fetchRailTileResilient=async()=>{firstCalls++;return [];};
  orm.fetchArea=async()=>{verifyCalls++;return {ok:false,ways:[],source:'failed',error:new Error('endpoint unavailable')};};
  const first=await orm.fetchWorldRailwayTiles(env,null,{allowPartial:true,concurrency:1});
  assert.equal(first.length,0);
  assert.equal(first._fetchStats.failed,1);
  const miss=await cache.cachedWaysForEnvelopes(env);
  assert.equal(miss.complete,false);
  assert.equal(miss.missing.length,1);
  await orm.fetchWorldRailwayTiles(env,null,{allowPartial:true,concurrency:1});
  assert.equal(firstCalls,2,'unverified empty cell must be retried, not fossilised');
  assert.ok(verifyCalls>=4,'all independent endpoints are attempted when verification fails');
});

test('v1.1.94 manifest accurately documents first-use OSM fetch instead of claiming routing is network-free',()=>{
  const manifest=readFileSync(new URL('../../data/railnet/tracks/manifest.js',import.meta.url),'utf8');
  assert.match(manifest,/first use of an uncached world cell may fetch OSM\/Overpass/i);
  assert.doesNotMatch(manifest,/never fetches OSM\/Overpass during schedule routing/i);
});


test('v1.1.94 packaged identity and cache generations are current',()=>{
  const version=readFileSync(new URL('../../VERSION.txt',import.meta.url),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  const index=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const orm=readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.equal(version,'1.1.99');
  assert.equal(pkg.version,'1.1.99');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(orm,/schedule-route-v7/);
  assert.match(orm,/exact-leg-v4/);
});
