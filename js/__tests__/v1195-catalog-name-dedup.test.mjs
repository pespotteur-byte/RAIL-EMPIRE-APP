import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
function parseArray(file,marker){
  const src=fs.readFileSync(file,'utf8');
  const start=src.indexOf(marker)+marker.length;
  const tail=src.slice(start).trimStart();
  let depth=0, inStr=false, esc=false, begin=-1;
  for(let i=0;i<tail.length;i++){
    const c=tail[i];
    if(begin<0){if(c==='['){begin=i;depth=1;} continue;}
    if(inStr){if(esc)esc=false; else if(c==='\\')esc=true; else if(c==='"')inStr=false; continue;}
    if(c==='"'){inStr=true;continue;}
    if(c==='[')depth++; else if(c===']'){depth--;if(depth===0)return JSON.parse(tail.slice(begin,i+1));}
  }
  throw new Error('array not found '+file);
}
function norm(s){return String(s??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');}
function loadAll(){
  const base=parseArray(path.join(root,'js/catalog-data.js'),'export const CATALOG =');
  const pack=parseArray(path.join(root,'js/catalog-data-pack-re.js'),'export const CATALOG_PACK_RE =');
  const dir=path.join(root,'js/catalog-batch186-chunks');
  const chunks=[];
  for(const fn of fs.readdirSync(dir).filter(x=>x.endsWith('.js')).sort()) chunks.push(...parseArray(path.join(dir,fn),'export default'));
  return [...base,...chunks,...pack];
}
test('v1.1.95 keeps the full 36,307-entry catalogue and every id unique',()=>{
  const all=loadAll();
  assert.equal(all.length,36307);
  assert.equal(new Set(all.map(x=>x.id)).size,36307);
});
test('v1.1.95 catalogue has zero duplicate display names after normalization',()=>{
  const all=loadAll();
  const counts=new Map();
  for(const e of all){const k=norm(e.name);counts.set(k,(counts.get(k)||0)+1);}
  const dup=[...counts.entries()].filter(([,n])=>n>1);
  assert.deepEqual(dup,[]);
});
test('v1.1.95 disambiguates major SNCF families with documentary variants',()=>{
  const all=loadAll();
  const bb26=all.filter(x=>String(x.name).startsWith('BB 26000'));
  const bb22=all.filter(x=>String(x.name).startsWith('BB 22200'));
  const x735=all.filter(x=>String(x.name).startsWith('X 73500'));
  assert.ok(bb26.length>=23);
  assert.equal(new Set(bb26.map(x=>norm(x.name))).size,bb26.length);
  assert.ok(bb22.length>=27);
  assert.equal(new Set(bb22.map(x=>norm(x.name))).size,bb22.length);
  assert.ok(x735.length>=75);
  assert.equal(new Set(x735.map(x=>norm(x.name))).size,x735.length);
  assert.ok(bb26.some(x=>/Sybic|Livrée/i.test(x.name)));
  assert.ok(bb22.some(x=>/Petites cabines|Grandes cabines/i.test(x.name)));
});
test('v1.1.95 uses documentary labels instead of generic copy suffixes on corrected flagship ids',()=>{
  const all=loadAll();
  const ids=new Set(['cat-12462','cat-12464','cat-12133','cat-12140','cat-11536','cat-12542']);
  const checked=all.filter(x=>ids.has(x.id));
  assert.equal(checked.length,ids.size);
  for(const e of checked){
    assert.doesNotMatch(String(e.name),/\b(?:copie|copy|doublon)\b/i);
    assert.match(String(e.name),/ — /);
  }
});
test('v1.1.95 package identity and deferred catalogue cache are current',()=>{
  assert.equal(fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim(),'1.1.99');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'1.1.99');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
test('v1.1.95 deferred FILE catalogue bundle also exposes 36,307 unique display names',async()=>{
  const vm=await import('node:vm');
  const code=fs.readFileSync(path.join(root,'js/rail-empire.catalog.bundle.js'),'utf8');
  const state={modules:Object.create(null),catalogLoaded:false};
  const sandbox={__RAIL_EMPIRE_FILE_BUNDLE__:state,console};
  sandbox.globalThis=sandbox;
  vm.runInNewContext(code,sandbox,{filename:'rail-empire.catalog.bundle.js'});
  function exportsOf(id){
    const factory=state.modules[id];
    assert.equal(typeof factory,'function','missing bundled module '+id);
    const module={exports:{}};
    factory(()=>{throw new Error('unexpected require from '+id);},module,module.exports);
    return module.exports;
  }
  const base=exportsOf('js/catalog-data.js').CATALOG;
  const pack=exportsOf('js/catalog-data-pack-re.js').CATALOG_PACK_RE;
  const chunkIds=Object.keys(state.modules).filter(x=>x.startsWith('js/catalog-batch186-chunks/')&&x.endsWith('.js')).sort();
  const chunks=[];
  for(const id of chunkIds){const mod=exportsOf(id); chunks.push(...(mod.default||[]));}
  const all=[...base,...chunks,...pack];
  assert.equal(all.length,36307);
  const names=all.map(x=>norm(x.name));
  assert.equal(new Set(names).size,36307);
  assert.equal(state.catalogLoaded,true);
});
