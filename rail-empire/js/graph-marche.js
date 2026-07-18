/**
 * Graphique de Marche — JT TRAN GRAPH reproduction.
 * Time-distance diagram with stations on the horizontal axis and
 * time (00:00 -> 24:00) on the vertical axis, like the JTrainGraph schema.
 */
export class GraphMarche {
  constructor() {
    this.records = [];
    this.maxRecords = 10000;
    this._lastRecordTime = -1;
    this._colorMap = {};
    this._colorIdx = 0;
    this._colors = [
      '#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#ef4444',
      '#facc15', '#34d399', '#ec4899', '#06b6d4', '#84cc16',
      '#e879f9', '#fb923c', '#2dd4bf', '#f43f5e', '#818cf8',
    ];
    this.stationAId = null;
    this.stationBId = null;
    this.mode = 'theoretical'; // 'theoretical' or 'live'
  }

  /** Record live train positions each minute */
  record(game, timeOfDay) {
    if (timeOfDay === this._lastRecordTime) return;
    this._lastRecordTime = timeOfDay;
    const activeServices = game.scheduleCreator.getActiveServices();
    for (const svc of activeServices) {
      if (!svc.active || !svc.train) continue;
      if (!this._colorMap[svc.id]) {
        this._colorMap[svc.id] = this._colors[this._colorIdx % this._colors.length];
        this._colorIdx++;
      }
      const stops = svc.getCurrentStops();
      const curIdx = svc.currentStopIndex;
      this.records.push({
        serviceId: svc.id,
        name: svc.name,
        time: timeOfDay,
        lat: svc.position?.lat,
        lon: svc.position?.lon,
        stopIndex: curIdx,
        totalStops: stops?.length || 0,
        stops: stops?.map(s => s.stationId) || [],
        color: this._colorMap[svc.id],
        state: svc.state,
      });
    }
    while (this.records.length > this.maxRecords) this.records.splice(0, 500);
  }

  /** Get all stations referenced by any service */
  _getServiceStations(game) {
    const stationSet = new Set();
    for (const svc of game.scheduleCreator.getActiveServices()) {
      for (const stop of svc.stops) stationSet.add(stop.stationId);
    }
    return [...stationSet].map(id => game.world.getStationById(id)).filter(Boolean);
  }

  /** Find services that pass through both station A and B */
  _findServicesThrough(game, stAId, stBId) {
    const results = [];
    for (const svc of game.scheduleCreator.getActiveServices()) {
      const stops = svc.stops;
      const idxA = stops.findIndex(s => s.stationId === stAId);
      const idxB = stops.findIndex(s => s.stationId === stBId);
      if (idxA >= 0 && idxB >= 0) {
        results.push({ svc, idxA, idxB, direction: idxA < idxB ? 1 : -1 });
      }
    }
    return results;
  }

  /** Build ordered station list between A and B from a service's stops */
  _getStationsBetween(svc, idxA, idxB) {
    const start = Math.min(idxA, idxB);
    const end = Math.max(idxA, idxB);
    return svc.stops.slice(start, end + 1);
  }

