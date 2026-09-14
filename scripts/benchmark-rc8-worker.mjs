/** Isolated real resource-ownership workload; no renderer, FPS or full-game claim. */
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [directory,sizeArg]=process.argv.slice(2);if(!directory)throw Error('Usage: node --expose-gc scripts/benchmark-rc8-worker.mjs <root> <fleet-size>');
const root=path.resolve(directory),count=Number(sizeArg||1000);
if(!Number.isInteger(count)||count<10||count>20000)throw Error('fleet-size must be 10..20000');
const {ActiveService,cantonManager}=await import(pathToFileURL(path.join(root,'js/schedule-creator.js')));
const services=Array.from({length:count},(_,i)=>({id:'S'+i,active:true,completed:false,cancelled:false,state:i%17?'moving':'blocked_route',position:{lat:48,lon:2}}));
globalThis.window={game:{scheduleCreator:{services}}};
const observer={id:'observer'},queries=Array.from({length:count*4},(_,i)=>'S'+((i*997)%count));
function execute(){const end=cantonManager.beginServiceLookupFrame(services);let occupied=0;try{for(const id of queries)if(ActiveService.prototype._isLiveResourceOwner.call(observer,id))occupied++;}finally{end();}if(occupied!==queries.length)throw Error('Physical safety parity failed');return{occupied,queries:queries.length};}
for(let i=0;i<3;i++)execute();
const samplesMs=[];let result;for(let i=0;i<9;i++){globalThis.gc?.();const t=performance.now();result=execute();samplesMs.push(performance.now()-t);}const sorted=[...samplesMs].sort((a,b)=>a-b);
console.log(JSON.stringify({root,scenario:'station-resource-owners',fleet:count,queriesPerTick:queries.length,includesPerTickIndexBuild:true,result,samplesMs,medianMs:sorted[4],p95Ms:sorted[8],peakRssKiB:process.resourceUsage().maxRSS,node:process.version,gcBetweenSamples:typeof globalThis.gc==='function',scope:'Actual ActiveService._isLiveResourceOwner in the existing synchronous movement scope, with live service objects. Not complete simulation, not browser FPS.'},null,2));
