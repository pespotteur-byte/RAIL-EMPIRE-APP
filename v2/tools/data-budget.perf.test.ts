/**
 * Budget mémoire/latence des données générées (apps/game/public/data).
 * Échoue si un chunk ou le coût de chargement dépasse la cible « 3 Go de RAM ».
 * Lancer `npm run data:build` avant. Exécuter avec `node --expose-gc`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogStore, ChunkLoader, WorldRefStore } from '@re/data';
import { FileChunkSource } from './file-chunk-source.ts';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/game/public/data');
const MB = 1024 * 1024;

const BUDGET = {
  maxChunkBytes: 8 * MB,
  catalogIndexHeapMb: 60,
  worldTileHeapMb: 6,
  namesHeapMb: 60,
  catalogIndexLoadMs: 1500,
  tileLoadMs: 200,
  searchMs: 150,
};

function gc(): void {
  const g = (globalThis as { gc?: () => void }).gc;
  if (g) g();
}

function heapMb(): number {
  gc();
  return process.memoryUsage().heapUsed / MB;
}

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.join(d.parentPath, d.name));
}

describe.skipIf(!fs.existsSync(DATA))('budget données V2', () => {
  const loader = new ChunkLoader(new FileChunkSource(DATA));

  it(`aucun chunk > ${BUDGET.maxChunkBytes / MB} Mo`, () => {
    const files = listFiles(DATA);
    expect(files.length).toBeGreaterThan(100);
    const big = files.map((f) => [f, fs.statSync(f).size] as const).filter(([, s]) => s > BUDGET.maxChunkBytes);
    expect(big, big.map(([f, s]) => `${path.relative(DATA, f)} ${(s / MB).toFixed(1)} Mo`).join(', ')).toEqual([]);
  });

  it('index catalogue : chargement et heap sous budget, recherche rapide', async () => {
    const store = new CatalogStore(loader);
    const h0 = heapMb();
    const t0 = performance.now();
    await store.ready();
    const dt = performance.now() - t0;
    const dh = heapMb() - h0;
    console.log(`catalog/index : ${store.count} fiches, ${dt.toFixed(0)} ms, +${dh.toFixed(1)} Mo`);
    expect(store.count).toBeGreaterThan(30_000);
    expect(dt).toBeLessThan(BUDGET.catalogIndexLoadMs);
    expect(dh).toBeLessThan(BUDGET.catalogIndexHeapMb);

    const t1 = performance.now();
    const hits = store.filter({ text: 'bb 22200', category: 'locomotive' });
    const first = performance.now() - t1;
    const t2 = performance.now();
    store.filter({ text: 'corail', traction: 'none' });
    const second = performance.now() - t2;
    console.log(`recherche : ${hits.length} résultats, 1re ${first.toFixed(0)} ms (indexation), 2e ${second.toFixed(0)} ms`);
    expect(hits.length).toBeGreaterThan(0);
    expect(second).toBeLessThan(BUDGET.searchMs);

    const id = store.row(hits[0] ?? 0)?.id ?? '';
    const e = await store.get(id);
    expect(e?.id).toBe(id);
    expect(store.loadedShardCount).toBe(1);
  });

  it('référentiel : une tuile Île-de-France + Koblenz, heap et latence', async () => {
    const store = new WorldRefStore(loader);
    const idx = await store.ready();
    expect(idx.count).toBeGreaterThan(100_000);
    const h0 = heapMb();
    const t0 = performance.now();
    const idf = await store.inBounds(48.1, 1.4, 49.3, 3.6);
    const dt = performance.now() - t0;
    const dh = heapMb() - h0;
    console.log(`IDF : ${idf.length} points, ${store.loadedTiles.length} tuiles, ${dt.toFixed(0)} ms, +${dh.toFixed(1)} Mo`);
    expect(idf.length).toBeGreaterThan(500);
    expect(dt / store.loadedTiles.length).toBeLessThan(BUDGET.tileLoadMs);
    expect(dh / store.loadedTiles.length).toBeLessThan(BUDGET.worldTileHeapMb);

    const koblenz = (await store.inBounds(50.3, 7.5, 50.4, 7.7)).find((p) => p.name === 'Koblenz Hbf');
    expect(koblenz?.kind).toBe('voyageur');

    const h1 = heapMb();
    const t1 = performance.now();
    const hits = await store.searchNames('koblenz');
    const st = performance.now() - t1;
    const sh = heapMb() - h1;
    console.log(`world/names : ${hits.length} résultats pour « koblenz », ${st.toFixed(0)} ms, +${sh.toFixed(1)} Mo`);
    expect(hits.some((h) => h.name === 'Koblenz Hbf')).toBe(true);
    expect(sh).toBeLessThan(BUDGET.namesHeapMb);
  });
});
