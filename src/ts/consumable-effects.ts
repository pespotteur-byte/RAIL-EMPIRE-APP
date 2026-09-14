/** RC10 gameplay rules, not manufacturer fuel/maintenance specifications. */
type RecordValue = Record<string, unknown>;
type ResourceKey = 'fuelCapacityL' | 'fuelL' | 'sandCapacityKg' | 'sandKg' | 'oilCapacityL' | 'oilL' |
  'coolantCapacityL' | 'coolantL' | 'adblueCapacityL' | 'adblueL' | 'gearboxOilCapacityL' | 'gearboxOilL' |
  'hydraulicOilCapacityL' | 'hydraulicOilL' | 'washerCapacityL' | 'washerL';
type Consumables = Partial<Record<ResourceKey, number>>;
type Material = { totalPower?: number; traction?: string; totalCapacity?: number;
  consumables?: Consumables; cleanliness?: { exterior?: unknown; interior?: unknown };
  elementDetails?: readonly RecordValue[] };
type Section = { electrified?: unknown; voltage?: readonly unknown[]; frequency?: readonly unknown[] };
export type ResourceEffects = { powerW: number; fuelUnits: number; poweredUnits: number;
  tractionFactor: number; speedCap: number; stopReason: string; warnings: string[] };
const nonNegative = (v: unknown, fallback = 0): number => {
  const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : fallback;
};
const pct = (v: unknown): number => Math.min(100, v == null ? 100 : nonNegative(v, 100));
const wet = (weather: string): boolean => ['light_rain', 'rain', 'heavy_rain', 'storm', 'snow'].includes(weather);
const thermal = (traction: string): boolean => /diesel|therm|gazole|bimode|hybrid/i.test(traction);
const electric = (traction: string): boolean => /electric|électri|electri|kv|rail|bimode|hybrid/i.test(traction);
function depleted(c: Consumables, capacity: ResourceKey, quantity: ResourceKey): boolean {
  const cap = nonNegative(c[capacity]);
  return cap > 0 && c[quantity] != null && nonNegative(c[quantity], cap) <= 0;
}
function compatible(section: Section, detail: RecordValue): boolean {
  if (section.electrified === false) return false;
  const systems = Array.isArray(detail.electricSystems) ? detail.electricSystems : [];
  const volts = (section.voltage ?? []).map(Number).filter(v => Number.isFinite(v) && v > 0);
  if (!volts.length || !systems.length) return true; // unknown is not an invented incompatibility
  // Missing frequency is unknown, not an invented 0 Hz (DC) restriction.
  const frequencies = (section.frequency ?? []).filter(f => f != null && f !== '').map(Number).filter(Number.isFinite);
  return systems.some((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return false;
    const s = raw as RecordValue;
    return volts.some(v => Math.abs(v - Number(s.voltage)) <= Math.max(100, v * 0.1)) &&
      (!frequencies.length || frequencies.some(f => Math.abs(f - Number(s.frequency ?? 0)) <= 1));
  });
}

