import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActiveService } from '../schedule-creator.js';

globalThis.window = globalThis.window || { game: {} };
window.game = window.game || {};

const stationA={id:'A',name:'Alpha',lat:48.0,lon:2.0,platforms:2};
const stationB={id:'B',name:'Bravo',lat:48.01,lon:2.01,platforms:2};
const stationC={id:'C',name:'Charlie',lat:48.02,lon:2.02,platforms:2};
const world={
  stations:[stationA,stationB,stationC],
  getStationById(id){ return this.stations.find(s=>s.id===id)||null; },
};
const rame={
  id:'rame-test',maxSpeed:160,totalFreightCapacity:0,totalCapacity:200,totalLength:100,
  totalKmRun:0,kmSinceLastMaint:0,wearLevel:0,elements:[],elementDetails:[],currentLocation:{},
};

test('early physical passenger arrival becomes stopped_at_station and departs at booked time',()=>{
  const svc=new ActiveService({
    id:'svc-early',name:'TER test',number:'1234',rameId:rame.id,
    v2OccurrenceId:'occ',v2RotationId:'rot',v2BaseDate:'2026-08-24',
    serviceType:'passager',
    stops:[
      {stationId:'A',type:'arret',arrivalTime:0,departureTime:0,lat:48,lon:2,platform:'1'},
      {stationId:'B',type:'arret',arrivalTime:10,departureTime:12,lat:48.01,lon:2.01,platform:'1'},
      {stationId:'C',type:'arret',arrivalTime:20,departureTime:22,lat:48.02,lon:2.02,platform:'1'},
    ],
    routes:[[{lat:48,lon:2},{lat:48.01,lon:2.01}],[{lat:48.01,lon:2.01},{lat:48.02,lon:2.02}]],
  },rame,world,null);
  svc._currentDate='2026-08-24';
  svc.currentStopIndex=1;
  svc.state='moving';
  svc.train.state='moving';
  svc.position={lat:48.01,lon:2.01};
  svc.speed=0; svc.train.speed=0;

  // Physical arrival at 00:09 for a booked 00:10 arrival / 00:12 departure.
  svc.arriveAtStation(stationB,9,null);
  assert.equal(svc.state,'stopped_at_station');
  assert.equal(svc.train.state,'stopped_at_station');
  assert.equal(svc.train.stoppedAt?.id,'B');
  assert.equal(svc.currentStopIndex,2);
  assert.equal(svc.delay,0,'passenger advance is not exposed as negative delay');
  assert.match(svc.train.delayReason,/arrivée en avance|attente heure de départ/);

  svc.scheduleTick(11,'2026-08-24',null);
  assert.equal(svc.state,'stopped_at_station','must wait before booked departure');
  svc.scheduleTick(12,'2026-08-24',null);
  assert.equal(svc.state,'moving','must depart at booked departure instead of becoming a zombie');
  assert.equal(svc.train.state,'moving');
});

test('selected Livemap route uses Schedule Creator stroke and no node dots; stations are red',()=>{
  const src=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  const start=src.indexOf('drawSelectedServiceRoute(ctx, world)');
  const end=src.indexOf('// v1.1.55 — marker geometry:',start);
  const block=src.slice(start,end);
  assert.match(block,/const BLUE = '#2583ff'/);
  assert.match(block,/const GREEN = '#1fc86a'/);
  assert.match(block,/const RED = '#ff4d5b'/);
  assert.match(block,/stroke\('#06101d', 8, 0\.9\)/);
  assert.match(block,/stroke\(color, 4\.5, 1\)/);
  assert.doesNotMatch(block,/visible dots|arc\(p\.x, p\.y, 2\.5/);
  assert.match(block,/ctx\.arc\(p\.x, p\.y, 6, 0, Math\.PI \* 2\)/);
});
