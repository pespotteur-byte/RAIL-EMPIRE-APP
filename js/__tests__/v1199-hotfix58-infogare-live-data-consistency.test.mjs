import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI } from '../ui.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

globalThis.document={getElementById:()=>null};

function bareUi(){
  const ui=Object.create(UI.prototype);
  ui._infogareSelectedStationId='A';
  ui._infogareServiceIndex=[];
  ui.game={
    engine:{currentDate:'2026-09-02',getParisDate:()=> '2026-09-02',getParisTime:()=>({hours:12,minutes:0,seconds:0})},
    world:{stations:[],getStationById:id=>({id,name:id})},
    scheduleCreator:{services:[]},
  };
  return ui;
}

test('HOTFIX58 passenger boards exclude freight/HLP/TTX rows',()=>{
  const ui=bareUi();
  ui._collectInfogareV2Trains=()=>[
    {svcId:'p',category:'PASSENGER',isDeparture:true,depTime:730,depWaitMin:10,waitMin:10},
    {svcId:'f',category:'FREIGHT',isDeparture:true,depTime:735,depWaitMin:15,waitMin:15},
    {svcId:'h',category:'HLP',isDeparture:true,depTime:740,depWaitMin:20,waitMin:20},
    {svcId:'t',category:'TTX',isDeparture:true,depTime:745,depWaitMin:25,waitMin:25},
  ];
  ui._collectInfogareLegacyTrains=()=>[];
  const rows=ui._getInfogareTrains('A','sncf-dep');
  assert.deepEqual(rows.map(r=>r.svcId),['p']);
});

test('HOTFIX58 legacy passenger detection rejects operational non-passenger types',()=>{
  const ui=bareUi();
  for(const serviceType of ['fret','w','hlp','tm','infra','ttx','work']) assert.equal(ui._isInfogarePassengerService({serviceType}),false,serviceType);
  for(const serviceType of ['passager','passenger','voyageur']) assert.equal(ui._isInfogarePassengerService({serviceType}),true,serviceType);
});

test('HOTFIX58 V2 Infogare prefers actual runtime platform and gives planned occurrence a clickable stable id',()=>{
  const ui=bareUi();
  const ver={id:'v1',category:'PASSENGER',locations:[
    {stationId:'A',track:{displayName:'1'}},{stationId:'B',track:{displayName:'2'}}
  ]};
  const rec={id:'sch',name:'TER 1',number:'1',currentVersion:ver};
  const plan={ver,occ:{id:'occ',scheduleId:'sch'},locations:[
    {location:ver.locations[0],arrivalSec:12*3600+600,departureSec:12*3600+600},
    {location:ver.locations[1],arrivalSec:13*3600}
  ]};
  ui.game.scheduleV2={getSchedule:id=>id==='sch'?rec:null};
  ui.game.rotationV2={rotations:[{id:'rot',enabled:true}]};
  ui.game.scheduleV2Runtime={_runtimeRotations:()=>[{id:'rot',enabled:true}],planRotationForDate:()=>[plan]};
  ui.game.scheduleCreator.services=[{id:'v2:rot:occ:2026-09-02',delay:0,state:'waiting',train:{platform:'7'},_platformAssignment:{stationId:'A',platform:'9'}}];
  let rows=ui._collectInfogareV2Trains('A','2026-09-02',12*60);
  assert.equal(rows[0].voie,'9');
  assert.equal(rows[0].svcId,'v2:rot:occ:2026-09-02');
  ui.game.scheduleCreator.services=[];
  rows=ui._collectInfogareV2Trains('A','2026-09-02',12*60);
  assert.equal(rows[0].svcId,'v2:rot:occ:2026-09-02');
  assert.equal(rows[0].state,'planned');
  assert.equal(rows[0].versionId,'v1');
});

test('HOTFIX58 DB Quai service search stays in selected station instead of silently moving the station',()=>{
  const ui=bareUi();
  ui._infogareServiceIndex=[
    {key:'v2:1',name:'ICE 1',number:'1',route:'A → B',stationIds:['A','B'],search:'ice 1 a b'},
    {key:'v2:2',name:'ICE 2',number:'2',route:'C → D',stationIds:['C','D'],search:'ice 2 c d'},
  ];
  assert.deepEqual(ui._findInfogareServices('ICE',12).map(x=>x.key),['v2:1']);
});

test('RC24 UI exposes a single RE board while preserving station, planned V2 and actual platform data',()=>{
  const html=read('index.html'),ui=read('js/ui.js'),board=read('js/infogare-re.js');
  assert.doesNotMatch(html,/id="infogare-display"/);
  assert.match(html,/id="infogare-station"/);assert.match(html,/id="infogare-board"/);
  assert.match(ui,/new RailEmpireBoard/);assert.match(ui,/_getInfogareTrains/);
  assert.match(board,/re-board-arrivals/);assert.match(board,/re-board-departures/);
});
