import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function fixture({page='map',rescues=[],active=[],moving=[],dirty=false,heartbeat=false}={}){
 const code=readFileSync(new URL('../main.js',import.meta.url),'utf8');const a=code.indexOf('    gameLoop() {');const end=code.indexOf('// Global error handler',a);const b=code.lastIndexOf('\n}',end);assert.ok(a>=0&&b>a);
 let rendered=[],updates=0,next=0;const H=new Function('performance','requestAnimationFrame','document',`return class {${code.slice(a,b)}}`)({now:()=>500},()=>next++,{getElementById:()=>null});const g=new H();
 Object.assign(g,{running:true,_lastFrameTime:100,_lastIdleMapRender:heartbeat?undefined:400,_lastUIUpdate:450,_lastRadarSync:450,engine:{update:()=>updates++},scheduleCreator:{getActiveServices:()=>active,getMovingServices:()=>moving},ui:{activePage:page,applyCameraFollow(){},update(){}},depotManager:{getRescueServices:()=>rescues},renderer:{needsRender:dirty,_visibleGeoBounds:()=>({minLat:48,maxLat:49,minLon:2,maxLon:3}),render:(_world,services)=>rendered.push([...services])},diagnostics:{record:(code,e)=>{throw Error(code+': '+e.message);}}});
 return {g,run(){g.gameLoop();return{rendered,updates,next}}};
}
const inside={id:'i',position:{lat:48.5,lon:2.5}},outside={id:'o',position:{lat:52,lon:13}};
test('RC4-LM17: off-screen rescue alone no longer forces every map repaint',()=>{const r=fixture({rescues:[outside]}).run();assert.equal(r.rendered.length,0);assert.equal(r.updates,1);assert.equal(r.next,1);});
test('RC4-LM17: on-screen rescue remains animated',()=>{const r=fixture({rescues:[inside]}).run();assert.equal(r.rendered.length,1);assert.deepEqual(r.rendered[0],[inside]);});
test('RC4-LM17: hidden map skips all rendering without stopping simulation',()=>{const r=fixture({page:'schedules',rescues:[inside],moving:[inside],dirty:true}).run();assert.equal(r.rendered.length,0);assert.equal(r.updates,1);assert.equal(r.next,1);});
test('RC4-LM17: a bounded idle heartbeat still refreshes static infrastructure',()=>{const r=fixture({rescues:[outside],heartbeat:true}).run();assert.equal(r.rendered.length,1);assert.deepEqual(r.rendered[0],[]);});
test('RC4-LM17: off-screen stopped and rescue objects are excluded from raster input',()=>{const r=fixture({active:[{...outside,state:'blocked_route'},{...inside,state:'stopped_at_station'}],rescues:[outside],dirty:true}).run();assert.equal(r.rendered.length,1);assert.equal(r.rendered[0].length,1);assert.equal(r.rendered[0][0].id,'i');});
test('RC4-LM17: visible normal motion continues repainting with the same cadence',()=>{const r=fixture({moving:[inside,outside]}).run();assert.equal(r.rendered.length,1);assert.deepEqual(r.rendered[0],[inside]);});
