import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleCreator } from '../schedule-creator.js';

function world3(){return {
  stations:[
    {id:'A',name:'A',lat:0,lon:0,platforms:2},
    {id:'B',name:'B',lat:0.01,lon:0,platforms:2},
    {id:'C',name:'C',lat:0.02,lon:0,platforms:2},
  ],tracks:[],getStationById(id){return this.stations.find(s=>s.id===id)||null;}
};}
function svc3(){
 const sc=new ScheduleCreator(); const w=world3(); global.window.game.scheduleCreator=sc;
 const s=sc.addService({name:'T',serviceType:'passager',stops:[
  {stationId:'A',type:'arret',departureTime:0,arrivalTime:0},
  {stationId:'B',type:'arret',departureTime:11,arrivalTime:10},
  {stationId:'C',type:'arret',departureTime:20,arrivalTime:20},
 ],routes:[[{lat:0,lon:0},{lat:.01,lon:0}],[{lat:.01,lon:0},{lat:.02,lon:0}]]},null,w);
 return {sc,w,s};
}
const boom={processStopRevenue(){throw new Error('boom stop')},processServiceRevenue(){throw new Error('boom complete')}};

describe('v1.1.99 economy hooks never deadlock physical circulation',()=>{
 beforeEach(()=>{global.window={game:{scheduleCreator:null,realismSettings:{delayTolerance:30}}};});
 it('origin departure survives stop-revenue exception',()=>{
  const {s}=svc3(); s.scheduleTick(0,'2026-08-25',boom);
  assert.equal(s.state,'moving'); assert.equal(s.currentStopIndex,1); assert.equal(s.train.state,'moving');
 });
 it('intermediate arrival survives stop-revenue exception and cursor advances',()=>{
  const {w,s}=svc3(); s.state='moving'; s.train.state='moving'; s.currentStopIndex=1; s.position={lat:0,lon:0};
  s.arriveAtStation(w.getStationById('B'),10,boom);
  assert.equal(s.state,'stopped_at_station'); assert.equal(s.currentStopIndex,2); assert.equal(s.train.stoppedAt?.id,'B');
 });
 it('completion survives service-revenue exception and releases service',()=>{
  const {w,s}=svc3(); s.state='moving'; s.train.state='moving'; s.currentStopIndex=2; s.position={lat:.01,lon:0};
  s.arriveAtStation(w.getStationById('C'),20,boom);
  assert.equal(s.state,'completed'); assert.equal(s.completed,true); assert.equal(s.train.state,'completed');
 });
});

describe('v1.1.99 ITE side effects never deadlock physical circulation',()=>{
 beforeEach(()=>{global.window={game:{scheduleCreator:null,realismSettings:{delayTolerance:30}}};});
 it('intermediate arrival survives malformed/throwing ITE manager',()=>{
  const {w,s}=svc3();
  global.window.game.depotManager={getITEInfo(){throw new Error('broken legacy ITE')}};
  global.window.game.iteModules={getLoadingSpeedMultiplier(){throw new Error('broken module')}};
  s.state='moving'; s.train.state='moving'; s.currentStopIndex=1; s.position={lat:0,lon:0};
  s.arriveAtStation(w.getStationById('B'),10,null);
  assert.equal(s.state,'stopped_at_station'); assert.equal(s.currentStopIndex,2); assert.equal(s.train.stoppedAt?.id,'B');
  assert.equal(s._iteDwellExtra,0); assert.equal(s._iteHardBlock,false);
 });
});
