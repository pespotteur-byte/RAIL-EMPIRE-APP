import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function okJson(data){ return {ok:true,status:200,async json(){return data;}}; }

test('SC Overpass hedge falls through to configured third endpoint when both raced endpoints fail', async()=>{
  const realFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(calls.length<=2) throw new TypeError('simulated endpoint failure');
    return okJson({elements:[{type:'way',id:123,tags:{railway:'rail'},geometry:[{lat:48.85,lon:2.34},{lat:48.851,lon:2.341}],nodes:[1,2]}]});
  };
  try{
    const orm=new ORMClient();
    const out=await orm.fetchArea(48.84,2.33,48.86,2.35,{withStatus:true,transient:true,forceNetwork:true,attemptsPerEndpoint:1,maxEndpoints:3,raceEndpoints:2,hedgeDelayMs:0,timeoutMs:1200});
    assert.equal(out.ok,true);
    assert.ok(out.ways.length>=1);
    assert.equal(calls.length,3,'third configured endpoint must be tried after hedge pair fails');
  } finally { globalThis.fetch=realFetch; }
});

test('SC track picker keeps the third Overpass endpoint available after OSM-main/local miss', async()=>{
  const orm=new ORMClient();
  orm.getLoadedRailwaysInBounds=()=>[];
  orm.fetchSmallOsmMapArea=async()=>({ok:true,ways:[],source:'test-empty'});
  let seen=null;
  orm.fetchArea=async(_s,_w,_n,_e,opts)=>{
    seen=opts;
    return {ok:true,ways:[{id:'W',geometry:[{lat:48.85,lon:2.34},{lat:48.851,lon:2.34}],nodeIds:['A','B'],maxSpeed:120,maxSpeedSource:'OSM',voltage:[],frequency:[],gauge:[1435],tags:{railway:'rail'}}],source:'test'};
  };
  const out=await orm.getTrackCandidates(48.8505,2.34,{radiusM:80,limit:4});
  assert.ok(out.length>=1);
  assert.equal(seen.maxEndpoints,3);
  assert.equal(seen.raceEndpoints,2);
});

test('SC broad-area authority check keeps the third Overpass endpoint available', async()=>{
  const orm=new ORMClient();
  let seen=null;
  orm.fetchArea=async(_s,_w,_n,_e,opts)=>{seen=opts;return {ok:true,ways:[],source:'test'};};
  await orm._findCursorLegBroadArea({lat:48.8,lon:2.3,wayId:'A'},{lat:48.9,lon:2.4,wayId:'B'},{_deadlineTs:Date.now()+5000});
  assert.equal(seen.maxEndpoints,3);
  assert.equal(seen.raceEndpoints,2);
});

test('SC serial third-endpoint body decode is bounded by the route deadline', {timeout:15000}, async()=>{
  const realFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,{signal}={})=>{
    const u=String(url);calls.push(u);
    // Identify the configured serial backup by endpoint, not by call ordinal:
    // under heavy CPU scheduling one hedged task may start late, but that must
    // not turn this body-timeout test into an unrelated call-count race.
    if(!u.includes('maps.mail.ru')) throw new TypeError('simulated hedge failure');
    return {
      ok:true,status:200,
      json(){return new Promise((resolve,reject)=>{
        const fail=()=>{const e=new Error('aborted');e.name='AbortError';reject(e);};
        if(signal?.aborted)return fail();
        signal?.addEventListener?.('abort',fail,{once:true});
      });}
    };
  };
  try{
    const orm=new ORMClient();
    const out=await orm.fetchArea(48.84,2.33,48.86,2.35,{withStatus:true,transient:true,forceNetwork:true,attemptsPerEndpoint:1,maxEndpoints:3,raceEndpoints:2,hedgeDelayMs:0,timeoutMs:1200,deadlineTs:Date.now()+300});
    assert.equal(out.ok,false);
    assert.equal(out.error?.code,'OVERPASS_BODY_TIMEOUT');
    assert.ok(calls.some(u=>u.includes('maps.mail.ru')),'configured serial backup must actually be attempted');
  } finally { globalThis.fetch=realFetch; }
});

test('SC editor treats route time budget as recoverable local-data failure', async()=>{
  const src=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../schedule-v2-editor.js',import.meta.url),'utf8'));
  assert.match(src,/ORM_TIME_BUDGET/);
});
