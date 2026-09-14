import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleV2Editor } from '../schedule-v2-editor.js';
import { ScheduleState } from '../schedule-v2-model.js';

test('editing a validated V2 schedule marks it draft and queues every referencing rotation for recalculation', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  const version={state:ScheduleState.VALID};
  const record={id:'sched-1'};
  const recalculated=[];
  editor._pendingRotationScheduleIds=new Set();
  editor.game={rotationV2:{
    findScheduleReferences(id){return id==='sched-1'?[{rotationId:'r1'},{rotationId:'r2'},{rotationId:'r1'}]:[];},
    recalculateRotation(id){recalculated.push(id);},
  }};
  editor.ui={rotationV2Editor:{render(){}}};
  editor._activeRecord=()=>record;
  editor._activeVersion=()=>version;

  editor._markRecordChanged();
  assert.equal(version.state,ScheduleState.DRAFT);
  assert.equal(editor._pendingRotationScheduleIds.has('sched-1'),true);
  editor._flushRotationRecalc();
  assert.deepEqual(recalculated.sort(),['r1','r2']);
  assert.equal(editor._pendingRotationScheduleIds.size,0);
});

test('calendar-only changes may queue rotation recalculation without invalidating a validated route', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  editor._pendingRotationScheduleIds=new Set();
  editor._queueRotationRecalc('sched-2');
  assert.equal(editor._pendingRotationScheduleIds.has('sched-2'),true);
});

test('V2 editor zoom delegates to TileMap.applyZoom around the canvas center', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  const calls=[];
  editor.canvas={getBoundingClientRect(){return {width:1200,height:800};}};
  editor.tileMap={applyZoom(...args){calls.push(args);}};
  editor.draw=()=>calls.push(['draw']);
  editor._zoomMap(1);
  editor._zoomMap(-1);
  assert.deepEqual(calls[0],[1,600,400]);
  assert.deepEqual(calls[2],[-1,600,400]);
});

test('choosing a reference rame switches the active schedule to its real reference composition', async () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  const rame={id:'rame-1',name:'BB 22201 + Corail',maxSpeed:160,totalMass:400,totalPower:4400,totalLength:220,elementDetails:[]};
  const version={category:'PASSENGER',performanceProfile:null};
  editor.game={rameManager:{getById(id){return id==='rame-1'?rame:null;},getAll(){return [rame];}}};
  editor._activeVersion=()=>version;
  editor._snapshot=()=>{};
  editor._markRecordChanged=()=>{};
  editor._autosaveSoon=()=>{};
  editor._recomputeActivePath=async()=>{};
  assert.equal(editor._setReferenceRame('rame-1'),true);
  assert.equal(version.performanceProfile.referenceRameId,'rame-1');
  assert.equal(version.performanceProfile.name,'BB 22201 + Corail');
});

test('return train can keep an independent player-defined name', () => {
  const editor=Object.create(ScheduleV2Editor.prototype);
  editor.returnRecord={id:'ret-1',name:'Ancien nom'};
  editor.returnVersion={state:ScheduleState.DRAFT};
  editor._snapshot=()=>{};
  editor._markRecordChanged=()=>{};
  editor._queueRotationRecalc=()=>{};
  editor._autosaveSoon=()=>{};
  editor._updateHeader=()=>{};
  assert.equal(editor._setReturnName('Lyon → Dijon soirée'),true);
  assert.equal(editor.returnRecord.name,'Lyon → Dijon soirée');
});

test('station click arms cursor-position selection instead of searching ways around the station icon', async () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  ed.pendingStation=null;ed._activeVersion=()=>({locations:[]});let hint='';ed._setHint=x=>{hint=x;};
  ed._loadCandidates=async()=>{throw new Error('must not query candidates at station icon');};
  await ed._addStationStop({id:'ct',name:'Château-Thierry',lat:49.038,lon:3.409});
  assert.equal(ed.pendingStation.action,'ADD');
  assert.equal(ed.pendingStation.station.name,'Château-Thierry');
  assert.match(hint,/zoom voie exacte|trait ORM\/OSM/);
});

test('VIA click binds to the exact nearby OSM way instead of a free cursor anchor', async () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const path={constraints:[]};
  ed._activeVersion=()=>({locations:[{id:'A'}]});ed._activePath=()=>path;
  ed.router={chooseTrackCandidates:async()=>[{wayId:'700',trackRef:'1',distanceM:4.2,snapLat:49.02001,snapLon:3.42002}]};
  ed._snapshot=()=>{};ed._markRecordChanged=()=>{};ed._autosaveSoon=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._setHint=()=>{};ed._recomputeActivePath=async()=>{};ed._error=e=>{throw e;};
  await ed._addConstraint(49.02,3.42);
  assert.equal(path.constraints.length,1);
  assert.equal(path.constraints[0].wayId,'700');
  assert.equal(path.constraints[0].snapLat,49.02001);
  assert.equal(path.constraints[0].snapLon,3.42002);
});

test('explicit VIA mode arms the next map click as routing waypoint', () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  let hint='';
  ed._activeVersion=()=>({locations:[{id:'A'}]});
  ed._setHint=x=>{hint=x;};
  ed._viaNext=false;
  ed.armVia();
  assert.equal(ed._viaNext,true);
  assert.match(hint,/MODE VIA/);
});

