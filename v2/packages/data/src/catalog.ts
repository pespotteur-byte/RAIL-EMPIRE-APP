/**
 * Catalogue matériel V2.
 *
 * Deux niveaux :
 *  - `catalog/index` : colonnes compactes pour lister/filtrer/rechercher les
 *    36 k fiches sans charger les détails (≈ 2 Mo, chargé une fois).
 *  - `catalog/shard-NNN` : fiches complètes, réparties par hachage de l'id,
 *    chargées uniquement quand une fiche est ouverte ou qu'une rame l'utilise.
 */

export const CATALOG_INDEX_SCHEMA = 're-catalog-index-v2';
export const CATALOG_SHARD_SCHEMA = 're-catalog-shard-v2';
export const CATALOG_SHARD_COUNT = 128;

export type CatalogCategory = 'locomotive' | 'automotrice' | 'voiture' | 'wagon';
export type Traction = 'none' | 'electrique' | 'diesel' | 'vapeur' | 'bi';

export const CATALOG_CATEGORIES: readonly CatalogCategory[] = ['locomotive', 'automotrice', 'voiture', 'wagon'];
export const TRACTIONS: readonly Traction[] = ['none', 'electrique', 'diesel', 'vapeur', 'bi'];

export interface CatalogEntry {
  id: string;
  name: string;
  seriesName: string;
  category: CatalogCategory;
  traction: Traction;
  /** km/h */
  maxSpeed: number;
  /** kW */
  power: number;
  /** t (tare) */
  mass: number;
  /** m */
  length: number;
  /** t (charge utile max) */
  tonnage: number;
  passengerCapacity: number;
  freightCapacity: number;
  purchasePrice: number;
  cargoTypes: string[];
  technicallyCompatibleCargoTypes: string[];
  /** Chemin relatif de l'image (img/catalog/...), vide si aucune. */
  image: string;
  source: string;
  country: string;
  operator: string;
  wagonSubCategory: string;
  numberStart: string;
  isDrivingTrailer: boolean;
  isComposite: boolean;
  realIdentityId: string;
  realIdentitySeries: string;
}

export interface CatalogIndex {
  schema: typeof CATALOG_INDEX_SCHEMA;
  count: number;
  shardCount: number;
  dict: {
    country: string[];
    operator: string[];
  };
  /** Colonnes parallèles, longueur = count. */
  id: string[];
  name: string[];
  seriesName: string[];
  /** Index dans CATALOG_CATEGORIES */
  category: number[];
  /** Index dans TRACTIONS */
  traction: number[];
  country: number[];
  operator: number[];
  maxSpeed: number[];
  length: number[];
  purchasePrice: number[];
  passengerCapacity: number[];
  hasImage: number[];
}

export interface CatalogShard {
  schema: typeof CATALOG_SHARD_SCHEMA;
  shard: number;
  entries: CatalogEntry[];
}

/** FNV-1a 32 bits : stable, rapide, identique côté build et runtime. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function catalogShardOf(id: string, shardCount = CATALOG_SHARD_COUNT): number {
  return fnv1a(id) % shardCount;
}

export function catalogShardKey(shard: number): string {
  return `catalog/shard-${String(shard).padStart(3, '0')}`;
}

export const CATALOG_INDEX_KEY = 'catalog/index';

export function isCatalogCategory(v: unknown): v is CatalogCategory {
  return typeof v === 'string' && (CATALOG_CATEGORIES as readonly string[]).includes(v);
}

export function isTraction(v: unknown): v is Traction {
  return typeof v === 'string' && (TRACTIONS as readonly string[]).includes(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function rec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Validation structurelle bon marché (pas de zod sur 36 k lignes à chaud). */
export function parseCatalogIndex(payload: unknown): CatalogIndex {
  const r = rec(payload);
  if (r?.schema !== CATALOG_INDEX_SCHEMA) throw new Error('catalog/index : schéma inattendu');
  const count = r.count;
  if (typeof count !== 'number') throw new Error('catalog/index : count manquant');
  const dict = rec(r.dict);
  if (!dict || !isStringArray(dict.country) || !isStringArray(dict.operator)) throw new Error('catalog/index : dict');
  const str = (k: string): string[] => {
    const c = r[k];
    if (!isStringArray(c) || c.length !== count) throw new Error(`catalog/index : colonne ${k}`);
    return c;
  };
  const num = (k: string): number[] => {
    const c = r[k];
    if (!isNumberArray(c) || c.length !== count) throw new Error(`catalog/index : colonne ${k}`);
    return c;
  };
  return {
    schema: CATALOG_INDEX_SCHEMA,
    count,
    shardCount: typeof r.shardCount === 'number' ? r.shardCount : CATALOG_SHARD_COUNT,
    dict: { country: dict.country, operator: dict.operator },
    id: str('id'),
    name: str('name'),
    seriesName: str('seriesName'),
    category: num('category'),
    traction: num('traction'),
    country: num('country'),
    operator: num('operator'),
    maxSpeed: num('maxSpeed'),
    length: num('length'),
    purchasePrice: num('purchasePrice'),
    passengerCapacity: num('passengerCapacity'),
    hasImage: num('hasImage'),
  };
}

export function parseCatalogEntry(v: unknown): CatalogEntry {
  const r = rec(v);
  if (!r || typeof r.id !== 'string') throw new Error('fiche catalogue : id manquant');
  const s = (k: string): string => (typeof r[k] === 'string' ? (r[k]) : '');
  const n = (k: string): number => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k]) : 0);
  const b = (k: string): boolean => r[k] === true;
  const sa = (k: string): string[] => (isStringArray(r[k]) ? (r[k]) : []);
  const category = r.category;
  const traction = r.traction;
  if (!isCatalogCategory(category)) throw new Error(`fiche ${r.id} : catégorie ${String(category)}`);
  if (!isTraction(traction)) throw new Error(`fiche ${r.id} : traction ${String(traction)}`);
  return {
    id: r.id,
    name: s('name'),
    seriesName: s('seriesName'),
    category,
    traction,
    maxSpeed: n('maxSpeed'),
    power: n('power'),
    mass: n('mass'),
    length: n('length'),
    tonnage: n('tonnage'),
    passengerCapacity: n('passengerCapacity'),
    freightCapacity: n('freightCapacity'),
    purchasePrice: n('purchasePrice'),
    cargoTypes: sa('cargoTypes'),
    technicallyCompatibleCargoTypes: sa('technicallyCompatibleCargoTypes'),
    image: s('image'),
    source: s('source'),
    country: s('country'),
    operator: s('operator'),
    wagonSubCategory: s('wagonSubCategory'),
    numberStart: s('numberStart'),
    isDrivingTrailer: b('isDrivingTrailer'),
    isComposite: b('isComposite'),
    realIdentityId: s('realIdentityId'),
    realIdentitySeries: s('realIdentitySeries'),
  };
}

export function parseCatalogShard(payload: unknown): CatalogShard {
  const r = rec(payload);
  if (r?.schema !== CATALOG_SHARD_SCHEMA) throw new Error('catalog/shard : schéma inattendu');
  if (typeof r.shard !== 'number' || !Array.isArray(r.entries)) throw new Error('catalog/shard : structure');
  return { schema: CATALOG_SHARD_SCHEMA, shard: r.shard, entries: r.entries.map(parseCatalogEntry) };
}
