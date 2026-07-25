import { haversineDistance } from './simulation.js?v=1784931691';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784931691';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784931691';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784931691';

export const UISchedule = {
  setupSchedulePage() {
      document.getElementById('btn-new-schedule')?.addEventListener('click', () => this.openScheduleModal());
      document.getElementById('btn-save-schedule')?.addEventListener('click', () => this.saveSchedule());
      document.getElementById('btn-auto-ar')?.addEventListener('click', () => this._calcAutoAR());
      document.getElementById('sched-sort')?.addEventListener('change', () => this.renderSchedulesList());
      document.getElementById('btn-sched-manual')?.addEventListener('click', () => this._toggleManualMode());
      document.getElementById('btn-sched-clear-manual')?.addEventListener('click', () => this._clearManualTrace());
      document.getElementById('btn-sched-edit-trace')?.addEventListener('click', () => this._toggleTraceEdit());
      document.getElementById('btn-sched-delete-point')?.addEventListener('click', () => this._deleteSelectedTracePoint());
      document.getElementById('btn-sched-return-mode')?.addEventListener('click', () => this._toggleReturnEditMode());
      document.getElementById('sched-service-type')?.addEventListener('change', () => {
        const workCb = document.getElementById('sched-work-train');
        if (workCb) workCb.checked = document.getElementById('sched-service-type').value === 'work';
        this._renderContractPicker();
      });
      document.getElementById('sched-work-train')?.addEventListener('change', (e) => {
        const typeSel = document.getElementById('sched-service-type');
        if (typeSel) typeSel.value = e.target.checked ? 'work' : 'passager';
        this._renderContractPicker();
      });
      document.getElementById('sched-terminus-wait')?.addEventListener('input', () => {
        // BUG-08 : recalcul auto des horaires de retour quand l'attente terminus change
        if (this._forwardStops?.length > 1 && document.getElementById('sched-round-trip')?.checked) {
          this._returnStops = this._generateDefaultReturnStops();
          if (this._isReturnEditMode) this.schedStops = this._returnStops;
          this.renderSchedStops();
          this._recalcPreviewRoutes();
        }
      });
      document.getElementById('sched-round-trip')?.addEventListener('change', () => {
        if (!document.getElementById('sched-round-trip').checked && this._isReturnEditMode) {
          // Exit return mode if round-trip is disabled.
          this._returnStops = this.schedStops;
          this._returnManualRoutes = this._manualRoutes;
          this.schedStops = this._forwardStops;
          this._manualRoutes = this._forwardManualRoutes;
          this._isReturnEditMode = false;
          this.renderSchedStops();
          this._recalcPreviewRoutes();
        }
        this._updateManualUI();
      });
    },

  _stopDataToEditObj(s) {
      const st = s.stationId ? this.game.world.getStationById(s.stationId) : null;
      let stationName = st?.name || s.stationId || '';
      if (s.voiePointId) {
        const vp = this.game.voiePointManager?.getVoiePointById(s.voiePointId);
        stationName = vp ? `Voie ${vp.voie}` : s.voiePointId;
      }
      return {
        stationId: s.stationId,
        voiePointId: s.voiePointId || null,
        stationName,
        type: s.type,
        stopCode: s.stopCode || '',
        arrTimeMin: s.arrivalTime,
        depTimeMin: s.departureTime,
        arrTimeStr: this.minToTimeStr(s.arrivalTime),
        depTimeStr: this.minToTimeStr(s.departureTime),
        platform: s.platform || '',
      };
    },

  _stopEditToData(s) {
      return {
        stationId: s.stationId,
        voiePointId: s.voiePointId || null,
        type: s.type,
        stopCode: s.stopCode || '',
        departureTime: s.depTimeMin,
        arrivalTime: s.arrTimeMin,
        platform: s.platform || '',
      };
    },

  openScheduleModal(editService) {
      this._editingScheduleId = editService?.id || null;
      if (editService) {
        this._forwardStops = editService.stops.map(s => this._stopDataToEditObj(s));
        this._forwardManualRoutes = (editService.routes || []).map(r => (r && r.length >= 2 ? [...r] : null));
        this._returnStops = (editService._returnStopsData || []).map(s => this._stopDataToEditObj(s));
        this._returnManualRoutes = (editService._returnRoutes || []).map(r => (r && r.length >= 2 ? [...r] : null));

        document.getElementById('sched-name').value = editService.name;
        document.getElementById('sched-return-name').value = editService.returnName || '';
        this._schedReturnPlatforms = editService.returnPlatforms ? { ...editService.returnPlatforms } : {};
        const rtCheck = document.getElementById('sched-round-trip');
        if (rtCheck) rtCheck.checked = editService.roundTrip;
        document.getElementById('sched-multi-departures').value = editService.multiDepartures || 1;
        document.getElementById('sched-terminus-wait').value = editService.terminusWait || 5;
        const typeSelect = document.getElementById('sched-service-type');
        if (typeSelect) typeSelect.value = editService.serviceType || (editService.isWorkTrain ? 'work' : 'passager');
        const workCheck = document.getElementById('sched-work-train');
        if (workCheck) workCheck.checked = (typeSelect?.value === 'work') || editService.isWorkTrain;
        // Populate run days
        const editDays = editService.runDays || [0,1,2,3,4,5,6];
        document.querySelectorAll('.sched-run-day').forEach(cb => {
          cb.checked = editDays.includes(parseInt(cb.value));
        });
        document.getElementById('sched-run-dates').value = (editService.runDates || []).join(', ');
      } else {
        this._forwardStops = [];
        this._forwardManualRoutes = [];
        this._returnStops = [];
        this._returnManualRoutes = [];
        document.getElementById('sched-name').value = '';
        document.getElementById('sched-return-name').value = '';
        this._schedReturnPlatforms = {};
        const rtCheck = document.getElementById('sched-round-trip');
        if (rtCheck) rtCheck.checked = false;
        document.getElementById('sched-multi-departures').value = '1';
        document.getElementById('sched-terminus-wait').value = '5';
        const typeSelectNew = document.getElementById('sched-service-type');
        if (typeSelectNew) typeSelectNew.value = 'passager';
        const workCheckNew = document.getElementById('sched-work-train');
        if (workCheckNew) workCheckNew.checked = false;
        // Default: all days checked, no specific dates
        document.querySelectorAll('.sched-run-day').forEach(cb => { cb.checked = true; });
        document.getElementById('sched-run-dates').value = '';
      }
      this._isReturnEditMode = false;
      this.schedStops = this._forwardStops;
      this._manualRoutes = this._forwardManualRoutes;

      // Manual-trace state for SC-04 / remaster §IV
      this._manualMode = false;
      this._manualControlPoints = [];
      this._manualStartCoords = null;
      this._manualEndCoords = null;
      this._manualRetraceLeg = null;
      this._traceEditMode = false;
      this._traceSelectedPoint = null;
      this._traceDragging = null;
      this._manualControlDrag = null;
      this._updateManualUI();

      document.getElementById('modal-schedule')?.classList.remove('hidden');

      const rameSelect = document.getElementById('sched-rame');
      const rames = this.game.rameManager.getAll();
      rameSelect.innerHTML = rames.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} (${r.maxSpeed} km/h)</option>`).join('');
      if (editService) rameSelect.value = editService.rameId;
      rameSelect.onchange = () => { this.recalcStopsFrom(1); this._renderContractPicker(); };

      this._renderContractPicker(editService?.assignedContractId || '');
      this.renderSchedStops();
      this.setupSchedMap();
    },

  _renderContractPicker(selectedId = '') {
      const row = document.getElementById('sched-contract-row');
      const select = document.getElementById('sched-contract');
      const type = document.getElementById('sched-service-type')?.value || 'passager';
      if (!row || !select) return;
      const rameId = document.getElementById('sched-rame')?.value;
      const rame = rameId ? this.game.rameManager.getById(rameId) : null;
      const hasFreight = rame && (rame.totalFreightCapacity > 0 || rame.elementDetails?.some(e => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0));
      row.style.display = (type === 'fret' || (type === 'passager' && hasFreight)) ? 'flex' : 'none';

      const contracts = this.game.freightManager?.getAllActive() || [];
      const opts = contracts.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.from} → ${c.to} : ${c.cargoName} (${c.quantity}${c.unit}) — ${c.payment.toLocaleString()} €</option>`).join('');
      select.innerHTML = '<option value="">— Aucun contrat assigné —</option>' + opts;
    },

  _calcAutoAR() {
      if (this.schedStops.length < 2) return;
      const firstDep = this.schedStops[0].depTimeMin;
      const lastArr = this.schedStops[this.schedStops.length - 1].arrTimeMin;
      const oneWayMin = lastArr - firstDep;
      if (oneWayMin <= 0) return;
      const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
      // One round trip = oneWay + terminusWait + oneWay + terminusWait
      const oneRoundTrip = (oneWayMin * 2) + (terminusWait * 2);
      const maxAR = Math.max(1, Math.floor((24 * 60) / oneRoundTrip));
      document.getElementById('sched-multi-departures').value = maxAR;

      // SC-05 — l'auto 24h nécessite un aller/retour pour générer les départs multiples.
      const rtCheck = document.getElementById('sched-round-trip');
      if (rtCheck && !rtCheck.checked) {
        rtCheck.checked = true;
        const name = document.getElementById('sched-name')?.value.trim() || 'Train';
        const rn = document.getElementById('sched-return-name');
        if (rn && !rn.value.trim()) rn.value = incrementTrailingNumber(name, 1);
        if (!this._returnStops || this._returnStops.length < 2) {
          this._returnStops = this._generateDefaultReturnStops();
        }
      }
    },

  setupSchedMap() {
      const canvas = document.getElementById('sched-map-canvas');
      if (!canvas) return;
      if (this._schedMapInterval) clearInterval(this._schedMapInterval);
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 500;

      const ctx = canvas.getContext('2d');
      const world = this.game.world;

      // Create a dedicated TileMap for the schedule map (same class as main game map)
      const mainTileMap = this.game.renderer.tileMap;
      if (!this._schedTileMap) {
        // Import TileMap constructor from main renderer's instance
        this._schedTileMap = new mainTileMap.constructor();
      }
      const tileMap = this._schedTileMap;
      tileMap.viewportWidth = canvas.width;
      tileMap.viewportHeight = canvas.height;

      // Center on stations if available, otherwise France
      if (world.stations.length > 0) {
        let sumLat = 0, sumLon = 0;
        for (const st of world.stations) { sumLat += st.lat; sumLon += st.lon; }
        tileMap.centerLat = sumLat / world.stations.length;
        tileMap.centerLon = sumLon / world.stations.length;
        tileMap.zoomLevel = world.stations.length > 5 ? 7 : 8;
      } else {
        tileMap.centerLat = 46.8;
        tileMap.centerLon = 2.3;
        tileMap.zoomLevel = 7;
      }

      // Pre-compute junction counts once
      const connectionCount = {};
      for (const track of world.tracks) {
        connectionCount[track.stationA] = (connectionCount[track.stationA] || 0) + 1;
        connectionCount[track.stationB] = (connectionCount[track.stationB] || 0) + 1;
      }

      let _schedDrawPending = false;
      const requestDraw = () => {
        if (_schedDrawPending) return;
        _schedDrawPending = true;
        requestAnimationFrame(() => { _schedDrawPending = false; drawMap(); });
      };

      const drawMap = () => {
        // Render tile layers (base map + ORM railway tiles)
        tileMap.renderTiles(ctx, canvas.width, canvas.height);

        // Viewport bounds for culling
        const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
        const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
        const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
        const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
        const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
        const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;

        // Only stations and voie points are drawn in the schedule creator map.
        // Track/troncon grey lines are hidden for readability and performance.

        // Draw stations (viewport-culled)
        const selectedIds = new Set(this.schedStops.map(s => s.stationId));
        for (const st of world.stations) {
          if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon) continue;
          const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
          const isSelected = selectedIds.has(st.id);
          const isJunction = (connectionCount[st.id] || 0) >= 3;
          ctx.fillStyle = isSelected ? '#fbbf24' : isJunction ? '#f97316' : '#3b82f6';
          const radius = isSelected ? 7 : isJunction ? 6 : 5;
          ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
          if (isJunction && !isSelected) {
            ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
          }
          // Station name label
          ctx.fillStyle = isSelected ? '#fbbf24' : isJunction ? '#fb923c' : '#94a3b8';
          ctx.font = `${tileMap.zoomLevel >= 10 ? 12 : 10}px sans-serif`;
          ctx.fillText(st.name, p.x + 10, p.y + 4);
        }

        // Draw the 'objectif' route (ORM / bon trajet) in magenta behind the actual trace.
        if (this.schedStops.length > 1) {
          ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          const drawArrow = (x, y, angle, size = 5, color = '#ff00ff') => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size / 2, -size / 2); ctx.lineTo(-size / 2, size / 2); ctx.closePath(); ctx.fill();
            ctx.restore();
          };
          const drawGeom = (geom) => {
            if (!geom || geom.length < 2) return false;
            const step = Math.max(1, Math.floor(geom.length / 80));
            ctx.beginPath();
            const p0 = tileMap.worldToScreen(geom[0].lat, geom[0].lon, canvas.width, canvas.height);
            ctx.moveTo(p0.x, p0.y);
            for (let r = step; r < geom.length; r += step) {
              const pr = tileMap.worldToScreen(geom[r].lat, geom[r].lon, canvas.width, canvas.height);
              ctx.lineTo(pr.x, pr.y);
            }
            const pL = tileMap.worldToScreen(geom[geom.length - 1].lat, geom[geom.length - 1].lon, canvas.width, canvas.height);
            ctx.lineTo(pL.x, pL.y);
            ctx.stroke();
            // Annex 18 — sens de circulation arrow along the objectif route
            if (geom.length >= 4) {
              const mid = Math.floor(geom.length / 2);
              const pMid = tileMap.worldToScreen(geom[mid].lat, geom[mid].lon, canvas.width, canvas.height);
              const pPrev = tileMap.worldToScreen(geom[mid - 1].lat, geom[mid - 1].lon, canvas.width, canvas.height);
              drawArrow(pMid.x, pMid.y, Math.atan2(pMid.y - pPrev.y, pMid.x - pPrev.x), 5, '#ff00ff');
            }
            return true;
          };
          for (let i = 0; i < this.schedStops.length - 1; i++) {
            const stopA = this.schedStops[i], stopB = this.schedStops[i + 1];
            const ca = this._getStopCoords(stopA), cb = this._getStopCoords(stopB);
            if (!ca || !cb) continue;
            // No straight-line fallback: if the objectif route is not computed yet,
            // draw nothing for this leg.
            const geom = this._schedObjectifRoutes?.[i];
            if (geom && geom.length >= 2) drawGeom(geom);
          }
          ctx.setLineDash([]);
        }

        // Draw voie points on schedule map (viewport-culled for performance)
        const vpm = this.game.voiePointManager;
        if (vpm) {
          // Get viewport bounds for culling
          const topLeft = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
          const botRight = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
          const vpMinLat = Math.min(topLeft.lat, botRight.lat) - 0.01;
          const vpMaxLat = Math.max(topLeft.lat, botRight.lat) + 0.01;
          const vpMinLon = Math.min(topLeft.lon, botRight.lon) - 0.01;
          const vpMaxLon = Math.max(topLeft.lon, botRight.lon) + 0.01;

          // Draw voie point markers — always visible, viewport-culled
          if (tileMap.zoomLevel >= 6) {
            const usedVPIds = new Set(this.schedStops.filter(s => s.voiePointId).map(s => s.voiePointId));
            for (const vp of vpm.getAll()) {
              if (vp.lat < vpMinLat || vp.lat > vpMaxLat || vp.lon < vpMinLon || vp.lon > vpMaxLon) continue;
              const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
              const isUsed = usedVPIds.has(vp.id);
              const size = 3;
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(Math.PI / 4);
              ctx.fillStyle = isUsed ? '#fbbf24' : '#0f172a';
              ctx.fillRect(-size, -size, size * 2, size * 2);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(-size, -size, size * 2, size * 2);
              ctx.restore();
              if (tileMap.zoomLevel >= 13) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '8px sans-serif';
                ctx.fillText(`Voie ${vp.voie}`, p.x + 6, p.y + 3);
              }
            }
          }
        }

        // Draw editable trace (SC-04 / remaster IV — points every 50 m).
        // Tracé actuel en jaune, points de contrôle visibles.
        if (this._manualRoutes) {
          for (let leg = 0; leg < this._manualRoutes.length; leg++) {
            const route = this._manualRoutes[leg];
            if (!route || route.length < 2) continue;

            // Yellow continuous line for the current trace
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const p0 = tileMap.worldToScreen(route[0].lat, route[0].lon, canvas.width, canvas.height);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < route.length; i++) {
              const pt = route[i];
              const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
              ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            for (let i = 0; i < route.length; i++) {
              const pt = route[i];
              const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
              const isEnd = (i === 0 || i === route.length - 1);
              const isSelected = this._traceSelectedPoint && this._traceSelectedPoint.leg === leg && this._traceSelectedPoint.control === pt;
              const isControl = pt && pt.control;
              ctx.fillStyle = isSelected ? '#38bdf8' : (isEnd ? '#f59e0b' : (isControl ? '#a5f3fc' : 'rgba(255,255,255,0.85)'));
              const radius = isSelected ? 8 : (isEnd ? 6 : (isControl ? 6 : 3.5));
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.fill();
              if (isSelected || isControl) {
                ctx.strokeStyle = isSelected ? '#fff' : '#38bdf8'; ctx.lineWidth = 1.5;
                ctx.stroke();
                // halo for grab visibility
                ctx.beginPath(); ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(56,189,248,0.35)'; ctx.lineWidth = 2; ctx.stroke();
              }
            }
          }
        }

        // Draw manual-trace in-progress control points and temporary line.
        if (this._manualMode && this._manualStartCoords) {
          ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          ctx.beginPath();
          const pStart = tileMap.worldToScreen(this._manualStartCoords.lat, this._manualStartCoords.lon, canvas.width, canvas.height);
          ctx.moveTo(pStart.x, pStart.y);
          const drawPts = [...this._manualControlPoints];
          if (this._manualEndCoords) drawPts.push(this._manualEndCoords);
          for (const pt of drawPts) {
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          for (const pt of [this._manualStartCoords, ...this._manualControlPoints]) {
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 2; ctx.stroke();
          }
          if (this._manualEndCoords) {
            const p = tileMap.worldToScreen(this._manualEndCoords.lat, this._manualEndCoords.lon, canvas.width, canvas.height);
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          }
        }

        // Stop order numbers
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        for (let i = 0; i < this.schedStops.length; i++) {
          const stop = this.schedStops[i];
          let pLat, pLon;
          if (stop.stationId) {
            const st = world.getStationById(stop.stationId);
            if (st) { pLat = st.lat; pLon = st.lon; }
          }
          if (!pLat && stop.voiePointId && this.game.voiePointManager) {
            const vp = this.game.voiePointManager.getVoiePointById(stop.voiePointId);
            if (vp) { pLat = vp.lat; pLon = vp.lon; }
          }
          if (!pLat) continue;
          const p = tileMap.worldToScreen(pLat, pLon, canvas.width, canvas.height);
          const label = stop.type === 'waypoint' ? `${i + 1}(via)` : String(i + 1);
          ctx.fillText(label, p.x - 3, p.y - 10);
          // Draw waypoint marker for map-placed waypoints
          if (stop.type === 'waypoint' && !stop.stationId) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#fff';
          }
        }
      };

      this._schedPreviewRoutes = [];
      drawMap();

      // Tile loading: periodically redraw to show loaded tiles
      this._schedMapInterval = setInterval(() => { if (document.getElementById('modal-schedule')?.classList.contains('hidden')) return; requestDraw(); }, 250);

      let schedDrag = false, schedDragStart = null, totalDragDist = 0;

      canvas.onmousedown = (e) => {
        const x = e.offsetX, y = e.offsetY;
        schedDrag = true;
        schedDragStart = { x, y };
        totalDragDist = 0;

        // 1) Manual-trace in-progress control point drag.
        if (this._manualMode && this._manualStartCoords) {
          const mp = this._findNearestManualControlPoint(x, y, tileMap, canvas);
          if (mp) {
            if (e.ctrlKey || e.button === 2) {
              this._manualControlPoints.splice(mp.index, 1);
              requestDraw();
            } else {
              this._manualControlDrag = { index: mp.index, startX: x, startY: y, moved: false };
            }
            schedDrag = false; schedDragStart = null; totalDragDist = 0;
            return;
          }
        }

        // 2) Existing route control-point drag (works in manual mode too, so nodes can be edited at any time).
        const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
        if (controlHit) {
          // Don't grab a route node if a station marker is right under the cursor.
          let nearStation = false;
          for (const st of world.stations) {
            const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
            if (Math.hypot(p.x - x, p.y - y) < 14) { nearStation = true; break; }
          }
          if (!nearStation) {
            // Promote any grabbed trace point to a control so it can be edited.
            if (controlHit.control && !controlHit.control.control) controlHit.control.control = true;
            if (e.ctrlKey || e.button === 2) {
              this._removeTraceControl(controlHit.leg, controlHit.control);
              this._traceSelectedPoint = null;
            } else {
              this._traceSelectedPoint = { leg: controlHit.leg, control: controlHit.control };
              this._traceDragging = { leg: controlHit.leg, control: controlHit.control, startX: x, startY: y, moved: false };
              requestDraw();
            }
            schedDrag = false; schedDragStart = null; totalDragDist = 0;
            return;
          }
        }
      };

      canvas.onmousemove = (e) => {
        if (this._manualControlDrag) {
          const dx = e.offsetX - this._manualControlDrag.startX;
          const dy = e.offsetY - this._manualControlDrag.startY;
          if (!this._manualControlDrag.moved && Math.hypot(dx, dy) < 4) return;
          this._manualControlDrag.moved = true;
          const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
          this._moveManualControlPoint(this._manualControlDrag.index, w.lat, w.lon);
          requestDraw();
          return;
        }
        if (this._traceDragging) {
          const dx = e.offsetX - this._traceDragging.startX;
          const dy = e.offsetY - this._traceDragging.startY;
          if (!this._traceDragging.moved && Math.hypot(dx, dy) < 4) return;
          this._traceDragging.moved = true;
          const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
          this._moveTracePoint(this._traceDragging.leg, this._traceDragging.control, w.lat, w.lon);
          requestDraw();
          return;
        }
        if (schedDrag && schedDragStart) {
          const dx = e.offsetX - schedDragStart.x;
          const dy = e.offsetY - schedDragStart.y;
          totalDragDist += Math.abs(dx) + Math.abs(dy);
          tileMap.pan(dx, dy);
          schedDragStart = { x: e.offsetX, y: e.offsetY };
          requestDraw();
          return;
        }
        // Hover feedback
        const x = e.offsetX, y = e.offsetY;
        let cursor = 'default';
        const manualPt = (this._manualMode && this._manualStartCoords) ? this._findNearestManualControlPoint(x, y, tileMap, canvas) : null;
        const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
        if (manualPt || controlHit) cursor = 'grab';
        else {
          if (this.game.voiePointManager) {
            for (const vp of this.game.voiePointManager.getAll()) {
              const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
              if (Math.hypot(p.x - x, p.y - y) < 12) { cursor = 'pointer'; break; }
            }
          }
          if (cursor === 'default') {
            for (const st of world.stations) {
              const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
              if (Math.hypot(p.x - x, p.y - y) < 16) { cursor = 'pointer'; break; }
            }
          }
        }
        canvas.style.cursor = cursor;
      };

      canvas.onmouseup = async (e) => {
        // SC-XX — insertion d'un arrêt entre deux arrêts existants (remarque joueur).
        if (this._insertAfterIndex != null) {
          if (totalDragDist < 5) {
            const x = e.offsetX, y = e.offsetY;
            let closestVP = null, minVPDist = Infinity;
            if (this.game.voiePointManager) {
              for (const vp of this.game.voiePointManager.getAll()) {
                const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < minVPDist && d < 15) { minVPDist = d; closestVP = vp; }
              }
            }
            let closest = null, minDist = Infinity;
            for (const st of world.stations) {
              const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minDist && d < 20) { minDist = d; closest = st; }
            }
            if (closestVP && minVPDist < minDist) {
              await this._insertStopFromMap(this._insertAfterIndex, closestVP);
            } else if (closest) {
              await this._insertStopFromMap(this._insertAfterIndex, closest);
            }
          }
          this._insertAfterIndex = null;
          this._updateManualUI();
          schedDrag = false; schedDragStart = null; totalDragDist = 0;
          return;
        }

        if (this._manualControlDrag) {
          const wasMoved = this._manualControlDrag.moved;
          this._manualControlDrag = null;
          if (wasMoved) {
            schedDrag = false; schedDragStart = null; totalDragDist = 0;
            return;
          }
          // A simple click on an in-progress control point does nothing.
          schedDrag = false; schedDragStart = null; totalDragDist = 0;
          return;
        }

        if (this._traceDragging) {
          const dw = this._traceDragging; this._traceDragging = null;
          if (dw.moved) {
            // End of a trace-point drag: recompute travel times from this leg onward.
            await this._recalcAfterTraceEdit(dw.leg);
            this.game.saveState();
          } else if (this._manualEndCoords && dw.control === this._manualEndCoords) {
            // In a manual retrace, clicking (not dragging) the target anchor finishes the segment.
            await this._finishManualRetrace();
          }
          schedDrag = false; schedDragStart = null; totalDragDist = 0;
          return;
        }
        if (totalDragDist < 5) {
          const x = e.offsetX, y = e.offsetY;

          // Manual trace mode (SC-04): choose a start point, add waypoints, then click a target point to finish — like livemap.
          // Also supports deleting an existing control point to redraw its segment by hand.
          if (this._manualMode) {
            const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);

            // Retrace in progress: finish by clicking the target end control, or add another point.
            if (this._manualEndCoords) {
              const pEnd = tileMap.worldToScreen(this._manualEndCoords.lat, this._manualEndCoords.lon, canvas.width, canvas.height);
              if (Math.hypot(pEnd.x - x, pEnd.y - y) <= 20) {
                await this._finishManualRetrace();
              } else {
                this._addManualPoint(worldPos.lat, worldPos.lon);
              }
              schedDrag = false; schedDragStart = null;
              return;
            }

            let closestVP = null, minVPDist = Infinity;
            if (this.game.voiePointManager) {
              for (const vp of this.game.voiePointManager.getAll()) {
                const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < minVPDist && d < 15) { minVPDist = d; closestVP = vp; }
              }
            }
            let closest = null, minDist = Infinity;
            for (const st of world.stations) {
              const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minDist && d < 20) { minDist = d; closest = st; }
            }

            if (!this._manualStartCoords) {
              // Livemap-style: first click on a station/voie point sets the departure.
              if (!closest && !closestVP) {
                this._updateManualUI();
                schedDrag = false; schedDragStart = null;
                return;
              }
              // If this is the very first stop of the service, add it now.
              if (this.schedStops.length === 0) {
                if (closestVP && minVPDist < minDist) {
                  await this.addSchedVoiePointStop(closestVP);
                } else if (closest) {
                  await this.addSchedStop(closest);
                }
              }
              const lastStop = this.schedStops[this.schedStops.length - 1];
              this._manualStartCoords = this._getStopCoords(lastStop);
              const rameId2 = document.getElementById('sched-rame')?.value;
              const rame2 = this.game.rameManager.getById(rameId2);
              this._manualStartCoords.maxSpeed = rame2 ? rame2.maxSpeed : 30;
              this._manualControlPoints = [];
              this._updateManualUI();
              if (this._drawSchedMap) this._drawSchedMap();
              schedDrag = false; schedDragStart = null;
              return;
            }

            if (closestVP && minVPDist < minDist) {
              await this.addSchedVoiePointStop(closestVP);
            } else if (closest) {
              await this.addSchedStop(closest);
            } else {
              // SC-XX — ajout direct d'un point de contrôle manuel pour un tracé libre "My Maps".
              this._addManualPoint(worldPos.lat, worldPos.lon);
            }
            schedDrag = false; schedDragStart = null;
            return;
          }

          // Shift + click on a segment: insert a new 50 m trace point.
          if (e.shiftKey) {
            const seg = this._findNearestSegmentPoint(x, y, tileMap, canvas);
            if (seg) {
              this._insertTracePoint(seg.leg, seg.index, seg.lat, seg.lon);
              await this._recalcAfterTraceEdit(seg.leg);
              return;
            }
          }

          // Check voie points first
          let closestVP = null, minVPDist = Infinity;
          if (this.game.voiePointManager) {
            for (const vp of this.game.voiePointManager.getAll()) {
              const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minVPDist && d < 15) { minVPDist = d; closestVP = vp; }
            }
          }

          // Check stations
          let closest = null, minDist = Infinity;
          for (const st of world.stations) {
            const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist && d < 20) { minDist = d; closest = st; }
          }

          if (closestVP && minVPDist < minDist) {
            await this.addSchedVoiePointStop(closestVP);
          } else if (closest) {
            await this.addSchedStop(closest);
          } else if (e.shiftKey) {
            // Shift + click on empty space: add a map waypoint snapped to track.
            const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
            await this._addMapWaypoint(worldPos.lat, worldPos.lon);
          }
        }
        schedDrag = false;
        schedDragStart = null;
      };

      // Double-click a trace point to re-draw the segment around it.
      canvas.ondblclick = (e) => {
        const x = e.offsetX, y = e.offsetY;
        this._manualControlPoints = [];
        this._manualControlDrag = null;
        this._traceDragging = null;
        const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
        if (controlHit) {
          this._manualMode = true;
          this._startManualRetrace(controlHit.leg, controlHit.index);
        }
      };

      canvas.onwheel = (e) => {
        e.preventDefault();
        tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
        requestDraw();
      };
      canvas.oncontextmenu = (e) => { e.preventDefault(); };

      this._drawSchedMap = drawMap;

      // Map search bar (Annexe 10a)
      const searchInput = document.getElementById('sched-map-search');
      if (searchInput) {
        searchInput.onkeydown = (e) => {
          if (e.key !== 'Enter') return;
          const q = searchInput.value.trim().toLowerCase();
          if (!q) return;
          let best = null;
          for (const st of world.stations) {
            if (st.name?.toLowerCase().includes(q)) { best = st; break; }
          }
          if (!best && this.game.voiePointManager) {
            for (const vp of this.game.voiePointManager.getAll()) {
              if (vp.name?.toLowerCase().includes(q) || (vp.voie && String(vp.voie).toLowerCase().includes(q))) { best = vp; break; }
            }
          }
          if (best) {
            tileMap.centerLat = best.lat;
            tileMap.centerLon = best.lon;
            tileMap.zoomLevel = Math.max(tileMap.zoomLevel, 13);
            requestDraw();
          }
        };
      }

      this._recalcPreviewRoutes();
    },

  _toggleManualMode() {
      if (this._manualMode) {
        // cancel manual mode, keep control points? If no next stop yet, just exit
        this._manualMode = false;
        this._manualStartCoords = null;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._manualControlPoints = [];
      } else {
        this._manualMode = true;
        this._manualStartCoords = this.schedStops.length > 0 ? this._getStopCoords(this.schedStops[this.schedStops.length - 1]) : null;
        if (this._manualStartCoords) {
          const rameId = document.getElementById('sched-rame')?.value;
          const rame = this.game.rameManager.getById(rameId);
          this._manualStartCoords.maxSpeed = rame ? rame.maxSpeed : 30;
        }
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._manualControlPoints = [];
      }
      this._updateManualUI();
      if (this._drawSchedMap) this._drawSchedMap();
    },

  _clearManualTrace() {
      this._manualRoutes[this._manualRoutes.length - 1] = null;
      this._manualControlPoints = [];
      this._manualMode = false;
      this._manualStartCoords = null;
      this._manualEndCoords = null;
      this._manualRetraceLeg = null;
      this._manualControlDrag = null;
      this._updateManualUI();
      this._recalcPreviewRoutes();
    },

  _updateManualUI() {
      const btn = document.getElementById('btn-sched-manual');
      const clear = document.getElementById('btn-sched-clear-manual');
      const edit = document.getElementById('btn-sched-edit-trace');
      const del = document.getElementById('btn-sched-delete-point');
      const hint = document.getElementById('sched-manual-hint');
      const returnBtn = document.getElementById('btn-sched-return-mode');
      const modeLabel = document.getElementById('sched-mode-label');
      const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
      if (returnBtn) {
        returnBtn.classList.toggle('hidden', !roundTrip || this._forwardStops.length < 2);
        returnBtn.textContent = this._isReturnEditMode ? 'Retour aller' : 'Tracer le retour';
      }
      if (modeLabel) {
        modeLabel.textContent = this._isReturnEditMode ? 'Retour' : 'Aller';
        modeLabel.style.background = this._isReturnEditMode ? '#7c3aed' : 'var(--bg2)';
        modeLabel.style.color = this._isReturnEditMode ? '#fff' : 'var(--text2)';
      }
      if (!btn || !clear || !hint) return;
      const hasTrace = this._manualRoutes && this._manualRoutes.some(r => r && r.length >= 2);
      if (edit) edit.classList.toggle('hidden', !hasTrace);
      if (del) del.classList.toggle('hidden', !this._traceSelectedPoint);
      if (this._insertAfterIndex != null) {
        hint.textContent = `Insertion après l'arrêt ${this._insertAfterIndex + 1} — cliquez sur une gare ou un point de voie sur la carte. Échap pour annuler.`;
        return;
      }
      if (this._manualMode) {
        const hasStart = !!this._manualStartCoords;
        const isRetrace = this._manualEndCoords != null;
        if (isRetrace) {
          btn.textContent = 'Terminer le retracé';
          hint.textContent = 'Retracez le segment supprimé — cliquez pour ajouter des points, puis cliquez sur le point d\'arrivée pour terminer.';
        } else {
          btn.textContent = hasStart ? 'Terminer (cliquer gare/point)' : 'Choisir le départ';
          hint.textContent = hasStart
            ? 'Mode manuel actif — cliquez pour poser des points, gare/point de voie pour terminer ce segment.'
            : 'Mode manuel — cliquez sur la gare ou le point de voie de départ (comme sur la livemap).';
        }
        btn.style.background = '#3b82f6';
        btn.style.color = '#fff';
        clear.classList.remove('hidden');
      } else {
        btn.textContent = 'Tracer manuellement (points 50 m)';
        btn.style.background = '';
        btn.style.color = '';
        clear.classList.add('hidden');
        const base = "Cliquer sur les gares de la carte pour définir le trajet. Les horaires sont calculés automatiquement depuis les données ORM et la rame.";
        const editHint = hasTrace ? " Attrapez un point blanc pour déplacer le tracé, Shift+clic sur un segment pour ajouter un point, Ctrl+clic pour supprimer." : '';
        hint.textContent = base + editHint;
      }
    },

  async _toggleReturnEditMode() {
      const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
      if (!roundTrip) return;
      if (this._forwardStops.length < 2) return alertToast('Definissez d\'abord un aller avec au moins 2 arrets.');

      if (this._isReturnEditMode) {
        // Switch back to forward mode: capture return edits first.
        this._returnStops = this.schedStops;
        this._returnManualRoutes = this._manualRoutes;
        this.schedStops = this._forwardStops;
        this._manualRoutes = this._forwardManualRoutes;
        this._isReturnEditMode = false;
      } else {
        // Switch to return mode: capture forward edits and seed a default return if empty.
        this._forwardStops = this.schedStops;
        this._forwardManualRoutes = this._manualRoutes;
        if (!this._returnStops || this._returnStops.length < 2) {
          this._returnStops = this._generateDefaultReturnStops();
          this._returnManualRoutes = this._generateDefaultReturnRoutes();
          await this._recalcReturnTimes();
        }
        this.schedStops = this._returnStops;
        this._manualRoutes = this._returnManualRoutes;
        this._isReturnEditMode = true;
      }
      this._traceSelectedPoint = null;
      this._traceDragging = null;
      this._manualControlDrag = null;
      this._manualMode = false;
      this._manualControlPoints = [];
      this._manualStartCoords = null;
      this._manualEndCoords = null;
      this._manualRetraceLeg = null;
      this._updateManualUI();
      this.renderSchedStops();
      this._recalcPreviewRoutes();
    },

  _generateDefaultReturnStops() {
      const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
      const fwd = this._forwardStops;
      if (fwd.length < 2) return [];
      const rev = [...fwd].reverse();
      const lastArr = rev[0].arrTimeMin ?? rev[0].depTimeMin ?? 0;
      let currentTime = lastArr + terminusWait;
      const out = [];
      for (let i = 0; i < rev.length; i++) {
        const s = rev[i];
        let travelTime = 0;
        if (i > 0) {
          // Reuse the forward segment durations in reverse order.
          const earlierIdx = fwd.length - 1 - i;
          const laterIdx = fwd.length - i;
          travelTime = Math.max(0, (fwd[laterIdx]?.arrTimeMin ?? 0) - (fwd[earlierIdx]?.depTimeMin ?? 0));
          if (travelTime <= 0) travelTime = 15;
        }
        const arrTime = currentTime + travelTime;
        const dwell = (s.type === 'arret' && i > 0 && i < rev.length - 1)
          ? Math.max(2, (s.depTimeMin ?? 0) - (s.arrTimeMin ?? 0))
          : 0;
        const depTime = arrTime + dwell;
        currentTime = depTime;
        // Mirror platform swap from ActiveService.buildReturnStops.
        let returnPlat = s.platform || '';
        if (returnPlat === '1' || returnPlat === 'Voie 1') returnPlat = '2';
        else if (returnPlat === '2' || returnPlat === 'Voie 2') returnPlat = '1';
        else if (/^\d+$/.test(returnPlat)) {
          const n = parseInt(returnPlat, 10);
          returnPlat = String(n % 2 === 0 ? n - 1 : n + 1);
        }
        out.push({
          stationId: s.stationId,
          voiePointId: s.voiePointId || null,
          stationName: this._stopNameFor(s.stationId, s.voiePointId),
          type: s.type,
          stopCode: s.stopCode || '',
          arrTimeMin: arrTime,
          depTimeMin: depTime,
          arrTimeStr: this.minToTimeStr(arrTime),
          depTimeStr: this.minToTimeStr(depTime),
          platform: returnPlat,
        });
      }
      return out;
    },

  _generateDefaultReturnRoutes() {
      const rev = (this._forwardManualRoutes || []).slice().reverse();
      return rev.map(r => {
        if (!r || r.length < 2) return null;
        // Reverse the ordered lat/lon list for the return direction.
        const reversed = [...r].reverse().map(p => ({ ...p }));
        return this._densifyRoute(reversed);
      });
    },

  async _recalcReturnTimes() {
      if (!this._returnStops || this._returnStops.length < 2) return;
      const rameId = document.getElementById('sched-rame').value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 120;
      for (let i = 1; i < this._returnStops.length; i++) {
        const prev = this._returnStops[i - 1], cur = this._returnStops[i];
        const travelTime = await this._getSegmentTravelTime(prev, cur, rameSpeed, rame, i - 1);
        cur.arrTimeMin = prev.depTimeMin + travelTime;
        cur.depTimeMin = cur.arrTimeMin + (cur.type === 'arret' ? 2 : 0);
        cur.arrTimeStr = this.minToTimeStr(cur.arrTimeMin);
        cur.depTimeStr = this.minToTimeStr(cur.depTimeMin);
      }
    },

  _stopNameFor(stationId, voiePointId) {
      if (stationId) {
        const st = this.game.world.getStationById(stationId);
        if (st) return st.name;
      }
      if (voiePointId) {
        const vp = this.game.voiePointManager?.getVoiePointById(voiePointId);
        if (vp) return `Voie ${vp.voie}`;
      }
      return stationId || voiePointId || '';
    },

  _toggleTraceEdit() {
      this._traceEditMode = !this._traceEditMode;
      if (!this._traceEditMode) this._traceSelectedPoint = null;
      this._updateManualUI();
      if (this._drawSchedMap) this._drawSchedMap();
    },

  _deleteSelectedTracePoint() {
      if (!this._traceSelectedPoint) return;
      this._removeTraceControl(this._traceSelectedPoint.leg, this._traceSelectedPoint.control);
      this._traceSelectedPoint = null;
      this._updateManualUI();
    },

  _removeTraceControl(leg, control) {
      if (!control) return;
      const route = this._manualRoutes[leg];
      if (!route) return;
      const controls = this._extractRouteControls(route);
      const idx = controls.indexOf(control);
      if (idx <= 0 || idx >= controls.length - 1) return;
      controls.splice(idx, 1);
      this._manualRoutes[leg] = this._densifyRoute(controls);
      this._recalcAfterTraceEdit(leg);
    },

  _addManualPoint(lat, lon) {
      if (this._manualStartCoords) {
        const maxSpeed = this._manualStartCoords.maxSpeed || 30;
        const snapped = this._snapToTrack(lat, lon);
        this._manualControlPoints.push({ lat: snapped ? snapped.lat : lat, lon: snapped ? snapped.lon : lon, maxSpeed });
        if (this._drawSchedMap) this._drawSchedMap();
      }
    },

  _finishManualLeg(endStop, maxSpeed = 30) {
      if (!this._manualMode || !this._manualStartCoords) return;
      const endCoords = this._getStopCoords(endStop);
      if (!endCoords) return;
      endCoords.maxSpeed = maxSpeed;
      const route = this._buildManualRoute(this._manualStartCoords, this._manualControlPoints, endCoords, maxSpeed);
      const legIdx = Math.max(0, this.schedStops.length - 1); // leg between last existing stop and endStop
      this._manualRoutes[legIdx] = route;
      // Stay in manual mode and continue from the new stop (My Maps style)
      this._manualControlPoints = [];
      this._manualStartCoords = endCoords;
      this._manualEndCoords = null;
      this._manualRetraceLeg = null;
      this._updateManualUI();
    },

  _startManualRetrace(leg, routeIndex) {
      const route = this._manualRoutes[leg];
      if (!route || route.length < 3) return;
      let startIdx = routeIndex;
      let endIdx = routeIndex;
      // Find the previous control point (or start of route)
      while (startIdx >= 0 && !route[startIdx]?.control) startIdx--;
      if (startIdx < 0) startIdx = 0;
      if (!route[startIdx].control) route[startIdx].control = true;
      // Find the next control point (or end of route)
      endIdx = startIdx + 1;
      while (endIdx < route.length && !route[endIdx]?.control) endIdx++;
      if (endIdx >= route.length) endIdx = route.length - 1;
      if (!route[endIdx].control) route[endIdx].control = true;
      if (startIdx >= endIdx) return;
      this._manualMode = true;
      this._manualRetraceLeg = leg;
      this._manualStartCoords = route[startIdx];
      this._manualEndCoords = route[endIdx];
      this._manualControlPoints = [];
      // Strip the old segment between the fixed controls; it will be redrawn by hand.
      this._manualRoutes[leg] = [...route.slice(0, startIdx + 1), ...route.slice(endIdx)];
      this._updateManualUI();
      if (this._drawSchedMap) this._drawSchedMap();
    },

  async _finishManualRetrace() {
      if (!this._manualMode || this._manualRetraceLeg == null || !this._manualStartCoords || !this._manualEndCoords) return;
      const leg = this._manualRetraceLeg;
      const newSegment = this._densifyRoute([this._manualStartCoords, ...this._manualControlPoints, this._manualEndCoords], 0.05);
      const route = this._manualRoutes[leg] || [];
      const startIdx = route.indexOf(this._manualStartCoords);
      const endIdx = route.indexOf(this._manualEndCoords);
      if (startIdx >= 0 && endIdx >= 0 && startIdx < endIdx) {
        this._manualRoutes[leg] = [...route.slice(0, startIdx + 1), ...newSegment.slice(1, -1), ...route.slice(endIdx)];
      } else {
        this._manualRoutes[leg] = newSegment;
      }
      this._manualMode = false;
      this._manualControlPoints = [];
      this._manualStartCoords = null;
      this._manualEndCoords = null;
      this._manualRetraceLeg = null;
      this._updateManualUI();
      await this._recalcAfterTraceEdit(leg);
    },

  _buildManualRoute(start, controls, end, maxSpeed = 30) {
      const points = [{ ...start, maxSpeed, control: true }, ...controls.map(p => ({ ...p, maxSpeed, control: true })), { ...end, maxSpeed, control: true }];
      return this._densifyRoute(points, 0.05);
    },

  openSillonPicker(sillons, fromName, toName) {
      return new Promise((resolve) => {
        this._pendingSillonResolve = resolve;
        const modal = document.getElementById('modal-sillon-picker');
        const list = document.getElementById('sillon-picker-list');
        if (!modal || !list) return resolve(null);
        list.innerHTML = `
          <div class="sillon-item" style="margin-bottom:6px;cursor:pointer" onclick="game.ui._resolveSillonPicker('orm')">
            <div><b>Itinéraire ORM automatique</b><br><span>Calcul normal entre ${fromName} et ${toName}</span></div>
          </div>
          ${sillons.map((s, i) => `
            <div class="sillon-item" style="cursor:pointer" onclick="game.ui._resolveSillonPicker(${i})">
              <div><b>${s.name}</b> — ${s.fromStationName} → ${s.toStationName}<br><span>${Math.round(s.distance)} km · Vmax ${s.maxSpeed} km/h · ${s.electrified !== false ? 'électrifié' : 'non électrifié'}</span></div>
            </div>
          `).join('')}
        `;
        modal.classList.remove('hidden');
      });
    },

  _resolveSillonPicker(index) {
      const modal = document.getElementById('modal-sillon-picker');
      if (modal) modal.classList.add('hidden');
      if (this._pendingSillonResolve) {
        const resolve = this._pendingSillonResolve;
        this._pendingSillonResolve = null;
        resolve(index);
      }
    },

  async _pickSillonForLeg(prevStop, newStop, legIdx) {
      if (!this.game.sillonManager || !prevStop?.stationId || !newStop?.stationId) return null;
      // Section V : propose direct + chained (multi-hop) auto-sillon paths.
      const paths = this.game.sillonManager.findPaths(prevStop.stationId, newStop.stationId, 4);
      if (!paths.length) return null;

      const prevName = prevStop.stationName;
      const newName = newStop.stationName;
      const choice = await this.openSillonPicker(paths, prevName, newName);
      if (choice === null || choice === 'orm') return null;

      const path = paths[choice];
      if (!path || !path.route?.length) return null;

      // Densify to 50 m points like manual trace.
      const route = this._densifyRoute(path.route.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: p.maxSpeed || path.maxSpeed })));
      if (!this._manualRoutes) this._manualRoutes = [];
      this._manualRoutes[legIdx] = route;
      this._sillonLegSelection = this._sillonLegSelection || {};
      this._sillonLegSelection[legIdx] = path.name;
      return route;
    },

  async addSchedStop(station) {
      if (station.closed) {
        alertToast('Cette gare est fermee — aucun train ne peut la desservir.');
        return;
      }
      const rameId = document.getElementById('sched-rame').value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 160;

      let arrTimeMin, depTimeMin;
      const newStop = {
        stationId: station.id,
        stationName: station.name,
        type: 'arret',
        stopCode: '',
        arrTimeMin: 0,
        depTimeMin: 0,
        arrTimeStr: '00:00',
        depTimeStr: '00:00',
        platform: '',
      };

      if (this.schedStops.length === 0) {
        const pt = this.game.engine.getParisTime();
        const currentMin = pt.hours * 60 + pt.minutes;
        arrTimeMin = Math.ceil(currentMin / 5) * 5;
        depTimeMin = arrTimeMin;
      } else {
        const prevStop = this.schedStops[this.schedStops.length - 1];
        const legIdx = this.schedStops.length - 1;
        if (this._manualMode) {
          this._finishManualLeg(newStop, rameSpeed);
        } else if (this.game.sillonManager) {
          // Section V : propose pre-defined sillons for this segment.
          await this._pickSillonForLeg(prevStop, newStop, legIdx);
        }
        const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, legIdx);
        arrTimeMin = prevStop.depTimeMin + travelTime;
        depTimeMin = arrTimeMin + 2;
      }

      newStop.arrTimeMin = arrTimeMin;
      newStop.depTimeMin = depTimeMin;
      newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
      newStop.depTimeStr = this.minToTimeStr(depTimeMin);
      this.schedStops.push(newStop);

      this.renderSchedStops();
      this._recalcPreviewRoutes();
    },

  async addSchedVoiePointStop(voiePoint) {
      // Add voie point as invisible waypoint (no stop, no time, just passage obligé)
      const rameId = document.getElementById('sched-rame').value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 160;

      // If voie point is linked to a station, show "GareName — Voie X"
      let vpName = `Voie ${voiePoint.voie}`;
      let vpStationId = null;
      if (voiePoint.stationId) {
        const st = this.game.world.getStationById(voiePoint.stationId);
        if (st) { vpName = `${st.name} — Voie ${voiePoint.voie}`; vpStationId = st.id; }
      }

      const newStop = {
        stationId: vpStationId,
        voiePointId: voiePoint.id,
        stationName: vpName,
        type: 'waypoint',
        stopCode: '',
        arrTimeMin: 0,
        depTimeMin: 0,
        arrTimeStr: '00:00',
        depTimeStr: '00:00',
        platform: voiePoint.voie,
      };

      let arrTimeMin, depTimeMin;
      if (this.schedStops.length === 0) {
        const pt = this.game.engine.getParisTime();
        const currentMin = pt.hours * 60 + pt.minutes;
        arrTimeMin = Math.ceil(currentMin / 5) * 5;
        depTimeMin = arrTimeMin;
      } else {
        const prevStop = this.schedStops[this.schedStops.length - 1];
        const legIdx = this.schedStops.length - 1;
        if (this._manualMode) {
          this._finishManualLeg(newStop, rameSpeed);
        } else if (this.game.sillonManager) {
          // Section V : propose pre-defined sillons between voie points / stations too.
          await this._pickSillonForLeg(prevStop, newStop, legIdx);
        }
        const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, legIdx);
        arrTimeMin = prevStop.depTimeMin + travelTime;
        depTimeMin = arrTimeMin; // no stop time for waypoint
      }

      newStop.arrTimeMin = arrTimeMin;
      newStop.depTimeMin = depTimeMin;
      newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
      newStop.depTimeStr = this.minToTimeStr(depTimeMin);
      this.schedStops.push(newStop);

      this.renderSchedStops();
      this._recalcPreviewRoutes();
    },

  async _addMapWaypoint(lat, lon) {
      if (this.schedStops.length === 0) return; // need at least one stop first

      const vpm = this.game.voiePointManager;
      // Try to snap to nearest tronçon route point
      let snappedLat = lat, snappedLon = lon;
      let bestDist = Infinity;
      for (const trc of vpm.getAllTroncons()) {
        if (!trc.route) continue;
        for (const pt of trc.route) {
          const d = Math.sqrt(Math.pow((pt.lat - lat) * 111, 2) + Math.pow((pt.lon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2));
          if (d < bestDist) { bestDist = d; snappedLat = pt.lat; snappedLon = pt.lon; }
        }
      }

      // If no tronçon nearby, try ORM snap
      if (bestDist > 2) {
        try {
          const snapResult = await this.game.orm.snapToRailway(lat, lon, 2);
          if (snapResult) { snappedLat = snapResult.lat; snappedLon = snapResult.lon; bestDist = snapResult.dist; }
        } catch (e) { /* keep original coords */ }
      }

      // Only add if within reasonable distance of a railway (5km)
      if (bestDist > 5) return;

      // Create a temporary voie point for this waypoint
      const vpId = `vp-wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      vpm.addVoiePoint({ id: vpId, lat: snappedLat, lon: snappedLon, voie: 'WP', stationId: null });

      const rameId = document.getElementById('sched-rame').value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 160;

      // SC-10 — insert the waypoint on the nearest INTERIOR segment so the
      // following stops are preserved; append only when the click is past the end.
      let insertIndex = this.schedStops.length;
      if (this.schedStops.length >= 2) {
        let best = Infinity, bestSeg = -1, bestT = 0;
        for (let i = 0; i < this.schedStops.length - 1; i++) {
          const a = this._getStopCoords(this.schedStops[i]);
          const b = this._getStopCoords(this.schedStops[i + 1]);
          if (!a || !b) continue;
          const r = this._pointSegDistKm(snappedLat, snappedLon, a, b);
          if (r.dist < best) { best = r.dist; bestSeg = i; bestT = r.t; }
        }
        if (bestSeg >= 0 && bestT > 0.05 && bestT < 0.95) insertIndex = bestSeg + 1;
      }

      const prevStop = this.schedStops[insertIndex - 1];
      const newStop = {
        stationId: null,
        voiePointId: vpId,
        stationName: `Waypoint (${snappedLat.toFixed(4)}, ${snappedLon.toFixed(4)})`,
        type: 'waypoint',
        stopCode: '',
        arrTimeMin: 0,
        depTimeMin: 0,
        arrTimeStr: '00:00',
        depTimeStr: '00:00',
        platform: '',
      };
      const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, insertIndex - 1);
      const arrTimeMin = (prevStop.depTimeMin || 0) + travelTime;

      newStop.arrTimeMin = arrTimeMin;
      newStop.depTimeMin = arrTimeMin;
      newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
      newStop.depTimeStr = this.minToTimeStr(arrTimeMin);
      this.schedStops.splice(insertIndex, 0, newStop);
      this._adjustManualRoutesForInsert(insertIndex);

      // Recompute the stops that follow the inserted waypoint (none are removed).
      if (insertIndex < this.schedStops.length - 1) {
        await this.recalcStopsFrom(insertIndex + 1);
      }

      this.renderSchedStops();
      this._recalcPreviewRoutes();
      this.game.saveState();
    },

  _pointSegDistKm(lat, lon, a, b) {
      const kx = 111 * Math.cos(lat * Math.PI / 180), ky = 111;
      const ax = a.lon * kx, ay = a.lat * ky, bx = b.lon * kx, by = b.lat * ky;
      const px = lon * kx, py = lat * ky;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy;
      return { dist: Math.hypot(px - cx, py - cy), t };
    },

  minToTimeStr(m) {
      const h = Math.floor(m / 60) % 24;
      const min = m % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    },

  timeStrToMin(s) {
      const [h, m] = s.split(':').map(Number);
      return h * 60 + (m || 0);
    },

  incrementTime(timeStr, minutes) {
      return this.minToTimeStr(this.timeStrToMin(timeStr) + minutes);
    },

  renderSchedStops() {
      const container = document.getElementById('sched-stops-list');
      if (!container) return;

      if (this.schedStops.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte ci-dessus</p>';
        return;
      }

      if (!this._schedReturnPlatforms) this._schedReturnPlatforms = {};

      const header = `<div class="sched-stops-header"><span title="Numéro d'ordre">#</span><span>Gare</span><span title="Type d'arrêt (arrêt / passage / waypoint)">Type</span><span title="C = Commercial, S = Service, [] = sautable (25%)">Code</span><span>Arr</span><span>Dép</span><span>Arrêt</span><span>Voie</span><span></span></div>`;

      container.innerHTML = header + this.schedStops.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === this.schedStops.length - 1;
        const travelInfo = (i > 0) ? (() => {
          const prev = this.schedStops[i - 1];
          const travelMin = stop.arrTimeMin - prev.depTimeMin;
          return `<div style="font-size:9px;color:var(--text3);text-align:center;padding:1px 0">↓ ${travelMin} min</div>`;
        })() : '';

        // Platform selector (for arret and waypoint stops)
        let platformSelect = '';
        if (stop.voiePointId) {
          // Voie point: voie is fixed, show as label
          platformSelect = `<span style="font-size:9px;color:#94a3b8;font-weight:600">Voie ${stop.platform || '?'}</span>`;
        } else if (stop.type === 'arret' || stop.type === 'waypoint') {
          const station = this.game.world.getStationById(stop.stationId);
          if (station) {
            // Check if station has voie points linked
            const stVPs = this.game.voiePointManager?.getStationVoiePoints(station.id) || [];
            let options = '<option value="">Auto</option>';
            if (stVPs.length > 0) {
              for (const svp of stVPs) {
                const sel = stop.platform === svp.voie ? 'selected' : '';
                options += `<option value="${svp.voie}" ${sel}>Voie ${svp.voie}</option>`;
              }
            } else if (station.platforms > 0) {
              const names = station.platformNames || [];
              for (let p = 1; p <= station.platforms; p++) {
                const pName = names[p - 1] || String(p);
                const sel = stop.platform === pName ? 'selected' : '';
                options += `<option value="${pName}" ${sel}>Voie ${pName}</option>`;
              }
            }
            platformSelect = `<select style="width:70px" onchange="game.ui.updateSchedStop(${i}, 'platform', this.value)">${options}</select>`;
          }
        }

        const arrCell = stop.type === 'waypoint' || stop.type === 'passage' || !isFirst
          ? `<input type="text" value="${stop.arrTimeStr}" placeholder="${stop.type === 'waypoint' ? 'Via' : 'Arr'}" title="Heure ${stop.type === 'waypoint' ? 'de passage' : 'd\'arrivée'}" onchange="game.ui.updateSchedStop(${i}, 'arrTime', this.value)">`
          : '';
        const depCell = (stop.type === 'arret' || stop.type === 'passage') && !isLast
          ? `<input type="text" value="${stop.depTimeStr || stop.arrTimeStr}" placeholder="Dép" title="Heure de départ" onchange="game.ui.updateSchedStop(${i}, 'depTime', this.value)">`
          : '';
        const dwellCell = (stop.type === 'arret' && !isFirst && !isLast)
          ? `<div style="display:flex;align-items:center;gap:2px"><input type="number" value="${Math.max(0, (stop.depTimeMin || 0) - (stop.arrTimeMin || 0))}" min="0" max="120" title="Temps d'arrêt" style="width:48px" onchange="game.ui.updateSchedStop(${i}, 'stopDuration', this.value)"><span style="font-size:9px;color:var(--text3);white-space:nowrap">min</span></div>`
          : '';

        return `
          ${travelInfo}
          <div class="sched-stop-row">
            <span style="color:var(--text3);font-size:10px;text-align:center">${i + 1}</span>
            <span class="stop-name" title="${stop.stationName}">${stop.stationName}</span>
            <select onchange="game.ui.updateSchedStop(${i}, 'type', this.value)" title="Type d'arrêt">
              <option value="arret" ${stop.type === 'arret' ? 'selected' : ''}>Arrêt</option>
              <option value="passage" ${stop.type === 'passage' ? 'selected' : ''}>Passage</option>
              <option value="waypoint" ${stop.type === 'waypoint' ? 'selected' : ''}>Waypoint</option>
            </select>
            <select onchange="game.ui.updateSchedStop(${i}, 'stopCode', this.value)" title="C=Commercial, S=Service, []=sautable (25%)">
              <option value="" ${!stop.stopCode ? 'selected' : ''}>-</option>
              <option value="C" ${stop.stopCode === 'C' ? 'selected' : ''}>C</option>
              <option value="S" ${stop.stopCode === 'S' ? 'selected' : ''}>S</option>
              <option value="[C]" ${stop.stopCode === '[C]' ? 'selected' : ''}>[C]</option>
              <option value="[S]" ${stop.stopCode === '[S]' ? 'selected' : ''}>[S]</option>
            </select>
            ${arrCell ? `<div>${arrCell}</div>` : '<div></div>'}
            ${depCell ? `<div>${depCell}</div>` : '<div></div>'}
            ${dwellCell ? `<div>${dwellCell}</div>` : '<div></div>'}
            <div>${platformSelect}</div>
            <div class="stop-actions">
              <button class="btn-add-stop" onclick="game.ui.startInsertStop(${i})" title="Insérer un arrêt après">+</button>
              <button class="btn-remove-stop" onclick="game.ui.removeSchedStop(${i})" title="Supprimer cet arrêt">x</button>
            </div>
          </div>
        `;
      }).join('');

      // Add return leg stops if round-trip is checked and we are not already editing the return.
      const rtChecked = document.getElementById('sched-round-trip')?.checked;
      if (rtChecked && this.schedStops.length >= 2 && !this._isReturnEditMode) {
        const reversed = [...this.schedStops].reverse();
        const n = this.schedStops.length;
        // SC-14 — mirror the forward segment/dwell durations onto the return leg,
        // anchored at (terminus arrival + terminus wait), to show heures aller ET
        // retour (départ / passage / arrivée) per station.
        const termWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
        const lastArr = this.schedStops[n - 1].arrTimeMin ?? this.schedStops[n - 1].depTimeMin ?? 0;
        const fmt = (t) => this.minToTimeStr(((Math.round(t) % 1440) + 1440) % 1440);
        const retTimes = [];
        for (let j = 0; j < n; j++) {
          if (j === 0) { retTimes.push({ arr: lastArr + termWait, dep: lastArr + termWait }); continue; }
          // Forward travel of this segment = arr[later station] - dep[earlier station];
          // the return leg reuses the same duration in reverse.
          const arrLater = this.schedStops[n - j].arrTimeMin ?? this.schedStops[n - j].depTimeMin ?? 0;
          const depEarlier = this.schedStops[n - 1 - j].depTimeMin ?? this.schedStops[n - 1 - j].arrTimeMin ?? 0;
          const travel = Math.max(0, arrLater - depEarlier);
          const arr = retTimes[j - 1].dep + travel;
          const here = this.schedStops[n - 1 - j];
          const dwell = Math.max(0, (here.depTimeMin ?? here.arrTimeMin ?? 0) - (here.arrTimeMin ?? here.depTimeMin ?? 0));
          retTimes.push({ arr, dep: arr + dwell });
        }
        const returnHtml = reversed.map((stop, i) => {
          const station = this.game.world.getStationById(stop.stationId);
          const stName = station?.name || stop.stationName || '?';
          const isFirst = i === 0;
          const isLast = i === reversed.length - 1;
          const typeLabel = stop.type === 'waypoint' ? 'passage' : (isFirst ? 'depart' : (isLast ? 'terminus' : stop.type));
          const typeColor = typeLabel === 'depart' ? '#22c55e' : (typeLabel === 'terminus' ? '#ef4444' : (typeLabel === 'passage' ? '#8b5cf6' : 'var(--text3)'));

          const rt = retTimes[i] || { arr: 0, dep: 0 };
          let timeStr;
          if (stop.type === 'waypoint') timeStr = '';
          else if (isFirst) timeStr = `Dep ${fmt(rt.dep)}`;
          else if (isLast) timeStr = `Arr ${fmt(rt.arr)}`;
          else if (typeLabel === 'passage') timeStr = `Pass ${fmt(rt.arr)}`;
          else timeStr = `${fmt(rt.arr)}-${fmt(rt.dep)}`;

          // Platform selector
          let platformSelect = '';
          if (station && station.platforms > 0) {
            const names = station.platformNames || [];
            const currentVal = this._schedReturnPlatforms?.[stop.stationId] || '';
            let options = '<option value="">Auto</option>';
            for (let p = 1; p <= station.platforms; p++) {
              const pName = names[p - 1] || String(p);
              const sel = currentVal === pName ? 'selected' : '';
              options += `<option value="${pName}" ${sel}>Voie ${pName}</option>`;
            }
            platformSelect = `<select style="width:70px;font-size:10px" onchange="game.ui.updateReturnPlatform('${stop.stationId}', this.value)">${options}</select>`;
          }

          return `<div class="sched-stop-row" style="padding:3px 6px;display:flex;align-items:center;gap:6px">
            <span style="color:var(--text3);font-size:10px;min-width:14px">${i + 1}</span>
            <span style="color:${typeColor};font-size:9px;min-width:50px">${typeLabel}</span>
            <span class="stop-name" style="flex:1">${stName}</span>
            <span style="font-size:9px;color:var(--text2);min-width:74px;text-align:right">${timeStr}</span>
            ${platformSelect}
          </div>`;
        }).join('');
        if (returnHtml) {
          container.innerHTML += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">
            <div style="font-size:10px;color:#f59e0b;font-weight:600;margin-bottom:4px">↩ Trajet retour (${reversed.length} arrets, attente terminus ${termWait} min)</div>
            <div style="font-size:8px;color:var(--text3);margin-bottom:3px">Legende : <span style="color:#22c55e">depart</span> / <span style="color:#8b5cf6">passage</span> / <span style="color:#ef4444">arrivee</span></div>
            ${returnHtml}
          </div>`;
        }
      }

      this._renderRouteSummary();
    },

  _renderRouteSummary() {
      const allerEl = document.getElementById('sched-summary-aller');
      const retourEl = document.getElementById('sched-summary-retour');
      if (!allerEl || !retourEl) return;

      const fmt = (t) => this.minToTimeStr(((Math.round(t) % 1440) + 1440) % 1440);
      const row = (name, time, cls = '') => `<div class="ss-row ${cls}"><span class="ss-name">${name}</span><span class="ss-time">${time}</span></div>`;

      const allerRows = this.schedStops.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === this.schedStops.length - 1;
        let t = '';
        if (stop.type === 'waypoint') t = `Pass ${fmt(stop.arrTimeMin || 0)}`;
        else if (isFirst) t = `Dép ${fmt(stop.depTimeMin || 0)}`;
        else if (isLast) t = `Arr ${fmt(stop.arrTimeMin || 0)}`;
        else t = `${fmt(stop.arrTimeMin || 0)}-${fmt(stop.depTimeMin || 0)}`;
        return row(stop.stationName || '?', t);
      }).join('');
      allerEl.innerHTML = allerRows || '—';

      const rtChecked = document.getElementById('sched-round-trip')?.checked;
      if (!rtChecked || this.schedStops.length < 2) {
        retourEl.innerHTML = '—';
        return;
      }

      const reversed = [...this.schedStops].reverse();
      const termWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
      const lastArr = this.schedStops[this.schedStops.length - 1].arrTimeMin ?? this.schedStops[this.schedStops.length - 1].depTimeMin ?? 0;
      const retTimes = [];
      for (let j = 0; j < reversed.length; j++) {
        if (j === 0) { retTimes.push({ arr: lastArr + termWait, dep: lastArr + termWait }); continue; }
        const arrLater = this.schedStops[this.schedStops.length - j].arrTimeMin ?? this.schedStops[this.schedStops.length - j].depTimeMin ?? 0;
        const depEarlier = this.schedStops[this.schedStops.length - 1 - j].depTimeMin ?? this.schedStops[this.schedStops.length - 1 - j].arrTimeMin ?? 0;
        const travel = Math.max(0, arrLater - depEarlier);
        const arr = retTimes[j - 1].dep + travel;
        const here = this.schedStops[this.schedStops.length - 1 - j];
        const dwell = Math.max(0, (here.depTimeMin ?? here.arrTimeMin ?? 0) - (here.arrTimeMin ?? here.depTimeMin ?? 0));
        retTimes.push({ arr, dep: arr + dwell });
      }

      const retourRows = reversed.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === reversed.length - 1;
        const rt = retTimes[i] || { arr: 0, dep: 0 };
        let t = '';
        if (stop.type === 'waypoint') t = `Pass ${fmt(rt.arr)}`;
        else if (isFirst) t = `Dép ${fmt(rt.dep)}`;
        else if (isLast) t = `Arr ${fmt(rt.arr)}`;
        else t = `${fmt(rt.arr)}-${fmt(rt.dep)}`;
        return row(stop.stationName || '?', t);
      }).join('');
      retourEl.innerHTML = retourRows || '—';
    },

  async updateSchedStop(index, field, value) {
      const stop = this.schedStops[index];
      if (field === 'type') {
        stop.type = value;
        if (value === 'passage' || value === 'waypoint') {
          stop.depTimeMin = stop.arrTimeMin;
          stop.depTimeStr = stop.arrTimeStr;
        } else if (stop.depTimeMin <= stop.arrTimeMin) {
          stop.depTimeMin = stop.arrTimeMin + 2;
          stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
        }
      }
      if (field === 'arrTime') {
        stop.arrTimeStr = value;
        stop.arrTimeMin = this.timeStrToMin(value);
        if (stop.type === 'passage') {
          stop.depTimeMin = stop.arrTimeMin;
          stop.depTimeStr = stop.arrTimeStr;
        } else if (stop.depTimeMin < stop.arrTimeMin) {
          stop.depTimeMin = stop.arrTimeMin + 2;
          stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
        }
      }
      if (field === 'depTime') {
        stop.depTimeStr = value;
        stop.depTimeMin = this.timeStrToMin(value);
      }
      if (field === 'stopDuration') {
        const dur = Math.max(0, parseInt(value) || 0);
        stop.depTimeMin = stop.arrTimeMin + dur;
        stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
      }
      if (field === 'platform') {
        stop.platform = value || '';
      }
      if (field === 'stopCode') {
        stop.stopCode = value || '';
      }
      // Auto-recalculate all subsequent stops (await async routing)
      await this.recalcStopsFrom(index + 1);
      this.renderSchedStops();
    },

  updateReturnPlatform(stationId, value) {
      if (!this._schedReturnPlatforms) this._schedReturnPlatforms = {};
      if (value) {
        this._schedReturnPlatforms[stationId] = value;
      } else {
        delete this._schedReturnPlatforms[stationId];
      }
    },

  _approxRailDistance(lat1, lon1, lat2, lon2) {
      // Try to find existing track/route between these two points to get real distance
      const tracks = this.game.world.tracks;
      if (tracks) {
        for (const t of tracks) {
          if (!t.route || t.route.length < 2) continue;
          const r = t.route;
          const startDist = Math.abs(r[0].lat - lat1) + Math.abs(r[0].lon - lon1);
          const endDist = Math.abs(r[r.length - 1].lat - lat2) + Math.abs(r[r.length - 1].lon - lon2);
          const startDistRev = Math.abs(r[0].lat - lat2) + Math.abs(r[0].lon - lon2);
          const endDistRev = Math.abs(r[r.length - 1].lat - lat1) + Math.abs(r[r.length - 1].lon - lon1);
          if ((startDist < 0.01 && endDist < 0.01) || (startDistRev < 0.01 && endDistRev < 0.01)) {
            return this.game.orm.getRouteDistance(r);
          }
        }
      }
      // Fallback: haversine (great-circle distance)
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

  _getStopCoords(stop) {
      // Resolve lat/lon for any stop type (station, voie point, waypoint).
      // Prefer the exact platform voie point when a platform is selected.
      if (stop.voiePointId && this.game.voiePointManager) {
        const vp = this.game.voiePointManager.getVoiePointById(stop.voiePointId);
        if (vp) return { lat: vp.lat, lon: vp.lon };
      }
      if (stop.stationId) {
        const st = this.game.world.getStationById(stop.stationId);
        if (!st) return null;
        if (stop.platform && this.game.voiePointManager) {
          const svp = this.game.voiePointManager.getStationVoiePoint(st.id, stop.platform);
          if (svp) return { lat: svp.lat, lon: svp.lon };
        }
        return { lat: st.lat, lon: st.lon };
      }
      return null;
    },

  _snapToTrack(lat, lon) {
      const vpm = this.game.voiePointManager;
      if (!vpm) return null;
      let best = null, bestDist = Infinity;
      const cosLat = Math.cos(lat * Math.PI / 180);
      for (const trc of vpm.getAllTroncons()) {
        if (!trc.route) continue;
        for (const pt of trc.route) {
          const d = Math.sqrt(Math.pow((pt.lat - lat) * 111, 2) + Math.pow((pt.lon - lon) * 111 * cosLat, 2));
          if (d < bestDist) { bestDist = d; best = { lat: pt.lat, lon: pt.lon }; }
        }
      }
      return (best && bestDist <= 5) ? best : null;
    },

  _densifyRoute(route, spacingKm = 0.05) {
      if (!route || route.length < 2) return route;
      const hasControl = route.some(p => p && p.control);
      if (!hasControl) {
        const cum = [0];
        for (let i = 1; i < route.length; i++) {
          cum[i] = cum[i - 1] + haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
        }
        const total = cum[cum.length - 1];
        if (total <= 0) return [...route];
        const out = [];
        const steps = Math.max(1, Math.round(total / spacingKm));
        for (let s = 0; s <= steps; s++) {
          const target = Math.min(total, s * spacingKm);
          let idx = 1;
          while (idx < cum.length && cum[idx] < target) idx++;
          const a = route[idx - 1], b = route[idx] || route[route.length - 1];
          const segLen = (cum[idx] ?? total) - cum[idx - 1];
          const t = segLen > 0 ? (target - cum[idx - 1]) / segLen : 0;
          const maxSpeed = b?.maxSpeed ?? a?.maxSpeed ?? 30;
          const props = {};
          for (const k of Object.keys(b || a)) {
            if (k !== 'lat' && k !== 'lon' && k !== 'control') props[k] = (b || a)[k];
          }
          out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, maxSpeed, ...props });
        }
        return out;
      }
      // Manual-trace / control-aware densification: keep control points and densify between them.
      const controls = [];
      for (let i = 0; i < route.length; i++) {
        if (route[i].control || i === 0 || i === route.length - 1) {
          // mutate input objects so downstream edits keep references
          route[i].control = true;
          controls.push(route[i]);
        }
      }
      if (controls.length < 2) return [...route];
      const out = [];
      for (let i = 0; i < controls.length - 1; i++) {
        const a = controls[i], b = controls[i + 1];
        const dist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
        if (dist <= 0) continue;
        const steps = Math.max(1, Math.ceil(dist / spacingKm));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const maxSpeed = b?.maxSpeed ?? a?.maxSpeed ?? 30;
          if (s === 0) {
            a.control = true;
            a.maxSpeed = maxSpeed;
            out.push(a);
          } else {
            const props = {};
            for (const k of Object.keys(b || a)) {
              if (k !== 'lat' && k !== 'lon' && k !== 'control') props[k] = (b || a)[k];
            }
            out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, maxSpeed, ...props });
          }
        }
      }
      const last = controls[controls.length - 1];
      out.push({ ...last, control: true });
      return out;
    },

  _resampleRoute(route, spacingKm = 0.05) {
      return this._densifyRoute(route, spacingKm);
    },

  _findNearestTracePoint(x, y, tileMap, canvas) {
      if (!this._manualRoutes || this._manualRoutes.length === 0) return null;
      let best = null, bestDist = Infinity;
      for (let leg = 0; leg < this._manualRoutes.length; leg++) {
        const route = this._manualRoutes[leg];
        if (!route) continue;
        for (let i = 0; i < route.length; i++) {
          const pt = route[i];
          const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestDist) { bestDist = d; best = { leg, index: i, pt }; }
        }
      }
      return bestDist <= 10 ? best : null;
    },

  _findNearestControlPoint(x, y, tileMap, canvas) {
      if (!this._manualRoutes || this._manualRoutes.length === 0) return null;
      let best = null, bestDist = Infinity, bestLeg = -1, bestIdx = -1;
      for (let leg = 0; leg < this._manualRoutes.length; leg++) {
        const route = this._manualRoutes[leg];
        if (!route || route.length < 3) continue;
        for (let i = 1; i < route.length - 1; i++) {
          const pt = route[i];
          const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestDist) { bestDist = d; best = pt; bestLeg = leg; bestIdx = i; }
        }
      }
      return (best && bestDist <= 14) ? { leg: bestLeg, control: best, index: bestIdx } : null;
    },

  _findNearestSegmentPoint(x, y, tileMap, canvas) {
      if (!this._manualRoutes || this._manualRoutes.length === 0) return null;
      let best = null, bestDist = Infinity;
      for (let leg = 0; leg < this._manualRoutes.length; leg++) {
        const route = this._manualRoutes[leg];
        if (!route || route.length < 2) continue;
        for (let i = 0; i < route.length - 1; i++) {
          const a = tileMap.worldToScreen(route[i].lat, route[i].lon, canvas.width, canvas.height);
          const b = tileMap.worldToScreen(route[i + 1].lat, route[i + 1].lon, canvas.width, canvas.height);
          const abx = b.x - a.x, aby = b.y - a.y;
          const len2 = abx * abx + aby * aby;
          let t = len2 > 0 ? ((x - a.x) * abx + (y - a.y) * aby) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          const px = a.x + abx * t, py = a.y + aby * t;
          const d = Math.hypot(px - x, py - y);
          if (d < bestDist) {
            bestDist = d;
            const worldPos = tileMap.screenToWorld(px, py, canvas.width, canvas.height);
            best = { leg, index: i + 1, ...worldPos };
          }
        }
      }
      return bestDist <= 8 ? best : null;
    },

  _extractRouteControls(route) {
      if (!route || route.length < 2) return [];
      return route.filter(p => p && p.control);
    },

  _controlBoundsForIndex(route, index) {
      let prev = index, next = index;
      while (prev > 0 && !route[prev].control) prev--;
      while (next < route.length - 1 && !route[next].control) next++;
      return { prev, next };
    },

  _insertControlAt(leg, index, lat, lon) {
      const route = this._manualRoutes[leg];
      if (!route) return null;
      const controls = this._extractRouteControls(route);
      const { prev, next } = this._controlBoundsForIndex(route, index);
      if (prev < 0 || next < 0 || prev === next) return null;
      const prevObj = route[prev];
      const prevIdx = controls.indexOf(prevObj);
      if (prevIdx < 0) return null;
      const maxSpeed = prevObj.maxSpeed || 30;
      const newPt = { lat, lon, maxSpeed, control: true };
      controls.splice(prevIdx + 1, 0, newPt);
      this._manualRoutes[leg] = this._densifyRoute(controls);
      return newPt;
    },

  _insertTracePoint(leg, index, lat, lon) {
      this._insertControlAt(leg, index, lat, lon);
      this._recalcAfterTraceEdit(leg);
    },

  _removeTracePoint(leg, index) {
      const route = this._manualRoutes[leg];
      if (!route || route.length <= 2 || index <= 0 || index >= route.length - 1) return;
      const controls = this._extractRouteControls(route);
      if (controls.length <= 2) return;
      let bestIdx = -1, bestD = Infinity;
      for (let i = 1; i < controls.length - 1; i++) {
        const d = haversineDistance(controls[i].lat, controls[i].lon, route[index].lat, route[index].lon);
        if (d < bestD) { bestD = d; bestIdx = i; }
      }
      if (bestIdx >= 0 && bestD < 0.1) {
        controls.splice(bestIdx, 1);
        this._manualRoutes[leg] = this._densifyRoute(controls);
        this._recalcAfterTraceEdit(leg);
      }
    },

  _moveTracePoint(leg, control, lat, lon) {
      if (!control) return;
      const snapped = this._snapToTrack(lat, lon);
      control.lat = snapped ? snapped.lat : lat;
      control.lon = snapped ? snapped.lon : lon;
      const route = this._manualRoutes[leg];
      const controls = this._extractRouteControls(route);
      this._manualRoutes[leg] = this._densifyRoute(controls);
    },

  _findNearestManualControlPoint(x, y, tileMap, canvas) {
      if (!this._manualControlPoints || this._manualControlPoints.length === 0) return null;
      let best = null, bestDist = Infinity;
      for (let i = 0; i < this._manualControlPoints.length; i++) {
        const pt = this._manualControlPoints[i];
        const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestDist) { bestDist = d; best = { index: i, pt }; }
      }
      return bestDist <= 14 ? best : null;
    },

  _moveManualControlPoint(index, lat, lon) {
      const pt = this._manualControlPoints[index];
      if (!pt) return;
      const snapped = this._snapToTrack(lat, lon);
      pt.lat = snapped ? snapped.lat : lat;
      pt.lon = snapped ? snapped.lon : lon;
    },

  async _recalcAfterTraceEdit(leg) {
      // Recompute travel time for the affected leg and all subsequent stops.
      await this.recalcStopsFrom(leg + 1);
      this.renderSchedStops();
      if (this._drawSchedMap) this._drawSchedMap();
    },

  _adjustManualRoutesForInsert(stopIndex) {
      if (!this._manualRoutes) this._manualRoutes = [];
      if (stopIndex <= 0 || stopIndex > this.schedStops.length) return;
      if (stopIndex === this.schedStops.length) {
        this._manualRoutes.push(null);
        return;
      }
      const legIdx = stopIndex - 1;
      // One old leg is replaced by two new legs; old downstream routes shift by one.
      this._manualRoutes.splice(legIdx, 1, null, null);
    },

  _adjustManualRoutesForRemove(stopIndex) {
      if (!this._manualRoutes) return;
      if (stopIndex <= 0 || stopIndex >= this.schedStops.length) return;
      if (stopIndex === this.schedStops.length - 1) {
        this._manualRoutes.pop();
        return;
      }
      const legIdx = stopIndex - 1;
      this._manualRoutes.splice(legIdx, 1); // remove leg prev->removed
      this._manualRoutes[legIdx] = null; // invalidate leg prev->next, will be recomputed
    },

  async _resolveRouteForLeg(stopA, stopB) {
      const ca = this._getStopCoords(stopA), cb = this._getStopCoords(stopB);
      if (!ca || !cb) return null;

      // Priority 1: player tronçon graph
      const trc = this.game.voiePointManager?.findTronconRoute(ca.lat, ca.lon, cb.lat, cb.lon);
      if (trc && trc.route && trc.route.length >= 2) return trc.route;

      // Priority 2: existing world track between two stations
      const sa = stopA.stationId ? this.game.world.getStationById(stopA.stationId) : null;
      const sb = stopB.stationId ? this.game.world.getStationById(stopB.stationId) : null;
      if (sa && sb) {
        const track = this.game.world.getTrackBetween(sa.id, sb.id);
        if (track && track.route && track.route.length > 1) {
          return (track.stationA !== sa.id) ? [...track.route].reverse() : track.route;
        }
      }

      // Priority 3: ORM (never return a straight-line fallback — R-03)
      // R-07 : plafond vitesse routage à V160 (matériel joueur)
      // TRV-03/06 : éviter les tronçons fermés entre les deux gares
      try {
        const rameId = document.getElementById('sched-rame')?.value;
        const rame = rameId ? this.game.rameManager.getById(rameId) : null;
        const routingSpeed = rame ? Math.min(rame.maxSpeed || 160, 160) : 160;
        const pt = this.game.engine.getParisTime();
        const now = pt.hours * 60 + pt.minutes;
        const dateStr = this.game.engine.currentDate || this.game.engine.getParisDate();
        const closures = [];
        if (sa && sb) {
          closures.push(...this.game.worksManager.getActiveClosuresBetween(sa.id, sb.id, dateStr, now));
        }
        const avoidPairs = closures.map(w => {
          const sta = this.game.world.getStationById(w.stationA);
          const stb = this.game.world.getStationById(w.stationB);
          if (!sta || !stb) return null;
          return { latA: sta.lat, lonA: sta.lon, latB: stb.lat, lonB: stb.lon };
        }).filter(Boolean);
        const opts = { maxSpeed: routingSpeed };
        if (avoidPairs.length) opts.avoidStationPairs = avoidPairs;
        return await this.game.orm.findRoute(ca.lat, ca.lon, cb.lat, cb.lon, opts);
      } catch (e) {
        return null;
      }
    },

  async _recalcPreviewRoutes() {
      if (!this.schedStops || this.schedStops.length < 2) {
        this._schedPreviewRoutes = [];
        this._schedObjectifRoutes = [];
        return;
      }
      if (!this._manualRoutes) this._manualRoutes = [];
      const objectifRoutes = [];
      const routes = [];
      for (let i = 0; i < this.schedStops.length - 1; i++) {
        const objectif = await this._resolveRouteForLeg(this.schedStops[i], this.schedStops[i + 1]);
        const densifiedObj = (objectif && objectif.length >= 2) ? this._densifyRoute([...objectif]) : null;
        objectifRoutes.push(densifiedObj);
        if (this._manualRoutes[i]) {
          routes.push(this._manualRoutes[i]);
        } else if (densifiedObj) {
          this._manualRoutes[i] = densifiedObj;
          routes.push(this._manualRoutes[i]);
        } else {
          routes.push(null);
        }
      }
      // Trim if stops shrank
      this._manualRoutes.length = this.schedStops.length - 1;
      this._schedObjectifRoutes = objectifRoutes;
      this._schedPreviewRoutes = routes;
      if (this._drawSchedMap) this._drawSchedMap();
    },

  async _getSegmentTravelTime(prevStop, curStop, rameSpeed, rame = null, legIndex = null) {
      let route = null;
      if (legIndex != null && this._manualRoutes && this._manualRoutes[legIndex]) {
        route = this._manualRoutes[legIndex];
      } else {
        route = await this._resolveRouteForLeg(prevStop, curStop);
        if (route && route.length >= 2 && legIndex != null) {
          if (!this._manualRoutes) this._manualRoutes = [];
          this._manualRoutes[legIndex] = this._densifyRoute(route);
          route = this._manualRoutes[legIndex];
        }
      }

      // Waypoints/passages are not stops: the train keeps speed through them.
      // The first leg always starts from 0 (origin); subsequent pass-through legs
      // start and end at line speed.
      const isPass = (s) => s?.type === 'waypoint' || s?.type === 'passage';
      const rameMaxSpeed = rame ? rame.maxSpeed : rameSpeed;
      const rameMaxMs = rameMaxSpeed / 3.6;
      const startMs = (isPass(prevStop) && legIndex !== 0) ? rameMaxMs : 0;
      const endMs = isPass(curStop) ? rameMaxMs : 0;
      const travelOpts = { startMs, endMs };

      if (route && route.length >= 2) {
        return this.game.orm.calculateTravelTime(route, rame || rameSpeed, travelOpts);
      }
      const prevCoords = this._getStopCoords(prevStop);
      const curCoords = this._getStopCoords(curStop);
      if (!prevCoords || !curCoords) return 15;
      const dist = this._approxRailDistance(prevCoords.lat, prevCoords.lon, curCoords.lat, curCoords.lon);
      if (dist <= 0) return 1;
      // No ORM route found: build a straight synthetic route and run the same
      // physics so the estimate is no longer "instant top speed".
      const steps = 20;
      const synthetic = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        synthetic.push({
          lat: prevCoords.lat + (curCoords.lat - prevCoords.lat) * t,
          lon: prevCoords.lon + (curCoords.lon - prevCoords.lon) * t,
          maxSpeed: rameSpeed
        });
      }
      return this.game.orm.calculateTravelTime(synthetic, rame || rameSpeed, travelOpts);
    },

  async recalcStopsFrom(fromIndex) {
      if (fromIndex >= this.schedStops.length || fromIndex < 1) return;

      const rameId = document.getElementById('sched-rame')?.value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 160;

      // Build merged arret-to-arret segments to avoid per-waypoint accel/decel overhead
      // First pass: find the last arret before fromIndex to use as anchor
      let anchorIdx = fromIndex - 1;
      while (anchorIdx > 0 && this.schedStops[anchorIdx].type !== 'arret') anchorIdx--;

      for (let i = Math.max(fromIndex, anchorIdx + 1); i < this.schedStops.length; i++) {
        const prevStop = this.schedStops[i - 1];
        const curStop = this.schedStops[i];

        const travelTime = await this._getSegmentTravelTime(prevStop, curStop, rameSpeed, rame, i - 1);

        curStop.arrTimeMin = prevStop.depTimeMin + travelTime;
        curStop.arrTimeStr = this.minToTimeStr(curStop.arrTimeMin);

        if (curStop.type === 'passage' || curStop.type === 'waypoint') {
          curStop.depTimeMin = curStop.arrTimeMin;
          curStop.depTimeStr = curStop.arrTimeStr;
        } else {
          const oldStopDuration = Math.max(2, (curStop.depTimeMin || 0) - (curStop.arrTimeMin || 0));
          curStop.depTimeMin = curStop.arrTimeMin + (i === this.schedStops.length - 1 ? 0 : Math.max(oldStopDuration, 2));
          curStop.depTimeStr = this.minToTimeStr(curStop.depTimeMin);
        }
      }
      this.renderSchedStops();
      this._recalcPreviewRoutes();
    },

  removeSchedStop(index) {
      this.schedStops.splice(index, 1);
      this._adjustManualRoutesForRemove(index);
      this.recalcStopsFrom(index);
      this.renderSchedStops();
      this._recalcPreviewRoutes();
    },

  startInsertStop(index) {
      if (this._manualMode) this._toggleManualMode();
      this._insertAfterIndex = index;
      this._traceSelectedPoint = null;
      this._traceDragging = null;
      this._manualControlDrag = null;
      this._updateManualUI();
    },

  async _insertStopFromMap(afterIndex, item) {
      if (!item || afterIndex < 0 || afterIndex >= this.schedStops.length) return;
      const rameId = document.getElementById('sched-rame')?.value;
      const rame = this.game.rameManager.getById(rameId);
      const rameSpeed = rame ? rame.maxSpeed : 160;
      const insertIndex = afterIndex + 1;
      const prevStop = this.schedStops[afterIndex];

      let newStop;
      if (item.voie != null) {
        // voie point
        let vpName = `Voie ${item.voie}`;
        let vpStationId = null;
        if (item.stationId) {
          const st = this.game.world.getStationById(item.stationId);
          if (st) { vpName = `${st.name} — Voie ${item.voie}`; vpStationId = st.id; }
        }
        newStop = {
          stationId: vpStationId, voiePointId: item.id, stationName: vpName,
          type: item.stationId ? 'arret' : 'waypoint', stopCode: '', arrTimeMin: 0, depTimeMin: 0,
          arrTimeStr: '00:00', depTimeStr: '00:00', platform: item.voie,
        };
      } else if (item.lat != null && item.lon != null && !item.id) {
        // map waypoint
        newStop = {
          stationId: null, voiePointId: item.vpId || null, stationName: item.name || `Waypoint (${item.lat.toFixed(4)}, ${item.lon.toFixed(4)})`,
          type: 'waypoint', stopCode: '', arrTimeMin: 0, depTimeMin: 0,
          arrTimeStr: '00:00', depTimeStr: '00:00', platform: '',
        };
      } else {
        // station
        if (item.closed) { alertToast('Cette gare est fermée — aucun train ne peut la desservir.'); return; }
        newStop = {
          stationId: item.id, stationName: item.name, type: 'arret', stopCode: '',
          arrTimeMin: 0, depTimeMin: 0, arrTimeStr: '00:00', depTimeStr: '00:00', platform: '',
        };
      }

      this.schedStops.splice(insertIndex, 0, newStop);
      this._adjustManualRoutesForInsert(insertIndex);

      const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, afterIndex);
      const arrTimeMin = (prevStop.depTimeMin || 0) + travelTime;
      newStop.arrTimeMin = arrTimeMin;
      newStop.depTimeMin = newStop.type === 'arret' ? arrTimeMin + 2 : arrTimeMin;
      newStop.arrTimeStr = this.minToTimeStr(newStop.arrTimeMin);
      newStop.depTimeStr = this.minToTimeStr(newStop.depTimeMin);

      if (insertIndex < this.schedStops.length - 1) {
        await this.recalcStopsFrom(insertIndex + 1);
      }

      this.renderSchedStops();
      this._recalcPreviewRoutes();
      this.game.saveState();
    },

  async _buildSaveRoutes(stops, manualRoutes) {
      const routePromises = [];
      for (let i = 0; i < stops.length - 1; i++) {
        if (manualRoutes && manualRoutes[i] && manualRoutes[i].length >= 2) {
          routePromises.push(Promise.resolve(manualRoutes[i]));
        } else {
          routePromises.push(this._resolveRouteForLeg(stops[i], stops[i + 1]));
        }
      }
      const routes = await Promise.all(routePromises);
      return routes.map((r, i) => {
        if (manualRoutes && manualRoutes[i] && manualRoutes[i].length >= 2) return manualRoutes[i];
        if (r && r.length >= 2) return this._densifyRoute(r);
        return r;
      });
    },

  async saveSchedule() {
      const name = document.getElementById('sched-name').value.trim();
      const rameId = document.getElementById('sched-rame').value;
      if (!name) return alertToast('Nom requis');

      const rame = this.game.rameManager.getById(rameId);
      if (!rame) return alertToast('Veuillez choisir une rame.');
      if ((rame.totalPower || 0) <= 0) return alertToast('La rame selectionnée n\'a pas de motrice (locomotive / automotrice) et ne peut pas rouler.');
      const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
      const multiDepartures = parseInt(document.getElementById('sched-multi-departures')?.value) || 1;
      const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;

      // Flush any in-progress return-mode edits into their dedicated buffers.
      if (this._isReturnEditMode) {
        this._returnStops = this.schedStops;
        this._returnManualRoutes = this._manualRoutes;
      } else {
        this._forwardStops = this.schedStops;
        this._forwardManualRoutes = this._manualRoutes;
      }

      if (this._forwardStops.length < 2) return alertToast('Il faut au moins 2 arrets');

      // Build forward routes.
      const forwardStops = this._forwardStops;
      const forwardRoutes = await this._buildSaveRoutes(forwardStops, this._forwardManualRoutes);
      const invalidForward = forwardRoutes.findIndex(r => !r || r.length < 2);
      if (invalidForward >= 0) {
        return alertToast(`Impossible de calculer un itineraire ferroviaire entre les arrets aller #${invalidForward + 1} et #${invalidForward + 2}. Verifiez les points de voie / le reseau ORM.`);
      }

      // Build return routes/stops if a return leg has been defined; otherwise fall back to the reversed forward leg.
      let returnStops = [];
      let returnRoutes = [];
      if (roundTrip && this._returnStops && this._returnStops.length >= 2) {
        returnStops = this._returnStops;
        returnRoutes = await this._buildSaveRoutes(returnStops, this._returnManualRoutes);
        const invalidReturn = returnRoutes.findIndex(r => !r || r.length < 2);
        if (invalidReturn >= 0) {
          return alertToast(`Impossible de calculer un itineraire ferroviaire entre les arrets retour #${invalidReturn + 1} et #${invalidReturn + 2}. Verifiez les points de voie / le reseau ORM.`);
        }
      }

      const stops = forwardStops.map(s => this._stopEditToData(s));
      const returnStopsData = returnStops.length >= 2 ? returnStops.map(s => this._stopEditToData(s)) : [];

      let totalDist = 0;
      for (const route of forwardRoutes) totalDist += this.game.orm.getRouteDistance(route);
      for (const route of returnRoutes) totalDist += this.game.orm.getRouteDistance(route);

      // If editing, remove old service first
      if (this._editingScheduleId) {
        this.game.scheduleCreator.removeService(this._editingScheduleId);
      }

      const serviceType = document.getElementById('sched-service-type')?.value || 'passager';
      const isWorkTrain = serviceType === 'work';

      // Section VI — validation des types de convois (HLP / TM)
      if (serviceType === 'hlp') {
        const locoCount = rame.elementDetails.filter(e => e.category === 'locomotive' || e.category === 'automotrice').length;
        if (locoCount > 2 || rame.elementDetails.length !== locoCount) {
          return alertToast('Un HLP (Haut le pied) est un convoi de locomotives seules, maximum 2.');
        }
      }
      if (serviceType === 'tm') {
        const locoCount = rame.elementDetails.filter(e => e.category === 'locomotive' || e.category === 'automotrice').length;
        if (locoCount < 3 || locoCount > 12 || rame.elementDetails.length !== locoCount) {
          return alertToast('Un TM (Train de machines) compte 3 à 12 locomotives, rien d’autre.');
        }
      }
      if (serviceType === 'm-') {
        // CVO-05 : machine de manœuvre = une seule locomotive rattachée à un dépôt
        const locoCount = rame.elementDetails.filter(e => e.category === 'locomotive' || e.category === 'automotrice').length;
        if (locoCount !== 1 || rame.elementDetails.length !== 1) {
          return alertToast('Une machine de manœuvre (M-) est constituée d\'une seule locomotive.');
        }
        if (!rame.depotId) {
          return alertToast('Une machine de manœuvre (M-) doit être rattachée à un dépôt.');
        }
      }

      const returnName = document.getElementById('sched-return-name')?.value.trim() || '';
      const assignedContractId = document.getElementById('sched-contract')?.value || '';
      const returnPlatforms = this._schedReturnPlatforms || {};

      // Read run days from checkboxes
      const runDays = [];
      document.querySelectorAll('.sched-run-day:checked').forEach(cb => runDays.push(parseInt(cb.value)));
      if (runDays.length === 0) runDays.push(0,1,2,3,4,5,6); // fallback: all days

      // Read specific run dates
      const runDatesStr = document.getElementById('sched-run-dates')?.value.trim() || '';
      const runDates = runDatesStr ? runDatesStr.split(',').map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];

      const firstDep = stops[0]?.departureTime || 0;
      const lastArr = stops[stops.length - 1]?.arrivalTime || firstDep;
      const oneWayMin = lastArr - firstDep;
      let returnMin = oneWayMin;
      if (returnStopsData.length >= 2) {
        const retFirstDep = returnStopsData[0].departureTime;
        const retLastArr = returnStopsData[returnStopsData.length - 1].arrivalTime;
        returnMin = retLastArr - retFirstDep;
      }
      const oneRoundTrip = roundTrip ? (oneWayMin + returnMin + terminusWait * 2) : 0;

      // SC-05 — create a single base service, then generate real duplicates for Auto 24h.
      const baseService = this.game.scheduleCreator.addService({
        name, rameId, stops, routes: forwardRoutes, returnStops: returnStopsData, returnRoutes,
        roundTrip, multiDepartures: 1, terminusWait,
        totalDistance: 0, plannedDistance: Math.round(totalDist),
        serviceType, isWorkTrain, assignedContractId, returnName, returnPlatforms,
        runDays, runDates,
      }, rame, this.game.world);
      if (roundTrip && multiDepartures > 1) {
        this.game.scheduleCreator.createAutoRoundTripDuplicates(
          baseService, multiDepartures, oneRoundTrip, rame, this.game.world
        );
      }

      this._editingScheduleId = null;
      if (this._schedMapInterval) { clearInterval(this._schedMapInterval); this._schedMapInterval = null; }
      document.getElementById('modal-schedule')?.classList.add('hidden');
      this.renderSchedulesList();
      this.game.saveState();
    },

  editSchedule(id) {
      const svc = this.game.scheduleCreator.services.find(s => s.id === id);
      if (svc) this.openScheduleModal(svc);
    },

  renderSchedulesList() {
      const container = document.getElementById('schedules-list');
      if (!container) return;
      const services = this.game.scheduleCreator.services;
      if (services.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun trajet. Cliquer "+ Creer un trajet" pour commencer.</p>';
        return;
      }

      const sortMode = document.getElementById('sched-sort')?.value || 'departure';
      let sorted = [...services];

      if (sortMode === 'departure') {
        sorted.sort((a, b) => (a.stops[0]?.departureTime || 0) - (b.stops[0]?.departureTime || 0));
      } else if (sortMode === 'creation') {
        sorted.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      } else if (sortMode === 'rame') {
        sorted.sort((a, b) => {
          const ra = this.game.rameManager.getById(a.rameId);
          const rb = this.game.rameManager.getById(b.rameId);
          return (ra?.name || 'ZZZ').localeCompare(rb?.name || 'ZZZ');
        });
      } else if (sortMode === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortMode === 'route') {
        sorted.sort((a, b) => {
          const aFirst = this.game.world.getStationById(a.stops[0]?.stationId)?.name || '';
          const bFirst = this.game.world.getStationById(b.stops[0]?.stationId)?.name || '';
          return aFirst.localeCompare(bFirst) || (a.stops[0]?.departureTime || 0) - (b.stops[0]?.departureTime || 0);
        });
      }

      let lastGroupKey = null;
      const getGroupKey = (svc) => {
        if (sortMode === 'rame') {
          const r = this.game.rameManager.getById(svc.rameId);
          return r ? escapeHtml(r.name) : 'Sans rame';
        }
        if (sortMode === 'route') {
          const fst = escapeHtml(this.game.world.getStationById(svc.stops[0]?.stationId)?.name || '?');
          const lst = escapeHtml(this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId)?.name || '?');
          return `${fst} → ${lst}`;
        }
        return null;
      };

      this._schedPage = this._schedPage || 0;
      const perPage = 50;
      const total = sorted.length;
      const pageCount = Math.ceil(total / perPage) || 1;
      this._schedPage = Math.max(0, Math.min(this._schedPage, pageCount - 1));
      const start = this._schedPage * perPage;
      const pageItems = sorted.slice(start, start + perPage);

      const dayNames = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
      const typeLabels = { passager: 'Voy', w: 'W', hlp: 'HLP', tm: 'TM', evo: 'EVO', work: 'Travaux' };

      const rows = pageItems.map(svc => {
        const firstSt = this.game.world.getStationById(svc.stops[0]?.stationId);
        const lastSt = this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId);
        const rame = this.game.rameManager.getById(svc.rameId);
        const depTime = this.minToTimeStr(svc.stops[0]?.departureTime || 0);
        const arrTime = this.minToTimeStr(svc.stops[svc.stops.length - 1]?.arrivalTime || 0);
        const rd = svc.runDays || [0,1,2,3,4,5,6];
        const daysLabel = rd.length === 7 ? 'TLJ' : rd.map(d => dayNames[d]).join(' ');
        const typeBadge = svc.serviceType && svc.serviceType !== 'passager'
          ? `<span style="display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 4px;font-size:9px;color:#94a3b8">${typeLabels[svc.serviceType] || svc.serviceType}</span>`
          : '';
        const tripInfo = svc.roundTrip && svc.multiDepartures > 1 ? ` x${svc.multiDepartures} AR` : svc.roundTrip ? ' A/R' : '';

        // Detail content
        const stopsPreview = svc.stops.map(s => {
          const st = this.game.world.getStationById(s.stationId);
          const name = escapeHtml(st ? st.name : s.stationId);
          const arr = this.minToTimeStr(s.arrivalTime);
          const dep = this.minToTimeStr(s.departureTime);
          if (s.type === 'waypoint') return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${name})</span>`;
          return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
        }).join('<span style="color:var(--text3)"> → </span>');

        const passagePreview = (svc._passageStops?.length)
          ? `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#22c55e;font-size:9px;margin-right:4px">Passages :</span>${svc._passageStops.map(p => `<span class="sched-stop-tag passage">${this.minToTimeStr(p.time)} ${escapeHtml(p.name)}</span>`).join('<span style="color:var(--text3)"> → </span>')}</div>`
          : '';

        let returnPreview = '';
        if (svc.roundTrip) {
          const retStops = svc.buildReturnStops();
          const retStr = retStops.map(s => {
            const st = this.game.world.getStationById(s.stationId);
            const name = escapeHtml(st ? st.name : s.stationId);
            const arr = this.minToTimeStr(s.arrivalTime);
            const dep = this.minToTimeStr(s.departureTime);
            if (s.type === 'waypoint') return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${name})</span>`;
            return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
          }).join('<span style="color:var(--text3)"> → </span>');
          returnPreview = `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#f59e0b;font-size:9px;margin-right:4px">↩ Retour (${svc.terminusWait} min attente):</span>${retStr}</div>`;
        }

        const delayReason = svc.train?.delayReason || svc.delayReason || '';
        const breakdown = svc.train?.breakdown;
        const incident = svc.train?.incident;
        const bilanRows = [];
        if (svc.completed) bilanRows.push(`<span style="color:#22c55e">Terminé${svc.completedDate ? ' le ' + escapeHtml(svc.completedDate) : ''}</span>`);
        if (delayReason) bilanRows.push(`<span style="color:#f59e0b">Retard : ${escapeHtml(delayReason)}</span>`);
        if (breakdown?.type) bilanRows.push(`<span style="color:#ef4444">Panne : ${escapeHtml(breakdown.type)}</span>`);
        if (incident?.name || incident?.effect) bilanRows.push(`<span style="color:#ef4444">Incident : ${escapeHtml(incident.name || incident.effect)}</span>`);
        const bilanHtml = bilanRows.length
          ? `<div class="sched-bilan" style="margin-top:6px;padding:6px 8px;background:var(--bg3);border-radius:4px;font-size:10px;display:flex;flex-wrap:wrap;gap:8px">${bilanRows.join('')}</div>`
          : '';

        const numLabel = svc.number != null
          ? `<span style="color:#fbbf24;font-size:10px;font-weight:700" title="N° aller${svc.roundTrip ? ' / retour' : ''}">N°${svc.number}${svc.roundTrip && svc.returnNumber != null ? '/' + svc.returnNumber : ''}</span>`
          : '';

        // Group header row
        const gk = getGroupKey(svc);
        let groupHeader = '';
        if (gk !== null && gk !== lastGroupKey) {
          lastGroupKey = gk;
          groupHeader = `<tr><td colspan="8" class="sched-group-header">${gk}</td></tr>`;
        }

        const safeSvcIdHtml = escapeHtml(svc.id);
        const safeSvcIdJs = jsString(svc.id);
        const safeSvcName = escapeHtml(svc.name);
        const safeRameName = escapeHtml(rame ? rame.name : 'N/A');
        const safeFirstSt = escapeHtml(firstSt ? firstSt.name : '?');
        const safeLastSt = escapeHtml(lastSt ? lastSt.name : '?');
        return `${groupHeader}
          <tr class="sched-row" onclick="game.ui.toggleSchedDetail('${safeSvcIdJs}')">
            <td>${numLabel}</td>
            <td><strong>${safeSvcName}</strong>${typeBadge}</td>
            <td>${safeRameName}</td>
            <td>${safeFirstSt}<br><span style="color:var(--text3)">${depTime}</span></td>
            <td>${safeLastSt}<br><span style="color:var(--text3)">${arrTime}</span></td>
            <td><span style="color:var(--text3)">${Math.round(svc.plannedDistance || svc.totalDistance || 0)} km${tripInfo}</span></td>
            <td><span style="color:#60a5fa">${daysLabel}</span></td>
            <td class="sched-row-actions">
              <button class="btn-sm" onclick="event.stopPropagation();game.ui.editSchedule('${safeSvcIdJs}')">Modifier</button>
              <button class="btn-sm" onclick="event.stopPropagation();game.ui.duplicateSchedulePrompt('${safeSvcIdJs}')">Dupliquer</button>
              <button class="btn-sm" onclick="event.stopPropagation();game.ui.toggleSchedule('${safeSvcIdJs}')">${svc.active ? 'Desactiver' : 'Activer'}</button>
              <button class="btn-sm danger" onclick="event.stopPropagation();game.ui.deleteSchedule('${safeSvcIdJs}')">Supprimer</button>
            </td>
          </tr>
          <tr id="sched-detail-${safeSvcIdHtml}" class="hidden">
            <td colspan="8" class="sched-detail-cell">
              <div class="sched-detail-inner">
                <div class="close-row">
                  <span style="font-size:10px;color:var(--text2)">Détail du trajet</span>
                  <button class="btn-sm" onclick="event.stopPropagation();game.ui.toggleSchedDetail('${safeSvcIdJs}')">X</button>
                </div>
                <div class="sched-stops-preview">${stopsPreview}</div>
                ${passagePreview}
                ${returnPreview}
                ${bilanHtml}
              </div>
            </td>
          </tr>`;
      }).join('');

      const controls = pageCount > 1 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:8px;background:var(--bg3);border-radius:4px;font-size:11px">
          <span>Page ${this._schedPage + 1} / ${pageCount} — ${total} trajets</span>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" ${this._schedPage === 0 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(-1)">Précédent</button>
            <button class="btn-sm" ${this._schedPage >= pageCount - 1 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(1)">Suivant</button>
          </div>
        </div>` : '';

      container.innerHTML = `
        <table class="schedules-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Nom</th>
              <th>Rame</th>
              <th>Départ A</th>
              <th>Arrivée B</th>
              <th>Distance</th>
              <th>Jours</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        ${controls}`;
    },

  changeSchedPage(delta) {
      this._schedPage += delta;
      this.renderSchedulesList();
    },

  toggleSchedDetail(id) {
      const detail = document.getElementById(`sched-detail-${id}`);
      const caret = document.getElementById(`sched-caret-${id}`);
      if (!detail) return;
      const open = detail.classList.toggle('hidden');
      if (caret) caret.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
    },

  toggleSchedule(id) {
      const svc = this.game.scheduleCreator.services.find(s => s.id === id);
      if (svc) {
        svc.active = !svc.active;
        this.game.scheduleCreator._invalidateActiveCache();
      }
      this.renderSchedulesList();
    },

  duplicateSchedulePrompt(id) {
      const svc = this.game.scheduleCreator.services.find(s => s.id === id);
      if (!svc) return;
      const interval = prompt('Intervalle entre chaque depart (en minutes) :', '60');
      if (!interval) return;
      const count = prompt('Nombre de duplicatas :', '3');
      if (!count) return;
      const intv = parseInt(interval), cnt = parseInt(count);
      if (!intv || intv < 1 || !cnt || cnt < 1) return;
      const rame = this.game.rameManager.getById(svc.rameId);
      this.game.scheduleCreator.duplicateService(id, intv, cnt, rame, this.game.world);
      this.renderSchedulesList();
    },

  deleteSchedule(id) {
      if (!confirm('Supprimer ce service ?')) return;
      this.game.scheduleCreator.removeService(id);
      this.game.saveState();
      this.renderSchedulesList();
    }
};
