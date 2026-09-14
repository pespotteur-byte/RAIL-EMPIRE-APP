import { packCacheRow, unpackCacheRow, cacheRowBytes, cacheWriteAllowed, putCacheRow, type CacheRow } from './storage-cache.js';
// Rail Empire — worldwide persistent OSM railway base cache.
// Coverage is global; only tiles actually used by the player are materialised.
// OSM geometry is the base truth for track existence. ORM-specific information
// may enrich the same ways later, but never removes a valid OSM base way.

const DB_NAME='rail-empire-world-rail';
const DB_VERSION=3;
const STORE='tiles';
const SCHEMA='rail-empire-world-rail-v3-all-orm-tracks';
const VERIFIED_EMPTY_TTL_MS=6*60*60*1000;

type WorldRailCacheOptions = { cellDeg?: number; maxMemoryTiles?: number; maxMemoryWays?: number };
type RailEnvelope = { south: number; west: number; north: number; east: number };
type RailTile = RailEnvelope & { key: string; row: number; col: number; worldRail?: boolean };
type UnknownRecord = Record<string, unknown>;
type RailWay = UnknownRecord & { id?: unknown; geometry?: unknown[] };
type RailCacheRecord = UnknownRecord & {
  key: string; schema?: unknown; complete?: unknown; ways?: RailWay[]; negative?: unknown;
  emptyConfirmations?: unknown; expiresAt?: unknown; _touch?: number;
};
type WorldRailStats = { hits:number; misses:number; writes:number; networkTiles:number; failedTiles:number; rejectedEmpty:number; verifiedEmpty:number; expiredEmpty:number; invalidatedLegacyEmpty:number; invalidatedLegacySchema:number };
type PutOptions = { source?: string; complete?: boolean };
type VerifiedEmptyOptions = { source?: string; confirmations?: number; ttlMs?: number };
type ReleaseMemoryOptions = { maxTiles?: number; maxWays?: number };
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

