import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

function mkWay(id,a,b,nodeA,nodeB,extra={}){
  return {id:String(id),railway:'rail',geometry:[a,b],nodeIds:[String(nodeA),String(nodeB)],maxSpeed:160,maxSpeedSource:'OSM',usage:'main',service:'',tags:{railway:'rail',usage:'main',maxspeed:'160'},...extra};
}
function bbox(w){const lats=w.geometry.map(p=>p.lat),lons=w.geometry.map(p=>p.lon);return {s:Math.min(...lats),n:Math.max(...lats),w:Math.min(...lons),e:Math.max(...lons)};}
function hits(w,envelopes){const b=bbox(w);return (envelopes||[]).some(t=>b.n>=t.south&&b.s<=t.north&&b.e>=t.west&&b.w<=t.east);}
function response(list,requested=1){Object.defineProperty(list,'_fetchStats',{value:{requested,failed:0,ways:list.length},enumerable:false});Object.defineProperty(list,'_fetchFailures',{value:[],enumerable:false});return list;}

function network400(){
  const ways=[];const truePts=[];const n=24;
  for(let i=0;i<=n;i++){
    const t=i/n,lon=2+5.35*t;
    // Real corridor deviates ~65 km north around the middle.
    const lat=48+0.60*Math.sin(Math.PI*t);
    truePts.push({lat,lon});
  }
  for(let i=0;i<n;i++)ways.push(mkWay(`T${i}`,truePts[i],truePts[i+1],`TN${i}`,`TN${i+1}`));
  // Tempting straight branch: starts with the real route, runs ~250 km, then dies.
  const deadN=15,deadPts=[];
  for(let i=0;i<=deadN;i++)deadPts.push({lat:48,lon:2+3.45*(i/deadN)});
  for(let i=0;i<deadN;i++)ways.push(mkWay(`D${i}`,deadPts[i],deadPts[i+1],i===0?'TN0':`DN${i}`,`DN${i+1}`));
  return {ways,truePts};
}

test('HOTFIX4 routes ~400 km with departure + arrival only using bounded hidden exact windows',async()=>{
  const orm=new ORMClient(),net=network400();
  orm.fetchWorldRailwayTiles=async(envelopes)=>response(net.ways.filter(w=>hits(w,envelopes)),envelopes?.length||1);
  const aWay=net.ways.find(w=>w.id==='T0'),bWay=net.ways.find(w=>w.id==='T23');
  const a={lat:aWay.geometry[0].lat,lon:aWay.geometry[0].lon,wayId:'T0',segmentIndex:0,osmSnapshot:aWay};
  const b={lat:bWay.geometry[1].lat,lon:bWay.geometry[1].lon,wayId:'T23',segmentIndex:0,osmSnapshot:bWay};
  const route=await orm.prepareAndRouteScheduleAnchors([a,b],{allowSyntheticStitches:false,routeObjective:'distance'});
  assert.ok(route?.length>20,'400 km route should resolve without user VIA');
  assert.equal(route._longRangeWindowed,true);
  assert.equal(orm._lastCursorRouteFailure,'');
  assert.equal(orm._lastCursorRouteDiagnostics.mode,'schedule-long-range-windowed');
  assert.ok(orm._lastCursorRouteDiagnostics.hiddenPortals>=5,'solver should create hidden portals, not user points');
  assert.ok(Number(orm._lastCursorRouteDiagnostics.releasedCoarse?.ways||0)>0,'macro topology must be released before exact windows');
  assert.ok(Number(orm._lastCursorRouteDiagnostics.releasedCoarse?.nodes||0)>0,'macro node index must be released before exact windows');
  assert.ok(orm._lastCursorRouteDiagnostics.exactWindows>=6);
  assert.ok(orm._lastCursorRouteDiagnostics.maxExactWindowSegments<260000);
  assert.ok(route.some(p=>String(p.wayId).startsWith('T')));
  assert.ok(!route.some(p=>String(p.wayId)==='D14'),'dead straight branch must not become the final corridor');
});

