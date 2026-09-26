import test from 'node:test';
import assert from 'node:assert/strict';
import { IncidentManager, PREDEFINED_INCIDENT_TYPES } from '../incidents.js';
import { TrainCategory } from '../schedule-v2-model.js';
import { FormationMember, FormationRole } from '../rotation-v2-model.js';
import { makeGame, addValidSchedule } from './re-rc2-fixtures.mjs';

function fakeWorld() {
  return {
    stations: [],
    getStationById() { return null; },
    tracks: [],
    getTrackById() { return null; },
  };
}

function seedIncident(m, typeId, extra = {}) {
  const inc = {
    id: `inc-${typeId}-${m.activeIncidents.length}`,
    typeId, name: typeId, active: true, remaining: 30, duration: 60,
    stationA: 'S1', stationB: 'S1', effect: 'stop', serviceId: null, train: null,
    ...extra,
  };
  m.activeIncidents.push(inc);
  return inc;
}

test('FINAL1 unchecking an incident type purges its live instances immediately', () => {
  const m = new IncidentManager();
  const [t1, t2] = PREDEFINED_INCIDENT_TYPES;
  const train = { incident: null };
  const a = seedIncident(m, t1.id, { serviceId: 'svc', train });
  train.incident = a;
  seedIncident(m, t1.id);
  const keep = seedIncident(m, t2.id);
  assert.equal(m.activeIncidents.length, 3);
  assert.equal(m.toggleType(t1.id, false, fakeWorld()), true);
  assert.deepEqual(m.activeIncidents.map((i) => i.id), [keep.id]);
  assert.equal(a.active, false);
  assert.equal(train.incident, null, 'train reference is released');
  assert.ok(!m.enabledTypes.has(t1.id));
  assert.ok(m.enabledTypes.has(t2.id));
});

test('FINAL1 loading a save with disabled types purges stale incidents of those types', () => {
  const m = new IncidentManager();
  const [t1, t2] = PREDEFINED_INCIDENT_TYPES;
  seedIncident(m, t1.id);
  seedIncident(m, t2.id);
  m.setEnabledTypes([t2.id], 60, fakeWorld());
  assert.deepEqual(m.activeIncidents.map((i) => i.typeId), [t2.id]);
});

test('FINAL1 re-enabling a type keeps it spawnable without touching other incidents', () => {
  const m = new IncidentManager();
  const [t1, t2] = PREDEFINED_INCIDENT_TYPES;
  m.toggleType(t1.id, false, null);
  const keep = seedIncident(m, t2.id);
  m.toggleType(t1.id, true, null);
  assert.ok(m.enabledTypes.has(t1.id));
  assert.deepEqual(m.activeIncidents, [keep]);
});

let seq = 0;
function categoryIssues(game, category, vehicleSpecs) {
  const run = ++seq;
  const rec = addValidSchedule(game, { number: `C-${category}-${run}` });
  rec.currentVersion.category = category;
  const rot = game.rotationV2.addRotation({ name: `rot ${category}` });
  const occ = game.rotationV2.addOccurrence(rot.id, { scheduleId: rec.id, versionId: rec.currentVersion.id });
  occ.formation.members = vehicleSpecs.map((spec, i) => {
    const v = game.rotationV2.addVehicle({ number: `${category}-${run}-${i}`, name: spec.category, ...spec });
    const role = spec.powerW > 0 ? (i === 0 ? FormationRole.LEAD : FormationRole.ACTIVE_MULTIPLE) : (spec.category === 'wagon' ? FormationRole.WAGON : FormationRole.COACH);
    return new FormationMember({ vehicleId: v.id, role, order: i });
  });
  return game.rotationV2.validateRotation(rot.id).filter((i) => String(i.code).startsWith('CATEGORY_'));
}

