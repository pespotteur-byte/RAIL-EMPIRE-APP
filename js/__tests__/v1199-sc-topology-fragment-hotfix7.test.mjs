import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

function anchor(lat,lon,wayId){
  const way={id:String(wayId),railway:'rail',geometry:[{lat,lon:lon-0.01},{lat,lon:lon+0.01}],nodeIds:[`${wayId}a`,`${wayId}b`],tags:{railway:'rail',usage:'main'},usage:'main',service:''};
  return {lat,lon,wayId:String(wayId),segmentIndex:0,osmSnapshot:way};
}

test('HOTFIX7 converts coarse topology memory overflow into recursive hidden fragmentation',async()=>{
  const orm=new ORMClient();
  orm._worldRailCache={releaseMemory(){return {}}};
  orm.releaseScheduleRoutingMemory=()=>({});
  const a=anchor(50,0,'A'),b=anchor(50,8,'B'),m=anchor(50,4,'M');
  let directCalls=0;
  orm._routeScheduleLongRangeWindowed=async(x,y)=>{
    directCalls++;
    const km=Math.abs(Number(y.lon)-Number(x.lon))*71.5;
    if(km>300){const e=new Error('budget');e.code='RAILGRAPH_MEMORY_BUDGET_EXCEEDED';throw e;}
    const r=[{lat:x.lat,lon:x.lon,wayId:x.wayId},{lat:y.lat,lon:y.lon,wayId:y.wayId}];
    r._resolvedAnchors=[x,y];r._longRangeWindowed=true;return r;
  };
  orm._findScheduleLongRangeFragmentCandidates=async()=>[m];
  const route=await orm._routeScheduleLongRangeAdaptive(a,b,{},0);
  assert.ok(route?.length>=3);
  assert.equal(route._longRangeFragmented,true);
  assert.equal(route._longRangeWindowed,true);
  assert.equal(String(route[1].wayId),'M');
  assert.ok(directCalls>=3,'one failed whole solve + two bounded fragment solves expected');
  assert.equal(orm._lastCursorRouteFailure,'');
});

test('HOTFIX7 fragment scan returns real ORM way anchors without constructing a coarse graph',async()=>{
  const orm=new ORMClient();
  orm._worldRailCache={releaseMemory(){return {}}};
  const a=anchor(50,0,'A'),b=anchor(50,8,'B');
  const main={id:'MAIN',railway:'rail',usage:'main',service:'',geometry:[{lat:50.02,lon:3.8},{lat:50.02,lon:4.2}],nodeIds:['m1','m2'],tags:{railway:'rail',usage:'main'}};
  const yard={id:'YARD',railway:'rail',usage:'',service:'siding',geometry:[{lat:50.001,lon:3.9},{lat:50.001,lon:4.1}],nodeIds:['y1','y2'],tags:{railway:'rail',service:'siding'}};
  orm.fetchWorldRailwayTiles=async()=>{
    const arr=[main,yard];Object.defineProperty(arr,'_fetchStats',{value:{failed:0},enumerable:false});return arr;
  };
  const c=await orm._findScheduleLongRangeFragmentCandidates(a,b,{},0);
  assert.ok(c.length>=1);
  assert.equal(c[0].wayId,'MAIN','mainline should outrank a slightly closer siding');
  assert.equal(c[0]._hiddenLongRangeFragment,true);
  assert.equal(c[0].osmSnapshot.id,'MAIN');
});

test('HOTFIX7 source and bundle contract use topology fragmentation identity',()=>{
  const orm=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  const bundle=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url),'utf8');
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(orm,/long-fragment-scan/);
  assert.match(orm,/_routeScheduleLongRangeFragmented/);
  assert.match(bundle,/_routeScheduleLongRangeFragmented/);
  assert.match(bundle,/FULL-AUDIT-TAXONOMY-CROSSSYSTEM-SC-HOTFIX16-MOVEMENT-AUTHORITY/);
  assert.match(index,/1199repair24/);
});
