// HOTFIX56 compatibility cache marker: 1199dep50
const fs = require('fs');
const path = require('path');
let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); } // CI fallback; npm install provides the portable dependency
const root = path.resolve(__dirname, '..');
const jsRoot = path.join(root, 'js');
const coreOutPath = path.join(jsRoot, 'rail-empire.file.bundle.js');
const catalogOutPath = path.join(jsRoot, 'rail-empire.catalog.bundle.js');
const adminOutPath = path.join(jsRoot, 'rail-empire.admin.bundle.js');
const BUNDLE_VERSION = '1.1.99';
const BUILD_ID = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).railEmpireBuild;
const BUNDLE_FLAVOR = BUILD_ID + '-HISTORY-S3-TYPESCRIPT-ALPHA23-FULL-AUDIT-TAXONOMY-CROSSSYSTEM-SC-HOTFIX16-MOVEMENT-AUTHORITY-HOTFIX38-GRAPH-STATION-SEARCH-HOTFIX40-DEPOT-ITE-WORKS-V2-LATEST-SC-HOTFIX41-CATALOG-ID-INDEX-HOTFIX42-WORKS-STATION-TRACK-FLOW-HOTFIX43-WORKS-UI-SPLIT-BANNER-HOTFIX44-WORKS-SC-ROUTING-PERF-INCIDENTS-INTERRUPTIONS-HOTFIX45-WORKS-WHITE-DETAILS-HOTFIX46-STATION-WORKS-TRAFFIC-GATE-HOTFIX47-LIVEMAP-ZOOM-LABELS-KEYLESS-BASEMAP-HOTFIX48-LIVEMAP-STATION-INCIDENT-WORK-ZONE-HOVER-HOTFIX49-DEPOT-ITE-PAGE-POINT-OBJECTS-HOTFIX50-DEPOT-OPERATIONS-WORKSPACE-HOTFIX51-DEPOT-EQUIPMENT-TRACKS-SEARCH-WIRING-HOTFIX52-PERSONNEL-DEPOT-STAFF-INTEGRATION-HOTFIX53-PERSONNEL-3X8-AUTO-ASSIGN-LEAVE-HR-INCIDENTS-PAYROLL-BONUS-RAISE-TRAINING-HOTFIX54-MATERIAL-FAMILY-AUTHORIZATIONS-HOTFIX55-WORLD-WEATHER-INTERACTIVE-RAIL-THRESHOLDS-HOTFIX56-WEATHER-INCIDENTS-THRESHOLDS-EXPOSURE-HOTFIX57-FREIGHT-TARIFFS-CARGO-CAPACITY-HOTFIX58-INFOGARE-LIVE-DATA-CONSISTENCY-HOTFIX59-AFL-DP-ACHEMINE-TEMPLATE-HOTFIX60-RAMES-MULTI-WAGON-RANDOM-750M-HOTFIX61-ROULEMENTS-CONTROL-CENTER-READABILITY-HOTFIX62-ROULEMENTS-100PCT-READABILITY-HOTFIX63-ROULEMENTS-CLARITY-FIRST-WORKFLOW-HOTFIX64-OPTIONAL-ROULEMENTS-PERSONNEL-BEGINNER-MODE-HOTFIX65-SCHEDULE-TERMINUS-VMAX-TIMING-FIX-HOTFIX66-SCHEDULE-DIRECT-RAME-BUTTON-HOTFIX67-LIVEMAP-FRENCH-VOICE-LOCK-HOTFIX68-LIVEMAP-MULTILINGUAL-NEURAL-STATION-VOICES-HOTFIX69-LIVEMAP-INCIDENT-TAIL-CLEARANCE-PIPER-COLD-START-HOTFIX70-TERMINUS-DESPAWN-GPS-WEATHER-NIGHT-MAP-HOTFIX71-GPS-TRUE-NIGHT-SATELLITE-HOTFIX72-ANTONY-ARRIVAL-PRIORITY-GPS-NIGHT-STABILITY-HOTFIX73-GPS-LOADER-MEMORY-FREEZE-FIX-HOTFIX74-FORCED-LIVEMAP-AUDIO-HOTFIX75-AUDIO-ROOT-CAUSE-SESSION-ISOLATION-HOTFIX76-GRAPH-ZOOM-PAN-TRAIN-LABELS-HOTFIX77-GRAPH-ULTRAZOOM-32X-HOTFIX78-GRAPH-THEORETICAL-V2-HOTFIX79-GRAPH-SEMANTIC-TIME-ALWAYS-VISIBLE-LABELS-HOTFIX80-GRAPH-MOUSE-NAV-FOLDER-CLEANUP-HOTFIX81-RUNTIME-SC-LIVEMAP-RAME-BUGFIXES-HOTFIX82-OFFPAGE-SIMULATION-RELOAD-TIMETABLE-CATCHUP-HOTFIX83-BACKGROUND-TAB-SIMULATION-DIRECTIONAL-TIMING-HOTFIX84-TRAFFIC-CLASS-INCIDENTS-EMPTY-MOVEMENTS';
// HOTFIX55 previous weather cache: 1199dep49 (compatibility marker only)
// HOTFIX61 compatibility: const CACHE_VERSION = '1199dep55'
// HOTFIX62 compatibility: const CACHE_VERSION = '1199dep56'
// HOTFIX63 compatibility: const CACHE_VERSION = '1199dep57'
// HOTFIX65 compatibility: const CACHE_VERSION = '1199dep59'
// HOTFIX68 multilingual compatibility: const CACHE_VERSION = '1199dep63'
// HOTFIX69 LiveMap runtime fixes: const CACHE_VERSION = '1199dep64'
// HOTFIX70 terminus despawn + GPS visual weather/night map: const CACHE_VERSION = '1199dep65'
// HOTFIX71 GPS true night satellite composite: const CACHE_VERSION = '1199dep66'
// HOTFIX72 Antony arrival priority + low-memory night GPS: const CACHE_VERSION = '1199dep67'
// HOTFIX73 GPS loader accounting + bounded raster memory: const CACHE_VERSION = '1199dep68'
// HOTFIX74 forced LiveMap audio: const CACHE_VERSION = '1199dep69'
// HOTFIX75 audio root-cause + multilingual Piper session isolation: const CACHE_VERSION = '1199dep70'
// HOTFIX77 graph ultra zoom 32x: const CACHE_VERSION = '1199dep72'
// HOTFIX78 graph theoretical V2: const CACHE_VERSION = '1199dep73'
// HOTFIX79 graph semantic time scale + always-visible train labels: const CACHE_VERSION = '1199dep74'
// HOTFIX80 graph mouse wheel/drag navigation + package cleanup: const CACHE_VERSION = '1199dep75'
// HOTFIX81 SC short-route/topology + LiveMap physics/refresh/audio + rame km: const CACHE_VERSION = '1199dep76'
// HOTFIX82 off-page simulation debt + timetable-aware stale-save reload: const CACHE_VERSION = '1199dep77'
// HOTFIX83 background-tab heartbeat + directional OSM timing symmetry fallback: const CACHE_VERSION = '1199dep78'
// SAISON 3 TYPESCRIPT ALPHA 1: const CACHE_VERSION = '1199ts1'
// SAISON 3 TYPESCRIPT ALPHA 15: + rotation-v2-editor + livemap-train-announcer + schedule-v2-editor
// SAISON 3 TYPESCRIPT ALPHA 16: + renderer + main
// SAISON 3 TYPESCRIPT ALPHA 17: + industrial-clients + schedule-creator
// HOTFIX10 legacy-test compatibility: CACHE_VERSION = '1199dep78'
// SAISON 3 TYPESCRIPT ALPHA 18: + orm + railgraph-pack
// SAISON 3 TYPESCRIPT ALPHA 19: + ui (final application module)
// SAISON 3 TYPESCRIPT ALPHA 20: final TypeScript port freeze/audit
// SAISON 3 TYPESCRIPT ALPHA 22: typed runtime/persistence hardening
// SAISON 3 TYPESCRIPT ALPHA 23: Schedule V2 routing/validation type contracts + deterministic QA gate
const CACHE_VERSION = '1199repair24';

