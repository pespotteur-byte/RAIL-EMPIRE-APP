import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORMClient } from '../orm.js';
import { WorldRailCache } from '../world-rail-cache.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';
import { SchedulePath, RouteSegmentSnapshot, assignResolvedLegsToPath } from '../schedule-v2-model.js';

test('HOTFIX6 world rail cache can release decoded tiles without deleting persistent intent',()=>{
  const c=new WorldRailCache({cellDeg:0.5,maxMemoryTiles:96,maxMemoryWays:50000});
  for(let i=0;i<10;i++)c._remember({schema:'rail-empire-world-rail-v3-all-orm-tracks',key:`k${i}`,complete:true,ways:Array.from({length:100},(_,j)=>({id:`${i}-${j}`}))});
  assert.equal(c.stats().memoryTiles,10);
  const after=c.releaseMemory({maxTiles:2,maxWays:150});
  assert.ok(after.memoryTiles<=2);
  assert.ok(after.memoryWays<=150);
});

test('HOTFIX6 route memory removes raw OSM tag payloads and obeys a point budget',()=>{
  const orm=new ORMClient();
  orm._cursorRouteMemoryMaxEntries=10;orm._cursorRouteMemoryMaxPoints=5;
  const route=(n,offset)=>Array.from({length:n},(_,i)=>({lat:48+i*1e-4,lon:2+offset+i*1e-4,wayId:`w${offset}`,maxSpeed:160,tags:{incline:'5‰',huge:'X'.repeat(50000),operator:'payload'}}));
  for(let k=0;k<3;k++){
    const r=route(3,k);
    orm.rememberCursorRoute([{lat:48,lon:2+k,wayId:`a${k}`},{lat:48.1,lon:2.1+k,wayId:`b${k}`}],r,{});
  }
  const total=[...orm._cursorRouteMemory.values()].reduce((n,x)=>n+x.route.length,0);
  assert.ok(total<=5,'route-memory point budget must evict old long routes');
  for(const rec of orm._cursorRouteMemory.values())for(const p of rec.route){
    assert.deepEqual(p.tags,{incline:'5‰'});
    assert.equal('huge' in p.tags,false);
  }
});

test('HOTFIX6 long-range snapshot drops raw graph metadata and invokes aggressive cleanup',()=>{
  let cleanups=0;
  const router=new ScheduleV2Router({releaseScheduleRoutingMemory(o){if(o?.aggressive)cleanups++;}});
  const route=[
    {lat:48,lon:2,wayId:'1',maxSpeed:160,tags:{incline:'4‰',blob:'Y'.repeat(50000)}},
    {lat:48.1,lon:2.1,wayId:'1',maxSpeed:160,tags:{incline:'4‰',blob:'Z'.repeat(50000)}}
  ];
  route._longRangeWindowed=true;
  const snap=router.snapshotRoute(route);
  assert.equal(cleanups,1);
  assert.deepEqual(snap.routePoints[0].tags,{incline:'4‰'});
  assert.deepEqual(snap.segments[0].tags,{incline:'4‰'});
  assert.equal('blob' in route[0].tags,false,'raw route points should be replaced by compact snapshots');
});

test('HOTFIX6 path assembly reuses transient leg snapshots but keeps a compact independent global geometry',()=>{
  const pts=[{lat:48,lon:2,wayId:'1',maxSpeed:160},{lat:48.05,lon:2.05,wayId:'1',maxSpeed:160},{lat:48.1,lon:2.1,wayId:'2',maxSpeed:120}];
  const segs=[
    new RouteSegmentSnapshot({wayId:'1',from:pts[0],to:pts[1],distanceKm:7,maxSpeed:160,voltage:[25000],gauge:[1435],tags:{foo:'bar'}}),
    new RouteSegmentSnapshot({wayId:'2',from:pts[1],to:pts[2],distanceKm:7,maxSpeed:120,voltage:[25000],gauge:[1435],tags:{foo:'bar'}})
  ];
  const source={id:'L',fromLocationId:'A',toLocationId:'B',constraintIds:[],routePoints:pts,segments:segs,distanceKm:14};
  const path=new SchedulePath();
  assignResolvedLegsToPath(path,[source],{validatedAt:'x',resolvedRevision:1});
  assert.strictEqual(path.legs[0].routePoints,pts,'leg should adopt the fresh compact router snapshot instead of cloning it again');
  assert.strictEqual(path.legs[0].segments[0],segs[0]);
  assert.notStrictEqual(path.routePoints[0],pts[0],'global geometry remains independently checkable');
  assert.equal(path.segments[0].wayId,'1');
  assert.deepEqual(path.segments[0].voltage,[25000],'global safety view must retain electrical constraints at every route length');
  assert.deepEqual(path.segments[0].gauge,[1435],'global safety view must retain gauge constraints');
  assert.deepEqual(path.legs[0].segments[0].voltage,[25000]);
});

test('HOTFIX6 production cache caps and bundle identity are low-memory tuned',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(main,/maxMemoryTiles\s*:\s*32\s*,\s*maxMemoryWays\s*:\s*16000/);
  assert.match(index,/1199repair24/);
});
