import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

const build=fs.readFileSync(new URL('../../scripts/build-file-bundle-v1199.cjs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');

test('HOTFIX14 current FILE package identity/cache is coherent',()=>{
  assert.match(build,/HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(build,/CACHE_VERSION = '1199repair24'/);
  assert.match(html,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});

test('HOTFIX14 serial Overpass body timeout remains phase-specific at global deadline edge',async()=>{
  const realFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(_url,{signal}={})=>{
    calls++;
    if(calls<=2) throw new TypeError('simulated hedge failure');
    return {ok:true,status:200,json(){return new Promise((resolve,reject)=>{
      const fail=()=>{const e=new Error('aborted');e.name='AbortError';reject(e);};
      if(signal?.aborted)return fail();
      signal?.addEventListener?.('abort',fail,{once:true});
    });}};
  };
  try{
    const orm=new ORMClient();
    const out=await orm.fetchArea(48.84,2.33,48.86,2.35,{withStatus:true,transient:true,forceNetwork:true,attemptsPerEndpoint:1,maxEndpoints:3,raceEndpoints:2,hedgeDelayMs:0,timeoutMs:1200,deadlineTs:Date.now()+300});
    assert.equal(out.ok,false);
    assert.equal(out.error?.code,'OVERPASS_BODY_TIMEOUT');
    assert.equal(calls,3);
  } finally { globalThis.fetch=realFetch; }
});
