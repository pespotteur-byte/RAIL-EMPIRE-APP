import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

const throatFixture={
  version:0.6,
  elements:[
    {type:'node',id:1,lat:49.00000,lon:3.00000},
    {type:'node',id:2,lat:49.00000,lon:3.00100,tags:{railway:'switch',ref:'34a'}},
    {type:'node',id:3,lat:49.00000,lon:3.00200},
    {type:'node',id:4,lat:49.00010,lon:3.00000},
    {type:'node',id:5,lat:49.00010,lon:3.00100,tags:{railway:'switch',ref:'34b'}},
    {type:'node',id:6,lat:49.00010,lon:3.00200},
    {type:'way',id:101,nodes:[1,2,3],tags:{railway:'rail','railway:track_ref':'1'}},
    {type:'way',id:102,nodes:[4,5,6],tags:{railway:'rail','railway:track_ref':'2'}},
    {type:'way',id:103,nodes:[2,5],tags:{railway:'rail',service:'crossover'}},
  ],
};

function response(data){return {ok:true,status:200,json:async()=>structuredClone(data)};}

test('v1.1.49 main OSM map parser preserves exact node IDs and switch refs',()=>{
  const orm=new ORMClient();
  const parsed=orm._parseOsmMainMap(throatFixture);
  assert.equal(parsed.ways.length,3);
  assert.deepEqual(parsed.ways.find(w=>w.id===103).nodeIds,[2,5]);
  assert.deepEqual(parsed.switches.map(s=>s.ref).sort(),['34a','34b']);
});

test('v1.1.49 300 m station throat routes from official OSM map data without Overpass',async()=>{
  const oldFetch=globalThis.fetch;
  let directCalls=0;
  globalThis.fetch=async(url)=>{
    assert.match(String(url),/api\.openstreetmap\.org\/api\/0\.6\/map\.json\?bbox=/);
    directCalls++;
    return response(throatFixture);
  };
  try{
    const orm=new ORMClient();
    orm._ways.clear(); orm._loadedBboxes=[]; orm.areaCache.clear();
    let overpassCalls=0;
    orm.fetchArea=async()=>{overpassCalls++;return {ok:false,ways:[]};};
    const route=await orm.findRouteViaCursorAnchors([
      {lat:49.00000,lon:3.00020,wayId:'101'},
      {lat:49.00010,lon:3.00180,wayId:'102'},
    ],{allowFallback:false});
    assert.ok(route?.length>=2,'route should use real OSM crossover');
    assert.equal(overpassCalls,0,'Overpass must not be touched when tiny OSM map data already routes');
    assert.equal(directCalls,1);
    assert.ok(route.some(p=>String(p.wayId||'')==='103'),'route should cross the real crossover way');
    assert.equal(orm._lastCursorRouteFailure,'');
  } finally { globalThis.fetch=oldFetch; }
});

test('v1.1.49 track picker uses tiny OSM map API before Overpass',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>response(throatFixture);
  try{
    const orm=new ORMClient();
    orm._ways.clear(); orm._loadedBboxes=[]; orm.areaCache.clear();
    let overpassCalls=0;
    orm.fetchArea=async()=>{overpassCalls++;return {ok:false,ways:[]};};
    const hits=await orm.getTrackCandidates(49.00000,3.0005,{radiusM:40,limit:8});
    assert.ok(hits.length>=1);
    assert.equal(hits[0].wayId,'101');
    assert.equal(overpassCalls,0);
  } finally { globalThis.fetch=oldFetch; }
});

test('v1.1.49 direct main-API data also feeds OSM-engine switch overlay cache',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>response(throatFixture);
  try{
    const orm=new ORMClient();
    await orm.fetchSmallOsmMapArea(48.9995,2.9995,49.0005,3.0025,{timeoutMs:2000});
    const sw=orm.getLoadedRailwaySwitchesInBounds(48.999,2.999,49.001,3.003);
    assert.deepEqual(sw.map(x=>x.ref).sort(),['34a','34b']);
    const ways=orm.getLoadedRailwaysInBounds(48.999,2.999,49.001,3.003);
    assert.equal(ways.length,3);
  } finally { globalThis.fetch=oldFetch; }
});

test('v1.1.49 error text distinguishes vector OSM routing from raster OpenRailwayMap',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-routing.js',import.meta.url),'utf8');
  assert.match(src,/Données vectorielles OSM de routage/);
  assert.match(src,/fond OpenRailwayMap peut rester visible/);
});

test('v1.1.49 adds a third current global Overpass failover endpoint',()=>{
  const src=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(src,/maps\.mail\.ru\/osm\/tools\/overpass\/api\/interpreter/);
  assert.match(src,/api\.openstreetmap\.org\/api\/0\.6\/map\.json/);
});
