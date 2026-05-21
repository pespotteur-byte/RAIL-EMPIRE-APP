let nextContractId = 1;

export class FreightContract {
  constructor(data) {
    this.id = data.id || `fret-${nextContractId++}`;
    this.cargoType = data.cargoType || 'containers';
    this.cargoName = data.cargoName || 'Conteneurs';
    this.quantity = data.quantity || 50;
    this.unit = data.unit || 't';
    this.from = data.from || '';
    this.fromId = data.fromId || '';
    this.to = data.to || '';
    this.toId = data.toId || '';
    this.payment = data.payment || 5000;
    this.active = data.active !== false;
    this.progress = data.progress || 0;
  }
}

const CARGO_CATALOGUE = [
  { type: 'containers', name: 'Conteneurs', unit: 'TEU', minQty: 20, maxQty: 100, pricePerUnit: 120 },
  { type: 'cereals', name: 'Cereales', unit: 't', minQty: 40, maxQty: 150, pricePerUnit: 45 },
  { type: 'cars', name: 'Automobiles', unit: 'unites', minQty: 10, maxQty: 80, pricePerUnit: 200 },
  { type: 'steel', name: 'Acier', unit: 't', minQty: 30, maxQty: 120, pricePerUnit: 80 },
  { type: 'fuel', name: 'Carburant', unit: 'm3', minQty: 20, maxQty: 80, pricePerUnit: 95 },
  { type: 'timber', name: 'Bois', unit: 't', minQty: 30, maxQty: 120, pricePerUnit: 35 },
  { type: 'chemicals', name: 'Chimie', unit: 't', minQty: 10, maxQty: 60, pricePerUnit: 150 },
];

export class FreightManager {
  constructor() {
    this.contracts = [];
    this.lastGenTime = 0;
  }

  maybeGenerate(stations, absTime) {
    if (absTime < this.lastGenTime) this.lastGenTime = 0;
    if (absTime - this.lastGenTime < 120) return;
    this.lastGenTime = absTime;

    if (!stations || stations.length < 2) return;
    if (this.contracts.filter(c => c.active).length >= 8) return;
    if (Math.random() > 0.3) return;

    const cargo = CARGO_CATALOGUE[Math.floor(Math.random() * CARGO_CATALOGUE.length)];
    const quantity = cargo.minQty + Math.floor(Math.random() * (cargo.maxQty - cargo.minQty));
    const from = stations[Math.floor(Math.random() * stations.length)];
    const others = stations.filter(s => s.id !== from.id);
    if (others.length === 0) return;
    const to = others[Math.floor(Math.random() * others.length)];

    this.contracts.push(new FreightContract({
      cargoType: cargo.type,
      cargoName: cargo.name,
      quantity,
      unit: cargo.unit,
      from: from.name,
      fromId: from.id,
      to: to.name,
      toId: to.id,
      payment: quantity * cargo.pricePerUnit,
    }));
  }

  toSave() {
    return this.contracts.map(c => ({
      id: c.id,
      cargoType: c.cargoType,
      cargoName: c.cargoName,
      quantity: c.quantity,
      unit: c.unit,
      from: c.from,
      fromId: c.fromId,
      to: c.to,
      toId: c.toId,
      payment: c.payment,
      active: c.active,
      progress: c.progress,
    }));
  }

  loadFromSave(arr) {
    this.contracts = arr.map(d => {
      const c = new FreightContract(d);
      const num = parseInt(d.id?.replace('fret-', '') || '0');
      if (num >= nextContractId) nextContractId = num + 1;
      return c;
    });
  }
}
