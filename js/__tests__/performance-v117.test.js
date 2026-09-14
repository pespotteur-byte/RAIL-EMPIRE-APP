import test from 'node:test';
import assert from 'node:assert/strict';
import { ORMClient } from '../orm.js';

const W=(id,pts)=>({id,geometry:pts,maxSpeed:120,electrified:true,tracks:1,usage:'main',service:'',name:'',ref:'',trackRef:'',nodeIds:[]});

test('V1.1.7 station fetch never starts after a zero-rail result', async () => {
  const orm=new ORMClient();
  let stationCalls=0;
  orm.fetchRailwayTiles=async()=>[];
  orm.fetchStationTiles=async()=>{stationCalls++; return [{id:'ghost',lat:48,lon:2,name:'Ghost',urbanTransit:false}];};
  const out=await orm.importInfrastructure(48,2,48.1,2.1);
  assert.equal(out.voiePoints.length,0);
  assert.equal(stationCalls,0,'station tiles must not keep running after track import has already failed');
  assert.equal(out.stationsPromise,null);
});

test('V1.1.7 downloaded rail ways remain importable even when A/B cannot snap', async () => {
  const orm=new ORMClient();
  orm.fetchRailwayTiles=async()=>[
    W(1,[{lat:48,lon:2},{lat:48,lon:2.02},{lat:48,lon:2.04}])
  ];
  orm.fetchStationTiles=async()=>[];
  // clicks intentionally ~70 km away from the fetched railway
  const out=await orm.importInfrastructure(47.4,1.5,47.41,1.51);
  assert.ok(out.voiePoints.length>=2,'OSM ways must not be thrown away merely because a click is off-track');
  assert.ok(out.troncons.length>=1);
  assert.equal(out.snappedA,false);
  assert.equal(out.snappedB,false);
});

test('V1.1.7 long-distance disconnected straight corridor expands automatically', async () => {
  const orm=new ORMClient();
  let railCalls=0;
  orm.fetchRailwayTiles=async()=>{
    railCalls++;
    if(railCalls===1) return [
      W(1,[{lat:48,lon:2},{lat:48,lon:2.1}]),
      W(2,[{lat:49,lon:6.9},{lat:49,lon:7}]),
    ];
    return [
      W(3,[{lat:48,lon:2.1},{lat:48.5,lon:4.5},{lat:49,lon:6.9}])
    ];
  };
  orm.fetchStationTiles=async()=>[];
  const out=await orm.importInfrastructure(48,2,49,7);
  assert.equal(railCalls,2,'must widen beyond the direct corridor when endpoint components are disconnected');
  assert.equal(out.searchMode,'expanded-rectangle');
  assert.ok(out.voiePoints.length>=2);
  assert.ok(out.troncons.length>=1);
});

test('V1.1.7 UI source distinguishes downloaded ways from true no-data', async () => {
  const fs=await import('node:fs');
  const src=fs.readFileSync(new URL('../ui.js', import.meta.url),'utf8');
  assert.ok(src.includes('voie(s) OSM téléchargée(s)'));
  assert.ok(src.includes("p.phase === 'tracks-expand'"));
});
