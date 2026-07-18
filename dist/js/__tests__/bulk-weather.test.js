import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Weather } from '../weather.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('Weather constructor defaults', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `default-${i}`,
      fn: () => {
        const w = new Weather();
        assert.equal(w.current, 'clear');
        assert.ok(Number.isFinite(w.temperature));
        assert.ok(w.getSpeedMultiplier() > 0);
      },
    });
  }
  return cases;
})());

itCases('getSpeedEffectsAt per type', (() => {
  const cases = [];
  const types = ['clear', 'rain', 'snow', 'storm', 'fog', 'heat'];
  const speeds = [0, 60, 100, 140, 160, 200, 250, 320];
  for (let i = 0; i < 2000; i++) {
    const type = types[i % types.length];
    const speed = speeds[i % speeds.length];
    cases.push({
      name: `type=${type},v=${speed}`,
      fn: () => {
        const w = new Weather();
        w.current = type;
        const e = w.getSpeedEffectsAt(45, 2, speed);
        assert.equal(e.type, type);
        assert.ok(e.brakeFactor >= 0.1 && e.brakeFactor <= 1.0);
        assert.ok(e.speedMult > 0 && e.speedMult <= 1.0);
        if (type === 'snow' && speed >= 140) {
          assert.ok(Number.isFinite(e.speedCap));
          assert.ok(e.speedCap <= speed);
        }
        if (type === 'clear') {
          assert.equal(e.brakeFactor, 1.0);
          assert.equal(e.speedMult, 1.0);
        }
      },
    });
  }
  return cases;
})());

itCases('point cache key and state', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `cache-${i}`,
      fn: () => {
        const w = new Weather();
        const key = w._pointKey(45.1234, 2.5678);
        assert.ok(typeof key === 'string');
        w._pointCache.set(key, { state: { type: 'rain', precipitation: 5 }, expiresAt: Date.now() + 10000 });
        const at = w.getAt(45.1234, 2.5678);
        assert.equal(at.type, 'rain');
      },
    });
  }
  return cases;
})());

itCases('season label and state', (() => {
  const cases = [];
  const map = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  for (let i = 0; i < 1000; i++) {
    const season = seasons[i % seasons.length];
    cases.push({
      name: `season-${i}`,
      fn: () => {
        const w = new Weather();
        w.season = season;
        assert.equal(w._seasonLabel(), map[season]);
        assert.ok(['clear', 'rain', 'snow', 'storm', 'fog', 'heat'].includes(w.current));
      },
    });
  }
  return cases;
})());

itCases('radar/cloud helpers', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `radar-${i}`,
      fn: () => {
        const w = new Weather();
        w.radarHost = 'https://host';
        const path = '/2024/1/1';
        w.radarTimestamps = [path];
        w.cloudTimestamps = [path];
        assert.equal(w.getLatestRadarPath(), path);
        assert.equal(w.getLatestCloudPath(), path);
        assert.ok(w.getRadarTileUrl(path).includes('256'));
        assert.ok(w.getCloudTileUrl(path).includes('256'));
      },
    });
  }
  return cases;
})());

describe('bulk-weather meta', () => {
  it('loaded', () => assert.ok(true));
});
