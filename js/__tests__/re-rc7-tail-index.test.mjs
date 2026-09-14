import test from 'node:test';
import assert from 'node:assert/strict';
import {TailSpeedIndex} from '../tail-speed-index.js';
import {ActiveService} from '../schedule-creator.js';
function reference(d,s,idx,p,len){let i=Math.max(0,Math.min(idx,d.length-1)),m=Math.min(s[i]??Infinity,s[i+1]??Infinity),r=Math.max(0,len||0)/1000-Math.max(0,Math.min(1,p||0))*(d[i]||0);i--;while(r>0&&i>=0){m=Math.min(m,s[i]??Infinity,s[i+1]??Infinity);r-=d[i]||0;i--;}if(r>0)m=Math.min(m,s[0]);return m;}
test('RC7-PERF: compact speed index matches the old backward scan over 40,000 seeded queries',()=>{
 let seed=701;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let z=0;z<200;z++){const n=2050+Math.floor(rng()*5000),d=Float64Array.from({length:n},()=>rng()<.05?0:rng()*.01),s=Array.from({length:n+1},()=>[0,30,60,80,120,160][Math.floor(rng()*6)]);const x=new TailSpeedIndex(d,s);
  for(let q=0;q<200;q++){const i=Math.floor(rng()*n),p=rng(),len=rng()*7500;assert.equal(x.minimum(i,p,len),reference(d,s,i,p,len));}
 }
});
test('RC7-PERF: exact and near-exact tail boundaries preserve the reference floating-point decisions',()=>{
 const d=Float64Array.from({length:4096},(_,i)=>i%4?1e-5:3e-5),s=Array.from({length:4097},(_,i)=>i%61?160:30),x=new TailSpeedIndex(d,s);
 for(let start=300;start<4000;start+=37)for(let count=1;count<start;count+=73){let length=0;for(let i=start-1;i>=start-count;i--)length+=d[i];for(const delta of [-1e-12,0,1e-12]){const l=(length+delta)*1000;assert.equal(x.minimum(start,0,l),reference(d,s,start,0,l));}}
});
test('RC7-PERF: empty geometry and zero-length vertices cannot hide restrictions',()=>{assert.equal(new TailSpeedIndex(new Float64Array(),[30]).minimum(0,0,200),30);const d=new Float64Array(4096),s=Array(4097).fill(160);s[13]=30;const x=new TailSpeedIndex(d,s);assert.equal(x.minimum(4095,0,200),30);assert.equal(x.minimum(4095,0,0),160);});
test('RC7-PERF: index storage is 16 bytes per block, not per vertex',()=>{const n=150000,x=new TailSpeedIndex(new Float64Array(n).fill(.0001),Array(n+1).fill(160));assert.equal(x.bytes,Math.ceil(n/64)*16);assert.ok(x.bytes<40000);});
test('RC7-PERF: active service invalidates the index after route/reset and material speed changes',()=>{const s=Object.create(ActiveService.prototype),route=Array.from({length:2200},(_,i)=>({lat:48,lon:2+i*.00001,maxSpeed:160,maxSpeedSource:'OSM'}));s.rame={maxSpeed:160};s.train={maxSpeed:160};s._state={segDists:new Float64Array(2199).fill(.001)};assert.equal(s._getInfraSpeedLimit(route,2100,0,750),160);assert.ok(s._tailSpeedIndex);s.rame.maxSpeed=80;assert.equal(s._getInfraSpeedLimit(route,2100,0,750),80);s._resetState();assert.equal(s._tailSpeedIndex,null);});
test('RC7-PERF: malformed array lengths are rejected explicitly',()=>{assert.throws(()=>new TailSpeedIndex(new Float64Array(2),[30]),RangeError);});
test('RC7-PERF: corrupt snapshot hold entries are filtered and minima stay conservative',async()=>{const{normalizePassageTailSpeedHolds}=await import('../tail-speed-index.js');assert.deepEqual(normalizePassageTailSpeedHolds(null),[]);const out=normalizePassageTailSpeedHolds([null,{endTravelKm:Infinity,limitKmh:30},{endTravelKm:1,limitKmh:-10},{endTravelKm:1,limitKmh:160},{endTravelKm:2,limitKmh:30},{endTravelKm:3,limitKmh:80}]);assert.deepEqual(out,[{endTravelKm:2,limitKmh:30},{endTravelKm:3,limitKmh:80}]);});
test('RC7-PERF: long but ordinary-density routes retain the scan without constructing an index',()=>{const s=Object.create(ActiveService.prototype),route=Array.from({length:50001},(_,i)=>({lat:48,lon:2+i*.0001,maxSpeed:160,maxSpeedSource:'OSM'}));s.rame={maxSpeed:160};s.train={maxSpeed:160};s._state={segDists:new Float64Array(50000).fill(.01),cumDist:Float64Array.of(500)};assert.equal(s._getInfraSpeedLimit(route,49000,0,750),160);assert.ok(!s._tailSpeedIndex);});