function num(v: unknown,d: number=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function clampLat(v: unknown){return Math.max(-90,Math.min(90,num(v)));}
function wrapLon(v: unknown){let x=num(v);while(x<-180)x+=360;while(x>=180)x-=360;return x;}

export class WorldRailCache{
  cellDeg:number; maxMemoryTiles:number; maxMemoryWays:number;
  _db:IDBDatabase|null; _openPromise:Promise<boolean>|null;
  _memory:Map<string,RailCacheRecord>; _touch:number; _memoryWays:number; _stats:WorldRailStats;
  constructor({cellDeg=0.5,maxMemoryTiles=96,maxMemoryWays=50000}: WorldRailCacheOptions={}){
    this.cellDeg=Math.max(0.05,Math.min(2,num(cellDeg,0.5)||0.5));
    this.maxMemoryTiles=Math.max(8,Math.floor(num(maxMemoryTiles,96)||96));
    this.maxMemoryWays=Math.max(1000,Math.floor(num(maxMemoryWays,50000)||50000));
    this._db=null;this._openPromise=null;
    this._memory=new Map();this._touch=0;this._memoryWays=0;
    this._stats={hits:0,misses:0,writes:0,networkTiles:0,failedTiles:0,rejectedEmpty:0,verifiedEmpty:0,expiredEmpty:0,invalidatedLegacyEmpty:0,invalidatedLegacySchema:0};
  }

  open(){
    if(this._db)return Promise.resolve(true);
    if(this._openPromise)return this._openPromise;
    if(typeof indexedDB==='undefined')return Promise.resolve(false);
    this._openPromise=new Promise<boolean>((resolve)=>{
      let settled=false;
      try {
        const req=indexedDB.open(DB_NAME,DB_VERSION);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
        req.onsuccess=()=>{
          if(settled){req.result.close();return;}
          settled=true;this._db=req.result;
          this._db.onversionchange=()=>{this._db?.close();this._db=null;this._openPromise=null;};
          resolve(true);
        };
        req.onerror=req.onblocked=()=>{settled=true;resolve(false);};
      } catch {resolve(false);}
    }).then(ok=>{if(!ok)this._openPromise=null;return ok;});
    return this._openPromise;
  }

  _row(lat: number){const x=Math.min(89.999999,Math.max(-90,clampLat(lat)));return Math.floor((x+90)/this.cellDeg);}
  _col(lon: unknown){const x=wrapLon(lon);return Math.floor((x+180)/this.cellDeg);}
  tileAt(lat: number,lon: number){
    const row=this._row(lat),col=this._col(lon),south=-90+row*this.cellDeg,west=-180+col*this.cellDeg;
    return {key:`wrail:${this.cellDeg}:${row}:${col}`,row,col,south,north:Math.min(90,south+this.cellDeg),west,east:Math.min(180,west+this.cellDeg),worldRail:true};
  }

  tilesForBBox(south: number,west: number,north: number,east: number){
    south=Math.max(-90,Math.min(90,num(south)));north=Math.max(-90,Math.min(90,num(north)));
    if(north<south)[south,north]=[north,south];
    west=num(west);east=num(east);
    // A wrapped bbox (e.g. 179.8 -> -179.7) is split at the antimeridian.
    if(east<west || east-west>180){
      const w=wrapLon(west),e=wrapLon(east);
      const a=this.tilesForBBox(south,w,north,180-1e-9);
      const b=this.tilesForBBox(south,-180,north,e);
      const m=new Map();for(const t of [...a,...b])m.set(t.key,t);return [...m.values()];
    }
    west=Math.max(-180,Math.min(179.999999,west));east=Math.max(-180,Math.min(179.999999,east));
    const eps=Math.max(1e-10,this.cellDeg*1e-9);
    const r0=this._row(south),r1=this._row(Math.min(89.999999,Math.max(south,north-eps)));
    const c0=this._col(west),c1=this._col(Math.max(west,east-eps));
    const out=[];
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      const s=-90+r*this.cellDeg,w=-180+c*this.cellDeg;
      out.push({key:`wrail:${this.cellDeg}:${r}:${c}`,row:r,col:c,south:s,north:Math.min(90,s+this.cellDeg),west:w,east:Math.min(180,w+this.cellDeg),worldRail:true});
    }
    return out;
  }

  tilesForEnvelopes(envelopes: RailEnvelope[]=[]){
    const m=new Map();
    for(const b of envelopes||[])for(const t of this.tilesForBBox(b.south,b.west,b.north,b.east))m.set(t.key,t);
    return [...m.values()];
  }

  _remember(rec: RailCacheRecord){
    if(!rec?.key)return rec;
    const prev=this._memory.get(rec.key);if(prev)this._memoryWays-=Number(prev.ways?.length||0);
    const row={...rec,_touch:++this._touch};this._memory.set(rec.key,row);this._memoryWays+=Number(row.ways?.length||0);this._trim();return row;
  }
  _trim(maxTiles: number=this.maxMemoryTiles,maxWays: number=this.maxMemoryWays){
    maxTiles=Math.max(0,Math.floor(num(maxTiles,this.maxMemoryTiles)));
    maxWays=Math.max(0,Math.floor(num(maxWays,this.maxMemoryWays)));
    if(this._memory.size<=maxTiles&&this._memoryWays<=maxWays)return;
    const rows=[...this._memory.values()].sort((a,b)=>num(a._touch)-num(b._touch));
    for(const r of rows){if(this._memory.size<=maxTiles&&this._memoryWays<=maxWays)break;this._memory.delete(r.key);this._memoryWays=Math.max(0,this._memoryWays-Number(r.ways?.length||0));}
  }

  // HOTFIX6 — persistent world rail cache stays on disk, but long Schedule
  // solves must be able to evict decoded tile objects immediately. This only
  // releases JS heap references; IndexedDB data is untouched.
  releaseMemory({maxTiles=0,maxWays=0}: ReleaseMemoryOptions={}){
    this._trim(maxTiles,maxWays);
    return {memoryTiles:this._memory.size,memoryWays:this._memoryWays};
  }

  _dropMemory(key: string){
    const old=this._memory.get(key);
    if(old)this._memoryWays=Math.max(0,this._memoryWays-Number(old.ways?.length||0));
    this._memory.delete(key);
  }

  _recordUsable(rec: RailCacheRecord|null|undefined,now: number=Date.now()){ 
    if(rec?.schema!==SCHEMA)return false;
    if(rec?.complete!==true||!Array.isArray(rec.ways))return false;
    if(rec.ways.length>0)return true;
    // v1.1.94 — an empty HTTP 200 is not proof that a world cell has no rail.
    // Only independently-confirmed negative cells are reusable, and unlike
    // positive railway geometry they deliberately expire. This also rejects
    // poisoned v1.1.93 complete:true / ways:[] records on first access.
    return rec.negative===true && Number(rec.emptyConfirmations||0)>=2 && Number(rec.expiresAt||0)>now;
  }

  async _deletePersistent(key: string){
    await this.open();const db=this._db;if(!db)return true;
    return await new Promise<boolean>((resolve)=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false);}catch{resolve(false);}});
  }

  async get(tileOrKey: string | { key?: unknown }){
    const candidate=typeof tileOrKey==='string'?tileOrKey:tileOrKey?.key;
    if(typeof candidate!=='string'||!candidate)return null;
    const key=candidate;
    const now=Date.now(),mem=this._memory.get(key);
    if(mem){
      if(this._recordUsable(mem,now)){mem._touch=++this._touch;this._stats.hits++;return mem;}
      if(mem.schema!==SCHEMA)this._stats.invalidatedLegacySchema++;
      else if(Array.isArray(mem.ways)&&mem.ways.length===0){
        if(mem.negative===true)this._stats.expiredEmpty++;else this._stats.invalidatedLegacyEmpty++;
      }
      this._dropMemory(key);
    }
    await this.open();
    const db=this._db;if(!db){this._stats.misses++;return null;}
    const rec=await new Promise<RailCacheRecord|null>((resolve)=>{try{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(isRecord(req.result) && typeof req.result.key === 'string' ? req.result as RailCacheRecord : null);req.onerror=()=>resolve(null);}catch{resolve(null);}});
    let decoded: RailCacheRecord | null = rec;
    if (rec) { try { decoded = await unpackCacheRow(rec as CacheRow) as RailCacheRecord; }
      catch { this._stats.misses++; return null; } }
    if(decoded&&this._recordUsable(decoded,now)){this._stats.hits++;return this._remember(decoded);}
    if(decoded){
      if(decoded.schema!==SCHEMA)this._stats.invalidatedLegacySchema++;
      else if(Array.isArray(decoded.ways)&&decoded.ways.length===0){
        if(decoded.negative===true)this._stats.expiredEmpty++;else this._stats.invalidatedLegacyEmpty++;
      }
      await this._deletePersistent(key);
    }
    this._stats.misses++;return null;
  }

  async _persist(rec: RailCacheRecord){
    this._remember(rec);this._stats.writes++;
    await this.open();const db=this._db;if(!db)return true;
    try {
      const packed = await packCacheRow(rec as CacheRow);
      if (!await cacheWriteAllowed(cacheRowBytes(packed))) return false;
      return await putCacheRow(db, STORE, packed);
    } catch { return false; }
  }

  async put(tile: RailTile, ways: unknown, {source='OSM',complete=true}: PutOptions={}){
    if(!tile?.key||!complete||!Array.isArray(ways))return false;
    const byId=new Map<string,RailWay>();for(const value of ways){if(!isRecord(value))continue;const w=value as RailWay;if(w.id!=null&&Array.isArray(w.geometry)&&w.geometry.length>=2)byId.set(String(w.id),w);}
    // Never persist a zero-way network response as permanent truth.
    if(byId.size===0){this._stats.rejectedEmpty++;return false;}
    const rec={schema:SCHEMA,key:tile.key,row:tile.row,col:tile.col,cellDeg:this.cellDeg,bbox:{south:tile.south,west:tile.west,north:tile.north,east:tile.east},source:String(source||'OSM'),complete:true,negative:false,ways:[...byId.values()],savedAt:Date.now()};
    return this._persist(rec);
  }

  async putVerifiedEmpty(tile: RailTile, {source='OSM verified empty',confirmations=2,ttlMs=VERIFIED_EMPTY_TTL_MS}: VerifiedEmptyOptions={}){
    const checks=Math.floor(Number(confirmations||0));
    if(!tile?.key||checks<2){this._stats.rejectedEmpty++;return false;}
    const now=Date.now(),ttl=Math.max(5*60*1000,Math.min(24*60*60*1000,Number(ttlMs||VERIFIED_EMPTY_TTL_MS)));
    const rec={schema:SCHEMA,key:tile.key,row:tile.row,col:tile.col,cellDeg:this.cellDeg,bbox:{south:tile.south,west:tile.west,north:tile.north,east:tile.east},source:String(source||'OSM verified empty'),complete:true,negative:true,emptyConfirmations:checks,ways:[],savedAt:now,emptyVerifiedAt:now,expiresAt:now+ttl};
    this._stats.verifiedEmpty++;
    return this._persist(rec);
  }

  async remove(tileOrKey: string | { key?: unknown }){
    const candidate=typeof tileOrKey==='string'?tileOrKey:tileOrKey?.key;
    if(typeof candidate!=='string'||!candidate)return false;
    this._dropMemory(candidate);
    return this._deletePersistent(candidate);
  }

  async cachedWaysForEnvelopes(envelopes: RailEnvelope[]=[]){
    const tiles=this.tilesForEnvelopes(envelopes),byId=new Map(),missing=[];
    for(const t of tiles){const r=await this.get(t);if(!r)missing.push(t);else for(const w of r.ways||[])if(w?.id!=null)byId.set(String(w.id),w);}
    return {ways:[...byId.values()],tiles,missing,cached:tiles.length-missing.length,complete:missing.length===0};
  }

  markNetworkTile(ok: unknown=true){if(ok)this._stats.networkTiles++;else this._stats.failedTiles++;}
  stats(){return {schema:SCHEMA,coverage:'world',cellDeg:this.cellDeg,memoryTiles:this._memory.size,memoryWays:this._memoryWays,...this._stats};}
}

