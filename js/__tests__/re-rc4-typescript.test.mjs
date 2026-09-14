import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{dataOnly,anyDetails}=require('../../scripts/audit-typescript.cjs');
const names=['catalog-cargo-types-base','catalog-batch186-category-overrides','catalog-freight-batch186','catalog-freight-batch186-pass2'];
for(const name of names)test(`RC4-TS: all literal exports of ${name} preserve the RC3 catalogue`,async()=>{
 const before=await import(`../../QA/RE_REPAIR_RC4/reference/${name}.js`),after=await import(`../${name}.js`);
 for(const key of Object.keys(before))if(typeof before[key]!=='function')assert.deepEqual(after[key],before[key],key);
});
test('RC4-TS: all category and freight patches preserve the full original catalogue',async()=>{
 const {CATALOG}=await import('../catalog-data.js');let a=structuredClone(CATALOG),b=structuredClone(CATALOG);
 for(const [name,fn] of [['catalog-batch186-category-overrides','applyBatch186CategoryOverrides'],['catalog-freight-batch186','applyBatch186FreightToCatalog'],['catalog-freight-batch186-pass2','applyBatch186FreightPass2ToCatalog']]){
  const before=await import(`../../QA/RE_REPAIR_RC4/reference/${name}.js`),after=await import(`../${name}.js`);a=before[fn](a);b=after[fn](b);assert.deepEqual(b,a,fn);
 }
});
test('RC4-TS: industry additions and repeat-call idempotence remain unchanged',async()=>{
 const before1=await import('../../QA/RE_REPAIR_RC4/reference/catalog-freight-batch186.js');const after1=await import('../catalog-freight-batch186.js');
 const before2=await import('../../QA/RE_REPAIR_RC4/reference/catalog-freight-batch186-pass2.js');const after2=await import('../catalog-freight-batch186-pass2.js');
 const initial=Object.keys({...before1.BATCH186_INDUSTRY_CARGO_ADDITIONS,...before2.BATCH186_FREIGHT_PASS2_INDUSTRY_ADDITIONS}).map(type=>({type,cargoTypes:['test']}));
 const fixture=()=>({types:structuredClone(initial),colors:{},getIndustryTypes(){return this.types;},getIndustryColors(){return this.colors;}});const a=fixture(),b=fixture();
 for(let repeat=0;repeat<2;repeat++){
  assert.deepEqual(after1.applyBatch186IndustryFreightPatch(b),before1.applyBatch186IndustryFreightPatch(a));assert.deepEqual(after2.applyBatch186FreightPass2IndustryPatch(b),before2.applyBatch186FreightPass2IndustryPatch(a));assert.deepEqual(b.types,a.types);assert.deepEqual(b.colors,a.colors);
 }
});
test('RC4-TS: lazy loader returns all 63 chunks in source order and reports each progress event',async()=>{
 const {loadBatch186FullCatalogAdditions}=await import('../catalog-batch186-full-loader.js');const progress=[];
 const loaded=await loadBatch186FullCatalogAdditions((done,total,count)=>progress.push({done,total,count}));
 const expected=[];for(let i=1;i<=63;i++){const mod=await import(`../catalog-batch186-chunks/catalog-batch186-${String(i).padStart(3,'0')}.js?v=1195`);for(const row of mod.default)expected.push(row);}
 assert.deepEqual(loaded,expected);assert.equal(progress.length,63);assert.equal(progress.at(-1).count,loaded.length);assert.equal(progress.at(-1).done,63);assert.ok(progress.every((p,i)=>p.done===i+1&&p.total===63));
});
test('RC4-TS: data exemption accepts only JSON-equivalent module/global tables',()=>{
 for(const s of ['export const A=[1,-2,true,null,{x:"a"}];','export default [{x:2}];','window.__RAILNET_PACK__={x:3};'])assert.equal(dataOnly(s),true,s);
 for(const s of ['export const A=()=>1;','export const A=fetch("x");','export const A=[...foo];','export default {get x(){return 1}};','window.__RAILNET_PACK__=new Map();','export const A=1+2;'])assert.equal(dataOnly(s),false,s);
});
test('RC4-TS: AST counts generic and assertion any, not only :any declarations',()=>{
 assert.equal(anyDetails('probe.ts','type T=Record<string,any>;const x=foo as any;type U=Set<any>;const s="any"; // any').length,3);
});
test('RC4-TS: admin is separate from gameplay and has no inline executable script',()=>{
 const admin=fs.readFileSync(new URL('../../admin.html',import.meta.url),'utf8');const core=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');const standalone=fs.readFileSync(new URL('../rail-empire.admin.bundle.js',import.meta.url),'utf8');
 const build=JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8')).railEmpireBuild;const cacheVersion=build.match(/1199repair\d+/)?.[0];assert.ok(cacheVersion,'Build identifies a versioned cache');assert.ok(admin.includes(`rail-empire.admin.bundle.js?v=${cacheVersion}`));assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]+?<\/script>/i.test(admin));assert.ok(!core.includes('__modules["js/admin.js"]'));assert.ok(standalone.includes('__modules["js/admin.js"]'));assert.ok(standalone.includes("__require('js/admin.js','')"));
});
test('RC4-TS: admin source summary is bounded and counts sources in one pass',()=>{
 const code=fs.readFileSync(new URL('../admin.js',import.meta.url),'utf8');const a=code.indexOf('function updateStats() {'),b=code.indexOf('// ============ FILTER + SORT',a);assert.ok(a>=0&&b>a);
 const allItems=Array.from({length:10000},(_,i)=>({id:String(i),category:i%2?'wagon':'locomotive',_source:`source-${i%1000}`}));allItems.filter=()=>{throw Error('Repeated catalog filtering regresses source enumeration');};
 const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,{value:'source-7',replaceChildren(fragment){this.options=fragment.children;}});return elements.get(id);};
 const doc={createDocumentFragment:()=>({children:[],appendChild(child){this.children.push(child);}}),createElement:()=>({})};
 new Function('allItems','byId','document',code.slice(a,b)+';updateStats();')(allItems,byId,doc);
 assert.equal(byId('filter-source').options.length,1001);assert.equal(byId('filter-source').value,'source-7');assert.equal(byId('filter-source').options.find(x=>x.value==='source-7').textContent,'source-7 (10)');assert.ok(byId('stat-sources').textContent.length<60);assert.ok(byId('stat-sources').title.length<=240);
});
