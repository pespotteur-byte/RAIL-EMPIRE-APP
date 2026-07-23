/**
 * Unions — Strike risk system based on company conditions.
 * Reads game state to compute risk. Strikes disable random % of services.
 */
import { getGlobalRng } from './rng.js?v=1784772853';
import { escapeHtml, alertToast } from './html-utils.js?v=1784772853';

function _daysBetween(a, b) {
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  try { return Math.floor((parse(b) - parse(a)) / 86400000); } catch { return 0; }
}

export class Unions {
  constructor() {
    this.satisfaction = 75;       // 0-100
    this.strikeActive = false;
    this.strikeEnd = 0;           // time of day (minutes) when strike ends
    this.strikeDaysLeft = 0;
    this.strikePercent = 0;       // % of services affected
    this._lastCheck = -1;
    this._strikeHistory = [];     // { date, duration, cause }
    this.baseSalary = 120;        // reference salary
    this.demands = [];            // current demands list
  }

  /**
   * Daily update: compute satisfaction, check for strike risk.
   * Called at midnight from tick().
   */
  dailyUpdate(game) {
    const eco = game.economy;
    const staff = game.staffManager;
    const dateStr = game.engine?.getCurrentDate?.() || new Date().toISOString().split('T')[0];
    const allStaff = staff?.staff || [];
    const staffCount = allStaff.length || 1;

    // Satisfaction factors
    let sat = 50;

    // Salary factor: higher salary = happier
    const avgSalary = staff?.dailySalary || this.baseSalary;
    if (avgSalary >= 150) sat += 15;
    else if (avgSalary >= 120) sat += 10;
    else if (avgSalary >= 80) sat += 0;
    else sat -= 15;

    // Financial health: profitable company = more secure jobs
    if (eco.balance > 500000) sat += 10;
    else if (eco.balance > 100000) sat += 5;
    else if (eco.balance < 0) sat -= 20;
    else if (eco.balance < 50000) sat -= 10;

    // Staffing: overwork = unhappy
    const services = game.scheduleCreator?.getActiveServices?.() || [];
    const activeCount = services.filter(s => s.state === 'running').length;
    const conductors = staff?.getByRole('conducteur')?.length || 0;
    if (conductors > 0 && activeCount > conductors * 2) sat -= 15;

    // Punctuality: lots of delays = stressful
    const punctuality = game.dashboard?.punctualityHistory?.slice(-1)?.[0]?.value;
    if (punctuality !== undefined) {
      if (punctuality < 50) sat -= 10;
      else if (punctuality > 90) sat += 5;
    }

    // 3-8 compliance: overtime / missed weekly rest increases social risk and lowers satisfaction
    let overworkCount = 0;
    let weeklyViolationCount = 0;
    let totalSocialRisk = 0;
    for (const m of allStaff) {
      totalSocialRisk += m.socialRisk || 0;
      if ((m.shiftWorkedMin || 0) > 480 || (m.socialRisk || 0) > 50) overworkCount++;
      if (m.lastWeeklyRestDate == null) {
        if (m.hireDate && _daysBetween(new Date(m.hireDate).toISOString().split('T')[0], dateStr) >= 6) {
          weeklyViolationCount++;
        }
      } else if (_daysBetween(m.lastWeeklyRestDate, dateStr) >= 6) {
        weeklyViolationCount++;
      }
    }
    const avgSocialRisk = totalSocialRisk / staffCount;
    sat -= Math.min(20, Math.round(avgSocialRisk / 5));          // 0..20 penalty
    if (overworkCount > staffCount * 0.1) sat -= 10;             // >10% overworked
    if (weeklyViolationCount > 0) sat -= weeklyViolationCount * 2;

    // Clamp
    this.satisfaction = Math.max(0, Math.min(100, sat));

    // Decrement any active strike first so a new one does not end immediately
    if (this.strikeActive) {
      this.strikeDaysLeft--;
      if (this.strikeDaysLeft <= 0) {
        this._endStrike();
      }
    }

    // Strike risk check (RH-05)
    if (!this.strikeActive && conductors > 0) {
      let strikeChance = 0;
      if (this.satisfaction < 30) strikeChance = 0.25;
      else if (this.satisfaction < 50) strikeChance = 0.10;
      else if (this.satisfaction < 65) strikeChance = 0.03;

      const rng = getGlobalRng();
      if (rng.random() < strikeChance) {
        this._startStrike(game, rng);
      }
    }

    // Generate demands
    this._generateDemands(game, { overworkCount, weeklyViolationCount, avgSocialRisk });
  }

  _startStrike(game, rng = getGlobalRng()) {
    this.strikeActive = true;
    this.strikeDaysLeft = Math.floor(rng.random() * 3) + 1; // 1-3 days
    this.strikePercent = this.satisfaction < 30 ? 80 : this.satisfaction < 50 ? 50 : 30;

    const cause = this.satisfaction < 30 ? 'Conditions de travail déplorables' :
                  this.satisfaction < 50 ? 'Salaires insuffisants' : 'Revendications sociales';

    this._strikeHistory.push({
      date: new Date().toISOString().split('T')[0],
      duration: this.strikeDaysLeft,
      cause,
      percent: this.strikePercent,
    });
    if (this._strikeHistory.length > 20) this._strikeHistory.shift();
  }

  _endStrike() {
    this.strikeActive = false;
    this.strikeDaysLeft = 0;
    this.strikePercent = 0;
    this.satisfaction = Math.min(100, this.satisfaction + 10);
  }

