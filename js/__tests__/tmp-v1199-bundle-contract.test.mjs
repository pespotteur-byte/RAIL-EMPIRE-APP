import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const core=fs.readFileSync(path.join(root,'js/rail-empire.file.bundle.js'),'utf8');
const catalog=fs.readFileSync(path.join(root,'js/rail-empire.catalog.bundle.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1.1.99 bundle/cache/version are aligned',()=>{
  assert.equal(pkg.version,'1.1.99');
  assert.match(html,/Rail Empire v1\.1\.99/);
  const cache=html.match(/<script\s+src=[\"']js\/rail-empire\.file\.bundle\.js\?v=(1199(?:dep|ts|repair)\d+)&fullaudit=1[\"']/)?.[1];
  assert.ok(cache,'index must expose a 1.1.99 dependency/TypeScript/repair cache id');
  assert.match(core,/Rail Empire v1\.1\.99 FILE:\/\/ CORE bundle/);
  assert.ok(core.includes(`rail-empire.catalog.bundle.js?v=${cache}`),'core and deferred catalogue must use the exact same cache id');
  assert.match(catalog,/Rail Empire v1\.1\.99 FILE:\/\/ DEFERRED CATALOG bundle/);
});

test('final FILE bundle embeds Inventaire/Rames taxonomy and audited runtime fixes',()=>{
  for(const marker of ['stock-detail-filter','rame-detail-filter','rames-kind-filter','loco-electric','mu-tramtrain','wagon-intermodal','FORMATION_VEHICLE_DUPLICATE','stoppedSinceGameTime']) assert.ok(core.includes(marker),`missing ${marker}`);
});

test('SIV recorded assets required by Livemap are packaged',()=>{
  for(const f of ['rerb_attention.wav','rerb_destination_prefix.wav','rerb_stops_prefix.wav','rerb_attention.m4a','rerb_destination_prefix.m4a','rerb_stops_prefix.m4a']) assert.ok(fs.statSync(path.join(root,'audio/siv',f)).size>1000,`${f} absent/empty`);
});
