import test from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../ui.js';
import { haversineDistance } from '../simulation.js';
const p=(lat,lon)=>({lat,lon});
function fixture(){
 const route=[p(48,2),p(48.01,2)];const future=[p(48.01,2),p(48.01,2.04),p(48,2.04),p(48,2.0005)];
 const stops=[{stationId:'A',type:'arret'},{stationId:'T',type:'passage'},{stationId:'B',type:'arret',arrivalTime:700,departureTime:702}];
 const svc={id:'s',name:'s',state:'moving',position:p(48,2),currentStopIndex:1,routes:[route,future],_state:{cachedRoute:route},_getRemainingDistance:()=>1,train:{speed:60,delay:0},rame:{id:'r',elementDetails:[],totalCapacity:0},getCurrentStops:()=>stops,serviceType:'fret'};
 const ui=Object.create(UI.prototype);ui.game={world:{getStationById:id=>({id,name:id,lat:48,lon:id==='B'?2.0005:2})},rameManager:{getById:()=>svc.rame}};
 return{ui,svc,stops,future};
}
test('RC3-LM15-01: next-stop distance includes all intervening passage/technical legs',()=>{
 const {ui,svc,future}=fixture();const futureKm=future.slice(1).reduce((n,b,i)=>n+haversineDistance(future[i].lat,future[i].lon,b.lat,b.lon),0);
 assert.ok(futureKm>6);assert.equal(ui._livemapDistanceToStopKm(svc,2),1+futureKm);
});
test('RC3-LM15-02: a detoured current route is used instead of the original timetable geometry',()=>{
 const {ui,svc}=fixture();svc._state.cachedRoute=[p(47,1),p(47,2)];svc._getRemainingDistance=r=>r===svc._state.cachedRoute?12:0;
 assert.equal(ui._livemapDistanceToStopKm(svc,1),12);
});
test('RC3-LM15-03: explicit return routes are used, not outbound leg order',()=>{
 const {ui,svc}=fixture();svc.isReturnLeg=true;svc._returnRoutes=[svc.routes[0],[p(48,2),p(48.02,2)]];
 assert.equal(ui._livemapDistanceToStopKm(svc,2),1+haversineDistance(48,2,48.02,2));
});
test('RC3-LM15-04: unknown geometry does not invent a zero-distance approach',()=>{
 const {ui,svc}=fixture();svc.routes[1]=null;assert.equal(ui._livemapDistanceToStopKm(svc,2),null);
 svc._state.cachedRoute=null;assert.equal(ui._livemapDistanceToStopKm(svc,1),null);
});
function renderCard(ui,svc){
 const old=globalThis.document;const box={innerHTML:'',querySelectorAll:()=>[]};globalThis.document={getElementById:id=>id==='trains-list'?box:null,querySelectorAll:()=>[]};
 ui._displayRameForService=s=>s.rame;ui._syncVisibleTrainImageStrips=()=>{};ui._ensureTrainImagesScroll=()=>{};
 try{ui.updateTrainsList([svc]);return box.innerHTML;}finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}
test('RC3-LM15-05: a train 40 metres from the station across a loop is not labelled approaching',()=>{
 const {ui,svc}=fixture();const html=renderCard(ui,svc);assert.ok(html.includes('Prochain arrêt'));assert.doesNotMatch(html,/À l'approche/);assert.match(html,/— [7-9] km/);
});
test('RC3-LM10-01: sidebar adds contractual cargo to generic cargo, without fictional occupancy',()=>{
 const {ui,svc}=fixture();svc.rame.totalFreightCapacity=100;svc._onboardFreight=10;svc._contractFreight=45;
 assert.match(renderCard(ui,svc),/55 tonnes de fret/);
 const x=fixture();x.svc.rame.totalFreightCapacity=100;assert.match(renderCard(x.ui,x.svc),/Charge fret non renseignée/);
});
test('RC3-LM10-02: unknown passenger count is not invented, zero remains zero',()=>{
 const {ui,svc}=fixture();svc.serviceType='passager';svc.rame.totalCapacity=100;
 assert.match(renderCard(ui,svc),/Charge voyageurs non renseignée/);
 const x=fixture();x.svc.serviceType='passager';x.svc.rame.totalCapacity=100;x.svc._onboardPax=0;
 assert.match(renderCard(x.ui,x.svc),/0 passagers à bord/);
});
