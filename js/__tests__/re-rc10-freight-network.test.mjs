import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers/rc10-fixtures.mjs';
const {FreightNetwork,collectFreightRailLegs}=await mod('freight-network');
const {IndustrialClients}=await mod('industrial-clients');
const point=(lat,extra={})=>({lat,lon:2,maxSpeed:100,...extra});
const stations=[{id:'A',...point(48)},{id:'B',...point(48.1)},{id:'C',...point(48.2)},{id:'D',...point(48.00001)}];
const track=(a,b,extra={})=>({stationA:a,stationB:b,route:[point(48),point(48.1)],...extra});
const world=tracks=>({stations:structuredClone(stations),tracks});
const reachable=(w,origin='A',legs=[])=>[...new FreightNetwork(w,legs).reachableStations(origin)].sort();
test('RC10-NETWORK reachable component, not geographically nearest isolated station',()=>{
 assert.deepEqual(reachable(world([track('A','B'),track('B','C')])),['B','C']);
});
test('RC10-NETWORK unknown routes and straight empty placeholders create no offers',()=>{
 assert.deepEqual(reachable(world([track('A','B',{route:[]}),track('A','D',{route:undefined})])),[]);
});
for(const flag of [{fallback:true},{synthetic:true},{closed:true},{railway:'tram'},{railway:'subway'},{railwayLifecycle:'abandoned'},{railway:'construction'},{lat:NaN},{lat:null}])test(`RC10-NETWORK rejects unusable geometry ${JSON.stringify(flag)}`,()=>{
 assert.deepEqual(reachable(world([track('A','B',{route:[point(48,flag),point(48.1)]})])),[]);
});
test('RC10-NETWORK orientation: reverse geometry needs positive permission, not absent tags',()=>{
 assert.deepEqual(reachable(world([track('A','B')]),'B'),[]);
 assert.deepEqual(reachable(world([track('A','B',{route:[point(48,{bidirectional:'regular'}),point(48.1,{bidirectional:'regular'})]})]),'B'),['A']);
 assert.deepEqual(reachable(world([track('A','B',{route:[point(48,{oneway:'yes',bidirectional:'regular'}),point(48.1,{bidirectional:'regular'})]})]),'B'),[]);
});
test('RC10-NETWORK current closure/removal invalidates a former component without stale cache',()=>{
 const w=world([track('A','B'),track('B','C')]);assert.deepEqual(reachable(w),['B','C']);
 w.tracks[0].worksActive=true;w.tracks[0].worksImpact='closed';assert.deepEqual(reachable(w),[]);
 w.tracks[0].worksActive=false;w.stations[1].closed=true;assert.deepEqual(reachable(w),[]);
 w.stations[1].closed=false;w.tracks.splice(0);assert.deepEqual(reachable(w),[]);
});
test('RC10-NETWORK cycles and duplicate edges are bounded and do not offer the origin',()=>{
 const w=world([track('A','B'),track('A','B'),track('B','A'),track('B','C'),track('C','A')]);const n=new FreightNetwork(w);
 assert.equal(n.edgeCount,4);assert.deepEqual([...n.reachableStations('A')].sort(),['B','C']);assert.equal(n.reachableStations('missing').size,0);
});
test('RC10-NETWORK deep graph traverses iteratively with no recursion overflow',()=>{
 const count=15000,st=Array.from({length:count},(_,i)=>({id:String(i),...point(48+i/100000)}));
 const tracks=st.slice(1).map((_,i)=>track(String(i),String(i+1)));const n=new FreightNetwork({stations:st,tracks});assert.equal(n.reachableStations('0').size,count-1);
});
const version=()=>({state:'VALID',locations:[{id:'a',stationId:'A'},{id:'t',technicalLocationId:'technical-yard'},{id:'b',stationId:'B'}],outboundPath:{topologyRevision:4,resolvedRevision:4,legs:[{fromLocationId:'a',toLocationId:'t',routePoints:[point(48),point(48.05)]},{fromLocationId:'t',toLocationId:'b',routePoints:[point(48.05),point(48.1)]}]}});
test('RC10-NETWORK current validated V2 legs connect through explicit technical location identities',()=>{
 const v=version(),legs=collectFreightRailLegs({schedules:[{currentVersion:v}]});assert.equal(legs.length,2);assert.deepEqual(reachable(world([]),'A',legs),['B']);assert.deepEqual(reachable(world([]),'B',legs),[]);
});
for(const mutate of [v=>v.state='DRAFT',v=>v.outboundPath.resolvedRevision=3,v=>v.outboundPath.error='no path',v=>v.validationReport={issues:[{level:'ERROR'}]}])test('RC10-NETWORK invalidated V2 cannot be resurrected by its old compiled service',()=>{
 const v=version();mutate(v);const legs=collectFreightRailLegs({schedules:[{currentVersion:v}]},[{_v2OccurrenceId:'OLD',stops:[{stationId:'A'},{stationId:'B'}],routes:[[point(48),point(48.1)]]}]);assert.equal(legs.length,0);
});
test('RC10-NETWORK legacy authored outbound and explicit return legs remain usable',()=>{
 const legs=collectFreightRailLegs(null,[{stops:[{stationId:'A'},{stationId:'B'}],routes:[[point(48),point(48.1)]],_returnStopsData:[{stationId:'B'},{stationId:'A'}],_returnRoutes:[[point(48.1),point(48)]]}]);
 assert.deepEqual(reachable(world([]),'B',legs),['A']);
});
function clients(){const i=new IndustrialClients();i.clients=[{id:'I',active:true,type:'cement',stationId:'A',name:'Ciment',satisfaction:80,marketShare:5,dailyTonnage:500}];return i;}
test('RC10-NETWORK generation never touches external network or chooses a disconnected destination',()=>{
 const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw new Error('Forbidden external request');};
 try{const i=clients(),contracts=[],f={contracts,addContract:c=>contracts.push(c)},w=world([track('A','B')]);i.generateDailyContracts(f,w);assert.ok(contracts.length>0);assert.ok(contracts.every(c=>c.toId==='B'));assert.equal(calls,0);assert.equal(i.stats.totalRevenue,0);assert.equal(i.stats.totalTonnage,0);}
 finally{globalThis.fetch=oldFetch;}
});
test('RC10-NETWORK no known route: clear counter, no fabricated offer; editing locally enables next generation',()=>{
 const i=clients(),contracts=[],f={contracts,addContract:c=>contracts.push(c)},w=world([]);i.generateDailyContracts(f,w);assert.equal(contracts.length,0);assert.equal(i.lastGenerationReport.clientsWithoutKnownRoute,1);
 w.tracks.push(track('A','B'));i.generateDailyContracts(f,w);assert.ok(contracts.length>0);assert.equal(i.lastGenerationReport.generated,contracts.length);
});
test('RC10-NETWORK physical connectivity alone does not bypass a known missing freight terminal',()=>{
 const i=clients(),contracts=[],f={contracts,addContract:c=>contracts.push(c)},w=world([track('A','B')]);i.freightAccessProvider=id=>id!=='B';i.generateDailyContracts(f,w);assert.equal(contracts.length,0);
 i.freightAccessProvider=()=>true;i.generateDailyContracts(f,w);assert.ok(contracts.length>0);
});
test('RC10-NETWORK explicit saved rail paths are an input provider, not a retained full-network copy',()=>{
 const i=clients(),contracts=[],f={contracts,addContract:c=>contracts.push(c)};let legs=[{fromId:'A',toId:'B',route:[point(48),point(48.1)]}];i.railLegProvider=()=>legs;i.generateDailyContracts(f,world([]));assert.ok(contracts.length>0);
 contracts.length=0;legs=[];i.generateDailyContracts(f,world([]));assert.equal(contracts.length,0);
});
