import test from 'node:test';
import assert from 'node:assert/strict';
import { CantonManager } from '../simulation.js';

function makeManager(){
  const cm=new CantonManager();
  const route=[
    {lat:48,lon:2,wayId:'w1',maxSpeed:120},
    {lat:48.01,lon:2,wayId:'w1',maxSpeed:120},
    {lat:48.02,lon:2,wayId:'w1',maxSpeed:120},
    {lat:48.03,lon:2,wayId:'w1',maxSpeed:120},
  ];
  const a=cm.createRouteCantons(route);
  return {cm,a};
}

test('HOTFIX13 regression: reserve purges dead direct owner before denying departure',()=>{
  const {cm,a}=makeManager();
  assert.ok(a.length>=1);
  const cid=a[Math.min(1,a.length-1)].cantonId;
  const c=cm.cantons.get(cid);
  c.reservedBy='ghost';
  globalThis.window={game:{scheduleCreator:{services:[]}}};
  assert.equal(cm.reserve(cid,'new-train'),true);
  assert.equal(c.reservedBy,'new-train');
  delete globalThis.window;
});

test('HOTFIX13 regression: blocked_route owner remains an obstacle until removed',()=>{
  const {cm,a}=makeManager();
  const cid=a[Math.min(1,a.length-1)].cantonId;
  const c=cm.cantons.get(cid);
  c.reservedBy='broken';
  globalThis.window={game:{scheduleCreator:{services:[{id:'broken',state:'blocked_route',active:true,completed:false,cancelled:false,position:{lat:48,lon:2}}]}}};
  assert.equal(cm.reserve(cid,'new-train'),false);
  assert.equal(c.reservedBy,'broken');
  globalThis.window.game.scheduleCreator.services[0].position=null;
  assert.equal(cm.reserve(cid,'new-train'),true);
  assert.equal(c.reservedBy,'new-train');
  delete globalThis.window;
});

test('HOTFIX13 safety: live owner remains protected',()=>{
  const {cm,a}=makeManager();
  const cid=a[Math.min(1,a.length-1)].cantonId;
  const c=cm.cantons.get(cid);
  c.reservedBy='real';
  globalThis.window={game:{scheduleCreator:{services:[{id:'real',state:'moving',active:true,completed:false,cancelled:false,position:{lat:48,lon:2}}]}}};
  assert.equal(cm.reserve(cid,'new-train'),false);
  assert.equal(c.reservedBy,'real');
  delete globalThis.window;
});
