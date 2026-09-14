import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX45 works recurrence and section detail lines are white',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/font-size:10px;color:#ffffff[^>]*>Section /);
  assert.match(ui,/font-size:10px;color:#ffffff[^>]*>\$\{worksEsc\(w\.recurrence/);
});

test('HOTFIX45 FILE bundle/cache exposes white works details',()=>{
  const bundle=read('js/rail-empire.file.bundle.js');
  const index=read('index.html');
  assert.match(bundle,/HOTFIX45-WORKS-WHITE-DETAILS/);
  assert.match(bundle,/font-size:10px;color:#ffffff/);
  assert.match(index,/1199repair24&fullaudit=1/);
});
