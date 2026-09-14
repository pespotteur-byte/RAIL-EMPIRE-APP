import test from 'node:test'; import assert from 'node:assert/strict';
import { DepotManager } from '../depot.js';

test('getITEInfo exposes real ITE/depot id for module lookup',()=>{
 const d=new DepotManager(); d.depots=[{id:'ITE-42',stationId:'ST-A',type:'ite_embranchement',built:true,iteTracks:[{length:300}],iteCargoTypes:[]}];
 const x=d.getITEInfo('ST-A',150,'');
 assert.equal(x.isITE,true); assert.equal(x.depotId,'ITE-42'); assert.equal(x.canFit,true);
});
