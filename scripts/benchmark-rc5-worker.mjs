/** Isolated microbenchmarks of real runtime methods, NOT renderer/frame rates.
 * Reference bodies are copied unchanged from delivered RC4 (see PROVENANCE).
 * Both variants use the same unchanged distance/traction helpers. No result is
 * discarded: output checksum and finite/blocked counts must match.
 */
import {performance} from 'node:perf_hooks';
import {ActiveService} from '../js/schedule-creator.js';
import {Economy} from '../js/economy.js';
import {ReferenceActiveService} from '../QA/RE_REPAIR_RC5/reference/ActiveService.mjs';
import {ReferenceEconomy} from '../QA/RE_REPAIR_RC5/reference/Economy.mjs';
const [version,scenario]=process.argv.slice(2);
if(!['RC4','RC5'].includes(version))throw Error('Specify RC4 or RC5');
let execute,input,coldMs,result;
if(scenario.startsWith('electrification-')){
 const size=scenario.includes('150k')?150000:50000,queries=4000,mixed=scenario.includes('mixed');
 const route=Array.from({length:size},(_,i)=>({lat:48,lon:2+i*0.00001,electrified:mixed&&i%10000===9998?false:true}));
 const svc=Object.create(ActiveService.prototype);svc.rame={traction:'electric'};svc._state={index:0,progress:0.3,cachedRoute:route};
 if(version==='RC4')svc._distanceAheadToElectrificationMismatch=ReferenceActiveService.prototype._distanceAheadToElectrificationMismatch;
 // Includes the shared geometric index construction in each version's cold call.
 const t0=performance.now();svc._distanceAheadToElectrificationMismatch(route);coldMs=performance.now()-t0;
 input={points:size,checksPerSample:queries,pattern:mixed?'explicit gap every 10000 points':'fully electrified',sharedDistanceHelpers:'actual, unchanged ActiveService methods',queryIndexes:'(i*997)%(points-1)',indexConstruction:'cold call measured separately; warm batch reuses fixed route snapshot'};
 execute=()=>{let finite=0,clear=0,checksum=0;
  for(let i=0;i<queries;i++){svc._state.index=(i*997)%(size-1);const km=svc._distanceAheadToElectrificationMismatch(route);if(km===Infinity)clear++;else{finite++;checksum+=km;}}
  result={finite,clear,checksum};
 };
}else if(scenario==='toll-50000'){
 const size=50000,queries=100;
 const route=Array.from({length:size},(_,i)=>({maxSpeed:[80,160,200][i%3],tracks:i%5?2:1,electrified:i%7!==0,usage:i%7?'main':'branch'}));
 const economy=new Economy(),rame={maxSpeed:200,totalTonnage:700};
 if(version==='RC4')economy._calcInfrastructureToll=ReferenceEconomy.prototype._calcInfrastructureToll;
 const t0=performance.now();economy._calcInfrastructureToll(125,route,rame,'FR');coldMs=performance.now()-t0;
 input={points:size,tollAssessmentsPerSample:queries,distanceKm:125,tonnage:700,country:'FR'};
 execute=()=>{let total=0;for(let i=0;i<queries;i++)total+=economy._calcInfrastructureToll(125,route,rame,'FR');result={total};};
}else throw Error('Unknown scenario');
for(let i=0;i<3;i++)execute();const samplesMs=[];
for(let i=0;i<9;i++){globalThis.gc?.();const start=performance.now();execute();samplesMs.push(performance.now()-start);}
const sorted=[...samplesMs].sort((a,b)=>a-b);
console.log(JSON.stringify({version,scenario,input,result,coldFirstCallMs:coldMs,samplesMs,medianMs:sorted[4],maximumSampleMs:sorted.at(-1),peakRssKiB:process.resourceUsage().maxRSS,gcBetweenSamples:typeof globalThis.gc==='function'}));
