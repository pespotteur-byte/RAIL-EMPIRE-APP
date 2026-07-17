let nextSillonId = 1;

export class Sillon {
  constructor(data) {
    this.id = data.id || `sillon-${nextSillonId++}`;
    this.name = data.name || 'V1';
    this.fromStationId = data.fromStationId || '';
    this.toStationId = data.toStationId || '';
    this.fromStationName = data.fromStationName || '';
    this.toStationName = data.toStationName || '';
    this.route = data.route || []; // array of {lat, lon, maxSpeed, electrified}
    this.distance = isFinite(data.distance) ? data.distance : 0;
    this.maxSpeed = data.maxSpeed || 160;
    this.electrified = data.electrified !== false;
    this.createdDate = data.createdDate || new Date().toISOString().split('T')[0];
  }

  get isValid() {
    return this.fromStationId && this.toStationId && this.fromStationId !== this.toStationId &&
      Array.isArray(this.route) && this.route.length >= 2;
  }
}

export class SillonManager {
  constructor() {
    this.sillons = [];
  }

  add(data) {
    const sillon = new Sillon(data);
    this.sillons.push(sillon);
    return sillon;
  }

  remove(id) {
    this.sillons = this.sillons.filter(s => s.id !== id);
  }

  getById(id) {
    return this.sillons.find(s => s.id === id);
  }

  getAll() {
    return this.sillons;
  }

  getBetween(fromStationId, toStationId) {
    return this.sillons.filter(s =>
      s.fromStationId === fromStationId && s.toStationId === toStationId
    );
  }

  getNextName(fromStationId, toStationId) {
    const existing = this.getBetween(fromStationId, toStationId).map(s => s.name);
    const suffixes = ['', 'BIS', 'TER', 'QUATER', 'QUINQUIES'];
    for (let i = 0; i < existing.length + suffixes.length + 2; i++) {
      const base = Math.floor(i / suffixes.length) + 1;
      const suffix = suffixes[i % suffixes.length];
      const candidate = `V${base}${suffix}`;
      if (!existing.includes(candidate)) return candidate;
    }
    return `V${existing.length + 1}`;
  }

  _samePoint(a, b) {
    if (!a || !b) return false;
    return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
  }

  _pathEntry(route) {
    if (!route || route.length === 0) return null;
    const first = route[0];
    const last = route[route.length - 1];
    const outRoute = [];
    for (let i = 0; i < route.length; i++) {
      const r = route[i].route || [];
      for (let j = 0; j < r.length; j++) {
        const pt = r[j];
        if (outRoute.length > 0 && i > 0 && j === 0 && this._samePoint(outRoute[outRoute.length - 1], pt)) continue;
        outRoute.push({ lat: pt.lat, lon: pt.lon, maxSpeed: pt.maxSpeed || route[i].maxSpeed, electrified: pt.electrified !== false && route[i].electrified !== false });
      }
    }
    let totalDistance = 0;
    let weightedSpeed = 0;
    for (const s of route) {
      totalDistance += s.distance || 0;
      weightedSpeed += (s.distance || 0) * (s.maxSpeed || 160);
    }
    const avgSpeed = totalDistance > 0 ? Math.round(weightedSpeed / totalDistance) : (route[0].maxSpeed || 160);
    return {
      id: route.map(s => s.id).join('|'),
      name: route.map(s => s.name).join(' → '),
      fromStationId: first.fromStationId,
      toStationId: last.toStationId,
      fromStationName: first.fromStationName,
      toStationName: last.toStationName,
      route: outRoute,
      distance: totalDistance,
      maxSpeed: avgSpeed,
      electrified: route.every(s => s.electrified !== false),
      segments: route.map(s => s.name),
      _isPath: true,
    };
  }

  findPaths(fromStationId, toStationId, maxHops = 4) {
    const results = [];
    const direct = this.getBetween(fromStationId, toStationId);
    for (const s of direct) results.push(this._pathEntry([s]));
    if (maxHops <= 1 || this.sillons.length === 0) return results;

    const adj = new Map();
    for (const s of this.sillons) {
      if (!adj.has(s.fromStationId)) adj.set(s.fromStationId, []);
      adj.get(s.fromStationId).push(s);
    }

    const queue = [{ current: fromStationId, route: [], visited: new Set([fromStationId]) }];
    while (queue.length > 0) {
      const { current, route, visited } = queue.shift();
      if (route.length >= maxHops) continue;
      const next = adj.get(current) || [];
      for (const s of next) {
        if (visited.has(s.toStationId)) continue;
        const newRoute = [...route, s];
        if (s.toStationId === toStationId) {
          results.push(this._pathEntry(newRoute));
        } else {
          const newVisited = new Set(visited);
          newVisited.add(s.toStationId);
          queue.push({ current: s.toStationId, route: newRoute, visited: newVisited });
        }
      }
    }
    return results;
  }

  toSave() {
    return this.sillons.map(s => ({
      id: s.id,
      name: s.name,
      fromStationId: s.fromStationId,
      toStationId: s.toStationId,
      fromStationName: s.fromStationName,
      toStationName: s.toStationName,
      route: s.route,
      distance: s.distance,
      maxSpeed: s.maxSpeed,
      electrified: s.electrified,
      createdDate: s.createdDate,
    }));
  }

  loadFromSave(arr) {
    this.sillons = [];
    if (!Array.isArray(arr)) return;
    for (const d of arr) {
      this.sillons.push(new Sillon(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextSillonId) nextSillonId = num + 1;
    }
  }
}
