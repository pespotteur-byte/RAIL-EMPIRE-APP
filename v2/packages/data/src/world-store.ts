import type { ChunkLoader } from './chunks.ts';
import { tileKey, tilesInBounds } from './geo.ts';
import { normalizeText } from './text.ts';
import {
  REF_POINT_KINDS,
  WORLD_INDEX_KEY,
  WORLD_NAMES_KEY,
  parseWorldIndex,
  parseWorldNames,
  parseWorldTile,
  refPointFromRow,
  worldTileKey,
  type RefPoint,
  type RefPointKind,
  type WorldIndex,
  type WorldNames,
} from './world-ref.ts';

export interface NameHit {
  id: string;
  name: string;
  tile: string;
  kind: RefPointKind;
  country: string;
}

/**
 * Tuiles du référentiel en mémoire, à la demande. `pin()` garde les tuiles de
 * la zone de jeu ; les autres sortent par LRU.
 */
export class WorldRefStore {
  private index: WorldIndex | null = null;
  private names: WorldNames | null = null;
  private nameKeys: string[] | null = null;
  private readonly tiles = new Map<string, RefPoint[]>();
  private readonly order: string[] = [];
  private readonly pinned = new Set<string>();
  private readonly loader: ChunkLoader;
  private readonly maxUnpinnedTiles: number;

  constructor(loader: ChunkLoader, maxUnpinnedTiles = 6) {
    this.loader = loader;
    this.maxUnpinnedTiles = maxUnpinnedTiles;
  }

  async ready(): Promise<WorldIndex> {
    if (this.index) return this.index;
    this.index = parseWorldIndex(await this.loader.load(WORLD_INDEX_KEY));
    return this.index;
  }

  hasTile(tile: string): boolean {
    return (this.index?.tiles[tile] ?? 0) > 0;
  }

  async tile(tile: string): Promise<readonly RefPoint[]> {
    const idx = await this.ready();
    const cached = this.tiles.get(tile);
    if (cached) {
      this.touch(tile);
      return cached;
    }
    if (!(tile in idx.tiles)) return [];
    const t = parseWorldTile(await this.loader.load(worldTileKey(tile)));
    const already = this.tiles.get(tile);
    if (already) {
      this.touch(tile);
      return already;
    }
    const pts: RefPoint[] = [];
    for (const row of t.rows) {
      const p = refPointFromRow(row);
      if (p) pts.push(p);
    }
    this.tiles.set(tile, pts);
    this.order.push(tile);
    this.evict();
    return pts;
  }

  async inBounds(s: number, w: number, n: number, e: number): Promise<RefPoint[]> {
    const idx = await this.ready();
    const out: RefPoint[] = [];
    for (const t of tilesInBounds(s, w, n, e)) {
      const k = tileKey(t);
      if (!(k in idx.tiles)) continue;
      for (const p of await this.tile(k)) {
        if (p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e) out.push(p);
      }
    }
    return out;
  }

  pin(tile: string): void {
    this.pinned.add(tile);
  }

  unpin(tile: string): void {
    this.pinned.delete(tile);
    this.evict();
  }

  get loadedTiles(): readonly string[] {
    return [...this.tiles.keys()];
  }

  async searchNames(query: string, limit = 50, kind?: RefPointKind): Promise<NameHit[]> {
    const terms = normalizeText(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const names = await this.loadNames();
    const keys = this.nameKeys ?? this.buildNameKeys(names);
    const kindIdx = kind ? REF_POINT_KINDS.indexOf(kind) : -1;
    const out: NameHit[] = [];
    for (let i = 0; i < names.id.length && out.length < limit; i++) {
      if (kindIdx >= 0 && names.kind[i] !== kindIdx) continue;
      const k = keys[i] ?? '';
      let ok = true;
      for (const t of terms) {
        if (!k.includes(t)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      out.push({
        id: names.id[i] ?? '',
        name: names.name[i] ?? '',
        tile: names.tile[i] ?? '',
        kind: REF_POINT_KINDS[names.kind[i] ?? 0] ?? 'voyageur',
        country: names.country[i] ?? '',
      });
    }
    return out;
  }

  /** Libère l'index de noms (gros, rarement utile hors recherche). */
  releaseNames(): void {
    this.names = null;
    this.nameKeys = null;
  }

  private async loadNames(): Promise<WorldNames> {
    if (this.names) return this.names;
    this.names = parseWorldNames(await this.loader.load(WORLD_NAMES_KEY));
    return this.names;
  }

  private buildNameKeys(names: WorldNames): string[] {
    const keys = new Array<string>(names.id.length);
    for (let i = 0; i < names.id.length; i++) keys[i] = normalizeText(names.name[i] ?? '');
    this.nameKeys = keys;
    return keys;
  }

  private touch(tile: string): void {
    const i = this.order.indexOf(tile);
    if (i >= 0) {
      this.order.splice(i, 1);
      this.order.push(tile);
    }
  }

  private evict(): void {
    let unpinned = this.order.filter((t) => !this.pinned.has(t));
    while (unpinned.length > this.maxUnpinnedTiles) {
      const victim = unpinned[0];
      if (victim === undefined) break;
      this.tiles.delete(victim);
      this.order.splice(this.order.indexOf(victim), 1);
      unpinned = unpinned.slice(1);
    }
  }
}
