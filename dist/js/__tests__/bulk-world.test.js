import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Station, Track, World, createDefaultWorld } from '../world.js';
import { Line, LineManager, PlatformManager } from '../line.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('Station constructor variations', (() => {
  const cases = [];
  const types = ['voyageur', 'fret', 'mixed', 'industrial'];
  for (let i = 0; i < 2000; i++) {
    const id = `st-${i}`;
    const name = `Gare ${i}`;
    const lat = 45 + (i % 180) / 1000;
    const lon = 2 + (i % 360) / 1000;
    const platforms = (i % 8) + 1;
    const type = types[i % types.length];
    cases.push({
      name: `station-${i}`,
      fn: () => {
        const s = new Station(id, name, lat, lon, platforms, type);
        assert.equal(s.id, id);
        assert.equal(s.name, name);
        assert.equal(s.lat, lat);
        assert.equal(s.lon, lon);
        assert.equal(s.platforms, platforms);
        assert.equal(s.type, type);
        assert.deepEqual(s.lineIds, []);
      },
    });
  }
  return cases;
})());

itCases('World add/get/remove roundtrip', (() => {
  const cases = [];
  for (let n = 1; n <= 200; n++) {
    cases.push({
      name: `n=${n}`,
      fn: () => {
        const world = new World();
        for (let i = 0; i < n; i++) {
          world.addStation({ id: `s${i}`, name: `S${i}`, lat: i * 0.1, lon: i * 0.2 });
        }
        assert.equal(world.stations.length, n);
        for (let i = 0; i < n; i++) {
          const s = world.getStationById(`s${i}`);
          assert.ok(s);
          assert.equal(s.name, `S${i}`);
        }
        world.removeStation(`s${n - 1}`);
        assert.equal(world.stations.length, n - 1);
        assert.equal(world.getStationById(`s${n - 1}`), undefined);
      },
    });
  }
  return cases;
})());

itCases('World track map lookup', (() => {
  const cases = [];
  for (let n = 2; n <= 200; n++) {
    cases.push({
      name: `n=${n}`,
      fn: () => {
        const world = new World();
        const ids = [];
        for (let i = 0; i < n; i++) {
          world.addStation({ id: `s${i}`, name: `S${i}`, lat: i * 0.1, lon: i * 0.2 });
        }
        for (let i = 0; i < n - 1; i++) {
          const t = world.addTrack({ stationA: `s${i}`, stationB: `s${i + 1}`, distance: 10 + i, maxSpeed: 160 });
          ids.push(t.id);
        }
        for (let i = 0; i < n - 1; i++) {
          const t = world.getTrackBetween(`s${i}`, `s${i + 1}`);
          assert.ok(t, `missing track ${i}`);
          assert.equal(t.distance, 10 + i);
        }
        world.removeTrack(ids[0]);
        assert.equal(world.getTrackBetween('s0', 's1'), undefined);
      },
    });
  }
  return cases;
})());

itCases('World save/load roundtrip', (() => {
  const cases = [];
  for (let seed = 0; seed < 500; seed++) {
    cases.push({
      name: `seed=${seed}`,
      fn: () => {
        const world = new World();
        const n = (seed % 50) + 2;
        for (let i = 0; i < n; i++) {
          world.addStation({
            id: `s${i}`,
            name: `Station ${i}`,
            lat: 47 + i * 0.01,
            lon: 3 + i * 0.02,
            platforms: (i % 6) + 1,
            type: i % 2 === 0 ? 'voyageur' : 'fret',
            lineIds: i > 0 ? [`line-${i}`] : [],
            platformNames: i % 3 === 0 ? ['1', '2bis'] : [],
          });
        }
        for (let i = 0; i < n - 1; i++) {
          world.addTrack({
            stationA: `s${i}`,
            stationB: `s${i + 1}`,
            distance: 50 + i,
            maxSpeed: 120 + (i % 3) * 40,
            electrified: i % 2 === 0,
            tracks: (i % 3) + 1,
            route: [
              { lat: 47 + i * 0.01, lon: 3 + i * 0.02 },
              { lat: 47 + (i + 1) * 0.01, lon: 3 + (i + 1) * 0.02 },
            ],
          });
        }
        const save = world.toSave();
        const restored = new World();
        restored.loadFromSave(save);
        assert.equal(restored.stations.length, world.stations.length);
        assert.equal(restored.tracks.length, world.tracks.length);
        for (const s of restored.stations) {
          const orig = world.getStationById(s.id);
          assert.ok(orig);
          assert.equal(s.name, orig.name);
          assert.equal(s.type, orig.type);
          assert.equal(s.platforms, orig.platforms);
          assert.equal(Math.round(s.lat * 1e5), Math.round(orig.lat * 1e5));
        }
        for (const t of restored.tracks) {
          const orig = world.getTrackBetween(t.stationA, t.stationB);
          assert.ok(orig);
          assert.equal(t.maxSpeed, orig.maxSpeed);
          assert.equal(t.electrified, orig.electrified);
          assert.equal(t.distance, orig.distance);
        }
      },
    });
  }
  return cases;
})());

itCases('Line and LineManager', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const stops = [`s${i}`, `s${i + 1}`, `s${i + 2}`];
    cases.push({
      name: `line-${i}`,
      fn: () => {
        const mgr = new LineManager();
        const line = mgr.addLine({ name: `L${i}`, color: '#ff0000', stops, trackIds: [`t${i}`, `t${i + 1}`] });
        assert.ok(line.id.startsWith('line-'));
        assert.equal(line.name, `L${i}`);
        assert.equal(mgr.getLine(line.id), line);
        assert.deepEqual(line.getStationIds(), stops);
        assert.ok(line.hasStation(`s${i + 1}`));
        assert.ok(line.hasTrack(`t${i}`));
        assert.equal(mgr.getLinesForStation(`s${i}`).length, 1);
        assert.equal(mgr.getLinesForTrack(`t${i}`).length, 1);
        const save = mgr.toSave();
        const restored = new LineManager();
        restored.loadFromSave(save);
        assert.equal(restored.getAll().length, 1);
        assert.deepEqual(restored.getLine(line.id).getStationIds(), stops);
      },
    });
  }
  return cases;
})());

itCases('PlatformManager allocation', (() => {
  const cases = [];
  for (let total = 1; total <= 10; total++) {
    for (let trains = 0; trains <= total + 3; trains++) {
      cases.push({
        name: `platforms=${total},trains=${trains}`,
        fn: () => {
          const pm = new PlatformManager();
          pm.initStation('ST1', total);
          let assigned = 0;
          const ids = [];
          for (let t = 0; t < trains; t++) {
            const r = pm.assignPlatform('ST1', `tr-${t}`, total, t % 2 === 0 ? '1' : null);
            if (r !== null) assigned++;
            ids.push(`tr-${t}`);
          }
          assert.equal(assigned, Math.min(trains, total));
          assert.equal(pm.getFreePlatforms('ST1'), Math.max(0, total - assigned));
          const status = pm.getStatus('ST1');
          assert.equal(status.total, total);
          assert.equal(status.used, assigned);
          assert.equal(status.free, Math.max(0, total - assigned));
          // release every other
          for (let t = 0; t < trains; t += 2) pm.releasePlatform('ST1', `tr-${t}`);
          const after = pm.getFreePlatforms('ST1');
          assert.ok(after >= Math.ceil(assigned / 2) - (trains > total ? trains - total : 0));
        },
      });
    }
  }
  return cases;
})());

describe('bulk-world meta', () => {
  it('loaded', () => assert.ok(true));
});
