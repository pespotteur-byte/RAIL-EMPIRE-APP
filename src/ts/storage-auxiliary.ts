/** RC14: compressed transactional storage for the four large admin datasets.
 * Credentials and player settings are deliberately excluded. No automatic purge. */
import { encodeJson, decodeJson, type BinaryJson } from './storage-codec.js';
export const AUXILIARY_KEYS = ['admin_catalog_mods','admin_catalog_deleted','admin_catalog_imported','admin_incidents'] as const;
export type AuxiliaryKey = typeof AUXILIARY_KEYS[number];
const DB = 'rail-empire-admin-db', STORE = 'datasets', PREFIX = 'RE14A:';
interface Row { key:AuxiliaryKey; payload:BinaryJson; updatedAt:number; }
const queues = new Map<string,Promise<unknown>>();
function ordered<T>(key:string,job:()=>Promise<T>):Promise<T> {
  const next=(queues.get(key)||Promise.resolve()).then(job,job);queues.set(key,next);
  void next.then(()=>{if(queues.get(key)===next)queues.delete(key);},()=>{if(queues.get(key)===next)queues.delete(key);});return next;
}
function validKey(key:string):asserts key is AuxiliaryKey { if(!(AUXILIARY_KEYS as readonly string[]).includes(key))throw new Error('Clé administrateur non autorisée.'); }
function localRead(key:string):string|null { try{return localStorage.getItem(key);}catch{return null;} }
async function parseLocal(text:string):Promise<unknown> {
  if(!text.startsWith(PREFIX))return JSON.parse(text) as unknown;
  const row=JSON.parse(text.slice(PREFIX.length)) as {codec?:unknown;data?:unknown};
  if((row.codec!=='RE13/gzip'&&row.codec!=='RE13/json')||typeof row.data!=='string')throw new Error('Données administrateur compactes invalides.');
  const bytes=Uint8Array.from(atob(row.data),c=>c.charCodeAt(0));return decodeJson({codec:row.codec,data:new Blob([bytes])});
}
async function localText(payload:BinaryJson):Promise<string> {
  const bytes=new Uint8Array(await payload.data.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return PREFIX+JSON.stringify({codec:payload.codec,data:btoa(binary)});
}
export class AuxiliaryJsonStorage {
  private db:IDBDatabase|null=null;
  private opening:Promise<IDBDatabase|null>|null=null;
  lastWarning:string|null=null;
  private async open():Promise<IDBDatabase|null> {
    if(this.db)return this.db;if(this.opening)return this.opening;
    if(typeof indexedDB==='undefined')return null;
    this.opening=new Promise<IDBDatabase|null>(resolve=>{
      let done=false;const finish=(db:IDBDatabase|null)=>{if(done){db?.close();return;}done=true;clearTimeout(timer);this.db=db;resolve(db);};
      const timer=setTimeout(()=>finish(null),4000);
      try{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};
        r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();this.db=null;this.opening=null;};finish(db);};
        r.onerror=r.onblocked=()=>finish(null);
      }catch{finish(null);}
    });
    const db=await this.opening;if(!db)this.opening=null;return db;
  }
  private async get(key:AuxiliaryKey):Promise<Row|null> {
    const db=await this.open();if(!db)throw new Error('Accès IndexedDB administrateur indisponible');
    return new Promise((resolve,reject)=>{try{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);let row:Row|null=null;
      r.onsuccess=()=>{row=(r.result as Row|undefined)||null;};
      tx.oncomplete=()=>resolve(row);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Lecture administrateur impossible.'));
    }catch(e){reject(e);}});
  }
  private async put(key:AuxiliaryKey,payload:BinaryJson):Promise<boolean> {
    const db=await this.open();if(!db)return false;
    return new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,payload,updatedAt:Date.now()});
      tx.oncomplete=()=>resolve(true);tx.onabort=tx.onerror=()=>resolve(false);
    }catch{resolve(false);}});
  }
  /** Existing local data wins over a stale IDB copy, including a recent fallback.
   * Migration removes that local value only AFTER commit and if it is unchanged. */
  load(key:AuxiliaryKey):Promise<unknown> {
    validKey(key);return ordered(key,async()=>{
      const text=localRead(key);
      if(text!==null){
        const value=await parseLocal(text),payload=await encodeJson(value);
        if(localRead(key)!==text)throw new Error('Données modifiées dans un autre onglet. Rechargez la page administrateur.');
        if(await this.put(key,payload)){
          if(localRead(key)!==text)throw new Error('Données modifiées pendant la migration. Rechargez la page administrateur.');
          try{localStorage.removeItem(key);}catch{this.lastWarning='Migration validée ; ancienne copie locale conservée.';}
        }else this.lastWarning='Migration indisponible : ancienne copie locale conservée.';
        return value;
      }
      const row=await this.get(key);return row?decodeJson(row.payload):[];
    });
  }
  /** Capture JSON now; never let later UI edits mutate a pending write. */
  save(key:AuxiliaryKey,value:unknown):Promise<void> {
    validKey(key);const snapshot=JSON.stringify(value);if(snapshot===undefined)return Promise.reject(new Error('Données JSON absentes.'));
    return ordered(key,async()=>{
      const payload=await encodeJson(JSON.parse(snapshot) as unknown);
      if(await this.put(key,payload)){
        // Remove old fallback only after commit. If removal is denied, retain a
        // fresh local copy rather than silently allowing stale local data to win.
        try{localStorage.removeItem(key);}catch{
          localStorage.setItem(key,await localText(payload));
          this.lastWarning='Nouvelle copie locale conservée en plus de la base.';
        }
        return;
      }
      // setItem is atomic: quota failure does not delete the previous local value.
      try{localStorage.setItem(key,await localText(payload));this.lastWarning='IndexedDB indisponible : repli local compact utilisé.';}
      catch{throw new Error('Stockage administrateur plein ou indisponible. Ancienne copie conservée ; exportez vos données.');}
    });
  }
  close():void {this.db?.close();this.db=null;this.opening=null;}
}
