/** Isolated deterministic workload. No external network, renderer or FPS claim. */
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
const [moduleRoot,scenario]=process.argv.slice(2);
if(!moduleRoot||!scenario)throw Error('module root and scenario are required');
let execute,input,result;
if(scenario.startsWith('physics-')){
 const {simulateProfile}=await import(pathToFileURL(path.join(moduleRoot,'train-physics.js')));
 const count=scenario==='physics-1500km'?150000:50000;
 const segments=Array.from({length:count},(_,i)=>({distM:10,limitMs:(i%5000<100?30:160)/3.6,gradePermille:0,electrified:true,voltage:[25000],frequency:[50],sourceIndex:i}));
 const params={massKg:500000,powerW:5000000,lengthM:200,brakeServiceMs2:.9,weather:'clear',collectSegmentTimes:true};
 input={distanceKm:count/100,segments:count,params};
 execute=()=>{const value=simulateProfile(segments,params);result={timeSec:value.timeSec,distM:value.distM,vMaxReachedMs:value.vMaxReachedMs,segmentCount:value.segmentTimeSec.length};};
}else{
 const {CantonManager}=await import(pathToFileURL(path.join(moduleRoot,'simulation.js')));
 const count=scenario==='cantons-5000'?5000:1000;
 const services=Array.from({length:count},(_,i)=>({id:`s${i}`,active:true,state:i%17?'moving':'blocked_route',position:{lat:48,lon:2}}));
 const manager=new CantonManager();globalThis.window={game:{scheduleCreator:{services}}};
 for(let i=0;i<count;i++)manager.cantons.set(`c${i}`,{occupiedBy:services[i].id,reservedBy:null,resourceIds:[]});
 const queries=Array.from({length:count*4},(_,i)=>`c${(i*997)%count}`);
 input={fleet:count,occupancyChecksPerSample:queries.length,includesPerTickIndexBuild:true};
 execute=()=>{let blocked=0;const end=manager.beginServiceLookupFrame?.(services);try{for(const id of queries)if(!manager.isAvailable(id,'follower'))blocked++;}finally{end?.();}if(blocked!==queries.length)throw Error('Safety parity failed');result={blocked};};
}
for(let i=0;i<3;i++)execute();
const samplesMs=[];
for(let i=0;i<9;i++){globalThis.gc?.();const start=performance.now();execute();samplesMs.push(performance.now()-start);}
const sorted=[...samplesMs].sort((a,b)=>a-b);
console.log(JSON.stringify({scenario,input,result,samplesMs,medianMs:sorted[4],p95Ms:sorted[8],peakRssKiB:process.resourceUsage().maxRSS,gcBetweenSamples:typeof globalThis.gc==='function',node:process.version,platform:process.platform,architecture:process.arch}));
