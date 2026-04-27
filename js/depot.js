let nextDepotId = 1;

export class Depot {
  constructor(data) {
    this.id = data.id || `depot-${nextDepotId++}`;
    this.type = data.type || 'depot'; // depot, ite-fret, ite-industrie, ite-logistique
    this.name = data.name || 'Depot';
    this.stationId = data.stationId || '';
    this.tracks = data.tracks || 4;
    this.cost = data.cost || 50000;
    this.built = data.built || false;
    this.ramesStored = data.ramesStored || [];
  }

  getTypeLabel() {
    const labels = {
      'depot': 'Depot maintenance',
      'ite-fret': 'ITE Fret',
      'ite-industrie': 'ITE Industrie',
      'ite-logistique': 'ITE Logistique',
    };
    return labels[this.type] || this.type;
  }

  getMaintenanceCost() {
    return this.tracks * 200;
  }
}

export class DepotManager {
  constructor() {
    this.depots = [];
  }

  add(data, economy) {
    const depot = new Depot(data);
    if (economy && economy.balance >= depot.cost) {
      economy.addExpense(depot.cost, 'construction', `Construction ${depot.name}`);
      depot.built = true;
    } else {
      depot.built = false;
    }
    this.depots.push(depot);
    return depot;
  }

  remove(id) {
    this.depots = this.depots.filter(d => d.id !== id);
  }

  getAll() {
    return this.depots;
  }

  getDepots() {
    return this.depots.filter(d => d.type === 'depot');
  }

  getITEs() {
    return this.depots.filter(d => d.type.startsWith('ite'));
  }

  getByStation(stationId) {
    return this.depots.filter(d => d.stationId === stationId);
  }

  toSave() {
    return this.depots.map(d => ({
      id: d.id,
      type: d.type,
      name: d.name,
      stationId: d.stationId,
      tracks: d.tracks,
      cost: d.cost,
      built: d.built,
      ramesStored: d.ramesStored,
    }));
  }

  loadFromSave(arr) {
    this.depots = [];
    for (const d of arr) {
      this.depots.push(new Depot(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextDepotId) nextDepotId = num + 1;
    }
  }
}
