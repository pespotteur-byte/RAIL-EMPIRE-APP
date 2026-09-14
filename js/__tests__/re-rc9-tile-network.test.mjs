import test from 'node:test';
import assert from 'node:assert/strict';
import { TileMap } from '../map.js';
import { TileAccessPolicy, OSM_STANDARD_URL, isOSMStandard, tileSourceKey, retryAfterDeadline, validateBaseMapSource } from '../tile-access-policy.js';
const source = OSM_STANDARD_URL;
const memory = () => { const data = new Map(); return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; };
const tick = () => new Promise(resolve=>setImmediate(resolve));
class FakeImage {
  static all = [];
  constructor(){ this.onload=null;this.onerror=null;this._src=''; FakeImage.all.push(this); }
  set src(value){ this._src=value; }
  get src(){ return this._src; }
}
function harness(t, protocol='https:') {
  const saved = new Map();
  for (const [key,value] of Object.entries({Image:FakeImage,location:{protocol},localStorage:memory()})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  FakeImage.all=[];
  const map=new TileMap();map.zoomLevel=8;map._lastRoundedZoom=8;map._lastQueueZoom=8;
  t.after(()=>{map.dispose();for(const [key,desc]of saved){if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];}});
  return map;
}
function canvasHarness(t,map,w=256,h=256){
  const ctx=new Proxy({},{get:(obj,k)=>k in obj?obj[k]:(()=>{}),set:(obj,k,v)=>{obj[k]=v;return true;}});
  const doc={visibilityState:'visible',createElement:()=>({width:w,height:h,getContext:()=>ctx})};
  const old=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:doc,writable:true,configurable:true});
  t.after(()=>old?Object.defineProperty(globalThis,'document',old):delete globalThis.document);
  map.viewportWidth=w;map.viewportHeight=h;
  const ll=map.globalPixelToLatLon(128.5*256,88.5*256,8);map.centerLat=ll.lat;map.centerLon=ll.lon;
  map.railEnabled=false;return {ctx,doc};
}

