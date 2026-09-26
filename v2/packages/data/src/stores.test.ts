import { describe, expect, it } from 'vitest';
import { ChunkLoader, MemoryChunkSource } from './chunks.ts';
import {
  CATALOG_INDEX_KEY,
  CATALOG_INDEX_SCHEMA,
  CATALOG_SHARD_SCHEMA,
  catalogShardKey,
  catalogShardOf,
  type CatalogEntry,
} from './catalog.ts';
import { CatalogStore } from './catalog-store.ts';
import { WorldRefStore } from './world-store.ts';
import { WORLD_INDEX_KEY, WORLD_INDEX_SCHEMA, WORLD_NAMES_KEY, WORLD_NAMES_SCHEMA, WORLD_TILE_SCHEMA, refRowFromPoint, worldTileKey, type RefPoint } from './world-ref.ts';

function entry(id: string, name: string, over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    name,
    seriesName: '',
    category: 'locomotive',
    traction: 'electrique',
    maxSpeed: 160,
    power: 4000,
    mass: 84,
    length: 17.5,
    tonnage: 0,
    passengerCapacity: 0,
    freightCapacity: 0,
    purchasePrice: 1_000_000,
    cargoTypes: [],
    technicallyCompatibleCargoTypes: [],
    image: '',
    source: 'test',
    country: 'France',
    operator: 'SNCF',
    wagonSubCategory: '',
    numberStart: '',
    isDrivingTrailer: false,
    isComposite: false,
    realIdentityId: '',
    realIdentitySeries: '',
    ...over,
  };
}

function catalogChunks(entries: CatalogEntry[], shardCount: number): Map<string, unknown> {
  const chunks = new Map<string, unknown>();
  const shards = new Map<number, CatalogEntry[]>();
  const countries = ['', ...new Set(entries.map((e) => e.country))];
  const operators = ['', ...new Set(entries.map((e) => e.operator))];
  chunks.set(CATALOG_INDEX_KEY, {
    schema: CATALOG_INDEX_SCHEMA,
    count: entries.length,
    shardCount,
    dict: { country: countries, operator: operators },
    id: entries.map((e) => e.id),
    name: entries.map((e) => e.name),
    seriesName: entries.map((e) => e.seriesName),
    category: entries.map((e) => ['locomotive', 'automotrice', 'voiture', 'wagon'].indexOf(e.category)),
    traction: entries.map((e) => ['none', 'electrique', 'diesel', 'vapeur', 'bi'].indexOf(e.traction)),
    country: entries.map((e) => countries.indexOf(e.country)),
    operator: entries.map((e) => operators.indexOf(e.operator)),
    maxSpeed: entries.map((e) => e.maxSpeed),
    length: entries.map((e) => e.length),
    purchasePrice: entries.map((e) => e.purchasePrice),
    passengerCapacity: entries.map((e) => e.passengerCapacity),
    hasImage: entries.map((e) => (e.image ? 1 : 0)),
  });
  for (const e of entries) {
    const s = catalogShardOf(e.id, shardCount);
    const list = shards.get(s) ?? [];
    list.push(e);
    shards.set(s, list);
  }
  for (let s = 0; s < shardCount; s++) {
    chunks.set(catalogShardKey(s), { schema: CATALOG_SHARD_SCHEMA, shard: s, entries: shards.get(s) ?? [] });
  }
  return chunks;
}

describe('CatalogStore', () => {
  const entries = [
    entry('cat-1', 'BB 22200', { seriesName: 'BB 22200 Sybic' }),
    entry('cat-2', 'Corail VTU', { category: 'voiture', traction: 'none', passengerCapacity: 80, image: 'img/x.gif' }),
    entry('cat-3', 'Sgnss', { category: 'wagon', traction: 'none', country: 'Europe', operator: 'UIC' }),
    entry('cat-4', 'ICE 3', { category: 'automotrice', country: 'Allemagne', operator: 'DB' }),
  ];
  const mk = (maxShards = 8) => new CatalogStore(new ChunkLoader(new MemoryChunkSource(catalogChunks(entries, 4))), maxShards);

  it('index : lignes, filtres, recherche accent-insensible', async () => {
    const store = mk();
    await store.ready();
    expect(store.count).toBe(4);
    expect(store.row(1)?.hasImage).toBe(true);
    expect(store.rowById('cat-4')?.country).toBe('Allemagne');
    expect(store.filter({ category: 'wagon' })).toEqual([2]);
    expect(store.filter({ traction: 'electrique' })).toEqual([0, 3]);
    expect(store.filter({ text: 'sybic' })).toEqual([0]);
    expect(store.filter({ text: 'ICE' })).toEqual([3]);
    expect(store.filter({ withImage: true })).toEqual([1]);
    expect(store.filter({ operator: 'DB' })).toEqual([3]);
    expect(store.filter({}, 2)).toEqual([0, 1]);
    expect(store.filter({ country: 'Atlantide' })).toEqual([]);
    expect(store.filter({ operator: 'Inconnu' })).toEqual([]);
  });

  it('chargements concurrents d\'un shard : une seule entrée LRU', async () => {
    const store = mk(1);
    await Promise.all([store.get('cat-1'), store.get('cat-1'), store.get('cat-1')]);
    expect(store.loadedShardCount).toBe(1);
    await store.get('cat-2');
    expect(store.loadedShardCount).toBe(1);
  });

  it('fiches à la demande + LRU des shards', async () => {
    const store = mk(1);
    const a = await store.get('cat-1');
    expect(a?.seriesName).toBe('BB 22200 Sybic');
    expect(store.loadedShardCount).toBe(1);
    for (const id of ['cat-2', 'cat-3', 'cat-4']) expect((await store.get(id))?.id).toBe(id);
    expect(store.loadedShardCount).toBe(1);
    expect(await store.get('inconnu')).toBeNull();
    const many = await store.getMany(['cat-1', 'cat-4']);
    expect([...many.keys()].sort()).toEqual(['cat-1', 'cat-4']);
  });

  it('refuse un index corrompu', async () => {
    const chunks = catalogChunks(entries, 2);
    const idx = chunks.get(CATALOG_INDEX_KEY) as Record<string, unknown>;
    chunks.set(CATALOG_INDEX_KEY, { ...idx, name: ['une seule'] });
    const store = new CatalogStore(new ChunkLoader(new MemoryChunkSource(chunks)));
    await expect(store.ready()).rejects.toThrow(/colonne name/);
  });
});

