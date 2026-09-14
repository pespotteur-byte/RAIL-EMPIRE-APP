import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

const editorSource=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
const ormSource=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');

test('v1.1.48 OSM engine overlay is passive and never fetches Overpass',()=>{
  const start=editorSource.indexOf('\n    _queueVisibleEngineOsm(');
  const end=editorSource.indexOf('\n    _drawStations(',start);
  assert.ok(start>=0 && end>start,'engine OSM overlay block must remain present');
  const block=editorSource.slice(start,end);
  assert.doesNotMatch(block,/fetchRailwayViewport/);
  assert.doesNotMatch(block,/fetchRailwaySwitchesViewport/);
  assert.doesNotMatch(block,/Promise\.all/);
  assert.match(block,/PASSIVE overlay/);
});

test('v1.1.48 short cursor route uses one compact fetch before routing',async()=>{
  const orm=new ORMClient();
  orm._ways.clear(); orm._loadedBboxes=[]; orm.areaCache.clear();
  orm.fetchSmallOsmMapArea=async()=>({ok:false,ways:[],switches:[],source:'test-disabled'});
  let areaCalls=0,tileCalls=0,routeCalls=0;
  const way={id:1,nodeIds:[1,2],geometry:[{lat:49,lon:3},{lat:49,lon:3.004}],tags:{railway:'rail'}};
  orm.fetchArea=async()=>{areaCalls++;return {ok:true,ways:[way]};};
  orm.fetchRailwayTiles=async()=>{tileCalls++;return [way];};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._routeCursorAnchorChainOnWays=async()=>{routeCalls++;return [{lat:49,lon:3,wayId:1},{lat:49,lon:3.004,wayId:1}];};
  const route=await orm.findRouteViaCursorAnchors([{lat:49,lon:3},{lat:49,lon:3.004}],{});
  assert.equal(route.length,2);
  assert.equal(areaCalls,1);
  assert.equal(tileCalls,0);
  assert.equal(routeCalls,1);
});

test('v1.1.48 short route widens only after compact graph actually fails',async()=>{
  const orm=new ORMClient();
  orm._ways.clear(); orm._loadedBboxes=[]; orm.areaCache.clear();
  orm.fetchSmallOsmMapArea=async()=>({ok:false,ways:[],switches:[],source:'test-disabled'});
  let areaCalls=0,routeCalls=0;
  const way={id:1,nodeIds:[1,2],geometry:[{lat:49,lon:3},{lat:49,lon:3.004}],tags:{railway:'rail'}};
  orm.fetchArea=async()=>{areaCalls++;return {ok:true,ways:[way]};};
  orm.getLoadedRailwaysInBounds=()=>[];
  orm._routeCursorAnchorChainOnWays=async()=>{routeCalls++;return routeCalls===1?null:[{lat:49,lon:3,wayId:1},{lat:49,lon:3.004,wayId:1}];};
  const route=await orm.findRouteViaCursorAnchors([{lat:49,lon:3},{lat:49,lon:3.004}],{});
  assert.equal(route.length,2);
  assert.equal(areaCalls,2,'compact fetch + one widened retry only');
  assert.equal(routeCalls,2);
});

test('v1.1.68 short and medium routes keep resident rescue envelopes bounded',()=>{
  assert.match(ormSource,/const\s+pad\s*=\s*shortChain\s*\?\s*0\.05\s*:\s*\(\s*maxChainLegKm\s*<\s*25\s*\?\s*0\.06/);
  assert.match(ormSource,/loadedPad\s*=\s*shortChain\s*\?\s*0\.03\s*:\s*\(\s*maxChainLegKm\s*<\s*25\s*\?\s*0\.03/);
  assert.match(ormSource,/timeoutMs\s*:\s*3200/);
});


test('v1.1.48 a 300 m straight real OSM way routes without synthetic fallback',async()=>{
  const orm=new ORMClient();
  orm._ways.clear(); orm._loadedBboxes=[]; orm.areaCache.clear();
  orm.fetchSmallOsmMapArea=async()=>({ok:false,ways:[],switches:[],source:'test-disabled'});
  const way={
    id:77, railway:'rail', service:'', usage:'main', maxSpeed:90, maxSpeedSource:'OSM',
    nodeIds:[700,701,702],
    geometry:[{lat:49.0400,lon:3.4000},{lat:49.0400,lon:3.4020},{lat:49.0400,lon:3.4040}],
    tags:{railway:'rail'}
  };
  orm.fetchArea=async()=>({ok:true,ways:[way]});
  orm.getLoadedRailwaysInBounds=()=>[];
  const route=await orm.findRouteViaCursorAnchors([{lat:49.0400,lon:3.4002},{lat:49.0400,lon:3.4038}],{});
  assert.ok(route?.length>=2);
  assert.equal(orm.isFallbackRoute(route),false);
  assert.equal(orm._lastCursorRouteFailure,'');
});

test('v1.1.48 track picker scans only local resident ways, not continent-wide _ways',async()=>{
  const orm=new ORMClient();
  orm._ways.clear();
  for(let i=0;i<5000;i++)orm._ways.set('far'+i,{id:'far'+i,geometry:[{lat:40,lon:i/1000},{lat:40.001,lon:i/1000}],tags:{railway:'rail'}});
  const local={id:'local',railway:'rail',geometry:[{lat:49,lon:3},{lat:49,lon:3.001}],tags:{railway:'rail'}};
  orm.fetchArea=async()=>({ok:true,ways:[local]});
  orm.getLoadedRailwaysInBounds=()=>[local];
  const hits=await orm.getTrackCandidates(49,3.0005,{radiusM:100,limit:8});
  assert.equal(hits.length,1);
  assert.equal(hits[0].wayId,'local');
});

test('v1.1.48 Schedule Creator suppresses background station Overpass when gameplay stations are resident',()=>{
  assert.match(editorSource,/residentStations\s*>=\s*1000/);
  assert.match(editorSource,/Track\/routing requests get priority/);
});
