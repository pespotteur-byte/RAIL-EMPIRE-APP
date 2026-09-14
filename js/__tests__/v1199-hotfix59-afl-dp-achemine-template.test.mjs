import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { INFOGARE_BITMAP_FONTS } from '../infogare-bitmap-font.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');

test('HOTFIX59 AFL DP uses the new user-supplied row-empty template and keeps the filled reference',()=>{
  assert.equal(sha('img/infogare/AFL-DP.png'),'fb2fbfc0276dde7d9dc9532fd97412b52478ace6ac50c43de095188b11eeb56a');
  assert.equal(sha('img/infogare/reference-sources/AFL-DP-filled-example.png'),'26f25f96277aff23105a1c9ee238f61b5e36b5bc72126d130b00ac5f24726e4d');
});

test('HOTFIX59 ships raster Achemine atlases but no font file',()=>{
  for(const key of ['regular','bold']){
    const cfg=INFOGARE_BITMAP_FONTS[key];
    assert.ok(cfg);
    assert.ok(fs.statSync(path.join(root,cfg.src)).size>20_000,cfg.src);
    for(const ch of ['0','A','a','é','•','’']) assert.ok(cfg.glyphs[ch],`${key}:${ch}`);
  }
  const forbidden=[];
  const walk=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(ttf|otf|woff2?|eot)$/i.test(ent.name))forbidden.push(path.relative(root,p));}};
  walk(root);
  assert.deepEqual(forbidden,[]);
});

test('RC24 Infogare replaces the AFL overlay with the Rail Empire continuous board',()=>{
  const ui=read('js/ui.js'),board=read('js/infogare-re.js'),html=read('index.html');
  assert.match(ui,/new RailEmpireBoard/);
  assert.match(board,/re-board-brand/);
  assert.match(board,/re-board-departures/);
  assert.match(board,/re-board-arrivals/);
  assert.doesNotMatch(html,/id="infogare-display"/);
});

test('RC24 FILE bundle contains the RE board and current cache identity',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const html=read('index.html');
  assert.match(bundle,/RailEmpireBoard/);
  assert.match(bundle,/Ajouter les 24 h suivantes/);
  assert.match(html,/style\.css\?v=1199repair24/);
  assert.match(html,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
