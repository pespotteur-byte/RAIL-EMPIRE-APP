import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEmbeddedStationPack } from '../global-stations.js';

test('v1.1.10: charge des shards locaux classic-script dans l ordre', async () => {
  const oldDoc = globalThis.document;
  const oldPack = globalThis.__RAILNET_WORLD_STATION_PACK__;
  const oldShard = globalThis.__RAILNET_WORLD_STATION_SHARD__;
  const rowsBySrc = {
    'data/railnet/stations/shard-0001.js': [['osm-node-1','A',4800000,200000,0,'','','1']],
    'data/railnet/stations/shard-0002.js': [['osm-node-2','B',4900000,300000,1,'','','2']],
  };
  globalThis.__RAILNET_WORLD_STATION_PACK__ = { prepared:true, generatedAt:'2026-08-14T00:00:00Z', shards:['shard-0001.js','shard-0002.js'] };
  globalThis.document = {
    createElement() { return { src:'', async:false, remove(){} }; },
    head: { appendChild(script) {
      setTimeout(() => {
        globalThis.__RAILNET_WORLD_STATION_SHARD__ = rowsBySrc[script.src];
        script.onload?.();
      }, 0);
    } },
  };
  try {
    const phases=[];
    const out = await loadEmbeddedStationPack(x => phases.push(x.phase));
    assert.equal(out.stations.length, 2);
    assert.equal(out.stations[0].name, 'A');
    assert.equal(out.stations[1].type, 'halt');
    assert.deepEqual(phases, ['embedded-shard','embedded-shard','embedded-ready']);
  } finally {
    globalThis.document = oldDoc;
    globalThis.__RAILNET_WORLD_STATION_PACK__ = oldPack;
    globalThis.__RAILNET_WORLD_STATION_SHARD__ = oldShard;
  }
});
