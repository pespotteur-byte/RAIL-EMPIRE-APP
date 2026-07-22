/**
 * Dashboard — Real-time performance analytics for Rail Empire.
 * Pure read-only module: observes game state, never modifies it.
 */
import { icon } from './icons.js';
import { escapeHtml } from './html-utils.js?v=1784731012';
export class Dashboard {
  constructor() {
    // Rolling history buffers (max 288 entries = 24h at 5-min intervals)
    this.maxEntries = 288;
    this.punctualityHistory = [];   // { time, value }
    this.revenueHistory = [];       // { time, value }
    this.passengerHistory = [];     // { time, value }
    this.kmHistory = [];            // { time, value }
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
    const bucket = Math.floor(timeMinutes / 5);
    if (bucket === this._lastRecordTime) return;
    this._lastRecordTime = bucket;

    const activeServices = game.scheduleCreator.getActiveServices();
    const movingServices = activeServices.filter(s => s.state === 'moving');
    const label = `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`;

    // Punctuality: % of moving trains with delay <= 5 min
    let onTime = 0;
    let total = movingServices.length;
    for (const svc of movingServices) {
      if (svc.train && Math.abs(svc.train.delay ?? 0) <= 5) onTime++;
    }
    const punctuality = total > 0 ? Math.round((onTime / total) * 100) : 100;
    this._push(this.punctualityHistory, { time: label, value: punctuality });

    // Cumulative revenue
    this._push(this.revenueHistory, { time: label, value: game.economy.revenue });

    // Cumulative passengers
    this._push(this.passengerHistory, { time: label, value: game.economy.totalPassengers });

    // Total km from all rames
    let totalKm = 0;
    for (const r of game.rameManager.getAll()) {
      totalKm += r.totalKmRun || 0;
    }
    this._push(this.kmHistory, { time: label, value: Math.round(totalKm) });
  }

  _push(arr, entry) {
    arr.push(entry);
    if (arr.length > this.maxEntries) arr.shift();
  }

