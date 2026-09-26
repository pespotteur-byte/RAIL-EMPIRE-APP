import fs from 'node:fs/promises';
import path from 'node:path';
import { chunkPath, decodeChunk, type ChunkKey, type ChunkSource } from '@re/data';

/** Source de chunks sur disque (outils, tests, bancs de perf). */
export class FileChunkSource implements ChunkSource {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async load(key: ChunkKey): Promise<unknown> {
    const text = await fs.readFile(path.join(this.root, chunkPath(key)), 'utf8');
    const { key: found, payload } = decodeChunk(text);
    if (found !== key) throw new Error(`chunk ${key} : clé livrée ${found}`);
    return payload;
  }
}
