import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX60 UI exposes multi-wagon selection and Random 750 m controls',()=>{
  const html=read('index.html');
  assert.match(html,/id="btn-rame-wagon-multi"/);
  assert.match(html,/Sélection multiple wagons/);
  assert.match(html,/id="btn-rame-random-wagons"/);
  assert.match(html,/Random 750 m/);
  assert.match(html,/id="btn-rame-clear-wagon-selection"/);
  assert.match(html,/id="rame-random-selection-count"/);
});

test('HOTFIX60 picker toggles wagons instead of adding them when multi mode is active',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/this\._rameRandomWagonSelection = new Set\(\)/);
  assert.match(ui,/toggleRameWagonMultiMode\(\)/);
  assert.match(ui,/onRamePickerItemClick\(stockId, ev\)/);
  assert.match(ui,/this\._rameMultiWagonMode && item\.category === 'wagon'/);
  assert.match(ui,/this\._rameRandomWagonSelection\.add\(id\)/);
  assert.match(ui,/rame-wagon-selected/);
});

test('RC24 Random requires a locomotive and never replaces non-wagon vehicles',()=>{
  const ui=read('js/ui.js'),random=read('js/rame-random.js');
  assert.match(ui,/fixed = this\.currentRameElements\.filter\(e => e\.category !== 'wagon'\)/);
  assert.match(random,/fixed\.some\(e => e\.category === 'locomotive'\)/);
  assert.match(random,/Placez d’abord une locomotive/);
  assert.match(ui,/this\.currentRameElements = \[\.\.\.fixed, \.\.\.wagons\]/);
});

test('RC24 Random enforces 750 m, optional vehicle cap and uses each selected model before refill',()=>{
  const html=read('index.html'),random=read('js/rame-random.js');
  assert.match(html,/id="rame-random-max"/);
  assert.match(random,/totalLength \+ Number\(item\.length\) <= 750 \+ 1e-9/);
  assert.match(random,/for \(const item of pool\)/);
  assert.match(random,/while \(hasSlot\(\)\)/);
  assert.match(random,/fixed\.length \+ selected\.length < maximum/);
});

test('HOTFIX60 Random uses real stock instances so save billing still applies',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/_makeRameElementFromStock\(item/);
  assert.match(ui,/nextSeriesNumber\(item\.seriesName\)/);
  assert.match(ui,/purchasePrice/);
  assert.match(ui,/billedElements\.reduce/);
});

test('HOTFIX60 CSS has explicit old-browser-compatible selected state',()=>{
  const css=read('style.css');
  assert.match(css,/\.stock-picker-item\.rame-wagon-selected/);
  assert.doesNotMatch(css,/color-mix\(/);
});
