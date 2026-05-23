let nextContractId = 1;

export class FreightContract {
  constructor(data) {
    this.id = data.id || `fret-${nextContractId++}`;
    this.cargoType = data.cargoType || 'containers-20';
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
    this.industrialClientId = data.industrialClientId || null;
  }
}

export class FreightManager {
  constructor() {
    this.contracts = [];
    this.lastGenTime = 0;
  }

  maybeGenerate(stations, absTime, cargoTypes) {
    if (absTime < this.lastGenTime) this.lastGenTime = 0;
    if (absTime - this.lastGenTime < 120) return;
    this.lastGenTime = absTime;

    if (!stations || stations.length < 2) return;
    if (this.contracts.filter(c => c.active && !c.industrialClientId).length >= 12) return;
    if (Math.random() > 0.3) return;

    // Use CargoTypeManager if available, otherwise fallback
    const allTypes = cargoTypes?.getAllTypes?.() || [];
    if (allTypes.length === 0) return;

    const cargo = allTypes[Math.floor(Math.random() * allTypes.length)];
    const quantity = 20 + Math.floor(Math.random() * 500);
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
      industrialClientId: c.industrialClientId || null,
    }));
  }

  loadFromSave(arr) {
    this.contracts = arr.map(d => {
      const c = new FreightContract(d);
      const num = parseInt(d.id?.replace('fret-', '').replace('fret-ind-', '') || '0');
      if (num >= nextContractId) nextContractId = num + 1;
      return c;
    });
  }
}
