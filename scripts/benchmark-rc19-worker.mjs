/** Real block/renderer functions; local synthetic CPU workloads, NOT whole-game FPS. */
import path from 'node:path';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
const root=path.resolve(process.env.RE_BASE||'.'),scenario=process.argv[2],mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));let run,check,input;
if(scenario.startsWith('blocks-')){
 const {CantonManager}=await mod('simulation'),n=Number(scenario.split('-')[1]),r=Array.from({length:n},(_,i)=>({lat:48,lon:2+i*.00001,maxSpeed:60,maxSpeedSource:'OSM',wayId:'rail'})),m=new CantonManager(),a=m.createRouteCantons(r);globalThis.window={game:{scheduleCreator:{services:Array.from({length:11},(_,i)=>({id:'S'+i,active:true,state:'moving',position:r[0]}))}}};
 input={points:n,blocks:a.length,trains:11,steps:100,scope:'Canton lookup and whole-train footprint, including all safety resource predicates. Index construction is reported as cold cost separately.'};
 const position=a.at(-3)?.startKm||0;run=()=>{let checksum=0;for(let tick=0;tick<100;tick++)for(let t=0;t<11;t++){const front=Math.max(0,position-t*2);const idx=Math.floor((n-3)*(front/Math.max(.001,a.at(-1).endKm)));const block=m.getCantonForSegment(a,idx);checksum+=block?.startIndex||0;m.syncFootprint('S'+t,a,front,750);}return {checksum,occupancy:[...m.cantons].filter(([id,c])=>c.occupiedBy!==null).map(([id,c])=>[id,c.occupiedBy])};};check=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
}else if(scenario.startsWith('route-')){
 const {Renderer}=await mod('renderer'),{TileMap}=await mod('map');const dense=scenario.includes('dense'),pan=scenario.includes('pan'),n=dense?60000:300;
 const r=Array.from({length:n},(_,i)=>({lat:48+Math.sin(i*.01)*.0001,lon:2+i*.00001}));globalThis.window={game:{ui:{selectedService:{routes:[r],stops:[]}}}};
 const map=Object.create(TileMap.prototype);Object.assign(map,{centerLat:48,centerLon:2+n*.000005,zoomLevel:15,tileSize:256,viewportWidth:1280,viewportHeight:720});
 const renderer=Object.create(Renderer.prototype);Object.assign(renderer,{tileMap:map,logicalWidth:1280,logicalHeight:720});let calls=0;
 renderer.latLonToScreen=(lat,lon)=>{calls++;return map.worldToScreen(lat,lon,1280,720);};
 const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 input={points:n,frames:30,camera:pan?'moving':'fixed',scope:'Actual selected-route drawing/projection with no-op Canvas stroke sink. Excludes rasterisation, tiles, trains and FPS. Exact vertex cache versus historical subpixel thinning.'};
 run=()=>{calls=0;for(let i=0;i<30;i++){if(pan)map.centerLon=2+n*.000005+i*.00003;map._updateFrameCache();renderer.drawSelectedServiceRoute(ctx,{});}return{projectionCalls:calls};};check=()=>null;
}else throw Error('Unknown scenario');
const cold=performance.now(),first=run(),coldMs=performance.now()-cold;for(let i=0;i<2;i++)run();const samplesMs=[];let last;for(let i=0;i<5;i++){const t=performance.now();last=run();samplesMs.push(performance.now()-t);}console.log(JSON.stringify({scenario,input,coldMs,coldResult:first,samplesMs,medianMs:samplesMs.slice().sort((a,b)=>a-b)[2],result:last,resultHash:check(last)}));