  /**
   * Render the dashboard page into the container element.
   */
  render(container, game) {
    if (!container) return;

    const activeServices = game.scheduleCreator.getActiveServices();
    const movingServices = activeServices.filter(s => s.state === 'moving');
    const waitingServices = activeServices.filter(s => s.state === 'waiting');
    const rames = game.rameManager.getAll();
    const eco = game.economy;

    // Current stats
    let onTime = 0, delayed = 0, totalDelay = 0;
    for (const svc of movingServices) {
      const d = svc.train?.delay ?? 0;
      if (Math.abs(d) <= 5) onTime++;
      else delayed++;
      totalDelay += d;
    }
    const avgDelay = movingServices.length > 0 ? (totalDelay / movingServices.length) : 0;
    const punctPct = movingServices.length > 0 ? ((onTime / movingServices.length) * 100) : 100;

    // Rames stats
    let ramesInMaint = 0, ramesAvailable = 0, avgWear = 0;
    for (const r of rames) {
      if (r.inMaintenance) ramesInMaint++;
      else ramesAvailable++;
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
    for (const r of rames) totalKm += r.totalKmRun || 0;
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
    const lineProfit = lines.map(l => {
      const p = eco.getLineProfitability(l.id);
      return { name: l.name, code: l.code, ...p };
    }).filter(l => l.revenue > 0 || l.expense > 0).sort((a, b) => b.profit - a.profit);

    // Format helpers — X : arrondi au 0,1 près, gros chiffres visibles
    const fmt = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    const fmtE = n => fmt(n) + ' \u20ac';

    // INC-05 / TRV-07 — bulletins spéciaux incidents + travaux actifs
    const incidentBulletins = game.incidentManager?.getBulletins() || [];
    const dateStr = game._currentDate || '';
    const timeOfDay = game.timeOfDay ?? game._gameTime ?? 0;
    const worksBulletins = (game.worksManager?.getActive(dateStr, timeOfDay) || []).map(w => {
      const impact = (w.impact === 'stop' || w.speedLimit === 0) ? 'stop' : 'slow';
      return {
        name: escapeHtml(w.name || 'Travaux'),
        location: `${escapeHtml(w.stationA || '?')} → ${escapeHtml(w.stationB || '?')}`,
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
          ${bulletins.map(b => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border-radius:6px;border-left:3px solid ${b.effect === 'stop' ? '#ef4444' : '#f59e0b'}">
              <span style="font-size:16px">${b.effect === 'stop' ? '⛔' : '⚠️'}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text)">${escapeHtml(b.name)}</div>
                <div style="font-size:10px;color:var(--text3)">${escapeHtml(b.location)} — ${b.remaining} min restantes</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${b.effect === 'stop' ? '#ef4444' : '#f59e0b'}">${b.effect === 'stop' ? 'Interruption' : 'Ralenti ' + b.speedLimit + ' km/h'}</span>
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
          <span>Solde : <b style="color:${eco.balance >= 0 ? 'var(--green)' : '#ef4444'}">${fmtE(eco.balance)}</b></span>
          <span>Resultat net : <b style="color:${profit >= 0 ? 'var(--green)' : '#ef4444'}">${profit >= 0 ? '+' : ''}${fmtE(profit)}</b></span>
        </div>
        <details style="font-size:11px;color:var(--text3)">
          <summary style="cursor:pointer;color:var(--text);font-weight:600">Details rapide</summary>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            ${activeServices.slice(0, 8).map(svc => {
              const d = svc.train?.delay ?? 0;
              return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
                <span>${escapeHtml(svc.name)}</span>
                <span style="color:${Math.abs(d) <= 5 ? 'var(--green)' : '#ef4444'}">${d > 0 ? '+' + fmt(d) + ' min' : 'A l\'heure'}</span>
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
            <div class="dash-kpi-value" style="color:${punctPct >= 90 ? 'var(--green)' : punctPct >= 70 ? '#facc15' : '#ef4444'}">${fmt(punctPct)}%</div>
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
            <div class="dash-kpi-value" style="color:${avgDelay <= 2 ? 'var(--green)' : '#facc15'}">${fmt(avgDelay)} min</div>
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
            <div class="dash-kpi-value" style="color:${avgWear < 50 ? 'var(--green)' : '#ef4444'}">${fmt(avgWear)}%</div>
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
            <div class="dash-kpi-value" style="color:${eco.balance >= 0 ? 'var(--green)' : '#ef4444'}">${fmtE(eco.balance)}</div>
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
            <div class="dash-kpi-value" style="color:${profit >= 0 ? 'var(--green)' : '#ef4444'}">${profit >= 0 ? '+' : ''}${fmtE(profit)}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Marge</div>
            <div class="dash-kpi-value" style="color:${margin >= 0 ? 'var(--green)' : '#ef4444'}">${fmt(margin)}%</div>
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
          ${revCategories.map(c => {
            const val = revBreak[c.key] || 0;
            const pct = eco.revenue > 0 ? fmt((val / eco.revenue) * 100) : 0;
            return val > 0 ? `<div style="flex:1;min-width:120px;background:var(--bg2);border-radius:6px;padding:8px;border-left:3px solid ${c.color}">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase">${c.label}</div>
              <div style="font-size:14px;font-weight:700;color:${c.color}">${fmtE(val)}</div>
              <div style="font-size:9px;color:var(--text3)">${pct}%</div>
            </div>` : '';
          }).join('')}
        </div>
        <canvas id="dash-chart-rev-bar" width="600" height="100" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>R\u00e9partition des d\u00e9penses</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${expCategories.map(c => {
            const val = expBreak[c.key] || 0;
            const pct = eco.expenses > 0 ? fmt((val / eco.expenses) * 100) : 0;
            return val > 0 ? `<div style="flex:1;min-width:120px;background:var(--bg2);border-radius:6px;padding:8px;border-left:3px solid ${c.color}">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase">${c.label}</div>
              <div style="font-size:14px;font-weight:700;color:${c.color}">${fmtE(val)}</div>
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
          ${lineProfit.map(l => `<div class="dash-train-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr">
            <span style="font-weight:600">${escapeHtml(l.name)}${l.code ? ' (' + escapeHtml(l.code) + ')' : ''}</span>
            <span style="color:#22c55e">${fmtE(l.revenue)}</span>
            <span style="color:#ef4444">${fmtE(l.expense)}</span>
            <span style="color:${l.profit >= 0 ? 'var(--green)' : '#ef4444'}">${l.profit >= 0 ? '+' : ''}${fmtE(l.profit)}</span>
            <span style="color:${l.margin >= 0 ? 'var(--green)' : '#ef4444'}">${fmt(l.margin)}%</span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="dash-section">
        <h3>Ponctualit\u00e9 (24h)</h3>
        <canvas id="dash-chart-punctuality" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>Revenus cumul\u00e9s (24h)</h3>
        <canvas id="dash-chart-revenue" width="600" height="150" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      ${eco.dailySnapshots.length > 1 ? `
      <div class="dash-section">
        <h3>Profit journalier (30 derniers jours)</h3>
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
          ${activeServices.map(svc => {
            const state = svc.state === 'moving' ? `${icon('dot_green', 10)} En route` : svc.state === 'waiting' ? `${icon('dot_yellow', 10)} Attente` : `${icon('dot_gray', 10)} Termin\u00e9`;
            const delay = svc.train?.delay ?? 0;
            const delayStr = delay > 0 ? '+' + fmt(delay) + ' min' : '\u00c0 l\'heure';
            const delayColor = Math.abs(delay) <= 5 ? 'var(--green)' : '#ef4444';
            const speed = svc.train?.speed ? `${fmt(svc.train.speed)} km/h` : '-';
            const nextStop = escapeHtml(svc.stops?.[svc.currentStopIndex]?.name || '-');
            const rameName = escapeHtml(svc.rame?.name || '-');
            return `<div class="dash-train-row">
              <span style="font-weight:600">${escapeHtml(svc.name)}</span>
              <span style="color:var(--text3)">${rameName}</span>
              <span>${state}</span>
              <span style="color:${delayColor}">${delayStr}</span>
              <span>${speed}</span>
              <span>${nextStop}</span>
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
            <span style="text-transform:capitalize;font-size:10px">${escapeHtml(h.category || '-')}</span>
            <span style="font-size:10px;color:var(--text3)">${escapeHtml(h.description || '')}</span>
            <span style="color:${h.type === 'revenue' ? '#22c55e' : '#ef4444'};font-weight:600">${h.type === 'revenue' ? '+' : '-'}${fmtE(h.amount)}</span>
            <span style="font-size:10px">${h.type === 'revenue' ? '\u25b2 Revenu' : '\u25bc D\u00e9pense'}</span>
          </div>`).join('') || '<div style="padding:8px;color:var(--text3)">Aucun mouvement</div>'}
        </div>
      </div>

      <div id="dash-bank-section" class="dash-section">
        <h3>Banque</h3>
        <div id="dash-bank-container"></div>
      </div>
    `;

    // Inject bank UI into Dashboard (XIII — fusion Banque/Dashboard)
    const bankContainer = document.getElementById('dash-bank-container');
    if (bankContainer && game.bank) game.bank.render(bankContainer, game);

    // Draw charts
    this._drawLineChart('dash-chart-punctuality', this.punctualityHistory, '%', '#22c55e', 0, 100);
    this._drawLineChart('dash-chart-revenue', this.revenueHistory, '\u20ac', '#38bdf8');

    // Revenue breakdown bar
    this._drawHorizontalBar('dash-chart-rev-bar', revCategories.filter(c => (revBreak[c.key] || 0) > 0).map(c => ({
      label: c.label, value: revBreak[c.key] || 0, color: c.color
    })));

    // Expense breakdown bar
    this._drawHorizontalBar('dash-chart-exp-bar', expCategories.filter(c => (expBreak[c.key] || 0) > 0).map(c => ({
      label: c.label, value: expBreak[c.key] || 0, color: c.color
    })));

    // Daily profit chart
    if (eco.dailySnapshots.length > 1) {
      this._drawBarChart('dash-chart-daily-profit', eco.dailySnapshots.map(d => ({
        label: d.date, value: d.profit
      })), '\u20ac');
      this._drawLineChart('dash-chart-balance', eco.dailySnapshots.map(d => ({
        time: d.date, value: d.balance
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
    return { ctx: canvas.getContext('2d'), W: styleW, H: styleH, dpr };
  }

  /**
   * Draw a simple line chart on a canvas element.
   */
  _drawLineChart(canvasId, data, unit, color, fixedMin, fixedMax) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, W, H, dpr } = this._fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (data.length < 2) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas assez de données (attendez quelques minutes de jeu)', W / 2, H / 2);
      return;
    }
    const pad = { top: 20, right: 15, bottom: 30, left: 55 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);

    // Compute range
    const values = data.map(d => d.value);
    const minV = fixedMin != null ? fixedMin : Math.min(...values);
    const maxV = fixedMax != null ? fixedMax : Math.max(...values);
    const range = maxV - minV || 1;

    // Grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxV - (range * i / 4);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this._fmt(val) + unit, pad.left - 5, y + 4);
    }

    // X-axis labels (show every ~10th label)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 8));
    for (let i = 0; i < data.length; i += step) {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      ctx.fillText(data[i].time, x, H - 5);
    }

    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      const y = pad.top + chartH - ((data[i].value - minV) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('#', '');
    // Use hex to rgba
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
    ctx.fill();
  }

  _drawHorizontalBar(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length === 0) return;
    const { ctx, W, H, dpr } = this._fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);

    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return;

    const barH = 30;
    const barY = (H - barH) / 2 - 8;
    let x = 10;
    const barW = W - 20;

    for (const d of data) {
      const w = (d.value / total) * barW;
      if (w < 1) continue;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, barY, w, barH);
      if (w > 40) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${this._fmt((d.value / total) * 100)}%`, x + w / 2, barY + barH / 2 + 4);
      }
      x += w;
    }

    // Legend
    let lx = 10;
    const ly = barY + barH + 18;
    ctx.font = '9px sans-serif';
    for (const d of data) {
      ctx.fillStyle = d.color;
      ctx.fillRect(lx, ly - 7, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      const label = `${d.label} (${this._fmt(d.value)}\u20ac)`;
      ctx.fillText(label, lx + 11, ly);
      lx += ctx.measureText(label).width + 22;
      if (lx > W - 50) { lx = 10; }
    }
  }

  _drawBarChart(canvasId, data, unit) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 1) return;
    const { ctx, W, H, dpr } = this._fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = { top: 20, right: 15, bottom: 30, left: 65 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);

    const values = data.map(d => d.value);
    const maxV = Math.max(...values, 0);
    const minV = Math.min(...values, 0);
    const range = maxV - minV || 1;
    const zeroY = pad.top + chartH - ((-minV) / range) * chartH;

    // Grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const val = maxV - (range * i / 4);
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(this._fmt(val) + unit, pad.left - 5, y + 4);
    }

    // Zero line
    if (minV < 0) {
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(W - pad.right, zeroY); ctx.stroke();
    }

    const barWidth = Math.max(4, chartW / data.length - 2);
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (i / data.length) * chartW + 1;
      const val = data[i].value;
      const barH2 = Math.abs(val / range) * chartH;
      const y = val >= 0 ? zeroY - barH2 : zeroY;
      ctx.fillStyle = val >= 0 ? '#22c55e' : '#ef4444';
      ctx.fillRect(x, y, barWidth, barH2);

      if (data.length <= 15) {
        ctx.fillStyle = '#94a3b8'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(data[i].label, x + barWidth / 2, H - 5);
      }
    }
  }

  toSave() {
    return {
      punctualityHistory: this.punctualityHistory.slice(-this.maxEntries),
      revenueHistory: this.revenueHistory.slice(-this.maxEntries),
      passengerHistory: this.passengerHistory.slice(-this.maxEntries),
      kmHistory: this.kmHistory.slice(-this.maxEntries),
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.punctualityHistory = s.punctualityHistory || [];
    this.revenueHistory = s.revenueHistory || [];
    this.passengerHistory = s.passengerHistory || [];
    this.kmHistory = s.kmHistory || [];
  }
}
