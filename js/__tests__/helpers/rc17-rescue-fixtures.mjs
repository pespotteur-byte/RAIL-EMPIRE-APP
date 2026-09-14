import {fixture,mod,cantonManager} from './rc10-fixtures.mjs';
export const {DepotManager,Depot}=await mod('depot');
export const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
export async function setup({traction='diesel',electrified=false,power=2400,mass=84,maxSpeed=100}={}){
 const f=fixture({speed:0}),manager=new DepotManager();
 const depot=new Depot({id:'D',stationId:'A',built:true,type:'depot',tracks:2,rescueLocos:[{stockId:'L',stockName:'Rescue test',traction}]});
 manager.depots=[depot];f.game.depotManager=manager;f.game._currentDate=f.s._currentDate='2026-09-12';
 f.game.rollingStock={getById:id=>id==='L'?{id:'L',name:'Locomotive',category:'locomotive',traction,power,mass,length:20,maxSpeed,electricSystems:[{voltage:25000,frequency:50}]}:null};
 f.game.rameManager={getById:id=>id===f.rame.id?f.rame:null};
 const point=(lat,lon)=>({lat,lon,wayId:'main',maxSpeed:100,maxSpeedSource:'OSM',electrified,voltage:electrified?25000:0,frequency:electrified?50:0});
 f.game.orm={findRoute:(lat,lon,toLat,toLon)=>Array.from({length:21},(_,i)=>point(lat+(toLat-lat)*i/20,lon+(toLon-lon)*i/20))};
 f.s.routes=[f.game.orm.findRoute(48,2,48.01,2)];f.s._initializeState(f.s.routes[0],'1-0');f.s.train.breakdown={type:'moteur'};
 const r=manager.dispatchRescue(f.world,f.s);await flush();
 const controller=()=>manager.getPhysicalRescueServices()[0];
 const tick=(seconds=1,time=600)=>manager.updateRescues(seconds,time);
 const getToReturn=async()=>{for(let i=0;i<800&&r.state!=='recovering';i++)tick();if(r.state!=='recovering')throw Error('Outbound failed: '+r.routeStatusMessage);tick(300);await flush();};
 return {...f,manager,depot,r,controller,tick,getToReturn,cantonManager};
}
