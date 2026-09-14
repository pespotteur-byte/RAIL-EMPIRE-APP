import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Weather } from '../weather.js';
import { evaluateRailWeather, WEATHER_RAIL_THRESHOLDS } from '../weather-thresholds.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('HOTFIX55 uses one central rail threshold catalogue',()=>{
  for(const k of ['wind_kmh','gust_kmh','visibility_m','precipitation_mmh','snowfall_cmh','temperature_high_c','temperature_low_c']) assert.ok(WEATHER_RAIL_THRESHOLDS[k],k);
  assert.deepEqual(WEATHER_RAIL_THRESHOLDS.gust_kmh.bands,[60,80,100,120]);
  assert.deepEqual(WEATHER_RAIL_THRESHOLDS.visibility_m.bands,[2000,1000,500,200]);
});

test('HOTFIX55 rain degrades braking progressively without arbitrary low-rain speed cap',()=>{
  const light=evaluateRailWeather({type:'rain',precipitation:1,visibilityM:10000,windSpeed:10,windGust:15,temperature:15},160,1);
  const heavy=evaluateRailWeather({type:'rain',precipitation:15,visibilityM:10000,windSpeed:10,windGust:15,temperature:15},160,1);
  assert.equal(light.speedCap,Infinity);
  assert.equal(heavy.speedCap,Infinity);
  assert.ok(heavy.brakeFactor<light.brakeFactor);
  assert.ok(heavy.rank>=2);
});

test('HOTFIX55 severe gusts and very low visibility can impose rail speed caps',()=>{
  const gust=evaluateRailWeather({type:'clear',precipitation:0,visibilityM:10000,windSpeed:70,windGust:125,temperature:15},200,1);
  assert.ok(Number.isFinite(gust.speedCap));
  assert.ok(gust.speedCap<=80);
  assert.equal(gust.level.id,'extreme');
  const fog=evaluateRailWeather({type:'fog',precipitation:0,visibilityM:150,windSpeed:0,windGust:0,temperature:8},200,1);
  assert.ok(Number.isFinite(fog.speedCap));
  assert.ok(fog.brakeFactor<1);
  assert.equal(fog.level.id,'extreme');
});

test('HOTFIX55 snow and freezing rain have explicit railway consequences',()=>{
  const snow=evaluateRailWeather({type:'snow',snowfall:3.5,precipitation:2,visibilityM:1500,windSpeed:20,windGust:30,temperature:-2,weatherCode:75},160,1);
  assert.ok(Number.isFinite(snow.speedCap));
  assert.ok(snow.brakeFactor<0.7);
  const ice=evaluateRailWeather({type:'rain',precipitation:3,visibilityM:3000,windSpeed:10,windGust:20,temperature:-1,weatherCode:67},160,1);
  assert.ok(Number.isFinite(ice.speedCap));
  assert.ok(ice.tags.includes('Pluie verglaçante'));
  assert.ok(ice.hazards.switchFreeze>0);
});

test('HOTFIX55 Weather train physics delegates to central thresholds',()=>{
  const w=new Weather();
  const key=w._pointKey(48.8,2.3);
  w._pointCache.set(key,{expiresAt:Date.now()+10000,state:{type:'clear',temperature:12,humidity:70,precipitation:0,snowfall:0,windSpeed:60,windGust:125,visibilityM:10000,weatherCode:0,label:'Vent fort'}});
  const e=w.getSpeedEffectsAt(48.8,2.3,200);
  assert.ok(Number.isFinite(e.speedCap));
  assert.equal(e.risk.level.id,'extreme');
});

test('HOTFIX55 worldwide point payload contains the operational weather fields',async()=>{
  const old=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({current:{temperature_2m:12,apparent_temperature:10,relative_humidity_2m:82,precipitation:5,rain:4,showers:1,snowfall:0,weather_code:63,wind_speed_10m:42,wind_gusts_10m:76,wind_direction_10m:230,cloud_cover:88,pressure_msl:998,visibility:4200,dew_point_2m:8}})});
  try{
    const w=new Weather(); const s=await w._fetchLiveWeatherFor(-33.9,151.2);
    for(const k of ['temperature','apparentTemp','humidity','precipitation','rain','showers','snowfall','windSpeed','windGust','windDirection','cloudCover','pressure','visibilityM','dewpoint','weatherCode']) assert.ok(Number.isFinite(Number(s[k])),k);
  }finally{global.fetch=old;}
});

test('HOTFIX55 map UI exposes worldwide search, interactive layers, forecast and rail risks',()=>{
  const src=read('js/weather-map-view.js');
  assert.match(src,/Rechercher une ville, gare ou lieu dans le monde/);
  for(const text of ['Radar pluie','Risques ferroviaires','Température','Précipitations','Vent','Rafales','Neige','Visibilité','Humidité','Pression','Nuages']) assert.ok(src.includes(text),text);
  assert.match(src,/fetchGrid/);
  assert.match(src,/fetchForecastAt/);
  assert.match(src,/screenToWorld/);
  assert.match(src,/applyZoom/);
  assert.match(src,/scheduleCreator\?\.services/);
});

test('HOTFIX55 scalar map layers use one batched Open-Meteo grid request and cache',()=>{
  const src=read('js/weather.js');
  assert.match(src,/latitude=\$\{lats\.map/);
  assert.match(src,/longitude=\$\{lons\.map/);
  assert.match(src,/_gridCache/);
  assert.match(src,/expiresAt:Date\.now\(\)\+600000/);
  assert.match(src,/geocoding-api\.open-meteo\.com/);
});

test('HOTFIX55 old misleading fixed percentage impact table is no longer rendered',()=>{
  const src=read('js/weather.js');
  assert.doesNotMatch(src,/Impact météo sur la circulation/);
  const view=read('js/weather-map-view.js');
  assert.match(view,/Ces seuils sont utilisés par la page et par les trains/);
});

test('HOTFIX55 FILE bundle flavor and cache are ready for packaging',()=>{
  const build=read('scripts/build-file-bundle-v1199.cjs'),index=read('index.html');
  assert.match(build,/HOTFIX55-WORLD-WEATHER-INTERACTIVE-RAIL-THRESHOLDS/);
  assert.match(build,/1199repair24/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
