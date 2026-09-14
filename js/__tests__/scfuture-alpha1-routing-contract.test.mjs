import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

test('SC Future A1 routes only through the local RailGraph API and forbids pure same-way backup', async () => {
  let localOpts = null;
  let legacyCalls = 0;
  const orm = {
    async findRouteViaLocalRailGraphAnchors(_anchors, opts) {
      localOpts = opts;
      return [
        {lat:49, lon:8, wayId:'W', maxSpeed:120, maxSpeedSource:'OSM'},
        {lat:49.01, lon:8, wayId:'W', maxSpeed:120, maxSpeedSource:'OSM'},
      ];
    },
    async findRouteViaCursorAnchors() { legacyCalls++; throw new Error('legacy route path must stay unused'); },
    isFallbackRoute() { return false; },
    _lastCursorRouteFailure: '',
  };
  const router = new ScheduleV2Router(orm);
  const route = await router.routeBetweenBindings(
    {lat:49, lon:8, wayId:'W'},
    {lat:49.01, lon:8, wayId:'W'},
  );
  assert.equal(route.length, 2);
  assert.equal(legacyCalls, 0);
  assert.equal(localOpts.allowFallback, false);
  assert.equal(localOpts.allowSyntheticStitches, false);
  assert.equal(localOpts.routeObjective, 'distance');
  assert.equal(localOpts.forbidPureBackup, true);
});
