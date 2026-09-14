import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('HOTFIX38 FILE bundle contains Graphique station autocomplete in current cache',()=>{
  const index=read('../../index.html');
  const bundle=read('../rail-empire.file.bundle.js');
  const build=read('../../scripts/build-file-bundle-v1199.cjs');
  { const m=index.match(/1199(dep|ts|repair)(\d+)&fullaudit=1/); assert.ok(m); assert.ok(m[1] === 'repair' ? Number(m[2]) >= 1 : m[1] === 'dep' ? Number(m[2]) >= 31 : Number(m[2]) >= 20); }
  { const m=bundle.match(/rail-empire\.catalog\.bundle\.js\?v=1199(dep|ts|repair)(\d+)/); assert.ok(m); assert.ok(m[1] === 'repair' ? Number(m[2]) >= 1 : m[1] === 'dep' ? Number(m[2]) >= 31 : Number(m[2]) >= 20); }
  assert.match(build,/HOTFIX38-GRAPH-STATION-SEARCH/);
  for(const token of ['_stationSearchMatches','gm-station-${side}-search','Rechercher une gare…','Aucune gare trouvée','service actif']) assert.ok(bundle.includes(token), token);
  assert.ok(!bundle.includes('<select id="gm-station-a"'), 'old Gare A select must be gone');
  assert.ok(!bundle.includes('<select id="gm-station-b"'), 'old Gare B select must be gone');
});
