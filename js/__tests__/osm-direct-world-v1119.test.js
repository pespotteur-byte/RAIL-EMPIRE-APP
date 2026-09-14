import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORMClient } from '../orm.js';
import { World } from '../world.js';
import { LineManager } from '../line.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

test('v1.1.32: OSM station parser keeps rail/RER multimodal and excludes pure urban rail', () => {
  const orm = new ORMClient();
  const parsed = orm._parseStations({ elements: [
    { type:'node', id:1, lat:48.8, lon:2.3, tags:{ railway:'station', name:'Mainline', train:'yes' } },
    { type:'node', id:2, lat:48.81, lon:2.31, tags:{ railway:'station', name:'RER + metro', train:'yes', subway:'yes', station:'subway' } },
    { type:'node', id:3, lat:48.82, lon:2.32, tags:{ railway:'station', name:'Metro only', subway:'yes', station:'subway' } },
    { type:'node', id:4, lat:48.83, lon:2.33, tags:{ railway:'halt', name:'Tram only', tram:'yes' } },
    { type:'node', id:5, lat:48.84, lon:2.34, tags:{ public_transport:'station', train:'yes', name:'PT train station' } },
    { type:'node', id:6, lat:48.85, lon:2.35, tags:{ railway:'station', station:'light_rail', name:'Light rail excluded' } },
    { type:'node', id:7, lat:48.86, lon:2.36, tags:{ railway:'station', station:'monorail', name:'Monorail excluded' } },
    { type:'node', id:8, lat:48.87, lon:2.37, tags:{ railway:'station', train:'no', name:'Railway station train=no kept' } },
  ]});
  const playable = parsed.filter(s => !s.urbanTransit);
  assert.deepEqual(playable.map(s => s.id), ['osm-node-1','osm-node-2','osm-node-5','osm-node-8']);
  assert.equal(parsed.find(s => s.id === 'osm-node-3').urbanTransit, true);
  assert.equal(parsed.find(s => s.id === 'osm-node-4').urbanTransit, true);
  assert.equal(parsed.find(s => s.id === 'osm-node-5').type, 'station');
  assert.equal(parsed.find(s => s.id === 'osm-node-6').urbanTransit, true);
  assert.equal(parsed.find(s => s.id === 'osm-node-7').urbanTransit, true);
});

test('v1.1.19: direct OSM station becomes gameplay Station without save bloat', async () => {
  const world = new World();
  const refs = [{ id:'osm-node-123', name:'Gare OSM', lat:48.96, lon:2.95, type:'station', network:'rail' }];
  const count = await world.setBuiltInGameplayStationsAsync(refs);
  assert.equal(count, 1);
  const st = world.getStationById('osm-node-123');
  assert.ok(st);
  assert.equal(st._nativeOSM, true);
  assert.equal(world.toSave().stations.length, 0, 'unchanged OSM-native station is reconstructed, not serialized');
});

test('v1.1.34: all-zoom Europe gameplay baseline coexists with direct OSM enrichment', () => {
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const newHandler = main.slice(main.indexOf("btnNew.addEventListener"), main.indexOf("btnLoad.addEventListener"));
  assert.ok(!newHandler.includes('_ensureRailNetGameplayStations'));
  assert.ok(main.includes('_streamNativeOSMViewport'));
  assert.ok(main.includes('OSM/ORM = JEU'));
  assert.ok(index.includes('data/railnet/stations/manifest.js?v=1152'));
  assert.ok(main.includes('_ensureAllZoomGameplayStations() {'));
});

test('v1.1.19: ORM is authoritative — no synthetic rail fallback', () => {
  const orm = new ORMClient();
  assert.equal(orm.makeFallbackRoute(48.0, 2.0, 48.0001, 2.0001), null);
  assert.equal(orm.makeFallbackRoute(48.0, 2.0, 49.0, 3.0), null);
});

