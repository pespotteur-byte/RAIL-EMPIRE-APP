import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IncidentManager, Incident } from '../incidents.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');

test('v1.1.65 scheduler starts cleanly mid-hour and produces 50 successful incidents per 60 elapsed game minutes',()=>{
  const m=new IncidentManager();
  let spawned=0;
  m._spawnGuaranteedIncident=()=>({id:`fake-${++spawned}`});
  assert.equal(m._trySpawn(15*60+25,[],null,'winter','2026-08-18'),0,'no catch-up burst on first observation');
  for(let i=1;i<=60;i++) m._trySpawn(15*60+25+i,[],null,'winter','2026-08-18');
  assert.equal(spawned,50);
  assert.ok(m._incidentSpawnCredit < 1);
});

test('v1.1.65 failed target does not consume incident spawn credit',()=>{
  const m=new IncidentManager();
  let allow=false,spawned=0;
  m._spawnGuaranteedIncident=()=>allow?({id:`ok-${++spawned}`}):null;
  m._trySpawn(600,[],null,'winter','2026-08-18');
  for(let i=1;i<=12;i++) m._trySpawn(600+i,[],null,'winter','2026-08-18');
  assert.ok(m._incidentSpawnCredit>=9.9,'ten incidents of credit retained after 12 game minutes');
  allow=true;
  m._trySpawn(613,[],null,'winter','2026-08-18');
  assert.ok(spawned>=10,'backlog catches up once a target becomes valid');
});

test('v1.1.65 incident reasons freeze natural station/interstation wording and survive after leaving only when delay increased',()=>{
  const m=new IncidentManager();
  const world={getStationById(id){return {A:{id:'A',name:'Dormans'},B:{id:'B',name:'Château-Thierry'},M:{id:'M',name:'Meaux'}}[id]||null;}};
  const zone=new Incident({id:'z1',name:'Obstacle sur les voies',stationA:'A',stationB:'B',stationAName:'Dormans',stationBName:'Château-Thierry'});
  assert.equal(m.formatIncidentReason(zone,world),'Obstacle sur les voies entre Dormans et Château-Thierry');
  const station=new Incident({id:'s1',name:'Personnes sur les voies',stationA:'M',stationB:'M',stationAName:'Meaux',stationBName:'Meaux'});
  assert.equal(m.formatIncidentReason(station,world),'Personnes sur les voies à Meaux');

  const svc={train:{delay:7,incidentDelayReasons:[]},delay:7};
  m._syncIncidentDelayReasons(svc,[station],world);
  assert.equal(svc.train.incidentDelayReasons[0].contributed,false);
  svc.train.delay=9; svc.delay=9;
  m._syncIncidentDelayReasons(svc,[station],world);
  assert.equal(svc.train.incidentDelayReasons[0].contributed,true);
  m._syncIncidentDelayReasons(svc,[],world);
  assert.equal(svc.train.incidentDelayReasons.length,1);
  assert.equal(svc.train.incidentDelayReasons[0].text,'Personnes sur les voies à Meaux');
  assert.equal(svc.train.incidentDelayReasons[0].active,false);
});

test('v1.1.65 UI and renderer wire the three operational pictograms and +5 delay history block',()=>{
  const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
  const renderer=fs.readFileSync(path.join(root,'js/renderer.js'),'utf8');
  assert.match(ui,/Motifs du retard/);
  assert.match(ui,/d < 5/);
  assert.match(ui,/operational-icons\.js\?v=1166/);
  assert.match(ui,/op-icon-stop/);
  assert.match(ui,/op-icon-warn/);
  assert.match(ui,/op-icon-works/);
  assert.match(renderer,/drawOperationalEventIcons/);
  assert.match(renderer,/String\(inc\.stationA\) === String\(inc\.stationB\)/);
  assert.match(renderer,/size: stationSize, dx: 0, dy: 0/);
  assert.match(renderer,/inc\.serviceId/);
  assert.match(renderer,/getActiveRestrictions/);
});

test('v1.1.65 transparent assets exist',()=>{
  for(const name of ['incident-interruption.png','incident-warning.png','travaux-warning.png']){
    const p=path.join(root,'img',name);
    assert.ok(fs.existsSync(p),name+' missing');
    assert.ok(fs.statSync(p).size>500,name+' suspiciously small');
  }
});


test('v1.1.65 FILE bundle ships scheduler, operational icons and delay history',()=>{
  const bundle=fs.readFileSync(path.join(root,'js','rail-empire.file.bundle.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(bundle.includes('Rail Empire v1.1.99 FILE:// CORE bundle'));
  assert.ok(bundle.includes('targetIncidentsPerHour = 50'));
  assert.ok(bundle.includes('data:image/png;base64,'));
  assert.ok(bundle.includes('OP_ICON_STOP'));
  assert.ok(bundle.includes('OP_ICON_WARN'));
  assert.ok(bundle.includes('OP_ICON_WORKS'));
  assert.ok(bundle.includes('incidentDelayReasons'));
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
