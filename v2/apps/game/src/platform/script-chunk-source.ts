import { CHUNK_GLOBAL, chunkPath, type ChunkKey, type ChunkSource } from '@re/data';

type ChunkCallback = (key: string, payload: unknown) => void;

/**
 * Source de chunks navigateur compatible `file://` : injection d'une balise
 * <script> classique ; le chunk appelle `globalThis.__RE_CHUNK__(key, payload)`.
 * Aucun fetch/XHR (bloqués en file://), aucun module ES (idem).
 */
export class ScriptChunkSource implements ChunkSource {
  private readonly baseUrl: string;
  private readonly pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const g = globalThis as unknown as Record<string, ChunkCallback | undefined>;
    g[CHUNK_GLOBAL] = (key, payload) => {
      const p = this.pending.get(key);
      if (!p) return;
      this.pending.delete(key);
      p.resolve(payload);
    };
  }

  load(key: ChunkKey): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.set(key, { resolve, reject });
      const script = document.createElement('script');
      script.src = `${this.baseUrl}${chunkPath(key)}`;
      script.async = true;
      script.onload = () => {
        script.remove();
        const p = this.pending.get(key);
        if (p) {
          this.pending.delete(key);
          p.reject(new Error(`chunk ${key} : script chargé sans appel ${CHUNK_GLOBAL}`));
        }
      };
      script.onerror = () => {
        script.remove();
        const p = this.pending.get(key);
        if (p) {
          this.pending.delete(key);
          p.reject(new Error(`chunk ${key} : introuvable (${script.src})`));
        }
      };
      document.head.appendChild(script);
    });
  }
}
