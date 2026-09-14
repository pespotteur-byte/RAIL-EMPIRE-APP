import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IncidentManager, PREDEFINED_INCIDENT_TYPES } from '../incidents.js';
import { evaluateRailWeather, WEATHER_RAIL_THRESHOLDS } from '../weather-thresholds.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const weatherIds=['weather-tree-obstacle','weather-catenary-damage','weather-flooded-track','weather-frozen-switch','weather-heat-track','weather-lightning-signal','weather-landslide','weather-snow-blockage','weather-rolling-stock-failure'];

test('HOTFIX56 incident catalogue exposes nine weather-driven incident types',()=>{
  for(const id of weatherIds){
    const t=PREDEFINED_INCIDENT_TYPES.find(x=>x.id===id);
    assert.ok(t,id);
    assert.equal(t.weatherTriggered,true,id);
    assert.match(t.probabilityLabel,/météo|pluie|gel|neige|chaleur|orage/i,id);
  }
});

test('HOTFIX56 cumulative rain and snow-depth thresholds are part of the shared weather catalogue',()=>{
  assert.deepEqual(WEATHER_RAIL_THRESHOLDS.precipitation_6h_mm.bands,[15,30,50,80]);
  assert.deepEqual(WEATHER_RAIL_THRESHOLDS.precipitation_24h_mm.bands,[30,60,100,150]);
  assert.deepEqual(WEATHER_RAIL_THRESHOLDS.snow_depth_cm.bands,[2,5,15,30]);
});

test('HOTFIX56 weather hazards honour accepted trigger thresholds',()=>{
  let r=evaluateRailWeather({windSpeed:50,windGust:79,temperature:12,precipitation:0,visibilityM:10000},160,1);
  assert.equal(r.hazards.obstacle,0);
  r=evaluateRailWeather({windSpeed:70,windGust:100,temperature:12,precipitation:0,visibilityM:10000},160,1);
  assert.ok(r.hazards.obstacle>0);
  r=evaluateRailWeather({windSpeed:5,windGust:10,temperature:10,precipitation:4,rain6hMm:30,rain24hMm:65,visibilityM:10000},160,1);
  assert.ok(r.hazards.flooding>0);
  r=evaluateRailWeather({windSpeed:5,windGust:10,temperature:-6,precipitation:1,humidity:95,visibilityM:10000},160,1);
  assert.ok(r.hazards.switchFreeze>0);
  r=evaluateRailWeather({windSpeed:5,windGust:10,temperature:41,precipitation:0,visibilityM:10000},160,1);
  assert.ok(r.hazards.heatTrack>0);
  r=evaluateRailWeather({windSpeed:20,windGust:60,temperature:18,precipitation:3,weatherCode:95,visibilityM:10000},160,1);
  assert.ok(r.hazards.stormSignal>0);
});

test('HOTFIX56 generic 50/h incident pool excludes weather incidents',()=>{
  const m=new IncidentManager();
  m.setEnabledTypes(['weather-tree-obstacle'],56);
  const world={stations:[],tracks:[],getStationById(){return null;}};
  assert.equal(m._spawnGuaranteedIncident(600,[],world,'summer'),null);
});

test('HOTFIX56 old saves automatically receive new weather incident toggles once',()=>{
  const m=new IncidentManager();
  m.setEnabledTypes(['signal-failure'],55);
  assert.ok(m.isTypeEnabled('weather-tree-obstacle'));
  const n=new IncidentManager();
  n.setEnabledTypes(['signal-failure'],56);
  assert.equal(n.isTypeEnabled('weather-tree-obstacle'),false);
});

