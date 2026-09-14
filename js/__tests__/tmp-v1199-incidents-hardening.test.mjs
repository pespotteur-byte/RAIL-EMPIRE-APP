import test from 'node:test';
import assert from 'node:assert/strict';
import { Incident, IncidentManager } from '../incidents.js';

test('Incident constructor finite-sanitizes corrupted numeric and route fields',()=>{
  const i=new Incident({id:12,typeId:'obstacle-on-track',duration:Infinity,remaining:NaN,speedLimit:-5,startTime:-3,route:[{lat:999,lon:2},{lat:48,lon:2},{lat:49,lon:3}]});
  assert.equal(i.id,'12');
  assert.ok(Number.isFinite(i.duration)&&i.duration>0);
  assert.ok(Number.isFinite(i.remaining)&&i.remaining>=0);
  assert.equal(i.speedLimit,0);
  assert.equal(i.startTime,0);
  assert.deepEqual(i.route,[{lat:48,lon:2},{lat:49,lon:3}]);
});

test('Incident load uses predefined effect/speed, normalizes numeric ids and rejects ghost stations/duplicates',()=>{
  const world={
    getStationById:id=>['A','B'].includes(String(id))?{id:String(id)}:null,
    tracks:[],
  };
  const m=new IncidentManager();
  assert.doesNotThrow(()=>m.loadFromSave([
    {id:5,typeId:'obstacle-on-track',stationA:'A',stationB:'B',effect:'slow',speedLimit:333,duration:10,remaining:5,active:true},
    {id:'5',typeId:'obstacle-on-track',stationA:'A',stationB:'B',duration:10,remaining:5,active:true},
    {id:'inc-6',typeId:'obstacle-on-track',stationA:'MISSING',stationB:'B',duration:10,remaining:5,active:true},
    {id:'inc-7',typeId:'unknown',stationA:'A',stationB:'B',duration:10,remaining:5,active:true},
  ],world));
  assert.equal(m.activeIncidents.length,1);
  assert.equal(m.activeIncidents[0].id,'5');
  const type=m.predefinedTypes.find(t=>t.id==='obstacle-on-track');
  assert.equal(m.activeIncidents[0].effect,type.effect);
  assert.equal(m.activeIncidents[0].speedLimit,type.speedLimit??0);
});
