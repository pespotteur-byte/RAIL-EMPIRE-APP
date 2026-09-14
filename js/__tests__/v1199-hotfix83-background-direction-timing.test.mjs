import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePhysicalTravelSeconds } from '../schedule-v2-timing.js';
import { ORMClient } from '../orm.js';

const profile={maxSpeed:160,massKg:400000,powerW:6400000,lengthM:200,adhesionMassKg:320000,brakeServiceMs2:0.9};

function lineRoute(direction, documented=true){
  const pts=[];
  for(let i=0;i<=40;i++){
    const p={lat:48.0+i*0.005,lon:2.0+i*0.001,wayId:'PLM',travelDirection:direction,maxSpeedForward:160,maxSpeedBackward:null,electrified:true};
    if(direction==='forward'&&documented){p.maxSpeed=160;p.maxSpeedSource='OSM_DIRECTIONAL';}
    else {p.maxSpeed=30;p.maxSpeedSource='FALLBACK_30';}
    pts.push(p);
  }
  return direction==='forward'?pts:pts.slice().reverse().map(p=>({...p,travelDirection:'backward'}));
}

test('HOTFIX83: one-sided OSM maxspeed does not make reverse running use train Vmax',()=>{
  const fwd=calculatePhysicalTravelSeconds(lineRoute('forward'),profile);
  const back=calculatePhysicalTravelSeconds(lineRoute('backward',false),profile);
  const ratio=Math.max(fwd,back)/Math.max(1,Math.min(fwd,back));
  assert.ok(ratio<1.03,`same physical line should have stable timing, got ${fwd}s vs ${back}s`);
});


test('HOTFIX83: ORM edge metadata itself reuses same-way opposite directional speed when generic speed is unknown',()=>{
  const way={
    id:42,maxSpeed:30,maxSpeedSource:'FALLBACK_30',maxSpeedForward:160,maxSpeedBackward:null,
    preferredDirection:'',bidirectional:'regular',oneway:'',service:'',tags:{railway:'rail'},
    railway:'rail',railwayLifecycle:'present',railwayBaseType:'rail',tracks:2,
  };
  const reverse=ORMClient.prototype._edgeMetadata.call({},way,false);
  assert.equal(reverse.maxSpeed,160);
  assert.equal(reverse.maxSpeedSource,'OSM_OPPOSITE_DIRECTION_FALLBACK');
  assert.equal(reverse.travelDirection,'backward');
});

test('HOTFIX83: main installs a hidden-tab simulation heartbeat',()=>{
  const src=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(src,/_backgroundSimInterval\s*=\s*setInterval/);
  assert.match(src,/document\.hidden/);
  assert.match(src,/catchUpExistingToClock/);
});

test('HOTFIX83: runtime exposes existing-service timetable catch-up',()=>{
  const src=readFileSync(new URL('../schedule-v2-runtime.js',import.meta.url),'utf8');
  assert.match(src,/catchUpExistingToClock\(timeOfDay\s*,\s*dateStr/);
  assert.match(src,/effectiveNow\s*=\s*relNow\s*-/);
});
