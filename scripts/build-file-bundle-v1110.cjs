const fs = require('fs');
const path = require('path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const jsRoot = path.join(root, 'js');
const outPath = path.join(jsRoot, 'rail-empire.file.bundle.js');
function walk(dir){
  let out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()){
      if(ent.name==='__tests__') continue;
      out=out.concat(walk(p));
    } else if(ent.isFile() && ent.name.endsWith('.js') && ent.name!=='rail-empire.file.bundle.js') out.push(p);
  }
  return out;
}
const files=walk(jsRoot).sort();
let out=`/* Rail Empire v1.1.43 FILE:// bundle\n   PERFORMANCE CORE REPAIR — static Livemap cache, idle fast paths, cached V2 timing and indexed movement limits. */\n(function(){\n'use strict';\nconst __modules=Object.create(null);\nconst __cache=Object.create(null);\nfunction __norm(p){const parts=[];for(const part of p.replace(/\\\\/g,'/').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}return parts.join('/');}\nfunction __resolve(parentId,spec){spec=String(spec).split('?')[0].split('#')[0];if(spec.startsWith('./')||spec.startsWith('../')){const base=parentId.slice(0,parentId.lastIndexOf('/')+1);let id=__norm(base+spec);if(!/\\.[A-Za-z0-9]+$/.test(id))id+='.js';return id;}let id=__norm(spec);if(!/\\.[A-Za-z0-9]+$/.test(id))id+='.js';return id;}\nfunction __require(id,parentId){id=String(id).split('?')[0].split('#')[0];id=__resolve(parentId||'js/main.js',id);if(__cache[id])return __cache[id].exports;const factory=__modules[id];if(!factory)throw new Error('Rail Empire bundle: module introuvable: '+id+' (depuis '+(parentId||'root')+')');const module={exports:{}};__cache[id]=module;const localRequire=(spec)=>__require(spec,id);factory(localRequire,module,module.exports);return module.exports;}\n\n`;
let n=0;
for(const file of files){
  const rel=path.relative(root,file).replace(/\\/g,'/');
  const src=fs.readFileSync(file,'utf8');
  const tr=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,allowJs:true,sourceMap:false,removeComments:false},fileName:rel}).outputText;
  out += `__modules[${JSON.stringify(rel)}]=function(require,module,exports){\n${tr}\n};\n\n`;
  n++;
}
out += `try { __require('js/main.js',''); } catch (e) {\n console.error('Rail Empire startup failure:', e);\n const box=document.createElement('pre'); box.id='rail-empire-startup-error';\n box.style.cssText='position:fixed;z-index:999999;left:10px;right:10px;bottom:10px;max-height:45vh;overflow:auto;background:#450a0a;color:#fecaca;border:2px solid #ef4444;padding:12px;border-radius:8px;white-space:pre-wrap;font:12px monospace';\n box.textContent='ERREUR DE DÉMARRAGE RAIL EMPIRE\\n'+(e&&e.stack?e.stack:String(e));\n document.body.appendChild(box);\n}\n})();\n`;
fs.writeFileSync(outPath,out);
console.log(JSON.stringify({modules:n,bytes:Buffer.byteLength(out),outPath}));
