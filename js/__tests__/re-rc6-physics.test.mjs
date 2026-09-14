import test from 'node:test';
import assert from 'node:assert/strict';
import { rearClearanceCaps } from '../physics-rear-clearance.js';
import { simulateProfile } from '../train-physics.js';
import { simulateProfile as reference } from '../../QA/RE_REPAIR_RC6/reference/train-physics.rc5.js';
function oracle(distance,limits,up,length){const out=new Float64Array(distance.length);let x=0;for(let i=0;i<distance.length;i++){if(up[i]&&i>0){let d=x;for(let j=i;j<distance.length&&d<x+length;j++){out[j]=out[j]>0?Math.min(out[j],limits[i-1]):limits[i-1];d+=distance[j];}}x+=distance[i];}return out;}
const limits=xs=>Float64Array.from(xs,x=>x/3.6);
function check(dist,lim,length){const up=Uint8Array.from(lim,(v,i)=>i>0&&v>lim[i-1]+1e-6?1:0);assert.deepEqual(rearClearanceCaps(dist,lim,up,length),oracle(dist,lim,up,length));}
function rng(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
test('RC6-PHYS-01: overlapping rises retain the most restrictive rear cap',()=>check(Float64Array.from([250,250,250,250,250,250,250]),limits([30,60,90,90,90,90,90]),750));
test('RC6-PHYS-02: decimal and exact release boundaries match RC5 bit for bit',()=>{for(const ds of [0.1,0.3,1,7,20,33.333333333333])for(const L of [ds,3*ds,10*ds,750])check(new Float64Array(500).fill(ds),limits(Array.from({length:500},(_,i)=>[30,60,90,160,80][i%5])),L);});
test('RC6-PHYS-03: no transition and non-positive length retain empty caps',()=>{for(const l of [0,-1,200])check(new Float64Array(30).fill(1),new Float64Array(30).fill(10),l);});
test('RC6-PHYS-04: 500 seeded random envelopes match the old independent loop exactly',()=>{const r=rng(984561);for(let k=0;k<500;k++){const n=10+Math.floor(r()*1000);check(Float64Array.from({length:n},()=>0.02+r()*30),Float64Array.from({length:n},()=>5+Math.floor(r()*15)*2),1+r()*1500);}});
test('RC6-PHYS-05: 120 full profiles retain exact timings, gradients, traction and source accounting',()=>{const r=rng(123541);for(let k=0;k<120;k++){const seg=Array.from({length:10+Math.floor(r()*300)},(_,i)=>({distM:0.1+r()*80,limitMs:(30+Math.floor(r()*8)*20)/3.6,gradePermille:(r()-0.5)*30,electrified:i%7!==0,voltage:[i%2?1500:25000],frequency:[i%2?0:50],sourceIndex:i}));const p={massKg:100000+r()*800000,powerW:5000000,electricPowerW:4000000,dieselPowerW:1000000,electricSystems:[{voltage:25000,frequency:50}],lengthM:50+r()*950,weather:k%2?'rain':'clear',dsStep:20,collectSegmentTimes:k%3!==0};assert.deepEqual(simulateProfile(seg,p),reference(seg,p));}});
test('RC6-PHYS-06: dense 150000-segment geometry is not truncated',()=>{const s=Array.from({length:150000},(_,i)=>({distM:0.1,limitMs:[40,60,80][i%3]/3.6,sourceIndex:i}));const p={massKg:300000,powerW:4000000,lengthM:750};const a=simulateProfile(s,p),b=reference(s,p);assert.deepEqual(a,b);assert.equal(a.segmentTimeSec.length,150000);});
test('RC6-PHYS-07: mismatched array lengths fail explicitly',()=>assert.throws(()=>rearClearanceCaps(new Float64Array(2),new Float64Array(1),new Uint8Array(2),750),RangeError));
