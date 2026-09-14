import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MovementAuthority } from '../movement-authority.js';
import { operationalDelayMinutes } from '../operational-time.js';
import { VoiePointManager } from '../voie-points.js';

test('HOTFIX16 MovementAuthority: CAUTION limits speed without BLOQUE', () => {
  const train={blockedBy:false,delayReason:''};
  const ma=new MovementAuthority(train);
  ma.begin(160);
  ma.caution(40,'SIGNAL_APPROACH','signal en approche','signal');
  assert.equal(train.blockedBy,false);
  assert.equal(train.movementAuthority.status,'CAUTION');
  assert.equal(train.movementAuthority.speedLimitKmh,40);
});

test('HOTFIX16 MovementAuthority: only explicit STOP produces BLOQUE with exact reason', () => {
  const train={blockedBy:false,delayReason:''};
  const ma=new MovementAuthority(train);
  ma.begin(160);
  ma.stop('CANTON_STOP','canton C12 occupé','canton',{cantonId:'C12'});
  assert.equal(train.blockedBy,true);
  assert.equal(train.movementAuthority.status,'STOP');
  assert.equal(train.movementAuthority.reason,'canton C12 occupé');
  ma.begin(160);
  assert.equal(train.blockedBy,false);
  assert.equal(train.movementAuthority.status,'GO');
});

test('HOTFIX16 operational delay counts complete minutes, not nearest minute', () => {
  assert.equal(operationalDelayMinutes(0.999),0);
  assert.equal(operationalDelayMinutes(1),1);
  assert.equal(operationalDelayMinutes(1.999),1);
  assert.equal(operationalDelayMinutes(2),2);
  assert.equal(operationalDelayMinutes(-0.999),0);
  assert.equal(operationalDelayMinutes(-1),-1);
});

test('HOTFIX16 stale invisible station voie-point owner is purged at direct acquisition', () => {
  const vpm=new VoiePointManager();
  vpm.addVoiePoint({id:'vp20',stationId:'PGE',voie:'20',lat:48.87631,lon:2.35901});
  const vp=vpm.getVoiePointById('vp20');
  vp.occupiedBy='ghost';
  vpm._occupiedVpIds.add('vp20');
  globalThis.window={game:{scheduleCreator:{services:[
    {id:'ghost',active:true,completed:false,cancelled:false,state:'waiting',position:null},
    {id:'new',active:true,completed:false,cancelled:false,state:'waiting',position:{lat:48.87631,lon:2.35901}},
  ]}}};
  assert.equal(vpm.occupyVoiePoint('vp20','new'),true);
  assert.equal(vp.occupiedBy,'new');
});

test('HOTFIX16 never steals a station voie-point from a live positioned train', () => {
  const vpm=new VoiePointManager();
  vpm.addVoiePoint({id:'vp20',stationId:'PGE',voie:'20',lat:48.87631,lon:2.35901});
  const vp=vpm.getVoiePointById('vp20');
  vp.occupiedBy='live';
  vpm._occupiedVpIds.add('vp20');
  globalThis.window={game:{scheduleCreator:{services:[
    {id:'live',active:true,completed:false,cancelled:false,state:'waiting',position:{lat:48.87631,lon:2.35901}},
    {id:'new',active:true,completed:false,cancelled:false,state:'waiting',position:{lat:48.87631,lon:2.35901}},
  ]}}};
  assert.equal(vpm.occupyVoiePoint('vp20','new'),false);
  assert.equal(vp.occupiedBy,'live');
});

test('HOTFIX16 blockedBy has one production writer', () => {
  const files=['schedule-creator.js','schedule-v2-runtime.js','voie-points.js','main.js'];
  for(const file of files){
    const text=fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(text,/\.blockedBy\s*=/,`${file} must submit constraints to MovementAuthority`);
  }
  const ma=fs.readFileSync(new URL('../movement-authority.js',import.meta.url),'utf8');
  assert.match(ma,/this\.train\.blockedBy\s*=\s*d\.status\s*===\s*'STOP'/);
});

test('HOTFIX16 LiveMap uses the common operational minute helper', () => {
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const renderer=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  assert.match(ui,/operationalDelayMinutes\(Number\.isFinite\(t\.delay\)/);
  assert.match(renderer,/const liveDelay = operationalDelayMinutes\(Number\(svc\.train\.delay\) \|\| 0\)/);
  assert.match(renderer,/const delay = operationalDelayMinutes\(Number\(svc\.train\?\.delay/);
});
