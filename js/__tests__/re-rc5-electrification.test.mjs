import test from 'node:test';
import assert from 'node:assert/strict';
import {ActiveService} from '../schedule-creator.js';
import {RouteElectrificationIndex} from '../route-electrification-index.js';
function reference(route,start){for(let i=start;i<route.length-1;i++)if(route[i]?.electrified===false||route[i+1]?.electrified===false)return i;return null;}
test('RC5-PERF: 300 mixed route snapshots match a linear scan at every segment',()=>{
 let seed=5005;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 const ix=new RouteElectrificationIndex();
 for(let n=0;n<300;n++){
  const route=Array.from({length:2+Math.floor(rng()*1000)},()=>({electrified:[false,true,undefined,null,'yes'][Math.floor(rng()*5)]}));
  for(let i=0;i<route.length-1;i++)assert.equal(ix.next(route,i),reference(route,i));
 }
});
test('RC5-PERF: reusing an index for a new equal-length route observes its new gaps',()=>{
 const ix=new RouteElectrificationIndex(),a=Array.from({length:40},()=>({electrified:true})),b=a.map(p=>({...p}));b[35].electrified=false;
 assert.equal(ix.next(a,0),null);assert.equal(ix.next(b,0),34);assert.equal(ix.next(a,0),null);
});
test('RC5-PERF: explicit route rebuild/reset observes in-place infrastructure changes',()=>{
 const ix=new RouteElectrificationIndex(),route=Array.from({length:40},()=>({electrified:true}));assert.equal(ix.next(route,0),null);route[20].electrified=false;ix.reset();assert.equal(ix.next(route,0),19);
});
test('RC5-PERF: no repeated electrification reads after indexing a long fully wired leg',()=>{
 let reads=0;const p={get electrified(){reads++;return true;}};const route=Array(100000).fill(p),ix=new RouteElectrificationIndex();
 assert.equal(ix.next(route,0),null);const first=reads;
 for(let i=0;i<10000;i++)assert.equal(ix.next(route,i),null);
 assert.equal(reads,first);
});
test('RC5-PERF: the real ActiveService method returns exact front-to-gap distance, including inside a gap',()=>{
 const route=Array.from({length:10},(_,i)=>({lat:48,lon:2+i*.01,electrified:i!==6}));
 const svc=Object.create(ActiveService.prototype);svc.rame={traction:'electric'};svc._state={index:2};
 svc._routeCumulativeKm=()=>[0,1,2,3,4,5,6,7,8,9];svc._currentFrontKm=()=>2.3;
 assert.equal(svc._distanceAheadToElectrificationMismatch(route),2.7);
 svc._state.index=5;svc._currentFrontKm=()=>5.4;assert.equal(svc._distanceAheadToElectrificationMismatch(route),0);
 svc._state.index=7;assert.equal(svc._distanceAheadToElectrificationMismatch(route),Infinity);
 svc.rame.traction='diesel';svc._state.index=0;assert.equal(svc._distanceAheadToElectrificationMismatch(route),Infinity);
});
test('RC5-PERF: ActiveService reset drops its index, avoiding retention across finished legs',()=>{
 const svc=Object.create(ActiveService.prototype);let reset=0;svc._electrificationIndex={reset(){reset++;}};svc._state={};svc._resetState();assert.equal(reset,1);
});
