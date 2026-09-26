import test from 'node:test';
import assert from 'node:assert/strict';
import { __railReferenceTest } from '../rail-reference-sync.js';

const { freightSiteFromElement, mergeSiteRecords, referencePointFromCompactRow } = __railReferenceTest;

const yardTrack = (id, lat, lon, extra = {}) => ({ type: 'way', id, center: { lat, lon }, tags: { railway: 'rail', service: 'yard', ...extra } });

test('FINAL1 yard sidings are grouped into a single freight yard instead of one site per track', () => {
  const els = [yardTrack(1, 50.0, 4.0), yardTrack(2, 50.001, 4.0), yardTrack(3, 50.002, 4.0, { name: 'Faisceau Nord' }), yardTrack(4, 50.0025, 4.001)];
  const out = mergeSiteRecords(els.map((e) => freightSiteFromElement(e, 'BE')));
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Faisceau Nord');
  assert.equal(out[0].siteKind, 'yard');
  assert.equal(out[0].type, 'marchandise');
});

test('FINAL1 unnamed sidings need 3 tracks and must not sit inside a known station', () => {
  const lone = mergeSiteRecords([yardTrack(10, 51.0, 5.0), yardTrack(11, 51.001, 5.0)].map((e) => freightSiteFromElement(e, 'BE')));
  assert.equal(lone.length, 0);
  const trio = [yardTrack(20, 52.0, 6.0), yardTrack(21, 52.001, 6.0), yardTrack(22, 52.002, 6.0)].map((e) => freightSiteFromElement(e, 'NL'));
  assert.equal(mergeSiteRecords(trio).length, 1);
  assert.match(mergeSiteRecords(trio)[0].name, /^Faisceau marchandises NL/);
  assert.equal(mergeSiteRecords(trio, [{ lat: 52.003, lon: 6.0, type: 'voyageur' }]).length, 0);
  const yard = freightSiteFromElement({ type: 'node', id: 99, lat: 52.0035, lon: 6.0, tags: { railway: 'yard', name: 'Triage' } }, 'NL');
  const withYard = mergeSiteRecords([yard, ...trio]);
  assert.deepEqual(withYard.map((p) => p.name), ['Triage']);
});

test('FINAL1 embedded compact rows round-trip into reference points', () => {
  const p = referencePointFromCompactRow(['osm-freight-node-1', 'Koblenz-Lützel Rbf', 5036000, 759000, 1, 'DE', 'yard', '', 'node', '1', '', 'DB', '', '', '', 'coal;steel', 0, 'OSM'], 'pack');
  assert.equal(p.type, 'marchandise'); assert.equal(p.country, 'DE'); assert.equal(p.lat, 50.36);
  assert.deepEqual(p.cargoTags, ['coal', 'steel']); assert.deepEqual(p.facilities, ['fret']);
  assert.equal(referencePointFromCompactRow(['x', 'y', 1, 2, 2, 'FR', 'ite3000', '', '', '', '', '', '', '', '', '', 1, ''], 'pack').type, 'ite');
  assert.equal(referencePointFromCompactRow(['bad'], 'pack'), null);
});
