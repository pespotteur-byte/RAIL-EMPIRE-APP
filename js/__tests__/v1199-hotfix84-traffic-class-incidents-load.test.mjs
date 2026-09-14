import test from 'node:test';
import assert from 'node:assert/strict';
import { IncidentManager, PREDEFINED_INCIDENT_TYPES } from '../incidents.js';
import { Economy } from '../economy.js';

const world = {
  stations: [{id:'S1', name:'Test', lat:48, lon:2}], tracks: [],
  getStationById(id){ return this.stations.find(s=>String(s.id)===String(id)) || null; }
};

function stoppedService(serviceType, totalCapacity=500) {
  return {
    id:`svc-${serviceType}`, name:`${serviceType} 1`, number:'1', serviceType,
    category: serviceType === 'passager' ? 'voyageur' : serviceType,
    state:'stopped_at_station', speed:0, currentStopIndex:1,
    position:{lat:48,lon:2}, rame:{totalCapacity},
    stops:[{stationId:'S1', type:'arret', lat:48, lon:2}],
    train:{id:`tr-${serviceType}`, name:'Train', stoppedAt:'S1', totalCapacity, rame:{totalCapacity}},
  };
}

for (const incidentId of ['crowding','passenger-illness']) {
  test(`${incidentId}: only commercial passenger traffic is eligible`, () => {
    const type = PREDEFINED_INCIDENT_TYPES.find(t=>t.id===incidentId);
    assert.ok(type);
    for (const cls of ['fret','w','hlp','tm','infra','ttx']) {
      const manager = new IncidentManager();
      assert.equal(manager._spawnTrainIncident(type, [stoppedService(cls, 500)], 480, world), null, cls);
    }
    const manager = new IncidentManager();
    const inc = manager._spawnTrainIncident(type, [stoppedService('passager', 500)], 480, world);
    assert.ok(inc, 'Voyageur/passager must remain eligible');
  });
}

test('door problem remains capacity-based and is not changed by passenger-only human incident rule', () => {
  const type = PREDEFINED_INCIDENT_TYPES.find(t=>t.id==='door-problem');
  const manager = new IncidentManager();
  assert.ok(manager._spawnTrainIncident(type, [stoppedService('w', 500)], 480, world));
});

for (const cls of ['w','hlp','tm']) {
  test(`${cls}: service is forced empty and cannot keep a load`, () => {
    const economy = new Economy();
    const service = {
      id:`svc-${cls}`, name:cls, serviceType:cls,
      rame:{totalCapacity:500,totalMass:100,maxSpeed:120},
      train:{category:cls,delay:0},
      _onboardPax:123,_onboardPassengerKm:456,_onboardFreight:78,_contractFreight:12,_contractCargoId:'C1',
      stops:[{stationId:'S1',type:'arret'}], currentStopIndex:0,
      getCurrentStops(){return this.stops;}
    };
    economy.processStopRevenue(service,'Test',0,true,false,'S1',[]);
    assert.equal(service._onboardPax,0);
    assert.equal(service._onboardPassengerKm,0);
    assert.equal(service._onboardFreight,0);
    assert.equal(service._contractFreight,0);
    assert.equal(service._contractCargoId,'');
    assert.equal(economy.totalPassengers,0);
    assert.equal(economy.totalFreightTonnes,0);
  });
}