test('RC9 policy updated RC22: identified file and HTTP(S) supported; opaque contexts rejected',()=>{
 const p=new TileAccessPolicy(null);
 for(const protocol of ['about:','data:'])assert.equal(p.state(source,protocol).kind,'local-file');
 for(const protocol of ['file:','http:','https:'])assert.equal(p.state(source,protocol).kind,'ready');
 assert.equal(p.state('https://tiles.example.org/{z}/{x}/{y}.png','file:').kind,'ready');
});
test('RC9 policy: canonical OSM/ORM sharding is one retry budget, not a rotation escape',()=>{
 assert.ok(isOSMStandard(source));assert.ok(isOSMStandard('https://a.tile.openstreetmap.org/0/0/0.png'));
 assert.equal(isOSMStandard('https://tile.openstreetmap.org.example.net/0/0/0.png'),false);
 assert.equal(tileSourceKey('https://a.tiles.openrailwaymap.org/standard/0/0/0.png'),tileSourceKey('https://b.tiles.openrailwaymap.org/standard/0/0/0.png'));
 const p=new TileAccessPolicy(null);p.failure(source,403,null,100);
 assert.equal(p.state('https://b.tile.openstreetmap.org/0/0/0.png','https:',999999).kind,'forbidden');
});
test('RC9 policy: a forbidden provider remains stopped across time, reload and late successes',()=>{
 const store=memory(),p=new TileAccessPolicy(store);p.failure(source,403,null,100);
 assert.equal(p.resume(source,'https:',101),false);p.success(source,'https:',1_000_000);
 const q=new TileAccessPolicy(store);assert.equal(q.state(source,'https:',1_000_000).kind,'forbidden');
 assert.equal(q.resume(source,'https:',1_000_000),true);assert.equal(q.state(source,'https:').kind,'ready');
});
test('RC9 policy: Retry-After seconds, HTTP-date, malformed, huge and past values',()=>{
 const now=Date.parse('2026-09-12T00:00:00Z');
 assert.equal(retryAfterDeadline('120',now,60_000),now+120_000);
 assert.equal(retryAfterDeadline('Sat, 12 Sep 2026 00:03:00 GMT',now,60_000),now+180_000);
 for(const bad of [null,'broken','-20','0','Fri, 11 Sep 2026 00:00:00 GMT'])assert.equal(retryAfterDeadline(bad,now,60_000),now+60_000);
 assert.equal(retryAfterDeadline('9'.repeat(500),now,60_000),Number.MAX_SAFE_INTEGER);
});
test('RC9 policy: pause/resume cannot erase Retry-After or a 403',()=>{
 const p=new TileAccessPolicy(null);p.failure(source,429,'3600',100);p.pause(source);
 assert.equal(p.resume(source,'https:',200),false);assert.equal(p.resume(source,'https:',3_600_101),true);
 p.failure(source,403,null,10);p.pause(source);assert.equal(p.state(source,'https:',100).kind,'forbidden');
});
test('RC9 policy: repeated network failures back off and never invent an HTTP 403',()=>{
 const p=new TileAccessPolicy(null);let now=100;
 for(const wait of [30_000,60_000,120_000,240_000,300_000]){
  const s=p.failure(source,null,null,now);assert.equal(s.kind,'unavailable');assert.equal(s.status,null);assert.equal(s.until,now+wait);now=s.until+1;
 }
 p.success(source,'https:',now);assert.equal(p.failure(source,503,null,now).until,now+30_000);
});
test('RC9 policy: denied and malformed storage do not crash or introduce ready-state blocks',()=>{
 const bad=new TileAccessPolicy({getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}});
 assert.equal(bad.failure(source,403).kind,'forbidden');
 for(const data of ['null','42','{}','[["osm-standard",{"kind":"forbidden","until":"bad"}]]','oops']){
  const p=new TileAccessPolicy({getItem:()=>data,setItem(){}});assert.equal(p.state(source,'https:').kind,'ready');
 }
});
test('RC9 provider: explicit XYZ source validates URL, credits and native zoom',()=>{
 const cfg={url:source,attribution:'© OpenStreetMap contributors',maxZoom:19};assert.deepEqual(validateBaseMapSource(cfg),cfg);
 for(const overrides of [{url:'javascript:alert(1)'},{url:'http://example.org/{z}/{x}/{y}.png'},{url:'https://u:p@example.org/{z}/{x}/{y}.png'},
 {url:'https://example.org/{z}/{x}/{y}.png#frag'},{url:'https://example.org/{s}/{z}/{x}/{y}.png'},{url:'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'},
 {url:source+'?bust=1'},{attribution:''},{maxZoom:20},{maxZoom:1.5}])assert.throws(()=>validateBaseMapSource({...cfg,...overrides}));
});
test('RC9 network: unsupported about: context sends zero OSM requests and explains status',t=>{
 const m=harness(t,'about:');let requests=0;t.mock.method(globalThis,'fetch',()=>{requests++;return Promise.reject(Error('unexpected'));});
 for(let i=0;i<100;i++)m.getTile(i,80,8,source);
 assert.equal(requests,0);assert.equal(m.networkStats.started,0);assert.equal(m.getBaseMapAccess().kind,'local-file');assert.equal(m.tileCache.size,0);
});
test('RC9 network: 403 stops a complete visible queue and aborts peer requests without rotating hosts',async t=>{
 const m=harness(t);const requests=[];
 t.mock.method(globalThis,'fetch',(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})));
 for(let i=0;i<100;i++)m.getTile(i,80,8,source);
 assert.equal(requests.length,4);assert.equal(m._baseLoading,4);
 requests[0].resolve(new Response('blocked',{status:403}));await tick();
 assert.equal(m.getBaseMapAccess().kind,'forbidden');assert.equal(m._baseLoading,0);assert.equal(m._baseQueue.length,0);
 assert.ok(requests.slice(1).every(r=>r.options.signal.aborted));
 for(let i=0;i<200;i++)m.getTile(i,81,8,source);m.toggleBasic();m.setSatelliteEnabled(true);m.setSatelliteEnabled(false);m.getTile(1,82,8,source);
 assert.equal(requests.length,4);assert.equal(m.networkStats.failed,1);assert.equal(m.networkStats.cancelled,3);
 for(const r of requests){assert.equal(r.options.cache,'default');assert.equal(r.options.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(r.options.credentials,'omit');assert.equal(r.options.headers,undefined);assert.equal(r.options.referrer,undefined);}
});
test('RC9 network: 429 obeys Retry-After and resumes only once the source is eligible',async t=>{
 const m=harness(t);let now=100_000;t.mock.method(Date,'now',()=>now);let count=0;
 t.mock.method(globalThis,'fetch',async()=>{count++;return new Response('',{status:429,headers:{'Retry-After':'120'}});});
 m.getTile(128,88,8,source);await tick();assert.equal(count,1);assert.equal(m.getBaseMapAccess().until,220_000);
 now=219_999;m.getTile(129,88,8,source);assert.equal(count,1);assert.equal(m.resumeBaseMap(),false);
 now=220_001;m.getTile(129,88,8,source);await tick();assert.equal(count,2);
});
test('RC9 network: unavailable CORS/status remains an honest network error',async t=>{
 const m=harness(t);t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
 m.getTile(128,88,8,source);await tick();const s=m.getBaseMapAccess();assert.equal(s.kind,'unavailable');assert.equal(s.status,null);
});
test('RC9 network: one successful fetch supplies the decoded image; no second HTTP image request',async t=>{
 const m=harness(t);let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return new Response(new Blob(['png'],{type:'image/png'}));});
 const tile=m.getTile(128,88,8,source);await tick();const image=FakeImage.all.at(-1);assert.match(image.src,/^blob:/);
 image.onload();assert.equal(tile.loaded,true);assert.equal(tile.img,image);assert.equal(m._baseLoading,0);
 assert.equal(m.getTile(128,88,8,source),tile);assert.equal(count,1);assert.equal(m.networkStats.loaded,1);
});
test('RC9 network: quality and zoom transitions really cancel requests, not only counters',t=>{
 const m=harness(t);m.getTile(128,88,8,m.satelliteTileUrls[0]);const image=FakeImage.all.at(-1),late=image.onload;
 assert.equal(m._baseLoading,1);m.setRenderQuality(1,1);assert.equal(image.src,'');assert.equal(image.onload,null);assert.equal(m._baseLoading,0);
 late();assert.equal(m._baseLoading,0);assert.equal(m.networkStats.cancelled,1);
});
test('RC9 network: abandoning a map page stops raster I/O without touching services',t=>{
 const m=harness(t);m.getTile(128,88,8,m.satelliteTileUrls[0]);m.setNetworkEnabled(false);
 assert.equal(m._baseLoading,0);assert.equal(m._baseQueue.length,0);m.getTile(129,88,8,m.satelliteTileUrls[0]);assert.equal(m.networkStats.started,1);
 m.setNetworkEnabled(true);m.getTile(129,88,8,m.satelliteTileUrls[0]);assert.equal(m.networkStats.started,2);
});
test('RC9 network: document hidden blocks new requests; restore allows only demanded tiles',t=>{
 const m=harness(t),{doc}=canvasHarness(t,m);doc.visibilityState='hidden';m.onDocumentVisibilityChange();
 m.getTile(128,88,8,m.satelliteTileUrls[0]);assert.equal(m.networkStats.started,0);
 doc.visibilityState='visible';m.onDocumentVisibilityChange();m.getTile(128,88,8,m.satelliteTileUrls[0]);assert.equal(m.networkStats.started,1);
});
test('RC9 cache: basic/dark/satellite switching preserves already decoded base bytes',async t=>{
 const m=harness(t);t.mock.method(globalThis,'fetch',async()=>new Response(new Blob(['png'],{type:'image/png'})));
 const tile=m.getTile(128,88,8,source);await tick();FakeImage.all.at(-1).onload();
 m.toggleBasic();assert.equal(m.getTile(128,88,8,source),tile);m.setSatelliteEnabled(true);m.setSatelliteEnabled(false);
 assert.equal(m.getTile(128,88,8,source),tile);assert.equal(m.networkStats.started,1);
});
test('RC9 cache: different providers and weather timestamps never share pixel identity',t=>{
 const m=harness(t);m._zoomSettled=false;
 const a=m.getTile(128,88,8,'https://one.example.org/{z}/{x}/{y}.png');
 const b=m.getTile(128,88,8,'https://two.example.org/{z}/{x}/{y}.png');assert.notEqual(a,b);
 m._cloudTileUrl='https://example.org/cloud/100/{z}/{x}/{y}.png';const c=m.getTile(128,88,8,m._cloudTileUrl);
 m.setCloudTileUrl('https://example.org/cloud/200/{z}/{x}/{y}.png');const d=m.getTile(128,88,8,m._cloudTileUrl);assert.notEqual(c,d);
});
test('RC9 cache: ORM shard names still reuse identical standard tiles',t=>{
 const m=harness(t);m._zoomSettled=false;
 assert.equal(m.getTile(128,88,8,m.railTileUrls[0]),m.getTile(128,88,8,m.railTileUrls[1]));
});
test('RC9 viewport: exactly aligned one-tile screen does not request three offscreen tiles',t=>{
 const m=harness(t),{ctx}=canvasHarness(t,m);const requested=[];
 m.getTile=(...args)=>{requested.push(args);return{loaded:true,error:false,img:{}};};
 m.renderTiles(ctx,256,256);assert.equal(requested.length,1);assert.deepEqual(requested[0].slice(0,3),[128,88,8]);
});
test('RC9 viewport: old same-zoom panning queue is discarded before the new view starts',t=>{
 const m=harness(t),{ctx}=canvasHarness(t,m,1024,768);m.setSatelliteEnabled(true);
 m.renderTiles(ctx,1024,768);const old=FakeImage.all.slice();assert.equal(old.length,4);assert.ok(m._baseQueue.length>0);
 m.centerLon+=40;m.markDirty();m.renderTiles(ctx,1024,768);
 assert.ok(old.every(img=>img.src===''&&img.onload===null));assert.equal(m._baseLoading,4);assert.ok(m.networkStats.discardedQueued>0);
 for(const item of m._baseQueue)assert.ok(m._visibleTileKeys.has(item.key));
});
test('RC9 viewport: pending upscaled parent tiles do not mark the render buffer complete',t=>{
 const m=harness(t),{ctx}=canvasHarness(t,m);m.setSatelliteEnabled(true);m._satelliteMaxZoom=7;
 m.renderTiles(ctx,256,256);assert.ok(m._pendingTiles>0);assert.equal(m._tileBufferValid,false);
});
test('RC9 projection: resizing alone refreshes the fast projection center',t=>{
 const m=harness(t);m.viewportWidth=800;m.viewportHeight=600;m._updateFrameCache();assert.deepEqual(m.worldToScreenFast(m.centerLat,m.centerLon),{x:400,y:300});
 m.viewportWidth=1200;m.viewportHeight=800;m._updateFrameCache();assert.deepEqual(m.worldToScreenFast(m.centerLat,m.centerLon),{x:600,y:400});
});
test('RC9 bounds: invalid tile coordinates and excessive OSM source zoom cause no request',t=>{
 const m=harness(t);for(const [x,y,z]of [[-1,1,8],[1,-1,8],[256,1,8],[1,256,8],[1,1,31],[1,1,8.5],[1,1,20]])m.getTile(x,y,z,source);
 assert.equal(m.networkStats.started,0);assert.equal(m.tileCache.size,0);
});
test('RC9 multi-map: LiveMap and editors share four service slots and a single refusal',async t=>{
 const m=harness(t),other=new TileMap();other.zoomLevel=8;other._lastQueueZoom=8;other._lastRoundedZoom=8;t.after(()=>other.dispose());
 const requests=[];t.mock.method(globalThis,'fetch',(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})));
 for(let i=0;i<20;i++){m.getTile(i,88,8,source);other.getTile(i,89,8,source);}
 assert.equal(requests.length,4);assert.equal(m._baseLoading+other._baseLoading,4);
 requests[0].resolve(new Response('blocked',{status:403}));await tick();
 assert.equal(m.getBaseMapAccess().kind,'forbidden');assert.equal(other.getBaseMapAccess().kind,'forbidden');
 assert.equal(m._baseLoading+other._baseLoading,0);assert.equal(m._baseQueue.length+other._baseQueue.length,0);assert.equal(requests.length,4);
});
test('RC9 multi-map: released shared slots wake another waiting editor without exceeding budget',async t=>{
 const m=harness(t),other=new TileMap();other.zoomLevel=8;other._lastQueueZoom=8;other._lastRoundedZoom=8;t.after(()=>other.dispose());
 const url=m.satelliteTileUrls[0];for(let i=0;i<4;i++)m.getTile(i,88,8,url);other.getTile(1,89,8,url);
 assert.equal(FakeImage.all.length,4);FakeImage.all[0].onload();await tick();assert.equal(FakeImage.all.length,5);assert.equal(other._baseLoading,1);assert.equal(m._baseLoading+other._baseLoading,4);
});
test('RC9 ORM: readable 403 stops every ORM shard without blocking the independent base source',async t=>{
 const m=harness(t),requests=[];t.mock.method(globalThis,'fetch',(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})));
 for(let i=0;i<40;i++)m.getTile(i,88,8,m.railTileUrls[i%3]);assert.equal(requests.length,4);
 requests[0].resolve(new Response('refused',{status:403}));await tick();
 assert.equal(m.getRailMapAccess().kind,'forbidden');assert.equal(m.getBaseMapAccess().kind,'ready');
 assert.equal(m._railLoading,0);assert.equal(m._railQueue.length,0);assert.ok(requests.slice(1).every(r=>r.options.signal.aborted));
 for(let i=0;i<60;i++)m.getTile(i,89,8,m.railTileUrls[i%3]);assert.equal(requests.length,4);assert.equal(m.resumeRailMap(),false);
});
test('RC9 ORM: manual pause/retry preserves an outstanding rate-limit deadline',async t=>{
 const m=harness(t);let now=200_000;t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:429,headers:{'Retry-After':'180'}}));
 m.getTile(128,88,8,m.railTileUrls[0]);await tick();m.pauseRailMap();assert.equal(m.getRailMapAccess().kind,'paused');
 assert.equal(m.resumeRailMap(),false);now=380_001;assert.equal(m.resumeRailMap(),true);assert.equal(m.getRailMapAccess().kind,'ready');
});