test('HOTFIX56 weather exposure can create a real local infrastructure incident',()=>{
  const m=new IncidentManager();
  m.setEnabledTypes(['weather-tree-obstacle'],56);
  const world={
    stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.1,lon:2.1}],
    tracks:[{stationA:'A',stationB:'B',name:'A — B',route:[{lat:48,lon:2},{lat:48.1,lon:2.1}],electrified:true}],
    getStationById(id){return this.stations.find(x=>x.id===id)||null;}
  };
  const svc={id:'S',state:'moving',position:{lat:48.05,lon:2.05},currentStopIndex:1,stops:[{stationId:'A'},{stationId:'B'}],train:{id:'T',name:'T'}};
  const state={temperature:10,windSpeed:90,windGust:130,precipitation:0,visibilityM:10000};
  const weather={getAt(){return state;},getRailRiskAt(){return evaluateRailWeather(state,160,1);}};
  m._tryWeatherIncidents(600,[svc],world,'2026-09-02',weather); // initialise clock
  m._weatherIncidentCredit['weather-tree-obstacle']=0.99;
  const count=m._tryWeatherIncidents(610,[svc],world,'2026-09-02',weather);
  assert.equal(count,1);
  const inc=m.activeIncidents.find(x=>x.typeId==='weather-tree-obstacle');
  assert.ok(inc);
  assert.equal(inc.source,'weather');
  assert.match(inc.triggerText,/Rafales 130 km\/h/);
  assert.equal(inc.effect,'stop');
});

test('HOTFIX56 active weather incidents preserve trigger metadata through save/load',()=>{
  const m=new IncidentManager();
  const world={stations:[{id:'A',name:'A',lat:48,lon:2},{id:'B',name:'B',lat:48.1,lon:2.1}],tracks:[{stationA:'A',stationB:'B'}],getStationById(id){return this.stations.find(x=>x.id===id)||null;}};
  m.createIncident({typeId:'weather-flooded-track',name:'Voie inondée',stationA:'A',stationB:'B',effect:'stop',duration:60,remaining:60,source:'weather',triggerText:'Pluie 25.0 mm/h',weatherLevel:'Extrême',weatherHazard:'flooding'},world);
  const saved=m.getActiveIncidentsSave();
  const n=new IncidentManager();n.loadFromSave(saved,world);
  assert.equal(n.activeIncidents[0].source,'weather');
  assert.equal(n.activeIncidents[0].weatherLevel,'Extrême');
  assert.match(n.activeIncidents[0].triggerText,/25\.0/);
});

test('HOTFIX56 incident page separates meteorological types and shows the live weather trigger',()=>{
  const ui=read('js/ui.js'),css=read('style.css');
  assert.match(ui,/Incidents météorologiques/);
  assert.match(ui,/Dynamique · météo × exposition|probabilityLabel/);
  assert.match(ui,/Déclencheur météo/);
  assert.match(ui,/incident-weather-cause/);
  assert.match(css,/\.incident-weather-types/);
});

test('HOTFIX56 Open-Meteo point requests carry past precipitation needed for 6h\/24h accumulations',()=>{
  const weather=read('js/weather.js');
  assert.match(weather,/past_days=1/);
  assert.match(weather,/rain6hMm/);
  assert.match(weather,/rain24hMm/);
  assert.match(weather,/snowDepthCm/);
});

test('HOTFIX56 main loop wires the weather engine into incidents and persists incident schema version',()=>{
  const main=read('js/main.js');
  assert.match(main,/incidentManager\.update\([^\n]+this\.weather, elapsedMinutes\)/);
  assert.match(main,/incidentTypesVersion/);
  assert.match(main,/setEnabledTypes\(s\.incidentEnabledTypes, s\.incidentTypesVersion \|\| 0\)/);
});

test('HOTFIX56 bundle flavor and runtime cache are bumped',()=>{
  const build=read('scripts/build-file-bundle-v1199.cjs'),index=read('index.html');
  assert.match(build,/HOTFIX56-WEATHER-INCIDENTS-THRESHOLDS-EXPOSURE/);
  assert.match(build,/1199repair24/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
  assert.match(index,/style\.css\?v=1199re3d16/);
});