test('v1.1.19: live station query asks OSM for rail stations/halts plus train=yes PT stations', () => {
  const src = fs.readFileSync(path.join(root, 'js/orm.js'), 'utf8');
  assert.ok(src.includes('nwr["railway"~"^(station|halt)$"]'));
  assert.ok(src.includes('nwr["public_transport"="station"]["train"="yes"]'));
  assert.ok(src.includes('stations-v6:')); // v1.1.32 invalidates all older station caches
});

test('v1.1.19: edited/deleted OSM-native stations survive save-before-baseline reload', async () => {
  const ref = { id:'osm-node-987', name:'Baseline', lat:48.1, lon:2.1, type:'station', train:'yes' };
  const a = new World();
  await a.setBuiltInGameplayStationsAsync([ref]);
  a.getStationById(ref.id).name = 'Nom joueur';
  const saveEdited = a.toSave();
  assert.equal(saveEdited.stations.length, 1, 'edited native station saved as delta');

  const b = new World();
  b.loadFromSave(saveEdited); // real startup order: save is loaded before live OSM baseline
  await b.setBuiltInGameplayStationsAsync([ref]);
  assert.equal(b.getStationById(ref.id).name, 'Nom joueur', 'later OSM load does not erase player edit');

  const c = new World();
  await c.setBuiltInGameplayStationsAsync([ref]);
  c.removeStation(ref.id);
  const saveDeleted = c.toSave();
  assert.ok(saveDeleted.builtInRemoved.includes(ref.id), 'native deletion stored as tombstone');
  const d = new World();
  d.loadFromSave(saveDeleted);
  await d.setBuiltInGameplayStationsAsync([ref]);
  assert.equal(d.getStationById(ref.id), undefined, 'later OSM load respects deletion tombstone');
});

test('v1.1.19: FILE bundle contains the direct OSM world contract', () => {
  const bundle = fs.readFileSync(path.join(root, 'js/rail-empire.file.bundle.js'), 'utf8');
  assert.ok(bundle.startsWith('/* Rail Empire v1.1.') && bundle.includes('FILE:// CORE bundle')); // same direct-world contract, current release
  assert.ok(bundle.includes('OSM/ORM = JEU'));
  assert.ok(bundle.includes('stations-v6:')); // cache bumped after poisoned-cache fix
  assert.ok(bundle.includes('makeFallbackRoute(fromLat, fromLon, toLat, toLon)'));
  assert.ok(bundle.includes('return null;'));
  assert.ok(!bundle.includes("this._ensureRailNetGameplayStations().catch(err => console.warn('RailNet gameplay preload failed:'"));
});

test('v1.1.19: line creation never fabricates a track when ORM has no route', async () => {
  const { LineManager } = await import('../line.js');
  const world = new World();
  const a = world.addStation({ id:'a', name:'A', lat:48.9, lon:2.9 });
  const b = world.addStation({ id:'b', name:'B', lat:49.0, lon:3.0 });
  const lm = new LineManager();
  const orm = {
    findRoute: async () => null,
    getRouteDistance: () => { throw new Error('must not be called for null route'); },
  };
  const line = await lm.buildLine({ name:'No fake rail', stops:[a.id,b.id] }, world, orm);
  assert.equal(line, null);
  assert.equal(world.tracks.length, 0);
  assert.equal(lm.getAll().length, 0);
});

test('v1.1.19: failed later leg rolls back ORM/manual tracks created by the same line build', async () => {
  const { LineManager } = await import('../line.js');
  const world = new World();
  world.addStation({ id:'a', name:'A', lat:48.9, lon:2.9 });
  world.addStation({ id:'b', name:'B', lat:48.91, lon:2.91 });
  world.addStation({ id:'c', name:'C', lat:49.0, lon:3.0 });
  const lm = new LineManager();
  let calls = 0;
  const good = [{lat:48.9,lon:2.9,maxSpeed:120},{lat:48.91,lon:2.91,maxSpeed:120}];
  const orm = {
    findRoute: async () => (++calls === 1 ? good : null),
    getRouteDistance: route => route ? 2 : 0,
  };
  const line = await lm.buildLine({ name:'Rollback', stops:['a','b','c'] }, world, orm);
  assert.equal(line, null);
  assert.equal(world.tracks.length, 0, 'first leg is rolled back when second leg is impossible');
});

