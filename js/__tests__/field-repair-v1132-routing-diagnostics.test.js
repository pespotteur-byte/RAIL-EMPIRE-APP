import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

const a={lat:48,lon:2},b={lat:48.1,lon:2.1};

function fakeOrm(failure){
  return {
    _lastCursorRouteFailure:failure,
    async findRouteViaCursorAnchors(){this._lastCursorRouteFailure=failure;return null;},
    isFallbackRoute(){return false;},
  };
}

test('Schedule V2 distinguishes temporary ORM network failure from absent topology',async()=>{
  const router=new ScheduleV2Router(fakeOrm('NETWORK_UNAVAILABLE'));
  await assert.rejects(()=>router.routeBetweenBindings(a,b),err=>err?.code==='ORM_NETWORK_UNAVAILABLE'&&/temporairement indisponible/i.test(err.message));
});

test('Schedule V2 reports a genuine disconnected real-rail path separately',async()=>{
  const router=new ScheduleV2Router(fakeOrm('NO_CONNECTED_PATH'));
  await assert.rejects(()=>router.routeBetweenBindings(a,b),err=>err?.code==='ORM_NO_CONNECTED_PATH'&&/Aucun tracé ferroviaire ORM réel/i.test(err.message));
});
