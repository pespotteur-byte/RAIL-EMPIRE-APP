import { alertToast } from './html-utils.js?v=1784772846';
const SAVE_KEY = 'rail-empire-save';
const TOKEN_KEY = 're_api_token';
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

async function compressBytes(jsonStr) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const encoder = new TextEncoder();
      const stream = new Blob([encoder.encode(jsonStr)])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      return await new Response(stream).blob();
    } catch (e) {
      console.warn('CompressionStream binary failed, sending raw:', e);
    }
  }
  return new Blob([jsonStr]);
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
    this.user = null;
  }

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token, username) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      this.user = { username };
    } else {
      localStorage.removeItem(TOKEN_KEY);
      this.user = null;
    }
  }

  isLoggedIn() {
    return !!this.getToken();
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h['X-API-Token'] = token;
    return h;
  }

  async _api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { ...this._headers(), ...(opts.headers || {}) },
    });
    return res;
  }

  async authRegister(username, password) {
    const res = await this._api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Erreur ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.token, data.username);
    return data;
  }

  async authLogin(username, password) {
    const res = await this._api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Erreur ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.token, data.username);
    return data;
  }

  async authMe() {
    const res = await this._api('/auth/me');
    if (!res.ok) {
      this.setToken(null);
      return null;
    }
    this.user = await res.json();
    return this.user;
  }

  logout() {
    this.setToken(null);
    this._remoteAvailable = false;
    this._checked = false;
  }

  async _checkRemote() {
    if (this._checked) return;
    this._checked = true;
    try {
      const res = await this._api('/saves', { method: 'GET' });
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
      const blob = await compressBytes(json);
      const res = await this._api(`/save/${this.remoteKey}`, {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
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
      const res = await this._api(`/load/${this.remoteKey}`);
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
      await this._api(`/delete/${this.remoteKey}`, { method: 'DELETE' });
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
