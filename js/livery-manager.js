export class LiveryManager {
  constructor(storage) {
    this.storage = storage;
    this._cache = new Map(); // id -> blob URL
    this._loading = new Set();
  }

  _headers() {
    const h = {};
    const token = this.storage.getToken();
    if (token) h['X-API-Token'] = token;
    return h;
  }

  async upload(file, name, targetCategory = 'all') {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name || file.name);
    form.append('target_category', targetCategory);
    const res = await fetch('/liveries', {
      method: 'POST',
      headers: this._headers(),
      body: form,
    });
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    return res.json();
  }

  async list() {
    const res = await fetch('/liveries', { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async delete(id) {
    const res = await fetch(`/liveries/${id}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (this._cache.has(id)) {
      URL.revokeObjectURL(this._cache.get(id));
      this._cache.delete(id);
    }
    return res.json();
  }

  async loadImage(id) {
    if (this._cache.has(id)) return this._cache.get(id);
    if (this._loading.has(id)) return null;
    this._loading.add(id);
    try {
      const res = await fetch(`/liveries/${id}`, { headers: this._headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      this._cache.set(id, url);
      return url;
    } catch (e) {
      console.warn('Livery load failed:', e);
      return null;
    } finally {
      this._loading.delete(id);
    }
  }

  clearCache() {
    for (const url of this._cache.values()) URL.revokeObjectURL(url);
    this._cache.clear();
  }
}
