import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActiveService } from '../schedule-creator.js';
import { TileMap } from '../map.js';
import { UI } from '../ui.js';

const sc = fs.readFileSync(new URL('../schedule-creator.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const map = fs.readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url), 'utf8');

test('HOTFIX70: V2 final terminus completes on arrival unless a real material operation is pending', () => {
  // RC2 retains the no-operation despawn invariant, but real terminal actions occupy the track.
  assert.equal(typeof ActiveService.prototype._terminalOperationPending, 'function');
  assert.match(ActiveService.prototype.completeService.toString(), /_terminalOperationPending\(\)/);
  assert.match(sc, /if \(this\.currentStopIndex >= stops\.length\) \{[\s\S]{0,600}this\.completeService\(economy, station, arrivalLat, arrivalLon\);/);
  assert.doesNotMatch(sc, /terminalRelease\s*=\s*stop\?\.departureTime/);
});

test('HOTFIX70: completed service has no physical LiveMap position but rolling stock remains recorded at terminal', () => {
  const station = { id:'TERMINUS', lat:48.5, lon:2.5 };
  const rame = {
    maxSpeed:160, totalFreightCapacity:0, totalCapacity:100,
    totalPower:3000, totalLength:100,
    currentLocation:{ stationId:'ORIGIN', depotId:'', serviceId:'S', lat:48, lon:2 },
  };
  const svc = new ActiveService({
    id:'S70', name:'Test', rameId:'R70',
    stops:[
      { stationId:'ORIGIN', type:'arret', departureTime:600, arrivalTime:600 },
      { stationId:'TERMINUS', type:'arret', departureTime:660, arrivalTime:660 },
    ],
  }, rame, { getStationById:()=>station }, null);
  svc.position = { lat:48.49, lon:2.49 };
  svc.train.stoppedAt = station;
  svc.train.platform = '2';
  svc.completeService(null, station, station.lat, station.lon);

  assert.equal(svc.completed, true);
  assert.equal(svc.state, 'completed');
  assert.equal(svc.position, null);
  assert.equal(svc.train.stoppedAt, null);
  assert.equal(svc.train.platform, null);
  assert.equal(rame.currentLocation.stationId, 'TERMINUS');
  assert.equal(rame.currentLocation.lat, 48.5);
  assert.equal(rame.currentLocation.lon, 2.5);
});

test('HOTFIX70: GPS cannot reconstruct a completed service at its final station', () => {
  const fakeUI = { game:{ world:{ getStationById:()=>({id:'TER',lat:50,lon:4}) } } };
  const svc = {
    completed:true,
    state:'completed',
    position:null,
    currentStopIndex:2,
    train:{ stoppedAt:{id:'TER',lat:50,lon:4} },
    stops:[{stationId:'A',lat:49,lon:3},{stationId:'TER',lat:50,lon:4}],
  };
  const pos = UI.prototype._ensure3DServicePosition.call(fakeUI, svc);
  assert.equal(pos, null);
  assert.equal(svc.position, null);
});

test('HOTFIX70: completed service with null position exits GPS follow immediately', () => {
  const svc = { id:'DONE', completed:true, state:'completed', position:null };
  let disabled = 0, deselected = 0;
  const fakeUI = {
    _followService:svc,
    selectedService:svc,
    _threeDFollowActive:true,
    game:{ renderer:{ tileMap:{} }, scheduleCreator:{ services:[svc] } },
    disable3DFollow(){ disabled++; this._threeDFollowActive=false; },
    deselectService(){ deselected++; this.selectedService=null; this._followService=null; },
  };
  UI.prototype.applyCameraFollow.call(fakeUI);
  assert.equal(disabled, 1);
  assert.equal(deselected, 1);
  assert.equal(fakeUI._followService, null);
});

test('HOTFIX70: GPS weather filter exposes Auto + six visual conditions and does not rewrite game weather', () => {
  for (const value of ['auto','clear','rain','snow','storm','fog','heat']) {
    assert.match(index, new RegExp(`<option value="${value}">`));
  }
  assert.match(ui, /this\._threeDWeatherFilter\s*=\s*'auto'/);
  assert.match(ui, /const visualFilter = String\(this\._threeDWeatherFilter \|\| 'auto'\)/);
  assert.match(ui, /const type = visualFilter === 'auto' \? actualType : visualFilter/);
  assert.doesNotMatch(ui, /weather\.current\s*=\s*(?:visualFilter|type)/);
  assert.match(css, /\.re3d-weather-filter select/);
});

test('HOTFIX70+: night GPS uses a dedicated night-map mode, not only a dim overlay', () => {
  const tm = new TileMap();
  tm.satelliteEnabled = true;
  assert.equal(tm.nightMapEnabled, false);
  assert.equal(tm.setNightMapEnabled(true), true);
  assert.equal(tm.nightMapEnabled, true);
  assert.equal(tm._dirty, true);
  assert.equal(tm.setNightMapEnabled(true), false);
  assert.equal(tm.setNightMapEnabled(false), true);

  assert.match(map, /const baseUrls = this\.satelliteEnabled/);
  assert.match(map, /isNightBaseLayer/);
  assert.match(ui, /setNightMapEnabled\?\.\(lighting\.mapNight\)/);
  assert.match(ui, /let dim = night \* \.06/);
});

test('HOTFIX70: bundle history still records terminus/weather/night-map changes', () => {
  assert.match(build, /HOTFIX70-TERMINUS-DESPAWN-GPS-WEATHER-NIGHT-MAP/);
  assert.match(build, /HOTFIX70 terminus despawn \+ GPS visual weather\/night map: const CACHE_VERSION = '1199dep65'/);
  assert.match(build, /const CACHE_VERSION = '1199repair24'/);
  assert.match(index, /style\.css\?v=1199repair24/);
});
