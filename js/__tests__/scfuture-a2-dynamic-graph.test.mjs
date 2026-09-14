import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';
import { ScheduleV2Router } from '../schedule-v2-routing.js';

const binding=(wayId,lat,lon,segmentIndex=0)=>({wayId:String(wayId),lat,lon,snapLat:lat,snapLon:lon,segmentIndex});
const way=(id,nodeIds,geometry,extra={})=>({
  id:String(id),nodeIds,geometry,railway:'rail',maxSpeed:120,maxSpeedSource:'OSM',electrified:true,electrifiedMode:'contact_line',
  voltage:[15000],frequency:[16.7],gauge:[1435],tracks:1,usage:'main',service:'',preferredDirection:'',bidirectional:'',oneway:'',tags:{railway:'rail'},...extra,
});

test('A2/HOTFIX81: missing static RailGraph prepares one short railway-only corridor then routes locally',async()=>{
  const orm=new ORMClient();
  // Explicitly emulate the migration state: no packaged graph.
  orm._railGraphPack={prepared:false,ready:async()=>{}};
  let railwayCorridorCalls=0,mapSupplementCalls=0;
  const ways=[
    way(100,[1,2],[{lat:49,lon:8.000},{lat:49,lon:8.010}],{trackRef:'1'}),
    way(101,[2,3],[{lat:49,lon:8.010},{lat:49,lon:8.020}],{trackRef:'1'}),
  ];
  // HOTFIX81 superseded the original A2 acquisition order: railway-only tiled
  // data is authoritative for <=4 km because OSM /map can omit a long way that
  // crosses a small bbox without an interior node. /map remains supplemental.
  orm.fetchWorldRailwayTiles=async()=>{
    railwayCorridorCalls++;
    const out=[...ways];
    Object.defineProperty(out,'_fetchStats',{value:{requested:1,failed:0,ways:out.length},enumerable:false});
    Object.defineProperty(out,'_fetchFailures',{value:[],enumerable:false});
    return out;
  };
  orm.fetchSmallOsmMapCorridor=async()=>{mapSupplementCalls++;throw new Error('complete railway-only corridor must not need supplemental OSM /map');};
  const router=new ScheduleV2Router(orm);
  const route=await router.routeBetweenBindings(binding(100,49,8.001),binding(101,49,8.019),[],{maxSpeed:160});
  assert.ok(route?.length>=3);
  assert.equal(railwayCorridorCalls,1);
  assert.equal(mapSupplementCalls,0);
  assert.equal(route._dynamicRailGraphPrepared,true);
  assert.deepEqual(route._resolvedAnchors.map(x=>String(x.wayId)),['100','101']);
});

test('A2: a prepared static RailGraph remains strict zero-network authority',async()=>{
  let dynamic=0;
  const orm={
    _lastCursorRouteFailure:'',
    async findRouteViaLocalRailGraphAnchors(_anchors,opts){
      assert.equal(opts.allowFallback,false);return [{lat:49,lon:8,wayId:'A'},{lat:49.01,lon:8,wayId:'B'}];
    },
    async prepareAndRouteScheduleAnchors(){dynamic++;throw new Error('must not run');},
    isFallbackRoute(){return false;},
  };
  const router=new ScheduleV2Router(orm);
  const route=await router.routeBetweenBindings(binding('A',49,8),binding('B',49.01,8));
  assert.equal(route.length,2);assert.equal(dynamic,0);
});

test('A2: static topology gap never falls back to network preparation',async()=>{
  let dynamic=0;
  const orm={
    _lastCursorRouteFailure:'',
    async findRouteViaLocalRailGraphAnchors(){this._lastCursorRouteFailure='SOURCE_TOPOLOGY_GAP';return null;},
    async prepareAndRouteScheduleAnchors(){dynamic++;return [];},
    isFallbackRoute(){return false;},
  };
  const router=new ScheduleV2Router(orm);
  await assert.rejects(()=>router.routeBetweenBindings(binding('A',49,8),binding('B',49.01,8)),e=>e?.code==='ORM_SOURCE_TOPOLOGY_GAP');
  assert.equal(dynamic,0);
});
