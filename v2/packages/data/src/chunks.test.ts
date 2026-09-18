import { describe, expect, it } from 'vitest';
import { ChunkLoader, MemoryChunkSource, chunkPath, decodeChunk, encodeChunk } from './chunks.ts';
import { tileKey, tileOf, tilesInBounds, haversineM } from './geo.ts';
import { catalogShardOf, fnv1a } from './catalog.ts';
import { normalizeText } from './text.ts';
import { refPointFromRow, refRowFromPoint, type RefPoint } from './world-ref.ts';

describe('chunks', () => {
  it('encode/decode aller-retour, y compris </script> et U+2028', () => {
    const payload = { a: 1, s: 'x</script>y\u2028z', arr: [1, 'é', null] };
    const text = encodeChunk('world/tile-1_2', payload);
    expect(text).not.toContain('</script>');
    expect(decodeChunk(text)).toEqual({ key: 'world/tile-1_2', payload });
  });

  it('chunkPath nettoie les clés', () => {
    expect(chunkPath('world/tile--3_12')).toBe('world/tile--3_12.js');
    expect(chunkPath('a b?c')).toBe('a_b_c.js');
  });

  it('ChunkLoader déduplique les chargements concurrents', async () => {
    let calls = 0;
    const loader = new ChunkLoader({
      load: (k) => {
        calls++;
        return new Promise((r) => setTimeout(() => { r(`payload:${k}`); }, 5));
      },
    });
    const [a, b] = await Promise.all([loader.load('x'), loader.load('x')]);
    expect(a).toBe('payload:x');
    expect(b).toBe('payload:x');
    expect(calls).toBe(1);
  });

  it('MemoryChunkSource rejette les clés absentes', async () => {
    const src = new MemoryChunkSource(new Map([['k', 1]]));
    await expect(src.load('k')).resolves.toBe(1);
    await expect(src.load('nope')).rejects.toThrow(/absent/);
  });
});

describe('geo', () => {
  it('tuiles 2° et clés', () => {
    expect(tileOf(48.85, 2.35)).toEqual({ ty: 24, tx: 1 });
    expect(tileOf(-41.3, 174.8)).toEqual({ ty: -21, tx: 87 });
    expect(tileKey(tileOf(50.36, 7.59))).toBe('25_3');
    expect(tilesInBounds(48, 2, 51.9, 7.9)).toHaveLength(2 * 3);
  });

  it('haversine Paris–Lyon ≈ 392 km', () => {
    expect(haversineM(48.8566, 2.3522, 45.764, 4.8357) / 1000).toBeCloseTo(392, -1);
  });
});

describe('catalog hashing', () => {
  it('fnv1a stable et shards bornés', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('cat-101')).toBe(fnv1a('cat-101'));
    for (const id of ['cat-1', 'cat-36307', 'pack-re-1', 'x']) {
      const s = catalogShardOf(id);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(128);
    }
  });
});

describe('text', () => {
  it('normalise accents/casse/ponctuation', () => {
    expect(normalizeText('Koblenz Hbf')).toBe('koblenz hbf');
    expect(normalizeText('Águilas-El Labradorico')).toBe('aguilas el labradorico');
    expect(normalizeText('  Gare  de   Lyon-Part-Dieu ')).toBe('de lyon part dieu');
    expect(normalizeText('Paris St-Lazare')).toBe(normalizeText('Paris Saint-Lazare'));
    expect(normalizeText('Köln Hauptbahnhof')).toBe('koln hbf');
    expect(normalizeText('Gießen')).toBe('giessen');
    expect(normalizeText('Gare')).toBe('gare');
  });
});

describe('world-ref rows', () => {
  it('aller-retour point → ligne → point', () => {
    const p: RefPoint = {
      id: 'osm-node-1',
      name: 'Koblenz Hbf',
      lat: 50.35084,
      lon: 7.58891,
      kind: 'voyageur',
      country: 'DE',
      siteKind: 'station',
      uicRef: '8000206',
      operator: 'DB',
      official: false,
      cargoTags: [],
      source: 'OpenStreetMap / Overpass',
    };
    expect(refPointFromRow(refRowFromPoint(p))).toEqual(p);
    const ite: RefPoint = { ...p, id: 'ite-1', kind: 'ite', official: true, cargoTags: ['steel', 'coal'] };
    expect(refPointFromRow(refRowFromPoint(ite))).toEqual(ite);
    expect(refPointFromRow(['bad'])).toBeNull();
  });
});
