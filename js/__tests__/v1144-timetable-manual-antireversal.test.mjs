import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { ActiveService } from '../schedule-creator.js';

const editorSource = fs.readFileSync(new URL('../schedule-v2-editor.js', import.meta.url), 'utf8');
const ormSource = fs.readFileSync(new URL('../orm.js', import.meta.url), 'utf8');

test('v1.1.44 Schedule V2 cursor routing keeps directed anti-reversal logic enabled', () => {
  assert.match(ormSource, /_routeToTargets\s*\(\s*graph\s*,\s*pc\.key\s*,\s*targets\s*,\s*\{\s*\.\.\.opts\s*,\s*allowFallback\s*:\s*false\s*,\s*directed\s*:\s*true\s*\}\s*\)/);
  assert.match(ormSource, /e1\.key\s*,\s*e2\.key\s*,\s*\{\s*\.\.\.opts\s*,\s*allowFallback\s*:\s*false\s*,\s*directed\s*:\s*true\s*\}/);
  const cursorPart = ormSource.slice(ormSource.indexOf('_routeCursorAnchorChainOnWays'), ormSource.indexOf('_findCursorLegBroadArea'));
  assert.doesNotMatch(cursorPart,/directed\s*:\s*false/,'Schedule cursor routing must never disable direction/turn penalties');
});

test('directed router assigns a dominant penalty to a pure same-track back-up', () => {
  const orm = new ORMClient();
  const graph = { nodes:new Map() };
  const add=(key,lat,lon)=>graph.nodes.set(key,{key,lat,lon,edges:[]});
  add('A',48,2); add('B',48,2.01); add('C',48,2.02);
  const meta={maxSpeed:100,maxSpeedSource:'OSM',wayId:'W',service:'',usage:'main',againstPreferredDirection:false,directionForbidden:false};
  graph.nodes.get('A').edges.push({from:'A',to:'B',dist:0.7,...meta});
  graph.nodes.get('B').edges.push({from:'B',to:'A',dist:0.7,...meta});
  graph.nodes.get('B').edges.push({from:'B',to:'C',dist:0.7,...meta});
  graph.nodes.get('C').edges.push({from:'C',to:'B',dist:0.7,...meta});
  // A -> B -> A is a physical reversal on the same way. The turn helper itself
  // is the invariant used by the directed Schedule V2 router.
  const back = orm._turnPenalty(graph, graph.nodes.get('A').edges[0], graph.nodes.get('B').edges[0], true);
  assert.ok(Number.isFinite(back));
  assert.ok(back >= 72, `pure back-up must remain an extreme last resort, got ${back}`);
});

test('v1.1.70 supersedes v1.1.44 timetable pacing: V2 never gets a cruise cap', () => {
  const fake = {
    _v2OccurrenceId:'occ', _v2BaseDate:'2026-08-17', _currentDate:'2026-08-17',
    getNextStop(){ return {type:'arret',arrivalTime:10}; },
    _getRemainingDistance(){ return 10; },
    _v2ScheduleNowMinutes: ActiveService.prototype._v2ScheduleNowMinutes,
  };
  const cap = ActiveService.prototype._timetableSpeedCap.call(fake, 0, [{},{}]);
  assert.equal(cap, null, 'v1.1.70 zero-margin V2 must not impose a timetable cruise cap');
  const lateCap = ActiveService.prototype._timetableSpeedCap.call(fake, 11, [{},{}]);
  assert.equal(lateCap, null, 'late trains must likewise run as fast as physical limits allow');
});

test('v1.1.96 supersedes the v1.1.44 hard arrival gate: physical early arrival may be declared, departure stays booked', () => {
  const fake = {
    _v2OccurrenceId:'occ', _v2BaseDate:'2026-08-17', _currentDate:'2026-08-17',
    getNextStop(){ return {type:'arret',arrivalTime:10}; },
    _v2ScheduleNowMinutes: ActiveService.prototype._v2ScheduleNowMinutes,
    speed:90, delay:-2,
    train:{speed:90,state:'moving',blockedBy:false,delayReason:'',delay:-2},
  };
  assert.equal(ActiveService.prototype._holdForBookedArrival.call(fake, 8), false);
  assert.equal(fake.speed,90); assert.equal(fake.train.speed,90);
  assert.equal(fake.delay,0); assert.equal(fake.train.delay,0);
  assert.match(fake.train.delayReason,/arrivée en avance|attente heure de départ/);
  assert.equal(ActiveService.prototype._holdForBookedArrival.call(fake, 10), false);
});

test('v1.1.44 editor exposes continuous manual ORM tracing and automatic reset', () => {
  assert.match(editorSource,/data-act="manual-trace"/);
  assert.match(editorSource,/data-act="auto-segment"/);
  assert.match(editorSource,/toggleManualTrace\(\)/);
  assert.match(editorSource,/resetActiveLegToAutomatic\(\)/);
  assert.match(editorSource,/if\s*\(\s*this\._manualTraceMode\s*\)/);
  assert.match(editorSource,/Every click|Chaque clic|chaque clic/i);
  assert.doesNotMatch(editorSource,/synthetic manual route|ligne droite manuelle/i);
});
