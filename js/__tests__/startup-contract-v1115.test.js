import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const requiredMainMethods = [
  '_seedCatalogCargoTypes() {',
  '_ensureBaseCatalogSeeded() {',
  'seedCatalog() {',
  '_seedBatch186CatalogChunk(chunk) {',
  '_setCatalogLoadStatus(message, state = \'loading\') {',
  '_loadBatch186FullCatalogInBackground() {',
  '_streamNativeOSMViewport(force = false) {',
];

test('v1.1.34 startup contract: catalogue + OSM enrichment + all-zoom station bootstrap exist in source', () => {
  const src = read('js/main.js');
  for (const signature of requiredMainMethods) assert.ok(src.includes(signature), `missing main method: ${signature}`);
  assert.match(src, /this\._seedCatalogCargoTypes\(\);/);
  assert.match(src, /_loadBatch186FullCatalogInBackground/);
  const startGame = src.slice(src.indexOf('startGame(savedState)'), src.indexOf('_setWorldStationsStatus(', src.indexOf('startGame(savedState)')));
  assert.doesNotMatch(startGame, /\n    this\.seedCatalog\(\);/, 'Livemap startup must not eagerly materialize the stock catalogue');
  assert.ok(src.includes('_ensureAllZoomGameplayStations() {'), 'all-zoom gameplay station bootstrap must exist');
});

test('v1.1.34 startup contract: all-zoom bootstrap + OSM + catalogue survive the file bundle', () => {
  const bundle = read('js/rail-empire.file.bundle.js');
  for (const signature of requiredMainMethods) assert.ok(bundle.includes(signature), `missing bundled method: ${signature}`);
  assert.ok(bundle.includes('_ensureAllZoomGameplayStations() {'), 'all-zoom gameplay station bootstrap must survive bundle');
});

test('v1.1.34 startup contract: embedded Europe baseline is native gameplay and OSM enriches it', () => {
  const main = read('js/main.js');
  const world = read('js/world.js');
  const index = read('index.html');
  assert.match(main, /_streamNativeOSMViewport/);
  assert.match(main, /setBuiltInGameplayStationsAsync\(stations/);
  assert.ok(index.includes('data/railnet/stations/manifest.js'));
  assert.ok(main.includes('_ensureAllZoomGameplayStations() {'));
  assert.match(main, /await this\._ensureAllZoomGameplayStations\(\)/);
  assert.match(world, /setBuiltInGameplayStationsAsync/);
});
