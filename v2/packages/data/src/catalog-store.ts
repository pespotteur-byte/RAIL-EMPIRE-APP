import type { ChunkLoader } from './chunks.ts';
import {
  CATALOG_CATEGORIES,
  CATALOG_INDEX_KEY,
  TRACTIONS,
  catalogShardKey,
  catalogShardOf,
  parseCatalogIndex,
  parseCatalogShard,
  type CatalogCategory,
  type CatalogEntry,
  type CatalogIndex,
  type Traction,
} from './catalog.ts';
import { normalizeText } from './text.ts';

export interface CatalogFilter {
  text?: string;
  category?: CatalogCategory;
  traction?: Traction;
  country?: string;
  operator?: string;
  withImage?: boolean;
}

export interface CatalogRow {
  index: number;
  id: string;
  name: string;
  seriesName: string;
  category: CatalogCategory;
  traction: Traction;
  country: string;
  operator: string;
  maxSpeed: number;
  length: number;
  purchasePrice: number;
  passengerCapacity: number;
  hasImage: boolean;
}

/**
 * Accès au catalogue : l'index colonne reste en mémoire (petit), les fiches
 * complètes transitent par un cache LRU de shards. Une partie n'utilise
 * typiquement que quelques dizaines de séries → une poignée de shards.
 */
export class CatalogStore {
  private index: CatalogIndex | null = null;
  private searchKeys: string[] | null = null;
  private readonly idToRow = new Map<string, number>();
  private readonly shards = new Map<number, Map<string, CatalogEntry>>();
  private readonly shardOrder: number[] = [];
  private readonly loader: ChunkLoader;
  private readonly maxShards: number;

  constructor(loader: ChunkLoader, maxShards = 8) {
    this.loader = loader;
    this.maxShards = maxShards;
  }

  async ready(): Promise<CatalogIndex> {
    if (this.index) return this.index;
    const idx = parseCatalogIndex(await this.loader.load(CATALOG_INDEX_KEY));
    for (let i = 0; i < idx.count; i++) this.idToRow.set(idx.id[i] ?? '', i);
    this.index = idx;
    return idx;
  }

  get count(): number {
    return this.index?.count ?? 0;
  }

  get countries(): readonly string[] {
    return this.index?.dict.country ?? [];
  }

  get operators(): readonly string[] {
    return this.index?.dict.operator ?? [];
  }

  row(i: number): CatalogRow | null {
    const x = this.index;
    if (!x || i < 0 || i >= x.count) return null;
    return {
      index: i,
      id: x.id[i] ?? '',
      name: x.name[i] ?? '',
      seriesName: x.seriesName[i] ?? '',
      category: CATALOG_CATEGORIES[x.category[i] ?? 0] ?? 'wagon',
      traction: TRACTIONS[x.traction[i] ?? 0] ?? 'none',
      country: x.dict.country[x.country[i] ?? 0] ?? '',
      operator: x.dict.operator[x.operator[i] ?? 0] ?? '',
      maxSpeed: x.maxSpeed[i] ?? 0,
      length: x.length[i] ?? 0,
      purchasePrice: x.purchasePrice[i] ?? 0,
      passengerCapacity: x.passengerCapacity[i] ?? 0,
      hasImage: (x.hasImage[i] ?? 0) === 1,
    };
  }

  rowById(id: string): CatalogRow | null {
    const i = this.idToRow.get(id);
    return i === undefined ? null : this.row(i);
  }

  /** Renvoie les indices de lignes correspondant au filtre (ordre du catalogue). */
  filter(f: CatalogFilter, limit = Number.POSITIVE_INFINITY): number[] {
    const x = this.index;
    if (!x) return [];
    const cat = f.category ? CATALOG_CATEGORIES.indexOf(f.category) : -1;
    const trac = f.traction ? TRACTIONS.indexOf(f.traction) : -1;
    const country = f.country ? x.dict.country.indexOf(f.country) : -1;
    const operator = f.operator ? x.dict.operator.indexOf(f.operator) : -1;
    if ((f.category && cat < 0) || (f.traction && trac < 0) || (f.country && country < 0) || (f.operator && operator < 0)) return [];
    const terms = f.text ? normalizeText(f.text).split(' ').filter(Boolean) : [];
    const keys = terms.length ? this.buildSearchKeys(x) : null;
    const out: number[] = [];
    for (let i = 0; i < x.count && out.length < limit; i++) {
      if (cat >= 0 && x.category[i] !== cat) continue;
      if (trac >= 0 && x.traction[i] !== trac) continue;
      if (country >= 0 && x.country[i] !== country) continue;
      if (operator >= 0 && x.operator[i] !== operator) continue;
      if (f.withImage !== undefined && ((x.hasImage[i] ?? 0) === 1) !== f.withImage) continue;
      if (keys) {
        const k = keys[i] ?? '';
        let ok = true;
        for (const t of terms) {
          if (!k.includes(t)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      out.push(i);
    }
    return out;
  }

  private buildSearchKeys(x: CatalogIndex): string[] {
    if (this.searchKeys) return this.searchKeys;
    const keys = new Array<string>(x.count);
    for (let i = 0; i < x.count; i++) {
      keys[i] = normalizeText(`${x.id[i] ?? ''} ${x.name[i] ?? ''} ${x.seriesName[i] ?? ''}`);
    }
    this.searchKeys = keys;
    return keys;
  }

  async get(id: string): Promise<CatalogEntry | null> {
    const x = await this.ready();
    const shard = catalogShardOf(id, x.shardCount);
    let map = this.shards.get(shard);
    if (!map) {
      const s = parseCatalogShard(await this.loader.load(catalogShardKey(shard)));
      const already = this.shards.get(shard);
      if (already) {
        map = already;
        this.touch(shard);
      } else {
        map = new Map(s.entries.map((e) => [e.id, e]));
        this.remember(shard, map);
      }
    } else {
      this.touch(shard);
    }
    return map.get(id) ?? null;
  }

  async getMany(ids: readonly string[]): Promise<Map<string, CatalogEntry>> {
    const out = new Map<string, CatalogEntry>();
    const byShard = new Map<number, string[]>();
    const x = await this.ready();
    for (const id of ids) {
      const s = catalogShardOf(id, x.shardCount);
      const list = byShard.get(s);
      if (list) list.push(id);
      else byShard.set(s, [id]);
    }
    for (const list of byShard.values()) {
      for (const id of list) {
        const e = await this.get(id);
        if (e) out.set(id, e);
      }
    }
    return out;
  }

  get loadedShardCount(): number {
    return this.shards.size;
  }

  private remember(shard: number, map: Map<string, CatalogEntry>): void {
    this.shards.set(shard, map);
    this.shardOrder.push(shard);
    while (this.shardOrder.length > this.maxShards) {
      const evict = this.shardOrder.shift();
      if (evict !== undefined) this.shards.delete(evict);
    }
  }

  private touch(shard: number): void {
    const i = this.shardOrder.indexOf(shard);
    if (i >= 0) {
      this.shardOrder.splice(i, 1);
      this.shardOrder.push(shard);
    }
  }
}
