import test from 'node:test';
import assert from 'node:assert/strict';
import { IncidentManager, PREDEFINED_INCIDENT_TYPES } from '../incidents.js';
import { setGlobalRng } from '../rng.js?v=1784250033';

const byId = id => PREDEFINED_INCIDENT_TYPES.find(t => t.id === id);
function seqRng(values){ let i=0; return { random(){ return values[Math.min(i++,values.length-1)] ?? 0; } }; }

const stations = [
  {id:'M',name:'Meaux',lat:48.96,lon:2.88},
  {id:'C',name:'Chelles',lat:48.88,lon:2.60},
];
const tracks = [{id:'MC',name:'Meaux — Chelles',stationA:'M',stationB:'C',electrified:true,route:[{lat:48.96,lon:2.88},{lat:48.88,lon:2.60}]}];
const world = { stations, tracks, getStationById(id){ return stations.find(s=>s.id===id)||null; } };

function stoppedService(id, stationId){
  const st=world.getStationById(stationId);
  return {
    // RC20: arrival cursor points after the actually occupied booked stop.
    id, state:'stopped_at_station', speed:0, position:{lat:st.lat,lon:st.lon}, currentStopIndex:stationId==='M'?2:1,
    train:{id:`T-${id}`,stoppedAt:stationId,totalCapacity:500,incident:null},
    getCurrentStops(){ return [{stationId:'C'},{stationId:'M'}]; },
  };
}

test('v1.1.75 train-target incident probabilities are divided by five',()=>{
  assert.equal(byId('door-problem').probability,1.4);
  assert.equal(byId('crowding').probability,1.4);
  assert.equal(byId('train-breakdown').probability,0.9);
  assert.equal(byId('train-breakdown').summerProbability,1.5);
  assert.equal(byId('passenger-illness').probability,3);
  assert.equal(byId('track-incident').probability,15,'network incident weights stay unchanged');
  assert.equal(byId('law-enforcement').probability,15,'station incident weights stay unchanged');
});

test('v1.1.75 same train incident type cannot exist twice at Meaux',()=>{
  const m=new IncidentManager();
  const a=stoppedService('A','M');
  const b=stoppedService('B','M');
  setGlobalRng(seqRng([0,0,0,0]));
  const first=m._spawnTrainIncident(byId('passenger-illness'),[a,b],600,world);
  assert.ok(first);
  assert.equal(first.locationKey,'station:M');
  const second=m._spawnTrainIncident(byId('passenger-illness'),[a,b],600,world);
  assert.equal(second,null);
  assert.equal(m.activeIncidents.length,1);
  setGlobalRng(null);
});

test('v1.1.75 same train incident type may exist simultaneously at another station',()=>{
  const m=new IncidentManager();
  const meaux=stoppedService('M1','M');
  const chelles=stoppedService('C1','C');
  setGlobalRng(seqRng([0,0,0,0]));
  assert.ok(m._spawnTrainIncident(byId('passenger-illness'),[meaux],600,world));
  assert.ok(m._spawnTrainIncident(byId('passenger-illness'),[chelles],600,world));
  assert.deepEqual(new Set(m.activeIncidents.map(i=>i.locationKey)),new Set(['station:M','station:C']));
  setGlobalRng(null);
});

test('v1.1.75 different incident types may coexist at the same place',()=>{
  const m=new IncidentManager();
  const svc=stoppedService('M1','M');
  setGlobalRng(seqRng([0,0,0,0]));
  assert.ok(m._spawnTrainIncident(byId('passenger-illness'),[svc],600,world));
  assert.ok(m._spawnTrainIncident(byId('door-problem'),[svc],600,world));
  assert.equal(m.activeIncidents.length,2);
  assert.equal(m.activeIncidents[0].locationKey,m.activeIncidents[1].locationKey);
  assert.notEqual(m.activeIncidents[0].typeId,m.activeIncidents[1].typeId);
  setGlobalRng(null);
});

test('v1.1.75 same infrastructure incident type is also locked per segment',()=>{
  const m=new IncidentManager();
  setGlobalRng(seqRng([0,0,0,0]));
  assert.ok(m._spawnTrackIncident(byId('track-incident'),world));
  assert.equal(m._spawnTrackIncident(byId('track-incident'),world),null);
  assert.ok(m._spawnTrackIncident(byId('signal-failure'),world),'another type may use same segment');
  setGlobalRng(null);
});

test('v1.1.75 duplicate lock survives save/load and collapses old duplicate saves',()=>{
  const m=new IncidentManager();
  m.loadFromSave([
    {id:'inc-100',typeId:'passenger-illness',name:'Malaise voyageur',stationA:'M',stationB:'M',locationText:'à Meaux',active:true,duration:10,remaining:8},
    {id:'inc-101',typeId:'passenger-illness',name:'Malaise voyageur',stationA:'M',stationB:'M',locationText:'à Meaux',active:true,duration:10,remaining:7},
    {id:'inc-102',typeId:'door-problem',name:'Problème de porte',stationA:'M',stationB:'M',locationText:'à Meaux',active:true,duration:5,remaining:4},
  ],world);
  assert.equal(m.activeIncidents.length,2);
  assert.equal(m.activeIncidents.filter(i=>i.typeId==='passenger-illness').length,1);
  const saved=m.getActiveIncidentsSave();
  assert.ok(saved.every(i=>i.locationKey),'canonical location key persisted');
});
