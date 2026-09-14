import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IncidentManager, PREDEFINED_INCIDENT_TYPES } from '../incidents.js';

const trainBreakdown = PREDEFINED_INCIDENT_TYPES.find(t => t.id === 'train-breakdown');
const world = {
  stations: [
    {id:'A',name:'Paris Gare de l’Est',lat:48.876,lon:2.359},
    {id:'B',name:'Pantin',lat:48.897,lon:2.400},
  ],
  tracks: [],
  getStationById(id){ return this.stations.find(s => s.id === id) || null; }
};

test('HOTFIX39 train incident stores display train name and exact start minute in station', () => {
  const m = new IncidentManager();
  const svc = {
    id:'svc-445', name:'445', state:'stopped_at_station', position:{lat:48.897,lon:2.400},
    train:{id:'train-445',stoppedAt:'B'}, stops:[{stationId:'A'},{stationId:'B'}], currentStopIndex:1,
  };
  const inc = m._spawnTrainIncident(trainBreakdown, [svc], 19*60+34, world);
  assert.ok(inc);
  assert.equal(inc.trainName, '445');
  assert.equal(inc.startTime, 1174);
  assert.equal(inc.locationText, 'à Pantin');
  assert.equal(inc.stationA, 'B');
  assert.equal(inc.stationB, 'B');
});

test('HOTFIX39 moving train incident records inter-station location', () => {
  const m = new IncidentManager();
  const svc = {
    id:'svc-446', name:'446', state:'moving', position:{lat:48.886,lon:2.380},
    train:{id:'train-446'}, stops:[{stationId:'A'},{stationId:'B'}], currentStopIndex:1,
  };
  const inc = m._spawnTrainIncident(trainBreakdown, [svc], 600, world);
  assert.ok(inc);
  assert.match(inc.locationText, /^entre /);
  assert.notEqual(String(inc.stationA), String(inc.stationB));
});

test('HOTFIX39 incident page contract uses readable colours, train/position and start/end', () => {
  const ui = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  assert.match(ui, /HOTFIX39/);
  assert.match(ui, /Début <b>/);
  assert.match(ui, /Fin <b>/);
  assert.match(ui, /incident-train-name/);
  assert.match(ui, /incident-position-station/);
  assert.match(ui, /incident-position-between/);
  assert.match(css, /\.incident-effect-stop \{ color: #ff6b6b/);
  assert.match(css, /\.incident-train-name \{ color: #ffffff/);
  assert.match(css, /\.incident-position-between \{ color: #60a5fa/);
  assert.match(css, /\.incident-position-station \{ color: #4ade80/);
  assert.match(css, /\.incident-location \{ color: #e2e8f0/);
});
