import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI } from '../ui.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const src=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');

function makeUi(){
  const stations=[
    {id:'a',name:'Dormans'},
    {id:'b',name:'Château-Thierry'},
    {id:'c',name:'Meaux'},
  ];
  const ui=Object.create(UI.prototype);
  const version={category:'PASSENGER'};
  const record={id:'sch1',number:'17801',name:'TER 17801',currentVersion:version};
  const rotation={id:'rot1',enabled:true};
  const occ={id:'occ1',scheduleId:'sch1'};
  ui.game={
    world:{getStationById:id=>stations.find(s=>s.id===id)||null},
    engine:{currentDate:'2026-08-17',getParisDate:()=> '2026-08-17',getParisTime:()=>({hours:17,minutes:0,seconds:0})},
    scheduleCreator:{services:[]},
    scheduleV2:{getSchedule:id=>id==='sch1'?record:null},
    rotationV2:{rotations:[rotation]},
    scheduleV2Runtime:{
      _runtimeRotations:()=>[rotation],
      planRotationForDate:(r,date)=> date==='2026-08-17' ? [{
        rotation:r,occ,ver:version,baseDate:date,
        locations:[
          {location:{stationId:'a',name:'Dormans',track:{displayName:'1'}},arrivalSec:null,departureSec:17*3600+21*60},
          {location:{stationId:'b',name:'Château-Thierry',track:{displayName:'2'}},arrivalSec:17*3600+31*60,departureSec:17*3600+33*60},
          {location:{stationId:'c',name:'Meaux',track:{displayName:'3'}},arrivalSec:18*3600,departureSec:null},
        ]
      }] : []
    }
  };
  return ui;
}

test('v1.1.60 Infogare reads future V2 timetable plans before runtime spawn',()=>{
  const ui=makeUi();
  const dep=ui._getInfogareTrains('b','sncf-dep');
  assert.equal(dep.length,1);
  assert.equal(dep[0].trainNumber,'17801');
  assert.equal(dep[0].destination,'Meaux');
  assert.equal(dep[0].origin,'Dormans');
  assert.equal(dep[0].voie,'2');
  assert.equal(Math.round(dep[0].waitMin),33);
  assert.equal(dep[0].plannedV2,true);
});

test('v1.1.60 arrivals are also sourced from the V2 timetable',()=>{
  const ui=makeUi();
  const arr=ui._getInfogareTrains('b','sncf-arr');
  assert.equal(arr.length,1);
  assert.equal(arr[0].origin,'Dormans');
  assert.equal(Math.round(arr[0].waitMin),31);
});

test('RC24 gameplay Infogare no longer renders photographic templates',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const board=fs.readFileSync(path.join(root,'js/infogare-re.js'),'utf8');
  assert.doesNotMatch(html,/id="infogare-display"/);
  assert.match(html,/id="infogare-board"/);
  assert.match(board,/re-board-row/);
  assert.doesNotMatch(board,/ig-photo-source|_igPhotoFrame|reference-sources/);
});
