/** Isolated, deterministic unit benchmarks. Never a browser FPS measurement. */
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {installIDB,openDB,get} from './test-idb-harness.mjs';
const root=path.resolve(process.env.RE_BASE||path.join(import.meta.dirname,'..')),scenario=process.argv[2];
const mod=name=>import(pathToFileURL(path.join(root,'js',name+'.js')));const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
let run,input;const samples=5;
if(scenario.startsWith('rotations-')){
 const {RotationV2Manager,ROTATION_V2_SCHEMA}=await mod('rotation-v2-model'),n=Number(scenario.split('-')[1]);
 const NativeDate=Date;globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[1789243200000]));}static now(){return 1789243200000;}};
 const vehicles=Array.from({length:n},(_,i)=>({id:'v'+i,name:'wagon '+i,category:'wagon',lengthM:20,massKg:25000,powerW:0,traction:'none',maxSpeedKmh:100}));
 const coupons=Array.from({length:Math.ceil(n/20)},(_,i)=>({id:'c'+i,name:'coupon '+i,vehicleIds:vehicles.slice(i*20,i*20+20).map(v=>v.id)}));
 const value={schemaVersion:ROTATION_V2_SCHEMA,vehicles,coupons,rotations:[],directAssignments:[],stationCodes:{}};
 input={vehicles:n,coupons:coupons.length,scope:'Complete RotationV2Manager.loadFromSave including normalization and migrations. Temporary lookup index is included.'};
 run=()=>{const m=new RotationV2Manager();assert.equal(m.loadFromSave(value),true);return m;};
}else if(scenario.startsWith('physics-')){
 const {simulateProfile}=await mod('train-physics'),n=scenario==='physics-small'?300:150000;
 const segments=Array.from({length:n},(_,i)=>({distM:n===300?50:.1,limitMs:[40,60,80][i%3]/3.6,gradePermille:0,electrified:true,sourceIndex:i}));
 const params={massKg:300000,powerW:4000000,lengthM:750,collectSegmentTimes:false};
 input={segments:n,scope:'Full SC profile calculation, unchanged braking and geometry, not routing/network fetching.'};run=()=>simulateProfile(segments,params);
}else if(scenario==='movement-authority'){
 const {MovementAuthority}=await mod('movement-authority');input={cycles:40000,scope:'All common authority control/publication operations, safety checks kept.'};
 run=()=>{const train={blockedBy:false},a=new MovementAuthority(train);let checksum=0,stops=0;for(let i=0;i<40000;i++){a.begin(160);a.caution(120,'line','line');a.caution(80,'works','works');a.limit(i%3?60:30,'incident','incident');if(i%10===0)a.stop('signal','signal');checksum+=a.decision().speedLimitKmh;if(train.blockedBy)stops++;}return {checksum,stops};};
}else if(scenario==='leader'){
 const {fixture}=await import('../js/__tests__/helpers/rc10-fixtures.mjs'),{s,game}=fixture({speed:80});
 const route=Array.from({length:201},(_,i)=>({lat:48,lon:2+i*.001,wayId:'same',maxSpeed:100}));s.position={lat:48,lon:2};s._initializeState(route,'1-0');
 const others=Array.from({length:100},(_,i)=>({id:'n'+i,state:'moving',position:{lat:48+.002+i*.0001,lon:2.01},speed:0,train:{speed:0},_state:{cachedRoute:route,index:0},rame:{totalLength:100}}));game.scheduleCreator.services=[s,...others];
 input={lookups:300,neighbours:100,routePoints:201,scope:'Real physical leader lookup on parallel routes.'};run=()=>{let selected=0;for(let i=0;i<300;i++)if(s._findPhysicalLeader(game.scheduleCreator.services,route,6))selected++;return{selected};};
}else if(scenario.startsWith('storage-')){
 const {SchedulePath}=await mod('schedule-v2-model');installIDB();delete globalThis.Worker;const {GameStorage}=await mod('storage'),storage=new GameStorage();await storage._ready;
 const count=scenario==='storage-distinct'?10:30,n=15000;let rand=73;
 function route(seed){let lat=48+seed/100,lon=2;return new SchedulePath({id:'route'+seed,topologyRevision:1,resolvedRevision:1,distanceKm:400,legs:[{id:'L',fromLocationId:'A',toLocationId:'B',distanceKm:400,routePoints:Array.from({length:n},(_,i)=>{rand=(Math.imul(rand,1664525)+1013904223)>>>0;lat+=(rand%200-70)/1e6;lon+=(rand%190-35)/1e6;return{lat,lon,wayId:String(85000000+seed*10000+Math.floor(i/19)),maxSpeed:120,electrified:true,voltage:[25000],frequency:[50],gauge:[1435]};})}]}).toJSON();}
 const common=route(1),value={companyName:'RC18 benchmark',scheduleV2:{schedules:Array.from({length:count},(_,i)=>{const p=scenario==='storage-distinct'?route(i+1):structuredClone(common);if(scenario!=='storage-distinct')p.legs[0].routePacked.metaDict=p.legs[0].routePacked.metaDict.map(m=>({...m,fixtureRestriction:i}));return{id:'S'+i,versions:[{id:'V'+i,outboundPath:p}]};})}};
 input={services:count,pointsPerRoute:n,rawBytes:Buffer.byteLength(JSON.stringify(value)),scope:'Actual saveGame encode and mock IndexedDB transaction. Equality/read checks outside timer. Not physical Opera disk usage.'};
 run=async()=>{assert.equal(await storage.saveGame(value,{lowMemory:true}),true);return storage;};
 run.check=async()=>{assert.deepEqual(await storage.loadGame(),value);const row=await get(await openDB('rail-empire-save-db','saves'),'saves','main');return{bytes:new Blob([row.stored]).size,codec:row.codec,inputHash:hash(value),exact:true};};
}else throw new Error('Unknown scenario '+scenario);
let last;const first=performance.now();last=await run();const coldMs=performance.now()-first;
for(let i=0;i<2;i++)last=await run();const samplesMs=[];
for(let i=0;i<samples;i++){globalThis.gc?.();const t=performance.now();last=await run();samplesMs.push(performance.now()-t);}
let result;if(run.check)result=await run.check();else if(scenario.startsWith('rotations-'))result={digest:hash(last.toSave()),warnings:last.loadWarnings,vehicles:last.vehicles.length,coupons:last.coupons.length};else result=last;
const sorted=samplesMs.slice().sort((a,b)=>a-b);
console.log(JSON.stringify({scenario,input,coldMs,samplesMs,medianMs:sorted[2],maxMs:sorted.at(-1),peakProcessRssKiB:process.resourceUsage().maxRSS,resultHash:hash(result),result:scenario.startsWith('physics-')?{timeSec:result.timeSec,distM:result.distM,vMaxReachedMs:result.vMaxReachedMs}:result}));
