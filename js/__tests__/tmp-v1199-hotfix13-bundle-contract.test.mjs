import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');
test('HOTFIX13 bundle identity/cache',()=>{
 assert.match(build,/HOTFIX16-MOVEMENT-AUTHORITY/);
 assert.match(build,/CACHE_VERSION = '1199repair24'/);
 assert.match(html,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
