import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ui = fs.readFileSync(path.join(here, '..', 'ui.js'), 'utf8');
const html = fs.readFileSync(path.join(here, '..', '..', 'index.html'), 'utf8');

test('Inventaire/Rames expose une taxonomie détaillée riche en plus des 4 catégories racines', () => {
  const taxonomyBlock = ui.match(/const STOCK_DETAIL_GROUPS = \[(.*?)\n\];/s)?.[1] || '';
  const codes = [...taxonomyBlock.matchAll(/\['([a-z0-9-]+)',\s*'[^']+'\]/g)].map(m => m[1]);
  assert.ok(codes.length >= 55, `taxonomie trop petite: ${codes.length}`);
  for (const code of ['loco-electric','loco-shunter','mu-electric','mu-battery','mu-highspeed','mu-suburban','mu-tramtrain','coach-driving','coach-sleeper','coach-restaurant','coach-doubledeck','wagon-tank','wagon-intermodal','wagon-auto','wagon-reefer','wagon-infra','role-powered','role-night','speed-gt200']) {
    assert.ok(codes.includes(code), `catégorie détaillée manquante: ${code}`);
  }
});

test('Inventaire et picker Rames ont les filtres Type/Traction/Pays/Opérateur/MLG', () => {
  for (const prefix of ['stock','rame']) {
    for (const suffix of ['detail-filter','traction-filter','country-filter','operator-filter','mlg-filter']) {
      assert.match(html, new RegExp(`id=["']${prefix}-${suffix}["']`));
    }
  }
  assert.match(ui, /_populateMaterialAdvancedFilters\('stock'/);
  assert.match(ui, /_populateMaterialAdvancedFilters\('rame'/);
  assert.match(ui, /identityCountry/);
  assert.match(ui, /identityOperator/);
  assert.match(ui, /mlgPathCategory/);
});

test('Liste des Rames possède des catégories de composition et état', () => {
  for (const id of ['rames-kind-filter','rames-traction-filter','rames-status-filter']) assert.match(html, new RegExp(`id=["']${id}["']`));
  for (const kind of ['passenger','freight','mixed','traction-only','multiple-unit','loco-hauled-passenger','loco-hauled-freight','high-speed','double-deck','night','infra','driving-trailer']) {
    assert.match(html, new RegExp(`value=["']${kind}["']`));
  }
  assert.match(ui, /_rameKindCodes\(r\)/);
});

test('Recherche matériel couvre aussi pays, opérateur, MLG et libellés détaillés', () => {
  assert.match(ui, /identityCountry[^\n]*toLowerCase/);
  assert.match(ui, /identityOperator[^\n]*toLowerCase/);
  assert.match(ui, /detailText\.includes/);
});
