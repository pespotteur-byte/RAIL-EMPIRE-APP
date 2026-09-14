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

function rawPack() {
  const context = vm.createContext({ window: {} });
  runClassic(path.join(stationDir, 'manifest.js'), context);
  const pack = context.window.__RAILNET_WORLD_STATION_PACK__;
  const rows = [];
  for (const shard of pack.shards) {
    context.window.__RAILNET_WORLD_STATION_SHARD__ = null;
    runClassic(path.join(stationDir, shard), context);
    rows.push(...context.window.__RAILNET_WORLD_STATION_SHARD__);
  }
  return { pack, rows };
}

test('v1.1.13: RailNet Europe rail-only est directement embarque, sans preparateur', () => {
  assert.equal(fs.existsSync(path.join(root, '1_PREPARER_GARES_MONDE.cmd')), false);
  assert.equal(fs.existsSync(path.join(root, '2_RESTAURER_BOOTSTRAP_EUROPE.cmd')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts/prepare-world-stations.ps1')), false);
  const { pack, rows } = rawPack();
  assert.equal(pack.prepared, true);
  assert.equal(pack.version, 3);
  assert.equal(pack.datasetKind, 'europe-russia-nz-rail-strict-final');
  assert.equal(pack.schema, 'compact-v3-country');
  assert.ok(pack.count >= 17817);
  assert.ok(pack.shards.length >= 10);
  assert.equal(rows.length, pack.count);
});

test('v1.1.99: contaminants routiers/metro purs restent exclus, avec tram-train allowlist explicite', () => {
  const { pack, rows } = rawPack();
  assert.match(String(pack.qualityPolicy || ''), /Metro\/tram\/light_rail excluded except explicit Paris\/Lyon allowlist/i);
  for (const name of ['St-Ouen Garibaldi','Ørestad St. (Metro)','Aéroport Marseille-Provence Bus','Aire-sur-l’Adour Office de Tourisme']) {
    assert.equal(rows.some(r => r[1] === name), false, name);
  }
  // Genuine rail/tram-train records and the explicit RATP allowlist are intentional.
  for (const name of ['Hoenheim-Tram','Châteaubriant Tram-Train','Lutterbach-Tram-Train','Mairie de Vélizy']) {
    assert.equal(rows.some(r => r[1] === name), true, name);
  }
});

test('v1.1.13: gares temoins rail presentes avec UIC, pays et positions attendues', () => {
  const { rows } = rawPack();
  const checks = [
    ['8711649','Trilport','FR',48.960136,2.949537],
    ['8768600','Paris Gare de Lyon','FR',48.844888,2.373520],
    ['8014008','Mannheim Hbf','DE',49.479296,8.469531],
    ['8013552','Hannover Hbf','DE',52.376763,9.741016],
  ];
  for (const [uic,name,country,lat,lon] of checks) {
    const r = rows.find(x => x[5] === uic);
    assert.ok(r, `${name} absente`);
    assert.equal(r[1], name);
    assert.equal(r[13], country);
    assert.ok(Math.abs(r[2] / 1e5 - lat) < 0.00002, `${name} latitude`);
    assert.ok(Math.abs(r[3] / 1e5 - lon) < 0.00002, `${name} longitude`);
  }
});

test('v1.1.13+: le vrai chargeur lit toutes les references embarquees et les active en gares gameplay', async () => {
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
    const refs = await cat.load();
    assert.equal(globalThis.__RAILNET_WORLD_STATION_PACK__.count, 31009);
    assert.equal(refs.length, 30977); // 32 duplicate references intentionally collapsed by the gameplay loader.
    assert.equal(cat.source, 'europe-russia-nz-rail-strict-final');
    assert.ok(refs.every(x => x.country && x.id));
    assert.equal(new Set(refs.map(x => x.id)).size, refs.length);

    const w = new World();
    w.setReferenceStations(refs);
    for (const ref of refs) {
      const st = w.activateReferenceStation(ref.id);
      assert.ok(st, ref.id);
      assert.equal(st.id, ref.id);
      assert.equal(st.type, 'voyageur');
      assert.equal(st.country, ref.country);
    }
    assert.equal(w.stations.length, refs.length);
  } finally {
    delete globalThis.__RAILNET_WORLD_STATION_PACK__;
    delete globalThis.__RAILNET_WORLD_STATION_SHARD__;
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