describe('WorldRefStore', () => {
  const pt = (id: string, name: string, lat: number, lon: number, kind: RefPoint['kind'] = 'voyageur'): RefPoint => ({
    id,
    name,
    lat,
    lon,
    kind,
    country: 'DE',
    siteKind: 'station',
    uicRef: '',
    operator: '',
    official: false,
    cargoTags: [],
    source: 't',
  });
  const points = [
    pt('a', 'Koblenz Hbf', 50.35, 7.59),
    pt('b', 'Köln Hbf', 50.94, 6.96),
    pt('c', 'Paris Nord', 48.88, 2.35),
    pt('d', 'Paris La Chapelle fret', 48.89, 2.36, 'marchandise'),
    pt('e', 'Wellington', -41.28, 174.78),
  ];
  const chunks = new Map<string, unknown>();
  const tiles = new Map<string, RefPoint[]>();
  for (const p of points) {
    const k = `${Math.floor(p.lat / 2)}_${Math.floor(p.lon / 2)}`;
    tiles.set(k, [...(tiles.get(k) ?? []), p]);
  }
  const tileCounts: Record<string, number> = {};
  for (const [k, list] of tiles) {
    tileCounts[k] = list.length;
    chunks.set(worldTileKey(k), { schema: WORLD_TILE_SCHEMA, tile: k, rows: list.map(refRowFromPoint) });
  }
  chunks.set(WORLD_INDEX_KEY, {
    schema: WORLD_INDEX_SCHEMA,
    count: points.length,
    totals: { voyageur: 4, marchandise: 1, ite: 0 },
    countries: ['DE', 'FR', 'NZ'],
    tiles: tileCounts,
    generatedAt: '',
    source: 't',
  });
  chunks.set(WORLD_NAMES_KEY, {
    schema: WORLD_NAMES_SCHEMA,
    id: points.map((p) => p.id),
    name: points.map((p) => p.name),
    tile: points.map((p) => `${Math.floor(p.lat / 2)}_${Math.floor(p.lon / 2)}`),
    kind: points.map((p) => (p.kind === 'marchandise' ? 1 : 0)),
    country: points.map((p) => p.country),
  });
  const mk = (max = 6) => new WorldRefStore(new ChunkLoader(new MemoryChunkSource(chunks)), max);

  it('charge seulement les tuiles de la zone', async () => {
    const store = mk();
    const around = await store.inBounds(50, 6, 51.5, 8);
    expect(around.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(store.loadedTiles).toEqual(['25_3']);
    expect(await store.tile('99_99')).toEqual([]);
  });

  it('LRU avec épinglage', async () => {
    const store = mk(1);
    store.pin('24_1');
    await store.tile('24_1');
    await store.tile('25_3');
    await store.tile('-21_87');
    expect([...store.loadedTiles].sort()).toEqual(['-21_87', '24_1']);
    store.unpin('24_1');
    await store.tile('25_3');
    expect(store.loadedTiles).toHaveLength(1);
  });

  it('chargements concurrents d\'une tuile : une seule entrée LRU', async () => {
    const store = mk(2);
    await Promise.all([store.tile('25_3'), store.tile('25_3'), store.tile('25_3')]);
    await store.tile('24_1');
    expect([...store.loadedTiles].sort()).toEqual(['24_1', '25_3']);
  });

  it('recherche par nom (accents, type)', async () => {
    const store = mk();
    expect((await store.searchNames('koln')).map((h) => h.id)).toEqual(['b']);
    expect((await store.searchNames('paris')).map((h) => h.id)).toEqual(['c', 'd']);
    expect((await store.searchNames('paris', 10, 'marchandise')).map((h) => h.id)).toEqual(['d']);
    expect(await store.searchNames('   ')).toEqual([]);
    store.releaseNames();
    expect((await store.searchNames('Wellington'))[0]?.tile).toBe('-21_87');
  });
});
