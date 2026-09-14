import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { segmentsFromRoute } from '../train-physics.js';
import { CantonManager, haversineDistance } from '../simulation.js';
import { ActiveService } from '../schedule-creator.js';

function makeWay(id, coords, nodeIds=null){
  return {
    id:String(id), geometry:coords.map(([lat,lon])=>({lat,lon})),
    nodeIds:nodeIds||coords.map((_,i)=>`${id}-n${i}`), maxSpeed:160,
    maxSpeedSource:'OSM', electrified:true, tracks:1, usage:'main', service:'',
    railway:'rail', tags:{}, name:'', ref:'', trackRef:'',
  };
}

test('v1.1.69 restored 10/14 candidates uses multi-target routing instead of pairwise dijkstra', async()=>{
  const orm=new ORMClient();
  const ways=[];
  for(let k=0;k<80;k++){
    const lat=48+(k-40)*0.00001;
    const coords=[]; for(let i=0;i<=20;i++) coords.push([lat,2+i*0.005]);
    ways.push(makeWay(k,coords));
  }
  let multi=0,dijkstra=0;
  const rawMulti=orm._routeToTargets.bind(orm);
  orm._routeToTargets=(...a)=>{multi++;return rawMulti(...a);};
  const rawDijkstra=orm.dijkstra.bind(orm);
  orm.dijkstra=(...a)=>{dijkstra++;return rawDijkstra(...a);};
  const route=await orm._routeCursorAnchorChainOnWays(ways,[{lat:48,lon:2.001},{lat:48,lon:2.099}],{allowFallback:false});
  assert.ok(route?.length>=2);
  assert.ok(multi>0 && multi<=10,`expected <=10 multi-target traversals, got ${multi}`);
  assert.equal(dijkstra,0,'pairwise dijkstra fan-out must stay eliminated');
  const src=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  assert.match(src,/0\.25,10/); assert.match(src,/0\.45,14/); // v1.1.74: no 1.2 km snap escape
});

test('v1.1.69 FALLBACK_30 is unknown for timing, documented 30 remains real',()=>{
  const h=(a,b,c,d)=>haversineDistance(a,b,c,d);
  const unknown=[
    {lat:48,lon:2,maxSpeed:160,maxSpeedSource:'OSM'},
    {lat:48,lon:2.01,maxSpeed:30,maxSpeedSource:'FALLBACK_30'},
    {lat:48,lon:2.02,maxSpeed:160,maxSpeedSource:'OSM'},
  ];
  const u=segmentsFromRoute(unknown,160,h);
  assert.ok(u.every(s=>Math.round(s.limitMs*3.6)===160));
  const real30=[
    {lat:48,lon:2,maxSpeed:30,maxSpeedSource:'OSM'},
    {lat:48,lon:2.01,maxSpeed:30,maxSpeedSource:'OSM'},
  ];
  assert.equal(Math.round(segmentsFromRoute(real30,160,h)[0].limitMs*3.6),30);
  const allUnknown=[
    {lat:48,lon:2,maxSpeed:30,maxSpeedSource:'FALLBACK_30'},
    {lat:48,lon:2.01,maxSpeed:30,maxSpeedSource:'FALLBACK_30'},
  ];
  assert.equal(Math.round(segmentsFromRoute(allUnknown,140,h)[0].limitMs*3.6),140);
});

test('v1.1.70 timetable no longer creates an instantaneous cruise cap',()=>{
  const svc=Object.create(ActiveService.prototype);
  svc._v2OccurrenceId='v2-test';
  assert.equal(svc._timetableSpeedCap(120,[{lat:48,lon:2},{lat:48,lon:2.1}]),null);
});

test('v1.1.71 canton route cache key distinguishes geometry / wayId',()=>{
  const cm=new CantonManager();
  const a=[
    {lat:48,lon:2,wayId:'A',maxSpeed:160},
    {lat:48.01,lon:2.01,wayId:'A',maxSpeed:160},
    {lat:48.02,lon:2.02,wayId:'A',maxSpeed:160},
    {lat:48.03,lon:2.03,wayId:'A',maxSpeed:160},
    {lat:48.04,lon:2.04,wayId:'A',maxSpeed:160},
  ];
  const b=a.map(x=>({...x})); b[2].lat+=0.02;
  const c=a.map(x=>({...x,wayId:'B'}));
  assert.notEqual(cm._routeKey(a),cm._routeKey(b));
  assert.notEqual(cm._routeKey(a),cm._routeKey(c));
});

test('v1.1.71 leader protection uses rear length and a continuous braking cap',()=>{
  const route=[]; for(let i=0;i<=100;i++) route.push({lat:48,lon:2+i*0.0001,wayId:'main',maxSpeed:160});
  const follower=Object.create(ActiveService.prototype);
  follower.id='F'; follower.position={...route[20]}; follower.speed=120;
  follower.train={platform:null,decel:2,speed:120}; follower.rame={totalLength:100};
  follower._state={cachedRoute:route,index:20,progress:0}; follower._nearbyServices=[];
  const leader=Object.create(ActiveService.prototype);
  leader.id='L'; leader.position={...route[70]}; leader.speed=0; leader.state='moving';
  leader.train={platform:null,speed:0,length:200}; leader.rame={totalLength:200};
  leader._state={cachedRoute:route,index:70,progress:0};
  const found=follower._findPhysicalLeader([follower,leader],route,6);
  assert.equal(found?.service?.id,'L');
  assert.equal(found.lengthM,200);
  const cap=follower._proximityBlockCheck([follower,leader]);
  assert.ok(cap===null || (cap>=0 && cap<120));
  // Move leader close enough that rear + reaction margin forces a hard slowdown.
  leader.position={...route[38]}; leader._state.index=38;
  const closeCap=follower._proximityBlockCheck([follower,leader]);
  assert.equal(closeCap,0);
});

test('v1.1.72 UI contracts: unclipped train banner, persistent faster ticker, active incident count',()=>{
  const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(css,/\.lvp-bandeau\s*\{[^}]*flex-shrink:0;[^}]*min-height:22px;/s);
  assert.match(ui,/SPEED_PX_PER_SEC\s*=\s*52/);
  assert.match(ui,/preserve el\._alertTickerX/);
  assert.match(ui,/active-incidents-count/);
  assert.match(html,/id="active-incidents-count"/);
});