test('active metrics expose preview distance time and ETA before a second stop exists', () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const ver={locations:[{departureSec:8*3600}],performanceProfile:{maxSpeed:100,massKg:400000,powerW:4000000,lengthM:180,adhesionMassKg:80000,brakeServiceMs2:.9}};
  const preview=[{lat:48,lon:2,maxSpeed:100},{lat:48.02,lon:2.02,maxSpeed:100}];
  ed._activeVersion=()=>ver;
  ed._activePath=()=>({distanceKm:0});
  ed._activePreview=()=>preview;
  ed.router={snapshotRoute(){return {distanceKm:3.1};}};
  ed.game={weather:null};
  const m=ed._activeMetrics();
  assert.equal(m.preview,true);
  assert.equal(m.distanceKm,3.1);
  assert.ok(m.durationSec>0);
  assert.ok(m.arrival>m.departure);
});

test('creating a return immediately switches to green return mode and arms terminal track selection', async () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const outVersion={locations:[{id:'a',kind:'STATION',stationId:'A',name:'A',track:{displayName:'1'}},{id:'b',kind:'STATION',stationId:'B',name:'B',track:{displayName:'4'}}],category:'PASSENGER',performanceProfile:{toJSON(){return {mode:'LINE_MAX_SPEED',category:'PASSENGER',maxSpeed:160};},maxSpeed:160}};
  ed.record={id:'out',number:'17801',name:'A → B'}; ed.version=outVersion;
  ed.returnRecord=null;ed.returnVersion=null;ed.roundTripGroup=null;ed.mode='OUTBOUND';
  ed.game={scheduleV2:{roundTrips:[],createDraft(){return {id:'ret',number:'17802',name:'Retour',currentVersion:{locations:[],performanceProfile:null}};}}};
  ed._snapshot=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._autosaveSoon=()=>{};let hint='';ed._setHint=x=>{hint=x;};
  await ed.beginReturn();
  assert.equal(ed.mode,'RETURN');
  assert.equal(ed.pendingStation.station.name,'B');
  assert.equal(ed.pendingStation.defaultName,'4');
  assert.match(hint,/RETOUR VERT/);
});

test('map pointer separates a simple placement click from map panning', () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const canvas={style:{}};
  const pans=[]; let clicks=0; let dirties=0;
  ed.canvas=canvas; ed.panThresholdPx=8; ed.dragging=false; ed.panning=false;
  ed.isOpen=()=>true;
  ed.tileMap={pan(dx,dy){pans.push([dx,dy]);},markDirty(){dirties++;}};
  ed._handleMapClick=async()=>{clicks++;}; ed._error=()=>{};
  ed._beginMapPointer({button:0,clientX:100,clientY:100});
  assert.equal(ed._moveMapPointer({clientX:105,clientY:102}),false);
  assert.deepEqual(pans,[]);
  assert.equal(ed._endMapPointer({clientX:105,clientY:102,target:canvas}),'click');
  assert.equal(clicks,1);
  assert.equal(dirties,0);
});

test('dragging past the pan threshold moves the map and never places a routing point', () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const canvas={style:{}};
  const pans=[]; let clicks=0; let dirties=0;
  ed.canvas=canvas; ed.panThresholdPx=8; ed.dragging=false; ed.panning=false;
  ed.isOpen=()=>true;
  ed.tileMap={pan(dx,dy){pans.push([dx,dy]);},markDirty(){dirties++;}};
  ed._handleMapClick=async()=>{clicks++;}; ed._error=()=>{};
  ed._beginMapPointer({button:0,clientX:100,clientY:100});
  assert.equal(ed._moveMapPointer({clientX:112,clientY:100}),true);
  assert.equal(ed.panning,true);
  assert.deepEqual(pans,[[12,0]]);
  ed._moveMapPointer({clientX:117,clientY:103});
  assert.deepEqual(pans,[[12,0],[5,3]]);
  assert.equal(ed._endMapPointer({clientX:117,clientY:103,target:canvas}),'pan');
  assert.equal(clicks,0);
  assert.equal(dirties,2);
});


test('creating a return inherits the outbound calendars', async () => {
  const ed=Object.create(ScheduleV2Editor.prototype);
  const outVersion={locations:[{id:'a',kind:'STATION',stationId:'A',name:'A',track:{displayName:'1'}},{id:'b',kind:'STATION',stationId:'B',name:'B',track:{displayName:'4'}}],calendarIds:['weekday','summer'],category:'PASSENGER',performanceProfile:{toJSON(){return {mode:'LINE_MAX_SPEED',category:'PASSENGER',maxSpeed:160};},maxSpeed:160}};
  ed.record={id:'out',number:'17801',name:'A → B'}; ed.version=outVersion;
  ed.returnRecord=null;ed.returnVersion=null;ed.roundTripGroup=null;ed.mode='OUTBOUND';
  ed.game={scheduleV2:{roundTrips:[],createDraft(data){return {id:'ret',number:data.number,name:data.name,currentVersion:{locations:[],calendarIds:[...(data.calendarIds||[])],performanceProfile:null}};}}};
  ed._snapshot=()=>{};ed.renderPanel=()=>{};ed.draw=()=>{};ed._autosaveSoon=()=>{};ed._setHint=()=>{};
  await ed.beginReturn();
  assert.deepEqual(ed.returnVersion.calendarIds,['weekday','summer']);
});
