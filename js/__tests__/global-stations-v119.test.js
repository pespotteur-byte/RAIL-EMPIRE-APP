import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldStationResponse, dedupeWorldStations } from '../global-stations.js';
import { World } from '../world.js';

const b = (value) => ({ type: 'literal', value: String(value) });
const uri = (value) => ({ type: 'uri', value });

function response(rows) {
  return {
    head: { vars: ['station','railway','name','centroid','stationKind','train','subway','tram','lightRail','monorail','uicRef'] },
    results: { bindings: rows },
  };
}

test('global stations: mainline station and halt are parsed', () => {
  const out = parseWorldStationResponse(response([
    { station: uri('https://www.openstreetmap.org/node/1'), railway: b('station'), name: b('Paris Test'), centroid: b('POINT(2.35 48.85)'), train: b('yes'), uicRef: b('UIC1') },
    { station: uri('https://www.openstreetmap.org/node/2'), railway: b('halt'), name: b('Halte Test'), centroid: b('POINT(2.4 48.9)') },
  ]));
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'osm-node-1');
  assert.equal(out[0].type, 'station');
  assert.equal(out[1].type, 'halt');
});

test('global stations: subway/tram/light rail only entries are excluded', () => {
  const out = parseWorldStationResponse(response([
    { station: uri('https://www.openstreetmap.org/node/10'), railway: b('station'), name: b('Metro'), centroid: b('POINT(2 48)'), stationKind: b('subway') },
    { station: uri('https://www.openstreetmap.org/node/11'), railway: b('station'), name: b('Tram'), centroid: b('POINT(2.1 48.1)'), tram: b('yes') },
    { station: uri('https://www.openstreetmap.org/node/12'), railway: b('station'), name: b('Light rail'), centroid: b('POINT(2.2 48.2)'), lightRail: b('yes') },
  ]));
  assert.equal(out.length, 0);
});

test('global stations: multimodal train=yes station is kept', () => {
  const out = parseWorldStationResponse(response([
    { station: uri('https://www.openstreetmap.org/node/20'), railway: b('station'), name: b('Intermodal'), centroid: b('POINT(6.1 49.5)'), train: b('yes'), tram: b('yes'), subway: b('yes') },
  ]));
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Intermodal');
});

test('global stations: dedupe by UIC and nearby normalized name', () => {
  const out = dedupeWorldStations([
    { id:'a', name:'Gare de Test', lat:48, lon:2, uicRef:'123' },
    { id:'b', name:'Autre nom', lat:49, lon:3, uicRef:'123' },
    { id:'c', name:'Gare de Téšt', lat:48.0005, lon:2.0005, uicRef:'' },
    { id:'d', name:'Gare de Test', lat:49, lon:2, uicRef:'' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'a');
  assert.equal(out[1].id, 'd');
});

test('world reference stations are spatially queryable but never serialized', async () => {
  const world = new World();
  await world.setReferenceStationsAsync([
    { id:'osm-node-1', name:'A', lat:48.0, lon:2.0, type:'station', reference:true },
    { id:'osm-node-2', name:'B', lat:48.2, lon:2.2, type:'halt', reference:true },
    { id:'osm-node-3', name:'C', lat:-33.8, lon:151.2, type:'station', reference:true },
  ], null, 1);
  assert.equal(world.referenceStations.length, 3);
  assert.equal(world.getReferenceStationsInBounds(47.9,1.9,48.3,2.3).length, 2);
  assert.equal(world.getReferenceStationsNear(48.0,2.0,5).length, 1);
  const save = world.toSave();
  assert.deepEqual(save.stations, []);
  assert.equal(JSON.stringify(save).includes('osm-node-1'), false);
});

test('world reference stations survive loading a player save', () => {
  const world = new World();
  world.setReferenceStations([{ id:'ref-1', name:'Reference', lat:50, lon:8, type:'station' }]);
  world.loadFromSave({ _v:2, stations:[{id:'player-1',n:'Player',la:5000000,lo:800000}], tracks:[] });
  assert.equal(world.stations.length, 1);
  assert.equal(world.referenceStations.length, 1);
  assert.equal(world.getReferenceStationById('ref-1').name, 'Reference');
});
