import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActiveService } from '../schedule-creator.js';

function svcWithRouteState({segDists, transitions=[]}={}) {
  const svc=Object.create(ActiveService.prototype);
  const d=Float64Array.from(segDists||[]);
  const cum=new Float64Array(d.length+1);
  for(let i=d.length-1;i>=0;i--)cum[i]=d[i]+cum[i+1];
  svc._state={segDists:d,cumDist:cum,negativeSpeedTransitions:transitions};
  svc.train={decel:3.24,length:200}; // 0.9 m/s² expressed as km/h/s
  svc.rame={totalLength:200};
  svc._negativeBufferKm=0.10;
  svc._getWeatherEffects=()=>({brakeFactor:1});
  return svc;
}

test('infra speed limit inspects only the contiguous track occupied by the consist',()=>{
  const route=[
    {maxSpeed:160},{maxSpeed:80},{maxSpeed:120},{maxSpeed:140},{maxSpeed:140},
  ];
  // Each segment is 100 m. Front is halfway through segment 3, 250 m train:
  // tail reaches back through segments 2 and 1, so the 80 km/h section applies.
  const svc=svcWithRouteState({segDists:[0.1,0.1,0.1,0.1]});
  assert.equal(svc._getInfraSpeedLimit(route,3,0.5,250),80);
  // A short train wholly inside segment 3 only sees its local 140 km/h limit.
  assert.equal(svc._getInfraSpeedLimit(route,3,0.8,50),140);
});

test('negative speed transition braking cap is found from pre-indexed transitions',()=>{
  const route=[{maxSpeed:160},{maxSpeed:160},{maxSpeed:160},{maxSpeed:80},{maxSpeed:80}];
  const segDists=[0.4,0.4,0.4,0.4];
  // Transition into route point 3 at 1.2 km from route start.
  const svc=svcWithRouteState({segDists,transitions:[{index:3,speed:80,distanceKm:1.2}]});
  // Front at 0.9 km (segment 2 @ 25%): braking should already cap 160 km/h.
  const cap=svc._getNegativeTransitionCap(route,2,0.25,160);
  assert.ok(Number.isFinite(cap));
  assert.ok(cap<160 && cap>=80,`expected cap in [80,160), got ${cap}`);
  // Far before the same restriction: no cap yet.
  const far=svc._getNegativeTransitionCap(route,0,0,160);
  assert.equal(far,null);
});

test('movement hot path no longer rescans the whole route for every 10 m of train length',()=>{
  const src=fs.readFileSync(new URL('../schedule-creator.js',import.meta.url),'utf8');
  const a=src.slice(src.indexOf('  _getInfraSpeedLimit('),src.indexOf('  // Annexe 3A — B.',src.indexOf('  _getInfraSpeedLimit(')));
  assert.doesNotMatch(a,/for\s*\(let dBack\s*=\s*0/);
  assert.doesNotMatch(a,/for\s*\(let i\s*=\s*0;\s*i\s*<\s*segDists\.length/);
  assert.match(a,/while\s*\(\s*remainingKm\s*>\s*0\s*&&\s*i\s*>=\s*0\s*\)/);

  const b=src.slice(src.indexOf('  _getNegativeTransitionCap('),src.indexOf('  // DDS-05',src.indexOf('  _getNegativeTransitionCap(')));
  assert.match(b,/negativeSpeedTransitions/);
  assert.match(b,/while\s*\(\s*lo\s*<\s*hi\s*\)/);
  assert.doesNotMatch(b,/for\s*\(let i\s*=\s*segIdx\s*\+\s*1;\s*i\s*<\s*route\.length/);
});
