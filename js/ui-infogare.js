import { haversineDistance } from './simulation.js?v=1784731000';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784731000';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784731000';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784731000';

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
          const isDeparture = !isLast;
          const isArrival = !isFirst;
          const depTime = stop.departureTime;
          const arrTime = stop.arrivalTime;

          // Destination = last stop name
          const lastStop = stops[stops.length - 1];
          const destStation = this.game.world.getStationById(lastStop.stationId);
          // Origin = first stop name
          const firstStop = stops[0];
          const origStation = this.game.world.getStationById(firstStop.stationId);

          // Gares desservies after this station
          const servedStations = [];
          for (let j = i + 1; j < stops.length; j++) {
            if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
            const st = this.game.world.getStationById(stops[j].stationId);
            if (st) servedStations.push(st.name);
          }

          // Gares desservies before this station (for arrivals)
          const fromStations = [];
          for (let j = 0; j < i; j++) {
            if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
            const st = this.game.world.getStationById(stops[j].stationId);
            if (st) fromStations.push(st.name);
          }

          // Prochains arrêts avec horaires (pour écran quai)
          const nextStops = [];
          for (let j = i + 1; j < stops.length; j++) {
            if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
            const st = this.game.world.getStationById(stops[j].stationId);
            if (st) nextStops.push({ name: st.name, time: stops[j].arrivalTime });
          }

          // Time diff for "X min" display
          let waitMin = null;
          if (isDeparture && depTime != null) {
            waitMin = depTime - now;
            if (waitMin < 0) waitMin += 1440;
          }
          if (isArrival && arrTime != null) {
            waitMin = arrTime - now;
            if (waitMin < 0) waitMin += 1440;
          }

          // Line info
          const station = this.game.world.getStationById(stationId);
          const lineIds = station?.lineIds || [];
          const line = lineIds.length > 0 ? this.game.lineManager.getLine(lineIds[0]) : null;

          // Delay (integer minutes)
          const delay = Math.round(Number.isFinite(svc.delay) ? svc.delay : 0);

          // Annexes 20/23 — TRAIN COMPLET / supprimé
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
            isDeparture, isArrival, isFirst, isLast,
            servedStations, fromStations, nextStops,
            delay,
            isCancelled,
            isFull,
            isFreightFull,
            line,
            lineCode: line?.code || '',
            lineName: line?.name || '',
            lineColor: line?.color || '#3b82f6',
            voie: stop.platform || svc.train?.platform || String(i + 1),
            state: svc.state,
            speed: svc.speed || 0,
            rame: svc.rame,
          });
        }
      }

      // IG-07 — scroll infini sur 24h : on garde les trains dans les prochaines 24h
      const wrap = t => (t % 1440 + 1440) % 1440;

      if (mode === 'sncf-arr' || mode === 'afl-arrivee' || mode === 'cati-ar') {
        const arr = results.filter(r => r.isArrival && r.arrTime != null)
          .map(r => ({ ...r, waitMin: wrap(r.arrTime - now) }))
          .filter(r => r.waitMin <= 1440);
        arr.sort((a, b) => a.waitMin - b.waitMin);
        return arr;
      }

      const deps = results.filter(r => r.isDeparture && r.waitMin != null && r.waitMin <= 1440);
      deps.sort((a, b) => a.waitMin - b.waitMin);
      return deps;
    },

  _fmtTime(min) {
      if (min == null || isNaN(min)) return '--h--';
      const h = Math.floor(((min % 1440) + 1440) % 1440 / 60);
      const m = Math.round(((min % 1440) + 1440) % 1440 % 60);
      return `${h}h${m.toString().padStart(2, '0')}`;
    },

  _fmtWait(min) {
      if (min == null) return '';
      if (min <= 0) return "a l'approche";
      if (min < 60) return `${Math.round(min)} min`;
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`;
    },

  _fmtDelay(min) {
      if (min == null || min <= 0) return "a l'heure";
      if (min < 60) return `retard ${Math.round(min)} min.`;
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return m > 0 ? `retard ${h}h${m.toString().padStart(2, '0')}` : `retard ${h}h`;
    },

  _infogarePerPage(displayType) {
      const map = {
        'sncf-dep': 3,
        'sncf-arr': 4,
        'cati-ar': 6,
        'cati-3-3': 6,
        'cati-complet': 5,
        'old-sncf': 22,
        'ecran-quai': 1,
        'flash-circulation': 0,
        'rer-ratp': 8,
        'rer-sncf': 8,
        'afl-depart': 1,
        'afl-arrivee': 1,
      };
      return map[displayType] || 4;
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
      const nowStr = `${pt.hours.toString().padStart(2,'0')}:${pt.minutes.toString().padStart(2,'0')}`;

      const perPage = this._infogarePerPage(displayType);
      const totalPages = (perPage > 0 && trains.length > 0) ? Math.max(1, Math.ceil(trains.length / perPage)) : 1;
      const page = ((this._infogarePage % totalPages) + totalPages) % totalPages;

      switch (displayType) {
        case 'rer-ratp': board.innerHTML = this._renderRerRatp(station, trains, nowStr, page); break;
        case 'rer-sncf': board.innerHTML = this._renderRerSncf(station, trains, nowStr, page); break;
        case 'sncf-dep': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr, page); break;
        case 'sncf-arr': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr, page); break;
        case 'afl-depart': board.innerHTML = this._renderAFLDepart(station, trains, nowStr, page); break;
        case 'afl-arrivee': board.innerHTML = this._renderAFLArrivee(station, trains, nowStr, page); break;
        case 'cati-ar': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr, page); break;
        case 'old-sncf': board.innerHTML = this._renderPalette(station, trains, nowStr, page); break;
        case 'flash-circulation': board.innerHTML = this._renderFlashCirculation(station, nowStr); break;
        case 'cati-3-3': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr, page); break;
        case 'cati-complet': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr, page); break;
        case 'ecran-quai': board.innerHTML = this._renderEcranQuai(station, trains, nowStr, page); break;
      }

      // Setup train click handlers for platform display
      board.querySelectorAll('[data-svc-id]').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => this._showPlatformDisplay(el.dataset.svcId, stationId));
      });

      // Mouse-wheel paging for 24h infinite scroll (image boards); RER boards keep their native CSS scroll
      if (!['rer-ratp', 'rer-sncf'].includes(displayType)) {
        board.onwheel = e => {
          e.preventDefault();
          if (perPage <= 0 || totalPages <= 1) return;
          if (e.deltaY > 0) this._infogarePage = (this._infogarePage + 1) % totalPages;
          else this._infogarePage = (this._infogarePage - 1 + totalPages) % totalPages;
          this._showInfogareBoard();
        };
      } else {
        board.onwheel = null;
      }

      this._animateInfogareBoard(board, displayType);

      // Auto-refresh every 5 seconds (data), plus a 1s clock update
      if (this._infogareInterval) clearInterval(this._infogareInterval);
      this._infogareInterval = setInterval(() => {
        if (this.activePage !== 'infogare') { clearInterval(this._infogareInterval); this._stopInfogareClock(); return; }
        this._showInfogareBoard();
      }, 5000);
    },

  _stopInfogareClock() {
      if (this._infogareClockInterval) { clearInterval(this._infogareClockInterval); this._infogareClockInterval = null; }
    },

  _animateInfogareBoard(board, displayType) {
      const lower = displayType.toLowerCase();
      board.classList.remove('ig-board-entrance','ig-anim-pulse','ig-anim-flash','ig-anim-shake');
      void board.offsetWidth; // force reflow
      board.classList.add('ig-board-entrance');

      // staggered row entrance
      const rows = board.querySelectorAll('[data-svc-id], .ig-sncf-row, .ig-cati-row, .ig-cati-33-row, .ig-rsncf-row, .ig-ratp-row, .ig-solari-row');
      rows.forEach((el, i) => {
        el.classList.add('ig-row-entrance');
        el.style.animationDelay = `${i * 0.05}s`;
      });

      // blink / pulse statuses
      const statusEls = board.querySelectorAll('.ig-sncf-status, .ig-cati-num, .ig-quai-status, .ig-afl-delay, .ig-ratp-wait-approche, .ig-pgl-delay, .ig-pban-delay, .ig-flash-sign-info');
      statusEls.forEach(el => {
        const txt = el.textContent.toLowerCase();
        if (txt.includes('supprim') || txt.includes('annul') || txt.includes('cancel')) {
          el.classList.add('ig-status-cancel');
        } else if (txt.includes('retard') || txt.includes('retardé') || txt.includes('delayed')) {
          el.classList.add('ig-status-delay');
        } else if (txt.includes("approche") || txt.includes('approach')) {
          el.classList.add('ig-status-approach');
        }
      });

      // AFL / Flash / Quai pulse when disrupted
      const isDisrupted = board.textContent.toLowerCase().includes('retard') || board.textContent.toLowerCase().includes('supprim') || board.textContent.toLowerCase().includes('travaux');
      if (isDisrupted) {
        if (lower.includes('afl')) board.classList.add('ig-anim-pulse');
        if (lower.includes('flash')) board.querySelector('.ig-flash-sign-body')?.classList.add('ig-anim-pulse');
        if (lower.includes('quai')) board.querySelector('.ig-quai-status')?.classList.add('ig-anim-pulse');
      }

      // start live clock
      this._stopInfogareClock();
      this._updateInfogareClocks(board);
      this._infogareClockInterval = setInterval(() => {
        if (this.activePage !== 'infogare') { this._stopInfogareClock(); return; }
        const b = document.getElementById('infogare-board');
        if (b) this._updateInfogareClocks(b);
      }, 1000);
    },

  _updateInfogareClocks(board) {
      const pt = this.game.engine.getParisTime();
      const nowStr = `${pt.hours.toString().padStart(2,'0')}:${pt.minutes.toString().padStart(2,'0')}`;
      const nowStrDot = nowStr.replace(':', '.');
      const nowStrSpace = nowStr.replace(':', ' ');

      // any element whose class contains "clock" inside the board, plus palette digital
      board.querySelectorAll('[class*="clock"], .ig-palette-time-digital').forEach(el => {
        const txt = el.textContent;
        if (txt.includes(':')) el.textContent = nowStr;
        else if (txt.includes('.')) el.textContent = nowStrDot;
        else if (txt.includes('h')) { /* keep h format in palette? palette uses digital */ }
        else el.textContent = nowStr;
      });

      // palette analog clock
      const hourHand = board.querySelector('.ig-palette-clock-hand');
      const minHand = board.querySelector('.ig-palette-clock-hand-min');
      if (hourHand && minHand) {
        const totalMin = pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60;
        hourHand.style.transform = `rotate(${(totalMin / 2) % 360}deg)`;
        minHand.style.transform = `rotate(${(totalMin * 6) % 360}deg)`;
      }

      // footer clocks (second span inside cati/afl/sncf footers)
      board.querySelectorAll('.ig-cati-footer, .ig-afl-footer, .ig-sncf-footer').forEach(foot => {
        const last = foot.lastElementChild;
        if (last && last.textContent.match(/\d{1,2}[:.h ]\d{2}/)) {
          if (last.textContent.includes('.')) last.textContent = nowStrDot;
          else last.textContent = nowStr;
        }
      });
    },

  _renderRerRatp(station, trains, nowStr) {
      const dests = [...new Set(trains.map(t => t.destination))].slice(0, 4);
      const lineColor = trains[0]?.lineColor || '#003DA5';
      const lineCode = trains[0]?.lineCode || 'A';

      let rows = '';
      for (const t of trains) {
        let waitHtml;
        if (t.waitMin != null && t.waitMin <= 1) {
          waitHtml = `<span class="ig-ratp-wait-approche ig-blink">a l'approche</span>`;
        } else if (t.waitMin != null && t.waitMin < 60) {
          waitHtml = `<span class="ig-ratp-wait-box">${Math.round(t.waitMin)}</span><span class="ig-ratp-wait-unit">min</span>`;
        } else if (t.waitMin != null) {
          const h = Math.floor(t.waitMin / 60);
          const m = Math.round(t.waitMin % 60);
          waitHtml = `<span class="ig-ratp-wait-box">${h}h${m.toString().padStart(2,'0')}</span>`;
        } else {
          waitHtml = '';
        }
        rows += `<div class="ig-ratp-row" data-svc-id="${t.svcId}">
          <span class="ig-ratp-code">${t.name}</span>
          <span class="ig-ratp-dest">${t.destination}</span>
          <span class="ig-ratp-wait">${waitHtml}</span>
          ${t.voie ? `<span class="ig-rsncf-voie" style="margin-left:4px">${t.voie}</span>` : ''}
        </div>`;
      }

      const destsLine1 = dests.slice(0, 2).join(' \u2022 ');
      const destsLine2 = dests.slice(2).join(' \u2022 ');

      return `<div class="ig-ratp-board">
        <div class="ig-ratp-header">
          <span class="ig-ratp-rer">RER</span>
          <span class="ig-ratp-line-badge" style="background:${lineColor}">${lineCode}</span>
          <div class="ig-ratp-destinations">${destsLine1}${destsLine2 ? '<br>' + destsLine2 : ''}</div>
          <div class="ig-ratp-clock">${nowStr}</div>
        </div>
        <div class="ig-ratp-separator" style="background:#cc0000"></div>
        <div class="ig-ratp-rows">${rows || '<div style="color:#666;padding:16px;text-align:center;background:#c8c8d0">Aucun train prevu</div>'}</div>
        <div class="ig-ratp-footer">
          <span class="ig-ratp-alert-badge">${lineCode}</span>
          <span class="ig-ratp-alert-icon">&#9888;</span>
          <span class="ig-ratp-alert-text">Pas de perturbation signalee sur cette ligne.</span>
        </div>
      </div>`;
    },

  _renderRerSncf(station, trains, nowStr) {
      let rows = '';
      for (const t of trains) {
        const served = t.servedStations.slice(0, 3).join('   ');
        const waitStr = t.waitMin != null ? (t.waitMin < 60 ? `${Math.round(t.waitMin)} min` : this._fmtWait(t.waitMin)) : '';
        rows += `<div class="ig-rsncf-row" data-svc-id="${t.svcId}">
          <span class="ig-rsncf-line" style="background:${t.lineColor}">${t.lineCode || '?'}</span>
          <span class="ig-rsncf-code">${t.name}</span>
          <span class="ig-rsncf-dest">${t.destination}</span>
          <span class="ig-rsncf-wait">${waitStr}</span>
          <span class="ig-rsncf-voie">${t.voie || ''}</span>
        </div>
        ${served ? `<div class="ig-rsncf-served">${served}</div>` : ''}`;
      }

      return `<div class="ig-rsncf-board">
        <div class="ig-rsncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
        <div class="ig-rsncf-footer">
          <div class="ig-rsncf-info">Pas de perturbation signalee</div>
          <div class="ig-rsncf-clock">${nowStr}</div>
        </div>
      </div>`;
    },

  _renderSncfDep(station, trains, nowStr) {
      let rows = '';
      for (const t of trains) {
        const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
        const type = m ? m[1] : (t.seriesName || 'TER');
        const num = m ? m[2].trim() : (t.trainNumber || t.name);
        let statusStr = '', remark = '';
        if (t.isCancelled) {
          statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
          remark = 'La clientèle est invitée à emprunter le train suivant.';
        } else if (t.isFull || t.isFreightFull) {
          statusStr = `<span class="ig-sncf-full">TRAIN COMPLET</span>`;
        } else if (t.delay > 0) {
          statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
          remark = t.delayReason || 'Incident en cours d’identification';
        } else {
          statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
        }
        const stops = t.servedStations.slice(0, 6).join(' \u2022 ');
        rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
          <div class="ig-sncf-main">
            <span class="ig-sncf-time">${this._fmtTime(t.depTime)}</span>
            <span class="ig-sncf-trainid">
              <span class="ig-sncf-type">${type || t.seriesName || 'TER'}</span>
              <span class="ig-sncf-trainnum">${num || t.trainNumber || t.name}</span>
            </span>
            <span class="ig-sncf-destcol">
              <span class="ig-sncf-dest">${t.destination}</span>
              ${stops ? `<span class="ig-sncf-stops">${stops}</span>` : ''}
            </span>
            <span class="ig-sncf-status">${statusStr}</span>
          </div>
          ${remark ? `<div class="ig-sncf-remark">${remark}</div>` : ''}
        </div>`;
      }

      return `<div class="ig-sncf-board ig-sncf-dep">
        <div class="ig-sncf-topbar">
          <div class="ig-sncf-topclock">${nowStr}</div>
          <div class="ig-sncf-topstation">${station?.name || ''}</div>
          <div class="ig-sncf-topsncf">SNCF</div>
        </div>
        <div class="ig-sncf-header ig-sncf-header-dep">
          <span></span>
          <span>N°</span>
          <span>DESTINATION</span>
          <span></span>
        </div>
        <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
      </div>`;
    },

  _renderSncfArr(station, trains, nowStr) {
      let rows = '';
      for (const t of trains) {
        const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
        const type = m ? m[1] : (t.seriesName || 'TER');
        const num = m ? m[2].trim() : (t.trainNumber || t.name);
        let statusStr = '', remark = '';
        if (t.isCancelled) {
          statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
        } else if (t.delay > 0) {
          statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
          remark = t.delayReason || 'Conditions climatiques exceptionnelles';
        } else {
          statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
        }
        rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
          <div class="ig-sncf-main">
            <span class="ig-sncf-time">${this._fmtTime(t.arrTime)}</span>
            <span class="ig-sncf-trainid">
              <span class="ig-sncf-type">${type || t.seriesName || 'TER'}</span>
              <span class="ig-sncf-trainnum">${num || t.trainNumber || t.name}</span>
            </span>
            <span class="ig-sncf-destcol">
              <span class="ig-sncf-dest">${t.origin}</span>
            </span>
            <span class="ig-sncf-status">${statusStr}</span>
            <span class="ig-sncf-voie">${t.voie || ''}</span>
          </div>
          ${remark ? `<div class="ig-sncf-remark">${remark}</div>` : ''}
        </div>`;
      }

      return `<div class="ig-sncf-board ig-sncf-arr">
        <div class="ig-sncf-topbar">
          <div class="ig-sncf-topclock">${nowStr}</div>
          <div class="ig-sncf-topstation">${station?.name || ''}</div>
          <div class="ig-sncf-topsncf">SNCF</div>
        </div>
        <div class="ig-sncf-header ig-sncf-header-arr">
          <span></span>
          <span>N°</span>
          <span>PROVENANCE</span>
          <span></span>
          <span>VOIE</span>
        </div>
        <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
      </div>`;
    },

  _renderOldSncf(station, trains, nowStr) {
      let rows = '';
      for (const t of trains) {
        const servedTxt = t.servedStations.join('  ').toUpperCase();
        const destFull = `${t.destination.toUpperCase()}${servedTxt ? '  ' + servedTxt : ''}`;
        let remarks = (t.seriesName || '').toUpperCase();
        if (t.isCancelled) remarks = 'SUPP';
        else if (t.isFull || t.isFreightFull) remarks = 'PLEIN';
        rows += `<div class="ig-solari-row" data-svc-id="${t.svcId}">
          <span class="ig-solari-cell ig-solari-time">${this._fmtTime(t.depTime).replace('h', '.')}</span>
          <span class="ig-solari-cell ig-solari-dest">${destFull}</span>
          <span class="ig-solari-cell ig-solari-remarks">${remarks}</span>
          <span class="ig-solari-cell ig-solari-num">${t.trainNumber || t.name || ''}</span>
          <span class="ig-solari-cell ig-solari-voie">${t.voie || ''}</span>
        </div>`;
      }

      setTimeout(() => this._animateSolari(), 50);

      return `<div class="ig-solari-board">
        <div class="ig-solari-header">
          <span>DEPART</span><span>DEPARTURE</span><span>ABFAHRT</span>
        </div>
        <div class="ig-solari-subheader">
          <span>Trains au depart</span>
          <span>Departing trains</span>
          <span>Abfahrt der Zuge</span>
        </div>
        <div class="ig-solari-colheader"><span>heure</span><span>destination - desservant</span><span>remarques</span><span>train n\u00b0</span><span>voie</span></div>
        <div class="ig-solari-rows">${rows || '<div style="color:#ccbb33;padding:16px;text-align:center;letter-spacing:2px">AUCUN TRAIN PREVU</div>'}</div>
        <div class="ig-solari-footer">
          <div class="ig-solari-clock">${nowStr.replace(':', '.')}</div>
        </div>
      </div>`;
    },

  _animateSolari() {
      const cells = document.querySelectorAll('.ig-solari-cell');
      cells.forEach((el, idx) => {
        el.classList.add('ig-solari-flip');
        el.style.animationDelay = `${Math.floor(idx / 5) * 0.12}s`;
      });
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
      const mainText = items.length ? items.join(' / ') : 'Trafic fluide sur le réseau.';
      const ticker = items.length ? `${items.join('   +++   ')}   +++   ` : 'Circulation normale.';

      const W = 250, H = 140, scale = 3;
      const img = 'img/infogare/FLASH-CIRCULATION.png';
      let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
      html += `<div class="ig-image-block" style="top:0;left:22%;width:78%;height:100%;background:#fec152;"></div>`;
      html += this._igField({x:28,y:11,w:66,h:55}, mainText, {color:'#000080',fontSize:6*scale,weight:700,style:'white-space:normal;overflow-wrap:break-word;line-height:1.2;'}, 0);
      html += this._igField({x:28,y:72,w:67,h:10}, 'INFORMATIONS A SUIVRE', {color:'#000080',fontSize:6*scale,weight:700,align:'center'}, 0);
      html += this._igField({x:4,y:86,w:69,h:8}, ticker, {color:'#fff',fontSize:5*scale,bg:'#0b4f9b',style:'white-space:nowrap;'}, 0);
      const clock = nowStr.replace(':', ' ');
      html += this._igField({x:73,y:90,w:23,h:7}, clock, {color:'#fff',fontSize:6*scale,bg:'#0b4f9b',align:'center',weight:700}, 0);
      html += `</div>`;
      return html;
    },

  _renderCATI3_3(station, trains, nowStr) {
      const dep = trains.filter(r => r.isDeparture).slice(0, 6);
      const mid = Math.ceil(dep.length / 2);
      const left = dep.slice(0, mid);
      const right = dep.slice(mid);
      const cell = t => {
        const stops = t.servedStations.slice(0, 2).join(' ');
        return `<div class="ig-cati-33-row" data-svc-id="${t.svcId}">
          <span class="ig-cati-33-stops">${stops}</span>
          <span class="ig-cati-33-time">${this._fmtTime(t.depTime)}</span>
          <span class="ig-cati-33-dest">${t.destination}</span>
        </div>`;
      };
      const col = items => items.length ? items.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>';
      const first = dep[0];
      const topInfo = first ? `${this._fmtTime(first.depTime)} ${first.destination}` : 'Aucun train';
      return `<div class="ig-cati-board ig-cati-3-3">
        <div class="ig-cati-header">
          <span class="ig-cati-station">${station?.name || ''}</span>
          <span class="ig-cati-title">${topInfo}</span>
          <span class="ig-cati-clock">${nowStr}</span>
        </div>
        <div class="ig-cati-33-cols">
          <div class="ig-cati-33-col">${col(left)}</div>
          <div class="ig-cati-33-col">${col(right)}</div>
        </div>
        <div class="ig-cati-footer"><span>CATI 3-3</span><span>${nowStr}</span></div>
        <div class="ig-cati-side">départs</div>
      </div>`;
    },

  _renderAFLDepart(station, trains, nowStr, page = 0) {
      const deps = trains.filter(r => r.isDeparture);
      const t = deps[page] || deps[0];
      if (!t) return `<div class="ig-afl-board"><div class="ig-afl-station">${station?.name || ''}</div><div class="ig-afl-msg">Aucun départ prévu</div></div>`;
      const delay = `<span class="${t.delay > 0 ? 'ig-afl-delay' : 'ig-afl-ontime'}">${this._fmtDelay(t.delay).replace(/^retard /, 'Retard ')}</span>`;
      const via = t.servedStations?.slice(0, 4).join(' – ') || '';
      return `<div class="ig-afl-board" data-svc-id="${t.svcId}">
        <div class="ig-afl-header">${station?.name || ''} <span class="ig-afl-clock">${nowStr}</span></div>
        <div class="ig-afl-prochain">Prochain départ</div>
        <div class="ig-afl-destination">${t.destination}</div>
        ${via ? `<div class="ig-afl-via">via ${via}</div>` : ''}
        <div class="ig-afl-line">${this._fmtTime(t.depTime)} ${delay}</div>
        <div class="ig-afl-details">Train ${t.name} — Voie ${t.voie || '—'}</div>
      </div>`;
    },

  _renderAFLArrivee(station, trains, nowStr, page = 0) {
      const arrs = trains.filter(r => r.isArrival);
      const t = arrs[page] || arrs[0];
      if (!t) return `<div class="ig-afl-board ig-afl-arr"><div class="ig-afl-station">${station?.name || ''}</div><div class="ig-afl-msg">Aucune arrivée prévue</div></div>`;
      const status = t.state === 'stopped_at_station' && t.isLast ? 'Arrivé' : `dans ${this._fmtWait(t.waitMin) || '—'}`;
      const from = t.fromStations?.slice(-3).join(' – ') || '';
      return `<div class="ig-afl-board ig-afl-arr" data-svc-id="${t.svcId}">
        <div class="ig-afl-header">${station?.name || ''} <span class="ig-afl-clock">${nowStr}</span></div>
        <div class="ig-afl-prochain">Prochaine arrivée</div>
        <div class="ig-afl-destination">${t.origin}</div>
        ${from ? `<div class="ig-afl-via">depuis ${from}</div>` : ''}
        <div class="ig-afl-line">${this._fmtTime(t.arrTime)} — ${status}</div>
        <div class="ig-afl-details">Train ${t.name} — Voie ${t.voie || '—'}</div>
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

      if (isGrandeLigne) {
        board.innerHTML = this._renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
      } else {
        board.innerHTML = this._renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
      }

      this._animateInfogareBoard(board, 'platform');
      board.querySelector('.ig-platform-back')?.addEventListener('click', () => this._showInfogareBoard());
    },

  _renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
      const stopsHtml = servedAfter.map(s =>
        `<div class="ig-pgl-stop ${s.isLast ? 'ig-pgl-terminus' : ''}"><span class="ig-pgl-bullet">\u25CF</span>${s.name}</div>`
      ).join('');

      let carsHtml = '';
      for (let i = 1; i <= numCars; i++) {
        carsHtml += `<div class="ig-pgl-car">${i}</div>`;
      }
      const sections = 'ABCDEFGH';
      let sectionsHtml = '';
      const numSections = Math.min(8, Math.ceil(numCars / 2));
      for (let i = 0; i < numSections; i++) {
        sectionsHtml += `<div class="ig-pgl-section">${sections[i]}</div>`;
      }

      const seriesName = svc.train?.seriesName || svc.rame?.seriesName || '';
      const trainNum = svc.train?.number || svc.name || '';

      return `<div class="ig-pgl-board">
        <div class="ig-pgl-back"><button class="ig-platform-back btn-sm" style="background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">\u2190 Retour</button></div>
        <div class="ig-pgl-header">
          <div class="ig-pgl-left">
            <div class="ig-pgl-series">${seriesName}</div>
            <div class="ig-pgl-time">${this._fmtTime(depTime)}</div>
            ${delayStr ? `<div class="ig-pgl-delay">${delayStr}</div>` : ''}
            <div class="ig-pgl-dest">${destStation?.name || '?'}</div>
            <div class="ig-pgl-trainnum">${seriesName} ${trainNum}</div>
          </div>
          <div class="ig-pgl-right">
            <div class="ig-pgl-watermark">depart</div>
            <div class="ig-pgl-stops">${stopsHtml || '<div style="color:#7788aa">Terminus</div>'}</div>
          </div>
        </div>
        <div class="ig-pgl-composition">
          <div class="ig-pgl-station-center"><span class="ig-pgl-station-label">${station?.name || ''}</span></div>
          <div class="ig-pgl-cars">${carsHtml}</div>
          <div class="ig-pgl-sections">${sectionsHtml}</div>
        </div>
        <div class="ig-pgl-footer">
          <div class="ig-pgl-info-bar">Information en temps reel</div>
          <div class="ig-pgl-clock">${nowStr}</div>
          <div class="ig-pgl-sncf">SNCF</div>
        </div>
      </div>`;
    },

  _renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
      const half = Math.ceil(servedAfter.length / 2);
      const col1 = servedAfter.slice(0, half);
      const col2 = servedAfter.slice(half);
      const col1Html = col1.map(s => `<div class="ig-pban-stop-item"><span class="ig-pban-stop-dot">\u25CF</span><span class="ig-pban-stop-name${s.isLast ? ' ig-pgl-terminus' : ''}">${s.name}</span></div>`).join('');
      const col2Html = col2.map(s => `<div class="ig-pban-stop-item"><span class="ig-pban-stop-dot">\u25CF</span><span class="ig-pban-stop-name${s.isLast ? ' ig-pgl-terminus' : ''}">${s.name}</span></div>`).join('');

      let crowdHtml = '';
      const crowdClasses = ['ig-pban-car-green', 'ig-pban-car-green', 'ig-pban-car-orange', 'ig-pban-car-red'];
      const crowdIcons = ['\u{1F9CD}', '\u{1F9CD}', '\u{1F9CD}\u{1F9CD}', '\u{1F9CD}\u{1F9CD}\u{1F9CD}'];
      for (let i = 0; i < numCars; i++) {
        const lvl = Math.floor(Math.random() * 3);
        crowdHtml += `<div class="ig-pban-car-box ${crowdClasses[lvl]}"><span class="ig-pban-car-icon">${lvl === 0 ? '\u{1F7E2}' : lvl === 1 ? '\u{1F7E0}' : '\u{1F534}'}</span></div>`;
      }

      const lineColor = svc.train?.color || '#2d8a4e';
      const lineCode = svc.train?.seriesName?.[0] || '?';
      const trainIsLong = numCars > 4;
      const voieStr = svc.train?.platform || '?';

      const pt = this.game.engine.getParisTime();
      const now = pt.hours * 60 + pt.minutes;
      let waitMin = depTime != null ? depTime - now : null;
      if (waitMin != null && waitMin < 0) waitMin += 1440;
      const waitStr = svc.state === 'stopped_at_station' ? 'a quai' : this._fmtWait(waitMin);

      const totalPages = Math.ceil(servedAfter.length / 10) || 1;

      return `<div class="ig-pban-board">
        <div class="ig-pban-back"><button class="ig-platform-back btn-sm" style="background:rgba(0,0,0,.1);color:#333;border:1px solid #aaa;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">\u2190 Retour</button></div>
        <div class="ig-pban-header">
          <div class="ig-pban-clock">${nowStr}</div>
          <div class="ig-pban-title">Prochain Train</div>
          <div class="ig-pban-platform">
            <span class="ig-pban-platform-num">${voieStr}</span>
            ${trainIsLong ? '<span class="ig-pban-long-train">Train long</span>' : ''}
          </div>
        </div>
        <div class="ig-pban-main">
          <div class="ig-pban-train-row">
            <div class="ig-pban-line-circle" style="background:${lineColor}">${lineCode}</div>
            <div class="ig-pban-train-info">
              <div class="ig-pban-dest-name">${destStation?.name || '?'}</div>
              <div class="ig-pban-dest-via">${servedAfter.length > 0 ? 'via ' + servedAfter[0]?.name : ''}</div>
              <div class="ig-pban-code-label">Mission: ${svc.name}</div>
            </div>
            <div class="ig-pban-wait">${waitStr}</div>
          </div>
          <div class="ig-pban-page">Page 1/${totalPages}</div>
          <div class="ig-pban-stops-section">
            <div class="ig-pban-stops-title">Gares desservies</div>
            <div class="ig-pban-stops-grid">
              <div>${col1Html}</div>
              <div>${col2Html}</div>
            </div>
          </div>
        </div>
        <div class="ig-pban-crowding">
          <div class="ig-pban-crowd-label">Affluence prevue</div>
          <div class="ig-pban-crowd-cars">${crowdHtml}</div>
          <div class="ig-pban-crowd-ends"><span>Queue</span><span>Tete</span></div>
        </div>
      </div>`;
    },

  _renderCATIComplet(station, trains, nowStr) {
      const dep = trains.filter(r => r.isDeparture).slice(0, 12);
      const head = `<div class="ig-cati-row ig-cati-head">
        <span class="ig-cati-logo-h"></span><span>Train</span><span>Heure</span><span>Destination</span>
      </div>`;
      const cell = t => `<div class="ig-cati-row" data-svc-id="${t.svcId}">
        <span class="ig-cati-logo">SNCF</span>
        <span class="ig-cati-num">${t.trainNumber || t.name.split(' ')[0] || t.name}</span>
        <span class="ig-cati-time">${this._fmtTime(t.depTime)}</span>
        <span class="ig-cati-dest">${t.destination}</span>
      </div>`;
      return `<div class="ig-cati-board ig-cati-complet">
        <div class="ig-cati-header">
          <span class="ig-cati-station">${station?.name || ''}</span>
          <span class="ig-cati-title">Départs — Affichage complet</span>
          <span class="ig-cati-clock">${nowStr}</span>
        </div>
        <div class="ig-cati-full">${head}${dep.length ? dep.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>'}</div>
        <div class="ig-cati-footer"><span>24h • Toutes destinations</span><span>${nowStr}</span></div>
        <div class="ig-cati-side">départs</div>
      </div>`;
    },

  _renderCATIAr(station, trains, nowStr) {
      const arr = trains.filter(r => r.isArrival).slice(0, 12);
      const cell = t => {
        let status = '';
        if (t.isCancelled) status = '<span style="color:#f87171;font-weight:700">Supprimé</span>';
        else if (t.delay > 0) status = `<span style="color:#facc15;font-weight:700">retard ${Math.round(t.delay)} min</span>`;
        const stops = t.fromStations.slice(0, 5).join(' \u2022 ');
        return `<div class="ig-cati-row" data-svc-id="${t.svcId}">
          <span class="ig-cati-logo">SNCF</span>
          <span class="ig-cati-num">${status || '&nbsp;'}</span>
          <span class="ig-cati-time">${this._fmtTime(t.arrTime)}</span>
          <span class="ig-cati-destcol">
            <span class="ig-cati-dest" style="color:#fff">${t.origin}</span>
            ${stops ? `<span class="ig-cati-stops" style="color:#cbd5e1;font-size:10px">${stops}</span>` : ''}
          </span>
        </div>`;
      };
      const head = `<div class="ig-cati-row ig-cati-head" style="background:#1a5e1a">
        <span class="ig-cati-logo-h"></span><span>Retard</span><span>Heure</span><span>Provenance</span>
      </div>`;
      return `<div class="ig-cati-board ig-cati-ar" style="background:#0b2e12">
        <div class="ig-cati-header" style="background:#1a5e1a">
          <span class="ig-cati-station">${station?.name || ''}</span>
          <span class="ig-cati-title">Arrivées — Affichage complet</span>
          <span class="ig-cati-clock">${nowStr}</span>
        </div>
        <div class="ig-cati-full">${head}${arr.length ? arr.map(cell).join('') : '<div class="ig-cati-empty">Aucune arrivée</div>'}</div>
        <div class="ig-cati-footer" style="background:#1a5e1a"><span>24h • Toutes provenances</span><span>${nowStr}</span></div>
        <div class="ig-cati-side" style="background:#0b2e12">arrivées</div>
      </div>`;
    },

  _renderEcranQuai(station, trains, nowStr, page = 0) {
      const deps = trains.filter(r => r.isDeparture);
      const t = deps[page] || deps[0];
      if (!t) return `<div class="ig-image-board" style="background:#0b4f9b;width:1100px;max-width:1100px;aspect-ratio:1100/616;align-items:center;justify-content:center;color:#fff;display:flex;font-size:24px;">Aucun départ prévu</div>`;
      const delayText = this._fmtDelay(t.delay).replace(/^retard /i, '');
      const msg = t.isCancelled ? 'SUPPRIMÉ' : (t.delay > 0 ? `RETARD ${delayText}` : "à l'heure");
      const trainNum = t.trainNumber || t.name;
      const W = 1100, H = 616, scale = 1;
      const img = 'img/infogare/ECRAN-QUAI.png';
      const pt = this.game.engine?.getParisTime?.();
      const clockStr = pt ? `${String(pt.hours).padStart(2,'0')} ${String(pt.minutes).padStart(2,'0')} ${String(pt.seconds).padStart(2,'0')}` : nowStr.replace(':', ' ');
      let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
      // masques pour cacher le texte de l'image d'origine
      html += `<div class="ig-image-block" style="top:8%;left:0;width:38%;height:82%;background:#f5eef4;"></div>`;
      html += `<div class="ig-image-block" style="top:0;left:38%;width:62%;height:90%;background:#0b4f9b;"></div>`;
      html += `<div class="ig-image-block" style="top:90%;left:0;width:100%;height:10%;background:#0b4f9b;"></div>`;
      html += this._igField({x:5,y:9,w:15,h:10}, this._fmtTime(t.depTime), {color:'#000',fontSize:20*scale,weight:700}, 0);
      html += this._igField({x:22,y:12,w:15,h:6}, msg, {color:'#16a34a',fontSize:12*scale,weight:700}, 0);
      html += this._igField({x:5,y:21,w:35,h:10}, t.destination, {color:'#000',fontSize:18*scale,weight:700,textTransform:'uppercase'}, 0);
      html += this._igField({x:5,y:32,w:30,h:6}, `${t.name.split(' ')[0] || t.name} ${trainNum}`, {color:'#000',fontSize:13*scale,weight:700}, 0);
      const nextStops = (t.nextStops || []).slice(0, 15);
      const rowH = 5.2;
      const startY = 10;
      for (let i = 0; i < nextStops.length; i++) {
        const s = nextStops[i];
        const y = startY + i * rowH;
        const txt = `<span style="color:#facc15">•</span> <span style="color:#fff">${this._fmtTime(s.time)} ${s.name}</span>`;
        html += this._igField({x:42,y,w:55,h:rowH - 0.2}, txt, {color:'#fff',fontSize:13*scale,weight:600}, 0);
      }
      const ticker = `ON. LES VOYAGEURS A DESTINATION DE ${t.destination}`;
      html += this._igField({x:5,y:92,w:70,h:5}, ticker, {color:'#fff',fontSize:12*scale,weight:700,style:'white-space:nowrap;'}, 0);
      html += this._igField({x:82,y:92,w:12,h:5}, clockStr, {color:'#fff',fontSize:12*scale,align:'center',weight:700}, 0);
      if (deps.length > 1) {
        html += `<div class="ig-image-field" style="left:5%;top:4%;width:30%;height:3%;color:#000;font-size:${10 * scale}px;text-align:left">Train ${page + 1}/${deps.length}</div>`;
      }
      html += `</div>`;
      return html;
    },

  _renderPalette(station, trains, nowStr, page = 0) {
      const perPage = 22;
      const start = page * perPage;
      const paged = trains.filter(r => r.isDeparture).slice(start, start + perPage);
      const all = paged.slice(0, 22);
      const left = all.filter((_, i) => i % 2 === 0).slice(0, 11);
      const right = all.filter((_, i) => i % 2 === 1).slice(0, 11);
      const W = 1100, H = 207, scale = 1;
      const img = 'img/infogare/PALETTE.png';
      const bg = '#1a1a1a';
      const pt = this.game.engine?.getParisTime?.();
      const clockStr = pt ? `${String(pt.hours).padStart(2,'0')} ${String(pt.minutes).padStart(2,'0')}` : nowStr.replace(':', ' ');

      // incidents / ticker
      const im = this.game.incidentManager;
      const bulletins = im?.getBulletins?.() || [];
      const tickerText = bulletins.length ? bulletins[0].name.toUpperCase() : 'CIRCULATION NORMALE';

      let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
      html += `<div class="ig-image-block" style="top:0%;height:11%;background:${bg};"></div>`;
      html += this._igField({x:1,y:2,w:85,h:6}, 'Trains au départ  •  Train departures  •  Abfahrende Züge', {color:'#facc15',fontSize:12*scale,bg:'#1a1a1a',weight:700}, 0);

      const rowH = 7.6;
      const startY = 11;
      const col = (t, base, rowY) => {
        if (!t) return '';
        const type = (t.name.split(' ')[0] || t.name).toUpperCase();
        const num = (t.trainNumber || '').toUpperCase();
        const time = this._fmtTime(t.depTime).replace('h', ':');
        const dest = (t.destination || '').toUpperCase();
        let part = (t.seriesName || 'TER').toUpperCase();
        if (t.isCancelled) part = 'SUPP';
        else if (t.isFull || t.isFreightFull) part = 'PLEIN';
        const status = t.delay > 0 ? `RET ${t.delay}M` : (t.isCancelled ? 'SUPP' : "OK");
        let s = '';
        s += this._igField({x:base + 2, y:rowY + 0.5, w:6, h:4.5}, type, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 8, y:rowY + 0.5, w:8, h:4.5}, num, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 16, y:rowY + 0.5, w:8, h:4.5}, time, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 24, y:rowY + 0.5, w:15, h:4.5}, dest, {color:'#fff', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 39, y:rowY + 0.5, w:7, h:4.5}, part, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 46, y:rowY + 0.5, w:7, h:4.5}, status, {color:'#4ade80', fontSize:9*scale, weight:700, bg:bg}, 0);
        s += this._igField({x:base + 53, y:rowY + 0.5, w:4, h:4.5}, t.voie || '', {color:'#000', fontSize:9*scale, weight:900, align:'center', bg:'#facc15'}, 0);
        return s;
      };

      for (let i = 0; i < 10; i++) {
        const rowY = startY + i * rowH;
        html += `<div class="ig-image-block" style="top:${rowY}%;height:${rowH}%;background:${bg};"></div>`;
        html += col(left[i], 0, rowY);
        html += col(right[i], 50, rowY);
      }

      // horloge numérique sur cadran + défilant
      html += this._igField({x:86,y:87,w:8,h:8}, clockStr, {color:'#facc15',fontSize:10*scale,bg:bg,align:'center',weight:700}, 0);
      html += this._igField({x:89,y:85,w:9,h:14}, tickerText, {color:'#000',fontSize:8*scale,bg:'#f97316',weight:700,style:'white-space:normal;overflow-wrap:break-word;line-height:1.1;'}, 0);
      if (trains.filter(r => r.isDeparture).length > perPage) {
        const totalPages = Math.max(1, Math.ceil(trains.filter(r => r.isDeparture).length / perPage));
        html += `<div class="ig-image-field" style="left:88%;top:95%;width:10%;height:3%;color:#fff;font-size:${10 * scale}px;text-align:right;padding-right:2%">${page + 1}/${totalPages}</div>`;
      }
      html += `</div>`;
      return html;
    },

  _renderImageMode(displayType, station, trains, nowStr, page = 0) {
      const layout = IG_IMAGE_LAYOUTS[displayType];
      if (!layout) return '';
      const isArr = ['sncf-arr', 'afl-arrivee', 'cati-ar'].includes(displayType);
      const dirField = isArr ? 'provenance' : 'dest';
      const scale = layout.scale || (layout.width < 500 ? 2 : 1);
      const perPage = layout.blocks.length;

      const fmtStyle = (f, extra = '') => {
        const parts = [
          `left:${f.x}%`, `top:${f.y}%`, `width:${f.w}%`, `height:${f.h}%`,
          `color:${f.color || '#fff'}`,
          f.bg ? `background:${f.bg}` : '',
          `font-size:${(f.fontSize || 14) * scale}px`,
          `text-align:${f.align || 'left'}`,
          `justify-content:${f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start')}`,
          f.weight ? `font-weight:${f.weight}` : '',
          f.style || '', extra
        ];
        return parts.filter(Boolean).join(';');
      };

      let html = `<div class="ig-image-board" style="background-image:url('${layout.file}');width:${layout.width * scale}px;max-width:${layout.width * scale}px;aspect-ratio:${layout.width}/${layout.height};">`;

      // header fields
      for (const f of layout.headerFields || []) {
        let txt = '';
        if (f.type === 'clock') txt = nowStr;
        else if (f.type === 'station') txt = station?.name || '';
        else if (f.type === 'static') txt = f.text || '';
        html += `<div class="ig-image-field ig-image-header-field" style="${fmtStyle(f)}">${txt}</div>`;
      }

      // train blocks — page offset lets the board scroll through 24h of trains
      const start = page * perPage;
      const use = trains.slice(start, start + perPage);
      for (let i = 0; i < perPage; i++) {
        const b = layout.blocks[i];
        const t = use[i];
        html += `<div class="ig-image-block" style="top:${b.y}%;height:${b.h}%;background:${layout.bg};"></div>`;
        if (!t) continue;
        const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
        const type = m ? m[1] : (t.seriesName || 'TER');
        const num = m ? m[2].trim() : (t.trainNumber || t.name);
        const viaStops = isArr ? (t.fromStations || []) : (t.servedStations || []);
        const stops = viaStops.slice(0, 8).join(' \u2022 ');
        const viaText = stops;
        let statusHtml = '', remarkTxt = '';
        if (t.isCancelled) {
          statusHtml = `<span style="color:#fff;background:#dc2626;padding:2px 6px;border-radius:3px;text-transform:uppercase;">supprimé</span>`;
          remarkTxt = 'La clientèle est invitée à emprunter le train suivant.';
        } else if (t.delay > 0) {
          statusHtml = `<span style="color:#facc15;">retardé ${Math.round(t.delay)} min</span>`;
          remarkTxt = t.delayReason || 'Incident en cours d\'identification';
        } else {
          statusHtml = `<span style="color:#4ade80;">à l'heure</span>`;
        }

        // time
        const timeStr = this._fmtTime(isArr ? t.arrTime : t.depTime);
        html += this._igField(b.time, timeStr, { color: b.time?.color || '#facc15', fontSize: (b.time?.fontSize || 18) * scale, weight: b.time?.weight || 700, align: b.time?.align }, b.y);
        // type + number (stacked); prefer seriesName as type if the parsed type looks like a number
        const parsedType = (m && m[1] && !/^\d+$/.test(m[1])) ? m[1] : (t.seriesName || 'TER');
        const parsedNum = (m && m[1] && !/^\d+$/.test(m[1])) ? m[2].trim() : (t.trainNumber || t.name);
        html += this._igField(b.type, parsedType, { color: b.type?.color || '#fff', fontSize: (b.type?.fontSize || 13) * scale, weight: b.type?.weight || 700 }, b.y + (b.type?.yOff || 0));
        html += this._igField(b.num, parsedNum, { color: b.num?.color || '#93c5fd', fontSize: (b.num?.fontSize || 13) * scale, weight: b.num?.weight || 700 }, b.y + (b.num?.yOff || 0));
        // destination / provenance
        const destTxt = isArr ? (t.origin || '') : (t.destination || '');
        html += this._igField(b[dirField], destTxt, { color: b[dirField]?.color || '#fff', fontSize: (b[dirField]?.fontSize || 17) * scale, weight: b[dirField]?.weight || 700, textTransform: b[dirField]?.textTransform || 'uppercase' }, b.y);
        // via stops
        html += this._igField(b.via, viaText, { color: b.via?.color || '#ffffff', fontSize: (b.via?.fontSize || 11) * scale }, b.y + (b.viaY - b.y));
        // status
        html += this._igField(b.status, statusHtml, { color: b.status?.color || '#facc15', fontSize: (b.status?.fontSize || 12) * scale, weight: b.status?.weight || 700, align: b.status?.align || 'right' }, b.y);
        // voie (arrivals)
        if (b.voie) {
          const voieExtra = { color: b.voie.color || '#fff', fontSize: (b.voie.fontSize || 16) * scale, weight: b.voie.weight || 900, align: b.voie.align || 'center', bg: b.voie.bg || '#f59e0b' };
          html += this._igField(b.voie, t.voie || '', voieExtra, b.y + (b.voie?.yOff || 0));
        }
        // remark (departures)
        if (b.remark && remarkTxt) {
          html += this._igField(b.remark, remarkTxt, { color: '#facc15', fontSize: 11 * scale }, b.y + (b.remarkY - b.y));
        }
      }
      // page counter footer when the board scrolls through 24h of trains
      if (trains.length > perPage) {
        const totalPages = Math.max(1, Math.ceil(trains.length / perPage));
        html += `<div class="ig-image-field" style="left:88%;top:96%;width:10%;height:3%;color:#fff;font-size:${10 * scale}px;text-align:right;padding-right:2%">${page + 1}/${totalPages}</div>`;
      }
      html += `</div>`;
      return html;
    },

  _igField(spec, content, extra, yOff = 0) {
      if (!spec) return '';
      const style = [
        `left:${spec.x}%`, `top:${(spec.y || 0) + yOff}%`, `width:${spec.w}%`, `height:${spec.h}%`,
        `color:${extra.color || '#fff'}`, `font-size:${extra.fontSize || 14}px`,
        `text-align:${extra.align || 'left'}`,
        `justify-content:${extra.align === 'center' ? 'center' : (extra.align === 'right' ? 'flex-end' : 'flex-start')}`,
        `text-transform:${extra.textTransform || 'none'}`,
        extra.weight ? `font-weight:${extra.weight}` : '',
        extra.bg ? `background:${extra.bg}` : '',
        extra.style || ''
      ].filter(Boolean).join(';');
      return `<div class="ig-image-field" style="${style}">${content}</div>`;
    }
};
