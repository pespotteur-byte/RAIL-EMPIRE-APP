import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORMClient } from '../orm.js';

test('v1.1.87-DIAG2 records passive Schedule diagnostic events without routing mutation', () => {
  const orm = new ORMClient();
  const beforeEpoch = orm._topologyEpoch;
  const id = orm.startScheduleDebugSession({ reason:'test' });
  orm.debugScheduleEvent('probe',{wayId:'123',geometry:[{lat:1,lon:2},{lat:2,lon:3}]});
  // Regression for DIAG1 export crash: getScheduleDebugSnapshot() must be able
  // to serialize a real routing Error without relying on another method's scope.
  orm._lastRoutingFailure={kind:'NETWORK',error:Object.assign(new Error('probe failure'),{code:'E_PROBE'})};
  const snap = orm.getScheduleDebugSnapshot();
  assert.match(id,/^scdiag-/);
  assert.equal(snap.schema,'rail-empire-sc-diagnostic-v1');
  assert.equal(snap.events.at(-1).event,'probe');
  assert.equal(snap.events.at(-1).data.geometryPoints,2);
  assert.equal(snap.ormState.lastRoutingFailure.error.message,'probe failure');
  assert.equal(snap.ormState.lastRoutingFailure.error.code,'E_PROBE');
  assert.equal(orm._topologyEpoch,beforeEpoch);
});

test('v1.1.87-DIAG2 editor exposes diagnostic export control and build marker', () => {
  const src=readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  assert.match(src,/data-act="export-diagnostic"/);
  assert.match(src,/exportScheduleDiagnostic\(\)/);
  assert.match(src,/v1\.1\.87-DIAG2/);
});
