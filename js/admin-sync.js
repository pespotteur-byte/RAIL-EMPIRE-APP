// ============ ADMIN SYNC ENGINE ============
// Loads admin overrides from GitHub (published by admin panel)
// Applies catalog modifications, deletions, imports
// Manages admin-defined custom incidents with time-based random triggering
// Respects player opt-in/opt-out preference
import { getGlobalRng } from './rng.js?v=1784731002';

const OVERRIDE_URL = 'https://raw.githubusercontent.com/pespotteur-byte/RAIL-EMPIRE-APP/devin/1780231310-catalog-bb7200/data/admin-overrides.json';

export class AdminSync {
  constructor() {
    this.overrides = null;
    this.incidents = [];
    this.activeIncidents = [];
    this.loaded = false;
    this.checkInterval = null;
    this.optIn = this._loadOptIn();
  }

  _loadOptIn() {
    try {
      const settings = JSON.parse(localStorage.getItem('re_player_settings') || '{}');
      return settings.incidentsEnabled !== false;
    } catch (e) { return true; }
  }

  setOptIn(value) {
    this.optIn = value;
    try {
      const settings = JSON.parse(localStorage.getItem('re_player_settings') || '{}');
      settings.incidentsEnabled = value;
      localStorage.setItem('re_player_settings', JSON.stringify(settings));
    } catch (e) {}
    if (!value) this.activeIncidents = [];
  }

  async loadOverrides() {
    try {
      const res = await fetch(OVERRIDE_URL + '?t=' + Date.now());
      if (res.ok) {
        this.overrides = await res.json();
        this.incidents = this.overrides.incidents || [];
        this.loaded = true;
        return this.overrides;
      }
    } catch (e) {
      console.warn('[AdminSync] GitHub fetch failed:', e.message);
    }
    // Fallback: local file
    try {
      const res = await fetch('./data/admin-overrides.json?t=' + Date.now());
      if (res.ok) {
        this.overrides = await res.json();
        this.incidents = this.overrides.incidents || [];
        this.loaded = true;
        return this.overrides;
      }
    } catch (e) {}
    return null;
  }

  applyCatalogOverrides(catalog) {
    if (!this.overrides) return catalog;
    const { modifications, deletions, imports } = this.overrides;

    if (deletions && deletions.length > 0) {
      const deletedSet = new Set(deletions);
      catalog = catalog.filter(item => !deletedSet.has(item.id));
    }
    if (modifications && modifications.length > 0) {
      const modMap = new Map(modifications.map(m => [m.id, m]));
      catalog = catalog.map(item => modMap.has(item.id) ? { ...item, ...modMap.get(item.id) } : item);
    }
    if (imports && imports.length > 0) {
      catalog.push(...imports);
    }
    return catalog;
  }

  startIncidentLoop(gameTimeGetter) {
    this.gameTimeGetter = gameTimeGetter;
    this.stopIncidentLoop();
    this.checkInterval = setInterval(() => this._tick(), 60000);
    setTimeout(() => this._tick(), 10000);
  }

  stopIncidentLoop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  _tick() {
    if (!this.optIn || this.incidents.length === 0) return;

    const now = this.gameTimeGetter ? this.gameTimeGetter() : new Date();
    const hour = typeof now === 'object' && now.getHours ? now.getHours() : 12;

    // Expire old incidents
    const t = Date.now();
    this.activeIncidents = this.activeIncidents.filter(ai => ai.expiresAt > t);

    for (const inc of this.incidents) {
      if (this.activeIncidents.some(ai => ai.templateId === inc.id)) continue;

      // Time window
      if (inc.hourStart <= inc.hourEnd) {
        if (hour < inc.hourStart || hour >= inc.hourEnd) continue;
      } else {
        if (hour < inc.hourStart && hour >= inc.hourEnd) continue;
      }

      // Probability (%/hour → per-minute)
      const rng = getGlobalRng();
      if (rng.random() < (inc.probability / 100 / 60)) {
        this._trigger(inc);
      }
    }
  }

  _trigger(template) {
    const active = {
      templateId: template.id,
      name: template.name,
      description: template.description,
      effect: template.effect,
      severity: template.severity,
      startedAt: Date.now(),
      expiresAt: Date.now() + template.duration * 60000,
      duration: template.duration,
    };
    this.activeIncidents.push(active);
    window.dispatchEvent(new CustomEvent('admin-incident', { detail: active }));
  }

  getEffects() {
    const fx = { speedMul: 1, costMul: 1, revenueMul: 1, delayMin: 0 };
    for (const ai of this.activeIncidents) {
      switch (ai.effect) {
        case 'speed_reduction': fx.speedMul *= 0.5; break;
        case 'extra_cost': fx.costMul *= 1.3; break;
        case 'revenue_bonus': fx.revenueMul *= 1.2; break;
        case 'delay': fx.delayMin += 15; break;
      }
    }
    return fx;
  }

  hasActive() {
    return this.activeIncidents.length > 0;
  }
}

export const adminSync = new AdminSync();
