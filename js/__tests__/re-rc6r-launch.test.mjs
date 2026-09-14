import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bindLaunchActions} from '../launch-actions.js';
function fixture(){const buttons=new Map(['btn-admin','btn-close-fiche-horaire','modal-fiche-horaire'].map(id=>[id,{handlers:[],hidden:false,addEventListener(event,fn){this.handlers.push(fn);},classList:{add(name){buttons.get(id).hidden=name==='hidden';}}}]));return{buttons,doc:{getElementById:id=>buttons.get(id)}};}
test('RC6R-TS-01: no executable inline handlers remain in either HTML entry',()=>{for(const f of ['index.html','admin.html']){const s=fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8');assert.ok(!/<[^>]+\son[a-z]+\s*=/i.test(s),f);}});
test('RC6R-TS-02: admin confirmation refusal does not navigate',()=>{const{doc,buttons}=fixture();let calls=0;bindLaunchActions(doc,{confirm:()=>false,navigate:()=>calls++});buttons.get('btn-admin').handlers[0]();assert.equal(calls,0);});
test('RC6R-TS-03: admin confirmation retains warning and destination',()=>{const{doc,buttons}=fixture();let warning='',url='';bindLaunchActions(doc,{confirm:m=>(warning=m,true),navigate:u=>url=u});buttons.get('btn-admin').handlers[0]();assert.match(warning,/ZONE DANGEREUSE/);assert.equal(url,'admin.html');});
test('RC6R-TS-04: close action hides the actual fiche container',()=>{const{doc,buttons}=fixture();bindLaunchActions(doc,{confirm:()=>false,navigate(){}});buttons.get('btn-close-fiche-horaire').handlers[0]();assert.equal(buttons.get('modal-fiche-horaire').hidden,true);});
test('RC6R-TS-05: repeated binding does not duplicate listeners; absent buttons are allowed',()=>{const{doc,buttons}=fixture();const deps={confirm:()=>false,navigate(){}};bindLaunchActions(doc,deps);bindLaunchActions(doc,deps);assert.equal(buttons.get('btn-admin').handlers.length,1);assert.equal(buttons.get('btn-close-fiche-horaire').handlers.length,1);assert.doesNotThrow(()=>bindLaunchActions({getElementById:()=>null},deps));});
