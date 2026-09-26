/**
 * Transport de données « chunk » : un fichier JS autonome qui livre son
 * contenu via `globalThis.__RE_CHUNK__(key, payload)`.
 *
 * Pourquoi pas fetch()/import() ? Le jeu se lance en `file://` : Chrome y
 * bloque fetch, les modules ES et les Workers par URL. Une balise <script>
 * classique fonctionne partout, y compris hors ligne, et laisse le navigateur
 * gérer le cache. Le même format se lit côté Node (outils, tests, perf).
 */

export const CHUNK_GLOBAL = '__RE_CHUNK__';

export type ChunkKey = string;

export interface ChunkSource {
  /** Charge et renvoie le payload brut d'un chunk (une seule fois par clé). */
  load(key: ChunkKey): Promise<unknown>;
}

export interface ChunkDeliveryTarget {
  [CHUNK_GLOBAL]?: (key: ChunkKey, payload: unknown) => void;
}

/** Sérialise un payload en fichier chunk JS. Utilisé par les outils de build. */
export function encodeChunk(key: ChunkKey, payload: unknown): string {
  const json = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script').replace(/\u2028|\u2029/g, (c) =>
    c === '\u2028' ? '\\u2028' : '\\u2029',
  );
  return `globalThis.${CHUNK_GLOBAL}(${JSON.stringify(key)},${json});\n`;
}

/** Extrait (key, payload) d'un texte de chunk sans exécuter de code. */
export function decodeChunk(text: string): { key: ChunkKey; payload: unknown } {
  const prefix = `globalThis.${CHUNK_GLOBAL}(`;
  if (!text.startsWith(prefix) || !text.trimEnd().endsWith(');')) {
    throw new Error('chunk invalide : préfixe/suffixe inattendu');
  }
  const body = text.slice(prefix.length, text.trimEnd().length - 2);
  const parsed: unknown = JSON.parse(`[${body}]`);
  if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string') {
    throw new Error('chunk invalide : attendu [key, payload]');
  }
  return { key: parsed[0], payload: parsed[1] };
}

/** Chemin relatif d'un chunk dans le dossier data. */
export function chunkPath(key: ChunkKey): string {
  return `${key.replace(/[^a-zA-Z0-9_./-]/g, '_')}.js`;
}

/**
 * Cache + déduplication des chargements. Les payloads ne sont pas conservés :
 * c'est au consommateur (catalogue, monde) de garder ce qui lui sert, sous une
 * forme compacte. Cela évite de garder deux copies (JSON brut + structures).
 */
export class ChunkLoader {
  private readonly inflight = new Map<ChunkKey, Promise<unknown>>();
  private readonly source: ChunkSource;

  constructor(source: ChunkSource) {
    this.source = source;
  }

  load(key: ChunkKey): Promise<unknown> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = this.source.load(key).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }
}

/** Source mémoire (tests). */
export class MemoryChunkSource implements ChunkSource {
  private readonly chunks: ReadonlyMap<ChunkKey, unknown>;

  constructor(chunks: ReadonlyMap<ChunkKey, unknown>) {
    this.chunks = chunks;
  }

  load(key: ChunkKey): Promise<unknown> {
    const v = this.chunks.get(key);
    return v === undefined ? Promise.reject(new Error(`chunk absent : ${key}`)) : Promise.resolve(v);
  }
}
