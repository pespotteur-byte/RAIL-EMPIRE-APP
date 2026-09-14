import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TileMap} from '../map.js';
import {MapSourcePanel} from '../map-source-panel.js';
import {TileAccessPolicy, OSM_STANDARD_URL, OSM_LOCAL_APPLICATION_ID, tileRequestOptions, tileResponseBlockReason} from '../tile-access-policy.js';
const flush = () => new Promise(r => setImmediate(r));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function setup(t,protocol='file:') {
 const saved=new Map(),images=[];
 class Image { constructor(){images.push(this);} set src(value){this._src=value;} get src(){return this._src;} }
 for(const [k,value] of Object.entries({Image,location:{protocol},localStorage:memory()})) {
  saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 }
 const m=new TileMap();m.zoomLevel=8;m._lastQueueZoom=8;m._lastRoundedZoom=8;
 t.after(()=>{m.dispose();for(const[k,d]of saved)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});
 return {m,images};
}
test('RC22 local HTML adds truthful stable app identity with ordinary HTTP cache',()=>{
 const c=new AbortController(),o=tileRequestOptions(OSM_STANDARD_URL,'file:',c.signal);
 assert.equal(OSM_LOCAL_APPLICATION_ID,'RailEmpire');
 assert.deepEqual(o.headers,{'X-Requested-With':'RailEmpire'});
 assert.equal(o.cache,'default');assert.equal(o.mode,'cors');assert.equal(o.credentials,'omit');assert.equal(o.signal,c.signal);
 assert.equal(o.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(o.referrer,undefined);
 const h=new Headers(o.headers);for(const name of ['Referer','User-Agent','Origin','Cache-Control','Pragma'])assert.equal(h.has(name),false,name);
});
test('RC22 app header is not leaked to other providers or spoofed host names',()=>{
 for(const url of ['https://tiles.openrailwaymap.org/standard/0/0/0.png','https://tile.openstreetmap.org.evil.test/0/0/0.png','https://satellite.test/0.png'])
  assert.equal(tileRequestOptions(url,'file:').headers,undefined);
});
test('RC22 HTTP pages retain genuine browser Referer path without extra headers',()=>{
 for(const protocol of ['http:','https:']) {
  const o=tileRequestOptions(OSM_STANDARD_URL,protocol);assert.equal(o.headers,undefined);assert.equal(o.referrer,undefined);assert.equal(o.cache,'default');
 }
});
test('RC22 HTML file is eligible but not allowed to clear an existing provider refusal',()=>{
 const s=memory(),p=new TileAccessPolicy(s);assert.equal(p.state(OSM_STANDARD_URL,'file:').kind,'ready');
 p.failure(OSM_STANDARD_URL,403,null,100);
 assert.equal(new TileAccessPolicy(s).state(OSM_STANDARD_URL,'file:',9999999).kind,'forbidden');
 assert.equal(p.resume(OSM_STANDARD_URL,'file:',101),false);
});
test('RC22 recognized denial header does not conflate an HTTP 200 with HTTP 403',()=>{
 for(const value of ['referer','blocked application','true'])assert.equal(tileResponseBlockReason(new Headers({'x-blocked':value})),value);
 for(const value of ['', 'false','no','0','none'])assert.equal(tileResponseBlockReason(new Headers({'x-blocked':value})),null);
 assert.equal(tileResponseBlockReason(new Headers()),null);
 assert.equal(tileResponseBlockReason(new Headers({'x-blocked':'x'.repeat(400)})).length,240);
 const p=new TileAccessPolicy(null),s=p.failure(OSM_STANDARD_URL,200,null,100,'referer');
 assert.equal(s.kind,'forbidden');assert.equal(s.status,200);assert.equal(s.blockedReason,'referer');assert.equal(s.manual,true);
});
test('RC22 denial reason survives reload and resumes only on explicit eligible request',()=>{
 const store=memory(),p=new TileAccessPolicy(store);p.failure(OSM_STANDARD_URL,200,'1800',100,'blocked app');
 const q=new TileAccessPolicy(store);assert.equal(q.state(OSM_STANDARD_URL,'file:',200).blockedReason,'blocked app');
 assert.equal(q.resume(OSM_STANDARD_URL,'file:',1800099),false);assert.equal(q.resume(OSM_STANDARD_URL,'file:',1800101),true);
 assert.equal(q.state(OSM_STANDARD_URL,'file:',1800101).kind,'ready');
});
test('RC22 real tile pipeline in local mode uses one identified fetch and only a blob image URL',async t=>{
 const {m,images}=setup(t);const calls=[],revoked=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response(new Blob(['png'],{type:'image/png'}));});
 const revoke=URL.revokeObjectURL.bind(URL);t.mock.method(URL,'revokeObjectURL',url=>{revoked.push(url);revoke(url);});
 const tile=m.getTile(128,88,8,OSM_STANDARD_URL);await flush();
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://tile.openstreetmap.org/8/128/88.png');
 assert.deepEqual(calls[0].options.headers,{'X-Requested-With':'RailEmpire'});
 const image=images[0],src=image.src;assert.match(src,/^blob:/);image.onload();
 assert.equal(tile.loaded,true);assert.deepEqual(revoked,[src]);assert.equal(m._baseLoading,0);
 for(let i=0;i<40;i++){m.selectOSMStandard();m.getTile(128,88,8,OSM_STANDARD_URL);}assert.equal(calls.length,1);
});
test('RC22 CORS failure does not fall back to an unidentified Image URL or another host',async t=>{
 const {m,images}=setup(t);let count=0;
 t.mock.method(globalThis,'fetch',async()=>{count++;throw new TypeError('CORS blocked');});
 m.getTile(128,88,8,OSM_STANDARD_URL);await flush();
 assert.equal(m.getBaseMapAccess().kind,'unavailable');assert.equal(m.getBaseMapAccess().status,null);
 assert.ok(images.every(i=>!i.src||!i.src.startsWith('http')));
 for(let i=0;i<100;i++)m.getTile(128,88,8,OSM_STANDARD_URL);assert.equal(count,1);
});
test('RC22 absent fetch fails closed rather than using an anonymous OSM Image request',t=>{
 const {m,images}=setup(t),old=Object.getOwnPropertyDescriptor(globalThis,'fetch');
 Object.defineProperty(globalThis,'fetch',{value:undefined,configurable:true,writable:true});
 t.after(()=>Object.defineProperty(globalThis,'fetch',old));
 m.getTile(128,88,8,OSM_STANDARD_URL);
 assert.equal(m.getBaseMapAccess().kind,'unavailable');assert.equal(m._baseLoading,0);
 assert.ok(images.every(i=>!i.src||!i.src.startsWith('http')));
});
test('RC22 HTTP 200 blocked image halts queue and aborts peer requests before decoding',async t=>{
 const {m,images}=setup(t),calls=[];
 t.mock.method(globalThis,'fetch',(url,options)=>new Promise(resolve=>calls.push({url,options,resolve})));
 for(let i=0;i<25;i++)m.getTile(i,88,8,OSM_STANDARD_URL);assert.equal(calls.length,4);
 calls[0].resolve(new Response(new Blob(['error tile'],{type:'image/png'}),{status:200,headers:{'x-blocked':'application','Retry-After':'1800'}}));
 await flush();assert.equal(m.getBaseMapAccess().kind,'forbidden');assert.equal(m.getBaseMapAccess().status,200);
 assert.equal(m._baseLoading,0);assert.equal(m._baseQueue.length,0);assert.ok(calls.slice(1).every(c=>c.options.signal.aborted));
 assert.ok(images.every(i=>!i.src||!i.src.startsWith('blob:')));
 for(let i=0;i<50;i++){m.selectOSMStandard();m.getTile(i,89,8,OSM_STANDARD_URL);}assert.equal(calls.length,4);
});
test('RC22 local HTTP 403 remains a persistent manual stop without retries',async t=>{
 const {m}=setup(t);let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return new Response('',{status:403});});
 m.getTile(128,88,8,OSM_STANDARD_URL);await flush();m.selectOSMStandard();m.getTile(129,88,8,OSM_STANDARD_URL);
 assert.equal(count,1);assert.equal(m.resumeBaseMap(),false);assert.equal(m.getBaseMapAccess().status,403);
 assert.equal(new TileAccessPolicy(globalThis.localStorage).state(OSM_STANDARD_URL,'file:').kind,'forbidden');
});
test('RC22 local 429 respects Retry-After without erasing app identity',async t=>{
 const {m}=setup(t);let now=100000;const calls=[];t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push(options);return new Response('',{status:429,headers:{'Retry-After':'120'}});});
 m.getTile(128,88,8,OSM_STANDARD_URL);await flush();assert.equal(m.getBaseMapAccess().until,220000);
 now=219999;m.getTile(129,88,8,OSM_STANDARD_URL);assert.equal(calls.length,1);
 now=220001;m.getTile(129,88,8,OSM_STANDARD_URL);await flush();assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.headers['X-Requested-With']==='RailEmpire'));
});
test('RC22 multiple local editors share the four-request service budget',t=>{
 const {m}=setup(t),other=new TileMap();other.zoomLevel=8;other._lastQueueZoom=8;other._lastRoundedZoom=8;t.after(()=>other.dispose());
 const calls=[];t.mock.method(globalThis,'fetch',(url,options)=>new Promise(()=>calls.push({url,options})));
 for(let i=0;i<20;i++){m.getTile(i,88,8,OSM_STANDARD_URL);other.getTile(i,89,8,OSM_STANDARD_URL);}
 assert.equal(calls.length,4);assert.equal(m._baseLoading+other._baseLoading,4);
 assert.ok(calls.every(c=>c.options.headers['X-Requested-With']==='RailEmpire'));
 // Dispose the second map before setup restores the shared browser globals.
 other.dispose();
});
test('RC22 leaving the local map cancels fetch and rejects late responses without blob leaks',async t=>{
 const {m,images}=setup(t);let resolve,options;let created=0;
 t.mock.method(globalThis,'fetch',(url,o)=>{options=o;return new Promise(r=>resolve=r);});
 t.mock.method(URL,'createObjectURL',()=>{created++;return 'blob:test';});
 m.getTile(128,88,8,OSM_STANDARD_URL);m.setNetworkEnabled(false);assert.equal(options.signal.aborted,true);
 resolve(new Response(new Blob(['png'],{type:'image/png'})));await flush();
 assert.equal(created,0);assert.equal(m._baseLoading,0);assert.ok(images.every(i=>!i.src));
});
test('RC22 local mode diagnostics never demand a launcher and honestly label 200+x-blocked',t=>{
 const {m}=setup(t),text={textContent:''},root={querySelector:s=>s==='[data-tile-status]'?text:null,classList:{toggle(){}}};
 const panel=new MapSourcePanel(m,root);assert.match(text.textContent,/Chargement/);assert.doesNotMatch(text.textContent,/cmd|serveur|HTTP requis/i);
 m.tileAccess.failure(OSM_STANDARD_URL,200,null,Date.now(),'referer');panel.update();
 assert.match(text.textContent,/x-blocked ; réponse HTTP 200/);assert.doesNotMatch(text.textContent,/HTTP 403/);
});
test('RC22 help provides direct index.html launch, app-header rationale and storage precautions',()=>{
 const html=fs.readFileSync(new URL('../../AIDE_CARTE_OSM.html',import.meta.url),'utf8');
 for(const needle of ['index.html','X-Requested-With','RailEmpire','wiki.openstreetmap.org/wiki/Referer','Ne videz pas','file://'])assert.ok(html.includes(needle),needle);
 assert.doesNotMatch(html,/lancez <strong>LANCER_RE.cmd/);
});
