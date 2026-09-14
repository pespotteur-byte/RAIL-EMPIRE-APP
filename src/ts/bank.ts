import { htmlText } from './html-text.js';
import { civilDayIndex } from './legacy-operating-day.js';
type LoanKind = 'small' | 'medium' | 'large' | 'mega';
type StoredLoanKind = LoanKind | 'legacy';

interface LoanConfig {
    amount: number;
    rate: number;
    duration: number;
    label: string;
}

interface BankLoan {
    id: string;
    type: StoredLoanKind;
    principal: number;
    rate: number;
    totalDue: number;
    remaining: number;
    dailyPayment: number;
    daysLeft: number;
    totalDays: number;
    takenDate?: number;
    [key: string]: unknown;
}

interface EconomyLike {
    balance: number;
    history: Array<Record<string, unknown>>;
    addExpense(amount: number, category: string, description: string): unknown;
}

interface BankGameLike {
    economy: EconomyLike;
    saveState?: () => unknown;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Bank — Loan system for Rail Empire.
 * Additive module: adds borrowing/repayment mechanics to economy.
 */
export class Bank {
    loans: BankLoan[];
    maxLoans: number;
    startingBalance: number | null;
    creditLimitRatio: number;
    lastRepaymentDate = '';
    interestRates: Record<LoanKind, LoanConfig>;

    constructor() {
        this.loans = [];
        this.maxLoans = Infinity; // XII — emprunts max illimités
        this.startingBalance = null; // ECO-07 : trésorerie de départ → plafond crédit
        this.creditLimitRatio = 0.5; // plafond crédit = 50 % de la trésorerie de départ
        this.interestRates = {
            small: { amount: 500000, rate: 0.03, duration: 30, label: '500 000 €' },
            medium: { amount: 2000000, rate: 0.05, duration: 60, label: '2 000 000 €' },
            large: { amount: 5000000, rate: 0.07, duration: 90, label: '5 000 000 €' },
            mega: { amount: 10000000, rate: 0.10, duration: 120, label: '10 000 000 €' },
        };
    }

    private _isLoanKind(value: unknown): value is LoanKind {
        return typeof value === 'string' && Object.prototype.hasOwnProperty.call(this.interestRates, value);
    }

    /** Pure preview, also used by the click handler and mutation boundary. */
    canBorrow(economy: EconomyLike, type: unknown): boolean {
        if (!this._isLoanKind(type) || this.loans.length >= this.maxLoans || !Number.isFinite(economy.balance)) return false;
        return this.getTotalPrincipalDebt() + this.interestRates[type].amount <= this.getCreditLimit(economy.balance);
    }

