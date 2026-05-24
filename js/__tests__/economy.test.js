import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Economy } from '../economy.js';

describe('Economy', () => {
  let eco;

  beforeEach(() => {
    eco = new Economy();
  });

  describe('constructor defaults', () => {
    it('starts with 500000 balance', () => {
      assert.equal(eco.balance, 500000);
    });

    it('starts with zero revenue, expenses, penalties', () => {
      assert.equal(eco.revenue, 0);
      assert.equal(eco.expenses, 0);
      assert.equal(eco.penalties, 0);
    });

    it('has default ticket and freight prices', () => {
      assert.equal(eco.ticketPricePerKm, 0.12);
      assert.equal(eco.freightPricePerTKm, 0.08);
    });

    it('starts with zero passenger and freight totals', () => {
      assert.equal(eco.totalPassengers, 0);
      assert.equal(eco.totalFreightTonnes, 0);
    });
  });

  describe('addRevenue', () => {
    it('increases balance and revenue', () => {
      eco.addRevenue(1000, 'voyageurs', 'Test revenue');
      assert.equal(eco.balance, 501000);
      assert.equal(eco.revenue, 1000);
    });

    it('adds entry to history', () => {
      eco.addRevenue(500, 'fret', 'Freight income');
      assert.equal(eco.history.length, 1);
      assert.equal(eco.history[0].type, 'revenue');
      assert.equal(eco.history[0].amount, 500);
      assert.equal(eco.history[0].category, 'fret');
    });

    it('ignores zero or negative amounts', () => {
      eco.addRevenue(0, 'test', 'Zero');
      eco.addRevenue(-100, 'test', 'Negative');
      assert.equal(eco.balance, 500000);
      assert.equal(eco.history.length, 0);
    });

    it('trims history to 200 entries', () => {
      for (let i = 0; i < 210; i++) {
        eco.addRevenue(1, 'test', `Entry ${i}`);
      }
      assert.ok(eco.history.length <= 200);
    });
  });

  describe('addExpense', () => {
    it('decreases balance and increases expenses', () => {
      eco.addExpense(2000, 'exploitation', 'Test expense');
      assert.equal(eco.balance, 498000);
      assert.equal(eco.expenses, 2000);
    });

    it('adds entry to history', () => {
      eco.addExpense(1500, 'maintenance', 'Track repair');
      assert.equal(eco.history.length, 1);
      assert.equal(eco.history[0].type, 'expense');
      assert.equal(eco.history[0].amount, 1500);
    });

    it('ignores zero or negative amounts', () => {
      eco.addExpense(0, 'test', 'Zero');
      eco.addExpense(-50, 'test', 'Negative');
      assert.equal(eco.balance, 500000);
    });

    it('allows balance to go negative', () => {
      eco.addExpense(600000, 'test', 'Big expense');
      assert.equal(eco.balance, -100000);
    });
  });

  describe('addPenalty', () => {
    it('decreases balance and increases both penalties and expenses', () => {
      eco.addPenalty(500, 'Late train');
      assert.equal(eco.balance, 499500);
      assert.equal(eco.penalties, 500);
      assert.equal(eco.expenses, 500);
    });

    it('records penalty in history as expense type', () => {
      eco.addPenalty(300, 'Delay penalty');
      assert.equal(eco.history[0].type, 'expense');
      assert.equal(eco.history[0].category, 'penalty');
    });

    it('ignores zero or negative amounts', () => {
      eco.addPenalty(0, 'Zero');
      eco.addPenalty(-100, 'Negative');
      assert.equal(eco.penalties, 0);
    });
  });

  describe('processStopRevenue', () => {
    it('does nothing for null service', () => {
      eco.processStopRevenue(null, 'Gare A', 10, false, false);
      assert.equal(eco.revenue, 0);
    });

    it('does nothing for service without rame', () => {
      eco.processStopRevenue({ rame: null }, 'Gare A', 10, false, false);
      assert.equal(eco.revenue, 0);
    });

    it('initializes onboard counts at first stop', () => {
      const svc = {
        rame: { totalCapacity: 200, totalFreightCapacity: 50 },
        _onboardPax: null,
        _onboardFreight: null,
        stops: [],
        currentStopIndex: 0,
        train: { delay: 0 },
        name: 'TGV01',
      };
      eco.processStopRevenue(svc, 'Paris', 0, true, false);
      assert.equal(typeof svc._onboardPax, 'number');
      assert.equal(typeof svc._onboardFreight, 'number');
    });

    it('boards passengers at non-terminus stops', () => {
      const svc = {
        rame: { totalCapacity: 200, totalFreightCapacity: 0 },
        _onboardPax: 0,
        _onboardFreight: 0,
        stops: [],
        currentStopIndex: 0,
        train: { delay: 0 },
        name: 'TER',
      };
      eco.processStopRevenue(svc, 'Gare A', 0, true, false);
      assert.ok(svc._onboardPax > 0, 'Should have boarded some passengers');
    });

    it('does not board at terminus', () => {
      const svc = {
        rame: { totalCapacity: 200, totalFreightCapacity: 0 },
        _onboardPax: 100,
        _onboardFreight: 0,
        stops: [{}, {}],
        currentStopIndex: 1,
        train: { delay: 0 },
        name: 'TER',
      };
      const paxBefore = svc._onboardPax;
      eco.processStopRevenue(svc, 'Gare B', 50, false, true);
      // All passengers descend at terminus
      assert.equal(svc._onboardPax, 0);
    });

    it('generates revenue at intermediate stops', () => {
      const svc = {
        rame: { totalCapacity: 300, totalFreightCapacity: 0 },
        _onboardPax: 150,
        _onboardFreight: 0,
        stops: [{}, {}, {}],
        currentStopIndex: 1,
        train: { delay: 0 },
        name: 'IC',
      };
      eco.processStopRevenue(svc, 'Gare B', 100, false, false);
      assert.ok(eco.revenue > 0, 'Should generate some revenue');
      assert.ok(eco.totalPassengers > 0, 'Should count descended passengers');
    });

    it('applies 25% penalty when delay >= 30 minutes', () => {
      const svc = {
        rame: { totalCapacity: 300, totalFreightCapacity: 0 },
        _onboardPax: 200,
        _onboardFreight: 0,
        stops: [{}, {}],
        currentStopIndex: 1,
        train: { delay: 35 },
        name: 'TGV',
      };
      eco.processStopRevenue(svc, 'Gare B', 200, false, true);
      assert.ok(eco.penalties > 0, 'Should apply delay penalty');
    });
  });

  describe('processDailyCharges', () => {
    it('processes charges once per date', () => {
      const services = [{ name: 'TER1', rame: { totalTonnage: 200 } }];
      eco.processDailyCharges(services, [], '2026-05-24');
      const balanceAfterFirst = eco.balance;
      eco.processDailyCharges(services, [], '2026-05-24');
      assert.equal(eco.balance, balanceAfterFirst, 'Should not double-charge same date');
    });

    it('charges base cost + tonnage-based cost per service', () => {
      const services = [{ name: 'TER1', rame: { totalTonnage: 200 } }];
      eco.processDailyCharges(services, [], '2026-05-24');
      // Cost = 500 + 200 * 0.5 = 600
      assert.equal(eco.expenses, 600);
    });

    it('charges depot maintenance', () => {
      const depots = [{ tracks: 3, name: 'Depot A' }];
      eco.processDailyCharges([], depots, '2026-05-24');
      // Cost = 3 * 200 = 600
      assert.equal(eco.expenses, 600);
    });

    it('keeps only 7 days of processed dates', () => {
      for (let i = 0; i < 10; i++) {
        eco.processDailyCharges([], [], `2026-05-${String(i + 10).padStart(2, '0')}`);
      }
      assert.ok(Object.keys(eco.dailyProcessed).length <= 7);
    });
  });

  describe('formatAmount', () => {
    it('formats number with French locale and euro sign', () => {
      const formatted = eco.formatAmount(12345.6);
      assert.ok(formatted.includes('12'), 'Should contain thousands');
      assert.ok(formatted.includes('346'), 'Should round to nearest integer');
      assert.ok(formatted.endsWith('€'), 'Should end with euro sign');
    });
  });

  describe('toSave / loadFromSave', () => {
    it('round-trips all fields', () => {
      eco.balance = 123456;
      eco.revenue = 50000;
      eco.expenses = 20000;
      eco.penalties = 5000;
      eco.ticketPricePerKm = 0.15;
      eco.freightPricePerTKm = 0.10;
      eco.totalPassengers = 999;
      eco.totalFreightTonnes = 42;
      eco.addRevenue(100, 'test', 'Test entry');

      const saved = eco.toSave();

      const eco2 = new Economy();
      eco2.loadFromSave(saved);

      assert.equal(eco2.balance, eco.balance);
      assert.equal(eco2.revenue, eco.revenue);
      assert.equal(eco2.expenses, eco.expenses);
      assert.equal(eco2.penalties, eco.penalties);
      assert.equal(eco2.ticketPricePerKm, eco.ticketPricePerKm);
      assert.equal(eco2.freightPricePerTKm, eco.freightPricePerTKm);
      assert.equal(eco2.totalPassengers, eco.totalPassengers);
      assert.equal(eco2.totalFreightTonnes, eco.totalFreightTonnes);
      assert.equal(eco2.history.length, eco.history.length);
    });

    it('loadFromSave handles null gracefully', () => {
      const eco2 = new Economy();
      eco2.loadFromSave(null);
      assert.equal(eco2.balance, 500000);
    });

    it('loadFromSave applies defaults for missing fields', () => {
      const eco2 = new Economy();
      eco2.loadFromSave({});
      assert.equal(eco2.balance, 500000);
      assert.equal(eco2.ticketPricePerKm, 0.12);
      assert.equal(eco2.totalPassengers, 0);
    });
  });
});
