import test from 'node:test';
import assert from 'node:assert/strict';
import { RollingStockManager } from '../rolling-stock.js';
import { RameManager } from '../rame.js';

test('rolling-stock update cannot reintroduce powered coaches or non-finite values', () => {
  const m = new RollingStockManager();
  const coach = m.add({ id:'coach-1', name:'Coach', category:'voiture', traction:'electric', power:2200, maxSpeed:160, mass:40, length:26.4 });
  assert.equal(coach.power, 0);
  assert.equal(coach.traction, 'none');
  m.update('coach-1', { power:'Infinity', traction:'electric', maxSpeed:'NaN', passengerCapacity:-5 });
  assert.equal(coach.power, 0);
  assert.equal(coach.traction, 'none');
  assert.equal(coach.maxSpeed, 160);
  assert.equal(coach.passengerCapacity, 0);
});

test('explicit zero power survives update/save/load for an unpowered automotrice component', () => {
  const m = new RollingStockManager();
  m.add({ id:'zr-1', name:'ZR', category:'automotrice', traction:'electric', power:0, maxSpeed:160, mass:50, length:25.1 });
  m.update('zr-1', { notes:'remorque' });
  assert.equal(m.getById('zr-1').power, 0);
  const saved = m.toSave();
  const m2 = new RollingStockManager();
  m2.loadFromSave(saved);
  assert.equal(m2.getById('zr-1').power, 0);
});

test('rolling-stock manager rejects duplicate explicit ids', () => {
  const m = new RollingStockManager();
  assert.ok(m.add({ id:'dup', name:'A' }));
  assert.equal(m.add({ id:'dup', name:'B' }), null);
  assert.equal(m.getAll().length, 1);
  assert.equal(m.getById('dup').name, 'A');
});

test('corrupt stock cannot poison Rame physical totals with NaN/Infinity', () => {
  const stock = new RollingStockManager();
  stock.loadFromSave({items:[
    {id:'l', category:'locomotive', power:'Infinity', mass:'NaN', tonnage:'NaN', maxSpeed:'NaN', length:'Infinity'},
    {id:'w', category:'wagon', power:999, traction:'electric', freightCapacity:'Infinity', mass:20, maxSpeed:100, length:12},
  ]});
  const rm = new RameManager();
  rm.loadFromSave([{id:'r1', name:'R', elements:['l','w']}], stock);
  const r = rm.getById('r1');
  for (const v of [r.totalMass, r.totalPower, r.totalLength, r.totalFreightCapacity, r.maxSpeed]) {
    assert.ok(Number.isFinite(v), `expected finite value, got ${v}`);
    assert.ok(v >= 0);
  }
  assert.equal(stock.getById('w').power, 0);
  assert.equal(stock.getById('w').traction, 'none');
});
