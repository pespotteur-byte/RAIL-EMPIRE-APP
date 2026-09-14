import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../rotation-v2-editor.js', import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs', import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../../index.html', import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js', import.meta.url),'utf8');

test('HOTFIX62 removes forced 1220px squeeze from the effective 100% zoom layout',()=>{
  assert.ok(src.includes('HOTFIX62-ROULEMENTS-100PCT-READABILITY'));
  assert.match(src,/#page-rotations \.rv3-shell\{height:auto;min-height:calc\(100vh - 70px\);min-width:0;width:100%\}/);
  assert.match(src,/#page-rotations \.rv3-work\{min-width:0;width:100%/);
  assert.match(src,/#page-rotations \.rv3-head\{flex-wrap:wrap;overflow:visible/);
});

test('HOTFIX62 gives KPI and cards readable type sizes instead of 8-9px compression',()=>{
  assert.ok(src.includes('.rv61-kpi span{font-size:10px}'));
  assert.ok(src.includes('.rv61-kpi b{font-size:24px'));
  assert.ok(src.includes('.rv61-linecard .main b{font-size:14px}'));
  assert.ok(src.includes('.rv61-linecard small{font-size:10px'));
  assert.ok(src.includes('.rv61-service-row .train{font-size:14px}'));
});

test('HOTFIX62 progressively reflows the workspace instead of demanding browser zoom-out',()=>{
  assert.ok(src.includes('@media(max-width:1500px)'));
  assert.ok(src.includes("grid-template-areas:'library main' 'inspector main'"));
  assert.ok(src.includes('@media(max-width:1150px)'));
  assert.ok(src.includes('display:flex;flex-direction:column'));
  assert.ok(src.includes('@media(max-width:760px)'));
});

test('HOTFIX62 long operational text wraps instead of being hidden by ellipsis',()=>{
  assert.ok(src.includes('.rv61-kpi small{font-size:10px;white-space:normal'));
  assert.ok(src.includes('.rv61-linecard .formation,.rv61-linecard .issues{white-space:normal'));
  assert.ok(src.includes('.rv61-service-row .formation{white-space:normal'));
});

test('HOTFIX62 bundle/cache contract is dep56',()=>{
  assert.ok(build.includes('HOTFIX62-ROULEMENTS-100PCT-READABILITY'));
  assert.ok(build.includes("const CACHE_VERSION = '1199repair24'"));
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.ok(bundle.includes('HOTFIX62-ROULEMENTS-100PCT-READABILITY'));
});
