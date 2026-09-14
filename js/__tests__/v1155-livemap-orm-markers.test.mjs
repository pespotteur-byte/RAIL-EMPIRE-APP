import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Renderer, LIVEMAP_CATEGORY_COLORS } from '../renderer.js';
import { ActiveService } from '../schedule-creator.js';
import { TrainCategory, PerformanceProfile } from '../schedule-v2-model.js';

const ROOT = new URL('../../', import.meta.url);
const read = rel => fs.readFileSync(new URL(rel, ROOT), 'utf8');

test('v1.1.55 Livemap has the requested seven stable train colours', () => {
  assert.deepEqual(LIVEMAP_CATEGORY_COLORS, {
    voyageur:'#3b82f6', fret:'#22c55e', w:'#94a3b8', hlp:'#334155',
    tm:'#ef4444', infra:'#facc15', ttx:'#f97316',
  });
});

test('v1.1.55 TTX is a real Schedule Creator V2 category, distinct from Infra', () => {
  assert.equal(TrainCategory.TTX, 'TTX');
  const infra = new ActiveService({id:'i',name:'Infra',serviceType:'infra',v2OccurrenceId:'v',stops:[],routes:[]}, null, null, null);
  const ttx = new ActiveService({id:'t',name:'TTX',serviceType:'ttx',v2OccurrenceId:'v',stops:[],routes:[]}, null, null, null);
  assert.equal(infra.category, 'infra');
  assert.equal(ttx.category, 'ttx');
  assert.equal(infra.isTTX, false);
  assert.equal(ttx.isTTX, true);
  assert.equal(infra.isWorkTrain, true);
  assert.equal(ttx.isWorkTrain, true);
  assert.ok(PerformanceProfile.genericForCategory(TrainCategory.TTX, 80));
  assert.match(read('js/schedule-v2-editor.js'), /TTX — train de travaux/);
  assert.match(read('js/schedule-v2-runtime.js'), /\[TrainCategory\.INFRA\]:'infra', \[TrainCategory\.TTX\]:'ttx'/);
});

test('v1.1.55 marker is vector dot + direction tip with no centre pictogram or PNG dependency', () => {
  const source = read('js/renderer.js');
  assert.doesNotMatch(source, /TRAIN_ICON_SRC|train_voyageur\.png|train_fret\.png|train_travaux\.png/);
  const calls = [];
  const ctx = {
    save(){calls.push('save');}, restore(){calls.push('restore');}, beginPath(){calls.push('begin');},
    moveTo(){calls.push('move');}, arc(){calls.push('arc');}, lineTo(){calls.push('line');}, closePath(){calls.push('close');},
    fill(){calls.push('fill');}, stroke(){calls.push('stroke');},
    set globalAlpha(v){this._alpha=v;}, get globalAlpha(){return this._alpha ?? 1;},
    set fillStyle(v){this._fill=v;}, set strokeStyle(v){this._stroke=v;}, set lineWidth(v){this._lw=v;},
  };
  const receiver = { _appendTrainIconPath: Renderer.prototype._appendTrainIconPath };
  Renderer.prototype._drawTrainIcon.call(receiver, ctx, {x:50,y:50}, 'voyageur', '#3b82f6', 6, 'moving', 0);
  assert.equal(calls.filter(x=>x==='arc').length, 1, 'one plain circular body');
  assert.equal(calls.filter(x=>x==='line').length, 2, 'one triangular direction tip');
  assert.equal(calls.filter(x=>x==='fill').length, 1);
});

test('v1.1.55 marker heading comes from the current routed OSM/ORM segment, not next-station bearing', () => {
  const fakeRenderer = {
    latLonToScreen(lat, lon){ return {x:lon*100, y:lat*100}; },
  };
  const svc = {
    position:{lat:0,lon:0.5},
    train:{heading:1.23},
    _state:{index:0,progress:0.5,cachedRoute:[{lat:0,lon:0},{lat:0,lon:1},{lat:1,lon:1}]},
    getTargetStation(){ return {lat:1,lon:0.5}; },
  };
  const h = Renderer.prototype._ormTrainHeading.call(fakeRenderer, svc);
  assert.ok(Math.abs(h) < 1e-9, `expected eastbound current segment, got ${h}`);
});

test('v1.1.55 rotation smoothing takes the shortest angular path', () => {
  const cache = new Map([['s',{angle:Math.PI-0.05,time:1000,seen:1000}]]);
  const fake = {_trainHeadingVisual:cache};
  const out = Renderer.prototype._smoothTrainHeading.call(fake,{id:'s'},-Math.PI+0.05,1016);
  assert.ok(out > Math.PI-0.05 && out < Math.PI+0.05, `unexpected long-way rotation ${out}`);
});


test('v1.1.55 FILE bundle contains the seven-colour vector ORM-following renderer', () => {
  const core = read('js/rail-empire.file.bundle.js');
  assert.match(core, /voyageur:\s*'#3b82f6'/);
  assert.match(core, /ttx:\s*'#f97316'/);
  assert.match(core, /_ormTrainHeading/);
  assert.match(core, /_appendTrainIconPath/);
  assert.match(core, /TTX — train de travaux/);
});
