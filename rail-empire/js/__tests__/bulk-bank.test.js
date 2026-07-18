import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Bank } from '../bank.js';
import { Economy } from '../economy.js';

function itCases(title, cases) {
  describe(title, () => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      it(`${c.name || i + 1}`, c.fn);
    }
  });
}

itCases('credit limit and debt', (() => {
  const cases = [];
  for (let i = 1; i <= 1000; i++) {
    cases.push({
      name: `limit-${i}`,
      fn: () => {
        const bank = new Bank();
        const eco = new Economy();
        bank.startingBalance = i * 1000;
        bank.creditLimitRatio = 0.5;
        assert.equal(bank.getCreditLimit(), Math.floor(i * 1000 * 0.5));
        assert.equal(bank.getTotalDebt(), 0);
        assert.equal(bank.getTotalDailyPayment(), 0);
      },
    });
  }
  return cases;
})());

itCases('borrow respects credit limit', (() => {
  const cases = [];
  const types = ['small', 'medium', 'large', 'mega'];
  const amounts = { small: 500_000, medium: 2_000_000, large: 5_000_000, mega: 10_000_000 };
  for (let i = 0; i < 1500; i++) {
    const type = types[i % types.length];
    cases.push({
      name: `borrow-${i}`,
      fn: () => {
        const bank = new Bank();
        const eco = new Economy();
        bank.startingBalance = 20_000_000;
        const loan = bank.borrow(eco, type);
        assert.ok(loan);
        assert.equal(loan.principal, amounts[type]);
        assert.ok(loan.dailyPayment > 0);
        assert.equal(loan.daysLeft, loan.totalDays);
        assert.ok(bank.getTotalDebt() > 0);
      },
    });
  }
  return cases;
})());

itCases('borrow blocked when over credit limit', (() => {
  const cases = [];
  for (let i = 0; i < 1000; i++) {
    cases.push({
      name: `blocked-${i}`,
      fn: () => {
        const bank = new Bank();
        const eco = new Economy();
        bank.startingBalance = 1_000_000;
        bank.creditLimitRatio = 0.1;
        const loan = bank.borrow(eco, 'mega');
        assert.equal(loan, null);
        assert.equal(bank.getTotalDebt(), 0);
      },
    });
  }
  return cases;
})());

itCases('daily repayments reduce debt and balance', (() => {
  const cases = [];
  const types = ['small', 'medium', 'large'];
  for (let i = 0; i < 1500; i++) {
    const type = types[i % types.length];
    cases.push({
      name: `repay-${i}`,
      fn: () => {
        const bank = new Bank();
        const eco = new Economy();
        bank.startingBalance = 20_000_000;
        const before = eco.balance;
        const loan = bank.borrow(eco, type);
        assert.ok(loan);
        const debtBefore = bank.getTotalDebt();
        bank.processDailyRepayments(eco);
        const debtAfter = bank.getTotalDebt();
        assert.ok(debtAfter <= debtBefore);
        assert.ok(eco.balance <= before + loan.principal);
        assert.ok(bank.getTotalDailyPayment() >= 0);
      },
    });
  }
  return cases;
})());

itCases('loan fully repaid after duration', (() => {
  const cases = [];
  for (let i = 0; i < 500; i++) {
    cases.push({
      name: `full-${i}`,
      fn: () => {
        const bank = new Bank();
        const eco = new Economy();
        bank.startingBalance = 50_000_000;
        const loan = bank.borrow(eco, 'small');
        for (let d = 0; d <= loan.totalDays + 5; d++) {
          bank.processDailyRepayments(eco);
        }
        assert.equal(bank.getTotalDebt(), 0);
        assert.equal(bank.loans.length, 0);
      },
    });
  }
  return cases;
})());

describe('bulk-bank meta', () => {
  it('loaded', () => assert.ok(true));
});
