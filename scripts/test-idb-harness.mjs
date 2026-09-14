/** Test-only deterministic transactional model. NOT a disk-backed browser or a complete IDB implementation. */
export const localMemory = (limit=Infinity) => {
 const values=new Map();return {getItem:k=>values.get(k)??null,setItem(k,v){v=String(v);let n=(k.length+v.length)*2;for(const[a,b]of values)if(a!==k)n+=(a.length+b.length)*2;if(n>limit)throw new DOMException('quota','QuotaExceededError');values.set(k,v);},removeItem:k=>values.delete(k),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size;},values};
};
const clone=v=>v===undefined?undefined:structuredClone(v);
export class TestIDBFactory {
 constructor(){this.databasesMap=new Map();this.failNextCommit=false;this.commits=0;this.openFailures=0;this.onBeforeCommit=null;}
 open(name,version){const req={};setImmediate(()=>{
  if(this.openFailures>0){this.openFailures--;req.error=new DOMException('denied','SecurityError');req.onerror?.();return;}
  let meta=this.databasesMap.get(name);const fresh=!meta;
  if(!meta){meta={version:version||1,stores:new Map(),queue:[],active:false};this.databasesMap.set(name,meta);}
  const factory=this;
  const db={name,version:meta.version,closed:false,objectStoreNames:{contains:k=>meta.stores.has(k)},
   createObjectStore(k,opts={}){meta.stores.set(k,{values:new Map(),keyPath:opts.keyPath||'key',indexes:new Map()});return{createIndex(n,keyPath){meta.stores.get(k).indexes.set(n,keyPath);}};},
   close(){this.closed=true;},
   transaction(store,mode='readonly'){if(db.closed)throw new DOMException('closed','InvalidStateError');if(!meta.stores.has(store))throw new DOMException('store','NotFoundError');return transaction(factory,meta,store,mode);}};
  req.result=db;
  if(fresh){let aborted=false;req.transaction={abort(){aborted=true;}};req.onupgradeneeded?.();if(aborted){this.databasesMap.delete(name);req.error=new DOMException('upgrade aborted','AbortError');req.onerror?.();return;}}
  req.onsuccess?.();
 });return req;}
}
function transaction(factory,meta,name,mode){
 let active=false,finished=false,pumping=false,ops=[],values;
 const schema=meta.stores.get(name);
 const tx={error:null,abort(){if(finished)return;finished=true;this.error=new DOMException('abort','AbortError');this.onabort?.();release();},
  objectStore(){return store();}};
 const release=()=>{meta.active=false;startNext();};
 const startNext=()=>{if(meta.active||!meta.queue.length)return;meta.active=true;meta.queue.shift()();};
 const queue=fn=>{if(finished)throw new DOMException('inactive','TransactionInactiveError');ops.push(fn);pump();};
 const pump=()=>{if(!active||pumping||finished)return;pumping=true;setImmediate(()=>{
  pumping=false;if(finished)return;
  if(ops.length){try{ops.shift()();}catch(e){tx.error=e;finished=true;tx.onerror?.();tx.onabort?.();release();return;}pump();return;}
  if(mode==='readwrite'){
   factory.onBeforeCommit?.(tx);
   if(finished)return;
   if(factory.failNextCommit){factory.failNextCommit=false;tx.error=new DOMException('quota injected after request success','QuotaExceededError');finished=true;tx.onerror?.();tx.onabort?.();release();return;}
   schema.values=values;factory.commits++;
  }
  finished=true;tx.oncomplete?.();release();
 });};
 const request=fn=>{const req={};queue(()=>{try{req.result=fn();req.onsuccess?.();}catch(e){req.error=e;req.onerror?.();throw e;}});return req;};
 const cursor=(range,direction,index)=>{const req={};let entries=null,i=0;const advance=()=>queue(()=>{
  if(entries===null){entries=[...values.entries()].filter(([k])=>!range||(range.open?k>range.value:k>=range.value));
   entries.sort((a,b)=>{const x=index?a[1][index]:a[0],y=index?b[1][index]:b[0];return x<y?-1:x>y?1:String(a[0]).localeCompare(String(b[0]));});if(direction==='prev')entries.reverse();}
  const row=entries[i++];req.result=row?{key:row[0],value:clone(row[1]),continue:advance}:null;req.onsuccess?.();
 });advance();return req;};
 const store=()=>({indexNames:{contains:k=>schema.indexes.has(k)},index:n=>({openCursor:(r,d)=>cursor(r,d,schema.indexes.get(n))}),
  get:k=>request(()=>clone(values.get(k))),
  put:row=>{const copy=clone(row);return request(()=>{values.set(copy[schema.keyPath],copy);return copy[schema.keyPath];});},
  delete:k=>request(()=>values.delete(k)),openCursor:(r,d)=>cursor(r,d),count:()=>request(()=>values.size)});
 meta.queue.push(()=>{active=true;values=new Map(schema.values);pump();});setImmediate(startNext);return tx;
}
export function installIDB(){const factory=new TestIDBFactory();globalThis.indexedDB=factory;globalThis.IDBKeyRange={lowerBound:(value,open=false)=>({value,open})};globalThis.localStorage=localMemory();return factory;}
export function openDB(name,store,version=1){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,version);r.onupgradeneeded=()=>{const s=r.result.createObjectStore(store,{keyPath:'key'});s.createIndex('timestamp','timestamp');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export function put(db,store,row){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(row);tx.oncomplete=()=>resolve(true);tx.onabort=tx.onerror=()=>reject(tx.error);});}
export function get(db,store,key){return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
