let nextRameId = 1;

export class Rame {
  constructor(data) {
    this.id = data.id || `rame-${nextRameId++}`;
    this.serialNumber = data.serialNumber || ''; // DEP-03 : n° de série (optionnel, distinct de l'ID interne)
    this.name = data.name || 'Sans nom';
    this.elements = data.elements || []; // array of RollingStockItem ids
    this.elementDetails = data.elementDetails || []; // cached details
    this.createdDate = data.createdDate || new Date().toISOString().split('T')[0];
    this.totalKmRun = isFinite(data.totalKmRun) ? data.totalKmRun : 0;
    this.kmSinceLastMaint = isFinite(data.kmSinceLastMaint) ? data.kmSinceLastMaint : 0;
    this.wearLevel = isFinite(data.wearLevel) ? data.wearLevel : 0;
    this.inMaintenance = data.inMaintenance ?? false;
    this.depotId = data.depotId || '';
    // DEP-05 : localisation permanente de chaque engin
    this.currentLocation = data.currentLocation || {
      depotId: data.depotId || '',
      stationId: '',
      serviceId: '',
      lat: null,
      lon: null,
    };
  }

  get totalLength() {
    return this.elementDetails.reduce((s, e) => s + (e.length || 0), 0);
  }

  get totalTonnage() {
    return this.elementDetails.reduce((s, e) => s + (e.tonnage || 0), 0);
  }

  get totalCapacity() {
    return this.elementDetails.reduce((s, e) => s + (e.passengerCapacity || 0), 0);
  }

  get totalFreightCapacity() {
    return this.elementDetails.reduce((s, e) => {
      if (e.freightCapacity > 0) return s + e.freightCapacity;
      // Wagons fret: use tonnage as freight capacity if freightCapacity not set
      if (e.category === 'wagon') return s + (e.tonnage || 0);
      return s;
    }, 0);
  }

  get maxSpeed() {
    if (this.elementDetails.length === 0) return 0;
    return Math.min(...this.elementDetails.map(e => e.maxSpeed || 160));
  }

  get traction() {
    const tractors = this.elementDetails.filter(e =>
      e.category === 'locomotive' || e.category === 'automotrice'
    );
    if (tractors.length === 0) return 'none';
    const tractions = [...new Set(tractors.map(t => t.traction))];
    return tractions.join('+');
  }

  // Physics: total empty mass (tonnes)
  get totalMass() {
    return this.elementDetails.reduce((s, e) => s + (e.mass || e.tonnage || 0), 0);
  }

  // Physics: total power (kW) from traction units
  get totalPower() {
    return this.elementDetails
      .filter(e => e.category === 'locomotive' || e.category === 'automotrice')
      .reduce((s, e) => s + (e.power || 0), 0);
  }

  // Physics: total mass including payload estimate
  getTotalMassWithPayload(loadFactor = 0.7) {
    const passengerMass = this.totalCapacity * loadFactor * 0.08; // ~80kg per passenger
    const freightMass = this.totalFreightCapacity * loadFactor;
    return this.totalMass + passengerMass + freightMass;
  }

  get isValid() {
    return this.totalLength <= 750 && this.elementDetails.length > 0;
  }
}

export class RameManager {
  constructor() {
    this.rames = [];
  }

  add(data) {
    const rame = new Rame(data);
    this.rames.push(rame);
    return rame;
  }

  remove(id) {
    this.rames = this.rames.filter(r => r.id !== id);
  }

  getById(id) {
    return this.rames.find(r => r.id === id);
  }

  getAll() {
    return this.rames;
  }

  toSave() {
    return this.rames.map(r => ({
      id: r.id,
      serialNumber: r.serialNumber,
      name: r.name,
      elements: r.elements,
      elementDetails: r.elementDetails,
      createdDate: r.createdDate,
      totalKmRun: r.totalKmRun,
      kmSinceLastMaint: r.kmSinceLastMaint,
      wearLevel: r.wearLevel,
      inMaintenance: r.inMaintenance,
      depotId: r.depotId,
      currentLocation: r.currentLocation,
    }));
  }

  loadFromSave(arr) {
    this.rames = [];
    for (const d of arr) {
      this.rames.push(new Rame(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextRameId) nextRameId = num + 1;
    }
  }
}