/** Pure and live: refuelling or a consist edit takes effect on the next tick. */
export function materialResourceEffects(rame: Material | null | undefined, section: Section = {}, weather = 'clear'): ResourceEffects {
  const c = rame?.consumables ?? {}, warnings: string[] = [];
  const dryFuel = depleted(c, 'fuelCapacityL', 'fuelL');
  const dryOil = depleted(c, 'oilCapacityL', 'oilL');
  const dryCoolant = depleted(c, 'coolantCapacityL', 'coolantL');
  const dryTransmission = depleted(c, 'gearboxOilCapacityL', 'gearboxOilL');
  const dryHydraulics = depleted(c, 'hydraulicOilCapacityL', 'hydraulicOilL');
  const dryAdblue = depleted(c, 'adblueCapacityL', 'adblueL');
  const drySand = depleted(c, 'sandCapacityKg', 'sandKg');
  const dryWasher = depleted(c, 'washerCapacityL', 'washerL');
  const dieselBlock = dryFuel ? 'Gazole épuisé — avitaillement requis' : dryOil ? 'Huile moteur épuisée — entretien requis' :
    dryCoolant ? 'Liquide de refroidissement épuisé — entretien requis' : '';
  const commonBlock = dryTransmission ? 'Huile de transmission épuisée — entretien requis' :
    dryHydraulics ? 'Fluide hydraulique épuisé — entretien requis' : '';
  let powerW = 0, fuelUnits = 0, poweredUnits = 0, resourceBlockedPower = false;
  const details = rame?.elementDetails ?? [];
  const powered = details.filter(d => ['locomotive', 'automotrice'].includes(String(d.category)) && nonNegative(d.power) > 0);
  const units: readonly RecordValue[] = powered.length ? powered : [{ traction: rame?.traction ?? 'none', power: rame?.totalPower ?? 0 }];
  for (const d of units) {
    const installed = nonNegative(d.power) * 1000;
    if (!installed) continue;
    poweredUnits++;
    const traction = String(d.traction ?? rame?.traction ?? ''), diesel = thermal(traction), isElectric = electric(traction) && (!diesel || /bimode|hybrid/i.test(traction));
    const onWire = isElectric && compatible(section, d);
    let available = 0;
    if (commonBlock) resourceBlockedPower = true;
    else if (onWire) available = installed;
    else if (diesel) {
      if (dieselBlock) resourceBlockedPower = true;
      else { available = installed * (dryAdblue ? 0.5 : 1); fuelUnits++; }
    } else if (!isElectric) available = installed; // steam / unknown legacy traction, no fictitious diesel tank
    powerW += available;
  }
  if (dieselBlock) warnings.push(dieselBlock);
  if (commonBlock) warnings.push(commonBlock);
  if (dryAdblue) warnings.push('AdBlue épuisé : puissance thermique réduite à 50 % (règle de jeu)');
  if (drySand) warnings.push('Sable épuisé : traction réduite sur rail humide');
  if (dryWasher) warnings.push('Lave-glace épuisé : vitesse limitée à 80 km/h par précipitations');
  return { powerW, fuelUnits, poweredUnits,
    tractionFactor: drySand && wet(weather) ? 0.7 : 1,
    speedCap: dryWasher && wet(weather) ? 80 : Infinity,
    stopReason: powerW <= 0 && resourceBlockedPower ? (commonBlock || dieselBlock) : '', warnings };
}

/** Consumption follows actual distance and the active traction mode only. */
export function consumeMaterialResources(rame: Material | null | undefined, distKm: number, section: Section = {}): void {
  if (!rame || !Number.isFinite(distKm) || distKm <= 0) return;
  const effects = materialResourceEffects(rame, section), c = rame.consumables;
  if (rame.cleanliness) {
    rame.cleanliness.exterior = Math.max(0, pct(rame.cleanliness.exterior) - distKm * 0.004);
    if (nonNegative(rame.totalCapacity) > 0) rame.cleanliness.interior = Math.max(0, pct(rame.cleanliness.interior) - distKm * 0.006);
  }
  if (!c) return;
  const use = (capacity: ResourceKey, quantity: ResourceKey, perKm: number): void => {
    const cap = nonNegative(c[capacity]);
    if (cap > 0 && perKm > 0) c[quantity] = Math.max(0, Math.min(cap, c[quantity] == null ? cap : nonNegative(c[quantity], cap)) - distKm * perKm);
  };
  use('fuelCapacityL', 'fuelL', 1.8 * effects.fuelUnits);
  use('oilCapacityL', 'oilL', 0.0012 * effects.fuelUnits);
  use('coolantCapacityL', 'coolantL', 0.0008 * effects.fuelUnits);
  use('adblueCapacityL', 'adblueL', 0.08 * effects.fuelUnits);
  use('gearboxOilCapacityL', 'gearboxOilL', 0.0005 * effects.poweredUnits);
  use('hydraulicOilCapacityL', 'hydraulicOilL', 0.00025 * effects.poweredUnits);
  use('sandCapacityKg', 'sandKg', 0.018 * effects.poweredUnits);
  use('washerCapacityL', 'washerL', 0.0008);
}

export function passengerCleanlinessPenalty(rame: Material | null | undefined): number {
  return ((100 - pct(rame?.cleanliness?.interior)) * 0.9 + (100 - pct(rame?.cleanliness?.exterior)) * 0.1) * 0.3;
}
export function passengerSatisfactionScore(rame: Material | null | undefined, delayMinutes: unknown, stationBonus: unknown): number {
  return Math.max(0, Math.min(100, 85 - passengerCleanlinessPenalty(rame) - Math.min(30, nonNegative(delayMinutes) * 0.5) + nonNegative(stationBonus) * 100));
}
