import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { GlobalStationCatalog } from '../global-stations.js';
import { World } from '../world.js';

const root = path.resolve(import.meta.dirname, '../..');
const stationDir = path.join(root, 'data/railnet/stations');

function runClassic(file, context) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

async function loadRealEmbeddedPack() {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = globalThis;
  vm.runInThisContext(fs.readFileSync(path.join(stationDir, 'manifest.js'), 'utf8'), { filename: path.join(stationDir, 'manifest.js') });
  globalThis.document = {
    head: { appendChild(script) {
      try {
        const rel = String(script.src).replace(/^data\/railnet\/stations\//, '');
        vm.runInThisContext(fs.readFileSync(path.join(stationDir, rel), 'utf8'), { filename: path.join(stationDir, rel) });
        queueMicrotask(() => script.onload?.());
      } catch (e) { queueMicrotask(() => script.onerror?.(e)); }
    } },
    createElement() { return { src:'', async:false, onload:null, onerror:null, remove(){} }; },
  };
  try {
    const cat = new GlobalStationCatalog();
    return await cat.load();
  } finally {
    delete globalThis.__RAILNET_WORLD_STATION_PACK__;
    delete globalThis.__RAILNET_WORLD_STATION_SHARD__;
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
}

test('v1.1.14+: toutes les gares embarquees sont materialisees directement dans world.stations', async () => {
  const refs = await loadRealEmbeddedPack();
  assert.ok(refs.length >= 17817);
  const w = new World();
  const count = await w.setBuiltInGameplayStationsAsync(refs, null, 5000);
  assert.equal(count, refs.length);
  assert.equal(w.stations.length, refs.length);
  assert.equal(w.referenceStations.length, 0, 'aucune activation reference ne doit etre necessaire');
  assert.equal(w._builtInStationCount, refs.length);
  assert.ok(w.stations.every(s => s._builtInRailNet === true));
  assert.ok(w.stations.every(s => s.type === 'voyageur'));
  const trilport = w.getStationById('tl-16220') || w.stations.find(s => s.uicRef === '8711649');
  assert.ok(trilport, 'Trilport doit etre une vraie gare gameplay');
  assert.equal(trilport.name, 'Trilport');
  assert.equal(trilport.country, 'FR');
});

test('v1.1.14: baseline native ne gonfle pas la sauvegarde', async () => {
  const w = new World();
  await w.setBuiltInGameplayStationsAsync([
    { id:'rail-a', name:'A', lat:48, lon:2, country:'FR', uicRef:'1' },
    { id:'rail-b', name:'B', lat:49, lon:3, country:'DE', uicRef:'2' },
  ]);
  const save = w.toSave();
  assert.equal(w.stations.length, 2);
  assert.equal(save.stations.length, 0, 'gares natives intactes non serialisees');
  assert.deepEqual(save.builtInRemoved, []);
  assert.equal(save._v, 3);
});

test('v1.1.14: edition et suppression de gares natives survivent au reload par delta', async () => {
  const base = [
    { id:'rail-a', name:'A', lat:48, lon:2, country:'FR', uicRef:'1' },
    { id:'rail-b', name:'B', lat:49, lon:3, country:'DE', uicRef:'2' },
  ];
  const w = new World();
  await w.setBuiltInGameplayStationsAsync(base);
  const a = w.getStationById('rail-a');
  a.name = 'A modifiee';
  a.platforms = 6;
  w.removeStation('rail-b');
  const save = w.toSave();
  assert.equal(save.stations.length, 1);
  assert.equal(save.stations[0].id, 'rail-a');
  assert.equal(save.stations[0].bi, true);
  assert.deepEqual(save.builtInRemoved, ['rail-b']);

  const w2 = new World();
  await w2.setBuiltInGameplayStationsAsync(base);
  w2.loadFromSave(save);
  assert.equal(w2.stations.length, 1);
  assert.equal(w2.getStationById('rail-a').name, 'A modifiee');
  assert.equal(w2.getStationById('rail-a').platforms, 6);
  assert.equal(w2.getStationById('rail-b'), undefined);
});

test('v1.1.14: un track peut viser une gare native non serialisee et rester valide apres reload', async () => {
  const base = [
    { id:'rail-a', name:'A', lat:48, lon:2, country:'FR' },
    { id:'rail-b', name:'B', lat:48.1, lon:2.1, country:'FR' },
  ];
  const w = new World();
  await w.setBuiltInGameplayStationsAsync(base);
  w.addTrack({ id:'t1', stationA:'rail-a', stationB:'rail-b', distance:15 });
  const save = w.toSave();
  assert.equal(save.stations.length, 0);
  assert.equal(save.tracks.length, 1);

  const w2 = new World();
  await w2.setBuiltInGameplayStationsAsync(base);
  w2.loadFromSave(save);
  assert.ok(w2.getStationById('rail-a'));
  assert.ok(w2.getStationById('rail-b'));
  assert.ok(w2.getTrackBetween('rail-a','rail-b'));
});

test('v1.1.14: charger un autre save restaure d abord le socle natif de la session courante', async () => {
  const base = [
    { id:'rail-a', name:'A', lat:48, lon:2, country:'FR', uicRef:'1' },
    { id:'rail-b', name:'B', lat:49, lon:3, country:'DE', uicRef:'2' },
  ];
  const w = new World();
  await w.setBuiltInGameplayStationsAsync(base);
  w.getStationById('rail-a').name = 'Session courante modifiee';
  w.removeStation('rail-b');

  // Simule un autre save vierge : aucune modification/suppression native.
  w.loadFromSave({ _v:3, stations:[], builtInRemoved:[], tracks:[] });
  assert.equal(w.stations.length, 2);
  assert.equal(w.getStationById('rail-a').name, 'A');
  assert.equal(w.getStationById('rail-b').name, 'B');
  assert.equal(w.getStationById('rail-b').uicRef, '2');
});
