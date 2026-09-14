import assert from 'node:assert/strict';
import { RollingStockManager } from '../../rolling-stock.js';
import { RameManager } from '../../rame.js';
import { ScheduleCreator } from '../../schedule-creator.js';
import { Economy } from '../../economy.js';
import { FreightManager } from '../../freight.js';
import { DepotManager } from '../../depot.js';
import { ITEModules } from '../../ite-modules.js';
import { StaffManager } from '../../staff.js';
import { Weather } from '../../weather.js';
import { WorksManager } from '../../works.js';
import { SeededRng,setGlobalRng } from '../../rng.js';

const DATE='2026-08-25';

function makeWorld(){
  const stations=[0,1,2,3].map((i)=>({id:String.fromCharCode(65+i),name:String.fromCharCode(65+i),lat:48+i*0.004,lon:2,platforms:2,country:'FR'}));
  return {stations,tracks:[],getStationById(id){return stations.find(s=>s.id===String(id))||null;},getStationsNear(){return [];}};
}
function makeStock(){
  const stock=new RollingStockManager();
  stock.add({id:'L',name:'Diesel',category:'locomotive',traction:'diesel',mass:80,tonnage:80,power:2400,maxSpeed:100,length:20});
  stock.add({id:'W',name:'Grain',category:'wagon',traction:'none',mass:20,tonnage:80,power:0,maxSpeed:100,length:20,freightCapacity:60,cargoTypes:['grain']});
  return stock;
}
function route(a,b,way){return [
  {lat:a.lat,lon:a.lon,wayId:way,maxSpeed:80,maxSpeedSource:'OSM',electrified:false},
  {lat:(a.lat+b.lat)/2,lon:2,wayId:way,maxSpeed:80,maxSpeedSource:'OSM',electrified:false},
  {lat:b.lat,lon:b.lon,wayId:way,maxSpeed:80,maxSpeedSource:'OSM',electrified:false},
];}
function attachWindow(game){
  globalThis.window={game};
  game.realismSettings={physics:1,breakdown:0,weather:1,delayTolerance:30};
  game.lineManager={getLinesForStation(){return [];}};
  game.cargoTypes={recordContract(){}};
  game.industrialClients={clients:[],stats:{totalTonnage:0,totalRevenue:0}};
  game.saveState=()=>{};
}
export function initialFixture(){
  setGlobalRng(new SeededRng(0x12345678));
  const world=makeWorld(), stock=makeStock(), rmgr=new RameManager();
  const loco=stock.getById('L'), wagon=stock.getById('W');
  const rame=rmgr.add({id:'R',name:'Fret test',elements:['L','W'],elementDetails:[{...loco},{...wagon}],currentLocation:{stationId:'A',lat:48,lon:2}});
  const economy=new Economy(), freightManager=new FreightManager();
  freightManager.addContract({id:'F1',cargoType:'grain',cargoName:'Céréales',quantity:20,initialQuantity:20,unit:'t',from:'A',fromId:'A',to:'C',toId:'C',payment:2000});
  const depotManager=new DepotManager();
  const ite=depotManager.add({id:'ITE-C',type:'ite-fret',name:'ITE C',stationId:'C',tracks:1,cost:0,iteTracks:[{name:'V1',length:25,cargoType:'grain'}],iteCargoTypes:['grain']},null);
  const iteModules=new ITEModules(); iteModules.buyModule(ite.id,'crane',economy);
  const staffManager=new StaffManager(); staffManager.hire(economy,'','conducteur',{count:1,nationality:'fr'});
  const weather=new Weather(); weather.current='rain'; weather._liveDataAvailable=false;
  const worksManager=new WorksManager();
  const routes=[route(world.stations[0],world.stations[1],'AB'),route(world.stations[1],world.stations[2],'BC'),route(world.stations[2],world.stations[3],'CD')];
  worksManager.add({id:'WK',name:'Ral 40',startDate:DATE,endDate:DATE,startTime:'00:00',endTime:'23:59',impact:'slow',speedLimit:40,recurrence:'once',zones:[{id:'Z',impact:'slow',speedLimit:40,route:routes[1],distanceKm:0.5}]});
  const scheduleCreator=new ScheduleCreator(); scheduleCreator.weather=weather;
  const game={world,stock,rameManager:rmgr,economy,freightManager,depotManager,iteModules,staffManager,weather,worksManager,scheduleCreator}; attachWindow(game);
  const svc=scheduleCreator.addService({id:'S',name:'Fret A-D',number:'9001',rameId:'R',serviceType:'fret',assignedContractId:'F1',stops:[
    {stationId:'A',type:'arret',arrivalTime:0,departureTime:0,platform:'1'},
    {stationId:'B',type:'arret',arrivalTime:2,departureTime:3,platform:'1'},
    {stationId:'C',type:'arret',arrivalTime:5,departureTime:7,platform:'1'},
    {stationId:'D',type:'arret',arrivalTime:10,departureTime:10,platform:'1'},
  ],routes,plannedDistance:1.4},rame,world);
  return game;
}
export function snapshot(game){
  return {
    rames:game.rameManager.toSave(), economy:game.economy.toSave(), freight:game.freightManager.toSave(),
    depots:game.depotManager.toSave(), ite:game.iteModules.toSave(), staff:game.staffManager.toSave(),
    weather:game.weather.toSave(), works:game.worksManager.toSave(), services:game.scheduleCreator.toSave(),
  };
}
export function reload(oldGame,time){
  const save=JSON.parse(JSON.stringify(snapshot(oldGame))), world=oldGame.world, stock=oldGame.stock;
  const rameManager=new RameManager(); rameManager.loadFromSave(save.rames,stock);
  const economy=new Economy(); economy.loadFromSave(save.economy);
  const freightManager=new FreightManager(); freightManager.loadFromSave(save.freight);
  const depotManager=new DepotManager(); depotManager.loadFromSave(save.depots);
  const iteModules=new ITEModules(); iteModules.loadFromSave(save.ite);
  const staffManager=new StaffManager(); staffManager.loadFromSave(save.staff);
  const weather=new Weather(); weather.loadFromSave(save.weather);
  const worksManager=new WorksManager(); worksManager.loadFromSave(save.works);
  const scheduleCreator=new ScheduleCreator(); scheduleCreator.weather=weather;
  const game={world,stock,rameManager,economy,freightManager,depotManager,iteModules,staffManager,weather,worksManager,scheduleCreator}; attachWindow(game);
  scheduleCreator.loadFromSave(save.services,rameManager,world,time,DATE);
  rameManager.reconcileReferences({depots:depotManager.depots,stations:world.stations,services:scheduleCreator.services});
  return game;
}
function tick(game,m){
  game.staffManager.tickConductors(game.scheduleCreator.services,m,DATE);
  for(const svc of game.scheduleCreator.services){
    svc.scheduleTick(m,DATE,game.economy);
    for(let k=0;k<6;k++) svc.moveUpdate(10,m,game.scheduleCreator.services);
  }
}
function svc(game){return game.scheduleCreator.services.find(s=>s.id==='S');}