const LOCO = { category: 'locomotive', traction: 'electric', powerW: 4000000, massKg: 90000, lengthM: 20 };
const COACH = { category: 'voiture', powerW: 0, massKg: 40000, lengthM: 26, passengerCapacity: 80 };
const WAGON = { category: 'wagon', powerW: 0, massKg: 80000, lengthM: 20, freightCapacity: 60 };
const AUTOMOTRICE = { category: 'automotrice', traction: 'electric', powerW: 2000000, massKg: 120000, lengthM: 80, passengerCapacity: 200 };

test('FINAL1 SC category rules — HLP is 1-2 tractions alone', () => {
  const game = makeGame();
  assert.deepEqual(categoryIssues(game, TrainCategory.HLP, [LOCO]), []);
  assert.deepEqual(categoryIssues(game, TrainCategory.HLP, [LOCO, LOCO]), []);
  assert.ok(categoryIssues(game, TrainCategory.HLP, [LOCO, LOCO, LOCO]).some((i) => i.code === 'CATEGORY_HLP_TOO_MANY' && i.level === 'ERROR'));
  assert.ok(categoryIssues(game, TrainCategory.HLP, [LOCO, COACH]).some((i) => i.code === 'CATEGORY_HLP_NOT_ALONE' && i.level === 'ERROR'));
});

test('FINAL1 SC category rules — TM is 3-12 tractions alone', () => {
  const game = makeGame();
  assert.deepEqual(categoryIssues(game, TrainCategory.TM, [LOCO, LOCO, LOCO]), []);
  assert.ok(categoryIssues(game, TrainCategory.TM, [LOCO, LOCO]).some((i) => i.code === 'CATEGORY_TM_TOO_FEW'));
  assert.ok(categoryIssues(game, TrainCategory.TM, Array(13).fill(LOCO)).some((i) => i.code === 'CATEGORY_TM_TOO_MANY'));
  assert.ok(categoryIssues(game, TrainCategory.TM, [LOCO, LOCO, LOCO, WAGON]).some((i) => i.code === 'CATEGORY_TM_NOT_ALONE'));
});

test('FINAL1 SC category rules — passenger/W reject wagons, freight rejects coaches', () => {
  const game = makeGame();
  assert.deepEqual(categoryIssues(game, TrainCategory.PASSENGER, [LOCO, COACH, COACH]), []);
  assert.deepEqual(categoryIssues(game, TrainCategory.PASSENGER, [AUTOMOTRICE]), []);
  assert.ok(categoryIssues(game, TrainCategory.PASSENGER, [LOCO, WAGON]).some((i) => i.code === 'CATEGORY_PASSENGER_HAS_WAGON' && i.level === 'ERROR'));
  assert.ok(categoryIssues(game, TrainCategory.W, [LOCO, WAGON]).some((i) => i.code === 'CATEGORY_PASSENGER_HAS_WAGON'));
  assert.deepEqual(categoryIssues(game, TrainCategory.FREIGHT, [LOCO, WAGON, WAGON]), []);
  assert.ok(categoryIssues(game, TrainCategory.FREIGHT, [LOCO, COACH]).some((i) => i.code === 'CATEGORY_FREIGHT_HAS_COACH' && i.level === 'ERROR'));
});

test('FINAL1 SC category rules — lone traction on passenger/freight is advisory only', () => {
  const game = makeGame();
  const pax = categoryIssues(game, TrainCategory.PASSENGER, [LOCO]);
  assert.ok(pax.some((i) => i.code === 'CATEGORY_PASSENGER_NO_CAPACITY'));
  assert.ok(pax.every((i) => i.level === 'WARNING'));
  const fret = categoryIssues(game, TrainCategory.FREIGHT, [LOCO]);
  assert.ok(fret.some((i) => i.code === 'CATEGORY_FREIGHT_NO_WAGON'));
  assert.ok(fret.every((i) => i.level === 'WARNING'));
  const ttx = categoryIssues(game, TrainCategory.TTX, [LOCO]);
  assert.ok(ttx.every((i) => i.level === 'WARNING'));
});
