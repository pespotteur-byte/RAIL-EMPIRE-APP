import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CATALOG_CARGO_TYPES } from '../catalog-data.js';
import { CargoTypeManager } from '../cargo-types.js';
import { IndustrialClients } from '../industrial-clients.js';
import {
  BATCH186_FREIGHT_CARGO_TYPES,
  BATCH186_WAGON_FREIGHT_PATCH,
  applyBatch186FreightToCatalog,
  applyBatch186IndustryFreightPatch,
} from '../catalog-freight-batch186.js';

test('Batch186 freight cargo registry is complete', () => {
  const mgr = new CargoTypeManager();
  for (const ct of CATALOG_CARGO_TYPES) mgr.ensureType(ct.category, ct);
  for (const ct of BATCH186_FREIGHT_CARGO_TYPES) mgr.ensureType(ct.category, ct);
  assert.equal(BATCH186_FREIGHT_CARGO_TYPES.length, 44);
  assert.equal(mgr.getAllTypes().length, 185);
  for (const ct of BATCH186_FREIGHT_CARGO_TYPES) {
    const info = mgr.getTypeInfo(ct.type);
    assert.ok(info, `missing cargo ${ct.type}`);
    assert.ok(info.name && info.name !== ct.type, `missing French label for ${ct.type}`);
  }
});

test('Batch186 freight only changes the 75 validated wagon entries', () => {
  const patched = applyBatch186FreightToCatalog(CATALOG);
  assert.equal(patched.length, CATALOG.length);
  assert.deepEqual(patched.map(x => x.id), CATALOG.map(x => x.id));
  let changed = 0;
  for (let i = 0; i < CATALOG.length; i++) {
    if (patched[i] !== CATALOG[i]) {
      changed++;
      assert.ok(BATCH186_WAGON_FREIGHT_PATCH[CATALOG[i].id]);
    }
  }
  assert.equal(changed, 75);
});

test('Validated Rils, tank and hopper load rules replace generic over-permissive rules', () => {
  const byId = new Map(applyBatch186FreightToCatalog(CATALOG).map(x => [x.id, x]));
  assert.deepEqual(byId.get('cat-8577').cargoTypes, ['mineral-water-palletized']);
  assert.deepEqual(byId.get('cat-8578').cargoTypes, ['beer-palletized']);
  assert.deepEqual(byId.get('cat-8394').cargoTypes, ['wine-bulk']);
  assert.ok(byId.get('cat-8394').technicallyCompatibleCargoTypes.includes('grape-must-bulk'));
  assert.deepEqual(byId.get('cat-8726').cargoTypes, ['bauxite']);
  assert.ok(!byId.get('cat-8726').cargoTypes.includes('grain'));
  assert.deepEqual(byId.get('cat-8732').cargoTypes, ['soda-ash']);
});

test('Every enabled and technical-compatible cargo resolves in the game registry', () => {
  const mgr = new CargoTypeManager();
  for (const ct of CATALOG_CARGO_TYPES) mgr.ensureType(ct.category, ct);
  for (const ct of BATCH186_FREIGHT_CARGO_TYPES) mgr.ensureType(ct.category, ct);
  const byId = new Map(applyBatch186FreightToCatalog(CATALOG).map(x => [x.id, x]));
  for (const id of Object.keys(BATCH186_WAGON_FREIGHT_PATCH)) {
    const e = byId.get(id);
    assert.ok(e);
    for (const cargo of [...(e.cargoTypes || []), ...(e.technicallyCompatibleCargoTypes || [])]) {
      assert.ok(mgr.getTypeInfo(cargo), `${id}: unresolved cargo ${cargo}`);
    }
  }
});

test('Industry patch is idempotent and adds 5 validated industry types', () => {
  const ic = new IndustrialClients();
  const before = ic.getIndustryTypes().length;
  const first = applyBatch186IndustryFreightPatch(ic);
  const after = ic.getIndustryTypes().length;
  const second = applyBatch186IndustryFreightPatch(ic);
  assert.equal(first.added, 5);
  assert.equal(after, before + 5);
  assert.equal(second.added, 0);
  assert.equal(ic.getIndustryTypes().length, after);
  assert.ok(ic.getIndustryInfo('soda_plant').cargoTypes.includes('soda-ash'));
  assert.ok(ic.getIndustryInfo('refinery').cargoTypes.includes('bitumen'));
  assert.ok(ic.getIndustryInfo('brewery').cargoTypes.includes('beer-palletized'));
  assert.ok(ic.getIndustryInfo('logistics_hub').cargoTypes.includes('mineral-water-palletized'));
});