test('HOTFIX4 window memory governor stops a pathological exact graph before construction',()=>{
  const orm=new ORMClient();
  const ways=[];
  for(let i=0;i<20;i++){
    const geometry=[];for(let j=0;j<20001;j++)geometry.push({lat:48+i*1e-5,lon:2+j*1e-6});
    ways.push({id:String(i),railway:'rail',geometry,nodeIds:geometry.map((_,j)=>`${i}-${j}`),tags:{railway:'rail'}});
  }
  assert.throws(()=>orm._scheduleLongRangeBudgetCheck(ways,{longRangeMaxWindowWays:26000,longRangeMaxWindowSegments:260000}),e=>e?.code==='RAILGRAPH_MEMORY_BUDGET_EXCEEDED');
});

test('HOTFIX4 resolves ~900 km with a large real railway detour and no user VIA',async()=>{
  const orm=new ORMClient(),ways=[],pts=[],n=45;
  for(let i=0;i<=n;i++){
    const t=i/n,lon=2+12.0*t;
    // Deliberately move the real railway roughly 70-80 km away from the direct chord.
    const lat=48+0.70*Math.sin(Math.PI*t);
    pts.push({lat,lon});
  }
  for(let i=0;i<n;i++)ways.push(mkWay(`L${i}`,pts[i],pts[i+1],`LN${i}`,`LN${i+1}`));
  orm.fetchWorldRailwayTiles=async(envelopes)=>response(ways.filter(w=>hits(w,envelopes)),envelopes?.length||1);
  const aWay=ways[0],bWay=ways.at(-1);
  const a={lat:aWay.geometry[0].lat,lon:aWay.geometry[0].lon,wayId:aWay.id,segmentIndex:0,osmSnapshot:aWay};
  const b={lat:bWay.geometry[1].lat,lon:bWay.geometry[1].lon,wayId:bWay.id,segmentIndex:0,osmSnapshot:bWay};
  const route=await orm.prepareAndRouteScheduleAnchors([a,b],{allowSyntheticStitches:false,routeObjective:'distance'});
  assert.ok(route?.length>35,'900 km route should resolve from departure + arrival only');
  assert.equal(route._longRangeWindowed,true);
  assert.equal(orm._lastCursorRouteFailure,'');
  assert.equal(orm._lastCursorRouteDiagnostics.mode,'schedule-long-range-windowed');
  assert.ok(orm._lastCursorRouteDiagnostics.hiddenPortals>=10);
  assert.ok(orm._lastCursorRouteDiagnostics.maxExactWindowSegments<260000);
});


test('HOTFIX5 long-range route reports UI window progress with a finite distanceKm',async()=>{
  const orm=new ORMClient(),net=network400();
  orm.fetchWorldRailwayTiles=async(envelopes)=>response(net.ways.filter(w=>hits(w,envelopes)),envelopes?.length||1);
  const aWay=net.ways.find(w=>w.id==='T0'),bWay=net.ways.find(w=>w.id==='T23');
  const a={lat:aWay.geometry[0].lat,lon:aWay.geometry[0].lon,wayId:'T0',segmentIndex:0,osmSnapshot:aWay};
  const b={lat:bWay.geometry[1].lat,lon:bWay.geometry[1].lon,wayId:'T23',segmentIndex:0,osmSnapshot:bWay};
  const progress=[];
  const route=await orm.prepareAndRouteScheduleAnchors([a,b],{
    allowSyntheticStitches:false,
    routeObjective:'distance',
    onPreparationProgress:info=>progress.push(info),
  });
  assert.ok(route?.length>20,'route should still resolve with the real Schedule Creator progress callback enabled');
  const windows=progress.filter(x=>x?.phase==='long-window');
  assert.ok(windows.length>0,'long-range planner should emit exact-window progress');
  assert.ok(windows.every(x=>Number.isFinite(Number(x.distanceKm))&&Number(x.distanceKm)>100),'UI progress distanceKm must never be undefined');
});
