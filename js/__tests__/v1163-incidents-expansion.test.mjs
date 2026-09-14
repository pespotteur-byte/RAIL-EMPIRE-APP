import test from 'node:test';
import assert from 'node:assert/strict';
import { PREDEFINED_INCIDENT_TYPES, IncidentManager } from '../incidents.js';
import { setGlobalRng } from '../rng.js?v=1784250033';

const byId = id => PREDEFINED_INCIDENT_TYPES.find(t => t.id === id);

function seqRng(values) {
  let i = 0;
  return { random() { return values[Math.min(i++, values.length - 1)] ?? 0; } };
}

const stations = [
  { id: 'A', name: 'Alpha', lat: 48.0000, lon: 2.0000 },
  { id: 'B', name: 'Bravo', lat: 48.0500, lon: 2.0500 },
];
const tracks = [{
  id: 'AB', name: 'Alpha — Bravo', stationA: 'A', stationB: 'B', electrified: true,
  route: [{ lat: 48.0000, lon: 2.0000 }, { lat: 48.0500, lon: 2.0500 }],
}];
const world = {
  stations, tracks,
  getStationById(id) { return stations.find(s => s.id === id) || null; },
};

test('incident catalogue keeps requested gameplay values with v1.1.75 train-target probability reduction', () => {
  const expected = {
    'obstacle-on-track': { p:15, min:30, max:120, effect:'stop', speed:0, scope:'station-or-track' },
    'track-incident': { p:15, min:15, max:30, effect:'stop', speed:0, scope:'track' },
    'people-on-track': { p:15, min:15, max:45, effect:'slow', speed:30, scope:'station-or-track' },
    'trackside-fire': { p:15, min:60, max:60, effect:'stop', speed:0, scope:'station-or-track' },
    'passenger-illness': { p:3, min:10, max:25, effect:'stop', speed:0, scope:'train' }, // v1.1.75: train-target weight /5
    'law-enforcement': { p:15, min:15, max:30, effect:'slow', speed:60, scope:'station' },
  };
  for (const [id, e] of Object.entries(expected)) {
    const t = byId(id);
    assert.ok(t, `missing ${id}`);
    assert.equal(t.probability, e.p, `${id} probability`);
    assert.equal(t.durationMin, e.min, `${id} min duration`);
    assert.equal(t.durationMax, e.max, `${id} max duration`);
    assert.equal(t.effect, e.effect, `${id} effect`);
    assert.equal(t.speedLimit, e.speed, `${id} speed`);
    assert.equal(t.scope, e.scope, `${id} scope`);
  }
  assert.equal(byId('passenger-illness').requireStopped, true);
  assert.equal(byId('law-enforcement').pureStation, true);
});

test('station-or-track incidents can target a pure station without closing the adjacent interstation track', () => {
  const m = new IncidentManager();
  setGlobalRng(seqRng([0.0, 0.0])); // pick station A + minimum duration
  m._spawnStationOrTrackIncident(byId('obstacle-on-track'), world);
  const inc = m.activeIncidents.at(-1);
  assert.equal(inc.stationA, 'A');
  assert.equal(inc.stationB, 'A');
  assert.equal(inc.duration, 30);
  assert.notEqual(tracks[0].incidentActive, true);
  setGlobalRng(null);
});

test('station-or-track incidents can target a real interstation segment and mark it affected', () => {
  delete tracks[0].incidentActive;
  delete tracks[0]._incidentIds;
  const m = new IncidentManager();
  setGlobalRng(seqRng([0.99, 0.0])); // pick sole track + minimum duration
  m._spawnStationOrTrackIncident(byId('trackside-fire'), world);
  const inc = m.activeIncidents.at(-1);
  assert.equal(inc.stationA, 'A');
  assert.equal(inc.stationB, 'B');
  assert.equal(inc.duration, 60);
  assert.equal(tracks[0].incidentActive, true);
  assert.equal(tracks[0].incidentEffect, 'stop');
  setGlobalRng(null);
});

test('law-enforcement is a true station-only 60 km/h incident', () => {
  const m = new IncidentManager();
  setGlobalRng(seqRng([0.0]));
  m._spawnPureStationIncident(byId('law-enforcement'), world, stations[0]);
  const inc = m.activeIncidents.at(-1);
  assert.equal(inc.stationA, 'A');
  assert.equal(inc.stationB, 'A');
  assert.equal(inc.speedLimit, 60);

  const svc = {
    id: 'S1', state: 'moving', position: { lat: 48.0000, lon: 2.0000 },
    train: { id: 'T1', incident: null },
    getCurrentStops() { return [{ stationId:'A' }, { stationId:'B' }]; },
    currentStopIndex: 1,
  };
  m.checkTrainPositions([svc], null, world);
  assert.equal(svc.train.incident?.effect, 'slow');
  assert.equal(svc.train.incident?.speedLimit, 60);
  setGlobalRng(null);
});

test('passenger illness only selects a train stopped at a station and lasts 10-25 minutes', () => {
  const m = new IncidentManager();
  const type = byId('passenger-illness');
  const moving = { id:'moving', state:'moving', position:{lat:48,lon:2}, train:{id:'TM'} };
  setGlobalRng(seqRng([0.0, 0.0]));
  m._spawnTrainIncident(type, [moving], 600, world);
  assert.equal(m.activeIncidents.length, 0);

  // RC20: a stopped-state flag alone is not a booked passenger call. Keep that
  // legacy fixture as a negative case, then supply the actual timetable/berth.
  const incomplete = { id:'incomplete', state:'stopped_at_station', position:{lat:48,lon:2}, train:{id:'TI'} };
  m._spawnTrainIncident(type, [incomplete], 600, world);
  assert.equal(m.activeIncidents.length, 0, 'unbooked stop must remain ineligible');
  const stopped = {
    id:'stopped', state:'stopped_at_station', position:{lat:48,lon:2}, speed:0,
    currentStopIndex:1, stops:[{stationId:'A', type:'arret'}, {stationId:'B', type:'arret'}],
    rame:{totalCapacity:120}, train:{id:'TS', stoppedAt:{id:'A'}},
  };
  m._spawnTrainIncident(type, [stopped], 600, world);
  assert.equal(m.activeIncidents.length, 1);
  assert.equal(m.activeIncidents[0].serviceId, 'stopped');
  assert.ok(m.activeIncidents[0].duration >= 10 && m.activeIncidents[0].duration <= 25);
  assert.equal(stopped.train.incident?.name, 'Malaise voyageur');
  setGlobalRng(null);
});

test('v1.1.63 FILE bundle contains all six new incident types and cache/version marker', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
  const bundle = fs.readFileSync(path.join(root, 'js', 'rail-empire.file.bundle.js'), 'utf8');
  for (const label of [
    'Obstacle sur les voies', 'Incident voie', 'Personnes sur les voies',
    'Incendie aux abords des voies', 'Malaise voyageur', "Intervention des forces de l\\'ordre"
  ]) assert.ok(bundle.includes(label), `bundle missing ${label}`);
  assert.ok(bundle.includes('FILE:// CORE bundle'));
});
