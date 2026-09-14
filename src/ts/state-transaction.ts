/** Short-lived undo journal for synchronous hydration. Preserves object identity,
 * Maps/Sets and aliased model references if any loader throws. Never used per frame.
 * Host objects (DOM, workers, promises, databases) are deliberately not traversed.
 */
type Entry = { target: object; descriptors: PropertyDescriptorMap; map?: Array<[unknown, unknown]>; set?: unknown[]; date?: number };
export class StateTransaction {
  private entries: Entry[] = [];
  private seen = new Set<object>();
  captureRoot(target: object, descend = true): void {
    if (this.seen.has(target)) return;
    this.seen.add(target);
    const tag = Object.prototype.toString.call(target);
    if (!['[object Object]', '[object Array]', '[object Map]', '[object Set]', '[object Date]'].includes(tag)) return;
    const descriptors = Object.getOwnPropertyDescriptors(target);
    const entry: Entry = { target, descriptors };
    if (target instanceof Map) entry.map = Array.from(target.entries());
    if (target instanceof Set) entry.set = Array.from(target.values());
    if (target instanceof Date) entry.date = target.getTime();
    this.entries.push(entry);
    if (!descend) return;
    const visit = (value: unknown) => { if (value && typeof value === 'object') this.captureRoot(value); };
    for (const key of Reflect.ownKeys(target)) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && 'value' in descriptor) visit(descriptor.value);
    }
    for (const [key, value] of entry.map || []) { visit(key); visit(value); }
    for (const value of entry.set || []) visit(value);
  }
  rollback(): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (entry.map && entry.target instanceof Map) { entry.target.clear(); for (const [k,v] of entry.map) entry.target.set(k,v); }
      if (entry.set && entry.target instanceof Set) { entry.target.clear(); for (const v of entry.set) entry.target.add(v); }
      if (entry.date !== undefined && entry.target instanceof Date) entry.target.setTime(entry.date);
      for (const key of Reflect.ownKeys(entry.target)) if (!Object.prototype.hasOwnProperty.call(entry.descriptors,key)) Reflect.deleteProperty(entry.target,key);
      // Array length is installed last so deleted elements are restored correctly.
      const { length, ...rest } = entry.descriptors;
      Object.defineProperties(entry.target, rest);
      if (length) Object.defineProperty(entry.target, 'length', length);
    }
    this.release();
  }
  release(): void { this.entries.length = 0; this.seen.clear(); }
  get objectCount(): number { return this.entries.length; }
}

export type SaveDocument = Record<string, unknown>;
/** Reject incompatible containers BEFORE touching any live state. Missing legacy
 * sections remain supported; existing model loaders retain their domain checks. */
export function validateSaveDocument(input: unknown): asserts input is SaveDocument {
  const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!record(input)) throw new Error('La sauvegarde doit être un objet JSON.');
  if ('companyName' in input && (typeof input.companyName !== 'string' || !input.companyName.trim())) throw new Error('Nom de compagnie invalide.');
  const objectSections = ['gameplayClock','physicsClock','realism','economy','world','scheduleV2','rotationsV2','v2Runtime','incidentCadence','liveries'];
  for (const key of objectSections) if (input[key] != null && !record(input[key])) throw new Error(`${key} : objet attendu.`);
  const arrays = (value: unknown, keys: string[], label: string) => {
    if (!record(value)) return;
    for (const key of keys) if (value[key] != null && !Array.isArray(value[key])) throw new Error(`${label}.${key} : liste attendue.`);
  };
  arrays(input.world,['nativeRefs','stations','tracks','removedBuiltInStations', 'builtInRemoved'],'world');
  arrays(input.scheduleV2,['schedules','calendars','roundTrips','technicalLocations'],'scheduleV2');
  arrays(input.rotationsV2,['vehicles','coupons','rotations','directAssignments'],'rotationsV2');
  arrays(input.v2Runtime,['services'],'v2Runtime');
  for (const key of ['activeIncidents','incidentEnabledTypes']) if (input[key] != null && !Array.isArray(input[key])) throw new Error(`${key} : liste attendue.`);
  if (record(input.incidentCadence) && input.incidentCadence.schemaVersion !== 1) throw new Error('Cadence incidents : schéma incompatible');
}
