let nextLineId = 1;

export class Line {
  constructor(data) {
    this.id = data.id || `line-${nextLineId++}`;
    this.name = data.name || 'Ligne';
    this.color = data.color || '#3b82f6';
    this.code = data.code || '';
    this.stops = data.stops || []; // ordered array of station IDs
    this.trackIds = data.trackIds || []; // track IDs between consecutive stops (length = stops.length - 1)
  }

  getStationIds() {
    return [...this.stops];
  }

  hasStation(stationId) {
    return this.stops.includes(stationId);
  }

  hasTrack(trackId) {
    return this.trackIds.includes(trackId);
  }

  toSave() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      code: this.code,
      stops: [...this.stops],
      trackIds: [...this.trackIds],
    };
  }
}

export class LineManager {
  constructor() {
    this.lines = [];
  }

  addLine(data) {
    const line = new Line(data);
    this.lines.push(line);
    return line;
  }

  removeLine(id) {
    this.lines = this.lines.filter(l => l.id !== id);
  }

  getLine(id) {
    return this.lines.find(l => l.id === id);
  }

  getAll() {
    return this.lines;
  }

  getLinesForStation(stationId) {
    return this.lines.filter(l => l.hasStation(stationId));
  }

  getLinesForTrack(trackId) {
    return this.lines.filter(l => l.hasTrack(trackId));
  }

  /**
   * Build a line from ordered station IDs.
   * Reuses existing tracks (troncons communs) if they exist between station pairs.
   * Creates new tracks via ORM if they don't exist.
   */
  async buildLine(lineData, world, orm) {
    const stops = lineData.stops || [];
    if (stops.length < 2) return null;

    const trackIds = [];

    for (let i = 0; i < stops.length - 1; i++) {
      const stA = world.getStationById(stops[i]);
      const stB = world.getStationById(stops[i + 1]);
      if (!stA || !stB) { trackIds.push(null); continue; }

      // Check if a track already exists between these two stations (troncon commun)
      let existing = world.getTrackBetween(stA.id, stB.id);
      if (existing) {
        trackIds.push(existing.id);
        continue;
      }

      // No existing track - create one via ORM
      try {
        const route = await orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
        const distance = orm.getRouteDistance(route);
        const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
        const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;

        const track = world.addTrack({
          stationA: stA.id,
          stationB: stB.id,
          distance: Math.round(distance),
          maxSpeed: avgSpeed,
          electrified: true,
          name: `${stA.name} - ${stB.name}`,
          route,
        });
        trackIds.push(track.id);
      } catch (e) {
        console.warn(`ORM route failed for ${stA.name} -> ${stB.name}:`, e);
        const dist = Math.round(Math.sqrt(
          Math.pow((stB.lat - stA.lat) * 111, 2) +
          Math.pow((stB.lon - stA.lon) * 111 * Math.cos(stA.lat * Math.PI / 180), 2)
        ));
        const track = world.addTrack({
          stationA: stA.id,
          stationB: stB.id,
          distance: dist,
          maxSpeed: 160,
          name: `${stA.name} - ${stB.name}`,
        });
        trackIds.push(track.id);
      }
    }

    lineData.trackIds = trackIds;
    return this.addLine(lineData);
  }

  toSave() {
    return this.lines.map(l => l.toSave());
  }

  loadFromSave(data) {
    if (!data || !Array.isArray(data)) return;
    this.lines = data.map(d => new Line(d));
    nextLineId = this.lines.reduce((max, l) => {
      const num = parseInt(l.id.replace('line-', ''));
      return isNaN(num) ? max : Math.max(max, num + 1);
    }, nextLineId);
  }
}

/**
 * PlatformManager - tracks platform allocation at stations.
 * Each station has N platforms. A train occupies one platform while stopped.
 */
export class PlatformManager {
  constructor() {
    // stationId -> { total: N, occupied: Map<platformIndex, trainId> }
    this.stationPlatforms = new Map();
  }

  initStation(stationId, numPlatforms) {
    if (!this.stationPlatforms.has(stationId)) {
      this.stationPlatforms.set(stationId, {
        total: numPlatforms,
        occupied: new Map(),
      });
    } else {
      // Update total if changed
      this.stationPlatforms.get(stationId).total = numPlatforms;
    }
  }

  /**
   * Try to assign a platform to a train at a station.
   * Returns the platform name/number or null if all platforms are occupied.
   * @param {string} preferred - preferred platform name from schedule (optional)
   */
  assignPlatform(stationId, trainId, numPlatforms, preferred) {
    if (!this.stationPlatforms.has(stationId)) {
      this.initStation(stationId, numPlatforms || 2);
    }
    const data = this.stationPlatforms.get(stationId);

    // Check if train already has a platform
    for (const [plat, tid] of data.occupied) {
      if (tid === trainId) return plat;
    }

    // If a preferred platform was specified and it's free, use it
    if (preferred) {
      // Try matching by name (string comparison)
      let preferredKey = null;
      for (let i = 1; i <= data.total; i++) {
        if (String(i) === String(preferred) || preferred === String(i)) {
          preferredKey = i;
          break;
        }
      }
      if (preferredKey && !data.occupied.has(preferredKey)) {
        data.occupied.set(preferredKey, trainId);
        return preferredKey;
      }
    }

    // Find first free platform
    for (let i = 1; i <= data.total; i++) {
      if (!data.occupied.has(i)) {
        data.occupied.set(i, trainId);
        return i;
      }
    }
    return null; // All platforms occupied
  }

  /**
   * Release a platform when a train departs.
   */
  releasePlatform(stationId, trainId) {
    const data = this.stationPlatforms.get(stationId);
    if (!data) return;
    for (const [plat, tid] of data.occupied) {
      if (tid === trainId) {
        data.occupied.delete(plat);
        return;
      }
    }
  }

  /**
   * Get the platform a train is on, or null.
   */
  getPlatformForTrain(stationId, trainId) {
    const data = this.stationPlatforms.get(stationId);
    if (!data) return null;
    for (const [plat, tid] of data.occupied) {
      if (tid === trainId) return plat;
    }
    return null;
  }

  /**
   * Check how many free platforms are available.
   */
  getFreePlatforms(stationId) {
    const data = this.stationPlatforms.get(stationId);
    if (!data) return 0;
    return data.total - data.occupied.size;
  }

  /**
   * Get platform status for display.
   */
  getStatus(stationId) {
    const data = this.stationPlatforms.get(stationId);
    if (!data) return { total: 0, used: 0, free: 0, assignments: [] };
    const assignments = [];
    for (const [plat, tid] of data.occupied) {
      assignments.push({ platform: plat, trainId: tid });
    }
    return {
      total: data.total,
      used: data.occupied.size,
      free: data.total - data.occupied.size,
      assignments,
    };
  }
}