    /**
     * Take out a loan. Returns the loan object or null if at max.
     */
    borrow(economy: EconomyLike, type: unknown): BankLoan | null {
        if (!this.canBorrow(economy, type)) return null;
        // ECO-07 : initialiser le plafond crédit sur la première trésorerie connue
        if (this.startingBalance == null && economy?.balance != null) {
            this.startingBalance = economy.balance;
        }
        if (!this._isLoanKind(type))
            return null;
        const config = this.interestRates[type];
        const creditLimit = this.getCreditLimit();
        const totalDue = Math.ceil(config.amount * (1 + config.rate));
        // HOTFIX14 — the credit ceiling applies to borrowed capital, not to future
        // interest. Otherwise a 10 M€ loan is rejected against a 10 M€ ceiling only
        // because its future interest makes totalDue 11 M€. Track the outstanding
        // principal-equivalent of active loans for capacity while getTotalDebt() keeps
        // reporting the real amount still owed (principal + interest) to the UI.
        if (this.getTotalPrincipalDebt() + config.amount > creditLimit)
            return null;
        const loan: BankLoan = {
            id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            principal: config.amount,
            rate: config.rate,
            totalDue,
            remaining: totalDue,
            dailyPayment: Math.ceil(totalDue / config.duration),
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

        this.loans.push(loan);
        return loan;
    }

    /** Process daily loan repayments. Called from economy daily hook. */
    processDailyRepayments(economy: EconomyLike, dateStr = ''): void {
        if (dateStr && (civilDayIndex(dateStr) == null || (this.lastRepaymentDate && dateStr <= this.lastRepaymentDate))) return;
        const completed: string[] = [];
        for (const loan of this.loans) {
            if (loan.daysLeft <= 0) {
                completed.push(loan.id);
                continue;
            }
            const payment = loan.daysLeft === 1 ? loan.remaining : Math.min(loan.dailyPayment, loan.remaining);
            if (payment > 0) {
                economy.addExpense(payment, 'remboursement', `Remboursement emprunt (${loan.daysLeft}j restants)`);
                loan.remaining -= payment;
            }
            loan.daysLeft--;
            if (loan.daysLeft <= 0 || loan.remaining <= 0)
                completed.push(loan.id);
        }
        this.loans = this.loans.filter((l) => !completed.includes(l.id));
        if (dateStr) this.lastRepaymentDate = dateStr;
    }

    getTotalDebt(): number {
        return this.loans.reduce((sum, l) => sum + l.remaining, 0);
    }

    getTotalPrincipalDebt(): number {
        return this.loans.reduce((sum, l) => {
            const remaining = Math.max(0, Number(l?.remaining) || 0);
            const rate = Math.max(0, Number(l?.rate) || 0);
            return sum + (remaining / (1 + rate));
        }, 0);
    }

    getCreditLimit(initialBalance?: number): number {
        const starting = this.startingBalance ?? initialBalance;
        if (starting == null || starting <= 0) return Infinity;
        return Math.floor(starting * this.creditLimitRatio);
    }

    getTotalDailyPayment(): number {
        return this.loans.reduce((sum, l) => sum + l.dailyPayment, 0);
    }

    /** Render the bank section (integrated into Finances page or standalone). */
    render(container: HTMLElement | null, game: BankGameLike): void {
        if (!container)
            return;
        const eco = game.economy;
        const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
        const fmtE = (n: number) => fmt(n) + ' €';
        container.innerHTML = `
      <div class="dash-section">
        <h3>Banque — Emprunts</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi"><div class="dash-kpi-label">Dette totale</div><div class="dash-kpi-value" style="color:${htmlText(this.getTotalDebt() > 0 ? '#ef4444' : 'var(--green)')}">${fmtE(this.getTotalDebt())}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Remboursement / jour</div><div class="dash-kpi-value" style="color:#f97316">${fmtE(this.getTotalDailyPayment())}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Emprunts actifs</div><div class="dash-kpi-value" style="color:#38bdf8">${this.loans.length}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Solde actuel</div><div class="dash-kpi-value" style="color:${htmlText(eco.balance >= 0 ? 'var(--green)' : '#ef4444')}">${fmtE(eco.balance)}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Plafond crédit</div><div class="dash-kpi-value" style="color:#94a3b8">${fmtE(this.getCreditLimit(eco.balance))}</div></div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Emprunter</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(this.interestRates).map(([key, cfg]) => {
            const overLimit = !this.canBorrow(eco, key);
            return `<button class="bank-borrow-btn btn-primary" data-type="${htmlText(key)}" ${overLimit ? 'disabled aria-disabled="true"' : ''} style="font-size:11px;padding:8px 14px;${htmlText(overLimit ? 'opacity:0.4;cursor:not-allowed' : '')}">${htmlText(cfg.label)}<br><span style="font-size:9px;opacity:0.7">${fmt(cfg.rate * 100)}% sur ${cfg.duration}j</span></button>`;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Emprunts en cours</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr"><span>Montant</span><span>Taux</span><span>Restant</span><span>Paiement/jour</span><span>Jours restants</span></div>
          ${this.loans.map((l) => {
            const pct = fmt((l.totalDays - l.daysLeft) / l.totalDays * 100);
            return `<div class="dash-train-row" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr"><span>${fmtE(l.principal)}</span><span>${fmt(l.rate * 100)}%</span><span style="color:#ef4444">${fmtE(l.remaining)}</span><span>${fmtE(l.dailyPayment)}</span><span>${l.daysLeft}j <span style="font-size:9px;color:var(--text3)">(${pct}%)</span></span></div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun emprunt en cours</div>'}
        </div>
      </div>`;

        container.querySelectorAll('.bank-borrow-btn').forEach((node) => {
            const btn = node as HTMLElement;
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                if (!this._isLoanKind(type))
                    return;
                const cfg = this.interestRates[type];
                if (!this.canBorrow(eco, type)) {
                    alert('Plafond de crédit atteint.');
                    return;
                }
                if (confirm(`Emprunter ${cfg.label} à ${fmt(cfg.rate * 100)}% sur ${cfg.duration} jours ?\nRemboursement quotidien: ~${fmtE(Math.ceil(cfg.amount * (1 + cfg.rate) / cfg.duration))}`)) {
                    if (this.borrow(eco, type))
                        game.saveState?.();
                    this.render(container, game);
                }
            });
        });
    }

    toSave(): { loans: BankLoan[]; startingBalance: number | null; lastRepaymentDate: string } {
        return { loans: this.loans, startingBalance: this.startingBalance, lastRepaymentDate: this.lastRepaymentDate };
    }

    loadFromSave(s: unknown): void {
        if (!isRecord(s))
            return;
        this.lastRepaymentDate = civilDayIndex(s.lastRepaymentDate) != null ? String(s.lastRepaymentDate) : '';
        const seen = new Set<string>();
        const rawLoans = Array.isArray(s.loans) ? s.loans : [];
        this.loans = rawLoans.filter((raw): raw is UnknownRecord => {
            if (!isRecord(raw) || !raw.id)
                return false;
            const id = String(raw.id);
            if (seen.has(id) || !Number.isFinite(Number(raw.remaining)) || Number(raw.remaining) <= 0 || !Number.isFinite(Number(raw.daysLeft)) || Number(raw.daysLeft) <= 0)
                return false;
            seen.add(id);
            return true;
        }).map((l): BankLoan => {
            const remaining = Math.max(0, Number(l.remaining));
            const daysLeft = Math.max(1, Math.floor(Number(l.daysLeft)));
            const rawTotalDays = Number(l.totalDays);
            const totalDays = Math.max(daysLeft, Number.isFinite(rawTotalDays) && rawTotalDays > 0 ? Math.floor(rawTotalDays) : daysLeft);
            const principal = Number.isFinite(Number(l.principal)) ? Math.max(0, Number(l.principal)) : remaining;
            const totalDue = Number.isFinite(Number(l.totalDue)) ? Math.max(principal, Number(l.totalDue), remaining) : Math.max(principal, remaining);
            const daily = Number(l.dailyPayment);
            const type: StoredLoanKind = this._isLoanKind(l.type) ? l.type : 'legacy';
            return { ...l, id: String(l.id), type, principal, totalDue, remaining, rate: Number.isFinite(Number(l.rate)) ? Math.max(0, Math.min(1, Number(l.rate))) : 0, dailyPayment: Number.isFinite(daily) && daily > 0 ? daily : Math.ceil(remaining / daysLeft), daysLeft, totalDays };
        });
        this.startingBalance = s.startingBalance != null && s.startingBalance !== '' && Number.isFinite(Number(s.startingBalance)) ? Number(s.startingBalance) : null;
    }
}
