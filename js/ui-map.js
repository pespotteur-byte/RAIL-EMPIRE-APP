import { haversineDistance } from './simulation.js?v=1784931691';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784931691';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784931691';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784931691';
import { announceTrain } from './announcements.js?v=1784931691';

export const UIMap = {
  setupMapEvents() {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return;

      canvas.addEventListener('mousedown', (e) => {
        // S9: Check if clicking on a station for drag-to-move (shift+click)
        if (e.shiftKey && this._hoveredStation) {
          this._draggingStation = this._hoveredStation;
          this._stationDragStart = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'move';
          return;
        }
        // Voie point drag-to-move (shift+click)
        if (e.shiftKey && this._hoveredVoiePoint) {
          this._draggingVoiePoint = this._hoveredVoiePoint;
          canvas.style.cursor = 'move';
          return;
        }
        // Industry drag-to-move (shift+click)
        if (e.shiftKey && this._hoveredIndustry) {
          this._draggingIndustry = this._hoveredIndustry;
          canvas.style.cursor = 'move';
          return;
        }
        // Industry suppression (ctrl+click / cmd+click)
        if ((e.ctrlKey || e.metaKey) && this._hoveredIndustry) {
          if (confirm('Supprimer ce site industriel ?')) {
            this.game.industrialClients.removeSite(this._hoveredIndustry._key);
            this.game.saveState();
          }
          return;
        }
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragMoved = false;
      });

      canvas.addEventListener('mousemove', (e) => {
        // S9: Handle station dragging
        if (this._draggingStation && this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
          this._draggingStation.lat = worldPos.lat;
          this._draggingStation.lon = worldPos.lon;
          return;
        }
        // Voie point dragging
        if (this._draggingVoiePoint && this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
          this._draggingVoiePoint.lat = worldPos.lat;
          this._draggingVoiePoint.lon = worldPos.lon;
          return;
        }
        // Industry dragging (mutates the cached loc for live feedback)
        if (this._draggingIndustry && this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
          this._draggingIndustry.lat = worldPos.lat;
          this._draggingIndustry.lon = worldPos.lon;
          return;
        }
        if (this.isDragging && this.game.renderer) {
          const dx = e.clientX - this.dragStart.x;
          const dy = e.clientY - this.dragStart.y;
          if (!this.dragMoved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            this.dragMoved = true;
            this._followService = null; // panner la carte arrête le suivi
          }
          if (this.dragMoved) {
            this.game.renderer.tileMap.pan(dx, dy);
            this.dragStart = { x: e.clientX, y: e.clientY };
          }
        }
        if (this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          this.handleMapHover(e.clientX - rect.left, e.clientY - rect.top);
        }
      });

      canvas.addEventListener('mouseleave', () => {
        this.isDragging = false;
        this.dragMoved = false;
        if (this._draggingStation || this._draggingVoiePoint || this._draggingIndustry) {
          this._draggingStation = null;
          this._draggingVoiePoint = null;
          this._draggingIndustry = null;
          canvas.style.cursor = 'grab';
        }
      });
      window.addEventListener('mouseup', () => {
        this.isDragging = false;
        this.dragMoved = false;
        canvas.style.cursor = 'grab';
      });

      canvas.addEventListener('mouseup', (e) => {
        // S9: Finish station drag
        if (this._draggingStation) {
          this._draggingStation = null;
          canvas.style.cursor = 'grab';
          this.game.saveState();
          return;
        }
        // Finish voie point drag
        if (this._draggingVoiePoint) {
          this._draggingVoiePoint = null;
          canvas.style.cursor = 'grab';
          this.game.saveState();
          return;
        }
        // Finish industry drag — persist the new location
        if (this._draggingIndustry) {
          const ind = this._draggingIndustry;
          this._draggingIndustry = null;
          canvas.style.cursor = 'grab';
          this.game.industrialClients.setLocationOverride(ind._key, ind.lat, ind.lon);
          this.game.saveState();
          return;
        }
        if (this.isDragging && !this.dragMoved && this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          // LVM-04/06 — clic sur un train : sélection + panneau détail.
          const _anyMode = this._pickConnectionMode || this.tronconCreationMode
            || this.manualTronconMode || this.tracerLigneMode || this.voiePointCreationMode
            || this.stationCreationMode || this.iteCreationMode || this.industryCreationMode
            || this.game._pendingSignalBox || this.game._pendingRegZone;
          if (!_anyMode && this.activePage === 'map') {
            const picked = this._findServiceAtScreen(x, y);
            if (picked) { this.selectService(picked); this.isDragging = false; return; }
            if (this.selectedService && !this._hoveredStation && !this._hoveredVoiePoint) {
              this.deselectService();
            }
          }

          // Pick-connection mode: clicking on an existing station to connect
          if (this._pickConnectionMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            let closest = null, minDist = Infinity;
            for (const st of this.game.world.stations) {
              const d = Math.hypot(st.lat - worldPos.lat, st.lon - worldPos.lon);
              if (d < minDist) { minDist = d; closest = st; }
            }
            if (closest && minDist < 0.5) {
              this.handlePickConnection(closest);
            }
            this.isDragging = false;
            return;
          }

          // Troncon creation mode: click 2 points (station or voie point)
          if (this.tronconCreationMode) {
            this._handleTronconClick(x, y);
            this.isDragging = false;
            return;
          }

          // Manual troncon creation mode: click places waypoints on map
          if (this.manualTronconMode) {
            this._handleManualTronconClick(x, y);
            this.isDragging = false;
            return;
          }

          // Tracer ligne mode: click picks start/end for infrastructure import
          if (this.tracerLigneMode) {
            this._handleTracerLigneClick(x, y);
            this.isDragging = false;
            return;
          }

          // Voie point creation mode
          if (this.voiePointCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.openVoiePointModal(worldPos.lat, worldPos.lon);
            this.isDragging = false;
            return;
          }

          if (this.stationCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.openStationCreationModal(worldPos.lat, worldPos.lon);
          }

          // ITE creation placement mode
          if (this.iteCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.iteCreationMode = false;
            document.getElementById('game-canvas').style.cursor = 'grab';
            this._hidePickHint();
            this.openItemModal(worldPos.lat, worldPos.lon);
            this.isDragging = false;
            return;
          }

          // XXI — industrial site creation on the livemap
          if (this.industryCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.industryCreationMode = false;
            const btn = document.getElementById('btn-create-industry');
            if (btn) { btn.textContent = '+ Industrie'; btn.classList.remove('active-mode'); }
            document.getElementById('game-canvas').style.cursor = 'grab';
            this._hidePickHint();
            const types = this.game.industrialClients.getIndustryTypes();
            const typeList = types.map(t => `${t.type} - ${t.name}`).join('\n');
            const typeInput = prompt(`Type d'industrie :\n${typeList}`) || '';
            const type = typeInput.split(' - ')[0].trim();
            if (!types.find(t => t.type === type)) { this.isDragging = false; return; }
            const name = prompt('Nom du site :')?.trim();
            if (!name) { this.isDragging = false; return; }
            const country = (prompt('Pays (FR) :') || 'FR').trim();
            this.game.industrialClients.addCustomSite(type, name, worldPos.lat, worldPos.lon, country);
            this.game.saveState();
            this.isDragging = false;
            return;
          }

          // Signal box placement mode
          if (this.game._pendingSignalBox) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            const pending = this.game._pendingSignalBox;
            this.game.staffManager.addSignalBox({
              name: pending.name,
              lat: worldPos.lat,
              lon: worldPos.lon,
              radiusKm: pending.radiusKm,
            });
            this.game._pendingSignalBox = null;
            this.game.saveState();
            document.getElementById('game-canvas').style.cursor = 'grab';
            this._hidePickHint();
            const staffContainer = document.getElementById('staff-container');
            if (staffContainer) this.game.staffManager.render(staffContainer, this.game);
          }

          // Regulation zone placement mode
          if (this.game._pendingRegZone) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            const pending = this.game._pendingRegZone;
            this.game.staffManager.addZone(pending.name, worldPos.lat, worldPos.lon, pending.radiusKm);
            this.game._pendingRegZone = null;
            this.game.saveState();
            document.getElementById('game-canvas').style.cursor = 'grab';
            this._hidePickHint();
            const staffContainer = document.getElementById('staff-container');
            if (staffContainer) this.game.staffManager.render(staffContainer, this.game);
          }
        }
        this.isDragging = false;
      });

      // Arrow keys pan the map
      document.addEventListener('keydown', (e) => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && this.activePage === 'map') {
          e.preventDefault();
          const step = 50;
          if (e.key === 'ArrowUp') this.game.renderer.tileMap.pan(0, step);
          else if (e.key === 'ArrowDown') this.game.renderer.tileMap.pan(0, -step);
          else if (e.key === 'ArrowLeft') this.game.renderer.tileMap.pan(step, 0);
          else if (e.key === 'ArrowRight') this.game.renderer.tileMap.pan(-step, 0);
        }
      });

      // Escape key cancels pick-connection mode, creation modes, multi-creation, and closes modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Exit multi-creation mode
          if (this._multiCreateMode) {
            this._multiCreateMode = null;
            document.querySelectorAll('.btn-map-action').forEach(b => b.classList.remove('multi-mode'));
          }
          if (this._pickConnectionMode) {
            this._pickConnectionMode = false;
            this._hidePickHint();
            const c = document.getElementById('game-canvas');
            if (c) c.style.cursor = 'grab';
            document.getElementById('modal-station')?.classList.remove('hidden');
          }
          if (this.stationCreationMode) this.toggleStationCreation();
          if (this.voiePointCreationMode) this.toggleVoiePointCreation();
          if (this.tronconCreationMode) this.toggleTronconCreation();
          if (this.manualTronconMode) this.toggleManualTronconCreation();
          if (this.tracerLigneMode) this.toggleTracerLigne();
          if (this.iteCreationMode) this._closeITECreator();
          if (this.industryCreationMode) this.toggleIndustryCreation();
          if (this._insertAfterIndex != null) {
            this._insertAfterIndex = null;
            this._updateManualUI();
          }
          // Close any open modal
          const openModal = document.querySelector('.modal:not(.hidden)');
          if (openModal) openModal.classList.add('hidden');
        }
        if (e.key === 'Delete') {
          if (this._lastLineGroupId) {
            const removed = this.game.voiePointManager.deleteLineGroup(this._lastLineGroupId);
            this._lastLineGroupId = null;
            this.game.saveState();
            this._showPickHint(`Supprimé: ${removed} éléments. Cliquer pour un nouveau tracé ou Echap.`);
          } else if (this._hoveredStation && this.activePage === 'map') {
            if (confirm(`Supprimer la gare "${this._hoveredStation.name}" ?`)) {
              this.game.world.removeStation(this._hoveredStation.id);
              this._hoveredStation = null;
              this.game.saveState();
            }
          } else if (this._hoveredVoiePoint && this.activePage === 'map') {
            this.game.voiePointManager.remove(this._hoveredVoiePoint.id);
            this._hoveredVoiePoint = null;
            this.game.saveState();
          }
        }
      });

      canvas.addEventListener('dblclick', (e) => {
        if (this._hoveredStation && !this.stationCreationMode && !this._pickConnectionMode) {
          this.openEditStationModal(this._hoveredStation);
        }
        if (this._hoveredVoiePoint && !this.voiePointCreationMode && !this.tronconCreationMode) {
          this.openEditVoiePointModal(this._hoveredVoiePoint);
        }
      });

      canvas.addEventListener('mouseleave', () => {
        this.isDragging = false;
        document.getElementById('tooltip')?.classList.add('hidden');
      });

      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const delta = e.deltaY < 0 ? 1 : -1;
          this.game.renderer.tileMap.applyZoom(delta, x, y);
        }
      });

      // Touch events for mobile
      let touchStart = null, touchDist = null, touchMoved = false;
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchMoved = false;
        } else if (e.touches.length === 2) {
          touchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
          touchMoved = true;
        }
      }, { passive: false });
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && touchStart && this.game.renderer) {
          const dx = e.touches[0].clientX - touchStart.x;
          const dy = e.touches[0].clientY - touchStart.y;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) touchMoved = true;
          this.game.renderer.tileMap.pan(dx, dy);
          touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && touchDist !== null && this.game.renderer) {
          touchMoved = true;
          const newDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const rect = canvas.getBoundingClientRect();
          const delta = newDist > touchDist ? 1 : -1;
          this.game.renderer.tileMap.applyZoom(delta, cx - rect.left, cy - rect.top);
          touchDist = newDist;
        }
      }, { passive: false });
      canvas.addEventListener('touchend', (e) => {
        if (!touchMoved && touchStart && this.game.renderer) {
          const rect = canvas.getBoundingClientRect();
          const x = touchStart.x - rect.left;
          const y = touchStart.y - rect.top;
          // LVM-04/06 — tap sur un train : sélection + panneau détail.
          const _tapMode = this._pickConnectionMode || this.tronconCreationMode
            || this.manualTronconMode || this.tracerLigneMode || this.voiePointCreationMode
            || this.stationCreationMode || this.industryCreationMode || this.game._pendingSignalBox || this.game._pendingRegZone;
          if (!_tapMode && this.activePage === 'map') {
            const picked = this._findServiceAtScreen(x, y);
            if (picked) {
              this.selectService(picked);
              touchStart = null; touchDist = null; touchMoved = false;
              return;
            }
          }
          if (this._pickConnectionMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            let closest = null, minDist = Infinity;
            for (const st of this.game.world.stations) {
              const d = Math.hypot(st.lat - worldPos.lat, st.lon - worldPos.lon);
              if (d < minDist) { minDist = d; closest = st; }
            }
            if (closest && minDist < 0.5) this.handlePickConnection(closest);
          } else if (this.tronconCreationMode) {
            this._handleTronconClick(x, y);
          } else if (this.manualTronconMode) {
            this._handleManualTronconClick(x, y);
          } else if (this.tracerLigneMode) {
            this._handleTracerLigneClick(x, y);
          } else if (this.voiePointCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.openVoiePointModal(worldPos.lat, worldPos.lon);
          } else if (this.stationCreationMode) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            this.openStationCreationModal(worldPos.lat, worldPos.lon);
          } else if (this.game._pendingSignalBox) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            const pending = this.game._pendingSignalBox;
            this.game.staffManager.addSignalBox({ name: pending.name, lat: worldPos.lat, lon: worldPos.lon, radiusKm: pending.radiusKm });
            this.game._pendingSignalBox = null;
            this.game.saveState();
            canvas.style.cursor = 'grab';
            this._hidePickHint();
            const staffContainer = document.getElementById('staff-container');
            if (staffContainer) this.game.staffManager.render(staffContainer, this.game);
          } else if (this.game._pendingRegZone) {
            const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
            const pending = this.game._pendingRegZone;
            this.game.staffManager.addZone(pending.name, worldPos.lat, worldPos.lon, pending.radiusKm);
            this.game._pendingRegZone = null;
            this.game.saveState();
            canvas.style.cursor = 'grab';
            this._hidePickHint();
            const staffContainer = document.getElementById('staff-container');
            if (staffContainer) this.game.staffManager.render(staffContainer, this.game);
          }
        }
        touchStart = null; touchDist = null; touchMoved = false;
      });
    },

  handleMapHover(x, y) {
      const renderer = this.game.renderer;
      if (!renderer) return;
      this._hoveredIndustry = null;
      const tooltip = document.getElementById('tooltip');
      const station = renderer.getStationAt(x, y, this.game.world.stations);
      if (station) {
        const typeLabels = { voyageur: 'Voyageurs', marchandise: 'Marchandises', ite: 'ITE', depot: 'Depot', mixed: 'Mixte' };
        const platformNames = station.platformNames?.length > 0 ? station.platformNames.map(escapeHtml).join(', ') : '';
        tooltip.innerHTML = `<div class="tt-name">${escapeHtml(station.name)}</div><div class="tt-info">${station.platforms} voies${platformNames ? ' (' + platformNames + ')' : ''} | ${escapeHtml(typeLabels[station.type] || station.type)}</div><div style="font-size:9px;color:#fbbf24;margin-top:2px">Double-clic pour modifier</div>`;
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y - 10) + 'px';
        tooltip.classList.remove('hidden');
        this._hoveredStation = station;
        this._hoveredVoiePoint = null;
        return;
      }
      this._hoveredStation = null;

      // Check voie points
      const vpm = this.game.voiePointManager;
      if (vpm) {
        const vp = renderer.getVoiePointAt(x, y, vpm.getAll());
        if (vp) {
          const tronconsCount = vpm.getTronconsForPoint(vp.id).length;
          const stName = vp.stationId ? escapeHtml(this.game.world.getStationById(vp.stationId)?.name || '') : '';
          const stLabel = stName ? ` (${stName})` : ' (en ligne)';
          const occLabel = vp.occupiedBy ? ' — OCCUPEE' : '';
          tooltip.innerHTML = `<div class="tt-name">Voie ${escapeHtml(vp.voie)}${stLabel}${occLabel}</div><div class="tt-info">${tronconsCount} troncon(s)</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Double-clic pour modifier | Shift+drag pour deplacer</div>`;
          tooltip.style.left = (x + 15) + 'px';
          tooltip.style.top = (y - 10) + 'px';
          tooltip.classList.remove('hidden');
          this._hoveredVoiePoint = vp;
          return;
        }
      }
      this._hoveredVoiePoint = null;

      // Industry markers (only interactive when the layer is shown)
      if (document.getElementById('toggle-industries')?.checked) {
        const ind = renderer.getIndustryAt(x, y);
        if (ind) {
          tooltip.innerHTML = `<div class="tt-name">${escapeHtml(ind.name)}</div><div class="tt-info">${escapeHtml(ind.industryName)}</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Shift+drag pour déplacer | Ctrl+clic pour supprimer</div>`;
          tooltip.style.left = (x + 15) + 'px';
          tooltip.style.top = (y - 10) + 'px';
          tooltip.classList.remove('hidden');
          this._hoveredIndustry = ind;
          return;
        }
      }
      tooltip.classList.add('hidden');
    },

  _findServiceAtScreen(x, y) {
      const renderer = this.game.renderer;
      if (!renderer || !this.game.scheduleCreator) return null;
      const services = this.game.scheduleCreator.getActiveServices();
      let best = null, bestD = 24; // seuil px (icône ~25 px)
      for (const svc of services) {
        if (!svc.position || svc.state === 'completed') continue;
        if (svc.state === 'waiting' && !svc.train?.stoppedAt) continue;
        const p = renderer.latLonToScreen(svc.position.lat, svc.position.lon);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = svc; }
      }
      return best;
    },

  selectService(svc) {
      this.selectedService = svc;
      this._followService = svc;
      this._lvpKey = null; // force un rebuild complet
      this._lastSelectedForScroll = null; // force le bandeau à scroller sur la carte
      // LVM-04/06 — centre immédiatement sur le train cliqué
      if (svc && svc.position && this.game.renderer?.tileMap) {
        const tm = this.game.renderer.tileMap;
        tm.centerLat = svc.position.lat;
        tm.centerLon = svc.position.lon;
        tm.markDirty();
      }
      this._syncLivemapPanel();
      announceTrain(svc, this.game.world);
    },

  _syncLivemapPanel() {
      const svc = this.selectedService;
      const panel = document.getElementById('livemap-train-panel');
      if (!panel) return;
      if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
        this.selectedService = null;
        this._lvpKey = null;
        this._lvpStateKey = null;
        panel.classList.add('hidden');
        return;
      }
      const stops = typeof svc.getCurrentStops === 'function'
        ? svc.getCurrentStops()
        : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
      const key = `${svc.id}|${svc.isReturnLeg ? 'R' : 'A'}|${stops.length}`;
      if (key !== this._lvpKey) {
        this._lvpKey = key;
        this._renderLivemapPanel();
        return;
      }
      // Rafraîchissement léger (vitesse / retard) à chaque frame.
      const t = svc.train;
      const sp = document.getElementById('lvp-speed');
      if (sp) sp.textContent = `${Math.round(t.speed)} km/h`;
      const dl = document.getElementById('lvp-delay');
      if (dl) {
        const d = Math.round(Number.isFinite(t.delay) ? t.delay : 0);
        dl.className = d > 0 ? 'late' : d < 0 ? 'early' : 'ok';
        dl.textContent = d > 0 ? `+${d} min` : d < 0 ? `- ${Math.abs(d)} min` : `à l'heure`;
      }
      // Quand l'arrêt courant ou le retard change, on reconstruit situation, bandeau et étapes.
      const curIdx = svc.currentStopIndex || 0;
      const stateKey = `${curIdx}|${Math.round(Number.isFinite(t.delay) ? t.delay : 0)}`;
      if (stateKey !== this._lvpStateKey) {
        this._lvpStateKey = stateKey;
        const { d, rows, bandeau, situation, nextHtml, curIdx: newIdx } = this._buildLivemapPanelContent(svc);
        const sitEl = document.getElementById('lvp-situation');
        if (sitEl) sitEl.innerHTML = situation;
        const nextEl = document.getElementById('lvp-next');
        if (nextEl) nextEl.innerHTML = nextHtml;
        const bandeauEl = document.getElementById('lvp-bandeau-track');
        if (bandeauEl) {
          bandeauEl.textContent = bandeau;
          this._updateBandeauMarquee();
        }
        const stopsEl = document.getElementById('lvp-stops');
        if (stopsEl) {
          const scrollTop = stopsEl.scrollTop;
          stopsEl.innerHTML = rows;
          stopsEl.scrollTop = scrollTop;
        }
        if (this._lvpLastCurIdx !== newIdx) {
          this._lvpLastCurIdx = newIdx;
          const curEl = panel.querySelector('.lvp-stop.cur');
          if (curEl) curEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        }
      }
    },

  selectServiceById(id) {
      const svc = this.game.scheduleCreator?.services.find(s => s.id === id);
      if (svc) this.selectService(svc);
    },

  deselectService() {
      this.selectedService = null;
      this._followService = null;
      this._lastSelectedForScroll = null;
      document.getElementById('livemap-train-panel')?.classList.add('hidden');
    },

  applyCameraFollow() {
      const svc = this._followService;
      if (!svc || !svc.position || !this.game.renderer?.tileMap) return;
      if (svc.state === 'completed' || !this.game.scheduleCreator?.services.includes(svc)) {
        this._followService = null;
        return;
      }
      const tm = this.game.renderer.tileMap;
      tm.centerLat = svc.position.lat;
      tm.centerLon = svc.position.lon;
      tm.markDirty();
    },

  _buildLivemapPanelContent(svc) {
      const t = svc.train;
      const d = Math.round(Number.isFinite(t.delay) ? t.delay : 0);
      const stops = typeof svc.getCurrentStops === 'function'
        ? svc.getCurrentStops()
        : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
      const world = this.game.world;
      const fmt = (m) => this.minToTimeStr(((Math.round(m) % 1440) + 1440) % 1440);
      const curIdx = svc.currentStopIndex || 0;

      // currentStopIndex semantics: moving = target stop; stopped/waiting = next leg, current station is previous
      let prevIdx, curStationIdx, nextIdx;
      if (svc.state === 'moving') {
        prevIdx = curIdx - 1;
        curStationIdx = curIdx;
        nextIdx = curIdx + 1;
      } else {
        if (curIdx === 0) { prevIdx = -1; curStationIdx = 0; nextIdx = 1; }
        else { prevIdx = curIdx - 2; curStationIdx = curIdx - 1; nextIdx = curIdx; }
      }

      const cat = svc.category || t.category || 'voyageur';
      const catColor = LVM_CAT_COLORS[cat] || t.color || '#22d3ee';

      // Annex 5 — planned (grey crossed-out) vs recalculated times.
      const isArret = (s) => s && s.type === 'arret' && s.stationId;
      const buildTimes = (s, isFirst, isLast, origIdx) => {
        const arrMins = s.arrivalTime ?? s.departureTime ?? 0;
        const depMins = s.departureTime ?? s.arrivalTime ?? 0;
        const actualArr = arrMins + d;
        const actualDep = depMins + d;
        const dwell = (!isFirst && !isLast && depMins > arrMins) ? Math.max(0, Math.round(depMins - arrMins)) : 0;
        const showRecalc = d !== 0 && origIdx >= curIdx;
        return {
          arr: isFirst ? null : fmt(actualArr),
          dep: isLast ? null : fmt(actualDep),
          plannedArr: (showRecalc && !isFirst) ? fmt(arrMins) : null,
          plannedDep: (showRecalc && !isLast) ? fmt(depMins) : null,
          dwell
        };
      };

      const displayStops = stops.map((s, i) => ({ s, origIdx: i })).filter(({ s }) => isArret(s));

      // GPS arrow must point to the next arret when moving (ignoring waypoints/voie points).
      let displayCurIdx = -1;
      if (svc.state === 'moving') {
        displayCurIdx = displayStops.findIndex(({ origIdx }) => origIdx >= curStationIdx);
        if (displayCurIdx < 0) displayCurIdx = displayStops.length - 1;
      } else {
        displayCurIdx = displayStops.findIndex(({ origIdx }) => origIdx === curStationIdx);
        if (displayCurIdx < 0) {
          for (let idx = 0; idx < displayStops.length; idx++) {
            if (displayStops[idx].origIdx < curStationIdx) displayCurIdx = idx;
          }
        }
      }
      if (displayCurIdx < 0) displayCurIdx = 0;

      // GPS arrow: on the current station dot when stopped; at the top of the next arret row when moving.
      let arrowIdx = -1, arrowTop = '50%';
      if (svc.state === 'moving' && displayCurIdx >= 0) {
        arrowIdx = displayCurIdx;
        arrowTop = '0%';
      } else if (svc.state !== 'completed' && displayCurIdx >= 0) {
        arrowIdx = displayCurIdx;
      }

      let rows = displayStops.map(({ s, origIdx }, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === displayStops.length - 1;
        const name = escapeHtml(world.getStationById(s.stationId)?.name || '—');
        const cur = idx === displayCurIdx ? ' cur' : '';
        const voie = s.platform ? `Voie ${escapeHtml(s.platform)}` : '';
        const { arr, dep, plannedArr, plannedDep, dwell } = buildTimes(s, isFirst, isLast, origIdx);
        const showArr = arr !== null;
        const showDep = dep !== null;
        const arrLabel = showArr ? 'Heure arrivée' : '';
        const depLabel = showDep ? 'Heure départ' : '';
        const plannedArrHtml = plannedArr ? `<span class="lvp-time-planned">${plannedArr}</span>` : '';
        const plannedDepHtml = plannedDep ? `<span class="lvp-time-planned">${plannedDep}</span>` : '';
        const arrContent = showArr ? `<span class="lvp-time-label">${arrLabel}</span><span class="lvp-time-value">${arr}</span>${plannedArrHtml}` : '';
        const depContent = showDep ? `<span class="lvp-time-label">${depLabel}</span><span class="lvp-time-value">${dep}</span>${plannedDepHtml}` : '';
        const arrow = idx === arrowIdx ? `<div class="lvp-arrow" style="top:${arrowTop}">&#9660;</div>` : '';
        return `<div class="lvp-stop${cur}">
          <div class="lvp-stop-times">
            <div class="lvp-time-row">${arrContent}</div>
            <div class="lvp-time-row">${depContent}</div>
          </div>
          <div class="lvp-stop-track" style="--track-color:${catColor}">
            <div class="lvp-stop-line"></div>
            <div class="lvp-stop-dot"></div>
            ${arrow}
          </div>
          <div class="lvp-stop-info">
            <div class="lvp-stop-name">${name}</div>
            ${voie ? `<div class="lvp-stop-voie">${voie}</div>` : ''}
            ${dwell > 0 ? `<div class="lvp-stop-dwell">${dwell} min d'arrêt</div>` : ''}
          </div>
        </div>`;
      }).join('');

      // Single continuous vertical line behind the stops, scrolls with the list.
      rows = `<div class="lvp-stops-inner" style="--lvp-line-color:${catColor}"><div class="lvp-stops-line"></div>${rows}</div>`;

      const bandeauStartIdx = displayStops.findIndex(({ origIdx }) => origIdx >= curIdx);
      const bandeauStops = displayStops.slice(bandeauStartIdx >= 0 ? bandeauStartIdx : 0);
      const bandeau = bandeauStops.length ? `Prochains arrêts : ${bandeauStops.map(({ s }) => escapeHtml(world.getStationById(s.stationId)?.name)).filter(Boolean).join('  •  ')}` : 'Service terminé';

      const stopName = (s) => s?.stationId ? escapeHtml(world.getStationById(s.stationId)?.name || '—') : (s ? 'Waypoint' : '—');
      const nextArretFrom = (fromIndex) => {
        for (let i = fromIndex; i < stops.length; i++) if (isArret(stops[i])) return stops[i];
        return null;
      };

      // Annex 5 — detailed situational info
      const prevStop = stops[prevIdx];
      const curStop = stops[curStationIdx];
      const nextStop = stops[nextIdx];
      const prevName = stopName(prevStop);
      const curName = stopName(curStop);
      const nextArret = nextArretFrom(svc.state === 'moving' ? curIdx : (nextIdx >= 0 ? nextIdx : curIdx));
      const nextName = nextArret ? escapeHtml(world.getStationById(nextArret.stationId)?.name || '—') : '—';
      const lastArret = stops.filter(isArret).pop();
      const destName = lastArret ? escapeHtml(world.getStationById(lastArret.stationId)?.name || '—') : (stops.length > 1 ? escapeHtml(world.getStationById(stops[stops.length - 1].stationId)?.name || '—') : '—');
      const displayNext = nextArret;
      const nextArrTime = displayNext ? (displayNext.arrivalTime ?? displayNext.departureTime) : null;
      const nextArrLabel = nextArrTime != null
        ? (d !== 0
            ? ` · Arr. <span style="text-decoration:line-through;color:#888">${fmt(nextArrTime)}</span> <span class="lvp-recalc ${d > 0 ? 'lvp-recalc-late' : 'lvp-recalc-early'}">${fmt(nextArrTime + d)}</span>`
            : ` · Arr. ${fmt(nextArrTime)}`)
        : '';
      const findArretStop = (start, dir) => {
        for (let i = start; dir > 0 ? i < stops.length : i >= 0; i += dir) if (isArret(stops[i])) return stops[i];
        return null;
      };
      const arretStationName = (s) => s?.stationId ? escapeHtml(world.getStationById(s.stationId)?.name || '—') : '—';

      // "Se situe entre" : utiliser les arrêts programmés (pas les points de voie)
      // pour éviter l'erreur due aux décalages voie/gare centre.
      const ctxPrevArret = findArretStop(curStationIdx - 1, -1);
      const ctxNextArret = findArretStop(curStationIdx, 1);
      const ctxPrevName = escapeHtml(arretStationName(ctxPrevArret) || prevName);
      const ctxNextName = escapeHtml(arretStationName(ctxNextArret) || curName);

      let situation;
      if (svc.cancelled) {
        situation = '<span style="color:#ef4444;font-weight:600">Service supprimé</span>';
      } else if (t.speed === 0 && (svc.state === 'stopped_at_station' || svc.train?.stoppedAt)) {
        situation = `Arrêt en gare de <b>${curName}</b>`;
      } else if (curIdx > 0 && curIdx < stops.length) {
        if (ctxPrevName && ctxNextName && ctxPrevName !== ctxNextName) {
          situation = `Se situe entre <b>${ctxPrevName}</b> et <b>${ctxNextName}</b>`;
        } else if (ctxNextName) {
          situation = `En route vers <b>${ctxNextName}</b>`;
        } else {
          situation = 'Service terminé';
        }
      } else if (curIdx === 0) {
        situation = `Au départ de <b>${curName}</b>`;
      } else {
        situation = 'Service terminé';
      }

      const nextHtml = `Prochain arrêt : <b>${nextName}</b>${nextArrLabel} · Destination: <b>${destName}</b>`;
      return { d, rows, bandeau, situation, nextHtml, curIdx };
    },

  _updateBandeauMarquee() {
      const track = document.getElementById('lvp-bandeau-track');
      const wrapper = track?.parentElement;
      if (!track || !wrapper) return;
      const text = track.textContent;
      if (this._lvpMarqueeText === text && track.classList.contains('marquee')) return;
      if (this._lvpMarqueeRaf) cancelAnimationFrame(this._lvpMarqueeRaf);
      this._lvpMarqueeRaf = null;
      this._lvpMarqueeText = text;
      track.classList.remove('marquee');
      track.style.transform = '';
      void track.offsetWidth;
      if (track.scrollWidth <= wrapper.clientWidth) return;
      track.classList.add('marquee');
      const speed = 18; // pixels per second (défilement lent)
      let x = wrapper.clientWidth;
      let last = performance.now();
      const step = (now) => {
        if (!track.parentElement) return;
        if (track.scrollWidth <= wrapper.clientWidth) return;
        const dt = (now - last) / 1000;
        last = now;
        x -= dt * speed;
        if (x + track.scrollWidth <= 0) x = wrapper.clientWidth;
        track.style.transform = `translateX(${x}px)`;
        this._lvpMarqueeRaf = requestAnimationFrame(step);
      };
      this._lvpMarqueeRaf = requestAnimationFrame(step);
    },

  _renderLivemapPanel() {
      const panel = document.getElementById('livemap-train-panel');
      if (!panel) return;
      const svc = this.selectedService;
      // Le service a pu se terminer / disparaître : on referme.
      if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
        this.selectedService = null;
        this._lvpKey = null;
        this._lvpStateKey = null;
        panel.classList.add('hidden');
        return;
      }
      const t = svc.train;
      const cat = svc.category || t.category || 'voyageur';
      const catColor = LVM_CAT_COLORS[cat] || t.color || '#22d3ee';
      const displayName = t.seriesName ? `${t.seriesName} ${t.number || ''}`.trim() : svc.name;
      const numLabel = svc.number != null
        ? `<span class="lvp-num">N°${svc.number}${svc.roundTrip && svc.returnNumber != null ? '/' + svc.returnNumber : ''}</span>`
        : '';

      const { d, rows, bandeau, situation, nextHtml, curIdx } = this._buildLivemapPanelContent(svc);

      const rame = svc.rame;
      const composition = rame
        ? `<div style="padding:6px 10px;font-size:10px;color:var(--text2);border-bottom:1px solid #333;background:#0d0d0d">
             <b>Composition :</b> ${escapeHtml(rame.name)}<br>
             Long: ${rame.totalLength.toFixed(1)}m · Tonnage: ${rame.totalTonnage}t · Vmax: ${rame.maxSpeed} km/h · Traction: ${escapeHtml(rame.traction)}
           </div>`
        : '';

      // Annexes 4-5 — charge transportée affichée dans le panneau détail.
      let payloadInfo = '';
      if (rame) {
        if (cat === 'fret' || rame.totalFreightCapacity > 0) {
          const load = Math.max(0, svc._onboardFreight != null ? Math.round(svc._onboardFreight) : Math.round(rame.totalFreightCapacity * 0.7));
          payloadInfo = `${load} tonnes de frets transportées`;
        } else if (cat === 'voyageur' || rame.totalCapacity > 0) {
          const pax = Math.max(0, svc._onboardPax != null ? Math.round(svc._onboardPax) : Math.round(rame.totalCapacity * 0.7));
          payloadInfo = `${pax} passagers à bord`;
        }
      }

      const panelIcon = LVM_CAT_ICONS[cat] || LVM_CAT_ICONS.generic;
      panel.innerHTML = `
        <div class="lvp-header" style="background:${escapeHtml(catColor)}">
          <img src="${escapeHtml(panelIcon)}" class="lvp-cat" alt="">
          <span class="lvp-title">${escapeHtml(displayName)}</span>
          ${numLabel}
          <button class="lvp-close" onclick="game.ui.deselectService()" title="Fermer">×</button>
        </div>
        <div class="lvp-sub"><span id="lvp-speed">${Math.round(t.speed)} km/h</span><span id="lvp-delay" class="${d > 0 ? 'late' : d < 0 ? 'early' : 'ok'}">${d > 0 ? '+' + d + ' min' : d < 0 ? '- ' + Math.abs(d) + ' min' : "à l'heure"}</span><span>${escapeHtml(LVM_CAT_LABELS[cat] || cat)}</span></div>
        <div class="lvp-situation" id="lvp-situation">${situation}</div>
        ${t.delayReason ? `<div class="lvp-delay-reason">${escapeHtml(t.delayReason)}</div>` : ''}
        ${composition}
        ${payloadInfo ? `<div class="lvp-payload">${payloadInfo}</div>` : ''}
        <div class="lvp-bandeau"><span class="lvp-bandeau-track" id="lvp-bandeau-track">${bandeau}</span></div>
        <div class="lvp-stops" id="lvp-stops">${rows}</div>
        <div class="lvp-legend">dép = départ · pass = passage · arr = arrivée</div>
      `;
      panel.classList.remove('hidden');
      this._updateBandeauMarquee();
      this._lvpLastCurIdx = curIdx;
      const curEl = panel.querySelector('.lvp-stop.cur');
      if (curEl) curEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    },

  setupMapSearch() {
      const input = document.getElementById('map-search-input');
      const results = document.getElementById('map-search-results');
      if (!input || !results) return;
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 3) { results.classList.add('hidden'); return; }
        timer = setTimeout(() => this._searchPlace(q), 400);
      });
      input.addEventListener('blur', () => { setTimeout(() => results.classList.add('hidden'), 200); });
      input.addEventListener('focus', () => { if (results.children.length > 0) results.classList.remove('hidden'); });
    },

  async _searchPlace(q) {
      const results = document.getElementById('map-search-results');
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=fr`);
        const data = await resp.json();
        results.innerHTML = '';
        if (data.length === 0) {
          results.innerHTML = '<div class="map-search-result" style="color:var(--text3)">Aucun résultat</div>';
        } else {
          for (const r of data) {
            const div = document.createElement('div');
            div.className = 'map-search-result';
            div.textContent = r.display_name;
            div.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const lat = parseFloat(r.lat);
              const lon = parseFloat(r.lon);
              this.game.renderer.tileMap.centerLat = lat;
              this.game.renderer.tileMap.centerLon = lon;
              this.game.renderer.tileMap.zoomLevel = Math.max(this.game.renderer.tileMap.zoomLevel, 12);
              document.getElementById('map-search-input').value = '';
              results.classList.add('hidden');
            });
            results.appendChild(div);
          }
        }
        results.classList.remove('hidden');
      } catch (e) { /* silent */ }
    },

  setupLivemapPanelDrag() {
      const panel = document.getElementById('livemap-train-panel');
      if (!panel) return;
      let dragging = false, startX, startY, startLeft, startTop;
      panel.addEventListener('mousedown', (e) => {
        if (e.target.closest('.lvp-close, button, a')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        panel.style.cursor = 'grabbing';
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = `${Math.max(0, startLeft + dx)}px`;
        panel.style.top = `${Math.max(0, startTop + dy)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      });
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        panel.style.cursor = '';
      });
    }
};
