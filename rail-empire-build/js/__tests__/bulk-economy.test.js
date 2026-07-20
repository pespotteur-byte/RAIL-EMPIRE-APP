import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Economy } from '../economy.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('addRevenue / addExpense / addPenalty bookkeeping', (() => {
  const cases = [];
  const amounts = [1, 50, 100, 500, 1000, 5000, 10000];
  const categories = ['voyageurs', 'fret', 'amendes', 'subventions', 'exploitation', 'maintenance', 'penalty'];
  for (let i = 0; i < 2000; i++) {
    const amount = amounts[i % amounts.length];
    const cat = categories[i % categories.length];
    cases.push({
      name: `tx-${i}`,
      fn: () => {
        const eco = new Economy();
        const before = eco.balance;
        if (cat === 'penalty') {
          eco.addPenalty(amount, 'retard');
          assert.equal(eco.penalties, amount);
        } else if (['exploitation', 'maintenance'].includes(cat)) {
          eco.addExpense(amount, cat, 'dépense');
          assert.equal(eco.expenses, amount);
        } else {
          eco.addRevenue(amount, cat, 'recette');
          assert.equal(eco.revenue, amount);
        }
        assert.equal(eco.balance, before + (cat === 'penalty' || ['exploitation', 'maintenance'].includes(cat) ? -amount : amount));
      },
    });
  }
  return cases;
})());

itCases('getRevenueBreakdown and getExpenseBreakdown', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const revCats = ['voyageurs', 'fret', 'amendes'];
    const expCats = ['exploitation', 'maintenance', 'personnel'];
    cases.push({
      name: `breakdown-${i}`,
      fn: () => {
        const eco = new Economy();
        for (let r = 0; r < revCats.length; r++) eco.addRevenue((r + 1) * 100, revCats[r], 'r');
        for (let e = 0; e < expCats.length; e++) eco.addExpense((e + 1) * 50, expCats[e], 'e');
        const rb = eco.getRevenueBreakdown();
        const eb = eco.getExpenseBreakdown();
        assert.equal(rb.voyageurs, 100);
        assert.equal(rb.fret, 200);
        assert.equal(rb.amendes, 300);
        assert.equal(eb.exploitation, 50);
        assert.equal(eb.maintenance, 100);
        assert.equal(eb.personnel, 150);
      },
    });
  }
  return cases;
})());

itCases('per-line profitability', (() => {
  const cases = [];
  for (let i = 0; i < 1500; i++) {
    cases.push({
      name: `line-${i}`,
      fn: () => {
        const eco = new Economy();
        const lineId = `line-${i}`;
        eco.addLineRevenue(lineId, 1000 + i);
        eco.addLineExpense(lineId, 200 + i);
        const p = eco.getLineProfitability(lineId);
        assert.equal(p.revenue, 1000 + i);
        assert.equal(p.expense, 200 + i);
        assert.equal(p.profit, 800);
      },
    });
  }
  return cases;
})());

itCases('formatAmount', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    const n = (i + 1) * 1234;
    cases.push({
      name: `fmt-${i}`,
      fn: () => {
        const eco = new Economy();
        const s = eco.formatAmount(n);
        assert.ok(s.includes('€'));
        assert.ok(s.includes(n.toLocaleString('fr-FR')));
      },
    });
  }
  return cases;
})());

itCases('infrastructure toll formula', (() => {
  const cases = [];
  const countries = ['FR', 'DE', 'IT', 'ES', 'BE', 'NL', 'CH', 'AT', 'GB', 'PL', 'CZ', 'HU', 'XX'];
  const rames = [
    { totalTonnage: 100, maxSpeed: 160 },
    { totalTonnage: 400, maxSpeed: 320 },
    { totalTonnage: 1200, maxSpeed: 80 },
    { totalTonnage: 800, maxSpeed: 200 },
  ];
  const routes = [
    [{ maxSpeed: 160, tracks: 2, electrified: true, usage: 'main' }, { maxSpeed: 160, tracks: 2, electrified: true, usage: 'main' }],
    [{ maxSpeed: 320, tracks: 2, electrified: true, usage: 'main' }, { maxSpeed: 320, tracks: 2, electrified: true, usage: 'main' }],
    [{ maxSpeed: 80, tracks: 1, electrified: false, usage: 'branch' }],
    [{ maxSpeed: 250, tracks: 1, electrified: true, usage: 'main' }],
  ];
  const distances = [10, 50, 100, 250, 500];
  for (let i = 0; i < 5000; i++) {
    const country = countries[i % countries.length];
    const rame = rames[i % rames.length];
    const route = routes[i % routes.length];
    const dist = distances[i % distances.length];
    cases.push({
      name: `toll-${i}`,
      fn: () => {
        const eco = new Economy();
        const toll = eco._calcInfrastructureToll(dist, route, rame, country);
        assert.ok(Number.isFinite(toll));
        assert.ok(toll >= 0);
        if (dist > 0) assert.ok(toll > 0);
      },
    });
  }
  return cases;
})());

itCases('save/load roundtrip', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `roundtrip-${i}`,
      fn: () => {
        const eco = new Economy();
        eco.addRevenue(1000 + i, 'voyageurs', 'tickets');
        eco.addExpense(500 + i, 'exploitation', 'energy');
        eco.addLineRevenue(`line-${i}`, 2000);
        eco.addLineExpense(`line-${i}`, 800);
        const save = eco.toSave();
        const restored = new Economy();
        restored.loadFromSave(save);
        assert.equal(restored.balance, eco.balance);
        assert.equal(restored.revenue, eco.revenue);
        assert.equal(restored.expenses, eco.expenses);
        assert.equal(restored.lineRevenue[`line-${i}`], 2000);
        assert.equal(restored.lineExpense[`line-${i}`], 800);
      },
    });
  }
  return cases;
})());

itCases('effective fraud rate', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `fraud-${i}`,
      fn: () => {
        const eco = new Economy();
        const withCtrl = eco.getEffectiveFraudRate(true);
        const without = eco.getEffectiveFraudRate(false);
        assert.ok(withCtrl < without);
        assert.equal(withCtrl, eco.fraudRate * 0.3);
      },
    });
  }
  return cases;
})());

describe('bulk-economy meta', () => {
  it('loaded', () => assert.ok(true));
});
