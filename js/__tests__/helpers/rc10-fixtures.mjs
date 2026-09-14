import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const root=process.env.RE_BASE||path.resolve(import.meta.dirname,'../../..');
export const mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));
export const {ActiveService,cantonManager}=await mod('schedule-creator');
export const {Economy}=await mod('economy');
export const {PlatformManager}=await mod('line');
export function reset(){for(const k of ['cantons','routeCantons','trainCantons','resourceCantons'])cantonManager[k].clear();}
export function fixture({kind='passage',power=4000,speed=80,grade=0}={}){
 reset();const stations=[{id:'A',name:'A',lat:48,lon:2,platforms:2},{id:'B',name:'B',lat:48.01,lon:2,platforms:2},{id:'C',name:'C',lat:48.11,lon:2,platforms:2}];
 const world={stations,tracks:[],getStationById(id){return this.stations.find(x=>x.id===id)||null;}};
 const pt=s=>({...s,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,wayId:'way-'+s.id,incline:grade});
 const routes=[[pt(stations[0]),pt(stations[1])],[pt(stations[1]),pt(stations[2])]];
 const rame={id:'R',maxSpeed:160,totalPower:power,totalMass:1000,totalLength:300,totalCapacity:0,totalFreightCapacity:0,traction:'diesel',elementDetails:[],currentLocation:{stationId:'A'}};
 const s=new ActiveService({id:'S',name:'S',serviceType:'fret',stops:[{stationId:'A',type:'arret',departureTime:600,arrivalTime:600},{stationId:'B',type:kind,arrivalTime:605,departureTime:605},{stationId:'C',type:'arret',arrivalTime:630,departureTime:630}],routes},rame,world,null);
 const game={world,economy:new Economy(),scheduleCreator:{services:[s]},realismSettings:{breakdown:0,physics:1},platformManager:new PlatformManager()};
 globalThis.window={game};s.active=true;s.state='moving';s.currentStopIndex=1;s._currentDate='2026-09-11';s.speed=s.train.speed=speed;s.position={lat:48.005,lon:2};s._economy=game.economy;s._initializeState(routes[0],'1-0');
 return {s,game,world,routes,rame};
}
export function atEndpoint(s,route){s._state.index=route.length-1;s._state.progress=0;s.position={lat:route.at(-1).lat,lon:route.at(-1).lon};}
export function tick(s,mode,game,dt=.1){if(mode==='full')s.moveUpdate(dt,605,game.scheduleCreator.services);else s.moveMacro(dt,605,game.economy,game.scheduleCreator.services);}
