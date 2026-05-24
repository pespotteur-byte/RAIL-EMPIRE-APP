/**
 * Dashboard — Real-time performance analytics for Rail Empire.
 * Pure read-only module: observes game state, never modifies it.
 */
import { icon } from './icons.js';
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
      if (svc.train && Math.abs(svc.train.delay || 0) <= 5) onTime++;
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
      const d = svc.train?.delay || 0;
      if (Math.abs(d) <= 5) onTime++;
      else delayed++;
      totalDelay += d;
    }
    const avgDelay = movingServices.length > 0 ? Math.round(totalDelay / movingServices.length) : 0;
    const punctPct = movingServices.length > 0 ? Math.round((onTime / movingServices.length) * 100) : 100;

    // Rames stats
    let ramesInMaint = 0, ramesAvailable = 0, avgWear = 0;
    for (const r of rames) {
      if (r.inMaintenance) ramesInMaint++;
      else ramesAvailable++;
      avgWear += r.wearLevel || 0;
    }
    avgWear = rames.length > 0 ? (avgWear / rames.length).toFixed(1) : '0';

    container.innerHTML = `
      <div class="dash-section">
        <h3>Tableau de bord</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Ponctualit&eacute;</div>
            <div class="dash-kpi-value" style="color:${punctPct >= 90 ? 'var(--green)' : punctPct >= 70 ? '#facc15' : '#ef4444'}">${punctPct}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Trains en circulation</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${movingServices.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Trains en attente</div>
            <div class="dash-kpi-value" style="color:#a78bfa">${waitingServices.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Retard moyen</div>
            <div class="dash-kpi-value" style="color:${parseFloat(avgDelay) <= 2 ? 'var(--green)' : '#facc15'}">${avgDelay} min</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Rames disponibles</div>
            <div class="dash-kpi-value" style="color:#34d399">${ramesAvailable}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Rames en maintenance</div>
            <div class="dash-kpi-value" style="color:#f97316">${ramesInMaint}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Usure moyenne</div>
            <div class="dash-kpi-value" style="color:${parseFloat(avgWear) < 50 ? 'var(--green)' : '#ef4444'}">${avgWear}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Solde</div>
            <div class="dash-kpi-value" style="color:${eco.balance >= 0 ? 'var(--green)' : '#ef4444'}">${eco.formatAmount(eco.balance)}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Ponctualit&eacute; (24h)</h3>
        <canvas id="dash-chart-punctuality" width="600" height="180" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>Revenus cumul&eacute;s (24h)</h3>
        <canvas id="dash-chart-revenue" width="600" height="180" style="width:100%;max-width:100%;height:auto"></canvas>
      </div>

      <div class="dash-section">
        <h3>Trains en temps r&eacute;el</h3>
        <div class="dash-train-table">
          <div class="dash-train-header">
            <span>Train</span><span>Rame</span><span>&Eacute;tat</span><span>Retard</span><span>Vitesse</span><span>Prochain arr&ecirc;t</span>
          </div>
          ${activeServices.map(svc => {
            const state = svc.state === 'moving' ? `${icon('dot_green', 10)} En route` : svc.state === 'waiting' ? `${icon('dot_yellow', 10)} Attente` : `${icon('dot_gray', 10)} Terminé`;
            const delay = svc.train?.delay || 0;
            const delayStr = delay > 0 ? `+${delay.toFixed(0)} min` : delay < -1 ? `${delay.toFixed(0)} min` : 'À l\'heure';
            const delayColor = Math.abs(delay) <= 5 ? 'var(--green)' : delay > 0 ? '#ef4444' : '#38bdf8';
            const speed = svc.train?.speed ? `${Math.round(svc.train.speed)} km/h` : '-';
            const nextStop = svc.stops?.[svc.currentStopIndex]?.name || '-';
            const rameName = svc.rame?.name || '-';
            return `<div class="dash-train-row">
              <span style="font-weight:600">${svc.name}</span>
              <span style="color:var(--text3)">${rameName}</span>
              <span>${state}</span>
              <span style="color:${delayColor}">${delayStr}</span>
              <span>${speed}</span>
              <span>${nextStop}</span>
            </div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun service actif</div>'}
        </div>
      </div>
    `;

    // Draw charts
    this._drawLineChart('dash-chart-punctuality', this.punctualityHistory, '%', '#22c55e', 0, 100);
    this._drawLineChart('dash-chart-revenue', this.revenueHistory, '€', '#38bdf8');
  }

  /**
   * Draw a simple line chart on a canvas element.
   */
  _drawLineChart(canvasId, data, unit, color, fixedMin, fixedMax) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Pas assez de données (attendez quelques minutes de jeu)', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
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
      ctx.fillText(Math.round(val) + unit, pad.left - 5, y + 4);
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
