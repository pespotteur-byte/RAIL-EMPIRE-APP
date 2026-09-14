import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as newMA from '../../js/movement-authority.js';
import * as newGeo from '../../js/rail-section-geometry.js';
import { SeededRng } from '../../js/rng.js';

const baselineDir = process.argv[2] || process.env.RE_TS_BASELINE;
if (!baselineDir) {
  console.error('Usage: node tools/typescript/ts-parity-alpha2.mjs <HOTFIX83 extracted directory>');
  process.exit(2);
}
const oldMA = await import(pathToFileURL(path.resolve(baselineDir, 'js/movement-authority.js')).href);
const oldGeo = await import(pathToFileURL(path.resolve(baselineDir, 'js/rail-section-geometry.js')).href);
const rng = new SeededRng(0xA12F02C3);
const clone = (v) => v == null ? v : structuredClone(v);

// MovementAuthority differential: random GO/CAUTION/STOP/LIMIT sequences.
for (let k = 0; k < 3000; k++) {
  const ta = { blockedBy: false, delayReason: '', tag: k };
  const tb = { blockedBy: false, delayReason: '', tag: k };
  const a = new oldMA.MovementAuthority(ta);
  const b = new newMA.MovementAuthority(tb);
  const base = rng.random() < 0.08 ? Infinity : Math.round(rng.random() * 240);
  a.begin(base); b.begin(base);
  const n = 1 + rng.randomInt(12);
  for (let i = 0; i < n; i++) {
    const op = rng.randomInt(4);
    const raw = rng.random() < 0.08 ? NaN : (rng.random() < 0.08 ? Infinity : Math.round((rng.random() * 260) - 20));
    const meta = rng.random() < 0.5 ? null : { i, cantonId: `C${rng.randomInt(99)}`, nested: { k } };
    if (op === 0) { a.caution(raw, `C${i}`, `caution ${i}`, 'parity', clone(meta)); b.caution(raw, `C${i}`, `caution ${i}`, 'parity', clone(meta)); }
    else if (op === 1) { a.stop(`S${i}`, `stop ${i}`, 'parity', clone(meta)); b.stop(`S${i}`, `stop ${i}`, 'parity', clone(meta)); }
    else if (op === 2) { a.limit(raw, `L${i}`, `limit ${i}`, 'parity', clone(meta)); b.limit(raw, `L${i}`, `limit ${i}`, 'parity', clone(meta)); }
    else { a.go(); b.go(); }
    assert.deepEqual(b.decision(), a.decision(), `Movement decision mismatch case ${k}/${i}`);
    assert.deepEqual(tb, ta, `Published train authority mismatch case ${k}/${i}`);
  }
}

// Rail geometry differential: dirty bindings/routes + directional route matching.
const dirs = [undefined, null, 'both', 'forward', 'reverse', 'junk'];
for (let k = 0; k < 3000; k++) {
  const lat0 = 41 + rng.random() * 10;
  const lon0 = -4 + rng.random() * 12;
  const route = [];
  const points = 2 + rng.randomInt(18);
  for (let i = 0; i < points; i++) {
    const dirty = rng.random() < 0.08;
    route.push({
      lat: dirty ? 'bad' : lat0 + i * 0.002 + (rng.random() - 0.5) * 0.0002,
      lon: lon0 + i * 0.001 + (rng.random() - 0.5) * 0.0002,
      wayId: rng.randomInt(5),
      fallback: rng.random() < 0.03,
      synthetic: rng.random() < 0.03,
      keep: `P${i}`,
    });
  }
  const cleanA = oldGeo.cleanRailRoute(clone(route));
  const cleanB = newGeo.cleanRailRoute(clone(route));
  assert.deepEqual(cleanB, cleanA, `cleanRailRoute mismatch ${k}`);

  const startRaw = cleanA[0] || { lat: lat0, lon: lon0 };
  const endRaw = cleanA.at(-1) || { lat: lat0 + 0.02, lon: lon0 + 0.01 };
  const startBinding = { lat: String(startRaw.lat), lon: startRaw.lon, snapLat: startRaw.lat, snapLon: String(startRaw.lon), wayId: 123, trackRef: 7, extra: true };
  const endBinding = { lat: endRaw.lat, lon: endRaw.lon, snapLat: String(endRaw.lat), snapLon: endRaw.lon, wayId: '456' };
  assert.deepEqual(newGeo.cleanRailBinding(clone(startBinding)), oldGeo.cleanRailBinding(clone(startBinding)), `cleanRailBinding start ${k}`);
  assert.deepEqual(newGeo.cleanRailBinding(clone(endBinding)), oldGeo.cleanRailBinding(clone(endBinding)), `cleanRailBinding end ${k}`);

  const data = {
    id: k % 5 ? k : '',
    name: k % 7 ? ` S ${k} ` : '   ',
    startBinding,
    endBinding,
    constraints: [{ speed: 30 + rng.randomInt(130) }],
    route,
    segments: [{ wayId: k }],
    distanceKm: rng.random() < 0.08 ? 'bad' : rng.random() * 50,
    length: rng.random() < 0.15 ? 0 : Math.round(rng.random() * 50000),
    direction: dirs[rng.randomInt(dirs.length)],
    manual: rng.random() > 0.5,
    cargoType: k % 3 ? 'conteneurs' : null,
    role: k % 4 ? 'main' : undefined,
  };
  const defaults = { id: `D${k}`, name: 'Default', direction: 'both', cargoType: '', role: 'fallback' };
  assert.deepEqual(newGeo.normalizeRailSection(clone(data), clone(defaults)), oldGeo.normalizeRailSection(clone(data), clone(defaults)), `normalizeRailSection mismatch ${k}`);
  assert.equal(newGeo.normalizeSectionDirection(data.direction), oldGeo.normalizeSectionDirection(data.direction), `normalize direction ${k}`);
  assert.equal(newGeo.sectionDirectionLabel(data.direction), oldGeo.sectionDirectionLabel(data.direction), `direction label ${k}`);

  if (cleanA.length >= 2) {
    const section = {
      direction: dirs[rng.randomInt(dirs.length)],
      route: cleanA,
      startBinding: { snapLat: cleanA[0].lat, snapLon: cleanA[0].lon },
      endBinding: { snapLat: cleanA.at(-1).lat, snapLon: cleanA.at(-1).lon },
    };
    const trainRoute = rng.random() < 0.5 ? cleanA : [...cleanA].reverse();
    assert.equal(
      newGeo.railSectionDirectionMatchesRoute(clone(trainRoute), clone(section)),
      oldGeo.railSectionDirectionMatchesRoute(clone(trainRoute), clone(section)),
      `direction matcher ${k}`,
    );
  }
}

console.log('TypeScript Alpha 2 parity: 3000 MovementAuthority + 3000 rail-geometry cases identical to HOTFIX83 baseline');
