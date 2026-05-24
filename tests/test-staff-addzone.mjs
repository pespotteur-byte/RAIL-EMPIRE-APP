/**
 * Unit tests for StaffManager.addZone and related logic.
 * Run with: node tests/test-staff-addzone.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Minimal stub so the module can load without DOM/browser
globalThis.window = {};
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {} }), body: { appendChild() {} }, addEventListener() {} };

const { StaffManager } = await import('../js/staff.js');

test('addZone stores lat/lon/radiusKm correctly', () => {
  const sm = new StaffManager();
  const z = sm.addZone('TestZone', 48.8, 2.35, 25);
  assert.equal(z.name, 'TestZone');
  assert.equal(z.lat, 48.8);
  assert.equal(z.lon, 2.35);
  assert.equal(z.radiusKm, 25);
  assert.equal(sm.zones.length, 1);
});

test('addZone handles lat=0 and lon=0 without treating as falsy', () => {
  const sm = new StaffManager();
  const z = sm.addZone('Equator', 0, 0, 10);
  assert.equal(z.lat, 0, 'lat=0 should be stored as 0, not null');
  assert.equal(z.lon, 0, 'lon=0 should be stored as 0, not null');
});

test('addZone defaults radiusKm to 30 when not provided', () => {
  const sm = new StaffManager();
  const z = sm.addZone('NoRadius', 45, 3);
  assert.equal(z.radiusKm, 30);
});

test('addZone defaults lat/lon to null when not provided', () => {
  const sm = new StaffManager();
  const z = sm.addZone('NoCoords');
  assert.equal(z.lat, null);
  assert.equal(z.lon, null);
});

test('addZone generates unique ids', () => {
  const sm = new StaffManager();
  const z1 = sm.addZone('A', 1, 2, 5);
  const z2 = sm.addZone('B', 3, 4, 5);
  assert.notEqual(z1.id, z2.id);
});

test('addZone auto-names zones when name is empty', () => {
  const sm = new StaffManager();
  const z = sm.addZone('', 10, 20, 5);
  assert.ok(z.name.startsWith('Zone'), `Expected auto-name, got: ${z.name}`);
});

test('removeZone unassigns staff and removes zone', () => {
  const sm = new StaffManager();
  const z = sm.addZone('ToRemove', 1, 2, 5);
  sm.staff.push({ id: 'staff-1', role: 'regulateur', assignedTo: z.id });
  sm.staff.push({ id: 'staff-2', role: 'controleur', assignedTo: z.id });
  sm.removeZone(z.id);
  assert.equal(sm.zones.length, 0);
  assert.equal(sm.staff[0].assignedTo, null);
  assert.equal(sm.staff[1].assignedTo, null);
});
