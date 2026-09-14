import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateProfile,getLastProfileWorkspaceStats,MAX_PROFILE_WORKSPACE_CELLS} from '../train-physics.js';
import {simulateProfile as reference} from '../../QA/RE_REPAIR_RC11/baseline/js/train-physics.js';
const p={massKg:500000,powerW:5000000,lengthM:750,brakeServiceMs2:.65,brakeBuildSec:5,weather:'clear'};
function same(segments,params={}){const q={...p,...params};assert.deepEqual(simulateProfile(segments,q),reference(segments,q));}
test('RC11-MESH01 700 randomized profiles match RC10 bit-for-bit across deliberately tiny windows',()=>{
 let seed=89121;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let n=0;n<700;n++){
  const s=Array.from({length:1+Math.floor(rand()*65)},(_,i)=>({distM:.05+rand()*100,limitMs:2+rand()*50,gradePermille:rand()*50-25,electrified:rand()>.3,voltage:[rand()>.5?25000:1500],frequency:[50],sourceIndex:i*2}));
  same(s,{workspaceCellLimit:[2,3,7,31,61][n%5],massKg:80000+rand()*800000,powerW:10000+rand()*6000000,lengthM:rand()*750,weather:['clear','rain','snow'][n%3],startMs:n%4===0?rand()*10:0,endMs:n%5===0?rand()*8:0,dsStep:.5+rand()*20,preBrakeMarginM:rand()*300,collectSegmentTimes:n%2===0,electricPowerW:n%3?3000000:0,dieselPowerW:n%3?500000:0,electricSystems:[{voltage:25000,frequency:50}]});
 }
});
test('RC11-MESH02 overlapping reductions across window edges preserve every limit and every source time',()=>{
 const s=Array.from({length:101},(_,i)=>({distM:i%3===0?.125:23.7,limitMs:i%2?30/3.6:160/3.6,sourceIndex:i}));
 for(const c of [2,3,13,37,199])same(s,{workspaceCellLimit:c});
});
test('RC11-MESH03 long-train rear-clearance restrictions cross many windows without early release',()=>{
 const s=Array.from({length:100},(_,i)=>({distM:3.77,limitMs:5+i*.3,sourceIndex:i}));same(s,{workspaceCellLimit:2,lengthM:750,endMs:0});same(s,{workspaceCellLimit:2,lengthM:-1});
});
test('RC11-MESH04 a terminal V30 does not contaminate the preceding 400 km at V160',()=>{
 same([{distM:400000,limitMs:160/3.6},{distM:100,limitMs:30/3.6}],{workspaceCellLimit:37});
});
test('RC11-MESH05 electrical power changes and stalling retain their RC10 outcome',()=>{
 const s=[{distM:1000,limitMs:40,electrified:true,voltage:[25000],frequency:[50]},{distM:30000,limitMs:40,electrified:false,gradePermille:40}];
 same(s,{workspaceCellLimit:13,electricPowerW:5000000,dieselPowerW:0,electricSystems:[{voltage:25000,frequency:50}]});same(s,{workspaceCellLimit:13,powerW:0});
});
test('RC11-MESH06 150000 dense source segments survive, despite a 20000-cell resident workspace',()=>{
 const s=Array.from({length:150000},(_,i)=>({distM:10,limitMs:160/3.6,sourceIndex:i}));const out=simulateProfile(s,p),stats=getLastProfileWorkspaceStats();
 assert.equal(stats.totalCells,150000);assert.equal(stats.residentCells,MAX_PROFILE_WORKSPACE_CELLS);assert.equal(stats.streamed,true);assert.equal(out.distM,1500000);assert.equal(out.segmentTimeSec.length,150000);assert.ok(out.segmentTimeSec.every(t=>Number.isFinite(t)&&t>0));assert.ok(Math.abs(out.segmentTimeSec.reduce((a,b)=>a+b,0)-out.timeSec)<1e-6);
 assert.deepEqual(out,reference(s,p));
});
test('RC11-MESH07 allocation interception proves there is no million-cell typed array hidden behind diagnostics',()=>{
 const names=['Float64Array','Uint32Array','Uint8Array'],old=Object.fromEntries(names.map(n=>[n,globalThis[n]])),sizes=[];
 try{
  for(const name of names)globalThis[name]=new Proxy(old[name],{construct(target,args,newTarget){const value=Reflect.construct(target,args,newTarget);sizes.push(value.length);return value;}});
  const out=simulateProfile([{distM:2000000,limitMs:160/3.6,sourceIndex:0}],{...p,dsStep:2,collectSegmentTimes:false});assert.ok(Number.isFinite(out.timeSec));
 }finally{for(const name of names)globalThis[name]=old[name];}
 assert.ok(sizes.length>0);assert.ok(Math.max(...sizes)<=MAX_PROFILE_WORKSPACE_CELLS,JSON.stringify(sizes));assert.equal(getLastProfileWorkspaceStats().totalCells,1000000);
});
test('RC11-MESH08 frozen caller data remains immutable on the streaming path',()=>{
 const s=Object.freeze([Object.freeze({distM:10000,limitMs:40,electrified:false,sourceIndex:7}),Object.freeze({distM:1000,limitMs:10,sourceIndex:11})]);const q=Object.freeze({...p,workspaceCellLimit:3});same(s,q);assert.equal(s[0].distM,10000);
});
test('RC11-MESH09 source index holes and disabled source outputs remain compatible',()=>{
 const s=[{distM:1234.567,limitMs:40,sourceIndex:8},{distM:1,limitMs:5,sourceIndex:101},{distM:31,limitMs:50,sourceIndex:301}];same(s,{workspaceCellLimit:7});same(s,{workspaceCellLimit:7,collectSegmentTimes:false});
});
test('RC11-MESH10 numerical window requests cannot raise the hard resident-cell maximum',()=>{
 simulateProfile([{distM:1000000,limitMs:40}],{...p,workspaceCellLimit:100000000});assert.equal(getLastProfileWorkspaceStats().residentCells,MAX_PROFILE_WORKSPACE_CELLS);
 simulateProfile([],p);assert.equal(getLastProfileWorkspaceStats().residentCells,0);
});
test('RC11-MESH11 zero-distance source segments and exact transition boundaries remain identical',()=>{
 const s=[{distM:0,limitMs:40},{distM:200,limitMs:10},{distM:0,limitMs:30},{distM:300,limitMs:20}];same(s,{workspaceCellLimit:2});same(s,{workspaceCellLimit:7,preBrakeMarginM:-1000});
});
test('RC11-MESH12 malformed unrepresentable mesh sizes raise a diagnostic rather than allocating an invalid array',()=>{
 assert.throws(()=>simulateProfile([{distM:NaN,limitMs:30}],p),/taille numérique/);
});