  /** Calculate cumulative distances between stations using the real ORM route.
   * Falls back to straight-line haversine only if no route is available. */
  _calcDistances(stationStops, game, refSvc) {
    const dists = [0];
    for (let i = 1; i < stationStops.length; i++) {
      const route = refSvc && refSvc.routes ? refSvc.routes[i - 1] : null;
      let d = 0;
      if (route && route.length >= 2) {
        for (let k = 0; k < route.length - 1; k++) {
          d += this._haversine(route[k].lat, route[k].lon, route[k + 1].lat, route[k + 1].lon);
        }
      } else {
        const prev = game.world.getStationById(stationStops[i - 1].stationId);
        const curr = game.world.getStationById(stationStops[i].stationId);
        if (!prev || !curr) { dists.push(dists[i - 1]); continue; }
        d = this._haversine(prev.lat, prev.lon, curr.lat, curr.lon);
      }
      dists.push(dists[i - 1] + d);
    }
    return dists;
  }

  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  render(container, game) {
    if (!container) return;

    const allStations = this._getServiceStations(game);
    const worldStations = game.world.stations;
    const stationMap = new Map();
    for (const s of worldStations) stationMap.set(s.id, s);
    for (const s of allStations) stationMap.set(s.id, s);
    const sortedStations = [...stationMap.values()].sort((a, b) => a.name.localeCompare(b.name));

    const optionsHtml = sortedStations.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="dash-section">
        <h3>Graphique de Marche — JT TRAN GRAPH</h3>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <label style="font-size:11px;color:var(--text3)">Gare A :</label>
          <select id="gm-station-a" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;max-width:180px">
            <option value="">-- Choisir --</option>
            ${optionsHtml}
          </select>
          <label style="font-size:11px;color:var(--text3)">Gare B :</label>
          <select id="gm-station-b" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;max-width:180px">
            <option value="">-- Choisir --</option>
            ${optionsHtml}
          </select>
          <div style="display:flex;gap:4px;margin-left:8px">
            <button id="gm-mode-theo" class="btn-sm" style="font-size:10px;padding:4px 10px;border-radius:4px">Théorique</button>
            <button id="gm-mode-live" class="btn-sm" style="font-size:10px;padding:4px 10px;border-radius:4px">Live</button>
          </div>
          <button id="gm-clear" class="btn-sm" style="font-size:9px;background:#334155;margin-left:auto;color:#fff">Effacer live</button>
        </div>
        <canvas id="gm-canvas" width="900" height="600" style="width:100%;max-width:100%;height:auto;border-radius:6px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></canvas>
      </div>
      <div class="dash-section">
        <h3>Légende</h3>
        <div id="gm-legend" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
    `;

    const selA = document.getElementById('gm-station-a');
    const selB = document.getElementById('gm-station-b');
    if (this.stationAId) selA.value = this.stationAId;
    if (this.stationBId) selB.value = this.stationBId;

    const btnTheo = document.getElementById('gm-mode-theo');
    const btnLive = document.getElementById('gm-mode-live');
    const updateModeUI = () => {
      btnTheo.style.background = this.mode === 'theoretical' ? '#3b82f6' : '#334155';
      btnTheo.style.color = this.mode === 'theoretical' ? '#fff' : '#94a3b8';
      btnLive.style.background = this.mode === 'live' ? '#22c55e' : '#334155';
      btnLive.style.color = this.mode === 'live' ? '#fff' : '#94a3b8';
    };
    updateModeUI();

    btnTheo.addEventListener('click', () => { this.mode = 'theoretical'; updateModeUI(); this._draw(game); });
    btnLive.addEventListener('click', () => { this.mode = 'live'; updateModeUI(); this._draw(game); });

    selA.addEventListener('change', () => { this.stationAId = selA.value || null; this._draw(game); });
    selB.addEventListener('change', () => { this.stationBId = selB.value || null; this._draw(game); });

    document.getElementById('gm-clear')?.addEventListener('click', () => {
      this.records = [];
      this._colorMap = {};
      this._colorIdx = 0;
      this._draw(game);
    });

    this._draw(game);
  }

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
    return { ctx, W: styleW, H: styleH, dpr };
  }

  _draw(game) {
    const canvas = document.getElementById('gm-canvas');
    if (!canvas) return;
    const { ctx, W, H, dpr } = this._fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // JT TRAN GRAPH white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = { top: 72, right: 24, bottom: 40, left: 58 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    if (!this.stationAId || !this.stationBId) {
      this._centerText(ctx, 'Sélectionnez une Gare A et une Gare B pour afficher le graphique.', W / 2, H / 2, '#64748b');
      this._drawLegend([]);
      return;
    }

    if (this.stationAId === this.stationBId) {
      this._centerText(ctx, 'Les gares A et B doivent être différentes.', W / 2, H / 2, '#64748b');
      this._drawLegend([]);
      return;
    }

    const matches = this._findServicesThrough(game, this.stationAId, this.stationBId);
    if (matches.length === 0) {
      this._centerText(ctx, 'Aucun service ne relie ces deux gares.', W / 2, H / 2, '#64748b');
      this._drawLegend([]);
      return;
    }

    // Reference station list = longest path between A and B
    const ref = matches.reduce((best, m) => Math.abs(m.idxB - m.idxA) > Math.abs(best.idxB - best.idxA) ? m : best, matches[0]);
    const refStops = this._getStationsBetween(ref.svc, ref.idxA, ref.idxB);
    const refDists = this._calcDistances(refStops, game, ref.svc);
    const totalDist = refDists[refDists.length - 1] || 1;

    // Precompute station x positions
    const stationXs = refDists.map(d => pad.left + (d / totalDist) * chartW);

    // Grid: vertical yellow station lines
    ctx.strokeStyle = '#facc15'; // yellow-400
    ctx.lineWidth = 0.8;
    for (let i = 0; i < refStops.length; i++) {
      const x = stationXs[i];
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();
    }

    // Grid: horizontal time lines every 10 min, stronger every 30 min
    for (let t = 0; t <= 1440; t += 10) {
      const y = pad.top + (t / 1440) * chartH;
      const is30 = t % 30 === 0;
      const isHour = t % 60 === 0;
      ctx.strokeStyle = is30 ? '#facc15' : 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = isHour ? 1.0 : (is30 ? 0.7 : 0.4);
      if (!is30 && !isHour) ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Time labels on left (orange/yellow)
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b45309'; // amber-700 for readability on white
    for (let t = 0; t <= 1440; t += 30) {
      const y = pad.top + (t / 1440) * chartH;
      const label = t === 1440 ? '00:00' : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      ctx.fillText(label, pad.left - 6, y);
    }

    // Station labels on top (black, staggered to avoid overlap)
    ctx.fillStyle = '#000000';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const stationNames = refStops.map(s => {
      const st = game.world.getStationById(s.stationId);
      return st ? st.name : '?';
    });
    const maxNameWidth = Math.max(40, chartW / refStops.length - 8);
    for (let i = 0; i < refStops.length; i++) {
      const x = stationXs[i];
      const baseY = i % 2 === 0 ? pad.top - 10 : pad.top - 26;
      const words = stationNames[i].split(/\s+/);
      // Wrap to fit max width
      const lines = [];
      let line = '';
      ctx.font = '9px sans-serif';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxNameWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      if (lines.length === 0) lines.push(stationNames[i]);
      // If still too wide, truncate with ellipsis
      if (ctx.measureText(lines[lines.length - 1]).width > maxNameWidth) {
        let s = lines[lines.length - 1];
        while (ctx.measureText(s + '…').width > maxNameWidth && s.length > 1) s = s.slice(0, -1);
        lines[lines.length - 1] = s + '…';
      }
      const lineHeight = 10;
      const startY = baseY - (lines.length - 1) * lineHeight;
      for (let l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], x, startY + l * lineHeight);
      }
    }

    // Border around chart area
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left, pad.top, chartW, chartH);

    const legendItems = [];

    if (this.mode === 'theoretical') {
      for (const m of matches) {
        const start = Math.min(m.idxA, m.idxB);
        const end = Math.max(m.idxA, m.idxB);
        ctx.strokeStyle = '#000000';
        this._styleForService(m.svc, ctx);
        ctx.beginPath();

        let labelPoints = []; // collect points to pick the longest leg for the label

        for (let i = start; i <= end; i++) {
          const stop = m.svc.stops[i];
          const refIdx = refStops.findIndex(rs => rs.stationId === stop.stationId);
          if (refIdx < 0) continue;
          const x = stationXs[refIdx];
          const arr = stop.arrivalTime ?? stop.departureTime ?? 0;
          const dep = stop.departureTime ?? arr;
          const yArr = pad.top + (arr / 1440) * chartH;
          const yDep = pad.top + (dep / 1440) * chartH;

          if (i === start) {
            ctx.moveTo(x, yDep);
          } else {
            ctx.lineTo(x, yArr);
          }
          if (dep !== arr) {
            ctx.lineTo(x, yDep);
          }

          if (i > start) {
            const prevStop = m.svc.stops[i - 1];
            const prevRef = refStops.findIndex(rs => rs.stationId === prevStop.stationId);
            if (prevRef >= 0) {
              const prevDep = prevStop.departureTime ?? prevStop.arrivalTime ?? 0;
              const duration = ((arr - prevDep) % 1440 + 1440) % 1440;
              labelPoints.push({
                x1: stationXs[prevRef], y1: pad.top + (prevDep / 1440) * chartH,
                x2: x, y2: yArr, duration,
                arr, dep: prevDep, name: m.svc.name,
              });
            }
          }
        }
        ctx.stroke();

        // Draw service label on the longest leg, avoiding overflow
        if (labelPoints.length > 0) {
          const lp = labelPoints.reduce((best, p) => p.duration > best.duration ? p : best, labelPoints[0]);
          this._drawTrainLabel(ctx, lp.x1, lp.y1, lp.x2, lp.y2, m.svc.name);
        }

        legendItems.push({ name: m.svc.name, color: '#000000' });
      }
    } else {
      // Live mode
      const serviceIds = new Set(matches.map(m => m.svc.id));
      const byService = {};
      for (const r of this.records) {
        if (!serviceIds.has(r.serviceId)) continue;
        if (!byService[r.serviceId]) byService[r.serviceId] = [];
        byService[r.serviceId].push(r);
      }

      for (const m of matches) {
        const recs = byService[m.svc.id];
        if (!recs || recs.length < 2) continue;
        const start = Math.min(m.idxA, m.idxB);
        const end = Math.max(m.idxA, m.idxB);
        const routeCoords = [];
        for (let i = start; i <= end; i++) {
          const st = game.world.getStationById(m.svc.stops[i].stationId);
          const refIdx = refStops.findIndex(rs => rs.stationId === m.svc.stops[i].stationId);
          if (st && refIdx >= 0) routeCoords.push({ lat: st.lat, lon: st.lon, dist: refDists[refIdx] });
        }

        const color = this._getSvcColor(m.svc.id);
        ctx.strokeStyle = color;
        this._styleForService(m.svc, ctx);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        let prev = null;
        for (const r of recs) {
          if (r.lat == null || r.lon == null) continue;
          const dist = this._interpolateDist(r.lat, r.lon, routeCoords);
          if (dist === null) continue;
          const x = pad.left + (dist / totalDist) * chartW;
          const y = pad.top + (r.time / 1440) * chartH;

          if (prev && r.time < prev.time) {
            // Wrap around midnight: interpolate to 24:00 then restart at 00:00
            const duration = (1440 - prev.time) + r.time;
            const frac = (1440 - prev.time) / duration;
            const xMid = prev.x + frac * (x - prev.x);
            ctx.lineTo(xMid, H - pad.bottom);
            ctx.moveTo(xMid, pad.top);
            ctx.lineTo(x, y);
          } else if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
          prev = { x, y, time: r.time };
        }
        ctx.stroke();
        ctx.setLineDash([]);

        legendItems.push({ name: m.svc.name + ' (live)', color });
      }

      if (legendItems.length === 0) {
        this._centerText(ctx, 'En attente de données live... Les trains en circulation apparaîtront ici.', W / 2, H / 2, '#64748b');
      }
    }

    // Watermarks, matching the JTrainGraph schema
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const watermark = 'This diagram was created using the free version of JTrainGraph.';
    ctx.fillText(watermark, W / 2, 12);
    ctx.fillText(watermark, W / 2, H - 6);

    this._drawLegend(legendItems);
  }

  /** Draw a train number label next to its trace. */
  _drawTrainLabel(ctx, x1, y1, x2, y2, label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const offset = 8;
    const lx = mx + Math.cos(angle) * offset;
    const ly = my + Math.sin(angle) * offset;

    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    const metrics = ctx.measureText(label);
    const w = metrics.width + 6;
    const h = 13;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(lx + 2, ly - h / 2, w, h);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + 5, ly);
    ctx.restore();
  }

  _centerText(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // GM-04 — line style by service type (black color, dash pattern only)
  _styleForService(svc, ctx) {
    const type = svc.serviceType || (svc.isWorkTrain ? 'work' : 'passager');
    switch (type) {
      case 'fret': case 'w':
        ctx.setLineDash([6, 3]);
        break;
      case 'work': case 'hlp': case 'tm':
        ctx.setLineDash([2, 3]);
        break;
      default:
        ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.1;
  }

  _interpolateDist(lat, lon, routeCoords) {
    if (routeCoords.length < 2) return null;
    let bestDist = Infinity, bestVal = null;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i], b = routeCoords[i + 1];
      const dx = b.lat - a.lat, dy = b.lon - a.lon;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((lat - a.lat) * dx + (lon - a.lon) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const projLat = a.lat + t * dx, projLon = a.lon + t * dy;
      const d = Math.hypot(lat - projLat, lon - projLon);
      if (d < bestDist) {
        bestDist = d;
        bestVal = a.dist + t * (b.dist - a.dist);
      }
    }
    return bestVal;
  }

  _getSvcColor(id) {
    if (!this._colorMap[id]) {
      this._colorMap[id] = this._colors[this._colorIdx % this._colors.length];
      this._colorIdx++;
    }
    return this._colorMap[id];
  }

  _drawLegend(items) {
    const legendEl = document.getElementById('gm-legend');
    if (!legendEl) return;
    if (!items || items.length === 0) {
      legendEl.innerHTML = '<span style="color:var(--text3);font-size:11px">Aucun train à afficher</span>';
      return;
    }
    legendEl.innerHTML = items.map(it =>
      `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text)">
        <div style="width:14px;height:3px;background:${it.color};border-radius:1px"></div>
        <span>${it.name}</span>
      </div>`
    ).join('');
  }

  toSave() {
    return {
      records: this.records.slice(-this.maxRecords),
      colorMap: this._colorMap,
      colorIdx: this._colorIdx,
      stationAId: this.stationAId,
      stationBId: this.stationBId,
      mode: this.mode,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.records = s.records || [];
    this._colorMap = s.colorMap || {};
    this._colorIdx = s.colorIdx || 0;
    this.stationAId = s.stationAId || null;
    this.stationBId = s.stationBId || null;
    this.mode = s.mode || 'theoretical';
  }
}
