export class Station {
  constructor(data, name, lat, lon, platforms, type) {
    if (typeof data === 'string') {
      this.id = data;
      this.name = name || data;
      this.lat = lat || 0;
      this.lon = lon || 0;
      this.platforms = platforms || 2;
      this.type = type || 'voyageur';
    } else {
      this.id = data.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.name = data.name || 'Gare';
      this.lat = data.lat || 0;
      this.lon = data.lon || 0;
      this.platforms = data.platforms || 2;
      this.type = data.type || 'voyageur';
    }
    this.platformNames = data.platformNames || []; // custom platform names (e.g. ['1', '2', '3A', '3B'])
    this.cargo = [];
    this.facilities = [];
    this.country = '';
    this.lineIds = data.lineIds || []; // lines this station belongs to
    this.closed = data.closed || false;
  }
}

export class Track {
  constructor(data) {
    this.id = data.id || `trk-${Date.now()}`;
    this.stationA = data.stationA;
    this.stationB = data.stationB;
    this.distance = data.distance || 0;
    this.maxSpeed = data.maxSpeed || 160;
    this.electrified = data.electrified !== false;
    this.name = data.name || '';
    this.route = data.route || [];
    this.worksActive = false;
    this.worksImpact = null;
    this.worksSpeedLimit = null;
    this.tracks = data.tracks || 2;
  }
}

// Re-export from simulation.js to avoid duplication
export { haversineDistance as haversine } from './simulation.js?v=1779403154';

export class World {
  constructor() {
    this.stations = [];
    this.tracks = [];
  }

  addStation(data) {
    const station = new Station(data);
    this.stations.push(station);
    return station;
  }

  removeStation(id) {
    this.tracks = this.tracks.filter(t => t.stationA !== id && t.stationB !== id);
    this.stations = this.stations.filter(s => s.id !== id);
  }

  addTrack(data) {
    const track = new Track(data);
    this.tracks.push(track);
    return track;
  }

  removeTrack(id) {
    this.tracks = this.tracks.filter(t => t.id !== id);
  }

  getStationById(id) {
    return this.stations.find(s => s.id === id);
  }

  getTrackBetween(stationAId, stationBId) {
    return this.tracks.find(t =>
      (t.stationA === stationAId && t.stationB === stationBId) ||
      (t.stationA === stationBId && t.stationB === stationAId)
    );
  }

  // findPath removed — routing now uses ORM Dijkstra directly

  toSave() {
    return {
      stations: this.stations.map(s => ({
        id: s.id, name: s.name, lat: s.lat, lon: s.lon,
        platforms: s.platforms, type: s.type, country: s.country,
        facilities: s.facilities, lineIds: s.lineIds || [],
        platformNames: s.platformNames || [], closed: s.closed || false,
      })),
      tracks: this.tracks.map(t => ({
        id: t.id, stationA: t.stationA, stationB: t.stationB,
        distance: t.distance, maxSpeed: t.maxSpeed,
        electrified: t.electrified, name: t.name,
        route: t.route, tracks: t.tracks,
      })),
    };
  }

  loadFromSave(data) {
    if (!data) return;
    this.stations = (data.stations || []).map(d => {
      const s = new Station(d);
      s.country = d.country || '';
      s.facilities = d.facilities || [];
      s.lineIds = d.lineIds || [];
      s.platformNames = d.platformNames || [];
      s.closed = d.closed || false;
      return s;
    });
    this.tracks = (data.tracks || []).map(d => new Track(d));
  }
}

export function createDefaultWorld() {
  const world = new World();
  return world;
}
