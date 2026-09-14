import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphMarche } from '../graph-marche.js';

function gameBase(){
  const stations=[
    {id:'A',name:'Alpha',lat:48,lon:2},
    {id:'B',name:'Bravo',lat:48.1,lon:2.1},
    {id:'C',name:'Charlie',lat:48.2,lon:2.2},
  ];
  return {
    _currentDate:'2026-09-04',
    world:{stations,getStationById:id=>stations.find(s=>String(s.id)===String(id))||null},
    scheduleCreator:{services:[],getActiveServices(){return this.services.filter(s=>s.active);}},
    scheduleV2:{schedules:[]},
  };
}

test('HOTFIX78 theoretical graph sees inactive legacy timetable services',()=>{
  const game=gameBase();
  game.scheduleCreator.services.push({id:'legacy',name:'L1',active:false,stops:[{stationId:'A'},{stationId:'B'}],routes:[[{lat:48,lon:2},{lat:48.1,lon:2.1}]]});
  const g=new GraphMarche(); g.mode='theoretical';
  assert.equal(game.scheduleCreator.getActiveServices().length,0);
  const matches=g._findServicesThrough(game,'A','B');
  assert.equal(matches.length,1);
  assert.equal(matches[0].svc.id,'legacy');
});

test('HOTFIX78 theoretical graph reads VALID Schedule V2 even without runtime occurrence',()=>{
  const game=gameBase();
  const locA={id:'la',order:0,stationId:'A',name:'Alpha',departureSec:3600,arrivalSec:3600,track:{displayName:'1'}};
  const locB={id:'lb',order:1,stationId:'B',name:'Bravo',departureSec:4200,arrivalSec:4200,track:{displayName:'2'}};
  const ver={id:'v1',state:'VALID',category:'PASSENGER',locations:[locA,locB],outboundPath:{legs:[{fromLocationId:'la',toLocationId:'lb',routePoints:[{lat:48,lon:2},{lat:48.1,lon:2.1}]}]}};
  game.scheduleV2.schedules.push({id:'sch1',number:'17801',name:'Alpha – Bravo',currentVersion:ver});
  const g=new GraphMarche(); g.mode='theoretical';
  const matches=g._findServicesThrough(game,'A','B');
  assert.equal(matches.length,1);
  assert.match(matches[0].svc.id,/^graph-v2:/);
  assert.equal(matches[0].stops[0].departureTime,60);
  assert.equal(matches[0].stops[1].arrivalTime,70);
  assert.equal(matches[0].svc.routes[0].length,2);
});

test('HOTFIX78 live graph still uses only active runtime services',()=>{
  const game=gameBase();
  game.scheduleCreator.services.push({id:'inactive',name:'I',active:false,stops:[{stationId:'A'},{stationId:'B'}]});
  game.scheduleCreator.services.push({id:'active',name:'A',active:true,stops:[{stationId:'A'},{stationId:'B'}]});
  const g=new GraphMarche(); g.mode='live';
  const matches=g._findServicesThrough(game,'A','B');
  assert.deepEqual(matches.map(m=>m.svc.id),['active']);
});
