let nextId = 1;

export class RollingStockItem {
  constructor(data) {
    this.id = data.id || `stock-${nextId++}`;
    this.name = data.name || 'Sans nom';
    this.category = data.category || 'locomotive';
    this.traction = data.traction || 'none';
    this.maxSpeed = data.maxSpeed || 160;
    // Robust defaults: a zero/null mass or tonnage breaks train physics.
    const defaultMass = this.category === 'wagon' ? 20 : (this.category === 'voiture' ? 30 : 80);
    this.mass = data.mass || data.tonnage || defaultMass; // tonnes (empty mass)
    this.power = data.power || ((this.category === 'locomotive' || this.category === 'automotrice') ? 1000 : 0); // kW
    this.passengerCapacity = data.passengerCapacity || 0;
    this.freightCapacity = data.freightCapacity || 0;
    // Annexe 7 : tonnage = masse à vide + capacité fret (wagons), sinon masse à vide.
    this.tonnage = data.tonnage || (this.category === 'wagon' ? this.mass + this.freightCapacity : this.mass);
    this.length = data.length || 20;
    this.imageData = data.imageData || null;
    // S12: Train identification
    this.seriesName = data.seriesName || ''; // e.g. 'BB 26000'
    this.numberStart = data.numberStart || 1;  // e.g. 26001
    this.notes = data.notes || ''; // description from MLG / source
    // Price rule: power × 1000 for locomotives/automotrices, capacity × 100 for wagons/coaches.
    if (data.purchasePrice) {
      this.purchasePrice = data.purchasePrice;
    } else if (this.category === 'locomotive' || this.category === 'automotrice') {
      this.purchasePrice = this.power * 1000;
    } else {
      this.purchasePrice = (this.passengerCapacity + this.freightCapacity) * 100;
    }
    this.cargoTypes = data.cargoTypes || []; // allowed cargo type keys (wagon only)
    this.wagonSubCategory = data.wagonSubCategory || ''; // Annexe 7
    this.isDrivingTrailer = data.isDrivingTrailer || false; // voiture-pilote: flip image in rame formation
    // Catalog bookkeeping: pristine catalog items are re-seeded from catalog-data.js
    // on every load, so they are NOT persisted to the save (keeps localStorage small).
    // Once a catalog item is edited, _edited is set and it IS persisted.
    this._catalog = !!data._catalog;
    this._edited = !!data._edited;
    this._source = data._source || null;
  }
}

export class RollingStockManager {
  constructor() {
    this.items = [];
    // Rame series numbering: global counter per series name (Annexe 8).
    this.seriesCounters = {};
  }

  add(data) {
    const item = new RollingStockItem(data);
    this.items.push(item);
    return item;
  }

  // Renvoie le prochain numéro d'instance pour une série donnée.
  // Ex: "BB26000" -> BB26001, BB26002... ; "BR186-XXX" -> BR186-1, BR186-2...
  nextSeriesNumber(seriesName) {
    if (!seriesName) return null;
    const m = seriesName.match(/^(.+?)(\d*)$/);
    const prefix = (m ? m[1] : seriesName).replace(/-XXX$/i, '-');
    const base = m && m[2] ? parseInt(m[2], 10) : null;
    let counter = this.seriesCounters[seriesName];
    if (counter == null) counter = base != null ? base : 0;
    counter += 1;
    this.seriesCounters[seriesName] = counter;
    return prefix + counter;
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
  }

  // Update an existing item in place (used by the "Modifier" feature).
  // Only overwrites provided fields; keeps id and any untouched fields.
  update(id, data) {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    const editable = ['name', 'category', 'traction', 'maxSpeed', 'tonnage', 'mass',
      'power', 'passengerCapacity', 'freightCapacity', 'length', 'imageData',
      'seriesName', 'numberStart', 'notes', 'purchasePrice', 'cargoTypes', 'wagonSubCategory', 'isDrivingTrailer'];
    for (const k of editable) {
      if (k in data && data[k] !== undefined) item[k] = data[k];
    }
    if (item._catalog) item._edited = true;
    return item;
  }

  getById(id) {
    return this.items.find(i => i.id === id);
  }

  getAll() {
    return this.items;
  }

  toSave() {
    // Skip pristine catalog items (re-seeded from catalog-data.js on load).
    return {
      items: this.items.filter(i => !(i._catalog && !i._edited)).map(i => ({
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
        seriesName: i.seriesName || '',
        numberStart: i.numberStart || 1,
        notes: i.notes || '',
        purchasePrice: i.purchasePrice || 0,
        cargoTypes: i.cargoTypes || [],
        wagonSubCategory: i.wagonSubCategory || '',
        isDrivingTrailer: i.isDrivingTrailer || false,
        _catalog: i._catalog || undefined,
        _edited: i._edited || undefined,
        _source: i._source || undefined,
      })),
      seriesCounters: { ...this.seriesCounters },
    };
  }

  loadFromSave(data) {
    this.items = [];
    const arr = Array.isArray(data) ? data : (data?.items || []);
    for (const d of arr) {
      this.items.push(new RollingStockItem(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextId) nextId = num + 1;
    }
    this.seriesCounters = (data && !Array.isArray(data) && data.seriesCounters) ? { ...data.seriesCounters } : {};
  }
}
