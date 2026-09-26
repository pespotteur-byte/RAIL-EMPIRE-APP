/**
 * Référentiel ferroviaire (gares voyageurs, sites fret, ITE) tuilé.
 *
 *  - `world/index`      : liste des tuiles avec leur nombre de points, totaux.
 *  - `world/tile-{ty}_{tx}` : points d'une tuile de 2°×2°, lignes compactes.
 *  - `world/names`      : index de recherche par nom (id, nom, tuile, type).
 *
 * Le jeu ne charge que les tuiles de la zone jouée (+ marge) : une partie en
 * Île-de-France tient dans 2 à 4 tuiles au lieu de 82 000 points en mémoire.
 */

export const WORLD_INDEX_SCHEMA = 're-world-index-v2';
export const WORLD_TILE_SCHEMA = 're-world-tile-v2';
export const WORLD_NAMES_SCHEMA = 're-world-names-v2';

export const WORLD_INDEX_KEY = 'world/index';
export const WORLD_NAMES_KEY = 'world/names';

export function worldTileKey(tile: string): string {
  return `world/tile-${tile}`;
}

export type RefPointKind = 'voyageur' | 'marchandise' | 'ite';
export const REF_POINT_KINDS: readonly RefPointKind[] = ['voyageur', 'marchandise', 'ite'];

export interface RefPoint {
  id: string;
  name: string;
  /** degrés */
  lat: number;
  lon: number;
  kind: RefPointKind;
  country: string;
  /** station, halt, yard, container_terminal, ite… */
  siteKind: string;
  uicRef: string;
  operator: string;
  official: boolean;
  cargoTags: string[];
  source: string;
}

/**
 * Ligne compacte : [id, name, latMicro, lonMicro, kind, country, siteKind, uicRef, operator, official, cargoTags, source]
 */
export type RefRow = [string, string, number, number, number, string, string, string, string, number, string, string];

export interface WorldIndex {
  schema: typeof WORLD_INDEX_SCHEMA;
  count: number;
  totals: Record<RefPointKind, number>;
  countries: string[];
  /** clé de tuile → nombre de points */
  tiles: Record<string, number>;
  generatedAt: string;
  source: string;
}

export interface WorldTile {
  schema: typeof WORLD_TILE_SCHEMA;
  tile: string;
  rows: RefRow[];
}

export interface WorldNames {
  schema: typeof WORLD_NAMES_SCHEMA;
  id: string[];
  name: string[];
  tile: string[];
  kind: number[];
  country: string[];
}

export function refRowFromPoint(p: RefPoint): RefRow {
  return [
    p.id,
    p.name,
    Math.round(p.lat * 1e5),
    Math.round(p.lon * 1e5),
    REF_POINT_KINDS.indexOf(p.kind),
    p.country,
    p.siteKind,
    p.uicRef,
    p.operator,
    p.official ? 1 : 0,
    p.cargoTags.join(';'),
    p.source,
  ];
}

export function refPointFromRow(row: unknown): RefPoint | null {
  if (!Array.isArray(row) || row.length < 12) return null;
  const s = (i: number): string => (typeof row[i] === 'string' ? (row[i]) : '');
  const n = (i: number): number => (typeof row[i] === 'number' ? (row[i]) : Number.NaN);
  const lat = n(2) / 1e5;
  const lon = n(3) / 1e5;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const kind = REF_POINT_KINDS[n(4)] ?? 'voyageur';
  const tags = s(10);
  return {
    id: s(0),
    name: s(1),
    lat,
    lon,
    kind,
    country: s(5),
    siteKind: s(6),
    uicRef: s(7),
    operator: s(8),
    official: n(9) === 1,
    cargoTags: tags ? tags.split(';').filter(Boolean) : [],
    source: s(11),
  };
}

function rec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseWorldIndex(payload: unknown): WorldIndex {
  const r = rec(payload);
  if (r?.schema !== WORLD_INDEX_SCHEMA) throw new Error('world/index : schéma inattendu');
  const tiles = rec(r.tiles);
  const totals = rec(r.totals);
  if (!tiles || !totals || typeof r.count !== 'number') throw new Error('world/index : structure');
  const t: Record<string, number> = {};
  for (const [k, v] of Object.entries(tiles)) if (typeof v === 'number') t[k] = v;
  const num = (k: string): number => (typeof totals[k] === 'number' ? (totals[k]) : 0);
  return {
    schema: WORLD_INDEX_SCHEMA,
    count: r.count,
    totals: { voyageur: num('voyageur'), marchandise: num('marchandise'), ite: num('ite') },
    countries: Array.isArray(r.countries) ? r.countries.filter((c): c is string => typeof c === 'string') : [],
    tiles: t,
    generatedAt: typeof r.generatedAt === 'string' ? r.generatedAt : '',
    source: typeof r.source === 'string' ? r.source : '',
  };
}

export function parseWorldTile(payload: unknown): WorldTile {
  const r = rec(payload);
  if (r?.schema !== WORLD_TILE_SCHEMA) throw new Error('world/tile : schéma inattendu');
  if (typeof r.tile !== 'string' || !Array.isArray(r.rows)) throw new Error('world/tile : structure');
  return { schema: WORLD_TILE_SCHEMA, tile: r.tile, rows: r.rows as RefRow[] };
}

export function parseWorldNames(payload: unknown): WorldNames {
  const r = rec(payload);
  if (r?.schema !== WORLD_NAMES_SCHEMA) throw new Error('world/names : schéma inattendu');
  const cols = ['id', 'name', 'tile', 'country'] as const;
  for (const c of cols) if (!Array.isArray(r[c])) throw new Error(`world/names : colonne ${c}`);
  if (!Array.isArray(r.kind)) throw new Error('world/names : colonne kind');
  return {
    schema: WORLD_NAMES_SCHEMA,
    id: r.id as string[],
    name: r.name as string[],
    tile: r.tile as string[],
    kind: r.kind as number[],
    country: r.country as string[],
  };
}
