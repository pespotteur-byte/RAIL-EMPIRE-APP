import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.RE_BASE||path.resolve(import.meta.dirname,'../..');
const mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));

const{ActiveService}=await mod('schedule-creator');
const{Economy}=await mod('economy');
function fixture(){const rame={id:'R',maxSpeed:120,totalMass:100,totalPower:3000,totalLength:20,totalCapacity:0,elementDetails:[],currentLocation:{stationId:'A'}};const s=new ActiveService({id:'R1',name:'Aller',returnName:'Retour',stops:[{stationId:'A',type:'arret',departureTime:600},{stationId:'B',type:'arret',arrivalTime:630,departureTime:630}],routes:[[{lat:48,lon:2,maxSpeed:120},{lat:48.01,lon:2,maxSpeed:120}]],runDays:[1,2]},rame,{getStationById:id=>({id,name:id,lat:48,lon:2})},null);s.state='completed';s.completed=true;s._legacyOperatingDay='2026-09-07';s._legacyLastFinishedDay='2026-09-07';return s;}
function reset(s){const w=globalThis.window;globalThis.window={game:{}};try{assert.equal(s._prepareLegacyOperatingDay(500,'2026-09-08'),true);}finally{globalThis.window=w;}}
test('RC6R-CAL-01: tomorrow starts with outbound name, not yesterday return name',()=>{const s=fixture();s.train.name='Retour';s.isReturnLeg=true;reset(s);assert.equal(s.name,'Aller');assert.equal(s.train.name,'Aller');});
test('RC6R-CAL-02: tomorrow cannot inherit yesterday braking and traction efforts',()=>{const s=fixture();s._brakeEffort=0.8;s._tractiveEffort=0.6;reset(s);assert.equal(s._brakeEffort,0);assert.equal(s._tractiveEffort,0);});
test('RC6R-CAL-03: tomorrow clears old arrival and ITE state',()=>{const s=fixture();s._lastArrivalTime=630;s._iteHardBlock=true;s._iteDwellExtra=20;s._iteCargoMismatch=true;s.train.iteInfo={trancheCount:3};reset(s);assert.equal(s._lastArrivalTime,undefined);assert.equal(s._iteHardBlock,false);assert.equal(s._iteDwellExtra,0);assert.equal(s._iteCargoMismatch,false);assert.equal(s.train.iteInfo,null);});
test('RC6R-CAL-04: a real breakdown and maintenance survive calendar reset',()=>{const s=fixture();s.train.breakdown={type:'moteur'};s.train.inMaintenance=true;s.rame.inMaintenance=true;reset(s);assert.equal(s.train.breakdown.type,'moteur');assert.equal(s.rame.inMaintenance,true);});
test('RC6R-CAL-05: invalid date cannot trigger rearm of a finished duty',()=>{const s=fixture();const before=JSON.stringify({state:s.state,day:s._legacyOperatingDay,completed:s.completed});s._prepareLegacyOperatingDay(500,'2026-02-30');assert.equal(JSON.stringify({state:s.state,day:s._legacyOperatingDay,completed:s.completed}),before);});
