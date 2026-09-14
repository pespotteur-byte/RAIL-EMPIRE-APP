import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';
import { PerformanceProfile } from '../schedule-v2-model.js';
import { calculatePhysicalTravelSeconds } from '../schedule-v2-timing.js';

const mkWay=(id,a,b,na,nb,v=200)=>({
  id:String(id),nodeIds:[na,nb],geometry:[a,b],railway:'rail',maxSpeed:v,maxSpeedSource:'OSM',
  maxSpeedForward:null,maxSpeedBackward:null,electrified:true,electrifiedMode:'contact_line',voltage:[15000],frequency:[16.7],gauge:[1435],tracks:2,
  usage:'main',service:'',trafficMode:'',preferredDirection:'',bidirectional:'regular',oneway:'',trainProtection:{},tags:{railway:'rail',maxspeed:String(v)}
});

const binding=(wayId,lat,lon)=>({wayId:String(wayId),lat,lon,snapLat:lat,snapLon:lon,segmentIndex:0});

test('A4: Schedule route preserves infrastructure Vmax, so changing sillon Vmax retimes without rerouting',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={prepared:false,ready:async()=>{}};
  const ways=[
    mkWay('A',{lat:49,lon:8},{lat:49,lon:8.08},1,2,200),
    mkWay('B',{lat:49,lon:8.08},{lat:49,lon:8.16},2,3,200),
  ];
  orm.fetchRailwayTiles=async()=>{const out=[...ways];Object.defineProperty(out,'_fetchStats',{value:Object.freeze({requested:1,failed:0,ways:2}),enumerable:false});return out;};
  const router=new ScheduleV2Router(orm);
  const route=await router.routeBetweenBindings(binding('A',49,8.005),binding('B',49,8.155),[],{maxSpeed:80});
  assert.ok(route?.length>=3);
  assert.equal(Math.max(...route.map(p=>Number(p.maxSpeed)||0)),200,'route snapshot must keep raw line speed, not the old sillon cap');
  const p80=PerformanceProfile.genericForCategory('PASSENGER',80);
  const p160=PerformanceProfile.genericForCategory('PASSENGER',160);
  const t80=calculatePhysicalTravelSeconds(route,p80);
  const t160=calculatePhysicalTravelSeconds(route,p160);
  assert.ok(t160<t80,`raising Vmax must shorten timing on the same geometry (${t80} -> ${t160})`);
});

test('A4: long dynamic fetches are transient and compact-state routing is requested',async()=>{
  const orm=new ORMClient();
  orm._railGraphPack={prepared:false,ready:async()=>{}};
  const count=80,pts=[];
  for(let i=0;i<=count;i++)pts.push({lat:49+i*0.025,lon:8+i*0.012});
  const ways=[];for(let i=0;i<count;i++)ways.push(mkWay(10000+i,pts[i],pts[i+1],`L${i}`,`L${i+1}`,160));
  const optsSeen=[];
  orm.fetchRailwayTiles=async(tiles,_p,opts)=>{optsSeen.push({...opts,tileCount:tiles.length});const out=[...ways];Object.defineProperty(out,'_fetchStats',{value:Object.freeze({requested:tiles.length,failed:0,ways:ways.length}),enumerable:false});return out;};
  const route=await orm.prepareAndRouteScheduleAnchors([
    {...pts[0],wayId:'10000',segmentIndex:0},
    {...pts.at(-1),wayId:String(10000+count-1),segmentIndex:0},
  ],{allowFallback:false,routeObjective:'distance',compactGraphEdges:true,compactStateKeys:true,preserveInfrastructureMaxSpeed:true});
  assert.ok(route?.length>=count);
  assert.ok(optsSeen.length>=2);
  assert.ok(optsSeen.every(x=>x.transient===true),'250+ km working tiles must not be retained in world ORM caches');
  assert.ok(route._routingDiagnostics?.compactStateKeys!==false);
});
