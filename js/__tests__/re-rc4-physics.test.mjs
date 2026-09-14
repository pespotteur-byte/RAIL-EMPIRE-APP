import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateProfile} from '../train-physics.js';
import {simulateProfile as reference} from '../../QA/RE_REPAIR_RC4/reference/train-physics.js';
const params={massKg:500000,powerW:5000000,lengthM:200,brakeServiceMs2:.9,weather:'clear'};
test('RC4-PERF01: 250 mixed physical profiles are bit-for-bit identical to RC3',()=>{
 let seed=241901; const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let j=0;j<250;j++){
  const segments=Array.from({length:1+Math.floor(rand()*200)},(_,i)=>({distM:1+rand()*900,limitMs:8+rand()*40,gradePermille:rand()*20-10,electrified:rand()>.15,voltage:[25000],frequency:[50],sourceIndex:i}));
  const profile={massKg:90000+rand()*800000,powerW:300000+rand()*7000000,lengthM:50+rand()*700,weather:['clear','rain','snow'][j%3],brakeServiceMs2:.5+rand()*.6,brakeBuildSec:1+rand()*6,electricPowerW:3000000,dieselPowerW:1000000,electricSystems:[{voltage:25000,frequency:50}],collectSegmentTimes:j%2===0};
  assert.deepEqual(simulateProfile(segments,profile),reference(segments,profile),`profile ${j}`);
 }
});
test('RC4-PERF01: caller-owned frozen profiles/segments are not mutated',()=>{
 const profile=Object.freeze({...params,electricPowerW:4000000,dieselPowerW:1000000,electricSystems:Object.freeze([{voltage:25000,frequency:50}])});
 const segments=Object.freeze([Object.freeze({distM:1000,limitMs:40,electrified:false}),Object.freeze({distM:2000,limitMs:40,electrified:true,voltage:Object.freeze([25000]),frequency:Object.freeze([50])})]);
 assert.deepEqual(simulateProfile(segments,profile),reference(segments,profile)); assert.equal(profile.powerW,5000000);
});
test('RC4-PERF01: 150000 dense segments retain every source timing and the full distance',()=>{
 const segments=Array.from({length:150000},(_,i)=>({distM:10,limitMs:160/3.6,sourceIndex:i}));
 const result=simulateProfile(segments,params);
 assert.equal(result.distM,1500000); assert.equal(result.segmentTimeSec.length,150000);
 assert.ok(result.segmentTimeSec.every(t=>Number.isFinite(t)&&t>0));
 assert.ok(Math.abs(result.segmentTimeSec.reduce((a,b)=>a+b,0)-result.timeSec)<1e-6);
});
test('RC4-PERF01: sparse source indexes and gaps keep their original mapping',()=>{
 const segments=[{distM:50,limitMs:10,sourceIndex:2},{distM:150,limitMs:20,sourceIndex:7}];
 assert.deepEqual(simulateProfile(segments,params),reference(segments,params));
 assert.equal(simulateProfile(segments,params).segmentTimeSec[3],0);
});
test('RC4-PERF01: zero power remains impossible, never a faster fictitious run',()=>{
 const result=simulateProfile([{distM:1000,limitMs:30}],{...params,powerW:0});
 assert.equal(result.timeSec,Infinity);
});
test('RC4-PERF01: terminal 100m V30 does not contaminate 400km V160',()=>{
 const segments=[{distM:400000,limitMs:160/3.6},{distM:100,limitMs:30/3.6}];
 const result=simulateProfile(segments,params);
 assert.deepEqual(result,reference(segments,params));assert.ok(result.timeSec>9000&&result.timeSec<9500);
});
