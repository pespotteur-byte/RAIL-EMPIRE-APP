import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';

const mkWay=(id,a,b,na,nb)=>({
  id:String(id),nodeIds:[na,nb],geometry:[a,b],railway:'rail',maxSpeed:160,maxSpeedSource:'OSM',
  electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],tracks:2,
  usage:'main',service:'',preferredDirection:'',bidirectional:'regular',oneway:'',tags:{railway:'rail'}
});

test('A3: normal station clicks append in authoring order and never use geographic auto-insert',()=>{
  const src=fs.readFileSync(new URL('../schedule-v2-editor.js',import.meta.url),'utf8');
  const addStart=src.indexOf('async _addStationStop(st)');
  const addEnd=src.indexOf('async _changeLocationTrack',addStart);
  assert.ok(addStart>=0&&addEnd>addStart);
  const block=src.slice(addStart,addEnd);
  assert.match(block,/insertIndex\s*:\s*ver\.locations\.length/);
  assert.doesNotMatch(block,/_suggestStopInsertIndex\(st\)/);
});

test('A3: 250+ km dynamic corridor streams max two tiles at once with no duplicate response hedging and three serial failovers',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={prepared:false,ready:async()=>{}};
  const count=72;
  const pts=[];
  for(let i=0;i<=count;i++)pts.push({lat:49.87+i*((52.375-49.87)/count),lon:8.65+i*((9.74-8.65)/count)});
  const ways=[];
  for(let i=0;i<count;i++)ways.push(mkWay(9000+i,pts[i],pts[i+1],`N${i}`,`N${i+1}`));
  const calls=[];
  orm.fetchRailwayTiles=async(tiles,_progress,options)=>{
    calls.push({tileCount:tiles.length,concurrency:options.concurrency,raceEndpoints:options.raceEndpoints,maxEndpoints:options.maxEndpoints});
    const out=[...ways];
    Object.defineProperty(out,'_fetchStats',{value:Object.freeze({requested:tiles.length,failed:0,ways:ways.length}),enumerable:false});
    return out;
  };
  const a={...pts[0],wayId:'9000',segmentIndex:0};
  const b={...pts.at(-1),wayId:String(9000+count-1),segmentIndex:0};
  const route=await orm.prepareAndRouteScheduleAnchors([a,b],{allowFallback:false});
  assert.ok(route?.length>=count,'long exact chain should route after streamed acquisition');
  assert.ok(calls.length>=2,'long route should be split into multiple bounded fetch windows');
  assert.ok(calls.every(c=>c.tileCount<=2),`expected <=2 tiles per network window, got ${calls.map(c=>c.tileCount).join(',')}`);
  assert.ok(calls.every(c=>c.concurrency<=2));
  assert.ok(calls.every(c=>c.raceEndpoints===0),'long route must not decode duplicate hedged payloads');
  assert.ok(calls.every(c=>c.maxEndpoints===3),'three endpoints remain available as serial failover without duplicate body decoding');
});
