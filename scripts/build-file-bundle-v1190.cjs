const fs = require('fs');
const path = require('path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const jsRoot = path.join(root, 'js');
const coreOutPath = path.join(jsRoot, 'rail-empire.file.bundle.js');
const catalogOutPath = path.join(jsRoot, 'rail-empire.catalog.bundle.js');
const BUNDLE_VERSION = '1.1.90';
const BUNDLE_FLAVOR = 'ROULEMENTS-V3.2-PLAYER-100';
const CACHE_VERSION = '1188';

function walk(dir){
  let out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()){
      if(ent.name==='__tests__') continue;
      out=out.concat(walk(p));
    } else if(ent.isFile() && ent.name.endsWith('.js') &&
              ent.name!=='rail-empire.file.bundle.js' && ent.name!=='rail-empire.catalog.bundle.js') out.push(p);
  }
  return out;
}

function isDeferredCatalog(rel){
  return rel==='js/catalog-data.js' ||
         rel==='js/catalog-data-pack-re.js' ||
         rel==='js/catalog-identity-batch186.js' ||
         rel.startsWith('js/catalog-batch186-chunks/');
}

function moduleFactory(file){
  const rel=path.relative(root,file).replace(/\\/g,'/');
  const src=fs.readFileSync(file,'utf8');
  const tr=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,allowJs:true,sourceMap:false,removeComments:false},fileName:rel}).outputText;
  return `__modules[${JSON.stringify(rel)}]=function(require,module,exports){\n${tr}\n};\n\n`;
}

const files=walk(jsRoot).sort();
const coreFiles=[];
const catalogFiles=[];
for(const file of files){
  const rel=path.relative(root,file).replace(/\\/g,'/');
  (isDeferredCatalog(rel)?catalogFiles:coreFiles).push(file);
}

let core=`/* Rail Empire v${BUNDLE_VERSION} FILE:// CORE bundle\n   Build: ${BUNDLE_FLAVOR}\n   PERF: gameplay/Livemap only. Heavy rolling-stock catalogue is deferred. */\n(function(){\n'use strict';\nconst __modules=Object.create(null);\nconst __cache=Object.create(null);\nfunction __norm(p){const parts=[];for(const part of p.replace(/\\\\/g,'/').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}return parts.join('/');}\nfunction __resolve(parentId,spec){spec=String(spec).split('?')[0].split('#')[0];if(spec.startsWith('./')||spec.startsWith('../')){const base=parentId.slice(0,parentId.lastIndexOf('/')+1);let id=__norm(base+spec);if(!/\\.[A-Za-z0-9]+$/.test(id))id+='.js';return id;}let id=__norm(spec);if(!/\\.[A-Za-z0-9]+$/.test(id))id+='.js';return id;}\nfunction __require(id,parentId){id=String(id).split('?')[0].split('#')[0];id=__resolve(parentId||'js/main.js',id);if(__cache[id])return __cache[id].exports;const factory=__modules[id];if(!factory)throw new Error('Rail Empire bundle: module introuvable: '+id+' (depuis '+(parentId||'root')+')');const module={exports:{}};__cache[id]=module;const localRequire=(spec)=>__require(spec,id);factory(localRequire,module,module.exports);return module.exports;}\nconst __state=globalThis.__RAIL_EMPIRE_FILE_BUNDLE__={modules:__modules,cache:__cache,require:__require,catalogLoaded:false,catalogPromise:null};\nglobalThis.__railEmpireEnsureCatalogBundle=function(){\n  if(__state.catalogLoaded)return Promise.resolve(true);\n  if(__state.catalogPromise)return __state.catalogPromise;\n  __state.catalogPromise=new Promise((resolve,reject)=>{\n    const script=document.createElement('script');\n    script.src='js/rail-empire.catalog.bundle.js?v=${CACHE_VERSION}';\n    script.async=true;\n    script.onload=()=>{if(__state.catalogLoaded)resolve(true);else reject(new Error('Bundle catalogue chargé sans enregistrement des modules.'));};\n    script.onerror=()=>reject(new Error('Impossible de charger le bundle catalogue différé.'));\n    (document.head||document.documentElement).appendChild(script);\n  }).catch(err=>{__state.catalogPromise=null;throw err;});\n  return __state.catalogPromise;\n};\n\n`;
for(const file of coreFiles) core += moduleFactory(file);
core += `try { __require('js/main.js',''); } catch (e) {\n console.error('Rail Empire startup failure:', e);\n const box=document.createElement('pre'); box.id='rail-empire-startup-error';\n box.style.cssText='position:fixed;z-index:999999;left:10px;right:10px;bottom:10px;max-height:45vh;overflow:auto;background:#450a0a;color:#fecaca;border:2px solid #ef4444;padding:12px;border-radius:8px;white-space:pre-wrap;font:12px monospace';\n box.textContent='ERREUR DE DÉMARRAGE RAIL EMPIRE\\n'+(e&&e.stack?e.stack:String(e));\n document.body.appendChild(box);\n}\n})();\n`;
fs.writeFileSync(coreOutPath,core);

let catalog=`/* Rail Empire v${BUNDLE_VERSION} FILE:// DEFERRED CATALOG bundle\n   Build: ${BUNDLE_FLAVOR}\n   Loaded only when a material-dependent page is opened. */\n(function(){\n'use strict';\nconst __state=globalThis.__RAIL_EMPIRE_FILE_BUNDLE__;\nif(!__state||!__state.modules)throw new Error('Rail Empire core bundle absent avant catalogue.');\nconst __modules=__state.modules;\n`;
for(const file of catalogFiles) catalog += moduleFactory(file);
catalog += `__state.catalogLoaded=true;\n})();\n`;
fs.writeFileSync(catalogOutPath,catalog);

console.log(JSON.stringify({
  version:BUNDLE_VERSION,
  coreModules:coreFiles.length,
  catalogModules:catalogFiles.length,
  coreBytes:Buffer.byteLength(core),
  catalogBytes:Buffer.byteLength(catalog),
  coreOutPath,catalogOutPath
}));
