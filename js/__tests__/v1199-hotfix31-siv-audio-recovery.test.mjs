import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('HOTFIX31 SIV feature survives the current build/cache',()=>{
  const index=read('index.html');
  const build=read('scripts/build-file-bundle-v1199.cjs');
  { assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24/); }
  assert.match(build,/CACHE_VERSION = '1199repair24'/);
  assert.match(build,/BUNDLE_FLAVOR/);
});

test('HOTFIX31 bundle contains resilient French SIV fallbacks',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  assert.match(bundle,/allowLanguageFallback/);
  assert.match(bundle,/FR_LANG_FALLBACK/);
  assert.match(bundle,/speechSynthesis\?\.resume/);
  assert.match(bundle,/failed local WAV\/M4A must never silence the whole SIV|failed local WAV\/M4A/);
  assert.match(bundle,/Ce train a pour destination/);
  assert.match(bundle,/Il s'arrêtera en gare de/);
});
