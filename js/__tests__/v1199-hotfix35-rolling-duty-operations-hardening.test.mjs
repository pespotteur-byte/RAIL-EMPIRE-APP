import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

test('HOTFIX35 FILE bundle/cache contains rolling-duty operation hardening',()=>{
  const index=read('../../index.html');
  const core=read('../rail-empire.file.bundle.js');
  const build=read('../../scripts/build-file-bundle-v1199.cjs');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(core,/rail-empire\.catalog\.bundle\.js\?v=1199repair24/);
  const packageBuild = JSON.parse(read('../../package.json')).railEmpireBuild;
  const emittedFlavor = core.split('\n')[1].trim();
  assert.ok(emittedFlavor.startsWith('Build: ' + packageBuild + '-HISTORY-'));
  assert.match(emittedFlavor, /HOTFIX(?:3[5-9]|[4-9][0-9])/);
  assert.match(build, /BUNDLE_FLAVOR/);
  for(const token of [
    'NO_ACTIVE_TRACTION_ASSIGNED','NO_TRACTION_AFTER_OPERATION','ACTION_MATERIAL_ALREADY_PRESENT',
    'SCHEDULE_DOUBLE_ASSIGNED','MATERIAL_LOCATION_GAP_GLOBAL','operationTimelineAtLocation',
    '_v2OperationState','ROTATION_ACTION_MATERIAL_WAIT','RUNTIME_SAVE_SCHEMA = 4'
  ]) assert.ok(core.includes(token),`missing ${token}`);
});

test('HOTFIX35 terminal operations extend release instead of demanding intermediate dwell',()=>{
  const core=read('../rail-empire.file.bundle.js');
  assert.match(core,/locIndex\s*>\s*0\s*&&\s*locIndex\s*<\s*ver\.locations\.length\s*-\s*1/);
});
