import test from 'node:test'; import assert from 'node:assert/strict';
import { DepotManager } from '../depot.js';

test('long train on a usable ITE is split into tranches rather than impossible forever',()=>{
 const d=new DepotManager(); d.depots=[{id:'I',stationId:'S',type:'ite_embranchement',built:true,iteTracks:[{length:100}],iteCargoTypes:[]}];
 const x=d.getITEInfo('S',250,''); assert.equal(x.usable,true); assert.equal(x.canFit,false); assert.equal(x.trancheCount,3);
});
test('zero-length ITE is explicitly unusable',()=>{
 const d=new DepotManager(); d.depots=[{id:'I',stationId:'S',type:'ite_embranchement',built:true,iteTracks:[],iteCargoTypes:[]}];
 const x=d.getITEInfo('S',50,''); assert.equal(x.usable,false); assert.equal(x.canFit,false);
});
