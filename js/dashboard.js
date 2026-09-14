import { renderInteractiveChart } from './dashboard-chart.js';
import { renderFinancialPanel } from './financial-panel.js';
import { htmlText } from './html-text.js';
/**
 * Dashboard — Real-time performance analytics for Rail Empire.
 * Pure read-only module: observes game state, never modifies it.
 */
import { icon } from './icons.js';
export class Dashboard {
    _chart(canvasId, rows, unit, options = {}) {
        var _a;
        const canvas = document.getElementById(canvasId);
        if (!canvas)
            return;
        const state = (_a = this._chartViews)[canvasId] || (_a[canvasId] = { start: 0, end: 0, cursor: 0, follow: true });
        renderInteractiveChart(canvas, rows, unit, state, options);
    }
    constructor() {
        this.expenseHistory = [];
        this._chartViews = {};
        this._financeView = { page: 0, query: '', type: '', from: '', to: '' };
        // Rolling history buffers (max 288 entries = 24h at 5-min intervals)
        this.maxEntries = 288;
        this.punctualityHistory = []; // { time, value }
        this.revenueHistory = []; // { time, value }
        this.passengerHistory = []; // { time, value }
        this.kmHistory = []; // { time, value }
        this._lastRecordTime = -1;
        this._canvasCache = {};
    }
    /**
     * Record a snapshot of current game stats (called every 5 in-game minutes).
     */
    record(game) {
        const pt = game.engine.getParisTime();
        const timeMinutes = pt.hours * 60 + pt.minutes;
        // Only record once per 5 in-game minutes
        const epoch = game.engine.getSimulationEpochMs?.();
        const bucket = Math.floor((typeof epoch === 'number' && Number.isFinite(epoch) ? epoch / 60000 : timeMinutes) / 5);
        if (bucket === this._lastRecordTime)
            return;
        this._lastRecordTime = bucket;
        const activeServices = game.scheduleCreator.getActiveServices();
        const movingServices = activeServices.filter((s) => s.state === 'moving');
        const label = `${game.engine.getParisDate?.() || ''} ${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`.trim();
        // Punctuality: % of moving trains with delay <= 5 min
        let onTime = 0;
        let total = movingServices.length;
        for (const svc of movingServices) {
            const d = Number(svc.train?.delay);
            if (Number.isFinite(d) && Math.abs(d) <= 5)
                onTime++;
        }
        const punctuality = total > 0 ? Math.round((onTime / total) * 100) : 100;
        this._push(this.punctualityHistory, { time: label, value: punctuality });
        // Align missing pre-RC19 expenses as unknown, never invent zero spending.
        while (this.expenseHistory.length < this.revenueHistory.length)
            this.expenseHistory.push({ time: this.revenueHistory[this.expenseHistory.length].time, value: null });
        this.expenseHistory.push({ time: label, value: Number.isFinite(game.economy.expenses) ? game.economy.expenses : 0 });
        // Cumulative revenue
        const revenue = Number(game.economy.revenue);
        this._push(this.revenueHistory, { time: label, value: Number.isFinite(revenue) ? revenue : 0 });
        // Cumulative passengers
        const passengers = Number(game.economy.totalPassengers);
        this._push(this.passengerHistory, { time: label, value: Number.isFinite(passengers) ? Math.max(0, passengers) : 0 });
        // Total km from all rames
        let totalKm = 0;
        for (const r of game.rameManager.getAll()) {
            const km = Number(r.totalKmRun);
            if (Number.isFinite(km) && km > 0)
                totalKm += km;
        }
        this._push(this.kmHistory, { time: label, value: Math.round(totalKm) });
    }
    _push(arr, entry) {
        arr.push(entry);
        if (arr !== this.revenueHistory && arr.length > this.maxEntries)
            arr.shift();
    }
    /**
     * Render the dashboard page into the container element.
     */
    render(container, game) {
        if (!container)
            return;
        const activeServices = game.scheduleCreator.getActiveServices();
        const movingServices = activeServices.filter((s) => s.state === 'moving');
        const waitingServices = activeServices.filter((s) => s.state === 'waiting');
        const rames = game.rameManager.getAll();
        const eco = game.economy;
        // Current stats
        let onTime = 0, delayed = 0, totalDelay = 0;
        for (const svc of movingServices) {
            const raw = Number(svc.train?.delay);
            const d = Number.isFinite(raw) ? raw : 0;
            if (Math.abs(d) <= 5)
                onTime++;
            else
                delayed++;
            totalDelay += d;
        }
        const avgDelay = movingServices.length > 0 ? (totalDelay / movingServices.length) : 0;
        const punctPct = movingServices.length > 0 ? ((onTime / movingServices.length) * 100) : 100;
        // Rames stats
        let ramesInMaint = 0, ramesAvailable = 0, avgWear = 0;
        for (const r of rames) {
            if (r.inMaintenance)
                ramesInMaint++;
            else
                ramesAvailable++;
            avgWear += r.wearLevel || 0;
        }
        avgWear = rames.length > 0 ? (avgWear / rames.length) : 0;
        // Financial breakdown
        const revBreak = eco.getRevenueBreakdown();
        const expBreak = eco.getExpenseBreakdown();
        const profit = eco.revenue - eco.expenses;
        const margin = eco.revenue > 0 ? ((profit / eco.revenue) * 100) : 0;
        // Total km
        let totalKm = 0;
        for (const r of rames)
            totalKm += r.totalKmRun || 0;
        const costPerKm = totalKm > 0 ? (eco.expenses / totalKm) : 0;
        const revPerKm = totalKm > 0 ? (eco.revenue / totalKm) : 0;
        // Revenue bar data
        const revCategories = [
            { key: 'voyageurs', label: 'Voyageurs', color: '#22c55e' },
            { key: 'fret', label: 'Fret', color: '#38bdf8' },
            { key: 'amendes', label: 'Amendes', color: '#f59e0b' },
            { key: 'emprunt', label: 'Emprunts', color: '#a78bfa' },
        ];
        const expCategories = [
            { key: 'exploitation', label: 'Exploitation', color: '#ef4444' },
            { key: 'salaires', label: 'Salaires', color: '#f97316' },
            { key: 'maintenance', label: 'Maintenance', color: '#facc15' },
            { key: 'achat', label: 'Achats', color: '#e879f9' },
            { key: 'penalty', label: 'P\u00e9nalit\u00e9s', color: '#fb7185' },
            { key: 'remboursement', label: 'Remboursements', color: '#94a3b8' },
        ];
        // Line profitability
        const lines = game.lineManager ? game.lineManager.getAll() : [];
        const lineProfit = lines.map((l) => {
            const p = eco.getLineProfitability(String(l.id || ''));
            return { name: l.name, code: l.code, ...p };
        }).filter((l) => l.revenue > 0 || l.expense > 0).sort((a, b) => b.profit - a.profit);
        // Format helpers — X : arrondi au 0,1 près, gros chiffres visibles
        const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
        const fmtE = (n) => fmt(Number(n) || 0) + ' \u20ac';
        // INC-05 / TRV-07 — bulletins spéciaux incidents + travaux actifs
        const incidentBulletins = game.incidentManager?.getBulletins() || [];
        const dateStr = game._currentDate || '';
        const timeOfDay = game.timeOfDay ?? game._gameTime ?? 0;
        const worksRestrictions = game.worksManager?.getActiveRestrictions
            ? game.worksManager.getActiveRestrictions(dateStr, timeOfDay)
            : (game.worksManager?.getActive(dateStr, timeOfDay) || []);
        const worksBulletins = worksRestrictions.map((w) => {
            const impact = (w.impact === 'stop' || (w.speedLimit === 0 && w.impact !== 'power-off')) ? 'stop' : (w.impact === 'power-off' ? 'power-off' : 'slow');
            const a = w.route?.[0], b = w.route?.at?.(-1);
            return {
                name: w.workName || w.name || 'Travaux',
                location: w.zoneId ? `Zone ORM ${w.zoneId}` : `${w.stationA || '?'} → ${w.stationB || '?'}`,
                effect: impact,
                speedLimit: Number.isFinite(w.speedLimit) ? w.speedLimit : 40,
                remaining: 'en cours',
            };
        });
        const bulletins = [...incidentBulletins, ...worksBulletins];
        const bulletinsHtml = bulletins.length === 0 ? '' : `
      <div class="dash-section" style="border-left:3px solid #ef4444;padding-left:14px">
        <h3 style="margin-top:0">Bulletins spéciaux</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${bulletins.map((b) => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border-radius:6px;border-left:3px solid ${htmlText(b.effect === 'stop' ? '#ef4444' : '#f59e0b')}">
              <span style="font-size:16px">${b.effect === 'stop' ? '⛔' : b.effect === 'power-off' ? '⚡' : '⚠️'}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text)">${htmlText(b.name)}</div>
                <div style="font-size:10px;color:var(--text3)">${htmlText(b.location)} — ${htmlText(typeof b.remaining === 'number' ? b.remaining + ' min restantes' : b.remaining)}</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${htmlText(b.effect === 'stop' ? '#ef4444' : '#f59e0b')}">${b.effect === 'stop' ? 'Interruption' : b.effect === 'power-off' ? 'Caténaire coupée' : 'LTV ' + b.speedLimit + ' km/h'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
        // DSH-04 — vue synthèse + drill-down
        const syntheseHtml = `
      <div class="dash-section">
        <h3>Vue synthese</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:8px">
          <span>Services actifs : <b>${activeServices.length}</b></span>
          <span>En circulation : <b>${movingServices.length}</b></span>
          <span>Retard moyen : <b>${fmt(avgDelay)} min</b></span>
          <span>Satisfaction voyageurs : <b>${eco.passengerSatisfaction == null ? "Pas encore de trajet évalué" : fmt(eco.passengerSatisfaction) + " / 100"}</b></span>
          <span>Solde : <b style="color:${htmlText(eco.balance >= 0 ? 'var(--green)' : '#ef4444')}">${fmtE(eco.balance)}</b></span>
          <span>Resultat net : <b style="color:${htmlText(profit >= 0 ? 'var(--green)' : '#ef4444')}">${profit >= 0 ? '+' : ''}${fmtE(profit)}</b></span>
        </div>
        <details style="font-size:11px;color:var(--text3)">
          <summary style="cursor:pointer;color:var(--text);font-weight:600">Details rapide</summary>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            ${activeServices.slice(0, 8).map((svc) => {
            const d = svc.train?.delay ?? 0;
            return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
                <span>${htmlText(svc.name)}</span>
                <span style="color:${htmlText(Math.abs(d) <= 5 ? 'var(--green)' : '#ef4444')}">${d > 0 ? '+' + fmt(d) + ' min' : 'A l\'heure'}</span>
              </div>`;
        }).join('') || '<span>Aucun service actif</span>'}
          </div>
        </details>
      </div>
    `;
        container.innerHTML = `${bulletinsHtml}${syntheseHtml}
      <div class="dash-section">
        <h3>Exploitation</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Ponctualit\u00e9</div>
            <div class="dash-kpi-value" style="color:${htmlText(punctPct >= 90 ? 'var(--green)' : punctPct >= 70 ? '#facc15' : '#ef4444')}">${fmt(punctPct)}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En circulation</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${movingServices.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En attente</div>
            <div class="dash-kpi-value" style="color:#a78bfa">${waitingServices.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Retard moyen</div>
            <div class="dash-kpi-value" style="color:${htmlText(avgDelay <= 2 ? 'var(--green)' : '#facc15')}">${fmt(avgDelay)} min</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Rames dispo</div>
            <div class="dash-kpi-value" style="color:#34d399">${ramesAvailable}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En maintenance</div>
            <div class="dash-kpi-value" style="color:#f97316">${ramesInMaint}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Usure moy.</div>
            <div class="dash-kpi-value" style="color:${htmlText(avgWear < 50 ? 'var(--green)' : '#ef4444')}">${fmt(avgWear)}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Km parcourus</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${fmt(totalKm)}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Billetterie</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Billets vendus</div>
            <div class="dash-kpi-value" style="color:#22c55e">${fmt(eco.totalTicketsSold)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Recettes billets</div>
            <div class="dash-kpi-value" style="color:#22c55e">${fmtE(eco.totalTicketRevenue)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Tarif / km</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${fmt(eco.ticketPricePerKm)} \u20ac</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Voyageurs total</div>
            <div class="dash-kpi-value" style="color:#a78bfa">${fmt(eco.totalPassengers)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Fret (tonnes)</div>
            <div class="dash-kpi-value" style="color:#f97316">${fmt(eco.totalFreightTonnes)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Taux fraude</div>
            <div class="dash-kpi-value" style="color:#ef4444">${fmt(eco.fraudRate * 100)}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Amendes PV</div>
            <div class="dash-kpi-value" style="color:#f59e0b">${fmtE(revBreak.amendes || 0)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Recette / km</div>
            <div class="dash-kpi-value" style="color:#22c55e">${fmt(revPerKm)} \u20ac</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Finances</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde</div>
            <div class="dash-kpi-value" style="color:${htmlText(eco.balance >= 0 ? 'var(--green)' : '#ef4444')}">${fmtE(eco.balance)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Revenus totaux</div>
            <div class="dash-kpi-value" style="color:#22c55e">${fmtE(eco.revenue)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">D\u00e9penses totales</div>
            <div class="dash-kpi-value" style="color:#ef4444">${fmtE(eco.expenses)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">R\u00e9sultat net</div>
            <div class="dash-kpi-value" style="color:${htmlText(profit >= 0 ? 'var(--green)' : '#ef4444')}">${profit >= 0 ? '+' : ''}${fmtE(profit)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Marge</div>
            <div class="dash-kpi-value" style="color:${htmlText(margin >= 0 ? 'var(--green)' : '#ef4444')}">${fmt(margin)}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Co\u00fbt / km</div>
            <div class="dash-kpi-value" style="color:#f97316">${fmt(costPerKm)} \u20ac</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">P\u00e9nalit\u00e9s</div>
            <div class="dash-kpi-value" style="color:#ef4444">${fmtE(eco.penalties)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Salaires / jour</div>
            <div class="dash-kpi-value" style="color:#f97316">${fmtE(game.staffManager ? game.staffManager.getDailySalaryExpense() : 0)}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>R\u00e9partition des revenus</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${revCategories.map((c) => {
            const val = revBreak[c.key] || 0;
            const pct = eco.revenue > 0 ? fmt((val / eco.revenue) * 100) : 0;
            return val > 0 ? `<div style="flex:1;min-width:120px;background:var(--bg2);border-radius:6px;padding:8px;border-left:3px solid ${htmlText(c.color)}">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase">${htmlText(c.label)}</div>
              <div style="font-size:14px;font-weight:700;color:${htmlText(c.color)}">${fmtE(val)}</div>
              <div style="font-size:9px;color:var(--text3)">${pct}%</div>
            </div>` : '';
        }).join('')}
        </div>
        <canvas id="dash-chart-rev-bar" width="600" height="100" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>R\u00e9partition des d\u00e9penses</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${expCategories.map((c) => {
            const val = expBreak[c.key] || 0;
            const pct = eco.expenses > 0 ? fmt((val / eco.expenses) * 100) : 0;
            return val > 0 ? `<div style="flex:1;min-width:120px;background:var(--bg2);border-radius:6px;padding:8px;border-left:3px solid ${htmlText(c.color)}">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase">${htmlText(c.label)}</div>
              <div style="font-size:14px;font-weight:700;color:${htmlText(c.color)}">${fmtE(val)}</div>
              <div style="font-size:9px;color:var(--text3)">${pct}%</div>
            </div>` : '';
        }).join('')}
        </div>
        <canvas id="dash-chart-exp-bar" width="600" height="100" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      ${lineProfit.length > 0 ? `
      <div class="dash-section">
        <h3>Rentabilit\u00e9 par ligne</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr">
            <span>Ligne</span><span>Revenus</span><span>D\u00e9penses</span><span>Profit</span><span>Marge</span>
          </div>
          ${lineProfit.map((l) => `<div class="dash-train-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr">
            <span style="font-weight:600">${htmlText(l.name)}${htmlText(l.code ? ' (' + l.code + ')' : '')}</span>
            <span style="color:#22c55e">${fmtE(l.revenue)}</span>
            <span style="color:#ef4444">${fmtE(l.expense)}</span>
            <span style="color:${htmlText(l.profit >= 0 ? 'var(--green)' : '#ef4444')}">${l.profit >= 0 ? '+' : ''}${fmtE(l.profit)}</span>
            <span style="color:${htmlText(l.margin >= 0 ? 'var(--green)' : '#ef4444')}">${fmt(l.margin)}%</span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="dash-section">
        <h3>Ponctualit\u00e9 (24h)</h3>
        <canvas id="dash-chart-punctuality" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>Recettes et dépenses cumulées — historique conservé</h3>
        <canvas id="dash-chart-revenue" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      ${eco.dailySnapshots.length > 1 ? `
      <div class="dash-section">
        <h3>Résultat journalier — historique conservé</h3>
        <canvas id="dash-chart-daily-profit" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>
      <div class="dash-section">
        <h3>\u00c9volution du solde</h3>
        <canvas id="dash-chart-balance" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>` : ''}

      <div class="dash-section">
        <h3>Trains en temps r\u00e9el</h3>
        <div class="dash-train-table">
          <div class="dash-train-header">
            <span>Train</span><span>Rame</span><span>\u00c9tat</span><span>Retard</span><span>Vitesse</span><span>Prochain arr\u00eat</span>
          </div>
          ${activeServices.map((svc) => {
            const state = svc.state === 'moving' ? `${icon('dot_green', 10)} En route` : svc.state === 'waiting' ? `${icon('dot_yellow', 10)} Attente` : `${icon('dot_gray', 10)} Termin\u00e9`;
            const delay = svc.train?.delay ?? 0;
            const delayStr = delay > 0 ? '+' + fmt(delay) + ' min' : '\u00c0 l\'heure';
            const delayColor = Math.abs(delay) <= 5 ? 'var(--green)' : '#ef4444';
            const speed = svc.train?.speed ? `${fmt(svc.train.speed)} km/h` : '-';
            const nextStop = svc.stops?.[svc.currentStopIndex]?.name || '-';
            const rameName = svc.rame?.name || '-';
            return `<div class="dash-train-row">
              <span style="font-weight:600">${htmlText(svc.name)}</span>
              <span style="color:var(--text3)">${htmlText(rameName)}</span>
              <span>${state}</span>
              <span style="color:${htmlText(delayColor)}">${delayStr}</span>
              <span>${speed}</span>
              <span>${htmlText(nextStop)}</span>
            </div>`;
        }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun service actif</div>'}
        </div>
      </div>

      <div class="dash-section">
        <h3>Historique financier (derniers mouvements)</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1fr 2fr 1fr 1fr">
            <span>Cat\u00e9gorie</span><span>Description</span><span>Montant</span><span>Type</span>
          </div>
          ${eco.history.slice(-20).reverse().map(h => `<div class="dash-train-row" style="grid-template-columns:1fr 2fr 1fr 1fr">
            <span style="text-transform:capitalize;font-size:10px">${htmlText(h.category || '-')}</span>
            <span style="font-size:10px;color:var(--text3)">${htmlText(h.description || '')}</span>
            <span style="color:${htmlText(h.type === 'revenue' ? '#22c55e' : '#ef4444')};font-weight:600">${h.type === 'revenue' ? '+' : '-'}${fmtE(h.amount)}</span>
            <span style="font-size:10px">${h.type === 'revenue' ? '\u25b2 Revenu' : '\u25bc D\u00e9pense'}</span>
          </div>`).join('') || '<div style="padding:8px;color:var(--text3)">Aucun mouvement</div>'}
        </div>
      </div>

      <div id="dash-finance-complete" class="dash-section"></div>

      <div id="dash-bank-section" class="dash-section">
        <h3>Banque</h3>
        <div id="dash-bank-container"></div>
      </div>
    `;
        // Inject bank UI into Dashboard (XIII — fusion Banque/Dashboard)
        const bankContainer = document.getElementById('dash-bank-container');
        if (bankContainer && game.bank)
            game.bank.render(bankContainer, game);
        const financeHost = document.getElementById('dash-finance-complete');
        if (financeHost)
            renderFinancialPanel(financeHost, eco, game.bank, this._financeView);
        // Draw charts
        this._drawLineChart('dash-chart-punctuality', this.punctualityHistory, '%', '#22c55e', 0, 100);
        this._chart('dash-chart-revenue', [{ name: 'Recettes', color: '#38bdf8', points: this.revenueHistory }, { name: 'Dépenses', color: '#ef4444', points: this.expenseHistory }], '\u20ac');
        // Revenue breakdown bar
        this._drawHorizontalBar('dash-chart-rev-bar', revCategories.filter((c) => (revBreak[c.key] || 0) > 0).map((c) => ({
            label: c.label, value: revBreak[c.key] || 0, color: c.color
        })));
        // Expense breakdown bar
        this._drawHorizontalBar('dash-chart-exp-bar', expCategories.filter((c) => (expBreak[c.key] || 0) > 0).map((c) => ({
            label: c.label, value: expBreak[c.key] || 0, color: c.color
        })));
        // Daily profit chart
        if (eco.dailySnapshots.length > 1) {
            this._drawBarChart('dash-chart-daily-profit', eco.dailySnapshots.map(d => ({
                label: String(d.date || ''), value: Number.isFinite(Number(d.profit)) ? Number(d.profit) : 0
            })), '\u20ac');
            this._drawLineChart('dash-chart-balance', eco.dailySnapshots.map(d => ({
                time: String(d.date || ''), value: Number.isFinite(Number(d.balance)) ? Number(d.balance) : 0
            })), '\u20ac', '#a78bfa');
        }
    }
    /**
     * X — arrondi au 0,1 près pour les graphiques.
     */
    _fmt(n) {
        return (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }
    /**
     * BUG-11 / responsive : ajuste le canevas à la taille CSS réelle (DPR).
     */
    _fitCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const styleW = canvas.clientWidth || canvas.width;
        const styleH = canvas.clientHeight || Math.round(styleW * (canvas.height / canvas.width)) || canvas.height;
        const needW = Math.max(1, Math.floor(styleW * dpr));
        const needH = Math.max(1, Math.floor(styleH * dpr));
        if (canvas.width !== needW || canvas.height !== needH) {
            canvas.width = needW;
            canvas.height = needH;
            canvas.style.width = styleW + 'px';
            canvas.style.height = styleH + 'px';
        }
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('Canvas 2D indisponible');
        return { ctx, W: styleW, H: styleH, dpr };
    }
    /**
     * Draw a simple line chart on a canvas element.
     */
    _drawLineChart(canvasId, data, unit, color, fixedMin = undefined, fixedMax = undefined) {
        this._chart(canvasId, [{ name: canvasId.includes('punctuality') ? 'Ponctualité' : canvasId.includes('balance') ? 'Solde' : 'Valeur', color, points: data }], unit, { min: fixedMin, max: fixedMax });
    }
    _drawHorizontalBar(canvasId, data) {
        var _a;
        const canvas = document.getElementById(canvasId);
        if (!canvas || !data.length)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (!(total > 0))
            return;
        const width = Math.max(160, canvas.clientWidth || 600), dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.style.width = '100%';
        canvas.style.height = '70px';
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(70 * dpr);
        canvas.tabIndex = 0;
        canvas.style.cursor = 'grab';
        canvas.setAttribute('aria-label', 'Ventilation financière : glisser pour lire une catégorie, flèches pour changer de catégorie.');
        const view = (_a = this._chartViews)[canvasId] || (_a[canvasId] = { start: 0, end: data.length - 1, cursor: 0, follow: false });
        view.cursor = Math.max(0, Math.min(data.length - 1, view.cursor));
        const controls = document.createElement('div');
        controls.className = 're-chart-controls';
        const output = document.createElement('output');
        output.className = 're-chart-readout';
        const legend = document.createElement('div');
        legend.className = 're-chart-help';
        legend.textContent = data.map(d => `${d.label} : ${d.value.toLocaleString('fr-FR')} €`).join(' · ');
        controls.append(output, legend);
        canvas.insertAdjacentElement('afterend', controls);
        const draw = () => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, 70);
            let x = 10;
            for (let i = 0; i < data.length; i++) {
                const d = data[i], w = d.value / total * (width - 20);
                ctx.fillStyle = d.color;
                ctx.fillRect(x, 15, w, 30);
                if (w > 40) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText((d.value / total * 100).toFixed(1) + '%', x + w / 2, 34);
                }
                if (i === view.cursor) {
                    ctx.beginPath();
                    ctx.arc(x + w / 2, 50, 5, 0, Math.PI * 2);
                    ctx.fillStyle = d.color;
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                x += w;
            }
            const selected = data[view.cursor];
            output.textContent = `${selected.label} : ${selected.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} € · ${(selected.value / total * 100).toFixed(2)} % · saisir la poignée pour lire`;
        };
        let dragging = false;
        const select = (event) => { const r = canvas.getBoundingClientRect(), fraction = Math.max(0, Math.min(1, ((event.clientX - r.left) * width / Math.max(1, r.width) - 10) / (width - 20))); let sum = 0; view.cursor = data.length - 1; for (let i = 0; i < data.length; i++) {
            sum += data[i].value / total;
            if (fraction <= sum) {
                view.cursor = i;
                break;
            }
        } draw(); };
        canvas.onpointerdown = event => { if (event.button !== 0)
            return; dragging = true; controls.dataset.reInteracting = 'true'; canvas.setPointerCapture?.(event.pointerId); select(event); };
        canvas.onpointermove = event => { if (dragging)
            select(event); };
        const release = () => { dragging = false; delete controls.dataset.reInteracting; };
        canvas.onpointerup = release;
        canvas.onpointercancel = release;
        canvas.onlostpointercapture = release;
        canvas.onkeydown = event => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
            return; event.preventDefault(); view.cursor = Math.max(0, Math.min(data.length - 1, view.cursor + (event.key === 'ArrowRight' ? 1 : -1))); draw(); };
        draw();
    }
    _drawBarChart(canvasId, data, unit) {
        this._chart(canvasId, [{ name: 'Résultat', color: '#22c55e', points: data.map(d => ({ time: d.label, value: d.value })) }], unit, { bars: true });
    }
    toSave() {
        return {
            punctualityHistory: this.punctualityHistory.slice(-this.maxEntries),
            revenueHistory: this.revenueHistory.slice(),
            expenseHistory: this.expenseHistory.map(point => ({ ...point })),
            lastRecordBucket: this._lastRecordTime,
            passengerHistory: this.passengerHistory.slice(-this.maxEntries),
            kmHistory: this.kmHistory.slice(-this.maxEntries),
        };
    }
    loadFromSave(s) {
        if (!s || typeof s !== 'object')
            return;
        const hist = (raw, min = -Infinity, max = Infinity, retain = this.maxEntries) => (Array.isArray(raw) ? raw : []).filter((x) => x && Number.isFinite(Number(x.value))).slice(-retain).map((x) => ({ time: typeof x.time === 'string' ? x.time : '--:--', value: Math.max(min, Math.min(max, Number(x.value))) }));
        this.punctualityHistory = hist(s.punctualityHistory, 0, 100);
        this.revenueHistory = hist(s.revenueHistory, -Infinity, Infinity, Infinity);
        const expenses = Array.isArray(s.expenseHistory) ? s.expenseHistory : [];
        this.expenseHistory = this.revenueHistory.map((point, i) => ({ time: point.time, value: typeof expenses[i]?.value === 'number' && Number.isFinite(expenses[i].value) ? Math.max(0, expenses[i].value) : null }));
        this.passengerHistory = hist(s.passengerHistory, 0);
        this.kmHistory = hist(s.kmHistory, 0);
        this._lastRecordTime = typeof s.lastRecordBucket === 'number' && Number.isFinite(s.lastRecordBucket) ? s.lastRecordBucket : -1;
    }
}
