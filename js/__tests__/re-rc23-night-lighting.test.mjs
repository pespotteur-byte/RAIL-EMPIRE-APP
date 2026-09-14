import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGPSLighting,clockNightAmount,resolveGPSLighting,nightLightsOpacity,nightAppearanceLabel,SATELLITE_NIGHT_TINT,OSM_DARK_FILTER} from '../map-lighting.js';
import {TileMap} from '../map.js';
import {OSM_STANDARD_URL} from '../tile-access-policy.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function setup(t,zoom=16){
 const old=new Map();const draws=[],fills=[],requests=[];
 const ctx={filter:'none',globalAlpha:1,globalCompositeOperation:'source-over',canvas:null,setTransform(){},clearRect(){},save(){this._saved=[this.filter,this.globalAlpha,this.globalCompositeOperation];},restore(){[this.filter,this.globalAlpha,this.globalCompositeOperation]=this._saved;},fillRect(...args){fills.push({fill:this.fillStyle,alpha:this.globalAlpha,args});},drawImage(...args){draws.push({filter:this.filter,alpha:this.globalAlpha,blend:this.globalCompositeOperation,args});}};
 const doc={visibilityState:'visible',createElement:()=>({width:256,height:256,getContext:()=>ctx})};
 for(const[k,v]of Object.entries({document:doc,location:{protocol:'file:'},localStorage:memory(),Image:class{}})){
  old.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 }
 const m=new TileMap();m.zoomLevel=zoom;m._lastQueueZoom=Math.round(zoom);m._lastRoundedZoom=Math.round(zoom);m.railEnabled=false;
 const ll=m.globalPixelToLatLon((2**Math.round(zoom)/2+.5)*256,(2**Math.round(zoom)/2+.5)*256,Math.round(zoom));m.centerLat=ll.lat;m.centerLon=ll.lon;
 m.getTile=(x,y,z,url)=>{requests.push({x,y,z,url});return {loaded:true,img:{url,z},error:false};};
 t.after(()=>{m.dispose();for(const[k,d]of old)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});
 return {m,ctx,draws,fills,requests};
}
test('RC23 lighting values are validated, not truthy user strings',()=>{
 for(const x of ['auto',null,undefined,'DAY',42,{},'<script>'])assert.equal(normalizeGPSLighting(x),'auto');
 assert.equal(normalizeGPSLighting('day'),'day');assert.equal(normalizeGPSLighting('night'),'night');
});
test('RC23 clock-night handles midnight, wrapped days and invalid input',()=>{
 for(const n of [0,300,1260,1439,-1,1440,2880])assert.equal(clockNightAmount(n),1);
 for(const n of [420,720,1170,NaN,Infinity])assert.equal(clockNightAmount(n),0);
 assert.equal(clockNightAmount(375),.5);assert.equal(clockNightAmount(1215),.5);
});
test('RC23 manual day wins over a nighttime game clock',()=>{
 assert.deepEqual(resolveGPSLighting('day',0,false),{mode:'day',amount:0,night:false,mapNight:false});
});
test('RC23 manual night wins over daytime, including original OSM',()=>{
 for(const osm of [false,true])assert.deepEqual(resolveGPSLighting('night',720,osm),{mode:'night',amount:1,night:true,mapNight:true});
});
test('RC23 Auto follows time for satellite but preserves explicit OSM original contract',()=>{
 assert.equal(resolveGPSLighting('auto',1380,false).mapNight,true);
 assert.equal(resolveGPSLighting('auto',720,false).mapNight,false);
 assert.equal(resolveGPSLighting('auto',1380,true).mapNight,false);
 assert.equal(resolveGPSLighting('auto',1380,true).night,true);
});
test('RC23 regional lights fade smoothly and monotonically from zoom 8 to 10',()=>{
 let last=1;
 for(let z=5;z<=22;z+=.01){const a=nightLightsOpacity(z,true,true);assert.ok(a>=0&&a<=.30);assert.ok(a<=last+1e-12);last=a;}
 assert.equal(nightLightsOpacity(8,true,true),.3);assert.equal(nightLightsOpacity(9,true,true),.15);assert.equal(nightLightsOpacity(10,true,true),0);
});
test('RC23 no regional layer in day, OSM, invalid zoom or close GPS',()=>{
 for(const z of [10,12.5,19,20,30,NaN,Infinity])assert.equal(nightLightsOpacity(z,true,true),0);
 assert.equal(nightLightsOpacity(7,false,true),0);assert.equal(nightLightsOpacity(7,true,false),0);
});
test('RC23 appearance label distinguishes real regional data and simulated local night',()=>{
 assert.match(nightAppearanceLabel(true,true,8),/NASA atténuées/);
 assert.match(nightAppearanceLabel(true,true,16),/de jour assombri/);
 assert.match(nightAppearanceLabel(true,false,16),/style sombre local/);
});
for(const zoom of [10,12.5,16,20,30])test(`RC23 zoom ${zoom}: no NASA requests/draws while satellite detail retains native zoom`,t=>{
 const {m,ctx,requests,draws,fills}=setup(t,zoom);m.satelliteEnabled=true;m.setNightMapEnabled(true);m.renderTiles(ctx,256,256);
 assert.ok(requests.length);assert.ok(requests.every(x=>x.url===m.satelliteTileUrls[0]));
 assert.ok(requests.every(x=>x.z===Math.min(m._effectiveTileZoom(),20)));
 assert.ok(draws.every(x=>x.filter==='none'&&x.blend==='source-over'));
 assert.equal(fills.filter(x=>x.fill===SATELLITE_NIGHT_TINT).length,1);
 assert.doesNotMatch(m.getMapCreditText(),/NASA/);
});
test('RC23 distant satellite night asks only native <=z8 lights, at <=30% opacity',t=>{
 const {m,ctx,requests,draws}=setup(t,8);m.setSatelliteEnabled(true);m.setNightMapEnabled(true);m.renderTiles(ctx,256,256);
 const nasa=requests.filter(x=>x.url===m.nightSatelliteTileUrls[0]);assert.ok(nasa.length);assert.ok(nasa.every(x=>x.z<=8));
 const nd=draws.filter(x=>x.args[0]?.url===m.nightSatelliteTileUrls[0]);assert.ok(nd.length);assert.ok(nd.every(x=>x.alpha===.3&&x.filter==='none'));
 assert.match(m.getMapCreditText(),/NASA/);
});
test('RC23 night on OSM keeps OSM, never silently changes provider or loads VIIRS',t=>{
 const {m,ctx,requests,draws}=setup(t,8);m.selectOSMStandard();m.setNightMapEnabled(true);m.renderTiles(ctx,256,256);
 assert.equal(m.satelliteEnabled,false);assert.equal(m.basicMode,true);assert.ok(requests.every(x=>x.url===OSM_STANDARD_URL));
 assert.equal(draws[0].filter,OSM_DARK_FILTER);assert.doesNotMatch(m.getMapCreditText(),/NASA|Esri/);
});
test('RC23 unchecking night restores the exact original OSM style flags',t=>{
 const {m,ctx,draws}=setup(t);m.selectOSMStandard();m.setNightMapEnabled(true);m.renderTiles(ctx,256,256);
 draws.length=0;m.setNightMapEnabled(false);m.renderTiles(ctx,256,256);assert.equal(draws[0].filter,'none');assert.equal(draws[0].alpha,1);
});
test('RC23 manual original OSM selection clears night but preserves rail/weather toggles',t=>{
 const {m}=setup(t);m.railEnabled=true;m.setWeatherEnabled(true);m.setSatelliteEnabled(true);m.setNightMapEnabled(true);m.selectOSMStandard();
 assert.equal(m.nightMapEnabled,false);assert.equal(m.satelliteEnabled,false);assert.equal(m.railEnabled,true);assert.equal(m.weatherEnabled,true);
});
test('RC23 night and weather filters are independent',t=>{
 const {m}=setup(t);m.setNightMapEnabled(true);m.setWeatherEnabled(true);m.setWeatherEnabled(false);assert.equal(m.nightMapEnabled,true);
 m.setWeatherEnabled(true);m.setNightMapEnabled(false);assert.equal(m.weatherEnabled,true);
});
test('RC23 repeated same night mode is idempotent',t=>{
 const {m}=setup(t);assert.equal(m.setNightMapEnabled(true),true);m._dirty=false;m._tileBufferValid=true;
 assert.equal(m.setNightMapEnabled(true),false);assert.equal(m._dirty,false);assert.equal(m._tileBufferValid,true);
});
test('RC23 403 refusal is not cleared or bypassed by lighting switches',t=>{
 const {m}=setup(t);m.tileAccess.failure(OSM_STANDARD_URL,403);const initial=m.getBaseMapAccess();
 for(let i=0;i<20;i++){m.setNightMapEnabled(i%2===0);m.selectOSMStandard();}
 assert.deepEqual(m.getBaseMapAccess(),initial);assert.equal(m.networkStats.started,0);
});
test('RC23 cached base imagery is retained during day/night toggles',t=>{
 const {m}=setup(t);const bytes={loaded:true,error:false,img:{},errorTime:0};m.tileCache.set('same-base',bytes);
 for(let i=0;i<20;i++)m.setNightMapEnabled(i%2===0);
 assert.equal(m.tileCache.get('same-base'),bytes);assert.equal(m.networkStats.started,0);
});
test('RC23 fine-detail zoom transition drops NASA on the next render, not only next GPS entry',t=>{
 const {m,ctx,requests}=setup(t,8);m.setSatelliteEnabled(true);m.setNightMapEnabled(true);m.renderTiles(ctx,256,256);
 assert.ok(requests.some(x=>x.url.includes('VIIRS')));requests.length=0;m.zoomLevel=14;m.markDirty();m.renderTiles(ctx,256,256);
 assert.ok(requests.every(x=>!x.url.includes('VIIRS')));assert.doesNotMatch(m.getMapCreditText(),/NASA/);
});
