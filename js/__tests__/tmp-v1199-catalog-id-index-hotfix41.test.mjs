import test from 'node:test';
import assert from 'node:assert/strict';
import { RollingStockManager } from '../rolling-stock.js';

test('HOTFIX41 rolling-stock id index stays coherent across add/get/update/remove/load',()=>{
  const m=new RollingStockManager();
  const a=m.add({id:'A',name:'A',category:'wagon',mass:20,length:10});
  assert.ok(a);
  assert.equal(m.getById('A'),a);
  assert.equal(m.add({id:'A',name:'duplicate'}),null);
  assert.equal(m.update('A',{name:'A2'}).name,'A2');
  assert.equal(m.getById('A').name,'A2');
  assert.equal(m.remove('A'),true);
  assert.equal(m.getById('A'),undefined);
  assert.equal(m.remove('A'),false);

  m.loadFromSave({items:[{id:'B',name:'B',category:'locomotive',mass:80,length:20,power:1000},{id:'B',name:'dup'}]});
  assert.equal(m.getAll().length,1);
  assert.equal(m.getById('B')?.name,'B');
  assert.equal(m.add({id:'C',name:'C'}).id,'C');
  assert.equal(m.getById('C')?.name,'C');
});

test('HOTFIX41 catalogue-sized insertion avoids quadratic duplicate scans',()=>{
  const m=new RollingStockManager();
  const n=36000;
  const t0=performance.now();
  for(let i=0;i<n;i++) m.add({id:`perf-${i}`,name:`Stock ${i}`,category:'wagon',mass:20,length:20});
  const elapsed=performance.now()-t0;
  assert.equal(m.getAll().length,n);
  assert.equal(m.getById('perf-35999')?.name,'Stock 35999');
  // Generous guardrail: the old O(n²) implementation takes many seconds here.
  assert.ok(elapsed < 2500, `catalogue insertion unexpectedly slow: ${elapsed.toFixed(1)} ms`);
});
