import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function way(id,coords,nodeIds,extra={}){
  return {id:String(id),geometry:coords.map(([lat,lon])=>({lat,lon})),nodeIds,
    maxSpeed:120,maxSpeedSource:'OSM',maxSpeedForward:null,maxSpeedBackward:null,
    electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],
    loadingGauge:'',axleLoad:null,metreLoad:null,tracks:1,usage:'main',service:'',railway:'rail',trafficMode:'',
    preferredDirection:'',bidirectional:'',oneway:'',trainProtection:{},name:'',ref:'',trackRef:'',tags:{railway:'rail'},...extra};
}
function bind(w,lat,lon,segmentIndex=0){
  return {wayId:String(w.id),lat,lon,snapLat:lat,snapLon:lon,segmentIndex,
    osmSnapshot:{...w,wayId:String(w.id),segmentIndex,distanceM:0,snapLat:lat,snapLon:lon}};
}

test('DIAG3 field fix: >3 km exact local leg uses tiled OSM-main before any Overpass request',async()=>{
  const orm=new ORMClient();
  const aWay=way('KA-A',[[49.0000,8.4000],[49.0000,8.4150]],[1,2]);
  const mid=way('KA-M',[[49.0000,8.4150],[49.0060,8.4350]],[2,3]);
  const bWay=way('KA-B',[[49.0060,8.4350],[49.0100,8.4500]],[3,4]);
  const a=bind(aWay,49.0000,8.4040,0),b=bind(bWay,49.0090,8.4470,0);
  assert.ok(Math.abs(b.lon-a.lon)>0.04,'fixture must be Karlsruhe-class >3 km');
  orm.getLoadedRailwaysInBounds=()=>[];
  let directCalls=0,overpassCalls=0;
  orm.fetchSmallOsmMapArea=async()=>{directCalls++;return {ok:true,ways:[aWay,mid,bWay],switches:[],source:'test-osm-main'};};
  orm.fetchRailwayTiles=async()=>{overpassCalls++;throw new Error('Overpass must not be needed when OSM-main corridor is complete');};
  const r=await orm._findCursorLegLocal(a,b,{_scheduleExact:true,allowSignalRestrictedDirection:true,_deadlineTs:Date.now()+15000});
  assert.ok(r?.length>=4,'real OSM-main corridor must solve the >3 km leg');
  assert.ok(directCalls>=2,'local route must be acquired as several small OSM-main bboxes');
  assert.equal(overpassCalls,0,'successful tiled OSM-main route must stop before Overpass');
  assert.equal(orm._lastCursorRouteDiagnostics?.osmMain?.[0]?.source,'osm-main-corridor');
});

test('DIAG3 field fix: hedged Overpass HTTP 200 is not killed by the original header timeout during response.json()',async()=>{
  const orm=new ORMClient();
  orm._cacheReady=Promise.resolve();
  orm._loadCachedArea=async()=>null;
  orm._saveCachedArea=async()=>{};
  const oldFetch=globalThis.fetch;
  let calls=0,aborted=0;
  globalThis.fetch=(url,{signal}={})=>new Promise((resolve,reject)=>{
    const n=++calls;
    const headerDelay=n===1?900:5000;
    const headerTimer=setTimeout(()=>{
      const payload={elements:[{type:'way',id:9901,tags:{railway:'rail',maxspeed:'160'},geometry:[{lat:49,lon:8},{lat:49.001,lon:8.001}],nodes:[1,2]}]};
      resolve({ok:true,status:200,json:()=>new Promise((res,rej)=>{
        const bodyTimer=setTimeout(()=>res(payload),500);
        signal?.addEventListener('abort',()=>{clearTimeout(bodyTimer);const e=new Error('aborted during body');e.name='AbortError';rej(e);},{once:true});
      })});
    },headerDelay);
    signal?.addEventListener('abort',()=>{clearTimeout(headerTimer);aborted++;const e=new Error('aborted');e.name='AbortError';reject(e);},{once:true});
  });
  const t0=Date.now();
  try{
    const res=await orm.fetchArea(48.99,7.99,49.01,8.01,{withStatus:true,timeoutMs:1200,attemptsPerEndpoint:1,maxEndpoints:2,raceEndpoints:2,hedgeDelayMs:10,deadlineTs:Date.now()+10000});
    const elapsed=Date.now()-t0;
    assert.equal(res.ok,true,'HTTP 200 body must survive beyond the 1.2 s header timeout');
    assert.equal(res.ways.length,1);
    assert.ok(elapsed>=1300 && elapsed<3000,`expected body completion after original timeout, got ${elapsed} ms`);
    assert.ok(aborted>=1,'losing hedge should still be cancelled after winner completes');
  }finally{globalThis.fetch=oldFetch;}
});
