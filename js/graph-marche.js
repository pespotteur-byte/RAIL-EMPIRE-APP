/**
 * Graphique de Marche — Time-distance diagram for Rail Empire.
 * Records train positions and draws the classic railway operations chart.
 * Pure read-only module: observes game state, never modifies it.
 */
export class GraphMarche {
  constructor() {
    // Buffer: { serviceId, time (minutes of day), km, name, color }
    this.records = [];
    this.maxRecords = 10000;
    this._lastRecordTime = -1;
    // Service color assignments
    this._colorMap = {};
    this._colorIdx = 0;
    this._colors = [
      '#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#ef4444',
      '#facc15', '#34d399', '#ec4899', '#06b6d4', '#84cc16',
      '#e879f9', '#fb923c', '#2dd4bf', '#f43f5e', '#818cf8',
    ];
    // Selected line filter
    this.selectedLineId = null;
  }

  /**
   * Record current positions of all moving trains.
   * Called from main.js tick() every in-game minute.
   */
  record(game, timeOfDay) {
    // Record every minute
    if (timeOfDay === this._lastRecordTime) return;
    this._lastRecordTime = timeOfDay;

    const activeServices = game.scheduleCreator.getActiveServices();
    for (const svc of activeServices) {
      if (svc.state !== 'moving' || !svc.train) continue;

      // Filter by selected line if set
      if (this.selectedLineId && svc.lineId !== this.selectedLineId) continue;

      // Assign color
      if (!this._colorMap[svc.id]) {
        this._colorMap[svc.id] = this._colors[this._colorIdx % this._colors.length];
        this._colorIdx++;
      }

      const km = svc.train.totalKmRun || 0;

      this.records.push({
        serviceId: svc.id,
        name: svc.name,
        time: timeOfDay,
        km: km,
        color: this._colorMap[svc.id],
      });
    }

    // Cap buffer
    while (this.records.length > this.maxRecords) {
      this.records.splice(0, 500);
    }
  }

  /**
   * Render the graphique de marche into a container.
   */
  render(container, game) {
    if (!container) return;

    const lines = game.lineManager.getAll();
    const lineOptions = lines.map(l =>
      `<option value="${l.id}" ${l.id === this.selectedLineId ? 'selected' : ''}>${l.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="dash-section">
        <h3>Graphique de Marche</h3>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
          <label style="font-size:11px;color:var(--text3)">Ligne :</label>
          <select id="gm-line-select" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Toutes les lignes</option>
            ${lineOptions}
          </select>
          <button id="gm-clear" class="btn-sm" style="font-size:9px;background:#334155">Effacer</button>
          <span style="font-size:10px;color:var(--text3);margin-left:auto">Axe X = temps (hh:mm) · Axe Y = km parcourus</span>
        </div>
        <canvas id="gm-canvas" width="800" height="400" style="width:100%;max-width:100%;height:auto;border-radius:6px"></canvas>
      </div>

      <div class="dash-section">
        <h3>L&eacute;gende</h3>
        <div id="gm-legend" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
    `;

    // Event handlers
    document.getElementById('gm-line-select')?.addEventListener('change', (e) => {
      this.selectedLineId = e.target.value || null;
    });
    document.getElementById('gm-clear')?.addEventListener('click', () => {
      this.records = [];
      this._colorMap = {};
      this._colorIdx = 0;
      this.render(container, game);
    });

    this._drawChart();
    this._drawLegend();
  }

  _drawChart() {
    const canvas = document.getElementById('gm-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = { top: 20, right: 20, bottom: 35, left: 55 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (this.records.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('En attente de données... Les trains en circulation apparaîtront ici.', W / 2, H / 2);
      return;
    }

    // Find time and km ranges
    const times = this.records.map(r => r.time);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    // Handle midnight crossing
    if (maxTime - minTime > 720) {
      // Normalize: shift values < 720 up by 1440
      minTime = Math.min(...times.map(t => t < 720 ? t + 1440 : t));
      maxTime = Math.max(...times.map(t => t < 720 ? t + 1440 : t));
    }
    const timeRange = maxTime - minTime || 1;

    const maxKm = Math.max(...this.records.map(r => r.km), 1);

    // Grid lines - time axis (every hour)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    const startHour = Math.floor(minTime / 60);
    const endHour = Math.ceil(maxTime / 60);
    for (let h = startHour; h <= endHour; h++) {
      const t = h * 60;
      const x = pad.left + ((t - minTime) / timeRange) * chartW;
      if (x < pad.left || x > W - pad.right) continue;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const displayH = h % 24;
      ctx.fillText(`${String(displayH).padStart(2, '0')}:00`, x, H - 8);
    }

    // Grid lines - km axis
    const kmStep = maxKm > 200 ? 50 : maxKm > 100 ? 20 : maxKm > 50 ? 10 : 5;
    for (let km = 0; km <= maxKm; km += kmStep) {
      const y = pad.top + chartH - (km / maxKm) * chartH;
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${km} km`, pad.left - 5, y + 4);
    }

    // Draw traces per service
    const byService = {};
    for (const r of this.records) {
      if (!byService[r.serviceId]) byService[r.serviceId] = [];
      byService[r.serviceId].push(r);
    }

    for (const [, recs] of Object.entries(byService)) {
      if (recs.length < 2) continue;
      ctx.strokeStyle = recs[0].color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const r of recs) {
        let t = r.time;
        if (t < 720 && maxTime > 1440) t += 1440;
        const x = pad.left + ((t - minTime) / timeRange) * chartW;
        const y = pad.top + chartH - (r.km / maxKm) * chartH;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Temps', W / 2, H - 1);
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Distance (km)', 0, 0);
    ctx.restore();
  }

  _drawLegend() {
    const legendEl = document.getElementById('gm-legend');
    if (!legendEl) return;

    const seen = new Set();
    let html = '';
    for (const r of this.records) {
      if (seen.has(r.serviceId)) continue;
      seen.add(r.serviceId);
      html += `<div style="display:flex;align-items:center;gap:4px;font-size:11px">
        <div style="width:12px;height:3px;background:${r.color};border-radius:1px"></div>
        <span>${r.name}</span>
      </div>`;
    }
    legendEl.innerHTML = html || '<span style="color:var(--text3);font-size:11px">Aucun train enregistré</span>';
  }

  toSave() {
    return {
      records: this.records.slice(-this.maxRecords),
      colorMap: this._colorMap,
      colorIdx: this._colorIdx,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.records = s.records || [];
    this._colorMap = s.colorMap || {};
    this._colorIdx = s.colorIdx || 0;
  }
}
