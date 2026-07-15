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