function walk(dir){
  let out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()){
      if(ent.name==='__tests__') continue;
      out=out.concat(walk(p));
    } else if(ent.isFile() && ent.name.endsWith('.js') &&
              ent.name!=='admin.js' && !ent.name.endsWith('.bundle.js')) out.push(p);
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
  const tr=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,allowJs:true,sourceMap:false,removeComments:rel==='js/livemap-train-announcer.js'?false:true},fileName:rel}).outputText;
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

// The admin entry is compiled independently and is never executed by gameplay.
// Reuse the exact CommonJS loader, without game/catalog startup side effects.
const adminFiles=['storage-codec.js','storage-auxiliary.js','html-text.js','catalog-contracts.js','catalog-data.js','catalog-data-pack-re.js','admin.js'].map(name=>path.join(jsRoot,name));
const runtimePrelude=core.slice(core.indexOf('(function(){'),core.indexOf('const __state=globalThis.__RAIL_EMPIRE_FILE_BUNDLE__'));
let admin=`/* Rail Empire ${BUNDLE_VERSION} GENERATED ADMIN bundle; ${BUNDLE_FLAVOR}. Source: src/ts/admin.ts. */\n`+runtimePrelude;
for(const file of adminFiles) admin += moduleFactory(file);
admin += `__require('js/admin.js','');\n})();\n`;
fs.writeFileSync(adminOutPath,admin);

// Keep both executable HTML entries on the same generated release. Preserve
// archived cache markers in HTML comments used by historical regression tests.
for (const [entry, bundle] of [['index.html','rail-empire.file.bundle.js'], ['admin.html','rail-empire.admin.bundle.js']]) {
  const file = path.join(root, entry);
  const escaped = bundle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(' + escaped + '\\?v=)[^\\s\"\'&<>]+', 'g');
  const html = fs.readFileSync(file, 'utf8').split(/(<!--[\s\S]*?-->)/g).map(part =>
    part.startsWith('<!--') ? part : part.replace(pattern, '$1' + CACHE_VERSION)
  ).join('');
  fs.writeFileSync(file, html);
}

console.log(JSON.stringify({
  version:BUNDLE_VERSION,
  coreModules:coreFiles.length,
  catalogModules:catalogFiles.length,
  coreBytes:Buffer.byteLength(core),
  catalogBytes:Buffer.byteLength(catalog),
  coreOutPath,catalogOutPath,adminOutPath,adminModules:adminFiles.length,adminBytes:Buffer.byteLength(admin)
}));
