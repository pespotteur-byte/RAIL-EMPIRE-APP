import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');
test('RC7-BUILD: executable HTML and deferred catalogue use the exact package release, not archived comment markers',()=>{
 const pkg=JSON.parse(read('package.json')), token=pkg.railEmpireBuild.match(/_(1199[a-z0-9]+)$/)?.[1];assert.ok(token);
 for(const[name,bundle]of[['index.html','rail-empire.file.bundle.js'],['admin.html','rail-empire.admin.bundle.js']]){
  const html=read(name).replace(/<!--[\s\S]*?-->/g,'');const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  assert.equal(scripts.filter(s=>s.includes(bundle)).length,1,name);assert.ok(scripts.some(s=>s.startsWith('js/'+bundle+'?v='+token)&&(s==='js/'+bundle+'?v='+token||s.startsWith('js/'+bundle+'?v='+token+'&'))),name);
 }
 assert.ok(read('js/rail-empire.file.bundle.js').includes('js/rail-empire.catalog.bundle.js?v='+token));assert.ok(read('scripts/build-file-bundle-v1199.cjs').includes("const CACHE_VERSION = '"+token+"'"));
});