  /**
   * Should this service be blocked by strike?
   * Uses service id hash to deterministically block a consistent set.
   */
  isServiceBlocked(serviceId) {
    if (!this.strikeActive || this.strikePercent === 0) return false;
    let hash = 0;
    for (let i = 0; i < serviceId.length; i++) {
      hash = ((hash << 5) - hash) + serviceId.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 100) < this.strikePercent;
  }

  _generateDemands(game, opts = {}) {
    this.demands = [];
    if (this.satisfaction < 70) {
      this.demands.push('Augmentation des salaires');
    }
    if (this.satisfaction < 50) {
      this.demands.push('Embauche de personnel supplémentaire');
    }
    if (this.satisfaction < 30) {
      this.demands.push('Amélioration des conditions de travail');
      this.demands.push('Prime de risque pour intempéries');
    }
    if (opts.weeklyViolationCount > 0 || opts.avgSocialRisk > 40) {
      this.demands.push('Respect du repos hebdomadaire de 24h');
    }
    if (opts.overworkCount > 0 || opts.avgSocialRisk > 25) {
      this.demands.push('Respect du temps de repos entre les services (3-8)');
    }
  }

  /**
   * Negotiate: spend money to boost satisfaction.
   */
  negotiate(economy, type) {
    const costs = {
      bonus: { amount: 10000, satBoost: 15, label: 'Prime exceptionnelle (10 000 €)' },
      raise: { amount: 25000, satBoost: 25, label: 'Augmentation générale (25 000 €)' },
      conditions: { amount: 50000, satBoost: 35, label: 'Amélioration conditions (50 000 €)' },
    };
    const cfg = costs[type];
    if (!cfg || economy.balance < cfg.amount) return false;

    economy.addExpense(cfg.amount, 'syndicat', cfg.label);
    this.satisfaction = Math.min(100, this.satisfaction + cfg.satBoost);
    if (this.strikeActive) {
      this.strikeDaysLeft = Math.max(0, this.strikeDaysLeft - 1);
      if (this.strikeDaysLeft <= 0) this._endStrike();
    }
    return true;
  }

  render(container, game) {
    if (!container) return;

    const satColor = this.satisfaction >= 70 ? 'var(--green)' :
                     this.satisfaction >= 40 ? '#f97316' : '#ef4444';

    container.innerHTML = `
      <div class="dash-section">
        <h3>Syndicats & Relations Sociales</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Satisfaction sociale</div>
            <div class="dash-kpi-value" style="color:${satColor}">${this.satisfaction}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Risque de grève</div>
            <div class="dash-kpi-value" style="color:${this.satisfaction < 30 ? '#ef4444' : this.satisfaction < 50 ? '#f97316' : 'var(--green)'}">
              ${this.satisfaction < 30 ? 'Élevé' : this.satisfaction < 50 ? 'Moyen' : this.satisfaction < 65 ? 'Faible' : 'Très faible'}
            </div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Grève active</div>
            <div class="dash-kpi-value" style="color:${this.strikeActive ? '#ef4444' : 'var(--green)'}">
              ${this.strikeActive ? `OUI — ${this.strikePercent}% services (${this.strikeDaysLeft}j)` : 'Non'}
            </div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Grèves passées</div>
            <div class="dash-kpi-value">${this._strikeHistory.length}</div>
          </div>
        </div>
      </div>

      ${this.demands.length > 0 ? `
      <div class="dash-section">
        <h3>Revendications syndicales</h3>
        <ul style="margin:0;padding-left:20px;color:var(--text2);font-size:12px">
          ${this.demands.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="dash-section">
        <h3>Négocier</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="union-negotiate btn-primary" data-type="bonus" style="font-size:11px;padding:8px 14px;background:#f97316">
            Prime 10 000 €<br><span style="font-size:9px;opacity:0.7">+15% satisfaction</span>
          </button>
          <button class="union-negotiate btn-primary" data-type="raise" style="font-size:11px;padding:8px 14px;background:#3b82f6">
            Augmentation 25 000 €<br><span style="font-size:9px;opacity:0.7">+25% satisfaction</span>
          </button>
          <button class="union-negotiate btn-primary" data-type="conditions" style="font-size:11px;padding:8px 14px;background:#8b5cf6">
            Conditions 50 000 €<br><span style="font-size:9px;opacity:0.7">+35% satisfaction</span>
          </button>
        </div>
      </div>

      ${this._strikeHistory.length > 0 ? `
      <div class="dash-section">
        <h3>Historique des grèves</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1fr 1fr 1fr 1fr">
            <span>Date</span><span>Durée</span><span>Impact</span><span>Cause</span>
          </div>
          ${this._strikeHistory.slice().reverse().map(h => `
            <div class="dash-train-row" style="grid-template-columns:1fr 1fr 1fr 1fr">
              <span>${h.date}</span>
              <span>${h.duration}j</span>
              <span style="color:#ef4444">${h.percent}%</span>
              <span>${h.cause}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    `;

    // Negotiate handlers
    container.querySelectorAll('.union-negotiate').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (this.negotiate(game.economy, type)) {
          this.render(container, game);
        } else {
          alertToast('Solde insuffisant !');
        }
      });
    });
  }

  toSave() {
    return {
      satisfaction: this.satisfaction,
      strikeActive: this.strikeActive,
      strikeDaysLeft: this.strikeDaysLeft,
      strikePercent: this.strikePercent,
      _strikeHistory: this._strikeHistory,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.satisfaction = s.satisfaction ?? 75;
    this.strikeActive = s.strikeActive || false;
    this.strikeDaysLeft = s.strikeDaysLeft || 0;
    this.strikePercent = s.strikePercent || 0;
    this._strikeHistory = s._strikeHistory || [];
  }
}
