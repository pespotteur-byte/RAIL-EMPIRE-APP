import { alertToast } from './html-utils.js?v=1784931693';
/**
 * Bank — Loan system for Rail Empire.
 * Additive module: adds borrowing/repayment mechanics to economy.
 */
export class Bank {
  constructor() {
    this.loans = [];
    this.maxLoans = Infinity; // XII — emprunts max illimités
    this.startingBalance = null; // ECO-07 : trésorerie de départ → plafond crédit
    this.creditLimitRatio = 0.5; // plafond crédit = 50 % de la trésorerie de départ
    this.interestRates = {
      small:  { amount: 500000,  rate: 0.03, duration: 30, label: '500 000 €' },
      medium: { amount: 2000000, rate: 0.05, duration: 60, label: '2 000 000 €' },
      large:  { amount: 5000000, rate: 0.07, duration: 90, label: '5 000 000 €' },
      mega:   { amount: 10000000, rate: 0.10, duration: 120, label: '10 000 000 €' },
    };
  }

  /**
   * Take out a loan. Returns the loan object or null if at max.
   */
  borrow(economy, type) {
    if (this.loans.length >= this.maxLoans) return null;
    // ECO-07 : initialiser le plafond crédit sur la première trésorerie connue
    if (this.startingBalance == null && economy?.balance != null) {
      this.startingBalance = economy.balance;
    }
    const config = this.interestRates[type];
    if (!config) return null;
    const creditLimit = this.getCreditLimit();
    if (this.getTotalDebt() + config.amount > creditLimit) return null;

    const loan = {
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      principal: config.amount,
      rate: config.rate,
      remaining: config.amount,
      dailyPayment: Math.ceil(config.amount * (1 + config.rate) / config.duration),
      daysLeft: config.duration,
      totalDays: config.duration,
      takenDate: Date.now(),
    };

    economy.balance += config.amount;
    economy.history.push({
      type: 'revenue', amount: config.amount,
      category: 'emprunt', description: `Emprunt bancaire: ${config.label}`,
      time: Date.now(),
    });
    if (economy.history.length > 200) economy.history.shift();

    this.loans.push(loan);
    return loan;
  }

  /**
   * Process daily loan repayments. Called from economy daily hook.
   */
  processDailyRepayments(economy) {
    const completed = [];
    for (const loan of this.loans) {
      if (loan.daysLeft <= 0) { completed.push(loan.id); continue; }

      const payment = Math.min(loan.dailyPayment, loan.remaining);
      if (payment > 0) {
        economy.addExpense(payment, 'remboursement', `Remboursement emprunt (${loan.daysLeft}j restants)`);
        loan.remaining -= payment;
      }
      loan.daysLeft--;
      if (loan.daysLeft <= 0 || loan.remaining <= 0) {
        completed.push(loan.id);
      }
    }
    this.loans = this.loans.filter(l => !completed.includes(l.id));
  }

  getTotalDebt() {
    return this.loans.reduce((sum, l) => sum + l.remaining, 0);
  }

  getCreditLimit() {
    // ECO-07 : plafond crédit proportionnel à la trésorerie de départ
    if (this.startingBalance == null || this.startingBalance <= 0) return Infinity;
    return Math.floor(this.startingBalance * this.creditLimitRatio);
  }

  getTotalDailyPayment() {
    return this.loans.reduce((sum, l) => sum + l.dailyPayment, 0);
  }

  /**
   * Render the bank section (integrated into Finances page or standalone).
   */
  render(container, game) {
    if (!container) return;
    const eco = game.economy;
    const fmt = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    const fmtE = n => fmt(n) + ' €';

    container.innerHTML = `
      <div class="dash-section">
        <h3>Banque — Emprunts</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Dette totale</div>
            <div class="dash-kpi-value" style="color:${this.getTotalDebt() > 0 ? '#ef4444' : 'var(--green)'}">${fmtE(this.getTotalDebt())}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Remboursement / jour</div>
            <div class="dash-kpi-value" style="color:#f97316">${fmtE(this.getTotalDailyPayment())}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Emprunts actifs</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${this.loans.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde actuel</div>
            <div class="dash-kpi-value" style="color:${eco.balance >= 0 ? 'var(--green)' : '#ef4444'}">${fmtE(eco.balance)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Plafond crédit</div>
            <div class="dash-kpi-value" style="color:#94a3b8">${fmtE(this.getCreditLimit())}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Emprunter</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(this.interestRates).map(([key, cfg]) => {
            const overLimit = this.getTotalDebt() + cfg.amount > this.getCreditLimit();
            return `
            <button class="bank-borrow-btn btn-primary" data-type="${key}" style="font-size:11px;padding:8px 14px;${overLimit ? 'opacity:0.4;cursor:not-allowed' : ''}">
              ${cfg.label}<br><span style="font-size:9px;opacity:0.7">${fmt(cfg.rate * 100)}% sur ${cfg.duration}j</span>
            </button>
          `;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Emprunts en cours</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr">
            <span>Montant</span><span>Taux</span><span>Restant</span><span>Paiement/jour</span><span>Jours restants</span>
          </div>
          ${this.loans.map(l => {
            const pct = fmt((l.totalDays - l.daysLeft) / l.totalDays * 100);
            return `<div class="dash-train-row" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr">
              <span>${fmtE(l.principal)}</span>
              <span>${fmt(l.rate * 100)}%</span>
              <span style="color:#ef4444">${fmtE(l.remaining)}</span>
              <span>${fmtE(l.dailyPayment)}</span>
              <span>${l.daysLeft}j <span style="font-size:9px;color:var(--text3)">(${pct}%)</span></span>
            </div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun emprunt en cours</div>'}
        </div>
      </div>
    `;

    // Event handlers
    container.querySelectorAll('.bank-borrow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const cfg = this.interestRates[type];
        if (this.getTotalDebt() + cfg.amount > this.getCreditLimit()) {
          alertToast('Plafond de crédit atteint.');
          return;
        }
        if (confirm(`Emprunter ${cfg.label} à ${fmt(cfg.rate*100)}% sur ${cfg.duration} jours ?\nRemboursement quotidien: ~${fmtE(Math.ceil(cfg.amount * (1 + cfg.rate) / cfg.duration))}`)) {
          this.borrow(eco, type);
          this.render(container, game);
        }
      });
    });
  }

  toSave() {
    return { loans: this.loans, startingBalance: this.startingBalance };
  }

  loadFromSave(s) {
    if (!s) return;
    this.loans = s.loans || [];
    this.startingBalance = s.startingBalance ?? null;
  }
}
