import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../world.js';

test('v1.1.10: un world reference est resolvable comme gare avant activation', () => {
  const w = new World();
  w.setReferenceStations([{ id:'osm-node-42', name:'Mannheim Test', lat:49.48, lon:8.47, type:'station', uicRef:'8000244', osmType:'node', osmId:'42' }]);
  const st = w.getStationById('osm-node-42');
  assert.ok(st);
  assert.equal(st.name, 'Mannheim Test');
  assert.equal(st.type, 'voyageur');
  assert.equal(st.platforms, 2);
  assert.equal(w.stations.length, 0);
});

test('v1.1.10: activation materialise une vraie gare gameplay au meme ID', () => {
  const w = new World();
  w.setReferenceStations([{ id:'osm-node-42', name:'Mannheim Test', lat:49.48, lon:8.47, type:'station', uicRef:'8000244', osmType:'node', osmId:'42' }]);
  const st = w.activateReferenceStation('osm-node-42');
  assert.ok(st);
  assert.equal(st.id, 'osm-node-42');
  assert.equal(st.name, 'Mannheim Test');
  assert.equal(st.type, 'voyageur');
  assert.equal(st.platforms, 2);
  assert.equal(st.referenceSourceId, 'osm-node-42');
  assert.equal(w.stations.length, 1);
  assert.equal(w.isReferenceStationActivated('osm-node-42'), true);
  assert.equal(w.getStationById('osm-node-42'), st);
  assert.equal(w.activateReferenceStation('osm-node-42'), st, 'activation idempotente');
});

test('v1.1.10: seules les gares monde activees entrent dans la sauvegarde', () => {
  const w = new World();
  w.setReferenceStations([
    { id:'osm-node-1', name:'A', lat:48, lon:2, type:'station' },
    { id:'osm-node-2', name:'B', lat:49, lon:3, type:'halt' },
  ]);
  w.activateReferenceStation('osm-node-2');
  const save = w.toSave();
  assert.equal(save.stations.length, 1);
  assert.equal(save.stations[0].id, 'osm-node-2');
  assert.equal(save.stations[0].rs, 'osm-node-2');
  assert.equal(JSON.stringify(save).includes('osm-node-1'), false);
});

test('v1.1.10: une gare monde activee survit au reload meme sans pack charge', () => {
  const w = new World();
  w.setReferenceStations([{ id:'osm-node-7', name:'Test Hbf', lat:50, lon:8, type:'station' }]);
  const st = w.activateReferenceStation('osm-node-7');
  st.platforms = 6;
  const save = w.toSave();
  const w2 = new World();
  w2.loadFromSave(save);
  const restored = w2.getStationById('osm-node-7');
  assert.ok(restored);
  assert.equal(restored.name, 'Test Hbf');
  assert.equal(restored.platforms, 6);
  assert.equal(restored.referenceSourceId, 'osm-node-7');
});
