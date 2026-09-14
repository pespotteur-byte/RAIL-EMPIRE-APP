import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TileMap } from '../map.js';
import { OSM_STANDARD_URL } from '../tile-access-policy.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX47 operational issue icons progressively grow with zoom',()=>{
  const src=read('js/renderer.js');
  assert.match(src,/_operationalIconSize\(zoom\)[\s\S]*z - 5\) \* 2\.1/);
  assert.match(src,/_operationalStationIconSize\(zoom\)[\s\S]*z - 5\) \* 1\.25/);
});

test('HOTFIX47 basic mode station names are black unless satellite is active',()=>{
  const src=read('js/renderer.js');
  assert.match(src,/blackStationNames = !!this\.tileMap\.basicMode && !this\.tileMap\.satelliteEnabled/);
  assert.match(src,/blackStationNames \? '#000000'/);
});

test('HOTFIX47 removes CARTO key-watermarked tiles and uses keyless OSM base',()=>{
  const map=read('js/map.js');
  const index=read('index.html');
  assert.doesNotMatch(map,/cartocdn\.com/);
  assert.doesNotMatch(index,/cartocdn\.com/);
  // RC9 moves the source URL into a strict policy module: assert the real runtime default.
  const tiles=new TileMap();
  try {
    assert.equal(OSM_STANDARD_URL,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    assert.deepEqual(tiles.baseTileUrls,[OSM_STANDARD_URL]);
    assert.equal(tiles.getBaseMapSource().url,OSM_STANDARD_URL);
  } finally { tiles.dispose(); }
  assert.match(map,/labelTileUrls = \[\]/);
  assert.match(map,/isDarkBaseLayer/);
  assert.match(index,/© OpenStreetMap contributors · OpenRailwayMap/);
});

test('HOTFIX47 FILE cache exposes new Livemap runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const index=read('index.html');
  assert.match(bundle,/HOTFIX47-LIVEMAP-ZOOM-LABELS-KEYLESS-BASEMAP/);
  assert.doesNotMatch(bundle,/basemaps\.cartocdn\.com/);
  assert.match(bundle,/blackStationNames/);
  assert.match(index,/1199repair24&fullaudit=1/);
});
