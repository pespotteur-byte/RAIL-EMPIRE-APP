import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.RE_COMPARE_ROOT?pathToFileURL(resolve(process.env.RE_COMPARE_ROOT)+'/'):new URL('../../',import.meta.url);
const {Economy}=await import(new URL('js/economy.js',base));
test('RC5-SC30-complement: toll assessment handles 200000 points without argument overflow',()=>{
 const e=new Economy();const point={maxSpeed:160,tracks:2,electrified:true,usage:'main'};const rame={maxSpeed:160,totalTonnage:500};
 const short=e._calcInfrastructureToll(100,[point,point],rame,'FR');
 assert.equal(e._calcInfrastructureToll(100,Array(200000).fill(point),rame,'FR'),short);
});
test('RC5-economy: repeated mixed route metadata preserves exact pre-existing tariff factors',()=>{
 const e=new Economy();const points=[{maxSpeed:80,tracks:1,electrified:false,usage:'branch'},{maxSpeed:160,tracks:2,electrified:true,usage:'main'},{maxSpeed:200,tracks:2,electrified:true,usage:'main'}];
 const n=50000;const route=Array.from({length:n*3},(_,i)=>points[i%3]);
 const expected=Math.round(125*3*1.8*.85*1.15*1*(.9+700/2000));
 assert.equal(e._calcInfrastructureToll(125,route,{maxSpeed:200,totalTonnage:700},'FR'),expected);
});
