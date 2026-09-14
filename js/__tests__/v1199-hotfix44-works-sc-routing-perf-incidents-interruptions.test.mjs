import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX44 Works routing follows Schedule Creator preparation flow without duplicate A+B prefetch',()=>{
  const src=read('js/works-v2-editor.js');
  assert.match(src,/prefetchRailNetworkNearStation\?\.\(st,0\.8\)/);
  assert.match(src,/ScheduleV2Editor\.prototype\._routingOptions\.call\(this,ver/);
  assert.match(src,/routeBetweenBindings\(z\.startBinding,z\.endBinding,z\.constraints\|\|\[\],this\._routingOptions/);
  assert.doesNotMatch(src,/Promise\.all\(\[this\._prefetchStation\(z\.startStation\),this\._prefetchStation\(z\.endStation\)\]\)/);
});

test('HOTFIX44 incidents column explicitly shows incidents + interruptions with both large pictograms',()=>{
  const index=read('index.html');
  const css=read('style.css');
  assert.match(index,/op-icon-warn operations-column-icon/);
  assert.match(index,/op-icon-stop operations-column-icon/);
  assert.match(index,/Incidents et Interruptions en cours/);
  assert.match(css,/\.operations-column-icons\s*\{[^}]*display:flex;[^}]*gap:12px;/);
});

test('HOTFIX44 FILE bundle and cache bust expose the new routing/UI runtime',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const index=read('index.html');
  assert.match(bundle,/HOTFIX44-WORKS-SC-ROUTING-PERF-INCIDENTS-INTERRUPTIONS/);
  assert.match(bundle,/ScheduleV2Editor\.prototype\._routingOptions\.call\(this, ver/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
