import test from 'node:test';
import assert from 'node:assert/strict';
import {compactJson, expandJson, encodeJson, decodeJson} from '../storage-codec.js';
import * as baseline from '../../QA/RE_REPAIR_RC14/baseline/storage-codec-rc13.mjs';
import {SchedulePath} from '../schedule-v2-model.js';

function points(n=2000,seed=13) {
 let x=seed; return Array.from({length:n},(_,i)=>{
  x=(Math.imul(x,1664525)+1013904223)>>>0;
  return {lat:48+i/15300+(x%999)/1e8,lon:2+i/20000,wayId:'w'+(i>>4),maxSpeed:120,electrified:true};
 });
}
function route(n=6000) {return new SchedulePath({legs:[{id:'L',routePoints:points(n)}]}).toJSON().legs[0].routePacked;}
function variants(count=10) {const r=route();return {scheduleV2:{schedules:Array.from({length:count},(_,i)=>({id:'S'+i,routePacked:{...structuredClone(r),metaDict:r.metaDict.map(m=>({...m,custom:'variant '+i}))}}))}};}
function check(v,options){const c=compactJson(v,options);assert.equal(c.rawBytes,new Blob([JSON.stringify(v)]).size);assert.deepEqual(expandJson(c.json),JSON.parse(JSON.stringify(v)));return c;}

test('RC14 SC: exact shared columns with distinct metadata',async()=>{const v=variants();const c=check(v);assert.ok(c.references>=9*3);assert.ok(c.compactBytes < baseline.compactJson(v).compactBytes/5);assert.deepEqual(await decodeJson(await encodeJson(v)),v);});
test('RC14 SC: RC13 reader can expand RC14 references',async()=>{const v=variants();assert.deepEqual(baseline.expandJson(compactJson(v).json),v);assert.deepEqual(await baseline.decodeJson(await encodeJson(v)),v);});
test('RC14 SC: RC14 reader accepts RC13 compact gzip',async()=>{const v=variants();assert.deepEqual(await decodeJson(await baseline.encodeJson(v)),v);});
test('RC14 SC: single short route retains byte-identical RC13 output',async()=>{const v=new SchedulePath({id:'short',legs:[{id:'L',routePoints:points(1500)}]}).toJSON();assert.equal(compactJson(v).json,baseline.compactJson(v).json);assert.equal((await encodeJson(v)).storedBytes,(await baseline.encodeJson(v)).storedBytes);});
test('RC14 SC: exact whole-route sharing retained',()=>{const r=route(),v={a:{routePacked:r},b:{routePacked:r}};const c=check(v);assert.equal(c.references,1);assert.equal(c.json,baseline.compactJson(v).json);});
test('RC14 SC: independently editable restored columns and metadata',()=>{const v=variants(5),out=expandJson(compactJson(v).json);out.scheduleV2.schedules[1].routePacked.coords[0]+=123;assert.deepEqual(out.scheduleV2.schedules[0],v.scheduleV2.schedules[0]);assert.deepEqual(out.scheduleV2.schedules[2],v.scheduleV2.schedules[2]);assert.notEqual(out.scheduleV2.schedules[0].routePacked.metaDict[0].custom,out.scheduleV2.schedules[1].routePacked.metaDict[0].custom);});
test('RC14 SC: near coordinates are never rounded or discarded',()=>{const v=variants(3);v.scheduleV2.schedules[1].routePacked.coords[100]+=1;v.scheduleV2.schedules[2].routePacked.coords[100]+=2;check(v);});
test('RC14 SC: shared parent after nested column references restores in order',()=>{const v=variants(2);v.copy=structuredClone(v.scheduleV2.schedules[1]);check(v);});
test('RC14 SC: repeated live object references are not mutated',()=>{const r=route(),v={first:{routePacked:r},second:{routePacked:{...r,count:r.count-1}},third:{routePacked:r}},before=JSON.stringify(v);check(v);assert.equal(JSON.stringify(v),before);});
for(const budget of [0,64,512,1024,8192,131072])test('RC14 SC: dictionary limit '+budget,()=>{const v=variants(6);const c=check(v,{dictionaryChars:budget});if(!budget)assert.equal(c.references,0);});
test('RC14 SC: column-looking user objects without SC8P1 not rewritten',()=>{const r=route();delete r.format;const v={a:r,b:structuredClone(r)};assert.equal(compactJson(v).json,baseline.compactJson(v).json);check(v);});
test('RC14 storage: large repeated native station records',()=>{const rows=Array.from({length:80},(_,i)=>({id:'osm:'+i,n:'Gare 🐒 '+i,la:4812345,lo:212345}));const v={world:{nativeRefs:rows},snapshot:{nativeRefs:rows}};const c=check(v);assert.equal(c.references,1);});
test('RC14 SC: optional native gzip missing retains exact columns',async()=>{const cs=globalThis.CompressionStream;try{globalThis.CompressionStream=undefined;const v=variants(),p=await encodeJson(v);assert.equal(p.codec,'RE13/json');assert.deepEqual(await decodeJson(p),v);}finally{globalThis.CompressionStream=cs;}});
for(let i=0;i<12;i++)test('RC14 SC: deterministic profile/way/metadata variant '+i,()=>{const v=variants(4),p=v.scheduleV2.schedules[i%4].routePacked;p.coords[i*3]+=i+1;p.wayIndex[i*7]=0;p.metaDict.push({maxSpeed:10+i,note:'é"\\'+i});p.metaIndex[i*9]=p.metaDict.length-1;check(v);});
