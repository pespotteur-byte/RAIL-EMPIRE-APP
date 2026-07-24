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
export { haversineDistance as haversine } from './simulation.js?v=1784931679';

export class World {
  constructor() {
    this.stations = [];
    this.tracks = [];
    this._stationMap = new Map();
    this._trackPairMap = new Map();
  }

  _rebuildStationMap() {
    this._stationMap.clear();
    for (const s of this.stations) this._stationMap.set(s.id, s);
  }

  _trackPairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  _rebuildTrackPairMap() {
    this._trackPairMap.clear();
    for (const t of this.tracks) this._trackPairMap.set(this._trackPairKey(t.stationA, t.stationB), t);
  }

  addStation(data) {
    const station = new Station(data);
    this.stations.push(station);
    this._stationMap.set(station.id, station);
    return station;
  }

  removeStation(id) {
    this.tracks = this.tracks.filter(t => t.stationA !== id && t.stationB !== id);
    this.stations = this.stations.filter(s => s.id !== id);
    this._stationMap.delete(id);
    this._rebuildTrackPairMap();
  }

  addTrack(data) {
    const track = new Track(data);
    this.tracks.push(track);
    this._trackPairMap.set(this._trackPairKey(track.stationA, track.stationB), track);
    return track;
  }

  removeTrack(id) {
    const t = this.tracks.find(t => t.id === id);
    this.tracks = this.tracks.filter(t => t.id !== id);
    if (t) this._trackPairMap.delete(this._trackPairKey(t.stationA, t.stationB));
  }

  getStationById(id) {
    return this._stationMap.get(id);
  }

  getTrackBetween(stationAId, stationBId) {
    return this._trackPairMap.get(this._trackPairKey(stationAId, stationBId));
  }

  // findPath removed — routing now uses ORM Dijkstra directly

  toSave() {
    return {
      stations: this.stations.map(s => {
        const o = { id: s.id, n: s.name, la: Math.round(s.lat * 1e5), lo: Math.round(s.lon * 1e5) };
        if (s.platforms !== 2) o.p = s.platforms;
        if (s.type !== 'voyageur') o.t = s.type;
        if (s.country) o.c = s.country;
        if (s.facilities?.length) o.f = s.facilities;
        if (s.lineIds?.length) o.li = s.lineIds;
        if (s.platformNames?.length) o.pn = s.platformNames;
        if (s.closed) o.cl = true;
        return o;
      }),
      tracks: this.tracks.map(t => {
        const o = { id: t.id, a: t.stationA, b: t.stationB, d: Math.round(t.distance * 100) / 100 };
        if (t.maxSpeed !== 160) o.s = t.maxSpeed;
        if (!t.electrified) o.e = false;
        if (t.name) o.n = t.name;
        if (t.tracks !== 2) o.tk = t.tracks;
        // Compact route: delta-encoded int array [lat0*1e5, lon0*1e5, dlat1, dlon1, dlat2, dlon2, ...]
        if (t.route?.length > 0) {
          const r = [];
          let prevLat = 0, prevLon = 0;
          for (let i = 0; i < t.route.length; i++) {
            const pt = t.route[i];
            const lat5 = Math.round(pt.lat * 1e5);
            const lon5 = Math.round(pt.lon * 1e5);
            if (i === 0) { r.push(lat5, lon5); }
            else { r.push(lat5 - prevLat, lon5 - prevLon); }
            prevLat = lat5; prevLon = lon5;
          }
          o.r = r;
        }
        return o;
      }),
      _v: 2, // format version
    };
  }

  loadFromSave(data) {
    if (!data) return;
    const v2 = data._v === 2;
    this.stations = (data.stations || []).map(d => {
      if (v2) {
        const s = new Station({
          id: d.id, name: d.n, lat: d.la / 1e5, lon: d.lo / 1e5,
          platforms: d.p || 2, type: d.t || 'voyageur',
          lineIds: d.li || [], platformNames: d.pn || [], closed: d.cl || false,
        });
        s.country = d.c || '';
        s.facilities = d.f || [];
        return s;
      }
      const s = new Station(d);
      s.country = d.country || '';
      s.facilities = d.facilities || [];
      s.lineIds = d.lineIds || [];
      s.platformNames = d.platformNames || [];
      s.closed = d.closed || false;
      return s;
    });
    this.tracks = (data.tracks || []).map(d => {
      if (v2) {
        // Decode delta-encoded route
        let route = [];
        if (d.r?.length >= 2) {
          let lat = d.r[0], lon = d.r[1];
          route.push({ lat: lat / 1e5, lon: lon / 1e5 });
          for (let i = 2; i < d.r.length; i += 2) {
            lat += d.r[i]; lon += d.r[i + 1];
            route.push({ lat: lat / 1e5, lon: lon / 1e5 });
          }
        }
        return new Track({
          id: d.id, stationA: d.a, stationB: d.b,
          distance: d.d, maxSpeed: d.s || 160,
          electrified: d.e !== false, name: d.n || '',
          route, tracks: d.tk || 2,
        });
      }
      return new Track(d);
    });
    this._rebuildStationMap();
    this._rebuildTrackPairMap();
  }
}

export function createDefaultWorld() {
  const world = new World();
  return world;
}
