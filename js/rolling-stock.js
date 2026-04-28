let nextId = 1;

export class RollingStockItem {
  constructor(data) {
    this.id = data.id || `stock-${nextId++}`;
    this.name = data.name || 'Sans nom';
    this.category = data.category || 'locomotive';
    this.traction = data.traction || 'none';
    this.maxSpeed = data.maxSpeed || 160;
    this.tonnage = data.tonnage || 80;
    // Physics: separate mass from capacity
    this.mass = data.mass || data.tonnage || 80; // tonnes (empty mass for wagons, total mass for locos)
    this.power = data.power || 0; // kW (only for locomotives/automotrices)
    this.passengerCapacity = data.passengerCapacity || 0;
    this.freightCapacity = data.freightCapacity || 0;
    this.length = data.length || 20;
    this.imageData = data.imageData || null;
  }
}

export class RollingStockManager {
  constructor() {
    this.items = [];
  }

  add(data) {
    const item = new RollingStockItem(data);
    this.items.push(item);
    return item;
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
  }

  getById(id) {
    return this.items.find(i => i.id === id);
  }

  getAll() {
    return this.items;
  }

  toSave() {
    return this.items.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      traction: i.traction,
      maxSpeed: i.maxSpeed,
      tonnage: i.tonnage,
      mass: i.mass,
      power: i.power,
      passengerCapacity: i.passengerCapacity,
      freightCapacity: i.freightCapacity,
      length: i.length,
      imageData: i.imageData,
    }));
  }

  loadFromSave(arr) {
    this.items = [];
    for (const d of arr) {
      this.items.push(new RollingStockItem(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextId) nextId = num + 1;
    }
  }
}
