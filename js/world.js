export class Station {
  constructor(data) {
    if (typeof data === 'string') {
      this.id = data;
      this.name = arguments[1] || data;
      this.lat = arguments[2] || 0;
      this.lon = arguments[3] || 0;
      this.platforms = arguments[4] || 2;
      this.type = arguments[5] || 'voyageur';
    } else {
      this.id = data.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.name = data.name || 'Gare';
      this.lat = data.lat || 0;
      this.lon = data.lon || 0;
      this.platforms = data.platforms || 2;
      this.type = data.type || 'voyageur';
    }
    this.cargo = [];
    this.facilities = [];
    this.country = '';
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

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  findPath(fromId, toId) {
    const visited = new Set();
    const queue = [{ id: fromId, path: [fromId] }];
    while (queue.length > 0) {
      const { id, path } = queue.shift();
      if (id === toId) return path;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const track of this.tracks) {
        let next = null;
        if (track.stationA === id) next = track.stationB;
        else if (track.stationB === id) next = track.stationA;
        if (next && !visited.has(next)) {
          queue.push({ id: next, path: [...path, next] });
        }
      }
    }
    return null;
  }

  toSave() {
    return {
      stations: this.stations.map(s => ({
        id: s.id, name: s.name, lat: s.lat, lon: s.lon,
        platforms: s.platforms, type: s.type, country: s.country,
        facilities: s.facilities,
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
      return s;
    });
    this.tracks = (data.tracks || []).map(d => new Track(d));
  }
}

export function createDefaultWorld() {
  const world = new World();
  return world;
}
