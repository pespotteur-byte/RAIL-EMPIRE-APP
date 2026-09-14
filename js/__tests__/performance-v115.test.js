import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

test('V1.1.5 a 500 km bbox is automatically tiled into bounded Overpass requests', () => {
  const orm = new ORMClient();
  const tiles = orm._tileBbox(48.0, 2.0, 48.35, 8.7, 35);
  assert.ok(tiles.length > 5, `expected multiple tiles, got ${tiles.length}`);
  for (const t of tiles) {
    const nsKm = (t.north - t.south) * 111.32;
    const ewKm = (t.east - t.west) * 111.32 * Math.cos(((t.south+t.north)/2)*Math.PI/180);
    assert.ok(nsKm < 50, `north/south tile too large ${nsKm}`);
    assert.ok(ewKm < 50, `east/west tile too large ${ewKm}`);
  }
});

test('V1.1.5 tiled rail import keeps successful tiles and deduplicates OSM ways', async () => {
  const orm = new ORMClient();
  let calls = 0;
  orm.fetchArea = async (s,w,n,e,opts) => {
    calls++;
    const id = Math.round((w+180)*1000);
    return { ok:true, ways:[{id,geometry:[{lat:s,lon:w},{lat:n,lon:e}],maxSpeed:100,electrified:true,tracks:1,usage:'main',service:'',name:'',ref:'',trackRef:'',nodeIds:[]}], source:'test' };
  };
  const out = await orm.fetchRailwayTiled(48,2,48.1,3.5);
  assert.ok(calls > 1);
  assert.equal(new Set(out.map(w=>w.id)).size, out.length);
});

test('V1.1.5 failed rail tile is recursively subdivided instead of failing whole trace', async () => {
  const orm = new ORMClient();
  let largeFails = 0;
  orm.fetchArea = async (s,w,n,e,opts) => {
    if ((e-w) > 0.15) { largeFails++; return {ok:false,ways:[],error:new Error('simulated overload')}; }
    return {ok:true,ways:[{id:Math.round(w*1e5),geometry:[{lat:s,lon:w},{lat:n,lon:e}],maxSpeed:100,electrified:true,tracks:1,usage:'main',service:'',name:'',ref:'',trackRef:'',nodeIds:[]}]} ;
  };
  const ways = await orm._fetchRailTileResilient({south:48,west:2,north:48.1,east:2.5},0);
  assert.ok(largeFails >= 1);
  assert.ok(ways.length >= 2);
});

test('V1.1.5 station tiling stays independent and excludes duplicates by OSM id', async () => {
  const orm = new ORMClient();
  orm.fetchStationsArea = async () => ({ok:true,stations:[{id:'node-7',lat:48,lon:2,name:'Gare',urbanTransit:false}]});
  const out = await orm.fetchStationsTiled(48,2,48.2,3.2);
  assert.deepEqual(out.map(s=>s.id), ['node-7']);
});
