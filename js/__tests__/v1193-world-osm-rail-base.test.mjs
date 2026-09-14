import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldRailCache } from '../world-rail-cache.js';
import { ORMClient } from '../orm.js';

function way(id,a=[47,5],b=[47.1,5.1]){return {id:String(id),railway:'rail',geometry:[{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}],nodeIds:[`${id}a`,`${id}b`],tags:{railway:'rail'}};}

test('v1.1.93 world rail grid covers any longitude and splits antimeridian bboxes',()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  assert.equal(c.tileAt(47.32,5.04).key.startsWith('wrail:0.5:'),true);
  const tiles=c.tilesForBBox(-1,179.6,1,-179.6);
  assert.ok(tiles.length>0);
  assert.ok(tiles.some(t=>t.west>=179.5));
  assert.ok(tiles.some(t=>t.east<=-179.5+0.500001));
  assert.ok(tiles.every(t=>t.west>=-180&&t.east<=180));
});

test('v1.1.93 complete OSM tile stays usable from persistent world cache without network',async()=>{
  const c=new WorldRailCache({cellDeg:0.5});
  const tile=c.tileAt(47.3,5.0),w=way(1);
  await c.put(tile,[w],{source:'test'});
  const got=await c.cachedWaysForEnvelopes([tile]);
  assert.equal(got.complete,true);
  assert.equal(got.ways.length,1);
  assert.equal(got.ways[0].id,'1');
});

test('v1.1.93 ORM worldwide fetch downloads a missing normalized cell once then reuses it',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  let network=0;
  orm._fetchRailTileResilient=async tile=>{network++;return [way(`W${tile.row}-${tile.col}`,[tile.south,tile.west],[Math.min(tile.north,tile.south+0.1),Math.min(tile.east,tile.west+0.1)])];};
  const env=[{south:47.2,west:5.0,north:47.3,east:5.1}];
  const first=await orm.fetchWorldRailwayTiles(env,null,{allowPartial:false,concurrency:1});
  const firstNetwork=network;assert.ok(first.length);assert.ok(firstNetwork>=1);
  const second=await orm.fetchWorldRailwayTiles(env,null,{allowPartial:false,concurrency:1});
  assert.equal(network,firstNetwork,'second use must be offline/cache only');
  assert.equal(second._fetchStats.cached,second._fetchStats.requested);
});

test('v1.1.93 resident ORM tags enrich but never erase base OSM geometry',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  const tile=cache.tileAt(47.3,5.0);const base=way(77,[47.25,5.0],[47.35,5.1]);await cache.put(tile,[base]);
  orm._ways.set('77',{id:'77',geometry:base.geometry,nodeIds:base.nodeIds,railway:'rail',maxSpeed:160,tags:{maxspeed:'160'}});
  const out=await orm.fetchWorldRailwayTiles([tile],null,{allowPartial:false,concurrency:1});
  const w=out.find(x=>x.id==='77');assert.ok(w);assert.equal(w.geometry.length,2);assert.equal(w.maxSpeed,160);
});

test('v1.1.93 corridor tiling follows shortest arc across the Pacific dateline',()=>{
  const orm=new ORMClient();const tiles=orm._corridorTiles(35,179.8,35,-179.8,20,5);
  assert.ok(tiles.length>=2);
  assert.ok(tiles.every(t=>(t.east-t.west)<5),'must never create a 359° bbox');
  assert.ok(tiles.some(t=>t.part==='dateline-east'));
  assert.ok(tiles.some(t=>t.part==='dateline-west'));
});

test('v1.1.93 exact track picker reopens cached world OSM vectors after reload/offline',async()=>{
  const orm=new ORMClient(),cache=new WorldRailCache({cellDeg:0.5});orm.setWorldRailCache(cache);
  orm._railGraphPack={ready:async()=>({prepared:false}),get prepared(){return false;}};
  const tile=cache.tileAt(47.323,5.027);
  const w={id:'DIJON-MAIN',railway:'rail',trackRef:'1',geometry:[{lat:47.3228,lon:5.0265},{lat:47.3234,lon:5.0275}],nodeIds:['d1','d2'],tags:{railway:'rail'}};
  await cache.put(tile,[w]);
  const out=await orm.getTrackCandidates(47.3231,5.0270,{localOnly:true,radiusM:80,limit:8});
  assert.ok(out.some(x=>x.wayId==='DIJON-MAIN'));
});


test('v1.1.93 world OSM authority invalidates pre-world remembered routes',()=>{
  const route=String(ORMClient.prototype._cursorRouteMemoryKey);
  const leg=String(ORMClient.prototype._scheduleExactLegKey);
  assert.match(route,/schedule-route-v7/);
  assert.match(leg,/exact-leg-v4/);
  assert.doesNotMatch(route,/schedule-route-v6/);
  assert.doesNotMatch(leg,/exact-leg-v3/);
});

test('v1.1.93 source exposes worldwide cache controls and global runtime manifest',async()=>{
  const {readFileSync}=await import('node:fs');
  const root=new URL('../../',import.meta.url);
  const editor=readFileSync(new URL('js/schedule-v2-editor.js',root),'utf8');
  const orm=readFileSync(new URL('js/orm.js',root),'utf8');
  const manifest=readFileSync(new URL('data/railnet/tracks/manifest.js',root),'utf8');
  assert.match(editor,/world-osm-status/);
  assert.match(editor,/world-osm-refresh/);
  assert.match(orm,/fetchWorldRailwayTiles/);
  assert.match(manifest,/runtimeWorldCoverage:\s*'global'/);
  assert.match(manifest,/runtimeWorldCellDeg:\s*0\.5/);
});
