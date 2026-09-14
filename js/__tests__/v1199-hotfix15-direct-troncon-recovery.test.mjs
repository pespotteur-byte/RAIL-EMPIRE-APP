import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiePointManager} from '../voie-points.js';

function setup(ownerState='blocked_route', withPosition=true){
  const vpm=new VoiePointManager();
  const a=vpm.addVoiePoint({id:'a',lat:48,lon:2,voie:'20'});
  const b=vpm.addVoiePoint({id:'b',lat:48,lon:2.01,voie:'20'});
  const t=vpm.addTroncon({id:'T',pointA:a.id,pointB:b.id,route:[{lat:48,lon:2},{lat:48,lon:2.01}]});
  const ghost={id:'OLD',active:true,completed:false,cancelled:false,state:ownerState,position:withPosition?{lat:48,lon:2}:null};
  globalThis.window={game:{scheduleCreator:{services:[ghost]}}};
  return {vpm,t,ghost};
}

test('HOTFIX15 reserveTroncon retains a physical blocked train but purges an orphan',()=>{
  const {vpm,t,ghost}=setup();t.reservedBy='OLD';
  assert.equal(vpm.reserveTroncon(t.id,'NEW'),false);
  assert.equal(t.reservedBy,'OLD');
  ghost.position=null;
  assert.equal(vpm.reserveTroncon(t.id,'NEW'),true);
  assert.equal(t.reservedBy,'NEW');
});

test('HOTFIX15 occupyTroncon directly purges dead ghost occupation',()=>{
  const {vpm,t}=setup('moving',false);t.occupiedBy='OLD';vpm._occupiedTrcIds.add(t.id);
  assert.equal(vpm.occupyTroncon(t.id,'NEW'),true);
  assert.equal(t.occupiedBy,'NEW');
});

test('HOTFIX15 never steals reservation from a live positioned service',()=>{
  const {vpm,t}=setup('moving',true);t.reservedBy='OLD';
  assert.equal(vpm.reserveTroncon(t.id,'NEW'),false);
  assert.equal(t.reservedBy,'OLD');
});
