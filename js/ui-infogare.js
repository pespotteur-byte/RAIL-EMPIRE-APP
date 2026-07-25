import { haversineDistance } from './simulation.js?v=1785016545';
import { incrementTrailingNumber } from './schedule-logic.js?v=1785016545';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1785016545';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS } from './ui-constants.js?v=1785016545';

/* Infogare v2 — clean, modern departure/arrival boards rebuilt from scratch. */

const IG_FONT = "'Arial','Helvetica',sans-serif";
const IG_MONO = "'Courier New','Lucida Console',monospace";

export const UIInfogare = {
  renderInfogarePage() {
    const sel = document.getElementById('infogare-station');
    if (!sel) return;
    const stations = this.game.world.stations.filter(s => !s.closed);
    sel.innerHTML = stations.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
    this._infogarePage = 0;
    const btn = document.getElementById('btn-infogare-show');
    if (btn) btn.onclick = () => { this._infogarePage = 0; this._showInfogareBoard(); };
  },

  _getInfogareTrains(stationId, mode) {
    const services = this.game.scheduleCreator?.services || [];
    const pt = this.game.engine.getParisTime();
    const now = pt.hours * 60 + pt.minutes;
    const results = [];

    for (const svc of services) {
      if (!svc.active) continue;
      const stops = svc.getCurrentStops();
      if (!stops || stops.length === 0) continue;

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (stop.stationId !== stationId) continue;
        if (stop.type === 'waypoint' || stop.type === 'passage') continue;

        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const depTime = stop.departureTime;
        const arrTime = stop.arrivalTime;

        const lastStop = stops[stops.length - 1];
        const destStation = this.game.world.getStationById(lastStop.stationId);
        const firstStop = stops[0];
        const origStation = this.game.world.getStationById(firstStop.stationId);

        const servedStations = [];
        for (let j = i + 1; j < stops.length; j++) {
          if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
          const st = this.game.world.getStationById(stops[j].stationId);
          if (st) servedStations.push(st.name);
        }

        const fromStations = [];
        for (let j = 0; j < i; j++) {
          if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
          const st = this.game.world.getStationById(stops[j].stationId);
          if (st) fromStations.push(st.name);
        }

        const nextStops = [];
        for (let j = i + 1; j < stops.length; j++) {
          if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
          const st = this.game.world.getStationById(stops[j].stationId);
          if (st) nextStops.push({ name: st.name, time: stops[j].arrivalTime });
        }

        let waitMin = null;
        if (!isLast && depTime != null) {
          waitMin = depTime - now;
          if (waitMin < 0) waitMin += 1440;
        }
        if (!isFirst && arrTime != null) {
          waitMin = arrTime - now;
          if (waitMin < 0) waitMin += 1440;
        }

        const station = this.game.world.getStationById(stationId);
        const lineIds = station?.lineIds || [];
        const line = lineIds.length > 0 ? this.game.lineManager.getLine(lineIds[0]) : null;

        const delay = Math.round(Number.isFinite(svc.delay) ? svc.delay : 0);
        const isCancelled = svc.cancelled || svc.state === 'cancelled';
        const totalPax = svc.rame?.totalCapacity || 0;
        const onboardPax = svc._onboardPax || 0;
        const totalFrt = svc.rame?.totalFreightCapacity || 0;
        const onboardFrt = svc._onboardFreight || 0;
        const isFull = totalPax > 0 && onboardPax >= totalPax * 0.9;
        const isFreightFull = totalFrt > 0 && onboardFrt >= totalFrt * 0.9;

        results.push({
          svcId: svc.id,
          name: svc.name,
          trainNumber: svc.train?.number || '',
          seriesName: svc.train?.seriesName || '',
          destination: destStation?.name || '?',
          origin: origStation?.name || '?',
          depTime, arrTime, waitMin,
          isDeparture: !isLast, isArrival: !isFirst, isFirst, isLast,
          servedStations, fromStations, nextStops,
          delay, isCancelled, isFull, isFreightFull,
          line, lineCode: line?.code || '', lineName: line?.name || '', lineColor: line?.color || '#3b82f6',
          voie: stop.platform || svc.train?.platform || String(i + 1),
          state: svc.state,
          speed: svc.speed || 0,
          rame: svc.rame,
        });
      }
    }

    const wrap = t => ((t % 1440) + 1440) % 1440;
    if (mode === 'sncf-arr' || mode === 'afl-arrivee' || mode === 'cati-ar') {
      return results.filter(r => r.isArrival && r.arrTime != null)
        .map(r => ({ ...r, waitMin: wrap(r.arrTime - now) }))
        .filter(r => r.waitMin <= 1440)
        .sort((a, b) => a.waitMin - b.waitMin);
    }
    return results.filter(r => r.isDeparture && r.waitMin != null && r.waitMin <= 1440)
      .sort((a, b) => a.waitMin - b.waitMin);
  },

  _fmtTime(min) {
    if (min == null || isNaN(min)) return '--h--';
    const m = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mn = Math.round(m % 60);
    return `${h}h${mn.toString().padStart(2, '0')}`;
  },

  _fmtWait(min) {
    if (min == null) return '';
    if (min <= 0) return "à l'approche";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`;
  },

  _fmtDelay(min) {
    if (min == null || min <= 0) return "à l'heure";
    if (min < 60) return `retard ${Math.round(min)} min.`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `retard ${h}h${m.toString().padStart(2, '0')}` : `retard ${h}h`;
  },

  _showInfogareBoard() {
    const stationId = document.getElementById('infogare-station')?.value;
    const displayType = document.getElementById('infogare-display')?.value;
    if (!stationId) return;
    const station = this.game.world.getStationById(stationId);
    const trains = this._getInfogareTrains(stationId, displayType);
    const board = document.getElementById('infogare-board');
    if (!board) return;

    const pt = this.game.engine.getParisTime();
    const nowStr = `${pt.hours.toString().padStart(2, '0')}:${pt.minutes.toString().padStart(2, '0')}`;

    switch (displayType) {
      case 'sncf-dep': board.innerHTML = this._renderSNCFDepartures(station, trains, nowStr); break;
      case 'sncf-arr': board.innerHTML = this._renderSNCFArrivals(station, trains, nowStr); break;
      case 'cati-ar': board.innerHTML = this._renderCATIAr(station, trains, nowStr); break;
      case 'cati-3-3': board.innerHTML = this._renderCATI33(station, trains, nowStr); break;
      case 'cati-complet': board.innerHTML = this._renderCATIComplet(station, trains, nowStr); break;
      case 'afl-depart': board.innerHTML = this._renderAFLDepart(station, trains, nowStr); break;
      case 'afl-arrivee': board.innerHTML = this._renderAFLArrivee(station, trains, nowStr); break;
      case 'rer-ratp': board.innerHTML = this._renderRER(station, trains, nowStr, 'ratp'); break;
      case 'rer-sncf': board.innerHTML = this._renderRER(station, trains, nowStr, 'sncf'); break;
      case 'old-sncf': board.innerHTML = this._renderSolari(station, trains, nowStr); break;
      case 'ecran-quai': board.innerHTML = this._renderEcranQuai(station, trains, nowStr); break;
      case 'flash-circulation': board.innerHTML = this._renderFlashCirculation(station, nowStr); break;
      default: board.innerHTML = this._renderSNCFDepartures(station, trains, nowStr);
    }

    board.querySelectorAll('[data-svc-id]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this._showPlatformDisplay(el.dataset.svcId, stationId));
    });

    this._startInfogareClock(board);
  },

  _startInfogareClock(board) {
    if (this._infogareClockInterval) clearInterval(this._infogareClockInterval);
    const tick = () => {
      if (this.activePage !== 'infogare') { clearInterval(this._infogareClockInterval); return; }
      const pt = this.game.engine.getParisTime();
      const nowStr = `${pt.hours.toString().padStart(2, '0')}:${pt.minutes.toString().padStart(2, '0')}`;
      board?.querySelectorAll('.ig2-clock').forEach(el => el.textContent = nowStr);
    };
    tick();
    this._infogareClockInterval = setInterval(tick, 1000);
  },

  _header(station, nowStr, extra = '') {
    return `<div class="ig2-header" style="display:flex;align-items:center;background:#fff;color:#000;padding:8px 14px;gap:10px;border-bottom:3px solid #c00;">
      <span style="color:#c00;font-weight:900;font-style:italic;font-size:18px;font-family:${IG_FONT};">SNCF</span>
      <span style="flex:1;text-align:center;font-weight:700;font-size:18px;letter-spacing:1px;text-transform:uppercase;font-family:${IG_FONT};">${escapeHtml(station?.name || '')}</span>
      <span class="ig2-clock" style="font-family:${IG_MONO};font-size:22px;font-weight:700;color:#000;">${nowStr}</span>
    </div>${extra}`;
  },

  _statusBadge(t) {
    if (t.isCancelled) return `<span style="background:#c00;color:#fff;padding:2px 8px;border-radius:3px;font-weight:700;font-size:12px;">SUPPRIMÉ</span>`;
    if (t.isFull || t.isFreightFull) return `<span style="background:#facc15;color:#000;padding:2px 8px;border-radius:3px;font-weight:700;font-size:12px;">COMPLET</span>`;
    if (t.delay > 0) return `<span style="color:#facc15;font-weight:700;font-size:12px;">RETARD ${Math.round(t.delay)} MIN</span>`;
    return `<span style="color:#4ade80;font-weight:700;font-size:12px;">À L'HEURE</span>`;
  },

  _trainType(t) {
    const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
    const type = (m && !/^\d+$/.test(m[1])) ? m[1] : (t.seriesName || 'TER');
    const num = (m && !/^\d+$/.test(m[1])) ? m[2].trim() : (t.trainNumber || t.name);
    return { type: type.trim().toUpperCase(), num: (num || '').trim() };
  },

  _rowClick(svcId, content) {
    return `<div data-svc-id="${escapeHtml(svcId)}" style="cursor:pointer;">${content}</div>`;
  },

  _renderSNCFDepartures(station, trains, nowStr) {
    const rows = trains.slice(0, 12).map(t => {
      const { type, num } = this._trainType(t);
      const via = t.servedStations.slice(0, 6).join(' • ');
      return this._rowClick(t.svcId, `<div style="display:grid;grid-template-columns:90px 90px 1fr 90px 120px;align-items:center;padding:12px 14px;border-bottom:1px solid #1a2e4a;background:#0a1628;color:#fff;font-family:${IG_FONT};gap:8px;" onmouseover="this.style.background='#12223a'" onmouseout="this.style.background='#0a1628'">
        <span style="font-family:${IG_MONO};font-size:22px;font-weight:700;color:#facc15;">${this._fmtTime(t.depTime)}</span>
        <span style="display:flex;flex-direction:column;gap:2px;"><span style="font-weight:900;font-size:18px;color:#fff;">${type}</span><span style="font-size:12px;color:#93c5fd;">${num}</span></span>
        <span style="display:flex;flex-direction:column;gap:3px;"><span style="font-weight:700;font-size:18px;text-transform:uppercase;">${t.destination}</span>${via ? `<span style="font-size:11px;color:#94a3b8;">via ${via}</span>` : ''}</span>
        <span style="display:flex;align-items:center;justify-content:center;background:#f59e0b;color:#000;font-weight:900;font-size:20px;width:42px;height:36px;border-radius:4px;margin:auto;">${t.voie || '—'}</span>
        <span style="text-align:right;">${this._statusBadge(t)}</span>
      </div>`);
    }).join('');

    const head = `<div style="display:grid;grid-template-columns:90px 90px 1fr 90px 120px;align-items:center;padding:10px 14px;background:#0d3a8f;color:#fff;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:1px;gap:8px;">
      <span>Heure</span><span>Train</span><span>Destination</span><span style="text-align:center;">Voie</span><span style="text-align:right;">Infos</span>
    </div>`;

    return `<div style="background:#0a1628;border:2px solid #1e3a5f;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;">
      ${this._header(station, nowStr)}
      ${head}
      ${rows || '<div style="padding:24px;text-align:center;color:#94a3b8;font-family:'+IG_FONT+'">Aucun départ prévu</div>'}
    </div>`;
  },

  _renderSNCFArrivals(station, trains, nowStr) {
    const rows = trains.slice(0, 12).map(t => {
      const { type, num } = this._trainType(t);
      const via = t.fromStations.slice(0, 6).join(' • ');
      return this._rowClick(t.svcId, `<div style="display:grid;grid-template-columns:90px 90px 1fr 90px 120px;align-items:center;padding:12px 14px;border-bottom:1px solid #1a3a2a;background:#0b2e12;color:#fff;font-family:${IG_FONT};gap:8px;" onmouseover="this.style.background='#123d1a'" onmouseout="this.style.background='#0b2e12'">
        <span style="font-family:${IG_MONO};font-size:22px;font-weight:700;color:#4ade80;">${this._fmtTime(t.arrTime)}</span>
        <span style="display:flex;flex-direction:column;gap:2px;"><span style="font-weight:900;font-size:18px;">${type}</span><span style="font-size:12px;color:#86efac;">${num}</span></span>
        <span style="display:flex;flex-direction:column;gap:3px;"><span style="font-weight:700;font-size:18px;text-transform:uppercase;">${t.origin}</span>${via ? `<span style="font-size:11px;color:#86efac;">depuis ${via}</span>` : ''}</span>
        <span style="display:flex;align-items:center;justify-content:center;background:#22c55e;color:#000;font-weight:900;font-size:20px;width:42px;height:36px;border-radius:4px;margin:auto;">${t.voie || '—'}</span>
        <span style="text-align:right;">${this._statusBadge(t)}</span>
      </div>`);
    }).join('');

    const head = `<div style="display:grid;grid-template-columns:90px 90px 1fr 90px 120px;align-items:center;padding:10px 14px;background:#14522d;color:#fff;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:1px;gap:8px;">
      <span>Heure</span><span>Train</span><span>Provenance</span><span style="text-align:center;">Voie</span><span style="text-align:right;">Infos</span>
    </div>`;

    return `<div style="background:#0b2e12;border:2px solid #14522d;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;">
      ${this._header(station, nowStr)}
      ${head}
      ${rows || '<div style="padding:24px;text-align:center;color:#86efac;font-family:'+IG_FONT+'">Aucune arrivée prévue</div>'}
    </div>`;
  },

  _renderCATIComplet(station, trains, nowStr) {
    const deps = trains.filter(r => r.isDeparture).slice(0, 16);
    const rows = deps.map(t => {
      const { type, num } = this._trainType(t);
      return this._rowClick(t.svcId, `<div style="display:grid;grid-template-columns:70px 70px 1fr 80px;align-items:center;padding:10px 12px;border-bottom:1px solid #1e3a5f;background:#0a1428;color:#fff;font-family:${IG_FONT};gap:8px;">
        <span style="font-family:${IG_MONO};font-size:20px;font-weight:700;color:#facc15;">${this._fmtTime(t.depTime)}</span>
        <span style="font-weight:900;font-size:16px;">${type}</span>
        <span style="font-weight:700;font-size:16px;text-transform:uppercase;">${t.destination}</span>
        <span style="text-align:right;">${this._statusBadge(t)}</span>
      </div>`);
    }).join('');

    return `<div style="background:#0a1428;border:2px solid #0d3a8f;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;background:#0d3a8f;color:#fff;padding:10px 14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
        <span>${escapeHtml(station?.name || '')}</span>
        <span>Départs — Affichage complet</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};">${nowStr}</span>
      </div>
      ${rows || '<div style="padding:24px;text-align:center;color:#94a3b8;">Aucun départ</div>'}
      <div style="padding:6px 14px;background:#0d3a8f;color:#aac;font-size:10px;display:flex;justify-content:space-between;"><span>24h • Toutes destinations</span><span class="ig2-clock">${nowStr}</span></div>
    </div>`;
  },

  _renderCATIAr(station, trains, nowStr) {
    const arrs = trains.filter(r => r.isArrival).slice(0, 16);
    const rows = arrs.map(t => {
      const { type, num } = this._trainType(t);
      const via = t.fromStations.slice(0, 4).join(' • ');
      return this._rowClick(t.svcId, `<div style="display:grid;grid-template-columns:70px 80px 1fr 100px;align-items:center;padding:10px 12px;border-bottom:1px solid #1a3a2a;background:#0b2e12;color:#fff;font-family:${IG_FONT};gap:8px;">
        <span style="font-family:${IG_MONO};font-size:20px;font-weight:700;color:#4ade80;">${this._fmtTime(t.arrTime)}</span>
        <span style="font-weight:900;font-size:16px;">${type}</span>
        <span style="display:flex;flex-direction:column;gap:2px;"><span style="font-weight:700;font-size:16px;text-transform:uppercase;">${t.origin}</span>${via ? `<span style="font-size:10px;color:#86efac;">depuis ${via}</span>` : ''}</span>
        <span style="text-align:right;">${this._statusBadge(t)}</span>
      </div>`);
    }).join('');

    return `<div style="background:#0b2e12;border:2px solid #14522d;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;background:#14522d;color:#fff;padding:10px 14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
        <span>${escapeHtml(station?.name || '')}</span>
        <span>Arrivées — Affichage complet</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};">${nowStr}</span>
      </div>
      ${rows || '<div style="padding:24px;text-align:center;color:#86efac;">Aucune arrivée</div>'}
    </div>`;
  },

  _renderCATI33(station, trains, nowStr) {
    const deps = trains.filter(r => r.isDeparture).slice(0, 6);
    const mid = Math.ceil(deps.length / 2);
    const left = deps.slice(0, mid);
    const right = deps.slice(mid);

    const cell = t => {
      if (!t) return '<div style="padding:14px;color:#5577aa;text-align:center;">—</div>';
      const stops = t.servedStations.slice(0, 2).join(' ');
      return this._rowClick(t.svcId, `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #1e3a5f;background:#0a1428;color:#fff;" onmouseover="this.style.background='#12223a'" onmouseout="this.style.background='#0a1428'">
        <span style="font-family:${IG_MONO};font-size:22px;font-weight:700;color:#facc15;">${this._fmtTime(t.depTime)}</span>
        <span style="flex:1;display:flex;flex-direction:column;gap:2px;">
          <span style="font-weight:700;font-size:15px;text-transform:uppercase;">${t.destination}</span>
          ${stops ? `<span style="font-size:10px;color:#94a3b8;">${stops}</span>` : ''}
        </span>
      </div>`);
    };

    const col = items => `<div style="flex:1;min-width:280px;border-right:1px solid #1e3a5f;">${items.map(cell).join('')}</div>`;
    const first = deps[0];
    const top = first ? `${this._fmtTime(first.depTime)} ${first.destination}` : 'Aucun train';

    return `<div style="background:#0a1428;border:2px solid #0d3a8f;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;background:#0d3a8f;color:#fff;padding:10px 14px;">
        <span style="font-weight:700;">${escapeHtml(station?.name || '')}</span>
        <span style="font-weight:700;text-transform:uppercase;letter-spacing:1px;">${top}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};">${nowStr}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;">${col(left)}${col(right)}</div>
      <div style="padding:6px 14px;background:#0d3a8f;color:#aac;font-size:10px;display:flex;justify-content:space-between;"><span>CATI 3-3 • Départs</span><span class="ig2-clock">${nowStr}</span></div>
    </div>`;
  },

  _renderAFLDepart(station, trains, nowStr) {
    const t = trains.filter(r => r.isDeparture)[this._infogarePage || 0] || trains.find(r => r.isDeparture);
    if (!t) return `<div style="background:#1a1a2e;color:#facc15;border:4px solid #facc15;padding:30px;text-align:center;font-family:${IG_FONT};"><div style="font-size:24px;font-weight:700;">${escapeHtml(station?.name || '')}</div><div style="margin-top:20px;font-size:20px;">Aucun départ prévu</div></div>`;
    const { type, num } = this._trainType(t);
    const via = t.servedStations?.slice(0, 5).join(' – ') || '';
    const badge = this._statusBadge(t);
    return `<div style="background:#1a1a2e;color:#facc15;border:4px solid #facc15;padding:30px;text-align:center;font-family:${IG_FONT};">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:10px;margin-bottom:20px;">
        <span style="font-size:18px;font-weight:700;">${escapeHtml(station?.name || '')}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-size:26px;font-weight:700;">${nowStr}</span>
      </div>
      <div style="text-transform:uppercase;letter-spacing:4px;font-size:16px;margin-bottom:12px;">Prochain départ</div>
      <div style="font-size:48px;font-weight:900;text-transform:uppercase;margin:16px 0;">${t.destination}</div>
      ${via ? `<div style="font-size:18px;margin-bottom:18px;">via ${via}</div>` : ''}
      <div style="font-size:28px;font-weight:700;margin-bottom:12px;">${this._fmtTime(t.depTime)} — ${type} ${num}</div>
      <div style="display:flex;justify-content:center;align-items:center;gap:24px;margin-top:20px;">
        <span style="display:flex;align-items:center;justify-content:center;background:#f59e0b;color:#000;font-weight:900;font-size:32px;width:70px;height:56px;border-radius:6px;">V ${t.voie || '—'}</span>
        ${badge}
      </div>
    </div>`;
  },

  _renderAFLArrivee(station, trains, nowStr) {
    const t = trains.filter(r => r.isArrival)[this._infogarePage || 0] || trains.find(r => r.isArrival);
    if (!t) return `<div style="background:#1a1a2e;color:#4ade80;border:4px solid #4ade80;padding:30px;text-align:center;font-family:${IG_FONT};"><div style="font-size:24px;font-weight:700;">${escapeHtml(station?.name || '')}</div><div style="margin-top:20px;font-size:20px;">Aucune arrivée prévue</div></div>`;
    const { type, num } = this._trainType(t);
    const from = t.fromStations?.slice(-4).join(' – ') || '';
    const status = t.state === 'stopped_at_station' && t.isLast ? 'Arrivé' : `dans ${this._fmtWait(t.waitMin) || '—'}`;
    return `<div style="background:#1a1a2e;color:#4ade80;border:4px solid #4ade80;padding:30px;text-align:center;font-family:${IG_FONT};">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:10px;margin-bottom:20px;">
        <span style="font-size:18px;font-weight:700;">${escapeHtml(station?.name || '')}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-size:26px;font-weight:700;">${nowStr}</span>
      </div>
      <div style="text-transform:uppercase;letter-spacing:4px;font-size:16px;margin-bottom:12px;">Prochaine arrivée</div>
      <div style="font-size:48px;font-weight:900;text-transform:uppercase;margin:16px 0;">${t.origin}</div>
      ${from ? `<div style="font-size:18px;margin-bottom:18px;">depuis ${from}</div>` : ''}
      <div style="font-size:28px;font-weight:700;margin-bottom:12px;">${this._fmtTime(t.arrTime)} — ${type} ${num}</div>
      <div style="font-size:22px;margin-top:16px;">${status}</div>
      <div style="display:flex;justify-content:center;margin-top:18px;"><span style="display:flex;align-items:center;justify-content:center;background:#22c55e;color:#000;font-weight:900;font-size:32px;width:70px;height:56px;border-radius:6px;">V ${t.voie || '—'}</span></div>
    </div>`;
  },

  _renderRER(station, trains, nowStr, flavor) {
    const isRatp = flavor === 'ratp';
    const bg = isRatp ? '#c8c8d0' : '#1c2240';
    const rowBg = isRatp ? '#c8c8d0' : '#1c2240';
    const rowAlt = isRatp ? '#d8d8e0' : '#252b4a';
    const text = isRatp ? '#000' : '#fff';
    const waitBox = isRatp ? '#1a1a2e' : '#1a1a2e';
    const waitCol = isRatp ? '#fbbf24' : '#fbbf24';
    const headerBg = isRatp ? '#003DA5' : '#003DA5';

    const dests = [...new Set(trains.map(t => t.destination))].slice(0, 4).join(' • ');
    const lineCode = trains[0]?.lineCode || 'A';
    const lineColor = trains[0]?.lineColor || '#003DA5';

    const rows = trains.slice(0, 10).map(t => {
      const { type, num } = this._trainType(t);
      let waitHtml;
      if (t.waitMin != null && t.waitMin <= 1) {
        waitHtml = `<span style="background:#1a1a2e;color:#fff;padding:4px 10px;font-size:14px;font-weight:700;">à l'approche</span>`;
      } else if (t.waitMin != null && t.waitMin < 60) {
        waitHtml = `<span style="background:${waitBox};color:${waitCol};padding:2px 8px;font-size:20px;font-weight:700;">${Math.round(t.waitMin)}</span><span style="color:#888;font-size:10px;">min</span>`;
      } else if (t.waitMin != null) {
        const h = Math.floor(t.waitMin / 60);
        const m = Math.round(t.waitMin % 60);
        waitHtml = `<span style="background:${waitBox};color:${waitCol};padding:2px 8px;font-size:20px;font-weight:700;">${h}h${m.toString().padStart(2, '0')}</span>`;
      } else waitHtml = '';
      return this._rowClick(t.svcId, `<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid ${isRatp ? '#b0b0b8' : '#334155'};background:${rowBg};color:${text};font-family:${IG_FONT};" onmouseover="this.style.background='${rowAlt}'" onmouseout="this.style.background='${rowBg}'">
        <span style="font-weight:900;font-size:20px;min-width:50px;">${type}</span>
        <span style="flex:1;font-weight:700;font-size:18px;">${t.destination}</span>
        <span style="display:flex;align-items:center;gap:3px;min-width:120px;justify-content:flex-end;">${waitHtml}</span>
        <span style="margin-left:8px;font-weight:700;color:${isRatp ? '#c00' : '#f59e0b'};">${t.voie || ''}</span>
      </div>`);
    }).join('');

    return `<div style="background:${bg};border:3px solid ${isRatp ? '#333' : '#1e3a5f'};border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_FONT};">
      <div style="display:flex;align-items:center;padding:10px 14px;background:${headerBg};color:#fff;gap:10px;">
        <span style="border:2px solid #fff;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700;">${isRatp ? 'RER' : 'RER'}</span>
        <span style="background:${lineColor};color:#fff;font-weight:900;font-size:20px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${lineCode}</span>
        <span style="flex:1;font-size:14px;line-height:1.3;">${dests}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-size:22px;font-weight:700;">${nowStr}</span>
      </div>
      <div style="max-height:70vh;overflow-y:auto;">${rows || `<div style="padding:24px;text-align:center;color:${isRatp ? '#555' : '#94a3b8'};">Aucun train prévu</div>`}</div>
      <div style="padding:8px 14px;background:${headerBg};color:#fff;font-size:11px;display:flex;align-items:center;gap:8px;">
        <span style="background:#c00;color:#fff;font-weight:900;width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;">${lineCode}</span>
        <span>Pas de perturbation signalée sur cette ligne.</span>
      </div>
    </div>`;
  },

  _renderSolari(station, trains, nowStr) {
    const rows = trains.slice(0, 22).map(t => {
      const { type, num } = this._trainType(t);
      const dest = t.destination.toUpperCase();
      const served = t.servedStations.join('  ').toUpperCase();
      const destFull = `${dest}${served ? '  ' + served : ''}`;
      let remark = (t.seriesName || 'TER').toUpperCase();
      if (t.isCancelled) remark = 'SUPP';
      else if (t.isFull || t.isFreightFull) remark = 'PLEIN';
      else if (t.delay > 0) remark = `RET ${Math.round(t.delay)}M`;
      return `<div data-svc-id="${t.svcId}" style="display:grid;grid-template-columns:70px 1fr 90px 70px 50px;align-items:center;padding:8px 14px;border-bottom:1px solid #333;background:#0a0a0a;color:#ccbb33;font-family:${IG_MONO};font-size:14px;cursor:pointer;" onmouseover="this.style.background='#141414'" onmouseout="this.style.background='#0a0a0a'">
        <span>${this._fmtTime(t.depTime).replace('h', '.')}</span>
        <span style="font-weight:700;">${destFull}</span>
        <span>${remark}</span>
        <span>${num}</span>
        <span style="text-align:center;background:#ccbb33;color:#000;font-weight:900;">${t.voie || ''}</span>
      </div>`;
    }).join('');

    return `<div style="background:#0a0a0a;border:6px solid #444;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_MONO};">
      <div style="display:flex;justify-content:space-around;padding:14px 24px;background:#2a3d6d;color:#fff;font-size:22px;font-weight:900;letter-spacing:6px;text-transform:uppercase;border-bottom:2px solid #1a2a4a;">
        <span>DEPART</span><span>DEPARTURE</span><span>ABFAHRT</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 24px 8px;background:#2a3d6d;color:#8899bb;font-size:10px;font-style:italic;border-bottom:3px solid #1a2a4a;">
        <span>Trains au départ</span><span>Departing trains</span><span>Abfahrt der Züge</span>
      </div>
      <div style="display:grid;grid-template-columns:70px 1fr 90px 70px 50px;padding:4px 16px;color:#555;font-size:8px;letter-spacing:1px;text-transform:lowercase;">
        <span>heure</span><span>destination - desservant</span><span>remarques</span><span>train n°</span><span>voie</span>
      </div>
      ${rows || '<div style="padding:24px;text-align:center;color:#ccbb33;">AUCUN TRAIN PREVU</div>'}
      <div style="padding:8px 14px;background:#0a0a0a;color:#ccbb33;font-family:${IG_MONO};font-size:18px;text-align:center;">
        <span class="ig2-clock">${nowStr.replace(':', '.')}</span>
      </div>
    </div>`;
  },

  _renderEcranQuai(station, trains, nowStr) {
    const t = trains.filter(r => r.isDeparture)[0];
    if (!t) return `<div style="background:#0b4f9b;color:#fff;min-height:300px;display:flex;align-items:center;justify-content:center;font-size:24px;font-family:${IG_FONT};">Aucun départ prévu</div>`;
    const { type, num } = this._trainType(t);
    const next = (t.nextStops || []).slice(0, 15);
    const msg = t.isCancelled ? 'SUPPRIMÉ' : (t.delay > 0 ? `RETARD ${this._fmtDelay(t.delay).replace(/^retard /i, '')}` : "à l'heure");
    const pt = this.game.engine?.getParisTime?.();
    const clockStr = pt ? `${String(pt.hours).padStart(2,'0')} ${String(pt.minutes).padStart(2,'0')} ${String(pt.seconds).padStart(2,'0')}` : nowStr.replace(':', ' ');

    const stopsRows = next.map((s, i) => {
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:#facc15;font-size:18px;">•</span>
        <span style="font-family:${IG_MONO};font-size:18px;font-weight:700;color:#facc15;">${this._fmtTime(s.time)}</span>
        <span style="font-size:18px;color:#fff;">${s.name}</span>
      </div>`;
    }).join('');

    return `<div style="background:#0b4f9b;color:#fff;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_FONT};">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#0b4f9b;border-bottom:4px solid #fff;">
        <span style="font-size:14px;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(station?.name || '')}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-size:28px;font-weight:700;">${clockStr}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;">
        <div style="flex:1;min-width:320px;background:#f5eef4;color:#000;padding:30px;">
          <div style="font-family:${IG_MONO};font-size:56px;font-weight:700;">${this._fmtTime(t.depTime)}</div>
          <div style="color:#16a34a;font-size:20px;font-weight:700;margin:8px 0;">${msg}</div>
          <div style="font-size:42px;font-weight:900;text-transform:uppercase;line-height:1.1;">${t.destination}</div>
          <div style="font-size:18px;font-weight:700;margin-top:12px;">${type} ${num}</div>
        </div>
        <div style="flex:1.5;min-width:400px;padding:30px;background:#0b4f9b;">
          <div style="font-size:14px;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;color:#93c5fd;">Gares desservies</div>
          ${stopsRows || '<div style="color:#93c5fd;">Terminus</div>'}
        </div>
      </div>
      <div style="padding:10px 20px;background:#0b4f9b;color:#fff;border-top:2px solid rgba(255,255,255,.2);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">ON. LES VOYAGEURS À DESTINATION DE ${t.destination}</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-size:20px;font-weight:700;">${clockStr}</span>
      </div>
    </div>`;
  },

  _renderFlashCirculation(station, nowStr) {
    const im = this.game.incidentManager;
    const bulletins = im?.getBulletins?.() || [];
    const services = this.game.scheduleCreator?.services || [];
    const delayed = services.filter(s => s.active && s.delay >= 15).slice(0, 6);
    const pt = this.game.engine?.getParisTime?.();
    const timeOfDay = pt ? (pt.hours * 60 + pt.minutes) : 0;
    const dateStr = this.game.engine?.currentDate || this.game.engine?.getParisDate?.() || '';
    const works = this.game.worksManager?.getActive?.(dateStr, timeOfDay) || [];

    const items = [];
    for (const b of bulletins) items.push(`${b.name} : ${b.description || 'perturbation en cours'}`);
    for (const d of delayed) items.push(`${d.name} — retard ${Math.round(d.delay)} min`);
    for (const w of works) items.push(`Travaux en cours : ${w.name || w.type || 'chantier'}`);
    const ticker = items.length ? `${items.join('   +++   ')}   +++   ` : 'Circulation normale.';
    const main = items.length ? items.join(' / ') : 'Trafic fluide sur le réseau.';

    return `<div style="background:#fec152;color:#000080;border:3px solid #f59e0b;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_FONT};">
      <div style="background:#0b4f9b;color:#fff;padding:10px 14px;font-size:18px;font-weight:700;">FLASH CIRCULATION</div>
      <div style="padding:18px 20px;font-size:20px;font-weight:700;min-height:80px;display:flex;align-items:center;">${main}</div>
      <div style="background:#0b4f9b;color:#fff;padding:10px 20px;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;position:relative;">
        <span style="display:inline-block;animation:ig2Marquee 20s linear infinite;">${ticker}</span>
      </div>
      <div style="padding:8px 14px;text-align:right;font-family:${IG_MONO};font-size:18px;font-weight:700;">
        <span class="ig2-clock">${nowStr}</span>
      </div>
    </div>`;
  },

  _showPlatformDisplay(svcId, stationId) {
    const svc = this.game.scheduleCreator?.services?.find(s => s.id === svcId);
    if (!svc) return;
    const station = this.game.world.getStationById(stationId);
    const stops = svc.getCurrentStops();
    const pt = this.game.engine.getParisTime();
    const nowStr = `${pt.hours.toString().padStart(2,'0')}:${pt.minutes.toString().padStart(2,'0')}`;
    const stopIdx = stops.findIndex(s => s.stationId === stationId);
    const isGrandeLigne = (svc.rame?.maxSpeed || 0) >= 160;
    const servedAfter = [];
    for (let i = stopIdx + 1; i < stops.length; i++) {
      if (stops[i].type === 'waypoint' || stops[i].type === 'passage') continue;
      const st = this.game.world.getStationById(stops[i].stationId);
      if (st) servedAfter.push({ name: st.name, isLast: i === stops.length - 1 });
    }
    const lastStop = stops[stops.length - 1];
    const destStation = this.game.world.getStationById(lastStop?.stationId);
    const depTime = stops[stopIdx]?.departureTime;
    const delayStr = this._fmtDelay(svc.delay);
    const numCars = svc.rame?.elementDetails?.length || 8;
    const board = document.getElementById('infogare-board');
    if (!board) return;
    board.innerHTML = isGrandeLigne
      ? this._renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars)
      : this._renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
    this._startInfogareClock(board);
    board.querySelector('.ig2-platform-back')?.addEventListener('click', () => this._showInfogareBoard());
  },

  _renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
    const stopsHtml = servedAfter.map(s =>
      `<div style="display:flex;align-items:center;gap:8px;font-size:16px;">
        <span style="color:#a855f7;font-size:18px;">${s.isLast ? '◉' : '●'}</span>
        <span${s.isLast ? ' style="color:#a855f7;font-weight:900;"' : ''}>${s.name}</span>
      </div>`
    ).join('');
    const seriesName = svc.train?.seriesName || svc.rame?.seriesName || '';
    const trainNum = svc.train?.number || svc.name || '';
    let carsHtml = '';
    for (let i = 1; i <= numCars; i++) carsHtml += `<div style="flex:1;min-width:34px;height:34px;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:4px;font-weight:700;border:1px solid #60a5fa;">${i}</div>`;
    const sections = 'ABCDEFGH';
    let sectionsHtml = '';
    const numSections = Math.min(8, Math.ceil(numCars / 2));
    for (let i = 0; i < numSections; i++) sectionsHtml += `<div style="flex:1;text-align:center;font-weight:700;color:#fff;background:#1e40af;border-radius:3px;padding:4px;">${sections[i]}</div>`;

    return `<div style="background:linear-gradient(180deg,#101d45 0%,#162050 40%,#1a2660 100%);color:#fff;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_FONT};position:relative;">
      <div class="ig2-platform-back" style="position:absolute;top:10px;left:10px;z-index:10;cursor:pointer;background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:4px 10px;font-size:12px;">← Retour</div>
      <div style="display:flex;padding:36px 20px 12px;gap:16px;">
        <div style="min-width:200px;">
          <div style="background:#b5006b;color:#fff;font-weight:700;font-size:12px;display:inline-block;padding:3px 12px;border-radius:14px;margin-bottom:8px;">${seriesName}</div>
          <div style="font-family:${IG_MONO};font-size:42px;font-weight:700;">${this._fmtTime(depTime)}</div>
          ${delayStr !== "à l'heure" ? `<div style="color:#facc15;font-weight:700;">${delayStr}</div>` : ''}
          <div style="font-size:28px;font-weight:900;text-transform:uppercase;margin-top:8px;">${destStation?.name || '?'}</div>
          <div style="font-size:14px;color:#93c5fd;margin-top:6px;">${seriesName} ${trainNum}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;color:#93c5fd;text-transform:uppercase;margin-bottom:8px;">Gares desservies</div>
          <div style="display:flex;flex-direction:column;gap:6px;">${stopsHtml || '<div style="color:#7788aa;">Terminus</div>'}</div>
        </div>
      </div>
      <div style="padding:20px;background:#0f1a3a;border-top:1px solid #1e3a5f;">
        <div style="text-align:center;font-size:14px;color:#93c5fd;margin-bottom:10px;">Composition du train — Tête</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${carsHtml}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">${sectionsHtml}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:#0a1230;color:#fff;">
        <span style="font-size:12px;">Information en temps réel</span>
        <span class="ig2-clock" style="font-family:${IG_MONO};font-weight:700;">${nowStr}</span>
        <span style="font-style:italic;font-weight:900;">SNCF</span>
      </div>
    </div>`;
  },

  _renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
    const half = Math.ceil(servedAfter.length / 2);
    const col1 = servedAfter.slice(0, half);
    const col2 = servedAfter.slice(half);
    const col = items => items.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
      <span style="color:#333;font-size:14px;">${s.isLast ? '◉' : '●'}</span>
      <span${s.isLast ? ' style="color:#c00;font-weight:900;"' : ''}>${s.name}</span>
    </div>`).join('');

    const crowdIcons = ['🟢', '🟠', '🔴'];
    let crowdHtml = '';
    for (let i = 0; i < numCars; i++) {
      const lvl = Math.floor(Math.random() * 3);
      crowdHtml += `<div style="flex:1;height:34px;display:flex;align-items:center;justify-content:center;background:${lvl===0?'#22c55e':lvl===1?'#f97316':'#ef4444'};border-radius:4px;color:#fff;font-weight:700;">${crowdIcons[lvl]}</div>`;
    }

    const lineColor = svc.train?.color || '#2d8a4e';
    const lineCode = svc.train?.seriesName?.[0] || '?';
    const pt = this.game.engine.getParisTime();
    const now = pt.hours * 60 + pt.minutes;
    let waitMin = depTime != null ? depTime - now : null;
    if (waitMin != null && waitMin < 0) waitMin += 1440;
    const waitStr = svc.state === 'stopped_at_station' ? 'à quai' : this._fmtWait(waitMin);
    const voieStr = svc.train?.platform || '?';

    return `<div style="background:#ddd8c8;color:#333;border:3px solid #bbb;border-radius:6px;overflow:hidden;max-width:1200px;margin:0 auto;font-family:${IG_FONT};position:relative;">
      <div class="ig2-platform-back" style="position:absolute;top:6px;left:6px;z-index:10;cursor:pointer;background:rgba(0,0,0,.1);color:#333;border:1px solid #aaa;border-radius:4px;padding:4px 10px;font-size:12px;">← Retour</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#e8e2d2;border-bottom:2px solid #c0b898;">
        <span class="ig2-clock" style="font-family:${IG_MONO};font-weight:700;">${nowStr}</span>
        <span style="font-weight:700;">Prochain Train</span>
        <span style="display:flex;align-items:center;gap:6px;"><span style="background:#f59e0b;color:#000;font-weight:900;padding:4px 10px;border-radius:4px;">V ${voieStr}</span></span>
      </div>
      <div style="padding:20px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <div style="background:${lineColor};color:#fff;font-weight:900;font-size:28px;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${lineCode}</div>
          <div style="flex:1;">
            <div style="font-size:28px;font-weight:900;">${destStation?.name || '?'}</div>
            ${servedAfter.length ? `<div style="font-size:13px;color:#555;">via ${servedAfter[0]?.name}</div>` : ''}
            <div style="font-size:12px;color:#666;">Mission: ${svc.name}</div>
          </div>
          <div style="font-size:40px;font-weight:700;color:${lineColor};">${waitStr}</div>
        </div>
        <div style="font-weight:700;margin-bottom:8px;">Gares desservies</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">${col(col1)}</div>
          <div style="flex:1;min-width:180px;">${col(col2)}</div>
        </div>
        <div style="margin-top:16px;font-size:12px;color:#555;font-weight:700;margin-bottom:6px;">Affluence prévue</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${crowdHtml}</div>
      </div>
    </div>`;
  }
};
