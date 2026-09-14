import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ScheduleCreator } from '../schedule-creator.js';

function makeWorld(){
  return {
    stations:[
      {id:'A',name:'Fontaine Michalon',lat:48.73,lon:2.30,platforms:2},
      {id:'B',name:'Antony',lat:48.753,lon:2.304,platforms:2},
      {id:'C',name:'La Croix de Berny',lat:48.762,lon:2.304,platforms:2},
    ],
    getStationById(id){return this.stations.find(s=>s.id===id)||null;},
  };
}

function service(sc,world,id,name,lat){
  const svc=sc.addService({
    id,name,rameId:id+'-rame',serviceType:'passager',active:true,
    stops:[
      {stationId:'A',type:'arret',arrivalTime:0,departureTime:0,platform:'2'},
      {stationId:'B',type:'arret',arrivalTime:2,departureTime:3,platform:'2',voiePointId:'vp-B-2'},
      {stationId:'C',type:'arret',arrivalTime:4,departureTime:5,platform:'2'},
    ],
    routes:[
      [{lat:48.73,lon:2.30},{lat:48.753,lon:2.304}],
      [{lat:48.753,lon:2.304},{lat:48.762,lon:2.304}],
    ],
  },{id:id+'-rame',totalLength:207,totalPower:4000,maxSpeed:160,elementDetails:[]},world);
  svc.state='moving'; svc.train.state='moving'; svc.currentStopIndex=1;
  svc.position={lat,lon:2.304};
  svc._state.cachedRoute=svc.routes[0];
  svc._state.index=0; svc._state.progress=0;
  return svc;
}

test('HOTFIX72: a following train cannot reserve Antony in front of the physical leader',()=>{
  const world=makeWorld();
  const sc=new ScheduleCreator();
  const vp={id:'vp-B-2',stationId:'B',voie:'2',lat:48.753,lon:2.304,occupiedBy:null};
  const vpm={
    getStationVoiePoints(id){return id==='B'?[vp]:[];},
    getVoiePointById(id){return id===vp.id?vp:null;},
    occupyVoiePoint(id,trainId){if(id!==vp.id)return false;if(vp.occupiedBy!=null&&vp.occupiedBy!==trainId)return false;vp.occupiedBy=trainId;return true;},
    releaseVoiePoint(id,trainId){if(id===vp.id&&vp.occupiedBy===trainId)vp.occupiedBy=null;},
    getVoieAtPosition(){return '2';},
  };
  globalThis.window={game:{scheduleCreator:sc,voiePointManager:vpm}};
  const leader=service(sc,world,'012','EYAN 02',48.75295);
  const follower=service(sc,world,'014','EYAN 04',48.7470);

  // Reproduce the screenshot deadlock: follower ticked first, speculatively owns B/2,
  // then it is stopped by spacing behind leader.
  assert.equal(follower._reserveArrivalResources(world.getStationById('B'),follower.getNextStop()),true);
  assert.equal(vp.occupiedBy,follower.id);
  follower.train.delayReason='espacement avec le train précédent';

  assert.equal(leader._reserveArrivalResources(world.getStationById('B'),leader.getNextStop()),true,
    'physical leader must take the station resource from its follower');
  assert.equal(vp.occupiedBy,leader.id);
  assert.equal(follower._platformAssignment,null,'follower speculative assignment is revoked');
});


test('HOTFIX72: an actually occupied Antony platform is never stolen',()=>{
  const world=makeWorld();
  const sc=new ScheduleCreator();
  const vp={id:'vp-B-2',stationId:'B',voie:'2',lat:48.753,lon:2.304,occupiedBy:null};
  const vpm={
    getStationVoiePoints(id){return id==='B'?[vp]:[];},
    getVoiePointById(id){return id===vp.id?vp:null;},
    occupyVoiePoint(id,trainId){if(id!==vp.id)return false;if(vp.occupiedBy!=null&&vp.occupiedBy!==trainId)return false;vp.occupiedBy=trainId;return true;},
    releaseVoiePoint(id,trainId){if(id===vp.id&&vp.occupiedBy===trainId)vp.occupiedBy=null;},
    getVoieAtPosition(){return '2';},
  };
  globalThis.window={game:{scheduleCreator:sc,voiePointManager:vpm}};
  const atPlatform=service(sc,world,'010','AT PLATFORM',48.753);
  atPlatform.state='stopped_at_station'; atPlatform.train.state='stopped_at_station';
  atPlatform.train.stoppedAt=world.getStationById('B'); atPlatform.currentStopIndex=2;
  atPlatform._platformAssignment={stationId:'B',platform:'2',voiePointId:'vp-B-2',source:'VOIE_POINT'};
  vp.occupiedBy=atPlatform.id;
  const approaching=service(sc,world,'012','EYAN 02',48.75295);
  assert.equal(approaching._reserveArrivalResources(world.getStationById('B'),approaching.getNextStop()),false);
  assert.equal(vp.occupiedBy,atPlatform.id);
});
test('HOTFIX72: night GPS keeps true NASA imagery without expensive screen/filter compositor',()=>{
  const map=fs.readFileSync(new URL('../map.js',import.meta.url),'utf8');
  assert.match(map,/VIIRS_Black_Marble/);
  assert.match(map,/SATELLITE_NIGHT_TINT/);
  assert.doesNotMatch(map,/globalCompositeOperation\s*=\s*['"]screen['"]/);
  assert.doesNotMatch(map,/brightness\(31%\)/);
  assert.doesNotMatch(map,/contrast\(118%\)/);
});
