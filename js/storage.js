import { alertToast } from './html-utils.js?v=1784931691';
const SAVE_KEY = 'rail-empire-save';
const RAW_KEY = SAVE_KEY + '_raw';
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
    if (!!localStorage.getItem(SAVE_KEY) || !!localStorage.getItem(RAW_KEY)) return true;
    await this._checkRemote();
    return this._remoteAvailable;
  }

  saveGameSync(state, json = null) {
    // Synchronous emergency backup: raw JSON, fastest possible path.
    // localStorage is limited (typically 5 MB), so try to free space first.
    let data;
    try {
      data = json || JSON.stringify(state);
      if (data.length > 2_000_000) {
        try { localStorage.removeItem(RAW_KEY); } catch (_) {}
        return data;
      }
      localStorage.setItem(RAW_KEY, data);
      return data;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || (e.message && e.message.includes('quota'))) {
        try {
          localStorage.removeItem(SAVE_KEY);
          localStorage.removeItem(RAW_KEY);
          localStorage.setItem(RAW_KEY, data || JSON.stringify(state));
          return data || json;
        } catch (_) {
          // Still not enough room; remote save is the fallback.
          return data || json;
        }
      }
      console.warn('Sync raw save failed:', e);
      return json || null;
    }
  }

  async saveGame(state) {
    let json;
    try {
      json = JSON.stringify(state);
    } catch (e) {
      console.warn('State stringify failed:', e);
      return;
    }
    this.saveGameSync(state, json);
    try {
      const compressed = await compressData(json);
      localStorage.setItem(SAVE_KEY, compressed);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || (e.message && e.message.includes('quota'))) {
        try {
          localStorage.removeItem(RAW_KEY);
          const compressed = await compressData(json);
          localStorage.setItem(SAVE_KEY, compressed);
        } catch (_) {
          // No room on device; rely on remote save.
        }
      } else {
        console.warn('Local compressed save failed:', e);
      }
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
    // Pick the newest local save between compressed and raw emergency backup.
    let best = null;
    let bestTime = 0;
    const tryLoad = async (stored) => {
      try {
        const json = stored.startsWith(COMPRESSED_PREFIX) ? await decompressData(stored) : stored;
        const data = JSON.parse(json);
        if (data && (data.saveTime || 0) > bestTime) {
          best = data;
          bestTime = data.saveTime;
        }
      } catch (e) {}
    };
    const compressed = localStorage.getItem(SAVE_KEY);
    if (compressed) await tryLoad(compressed);
    const raw = localStorage.getItem(RAW_KEY);
    if (raw) await tryLoad(raw);

    try {
      const res = await this._api(`/load/${this.remoteKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.saveTime || 0) > bestTime) {
          best = data;
          bestTime = data.saveTime;
        }
        if (best) {
          try {
            const compressed = await compressData(JSON.stringify(best));
            localStorage.setItem(SAVE_KEY, compressed);
          } catch (e) {}
        }
        this._remoteAvailable = true;
        return best;
      }
    } catch (e) {
      console.warn('Remote load failed:', e);
    }
    return best;
  }

  async deleteSave() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(RAW_KEY);
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
