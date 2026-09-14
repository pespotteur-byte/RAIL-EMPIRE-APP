import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI } from '../ui.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

function makeUi(stations) {
  const ui = Object.create(UI.prototype);
  ui.game = {
    world: {
      stations,
      getStationById(id) { return stations.find(s => s.id === id) || null; }
    }
  };
  ui._infogareStationIndex = [];
  return ui;
}

test('Infogare station field is a text search, not a 17k-option select', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<input[^>]+id="infogare-station"[^>]+placeholder="Tapez le nom d’une gare/);
  assert.match(html, /id="infogare-station-suggestions"/);
  assert.doesNotMatch(html, /<select id="infogare-station"/);
});

test('Infogare search ignores accents, punctuation and case', () => {
  const ui = makeUi([
    { id: 'ct', name: 'Château-Thierry' },
    { id: 'hg', name: 'Hettange-Grande' },
    { id: 'psl', name: 'Paris Saint-Lazare' }
  ]);
  ui._rebuildInfogareStationIndex();
  assert.equal(ui._findInfogareStations('chateau thierry')[0]?.id, 'ct');
  assert.equal(ui._findInfogareStations('HETTANGE grande')[0]?.id, 'hg');
  assert.equal(ui._findInfogareStations('saint lazare')[0]?.id, 'psl');
});

test('Exact and prefix station matches rank before loose substring matches', () => {
  const ui = makeUi([
    { id: 'a', name: 'Ville de Metz' },
    { id: 'b', name: 'Metzervisse' },
    { id: 'c', name: 'Metz' }
  ]);
  ui._rebuildInfogareStationIndex();
  const ids = ui._findInfogareStations('metz').map(s => s.id);
  assert.deepEqual(ids.slice(0, 3), ['c', 'b', 'a']);
});

test('Closed stations are excluded from the Infogare autocomplete', () => {
  const ui = makeUi([
    { id: 'open', name: 'Dormans', closed: false },
    { id: 'closed', name: 'Dormans Fret', closed: true }
  ]);
  ui._rebuildInfogareStationIndex();
  assert.deepEqual(ui._findInfogareStations('dormans').map(s => s.id), ['open']);
});

test('Infogare board uses the selected gameplay station id stored by the autocomplete', () => {
  const src = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
  assert.match(src, /const stationId = String\(input\?\.dataset\?\.stationId \|\| this\._infogareSelectedStationId \|\| ''\)/);
  assert.match(src, /_selectInfogareStation\(btn\.dataset\.stationId, true\)/);
  assert.match(src, /this\._reBoard\.show\(stationId\)/);
});

test('FILE core bundle ships the v1.1.59 Infogare autocomplete contract', () => {
  const bundle = fs.readFileSync(path.join(root, 'js/rail-empire.file.bundle.js'), 'utf8');
  assert.match(bundle,/Rail Empire v1\.1\.[0-9]+ FILE:\/\/ CORE bundle/);
  assert.match(bundle, /_findInfogareStations\(query, limit = 12\)/);
  assert.match(bundle, /infogare-station-suggestions/);
  assert.match(bundle, /dataset\.stationId/);
  assert.match(bundle, /rail-empire\.catalog\.bundle\.js\?v=11[0-9]+/);
});
