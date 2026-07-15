/**
 * Graphique de Marche — JTTrainGraph-style time-distance diagram.
 * Select station A and station B to see theoretical (from schedules)
 * and live (real-time) train paths between those stations.
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
      // Record position + current stop info for live plotting
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

    // Gather all stations used in services
    const allStations = this._getServiceStations(game);
    // Also add all world stations if no services yet
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
        <h3>Graphique de Marche</h3>
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
          <button id="gm-clear" class="btn-sm" style="font-size:9px;background:#334155;margin-left:auto">Effacer live</button>
        </div>
        <canvas id="gm-canvas" width="900" height="450" style="width:100%;max-width:100%;height:auto;border-radius:6px"></canvas>
      </div>
      <div class="dash-section">
        <h3>Légende</h3>
        <div id="gm-legend" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
    `;

    // Restore selections
    const selA = document.getElementById('gm-station-a');
    const selB = document.getElementById('gm-station-b');
    if (this.stationAId) selA.value = this.stationAId;
    if (this.stationBId) selB.value = this.stationBId;

    // Mode buttons
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

  _draw(game) {
    const canvas = document.getElementById('gm-canvas');
    if (!canvas) return;

    // BUG-11 / responsive : adapter le canevas au DPR et à la taille CSS
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = styleW, H = styleH;
    const pad = { top: 20, right: 30, bottom: 35, left: 80 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (!this.stationAId || !this.stationBId) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sélectionnez une Gare A et une Gare B pour afficher le graphique.', W / 2, H / 2);
      this._drawLegend([]);
      return;
    }

    if (this.stationAId === this.stationBId) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Les gares A et B doivent être différentes.', W / 2, H / 2);
      this._drawLegend([]);
      return;
    }

    const matches = this._findServicesThrough(game, this.stationAId, this.stationBId);
    if (matches.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucun service ne relie ces deux gares.', W / 2, H / 2);
      this._drawLegend([]);
      return;
    }

    // Build station list from first match (longest path)
    const ref = matches.reduce((best, m) => Math.abs(m.idxB - m.idxA) > Math.abs(best.idxB - best.idxA) ? m : best, matches[0]);
    const refStops = this._getStationsBetween(ref.svc, ref.idxA, ref.idxB);
    const refDists = this._calcDistances(refStops, game, ref.svc);
    const totalDist = refDists[refDists.length - 1] || 1;

    // Station labels on Y axis
    const stationNames = refStops.map(s => {
      const st = game.world.getStationById(s.stationId);
      return st ? st.name : '?';
    });

    // GM-03 — Axe 24h fixe (jTrainGraph)
    const minTime = 0, maxTime = 1440, timeRange = 1440;

    // Draw grid — Y axis (stations)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < refStops.length; i++) {
      const y = pad.top + (refDists[i] / totalDist) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      // Station name
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      const name = stationNames[i].length > 12 ? stationNames[i].substring(0, 11) + '…' : stationNames[i];
      ctx.fillText(name, pad.left - 4, y + 3);
    }

    // Draw grid — X axis (time, every 30 min) over 24h
    for (let h = 0; h <= 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const t = h * 60 + m;
        if (t > 1440) continue;
        const x = pad.left + (t / 1440) * chartW;
        ctx.strokeStyle = m === 0 ? '#1e293b' : 'rgba(30,41,59,0.5)';
        ctx.lineWidth = m === 0 ? 0.8 : 0.3;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, H - pad.bottom);
        ctx.stroke();
        if (m === 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${String(h).padStart(2, '0')}:00`, x, H - 8);
        }
      }
    }

    // Axis border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left, pad.top, chartW, chartH);

    const legendItems = [];

    if (this.mode === 'theoretical') {
      // Draw theoretical sillons from schedule times
      for (const m of matches) {
        const start = Math.min(m.idxA, m.idxB);
        const end = Math.max(m.idxA, m.idxB);
        const color = this._getSvcColor(m.svc.id);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        for (let i = start; i <= end; i++) {
          const stop = m.svc.stops[i];
          // Find this station in our ref list
          const refIdx = refStops.findIndex(rs => rs.stationId === stop.stationId);
          if (refIdx < 0) continue;
          const dist = refDists[refIdx];
          const y = pad.top + (dist / totalDist) * chartH;

          const arr = stop.arrivalTime ?? stop.departureTime ?? 0;
          const dep = stop.departureTime ?? arr;

          // Arrival point
          const xArr = pad.left + (arr / 1440) * chartW;
          if (!started) { ctx.moveTo(xArr, y); started = true; }
          else ctx.lineTo(xArr, y);

          // If dwell time (arr != dep), draw horizontal line
          if (dep !== arr) {
            const xDep = pad.left + (dep / 1440) * chartW;
            ctx.lineTo(xDep, y);
          }
        }
        ctx.stroke();

        // Station dots
        for (let i = start; i <= end; i++) {
          const stop = m.svc.stops[i];
          const refIdx = refStops.findIndex(rs => rs.stationId === stop.stationId);
          if (refIdx < 0) continue;
          const dist = refDists[refIdx];
          const y = pad.top + (dist / totalDist) * chartH;
          const dep = stop.departureTime ?? stop.arrivalTime ?? 0;
          const x = pad.left + (dep / 1440) * chartW;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // GM-03 — labels train/heure aux extrémités
        const firstStop = m.svc.stops[start];
        const lastStop = m.svc.stops[end];
        const firstRef = refStops.findIndex(rs => rs.stationId === firstStop.stationId);
        const lastRef = refStops.findIndex(rs => rs.stationId === lastStop.stationId);
        if (firstRef >= 0 && lastRef >= 0) {
          const y0 = pad.top + (refDists[firstRef] / totalDist) * chartH;
          const y1 = pad.top + (refDists[lastRef] / totalDist) * chartH;
          const t0 = firstStop.departureTime ?? firstStop.arrivalTime ?? 0;
          const t1 = lastStop.arrivalTime ?? lastStop.departureTime ?? 0;
          const x0 = pad.left + (t0 / 1440) * chartW;
          const x1 = pad.left + (t1 / 1440) * chartW;
          ctx.fillStyle = color;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${m.svc.name}`, x0 + 4, y0 - 4);
          ctx.textAlign = 'right';
          ctx.fillText(`${m.svc.name}`, x1 - 4, y1 - 4);
        }

        legendItems.push({ name: m.svc.name, color });
      }
    } else {
      // Live mode — plot recorded positions for services passing through A-B
      const serviceIds = new Set(matches.map(m => m.svc.id));
      const byService = {};
      for (const r of this.records) {
        if (!serviceIds.has(r.serviceId)) continue;
        if (!byService[r.serviceId]) byService[r.serviceId] = [];
        byService[r.serviceId].push(r);
      }

      // For each service, interpolate position to distance along route
      for (const m of matches) {
        const recs = byService[m.svc.id];
        if (!recs || recs.length < 2) continue;
        const start = Math.min(m.idxA, m.idxB);
        const end = Math.max(m.idxA, m.idxB);
        // Build station coords for distance interpolation
        const routeCoords = [];
        for (let i = start; i <= end; i++) {
          const st = game.world.getStationById(m.svc.stops[i].stationId);
          const refIdx = refStops.findIndex(rs => rs.stationId === m.svc.stops[i].stationId);
          if (st && refIdx >= 0) routeCoords.push({ lat: st.lat, lon: st.lon, dist: refDists[refIdx] });
        }

        const color = this._getSvcColor(m.svc.id);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        let started = false;
        for (const r of recs) {
          if (r.lat == null || r.lon == null) continue;
          if (r.time < minTime || r.time > maxTime) continue;
          // Find closest segment and interpolate distance
          const dist = this._interpolateDist(r.lat, r.lon, routeCoords);
          if (dist === null) continue;
          const x = pad.left + ((r.time - minTime) / timeRange) * chartW;
          const y = pad.top + (dist / totalDist) * chartH;
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        legendItems.push({ name: m.svc.name + ' (live)', color });
      }

      if (legendItems.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('En attente de données live... Les trains en circulation apparaîtront ici.', W / 2, H / 2);
      }
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Temps', W / 2, H - 1);
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Gares (distance)', 0, 0);
    ctx.restore();

    this._drawLegend(legendItems);
  }

  _interpolateDist(lat, lon, routeCoords) {
    if (routeCoords.length < 2) return null;
    let bestDist = Infinity, bestVal = null;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i], b = routeCoords[i + 1];
      // Project point onto segment a-b
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
      `<div style="display:flex;align-items:center;gap:4px;font-size:11px">
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
