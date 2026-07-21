import { alertToast } from './html-utils.js?v=1784731004';
const SAVE_KEY = 'rail-empire-save';
const COMPRESSED_PREFIX = 'RELZ:';

async function compressData(jsonStr) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const encoder = new TextEncoder();
      const stream = new Blob([encoder.encode(jsonStr)])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const blob = await new Response(stream).blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return COMPRESSED_PREFIX + btoa(binary);
    } catch (e) {
      console.warn('CompressionStream failed, storing raw:', e);
    }
  }
  return jsonStr;
}

async function decompressData(stored) {
  if (!stored) return null;
  if (stored.startsWith(COMPRESSED_PREFIX)) {
    const b64 = stored.slice(COMPRESSED_PREFIX.length);
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    } catch (e) {
      console.warn('Decompression failed:', e);
      return null;
    }
  }
  return stored;
}

export class GameStorage {
  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  async saveGame(state) {
    try {
      const json = JSON.stringify(state);
      const compressed = await compressData(json);
      localStorage.setItem(SAVE_KEY, compressed);
    } catch (e) {
      console.warn('Save failed:', e);
      if (e?.name === 'QuotaExceededError') {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        } catch (e2) {
          alertToast('Sauvegarde échouée : espace de stockage plein. Exportez votre sauvegarde JSON.');
        }
      }
    }
  }

  async loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const json = await decompressData(raw);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.warn('Load failed:', e);
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e2) {
        return null;
      }
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  getSaveInfo() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const sizeBytes = new Blob([raw]).size;
    const compressed = raw.startsWith(COMPRESSED_PREFIX);
    return {
      sizeBytes,
      sizeKB: Math.round(sizeBytes / 1024),
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      compressed,
    };
  }
}
