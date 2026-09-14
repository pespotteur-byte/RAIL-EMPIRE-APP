import {performance} from 'node:perf_hooks';
import {fixture} from '../js/__tests__/helpers/rc10-fixtures.mjs';
const {s,game}=fixture({speed:80});
const route=Array.from({length:201},(_,i)=>({lat:48,lon:2+i*.001,wayId:'same',maxSpeed:100}));
s.position={lat:48,lon:2};s._initializeState(route,'1-0');
const others=Array.from({length:100},(_,i)=>({id:'n'+i,state:'moving',position:{lat:48+.002+i*.0001,lon:2.01},speed:0,train:{speed:0},_state:{cachedRoute:route,index:0},rame:{totalLength:100}}));game.scheduleCreator.services=[s,...others];
function run(){let selected=0;for(let i=0;i<300;i++)if(s._findPhysicalLeader(game.scheduleCreator.services,route,6))selected++;return selected;}
for(let n=0;n<3;n++)run();const samples=[],results=[];for(let n=0;n<7;n++){const t=performance.now();results.push(run());samples.push(performance.now()-t);}const sorted=samples.slice().sort((a,b)=>a-b);console.log(JSON.stringify({callsPerSample:300,otherTrains:100,routePoints:201,samplesMs:samples,medianMs:sorted[3],selected:results}));
