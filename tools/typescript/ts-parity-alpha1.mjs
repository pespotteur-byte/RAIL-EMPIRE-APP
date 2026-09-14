import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as newP from '../../js/train-physics.js';
import { SeededRng } from '../../js/rng.js';

const baselineDir = process.argv[2] || process.env.RE_TS_BASELINE;
if (!baselineDir) {
  console.error('Usage: node tools/typescript/ts-parity-alpha1.mjs <HOTFIX83 extracted directory>');
  process.exit(2);
}
const oldP = await import(pathToFileURL(path.resolve(baselineDir, 'js/train-physics.js')).href);
const rng = new SeededRng(0x5A17C0DE);
const hav=(a,b,c,d)=>{
  const R=6371, p=Math.PI/180;
  const x=(d-b)*p*Math.cos(((a+c)/2)*p), y=(c-a)*p;
  return R*Math.sqrt(x*x+y*y);
};
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${msg}: ${a} vs ${b}`);
const weathers=['clear','rain','heavy_rain','storm','snow','cloudy'];
for(let k=0;k<500;k++){
  const route=[];
  let lat=48+rng.random(), lon=2+rng.random();
  const n=2+rng.randomInt(12);
  for(let i=0;i<n;i++){
    lat += (rng.random()-0.5)*0.02; lon += (rng.random()-0.5)*0.02;
    const known=rng.random()>0.2;
    route.push({lat,lon,maxSpeed:known?[30,60,80,100,120,140,160,200][rng.randomInt(8)]:30,maxSpeedSource:known?'OSM':'FALLBACK_30',travelDirection:rng.random()>0.5?'forward':'backward',maxSpeedForward:rng.random()>0.5?160:undefined,maxSpeedBackward:rng.random()>0.5?140:undefined,electrified:rng.random()>0.3,voltage:[25000],frequency:[50],tags:{incline:`${((rng.random()-0.5)*3).toFixed(2)}%`}});
  }
  const vmax=80+rng.randomInt(121);
  const a=oldP.segmentsFromRoute(route,vmax,hav), b=newP.segmentsFromRoute(route,vmax,hav);
  assert.equal(a.length,b.length,`segments length ${k}`);
  for(let i=0;i<a.length;i++){
    close(a[i].distM,b[i].distM,`dist ${k}/${i}`); close(a[i].limitMs,b[i].limitMs,`limit ${k}/${i}`); close(a[i].gradePermille,b[i].gradePermille,`grade ${k}/${i}`);
  }
  const params={massKg:150000+rng.random()*1800000,powerW:800000+rng.random()*8000000,lengthM:80+rng.random()*650,weather:weathers[rng.randomInt(weathers.length)],adhesionMassKg:80000+rng.random()*200000,brakeServiceMs2:0.45+rng.random()*0.8,startMs:0,endMs:0,preBrakeMarginM:100,dsStep:20,electricPowerW:5e6,dieselPowerW:2e6,electricSystems:[{voltage:25000,frequency:50}]};
  const pa=oldP.simulateProfile(a,params), pb=newP.simulateProfile(b,params);
  close(pa.timeSec,pb.timeSec,`time ${k}`); close(pa.distM,pb.distM,`profile dist ${k}`); close(pa.vMaxReachedMs,pb.vMaxReachedMs,`vmax ${k}`);
  assert.equal(pa.segmentTimeSec.length,pb.segmentTimeSec.length,`segment times length ${k}`);
  for(let i=0;i<pa.segmentTimeSec.length;i++) close(pa.segmentTimeSec[i],pb.segmentTimeSec[i],`seg time ${k}/${i}`);
}
console.log('TypeScript parity: 500/500 synthetic train-physics cases identical to baseline');
