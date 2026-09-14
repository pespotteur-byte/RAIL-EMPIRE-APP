import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
function fixture(){const o=new ORMClient();o._cacheReady=Promise.resolve();return o;}
test('RC3-QA02-01: station-query cache evicts old tiles instead of growing with exploration',()=>{
 const o=fixture(),original=[{id:'world-station'}];o._stationsOSM=original;o._stationAreaCache.set('recent',[]);
 for(let i=0;i<300;i++)o._stationAreaCache.set(String(i),[{id:i}]);
 assert.ok(o._stationAreaCache.size<=128);assert.equal(o._stationAreaCache.has('0'),false);assert.equal(o._stationsOSM,original);assert.equal(o._stationsOSM.length,1);
});
test('RC3-QA02-02: reading a recently used tile protects it from LRU eviction',()=>{
 const o=fixture(),cache=o._stationAreaCache;for(let i=0;i<128;i++)cache.set(i,[]);
 cache.get(0);cache.set(128,[]);assert.equal(cache.has(0),true);assert.equal(cache.has(1),false);
});
test('RC3-QA02-03: retained point budget is bounded, values are never truncated',()=>{
 const o=fixture(),cache=o._stationAreaCache;const a=Array.from({length:1000},(_,i)=>({id:i}));
 for(let i=0;i<100;i++)cache.set(i,a);
 const retained=[...cache.values()].reduce((n,a)=>n+a.length,0);assert.ok(retained<=50000);assert.equal(a.length,1000);
});
test('RC3-QA02-04: switch eviction also removes its spatial-index entry, without touching rail topology',()=>{
 const o=fixture();o._ways.set('operational',{id:'operational'});
 for(let i=0;i<300;i++){const key=String(i);o._switchAreaCache.set(key,[{id:key,lat:48,lon:2}]);if(o._switchAreaCache.has(key))o._loadedSwitchBboxes.push({key,south:47,north:49,west:1,east:3});}
 assert.ok(o._switchAreaCache.size<=128);assert.ok(o._loadedSwitchBboxes.length<=128);
 for(const b of o._loadedSwitchBboxes)assert.equal(o._switchAreaCache.has(b.key),true);
 assert.equal(o._ways.has('operational'),true);assert.equal(o.getLoadedRailwaySwitchesInBounds(47,1,49,3).length,o._switchAreaCache.size);
 o._switchAreaCache.clear();assert.equal(o._loadedSwitchBboxes.length,0);
});
test('RC3-QA02-05: an evicted station tile reloads from persistent storage without a network request',async()=>{
 const o=fixture();const raw=[{id:'A',urbanTransit:false}];o._loadCachedArea=async()=>({stations:raw});
 o._stationAreaCache.set('stations-v6:1.0000,2.0000,3.0000,4.0000',raw);
 for(let i=0;i<200;i++)o._stationAreaCache.set('filler'+i,[]);
 const r=await o.fetchStationsArea(1,2,3,4,{withStatus:true});assert.equal(r.source,'persistent-cache');assert.equal(r.stations[0],raw[0]);
});
test('RC3-QA02-06: oversized fetch output is returned intact but not retained in RAM cache',async()=>{
 const o=fixture(),large=Array.from({length:50001},()=>({id:'A',urbanTransit:false}));o._loadCachedArea=async()=>({stations:large});
 const r=await o.fetchStationsArea(1,2,3,4,{withStatus:true});assert.equal(r.stations.length,50001);assert.equal(o._stationAreaCache.size,0);
});
