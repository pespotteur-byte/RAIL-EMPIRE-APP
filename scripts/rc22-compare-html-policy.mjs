import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {TileMap}=await import(pathToFileURL(root+'/js/map.js'));
const memory=new Map(),calls=[];
globalThis.location={protocol:'file:'};
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
class Image{set src(v){this._src=v;if(v.startsWith('blob:'))queueMicrotask(()=>this.onload?.());}get src(){return this._src;}}
globalThis.Image=Image;
globalThis.fetch=async(url,options)=>{calls.push({url,headers:options.headers??null,cache:options.cache,referrer:options.referrer??null});return new Response(new Blob(['synthetic unit bitmap'],{type:'image/png'}));};
const m=new TileMap();m.zoomLevel=8;m._lastQueueZoom=8;m._lastRoundedZoom=8;m.selectOSMStandard();
const tile=m.getTile(128,88,8,m.getBaseMapSource().url);
await new Promise(r=>setImmediate(r));
console.log(JSON.stringify({state:m.getBaseMapAccess().kind,loaded:tile.loaded,calls},null,2));m.dispose();
