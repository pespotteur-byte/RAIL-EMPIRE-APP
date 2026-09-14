import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GraphMarche } from '../graph-marche.js';

test('HOTFIX38 graph station search is accent/case/punctuation insensitive', () => {
  const g = new GraphMarche();
  assert.equal(g._normalizeStationSearch("Paris-Gare-de-l’Est"), 'paris gare de l est');
  assert.equal(g._normalizeStationSearch('ÉVRY  Courcouronnes'), 'evry courcouronnes');
});

test('HOTFIX38 search indexes all gameplay stations, not only active-service stations', () => {
  const g = new GraphMarche();
  const index = g._stationSearchIndex({world:{stations:[
    {id:1,name:'Paris Gare de l’Est',country:'FR'},
    {id:2,name:'Pantin',country:'FR'},
  ]}}, [{id:3,name:'Berlin Hbf',country:'DE'}, {id:2,name:'Pantin duplicate',country:'FR'}]);
  assert.equal(index.length, 3);
  assert.equal(index[2].id, '3');
  assert.equal(index[2].norm, 'berlin hbf');
});

test('HOTFIX38 active-service station is preferred while global stations remain searchable', () => {
  const g = new GraphMarche();
  const idx = [
    {id:'1',name:'Paris Gare de Lyon',norm:'paris gare de lyon',country:'FR'},
    {id:'2',name:'Paris Gare de l’Est',norm:'paris gare de l est',country:'FR'},
    {id:'3',name:'Paris Nord',norm:'paris nord',country:'FR'},
  ];
  const hits = g._stationSearchMatches(idx, 'Paris', new Set(['2']), 12);
  assert.equal(hits[0].id, '2');
  assert.deepEqual(new Set(hits.map(x=>x.id)), new Set(['1','2','3']));
});

test('HOTFIX38 exact station name wins and result limit is respected', () => {
  const g = new GraphMarche();
  const idx = [
    {id:'1',name:'Pantin',norm:'pantin',country:'FR'},
    {id:'2',name:'Pantin Est',norm:'pantin est',country:'FR'},
    {id:'3',name:'Le Pantin',norm:'le pantin',country:'FR'},
  ];
  const hits = g._stationSearchMatches(idx, 'Pantin', new Set(), 2);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].id, '1');
});

test('HOTFIX38 Graphique page uses search inputs instead of giant station selects', () => {
  const src = fs.readFileSync(new URL('../graph-marche.js', import.meta.url), 'utf8');
  assert.match(src, /gm-station-\$\{side\}-search/);
  assert.match(src, /placeholder="Rechercher une gare/);
  assert.doesNotMatch(src, /<select id="gm-station-a"/);
  assert.doesNotMatch(src, /<select id="gm-station-b"/);
});
