import test from 'node:test';
import assert from 'node:assert/strict';
const local = () => {const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size;}};};
const deadline=async p=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('save stayed pending')),1500))]);}finally{clearTimeout(timer);}};
for(const event of ['onerror','onmessageerror']) test(`RE repair: worker ${event} releases every pending save and the next save`,async()=>{
 const oldW=globalThis.Worker,oldL=globalThis.localStorage;let terminated=0;
 globalThis.localStorage=local();globalThis.Worker=class{postMessage(){queueMicrotask(()=>this[event]?.({}));}terminate(){terminated++;}};
 try {
  const {GameStorage}=await import(`../storage.js?repair-${event}`);const s=new GameStorage();
  assert.deepEqual(await deadline(Promise.all([s.saveGame({value:1}),s.saveGame({value:2})])),[true,true]);
  assert.equal(await deadline(s.saveGame({value:3})),true);assert.ok(terminated>=2);
 }finally{if(oldW===undefined)delete globalThis.Worker;else globalThis.Worker=oldW;if(oldL===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldL;}
});
test('RE repair: a transient IndexedDB opening failure is retried',async()=>{
 const oldI=globalThis.indexedDB,oldL=globalThis.localStorage;let attempts=0,records=[];
 globalThis.localStorage=local();
 const db={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={objectStore(){return {put(record){records.push(record);queueMicrotask(()=>tx.oncomplete?.());}};}};return tx;}};
 globalThis.indexedDB={open(){const req={};const n=++attempts;queueMicrotask(()=>{if(n===1)req.onerror?.();else {req.result=db;req.onsuccess?.();}});return req;}};
 try{const {GameStorage}=await import('../storage.js?repair-idb');const s=new GameStorage();await s._ready;assert.equal(await deadline(s.saveGame({value:7},{lowMemory:true})),true);assert.ok(attempts>=2);assert.equal(records.length,1);}
 finally{if(oldI===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=oldI;if(oldL===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldL;}
});

test('RE repair: ORM cache survives a synchronous storage denial and retries',async()=>{
 const oldI=globalThis.indexedDB;let attempts=0;
 const db={objectStoreNames:{contains:()=>true},close(){}};
 globalThis.indexedDB={open(){if(++attempts===1)throw new DOMException('Storage denied','SecurityError');const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req;}};
 try{const {ORMClient}=await import('../orm.js');const orm=new ORMClient();assert.equal(await deadline(orm._cacheReady),false);assert.equal(await deadline(orm._persistentCache.open()),true);assert.equal(attempts,2);}
 finally{if(oldI===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=oldI;}
});
