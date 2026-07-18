import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RollingStockManager } from '../rolling-stock.js';

describe('Annexe 8 — numérotation automatique par série', () => {
  it('numérote les BB26000 de BB26001 à BB26002...', () => {
    const mgr = new RollingStockManager();
    assert.strictEqual(mgr.nextSeriesNumber('BB26000'), 'BB26001');
    assert.strictEqual(mgr.nextSeriesNumber('BB26000'), 'BB26002');
    for (let i = 0; i < 227; i++) mgr.nextSeriesNumber('BB26000');
    assert.strictEqual(mgr.nextSeriesNumber('BB26000'), 'BB26230');
  });

  it('gère les séries avec placeholder XXX (BR186-XXX)', () => {
    const mgr = new RollingStockManager();
    assert.strictEqual(mgr.nextSeriesNumber('BR186-XXX'), 'BR186-1');
    assert.strictEqual(mgr.nextSeriesNumber('BR186-XXX'), 'BR186-2');
  });

  it('conserve les compteurs indépendamment entre séries', () => {
    const mgr = new RollingStockManager();
    assert.strictEqual(mgr.nextSeriesNumber('TGV-PSE'), 'TGV-PSE1');
    assert.strictEqual(mgr.nextSeriesNumber('BB26000'), 'BB26001');
    assert.strictEqual(mgr.nextSeriesNumber('TGV-PSE'), 'TGV-PSE2');
  });
});
