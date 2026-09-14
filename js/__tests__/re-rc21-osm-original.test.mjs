import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TileMap} from '../map.js';
import {TileAccessPolicy,OSM_STANDARD_URL,validateBaseMapSource} from '../tile-access-policy.js';
import {MapSourcePanel} from '../map-source-panel.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const flush=()=>new Promise(r=>setImmediate(r));
function setup(t,protocol='https:'){
 const saved=new Map();class Image{set src(x){this._src=x;}get src(){return this._src;}}
 for(const [key,value] of Object.entries({Image,location:{protocol},localStorage:memory()})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const map=new TileMap();map.zoomLevel=8;map._lastQueueZoom=8;map._lastRoundedZoom=8;
 t.after(()=>{map.dispose();for(const[k,d]of saved)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});return map;
}
function canvas(t,map){
 const draws=[];const context={filter:'none',globalAlpha:1,canvas:null,drawImage(...args){draws.push({filter:this.filter,alpha:this.globalAlpha,args});},setTransform(){},clearRect(){},fillRect(){},save(){},restore(){}};
 const doc={visibilityState:'visible',createElement(){return {width:256,height:256,getContext:()=>context};}};
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:doc,configurable:true,writable:true});
 t.after(()=>old?Object.defineProperty(globalThis,'document',old):delete globalThis.document);
 const ll=map.globalPixelToLatLon(128.5*256,88.5*256,8);map.centerLat=ll.lat;map.centerLon=ll.lon;map.railEnabled=false;
 return {context,draws};
}
test('RC21 OSM selection replaces both satellite and night imagery',t=>{
 const m=setup(t);m.satelliteEnabled=true;m.nightMapEnabled=true;m.selectOSMStandard();
 assert.equal(m.basicMode,true);assert.equal(m.satelliteEnabled,false);assert.equal(m.nightMapEnabled,false);assert.equal(m.getBaseMapSource().url,OSM_STANDARD_URL);
});
test('RC21 OSM selection replaces a custom provider only on explicit request',t=>{
 const m=setup(t);m.setBaseMapSource({url:'https://example.test/{z}/{x}/{y}.png',attribution:'Example',maxZoom:18});
 m.selectOSMStandard();assert.deepEqual(m.getBaseMapSource(),{url:OSM_STANDARD_URL,attribution:'© OpenStreetMap contributors',maxZoom:19});
});
test('RC21 original OSM and ORM are independent display layers',t=>{
 const m=setup(t);m.railEnabled=true;m.selectOSMStandard();assert.equal(m.railEnabled,true);
 m.railEnabled=false;m.toggleBasic();m.toggleBasic();assert.equal(m.railEnabled,false);assert.equal(m.basicMode,true);
});
test('RC21 switching original/dark retains decoded bytes and does not fetch',t=>{
 const m=setup(t);m._zoomSettled=false;const tile=m.getTile(128,88,8,OSM_STANDARD_URL);tile.loaded=true;tile.img={};
 m.selectOSMStandard();m.toggleBasic();m.selectOSMStandard();assert.equal(m.getTile(128,88,8,OSM_STANDARD_URL),tile);assert.equal(m.networkStats.started,0);
});
test('RC21 original OSM renders without invert/filter/alpha tint',t=>{
 const m=setup(t),{context,draws}=canvas(t,m);m.selectOSMStandard();const requests=[];
 m.getTile=(x,y,z,url)=>{requests.push({x,y,z,url});return {loaded:true,img:{},error:false};};
 m.renderTiles(context,256,256);assert.equal(requests.length,1);assert.equal(requests[0].url,OSM_STANDARD_URL);
 assert.equal(draws[0].filter,'none');assert.equal(draws[0].alpha,1);assert.equal(m.hasVisibleBaseTiles(),true);
});
test('RC21 no received base pixels is not reported as a displayed map',t=>{
 const m=setup(t),{context}=canvas(t,m);m.selectOSMStandard();m.getTile=()=>({loaded:false,img:null,error:true});
 m.renderTiles(context,256,256);assert.equal(m.hasVisibleBaseTiles(),false);
});
test('RC21 native zoom is capped at 19 without fetching other zoom stacks',t=>{
 const m=setup(t),{context}=canvas(t,m);m.zoomLevel=21;m.selectOSMStandard();const requests=[];
 m.getTile=(x,y,z,url)=>{requests.push({x,y,z,url});return {loaded:true,img:{},error:false};};m.renderTiles(context,256,256);
 assert.ok(requests.length>0);assert.ok(requests.every(r=>r.z===19&&r.url===OSM_STANDARD_URL));
});
test('RC21 selecting OSM never resets a persisted 403',t=>{
 const m=setup(t);m.tileAccess.failure(OSM_STANDARD_URL,403);const before=m.getBaseMapAccess();m.setSatelliteEnabled(true);m.selectOSMStandard();
 assert.deepEqual(m.getBaseMapAccess(),before);assert.equal(m.resumeBaseMap(),false);assert.equal(m.networkStats.started,0);
 const p=new TileAccessPolicy(globalThis.localStorage);assert.equal(p.state(OSM_STANDARD_URL,'https:').kind,'forbidden');
});
test('RC21 selecting OSM never erases a user pause or Retry-After',t=>{
 const m=setup(t);m.tileAccess.failure(OSM_STANDARD_URL,429,'3600');m.pauseBaseMap();const state=m.getBaseMapAccess();m.selectOSMStandard();assert.deepEqual(m.getBaseMapAccess(),state);assert.equal(m.resumeBaseMap(),false);
});
test('RC21/RC22 opaque document remains blocked, including explicit OSM selection',t=>{
 const m=setup(t,'data:');m.selectOSMStandard();m.getTile(128,88,8,OSM_STANDARD_URL);assert.equal(m.getBaseMapAccess().kind,'local-file');assert.equal(m.networkStats.started,0);
});
test('RC21 OSM transfer uses real browser referrer/default cache and no forged identity',async t=>{
 const m=setup(t);const requests=[];t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return new Response('',{status:403});});
 m.selectOSMStandard();m.getTile(128,88,8,OSM_STANDARD_URL);await flush();assert.equal(requests.length,1);assert.equal(requests[0].url,'https://tile.openstreetmap.org/8/128/88.png');
 const o=requests[0].options;assert.equal(o.cache,'default');assert.equal(o.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(o.credentials,'omit');assert.equal(o.headers,undefined);assert.equal(o.referrer,undefined);
});
test('RC21 repeated draws of a static blocked view start no more requests',async t=>{
 const m=setup(t),{context}=canvas(t,m);t.mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));m.selectOSMStandard();m.renderTiles(context,256,256);await flush();
 for(let i=0;i<100;i++){m.markDirty();m.renderTiles(context,256,256);}assert.equal(m.networkStats.started,1);
});
test('RC21 canonical OSM rejects query-token and alternate-host tricks',()=>{
 for(const url of [OSM_STANDARD_URL+'?nocache=1',OSM_STANDARD_URL.replace('https:','http:'),OSM_STANDARD_URL.replace('tile.','a.tile.')])assert.throws(()=>validateBaseMapSource({url,attribution:'© OpenStreetMap contributors',maxZoom:19}));
});
test('RC21 source-panel restore button selects displayed OSM, without auto-resuming',t=>{
 const m=setup(t),nodes=new Map(),handlers=new Map();m.satelliteEnabled=true;
 const button={addEventListener:(name,fn)=>handlers.set(name,fn)};nodes.set('[data-tile-standard]',button);
 const root={querySelector:s=>nodes.get(s)??null,classList:{toggle(){}}};const panel=new MapSourcePanel(m,root);handlers.get('click')();panel.update(true);
 assert.equal(m.basicMode,true);assert.equal(m.satelliteEnabled,false);
});
test('RC21 user help names canonical source, cache rules and refusal limitations',()=>{
 const html=fs.readFileSync(new URL('../../AIDE_CARTE_OSM.html',import.meta.url),'utf8');
 for(const needle of ['tile.openstreetmap.org','LANCER_RE.cmd','403','cache','Privacy_Policy','Terms_of_Use'])assert.ok(html.includes(needle),needle);
});

test('RC21 source status changes bypass the unchanged-countdown refresh throttle',t=>{
 const m=setup(t),text={textContent:''};
 const root={querySelector:s=>s==='[data-tile-status]'?text:null,classList:{toggle(){}}};
 const panel=new MapSourcePanel(m,root);assert.ok(text.textContent.includes('Chargement'));
 m.tileAccess.failure(OSM_STANDARD_URL,403);panel.update();
 assert.ok(text.textContent.includes('HTTP 403'),text.textContent);
});
