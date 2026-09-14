import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI } from '../ui.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
function makeUi(){ const ui=Object.create(UI.prototype); ui.game={account:{companyName:'PEET'},incidentManager:{getActiveIncidents:()=>[]}}; return ui; }
function train(destination,waitMin,name='TEST',ids=[]){return {isDeparture:true,destination,waitMin,name,servedStationIds:ids,isCancelled:false};}
test('RER RATP wait: minutes then h:mm',()=>{const ui=makeUi();assert.equal(ui._rerRatpWaitText(0),'0 min');assert.equal(ui._rerRatpWaitText(59),'59 min');assert.equal(ui._rerRatpWaitText(60),'1:00');assert.equal(ui._rerRatpWaitText(67),'1:07');assert.equal(ui._rerRatpWaitText(125),'2:05');});
test('RER RATP top two directions are the most frequent in 24h',()=>{const ui=makeUi();assert.deepEqual(ui._rerRatpTopDirections([train('Boissy',2),train('Torcy',5),train('Chessy',12),train('Boissy',24),train('Torcy',67),train('Boissy',300),train('Torcy',500),train('Chessy',700),train('Other',1500)]),['Boissy','Torcy']);});
test('RER RATP keeps 0 min for one minute then shifts',()=>{const ui=makeUi();let h=ui._renderRerRatp({id:'s',name:'Test'},[train('A',-.8,'P0'),train('B',2,'P1'),train('C',3,'P2'),train('D',4,'P3'),train('E',5,'P4'),train('F',6,'P5')],'14:37');assert.match(h,/P0/);assert.match(h,/ig-ratp-wait-num\">0<\/span><span class=\"ig-ratp-wait-unit\">min/);assert.doesNotMatch(h,/P5/);h=ui._renderRerRatp({id:'s',name:'Test'},[train('A',-1.01,'OLD'),train('B',2,'P1'),train('C',3,'P2'),train('D',4,'P3'),train('E',5,'P4'),train('F',6,'P5')],'14:37');assert.doesNotMatch(h,/OLD/);assert.match(h,/P5/);});
test('RER RATP uses player company, five rows, no RER A logo or h:min legend',()=>{const ui=makeUi();const h=ui._renderRerRatp({id:'s',name:'Test'},[train('Torcy',5,'ROPA')],'14:37');assert.match(h,/ig-ratp-live-company">PEET</);assert.equal((h.match(/class="ig-ratp-live-row(?: |")/g)||[]).length,5);assert.doesNotMatch(h,/RER A/);assert.doesNotMatch(h,/h\s*:\s*min/i);});
test('RER RATP incident footer filters to served stations',()=>{const ui=makeUi();ui.game.incidentManager.getActiveIncidents=()=>[{active:true,name:'Signalisation',stationA:'b',stationB:'c',stationAName:'B',stationBName:'C'},{active:true,name:'Sans rapport',stationA:'x',stationB:'y',stationAName:'X',stationBName:'Y'}];const m=ui._rerRatpIncidentText('a',[train('C',10,'T',['b','c'])]);assert.match(m,/Signalisation/);assert.doesNotMatch(m,/Sans rapport/);});
test('RER RATP V2 projection retains served station ids',()=>{const s=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');assert.match(s,/const servedStationIds = \[\]/);assert.match(s,/servedStations, servedStationIds, fromStations/);});
test('RER RATP CSS prefers Parisine and renderer is no longer the old photo-mask implementation',()=>{const css=fs.readFileSync(path.join(root,'style.css'),'utf8');const src=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');assert.match(css,/\.ig-ratp-live-board[\s\S]*font-family:'Parisine'/);const a=src.indexOf('_renderRerRatp');const b=src.indexOf('// --- RER SNCF',a);const chunk=src.slice(a,b);assert.doesNotMatch(chunk,/_igPhotoMask|_igPhotoFrame|RER-RATP_SOURCE/);});
