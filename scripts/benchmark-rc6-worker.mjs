import {performance} from 'node:perf_hooks';
import {simulateProfile as current} from '../js/train-physics.js';
import {simulateProfile as previous} from '../QA/RE_REPAIR_RC6/reference/train-physics.rc5.js';
import {MovementAuthority as CurrentAuthority} from '../js/movement-authority.js';
import {MovementAuthority as PreviousAuthority} from '../QA/RE_REPAIR_RC6/reference/movement-authority.rc5.js';
const [version,scenario]=process.argv.slice(2);
if(!['RC5','RC6'].includes(version))throw Error('Specify RC5 or RC6');
let execute,input,result;
if(scenario.startsWith('physics-')){
 const dense=scenario==='physics-dense-150k',flat=scenario==='physics-uniform-50k',n=dense?150000:50000;
 const segments=Array.from({length:n},(_,i)=>({distM:dense?0.1:10,limitMs:(dense?[40,60,80][i%3]:flat?160:(Math.floor(i/5000)%2?120:160))/3.6,gradePermille:0,electrified:true,sourceIndex:i}));
 const params={massKg:300000,powerW:4000000,lengthM:750,collectSegmentTimes:false},fn=version==='RC5'?previous:current;
 input={segments:n,distanceKm:n*(dense?0.1:10)/1000,consistMetres:750,pattern:dense?'artificial stress: 40/60/80 every 10 cm':flat?'uniform V160':'V120/V160 every 50 km',scope:'full physical simulation including unchanged braking, not only optimized envelope'};
 execute=()=>{const r=fn(segments,params);result={timeSec:r.timeSec,distM:r.distM,vMaxReachedMs:r.vMaxReachedMs};};
}else if(scenario==='movement-authority'){
 const Type=version==='RC5'?PreviousAuthority:CurrentAuthority,train={blockedBy:false},a=new Type(train),count=40000;
 input={controlCycles:count,publicationsPerCycle:'4 or 5',scope:'real begin/caution/limit/STOP/publication/query; all constraints retained'};
 execute=()=>{let checksum=0,stops=0;for(let i=0;i<count;i++){a.begin(160);a.caution(120,'line','line');a.caution(80,'works','works');a.limit(i%3?60:30,'incident','incident');if(i%10===0)a.stop('signal','signal');const d=a.decision();checksum+=d.speedLimitKmh;if(train.blockedBy)stops++;}result={checksum,stops};};
}else throw Error('Unknown scenario');
const t0=performance.now();execute();const coldFirstCallMs=performance.now()-t0;
for(let i=0;i<3;i++)execute();const samplesMs=[];
for(let i=0;i<9;i++){globalThis.gc?.();const t=performance.now();execute();samplesMs.push(performance.now()-t);}
console.log(JSON.stringify({version,scenario,input,result,coldFirstCallMs,samplesMs,medianMs:[...samplesMs].sort((a,b)=>a-b)[4],peakRssKiB:process.resourceUsage().maxRSS}));
