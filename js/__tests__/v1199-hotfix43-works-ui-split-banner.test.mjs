import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('HOTFIX43 adds a dedicated works banner using the requested dark orange', () => {
  const index = read('index.html');
  const css = read('style.css');
  const ui = read('js/ui.js');
  assert.match(index, /id="alert-banner-works" class="alert-banner alert-banner-works hidden"/);
  assert.match(css, /\.alert-banner-works\s*\{\s*background:\s*#c44916;\s*color:\s*#fff;/i);
  assert.match(ui, /const worksItems = \[\]/);
  assert.match(ui, /setBanner\(bannerWorks, worksItems\)/);
  assert.doesNotMatch(ui, /\(r\.impact === 'stop' \? interruptions : slowdowns\)\.push\(item\)/);
});

test('HOTFIX43 works wording carries the work name and A/B or single-station location', () => {
  const ui = read('js/ui.js');
  assert.match(ui, /a === b \? `à \$\{a\}` : `entre \$\{a\} et \$\{b\}`/);
  assert.match(ui, /text: `\$\{r\.workName \|\| 'Travaux'\}\$\{location \? ' — ' \+ location : ''\}/);
  assert.match(ui, /class="works-location"> — \$\{worksEsc\(locationText\)\}/);
});

test('HOTFIX43 incidents page is split Works-left / Incidents-right with large icons and no legacy bottom heading', () => {
  const index = read('index.html');
  const css = read('style.css');
  const splitPos = index.indexOf('class="operations-split"');
  const worksPos = index.indexOf('operations-column-works', splitPos);
  const incidentsPos = index.indexOf('operations-column-incidents', splitPos);
  assert.ok(splitPos >= 0 && worksPos > splitPos && incidentsPos > worksPos);
  assert.match(index, /op-icon-works operations-column-icon/);
  assert.match(index, /op-icon-warn operations-column-icon/);
  assert.doesNotMatch(index, />Travaux programmes<\/h3>/);
  assert.match(css, /\.operations-column-icon\s*\{\s*width:58px;\s*height:58px;/);
  assert.match(css, /\.operations-split\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test('HOTFIX43 FILE bundle contains the same runtime changes', () => {
  const bundle = read('js/rail-empire.file.bundle.js');
  assert.match(bundle, /HOTFIX43-WORKS-UI-SPLIT-BANNER/);
  assert.match(bundle, /const bannerWorks = document\.getElementById\('alert-banner-works'\)/);
  assert.match(bundle, /const worksItems = \[\]/);
  assert.match(bundle, /setBanner\(bannerWorks, worksItems\)/);
  assert.match(bundle, /entre \$\{a\} et \$\{b\}/);
});
