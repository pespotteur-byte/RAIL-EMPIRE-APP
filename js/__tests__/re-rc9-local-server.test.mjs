import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {createLocalServer}=createRequire(import.meta.url)('../../scripts/serve-local.cjs');
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'re-local-'));fs.mkdirSync(path.join(root,'js'));fs.mkdirSync(path.join(root,'img'));fs.mkdirSync(path.join(root,'js','__tests__'));
 fs.writeFileSync(path.join(root,'index.html'),'<h1>RE</h1>');fs.writeFileSync(path.join(root,'js','game.js'),'window.probe=1;');fs.writeFileSync(path.join(root,'js','__tests__','secret.js'),'secret');fs.writeFileSync(path.join(root,'private.txt'),'secret');
 const s=createLocalServer(root);await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>s.close(resolve));fs.rmSync(root,{recursive:true,force:true});});
 const port=s.address().port;
 const req=(url,options={})=>new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:url,...options},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});r.on('error',reject);r.end();});
 return {req,port,root,s};
}
test('RC9 local server: read-only GET, correct MIME, real referrer policy and conditional cache',async t=>{
 const {req,s}=await fixture(t);assert.equal(s.address().address,'127.0.0.1');const a=await req('/');assert.equal(a.status,200);assert.equal(a.body,'<h1>RE</h1>');assert.equal(a.headers['referrer-policy'],'strict-origin-when-cross-origin');assert.equal(a.headers['x-content-type-options'],'nosniff');
 const b=await req('/index.html',{headers:{'If-None-Match':a.headers.etag}});assert.equal(b.status,304);assert.equal(b.body,'');
 assert.equal((await req('/js/game.js?v=rc9')).headers['content-type'],'text/javascript; charset=utf-8');
 assert.equal((await req('/index.html',{method:'HEAD'})).body,'');
});
test('RC9 local server: rejects writes, foreign Host and cross-origin requests',async t=>{
 const {req}=await fixture(t);for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal((await req('/',{method})).status,405);
 assert.equal((await req('/',{headers:{Host:'evil.example'}})).status,403);assert.equal((await req('/',{headers:{Origin:'https://evil.example'}})).status,403);
});
test('RC9 local server: traversal, encoded traversal, source and QA are not served',async t=>{
 const {req}=await fixture(t);for(const url of ['/../private.txt','/%2e%2e/private.txt','/js/%2e%2e/private.txt','/js/..%5cprivate.txt','/js/%252e%252e/private.txt','/private.txt','/src/ts/main.ts','/QA/FILE_SHA256_MANIFEST.txt','/scripts/serve-local.cjs','/js/__tests__/secret.js','//evil.example/a','/js/game.js:stream'])assert.equal((await req(url)).status,403,url);
 assert.equal((await req('/js/no-such.js')).status,404);assert.equal((await req('/%xx')).status,400);
});
test('RC9 local server: symlink cannot expose another directory',async t=>{
 const {req,root}=await fixture(t);fs.symlinkSync(path.join(root,'private.txt'),path.join(root,'img','leak.png'));assert.equal((await req('/img/leak.png')).status,403);
});

test('RC9 local server: shipped M4A audio and CSV data remain accessible as unchanged bytes',async t=>{
 const {req,root}=await fixture(t);fs.mkdirSync(path.join(root,'audio'));fs.mkdirSync(path.join(root,'data'));
 fs.writeFileSync(path.join(root,'audio','probe.m4a'),'m4a-probe');fs.writeFileSync(path.join(root,'data','probe.csv'),'id,name\n1,RE\n');
 const audio=await req('/audio/probe.m4a');assert.equal(audio.status,200);assert.equal(audio.headers['content-type'],'audio/mp4');assert.equal(audio.body,'m4a-probe');
 const data=await req('/data/probe.csv');assert.equal(data.status,200);assert.equal(data.headers['content-type'],'text/csv; charset=utf-8');assert.equal(data.body,'id,name\n1,RE\n');
});
