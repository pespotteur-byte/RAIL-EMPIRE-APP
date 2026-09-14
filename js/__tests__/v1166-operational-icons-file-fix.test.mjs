import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OP_ICON_STOP, OP_ICON_WARN, OP_ICON_WORKS } from '../operational-icons.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');

test('v1.1.66 operational icons are self-contained PNG data URIs',()=>{
  for(const uri of [OP_ICON_STOP,OP_ICON_WARN,OP_ICON_WORKS]){
    assert.match(uri,/^data:image\/png;base64,/);
    const raw=Buffer.from(uri.split(',')[1],'base64');
    assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(raw.length>100000);
  }
});

test('v1.1.66 station incident pictogram is centered on the station marker',()=>{
  const renderer=fs.readFileSync(path.join(root,'js','renderer.js'),'utf8');
  assert.match(renderer,/String\(inc\.stationA\) === String\(inc\.stationB\)/);
  assert.match(renderer,/size: stationSize, dx: 0, dy: 0/);
  assert.doesNotMatch(renderer,/stationOffset/);
});

test('v1.1.66 banners use embedded icon classes and header identity is current',()=>{
  const ui=fs.readFileSync(path.join(root,'js','ui.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const version=fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim();
  assert.match(ui,/installOperationalIconStyles\(\)/);
  assert.match(ui,/alert-icon op-icon/);
  assert.doesNotMatch(ui,/img\/incident-interruption\.png/);
  const escaped=version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(index,new RegExp(`Rail Empire v${escaped}`));
  assert.match(index,new RegExp(`header-brand-version\">V${escaped}`));
  assert.doesNotMatch(index,/V1\.1\.61/);
  assert.equal(version,'1.1.99');
});