test('v1.1.19: saved native OSM edit stays marked native before its OSM baseline is re-streamed', async () => {
  const w1 = new World();
  await w1.setBuiltInGameplayStationsAsync([{ id:'osm-node-77', name:'Original', lat:48.9, lon:2.9 }]);
  const edited = w1.getStationById('osm-node-77');
  edited.name = 'Edited';
  const save = w1.toSave();
  assert.equal(save.stations.length, 1);
  const w2 = new World();
  w2.loadFromSave(save);
  const restored = w2.getStationById('osm-node-77');
  assert.equal(restored.name, 'Edited');
  assert.equal(restored._nativeOSM, true);
  await w2.setBuiltInGameplayStationsAsync([{ id:'osm-node-77', name:'Original', lat:48.9, lon:2.9 }]);
  assert.equal(w2.getStationById('osm-node-77').name, 'Edited', 'player delta survives late OSM baseline arrival');
});

test('v1.1.19: automatic station/line code contains no provisional straight railway fallback', () => {
  const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
  const line = fs.readFileSync(path.join(root, 'js/line.js'), 'utf8');
  assert.ok(!line.includes('Math.pow((stB.lat - stA.lat) * 111'));
  assert.ok(!ui.includes('pendingOrmTrack = this.game.world.addTrack({'));
  assert.ok(ui.includes('aucune voie fictive créée'));
});

test('v1.1.19: gameplay-pinned OSM station survives reload without serializing the whole streamed catalogue', async () => {
  const w1 = new World();
  await w1.setBuiltInGameplayStationsAsync([
    { id:'osm-node-501', name:'Used station', lat:48.95, lon:2.95 },
    { id:'osm-node-502', name:'Merely viewed', lat:48.96, lon:2.96 },
  ]);
  const save = w1.toSave({ pinNativeStationIds: new Set(['osm-node-501']) });
  assert.equal(save.stations.length, 0, 'unchanged native stations stay out of normal station deltas');
  assert.deepEqual(save.nativeRefs?.map(r => r.id), ['osm-node-501'], 'only gameplay-used native station is pinned');

  const w2 = new World();
  w2.loadFromSave(save);
  assert.equal(w2.getStationById('osm-node-501')?.name, 'Used station');
  assert.equal(w2.getStationById('osm-node-502'), undefined, 'unreferenced viewed station is not bloating the save');
});


test('v1.1.19: line creation aborts and rolls back if any leg has no real OSM route', async () => {
  const world = new World();
  const a = world.addStation({ id:'a', name:'A', lat:48.0, lon:2.0 });
  const b = world.addStation({ id:'b', name:'B', lat:48.1, lon:2.1 });
  const c = world.addStation({ id:'c', name:'C', lat:48.2, lon:2.2 });
  let calls = 0;
  const orm = {
    async findRoute() {
      calls++;
      if (calls === 1) return [
        {lat:a.lat,lon:a.lon,maxSpeed:120,electrified:true},
        {lat:b.lat,lon:b.lon,maxSpeed:120,electrified:true},
      ];
      return null;
    },
    getRouteDistance(route) { return route?.length >= 2 ? 15 : 0; },
  };
  const lines = new LineManager();
  const line = await lines.buildLine({ name:'Test', stops:['a','b','c'] }, world, orm);
  assert.equal(line, null);
  assert.equal(world.tracks.length, 0, 'partial first leg is rolled back');
  assert.equal(lines.getAll().length, 0, 'invalid line is not registered');
});
