import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI } from '../ui.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');

globalThis.document={getElementById:()=>null};

function makeUi(){
  const stations=new Map([
    ['dresden',{id:'dresden',name:'Dresden Hbf'}],
    ['dn',{id:'dn',name:'Dresden-Neustadt'}],
    ['bs',{id:'bs',name:'Berlin-Südkreuz'}],
    ['berlin',{id:'berlin',name:'Berlin Hbf'}],
  ]);
  const ver={id:'ver1',locations:[
    {stationId:'dresden',name:'Dresden Hbf',departureSec:18*3600+55*60},
    {stationId:'dn',name:'Dresden-Neustadt',arrivalSec:19*3600+8*60,departureSec:19*3600+10*60},
    {stationId:'bs',name:'Berlin-Südkreuz',arrivalSec:20*3600+40*60,departureSec:20*3600+42*60},
    {stationId:'berlin',name:'Berlin Hbf',arrivalSec:20*3600+50*60},
  ]};
  const rec={id:'sch1',name:'EC 170',number:'170',currentVersion:ver};
  const vehicles=new Map([
    ['l',{id:'l',number:'193 001',name:'Vectron',role:'LEAD',category:'locomotive',traction:'electric',lengthM:19}],
    ['c1',{id:'c1',number:'260',name:'Voiture 260',category:'coach',traction:'none',lengthM:26}],
    ['c2',{id:'c2',number:'259',name:'Voiture 259',category:'coach',traction:'none',lengthM:26}],
    ['c3',{id:'c3',number:'257',name:'Voiture 257',category:'coach',traction:'none',lengthM:26}],
  ]);
  const occ={id:'occ1',scheduleId:'sch1',formation:{members:[
    {vehicleId:'l',role:'LEAD',order:0},{vehicleId:'c1',role:'COACH',order:1},{vehicleId:'c2',role:'COACH',order:2},{vehicleId:'c3',role:'COACH',order:3}
  ]}};
  const ui=Object.create(UI.prototype);
  ui._infogareSelectedStationId='dresden';ui._infogareSelectedServiceKey='v2:sch1';ui._infogareServiceIndex=[];
  ui.game={
    world:{getStationById:id=>stations.get(id)||null},
    scheduleV2:{schedules:[rec],getSchedule:id=>id==='sch1'?rec:null},
    rotationV2:{rotations:[{occurrences:[occ]}],getVehicle:id=>vehicles.get(id)||null,getDirectAssignment:()=>null},
    scheduleCreator:{services:[]},rameManager:{getById:()=>null},
    engine:{currentDate:'2026-08-18',getParisDate:()=> '2026-08-18',getParisTime:()=>({hours:18,minutes:30,seconds:0})},
    incidentManager:{getActiveIncidents:()=>[{active:true,name:'Unwetterschäden an der Strecke',stationA:'dn',stationB:'bs',stationAName:'Dresden-Neustadt',stationBName:'Berlin-Südkreuz'}]},
  };
  ui._collectInfogareV2Trains=()=>[{scheduleId:'sch1',occurrenceId:'occ1',svcId:'live1',depTime:18*60+55,arrTime:18*60+55,waitMin:25,delay:291}];
  return ui;
}

test('DB Quai service search finds schedule by user service name',()=>{const ui=makeUi();const r=ui._findInfogareServices('EC 170');assert.equal(r[0].key,'v2:sch1');assert.equal(r[0].name,'EC 170');});
test('DB Quai data: planned time, delayed white-box time, destination and intermediate stops',()=>{const ui=makeUi();const d=ui._getDbQuaiData('dresden','v2:sch1');assert.equal(d.serviceName,'EC 170');assert.equal(d.scheduledTime,'18:55');assert.equal(d.updatedTime,'23:46');assert.equal(d.destination,'Berlin Hbf');assert.deepEqual(d.stops,['Dresden-Neustadt','Berlin-Südkreuz']);assert.match(d.traffic,/Unwetterschäden/);});
test('DB Quai uses real formation and puts lead locomotive on arrow/right side',()=>{const ui=makeUi();const d=ui._getDbQuaiData('dresden','v2:sch1');assert.equal(d.formation.length,4);assert.equal(d.formation.at(-1).number,'193 001');const h=ui._renderDbQuai(d,{id:'dresden'});assert.match(h,/193 001/);assert.match(h,/class="ig-db-quai-vehicle is-loco"/);assert.match(h,/→/);});
test('DB Quai renderer contains scrolling traffic and served stops, sectors E-D-C-B-A',()=>{const ui=makeUi();const h=ui._renderDbQuai(ui._getDbQuaiData('dresden','v2:sch1'),{});assert.equal((h.match(/ig-db-quai-scroll/g)||[]).length,2);for(const s of ['E','D','C','B','A'])assert.match(h,new RegExp(`>${s}<`));assert.doesNotMatch(h,/S 1|Bad Schandau/);});
test('DB Quai delay box hidden when train is on time',()=>{const ui=makeUi();ui._collectInfogareV2Trains=()=>[{scheduleId:'sch1',occurrenceId:'occ1',depTime:18*60+55,waitMin:25,delay:0}];const d=ui._getDbQuaiData('dresden','v2:sch1');assert.equal(d.updatedTime,'');assert.doesNotMatch(ui._renderDbQuai(d,{}),/ig-db-quai-updated/);});
test('RC24 gameplay Infogare no longer exposes DB Quai as a separate selector',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const board=fs.readFileSync(path.join(root,'js/infogare-re.js'),'utf8');assert.doesNotMatch(html,/id="infogare-service"/);assert.doesNotMatch(html,/value="db-quai"/);assert.match(html,/id="infogare-board"/);assert.match(board,/re-board-brand/);});
test('DB Quai approved source and mock are preserved in reference pack',()=>{assert.ok(fs.existsSync(path.join(root,'img/infogare/reference-sources/DB-QUAI_SOURCE.gif')));assert.ok(fs.existsSync(path.join(root,'img/infogare/reference-sources/DB-QUAI_APPROVED_MOCK.png')));});
