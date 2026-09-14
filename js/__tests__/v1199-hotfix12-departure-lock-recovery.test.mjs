import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VoiePointManager } from '../voie-points.js';
import { ScheduleCreator } from '../schedule-creator.js';

function makeVpm(){
  const vpm=new VoiePointManager();
  vpm.addVoiePoint({id:'a',lat:48,lon:2,voie:'1'});
  vpm.addVoiePoint({id:'b',lat:48.001,lon:2.001,voie:'1'});
  const trc=vpm.addTroncon({id:'t1',pointA:'a',pointB:'b',route:[{lat:48,lon:2},{lat:48.001,lon:2.001}],distance:0.15});
  return {vpm,trc};
}

test('HOTFIX12: dead reservedBy owner is purged before troncon availability check',()=>{
  const {vpm,trc}=makeVpm();
  trc.reservedBy='ghost';
  const game={scheduleCreator:{services:[]}};
  globalThis.window={game};
  assert.equal(vpm.isTronconOccupied(trc.id,'new-train'),false);
  assert.equal(trc.reservedBy,null);
  assert.equal(vpm.occupyTroncon(trc.id,'new-train'),true);
  delete globalThis.window;
});

test('HOTFIX12: blocked_route physical train protects its section; removal releases it',()=>{
  const {vpm,trc}=makeVpm();
  trc.reservedBy='broken-route';
  const game={scheduleCreator:{services:[{id:'broken-route',active:true,completed:false,cancelled:false,state:'blocked_route',position:{lat:48,lon:2}}]}};
  globalThis.window={game};
  assert.equal(vpm.isTronconReserved(trc.id,'new-train'),true);
  assert.equal(trc.reservedBy,'broken-route');
  game.scheduleCreator.services[0].position=null;
  assert.equal(vpm.isTronconReserved(trc.id,'new-train'),false);
  assert.equal(trc.reservedBy,null);
  delete globalThis.window;
});

test('HOTFIX12: reservation held by a real active train remains protected',()=>{
  const {vpm,trc}=makeVpm();
  trc.reservedBy='real';
  const game={scheduleCreator:{services:[{id:'real',active:true,completed:false,cancelled:false,state:'moving',position:{lat:48,lon:2}}]}};
  globalThis.window={game};
  assert.equal(vpm.isTronconOccupied(trc.id,'new-train'),true);
  assert.equal(trc.reservedBy,'real');
  assert.equal(vpm.occupyTroncon(trc.id,'new-train'),false);
  delete globalThis.window;
});

test('HOTFIX12: station resource stays occupied by a positioned blocked_route owner',()=>{
  const sc=new ScheduleCreator();
  const world={stations:[{id:'A',name:'A',lat:48,lon:2,platforms:2}],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
  const svc=sc.addService({id:'new',name:'New',rameId:'r',stops:[{stationId:'A',type:'arret',departureTime:0,arrivalTime:0,platform:'1'},{stationId:'A',type:'arret',departureTime:10,arrivalTime:10,platform:'1'}],routes:[[{lat:48,lon:2},{lat:48.001,lon:2.001}]],active:true},{id:'r',totalLength:20,totalPower:1000,maxSpeed:100,elementDetails:[]},world);
  sc.services.push({id:'blocked',active:true,completed:false,cancelled:false,state:'blocked_route',position:{lat:48,lon:2}});
  globalThis.window={game:{scheduleCreator:sc}};
  assert.equal(svc._isLiveResourceOwner('blocked'),true);
  sc.services.find(s=>s.id==='blocked').position=null;
  assert.equal(svc._isLiveResourceOwner('blocked'),false,'removed physical train must release ownership');
  assert.equal(svc._isLiveResourceOwner('new'),true);
  delete globalThis.window;
});

test('HOTFIX12: blocked_route finalization explicitly frees physical resources and reload clears reservations',()=>{
  const runtime=fs.readFileSync(new URL('../schedule-v2-runtime.js',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(runtime,/svc\._releaseAllPhysicalResources\?\.\(\)/);
  assert.match(main,/trc\.occupiedBy\s*=\s*null;\s*trc\.reservedBy\s*=\s*null/);
});
