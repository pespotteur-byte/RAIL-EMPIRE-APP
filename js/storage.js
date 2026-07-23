import { alertToast } from './html-utils.js?v=1784772841';
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
  constructor() {
    this.remoteKey = 'rail-empire-save';
    this._remoteAvailable = false;
    this._checked = false;
  }

  async _checkRemote() {
    if (this._checked) return;
    this._checked = true;
    try {
      const res = await fetch('/saves', { method: 'GET' });
      if (!res.ok) return;
      const list = await res.json();
      this._remoteAvailable = Array.isArray(list) && list.some(s => s.key === this.remoteKey);
    } catch (e) {
      this._remoteAvailable = false;
    }
  }

  async hasSave() {
    if (!!localStorage.getItem(SAVE_KEY)) return true;
    await this._checkRemote();
    return this._remoteAvailable;
  }

  async saveGame(state) {
    const json = JSON.stringify(state);
    try {
      const compressed = await compressData(json);
      localStorage.setItem(SAVE_KEY, compressed);
    } catch (e) {
      console.warn('Local save failed:', e);
    }
    try {
      const res = await fetch(`/save/${this.remoteKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (res.ok) {
        this._remoteAvailable = true;
      } else {
        console.warn('Remote save failed:', res.status);
      }
    } catch (e) {
      console.warn('Remote save failed:', e);
    }
  }

  async loadGame() {
    try {
      const res = await fetch(`/load/${this.remoteKey}`);
      if (res.ok) {
        const data = await res.json();
        try {
          const compressed = await compressData(JSON.stringify(data));
          localStorage.setItem(SAVE_KEY, compressed);
        } catch (e) {}
        this._remoteAvailable = true;
        return data;
      }
    } catch (e) {
      console.warn('Remote load failed:', e);
    }
    // Fallback localStorage
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const json = await decompressData(raw);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.warn('Local load failed:', e);
      return null;
    }
  }

  async deleteSave() {
    localStorage.removeItem(SAVE_KEY);
    try {
      await fetch(`/delete/${this.remoteKey}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Remote delete failed:', e);
    }
    this._remoteAvailable = false;
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
