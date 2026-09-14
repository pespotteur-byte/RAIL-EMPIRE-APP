import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CantonManager} from '../simulation.js';
const svc=(id,extra={})=>({id,active:true,completed:false,cancelled:false,state:'moving',position:{lat:48,lon:2},...extra});
function fixture(run){const previous=globalThis.window;const services=[svc('a'),svc('b'),svc('c')];const manager=new CantonManager();const creator={services};globalThis.window={game:{scheduleCreator:creator}};try{run(manager,services,creator);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}}
test('RC4-PERF02: known occupied cantons use one identity index, not repeated fleet scans',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);let scans=0;const find=s.find;s.find=function(...args){scans++;return find.apply(this,args);};
 try{for(let i=0;i<1000;i++)assert.equal(m._isTrainGone('b'),false);assert.equal(scans,0);}finally{end();}
 m._isTrainGone('b');assert.equal(scans,1);
}));
test('RC4-PERF02: same-tick position and cancellation changes remain immediately visible',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);try{assert.equal(m._isTrainGone('a'),false);s[0].position=null;assert.equal(m._isTrainGone('a'),true);s[0].position={lat:48,lon:2};s[0].state='blocked_route';assert.equal(m._isTrainGone('a'),false);s[0].cancelled=true;assert.equal(m._isTrainGone('a'),true);}finally{end();}
}));
test('RC4-PERF02: direct same-length replacement cannot release a newly occupied track',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);try{s[1]=svc('new');assert.equal(m._isTrainGone('new'),false);assert.equal(m._isTrainGone('b'),true);}finally{end();}
}));
test('RC4-PERF02: direct reordering, addition and deletion are not stale',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);try{s.reverse();assert.equal(m._isTrainGone('a'),false);s.push(svc('d'));assert.equal(m._isTrainGone('d'),false);s.splice(s.findIndex(x=>x.id==='a'),1);assert.equal(m._isTrainGone('a'),true);}finally{end();}
}));
test('RC4-PERF02: changing an ID in-place invalidates its old index entry',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);try{s[0].id='renamed';assert.equal(m._isTrainGone('a'),true);assert.equal(m._isTrainGone('renamed'),false);}finally{end();}
}));
test('RC4-PERF02: replacing the authoritative services array is respected',()=>fixture((m,s,creator)=>{
 const end=m.beginServiceLookupFrame(s);try{creator.services=[svc('x')];assert.equal(m._isTrainGone('x'),false);assert.equal(m._isTrainGone('a'),true);}finally{end();}
}));
test('RC4-PERF02: nested lookup scopes release all retained references',()=>fixture((m,s)=>{
 const a=m.beginServiceLookupFrame(s);const b=m.beginServiceLookupFrame(s);assert.ok(m._serviceLookupFrame);b();assert.ok(m._serviceLookupFrame);a();assert.equal(m._serviceLookupFrame,null);
}));
test('RC4-PERF02: duplicate IDs initially preserve first-match legacy semantics',()=>fixture((m,s)=>{
 s.push(svc('a',{position:null}));const end=m.beginServiceLookupFrame(s);try{assert.equal(m._isTrainGone('a'),false);}finally{end();}
}));
test('RC4-PERF02: occupied canton never becomes available to another train',()=>fixture((m,s)=>{
 m.cantons.set('C',{occupiedBy:'b',reservedBy:null,resourceIds:[]});const end=m.beginServiceLookupFrame(s);try{assert.equal(m.isAvailable('C','a'),false);s[1].state='blocked_route';assert.equal(m.isAvailable('C','a'),false);}finally{end();}
}));
function movementHarness(){const code=readFileSync(new URL('../main.js',import.meta.url),'utf8');const a=code.indexOf('    moveTick(dt, timeOfDay) {');const b=code.indexOf('    _forceV2RuntimeSyncNow()',a);assert.ok(a>=0&&b>a);const H=new Function(`return class {${code.slice(a,b)}}`)();return new H();}
test('RC4-PERF02: real movement idle fast-path releases the lookup scope',()=>{
 const g=movementHarness();let ended=0;Object.assign(g,{scheduleCreator:{services:[],getActiveServices:()=>[],getMovingServices:()=>[]},cantonManager:{beginServiceLookupFrame:()=>()=>ended++,cleanup(){}},depotManager:{updateRescues(){}},_lastCantonCleanup:performance.now()});g.moveTick(.1,600);assert.equal(ended,1);
});
test('RC4-PERF02: real movement exceptions release the lookup scope',()=>{
 const g=movementHarness();let ended=0;Object.assign(g,{scheduleCreator:{services:[],getActiveServices(){throw Error('injected');}},cantonManager:{beginServiceLookupFrame:()=>()=>ended++}});assert.throws(()=>g.moveTick(.1,600),/injected/);assert.equal(ended,1);
});

test('RC4-PERF02: idle scope performs no eager scan of a large inactive timetable',()=>fixture((m,s)=>{
 const end=m.beginServiceLookupFrame(s);try{assert.equal(m._serviceLookupFrame.indexed,false);assert.equal(m._serviceLookupFrame.byId.size,0);assert.equal(m._isTrainGone('b'),false);assert.equal(m._serviceLookupFrame.indexed,true);assert.equal(m._serviceLookupFrame.byId.size,s.length);}finally{end();}
}));
