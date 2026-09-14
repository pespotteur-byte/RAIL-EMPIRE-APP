let nextId = 1;

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}
function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function nonNegative(value: unknown, fallback = 0): number { return Math.max(0, finite(value, fallback)); }
function positive(value: unknown, fallback: number): number { const n = finite(value, fallback); return n > 0 ? n : fallback; }
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(v => text(v)).filter(Boolean))] : [];
}
function mlgPathCategory(path: unknown = ''): string {
  const parts = text(path).split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

export class RollingStockItem {
  [key: string]: unknown;
  id: string; name: string; category: string; traction: string; maxSpeed: number; mass: number; power: number;
  passengerCapacity: number; freightCapacity: number; tonnage: number; length: number; imageData: unknown; seriesName: string;
  numberStart: number; notes: string; purchasePrice: number; cargoTypes: string[]; technicallyCompatibleCargoTypes: string[];
  freightValidationSource: string; freightValidationScope: string; freightBatch: string; wagonSubCategory: string; isDrivingTrailer: boolean;
  _catalog: boolean; _edited: boolean; _source: unknown; realIdentityId: string; realIdentitySeries: string; identityDisposition: string;
  identitySource: string; identityScope: string; identityConfidence: string; identityCountry: string; identityOperator: string;
  identityMatchMethod: string; identityBatch: string; mlgId: string; mlgArchivePath: string; mlgSeriesName: string; mlgPathCategory: string;
  mlgCategory: string; componentRole: string; technicalDataStatus: string; technicalDataNote: string; catalogExpansionBatch: string;
  purchasePriceBasis: string; purchasePriceClass: string; purchasePriceNote: string;
  constructor(data: Record<string, unknown> = {}) {
    const rawId = text(data.id);
    this.id = rawId || `stock-${nextId++}`;
    this.name = text(data.name, 'Sans nom');
    this.category = text(data.category, 'locomotive').toLowerCase();
    this.traction = text(data.traction, 'none');
    this.maxSpeed = positive(data.maxSpeed, 160);
    // A zero/negative mass or length is physically impossible, so those two fields
    // deliberately fall back. Explicit zero POWER/CAPACITY values, however, are real
    // data (e.g. unpowered EMU trailers) and must NEVER be replaced by defaults.
    const defaultMass = this.category === 'wagon' ? 20 : (this.category === 'voiture' ? 30 : 80);
    const rawMass = finite(data.mass, NaN);
    const rawTonnage = finite(data.tonnage, NaN);
    this.mass = Number.isFinite(rawMass) && rawMass > 0 ? rawMass
      : (Number.isFinite(rawTonnage) && rawTonnage > 0 ? rawTonnage : defaultMass);
    const defaultPower = (this.category === 'locomotive' || this.category === 'automotrice') ? 1000 : 0;
    this.power = Object.prototype.hasOwnProperty.call(data, 'power') ? nonNegative(data.power, 0) : defaultPower;
    // A coach/wagon is never an active traction unit in the RE component model.
    // Historical catalogue pollution used to inject locomotive power into Corail and
    // other unpowered vehicles; enforce the invariant at the model boundary so admin
    // overrides and old saves cannot re-introduce it.
    if (this.category === 'wagon' || this.category === 'voiture') {
      this.power = 0;
      this.traction = 'none';
    }
    this.passengerCapacity = nonNegative(data.passengerCapacity, 0);
    this.freightCapacity = nonNegative(data.freightCapacity, 0);
    // Historical saves use "tonnage" inconsistently. Preserve a valid explicit value;
    // otherwise derive a gameplay total only for wagons.
    this.tonnage = Number.isFinite(rawTonnage) && rawTonnage > 0
      ? rawTonnage
      : (this.category === 'wagon' ? this.mass + this.freightCapacity : this.mass);
    this.length = positive(data.length, 20);
    this.imageData = data.imageData || null;
    this.seriesName = text(data.seriesName);
    this.numberStart = finite(data.numberStart, 1);
    this.notes = text(data.notes);

    if (Object.prototype.hasOwnProperty.call(data, 'purchasePrice')) {
      this.purchasePrice = nonNegative(data.purchasePrice, 0);
    } else if (this.category === 'locomotive' || this.category === 'automotrice') {
      this.purchasePrice = this.power * 1000;
    } else {
      this.purchasePrice = (this.passengerCapacity + this.freightCapacity) * 100;
    }
    this.cargoTypes = stringArray(data.cargoTypes);
    this.technicallyCompatibleCargoTypes = stringArray(data.technicallyCompatibleCargoTypes);
    this.freightValidationSource = text(data.freightValidationSource);
    this.freightValidationScope = text(data.freightValidationScope);
    this.freightBatch = text(data.freightBatch);
    this.wagonSubCategory = text(data.wagonSubCategory);
    this.isDrivingTrailer = !!data.isDrivingTrailer;
    this._catalog = !!data._catalog;
    this._edited = !!data._edited;
    this._source = data._source || null;
    this.realIdentityId = text(data.realIdentityId);
    this.realIdentitySeries = text(data.realIdentitySeries);
    this.identityDisposition = text(data.identityDisposition);
    this.identitySource = text(data.identitySource);
    this.identityScope = text(data.identityScope);
    this.identityConfidence = text(data.identityConfidence);
    this.identityCountry = text(data.identityCountry);
    this.identityOperator = text(data.identityOperator);
    this.identityMatchMethod = text(data.identityMatchMethod);
    this.identityBatch = text(data.identityBatch);
    this.mlgId = text(data.mlgId);
    this.mlgArchivePath = text(data.mlgArchivePath);
    this.mlgSeriesName = text(data.mlgSeriesName);
    // Search-oriented MLG metadata. Older catalogue rows do not carry explicit
    // categories, so the archive path is exposed as a deterministic fallback.
    this.mlgPathCategory = text(data.mlgPathCategory, mlgPathCategory(this.mlgArchivePath));
    this.mlgCategory = text(data.mlgCategory, this.mlgPathCategory.split('/').pop() || '');
    this.componentRole = text(data.componentRole);
    this.technicalDataStatus = text(data.technicalDataStatus, 'LEGACY_CATALOG');
    this.technicalDataNote = text(data.technicalDataNote);
    this.catalogExpansionBatch = text(data.catalogExpansionBatch);
    this.purchasePriceBasis = text(data.purchasePriceBasis);
    this.purchasePriceClass = text(data.purchasePriceClass);
    this.purchasePriceNote = text(data.purchasePriceNote);
  }
}

export class RollingStockManager {
  items: RollingStockItem[];
  _byId: Map<string, RollingStockItem>;
  seriesCounters: Record<string, number>;
  constructor() {
    this.items = [];
    // v1.1.99 HOTFIX41 — catalogue loads can contain 36k+ rows. The historical
    // manager searched the whole array twice on every add(), turning a full seed
    // into O(n²). Keep a canonical id index so add/getById are O(1).
    this._byId = new Map();
    // Rame series numbering: global counter per series name (Annexe 8).
    this.seriesCounters = {};
  }

  add(data: Record<string, unknown> = {}): RollingStockItem | null {
    const explicitId = text(data?.id);
    if (explicitId && this._byId.has(explicitId)) return null;
    const item = new RollingStockItem(data);
    // Generated ids are expected to be unique, but keep the manager fail-closed if a
    // malformed save or counter collision ever violates that assumption.
    if (this._byId.has(item.id)) return null;
    this.items.push(item);
    this._byId.set(item.id, item);
    return item;
  }

  // Renvoie le prochain numéro d'instance pour une série donnée.
  // Ex: "BB26000" -> BB26001, BB26002... ; "BR186-XXX" -> BR186-1, BR186-2...
  nextSeriesNumber(seriesName: string): string | null {
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

  remove(id: unknown): boolean {
    const key = text(id);
    if (!this._byId.has(key)) return false;
    this._byId.delete(key);
    const idx = this.items.findIndex((i: RollingStockItem) => i.id === key);
    if (idx >= 0) this.items.splice(idx, 1);
    return true;
  }

  // Update through RollingStockItem again so edits/admin overrides cannot bypass
  // numeric sanitisation or physical invariants. `markEdited:false` is reserved for
  // authoritative admin catalogue refreshes; normal player edits keep the old flag.
  update(id: unknown, data: Record<string, unknown> = {}, { markEdited = true }: { markEdited?: boolean } = {}): RollingStockItem | null {
    const item = this._byId.get(text(id));
    if (!item || !data || typeof data !== 'object') return null;
    const editable = ['name', 'category', 'traction', 'maxSpeed', 'tonnage', 'mass',
      'power', 'passengerCapacity', 'freightCapacity', 'length', 'imageData',
      'seriesName', 'numberStart', 'notes', 'purchasePrice', 'cargoTypes', 'technicallyCompatibleCargoTypes', 'freightValidationSource', 'freightValidationScope', 'freightBatch', 'wagonSubCategory', 'isDrivingTrailer', 'mlgId', 'mlgArchivePath', 'mlgSeriesName', 'mlgCategory', 'mlgPathCategory', 'componentRole',
      'realIdentityId', 'realIdentitySeries', 'identityDisposition', 'identitySource', 'identityScope', 'identityConfidence', 'identityCountry', 'identityOperator', 'identityMatchMethod', 'identityBatch',
      'technicalDataStatus', 'technicalDataNote', 'catalogExpansionBatch', 'purchasePriceBasis', 'purchasePriceClass', 'purchasePriceNote'];
    const merged: Record<string, unknown> = {};
    for (const k of editable) merged[k] = item[k];
    for (const k of editable) if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) merged[k] = data[k];
    merged.id = item.id;
    merged._catalog = item._catalog;
    merged._edited = item._edited;
    merged._source = item._source;
    const clean = new RollingStockItem(merged);
    for (const k of editable) item[k] = clean[k];
    if (item._catalog && markEdited) item._edited = true;
    return item;
  }

  getById(id: unknown): RollingStockItem | undefined {
    return this._byId.get(text(id));
  }

  getAll(): RollingStockItem[] {
    return this.items;
  }

  toSave(): Record<string, unknown> {
    // Skip pristine catalog items (re-seeded from catalog-data.js on load).
    return {
      items: this.items.filter((i: RollingStockItem) => !(i._catalog && !i._edited)).map((i: RollingStockItem) => ({
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
        technicallyCompatibleCargoTypes: i.technicallyCompatibleCargoTypes || [],
        freightValidationSource: i.freightValidationSource || undefined,
        freightValidationScope: i.freightValidationScope || undefined,
        freightBatch: i.freightBatch || undefined,
        wagonSubCategory: i.wagonSubCategory || '',
        isDrivingTrailer: i.isDrivingTrailer || false,
        _catalog: i._catalog || undefined,
        _edited: i._edited || undefined,
        _source: i._source || undefined,
        realIdentityId: i.realIdentityId || undefined,
        realIdentitySeries: i.realIdentitySeries || undefined,
        identityDisposition: i.identityDisposition || undefined,
        identitySource: i.identitySource || undefined,
        identityScope: i.identityScope || undefined,
        identityConfidence: i.identityConfidence || undefined,
        identityCountry: i.identityCountry || undefined,
        identityOperator: i.identityOperator || undefined,
        identityMatchMethod: i.identityMatchMethod || undefined,
        identityBatch: i.identityBatch || undefined,
        mlgId: i.mlgId || undefined,
        mlgArchivePath: i.mlgArchivePath || undefined,
        mlgSeriesName: i.mlgSeriesName || undefined,
        mlgCategory: i.mlgCategory || undefined,
        mlgPathCategory: i.mlgPathCategory || undefined,
        componentRole: i.componentRole || undefined,
        technicalDataStatus: i.technicalDataStatus || undefined,
        technicalDataNote: i.technicalDataNote || undefined,
        catalogExpansionBatch: i.catalogExpansionBatch || undefined,
        purchasePriceBasis: i.purchasePriceBasis || undefined,
        purchasePriceClass: i.purchasePriceClass || undefined,
        purchasePriceNote: i.purchasePriceNote || undefined,
      })),
      seriesCounters: { ...this.seriesCounters },
    };
  }

  loadFromSave(data: unknown): void {
    const saved = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
    this.items = [];
    this._byId = new Map();
    const arr = Array.isArray(data) ? data : (Array.isArray(saved?.items) ? saved.items : []);
    const seen = new Set();
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const item = new RollingStockItem(raw);
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      this.items.push(item);
      this._byId.set(item.id, item);
      const m = /^stock-(\d+)$/.exec(item.id);
      const num = m ? Number(m[1]) : 0;
      if (num >= nextId) nextId = num + 1;
    }
    this.seriesCounters = {};
    const rawCounters = saved?.seriesCounters;
    const counters = rawCounters && typeof rawCounters === 'object' && !Array.isArray(rawCounters) ? rawCounters as Record<string, unknown> : {};
    for (const [series, value] of Object.entries(counters)) {
      const key = text(series);
      const n = Math.floor(nonNegative(value, 0));
      if (key) this.seriesCounters[key] = n;
    }
  }
}
