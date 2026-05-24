export class UI {
  constructor(game) {
    this.game = game;
    this.activePage = 'map';
    this.selectedService = null;
    this.isDragging = false;
    this.dragStart = null;
    this.schedStops = [];
    this.currentRameElements = [];
    this.editingRameId = null;
    this.stationCreationMode = false;
    this.voiePointCreationMode = false;
    this.tronconCreationMode = false;
    this._tronconPointA = null; // first point selected for troncon creation
    this._hoveredVoiePoint = null;
    this._draggingVoiePoint = null;
    this._schedTileMap = null;
    // Global blink timer for "À l'approche" (survives DOM re-renders)
    this._approachVisible = true;
    this._approachInterval = setInterval(() => {
      this._approachVisible = !this._approachVisible;
      const els = document.querySelectorAll('.ctx-approach');
      if (els.length === 0) return; // skip when no elements exist
      els.forEach(el => {
        el.style.opacity = this._approachVisible ? '1' : '0';
      });
    }, 800);
  }

  setupAll() {
    this.setupNav();
    this.setupMapEvents();
    this.setupTabs();
    this.setupRollingStockPage();
    this.setupRamePage();
    this.setupSchedulePage();
    this.setupLinePage();
    this.setupDepotPage();
    this.setupIncidentPage();
    this.setupEconomyPage();
    this.setupModals();
    this.setupVoiePointButtons();
    this.setupMapSearch();
    this.setupMobileNav();
  }

  refreshAll() {
    if (this.activePage === 'rolling-stock') this.renderStockList();
    else if (this.activePage === 'rames') this.renderRamesList();
    else if (this.activePage === 'schedules') this.renderSchedulesList();
    else if (this.activePage === 'lines') this.renderLinesList();
    else if (this.activePage === 'depots') this.renderDepotsList();
    else if (this.activePage === 'incidents') this.renderIncidentsPage();
    else if (this.activePage === 'economy') this.renderEconomyPage();
    else if (this.activePage === 'infogare') this.renderInfogarePage();
    else if (this.activePage === 'dashboard') this.renderDashboard();
    else if (this.activePage === 'graph-marche') this.renderGraphMarche();
    else if (this.activePage === 'staff') this.renderStaffPage();
    else if (this.activePage === 'bank') this.renderBankPage();
    else if (this.activePage === 'weather') this.renderWeatherPage();
    else if (this.activePage === 'unions') this.renderUnionsPage();
    else if (this.activePage === 'seasonal') this.renderSeasonalPage();
    else if (this.activePage === 'connections') this.renderConnectionsPage();
    else if (this.activePage === 'station-upgrades') this.renderStationUpgradesPage();
    else if (this.activePage === 'junctions') this.renderJunctionsPage();
    else if (this.activePage === 'cargo-types') this.renderCargoTypesPage();
    else if (this.activePage === 'ite-modules') this.renderITEModulesPage();
    else if (this.activePage === 'industrial-clients') this.renderIndustrialClientsPage();
    else if (this.activePage === 'shunting') this.renderShuntingPage();
  }

  setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
    });

    // Tutorial button
    const tutBtn = document.getElementById('btn-tutorial');
    if (tutBtn) {
      tutBtn.addEventListener('click', () => {
        try { this.game.tutorial.start(this.game); } catch(e) { console.warn('Tutorial error:', e); }
      });
    }
  }

  switchPage(page) {
    this.activePage = page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');

    if (page === 'rolling-stock') this.renderStockList();
    if (page === 'rames') this.renderRamesList();
    if (page === 'schedules') this.renderSchedulesList();
    if (page === 'lines') this.renderLinesList();
    if (page === 'depots') this.renderDepotsList();
    if (page === 'incidents') this.renderIncidentsPage();
    if (page === 'economy') this.renderEconomyPage();
    if (page === 'infogare') this.renderInfogarePage();
    if (page === 'dashboard') this.renderDashboard();
    if (page === 'graph-marche') this.renderGraphMarche();
    if (page === 'staff') this.renderStaffPage();
    if (page === 'bank') this.renderBankPage();
    if (page === 'weather') this.renderWeatherPage();
    if (page === 'unions') this.renderUnionsPage();
    if (page === 'seasonal') this.renderSeasonalPage();
    if (page === 'connections') this.renderConnectionsPage();
    if (page === 'station-upgrades') this.renderStationUpgradesPage();
    if (page === 'junctions') this.renderJunctionsPage();
    if (page === 'cargo-types') this.renderCargoTypesPage();
    if (page === 'ite-modules') this.renderITEModulesPage();
    if (page === 'industrial-clients') this.renderIndustrialClientsPage();
    if (page === 'shunting') this.renderShuntingPage();
  }

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
      if (this.isDragging && this.game.renderer) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.dragMoved = true;
        this.game.renderer.tileMap.pan(dx, dy);
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
      if (this.game.renderer) {
        const rect = canvas.getBoundingClientRect();
        this.handleMapHover(e.clientX - rect.left, e.clientY - rect.top);
      }
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
      if (!this.dragMoved && this.game.renderer) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

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

    // Escape key cancels pick-connection mode and voie point modes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._pickConnectionMode) {
          this._pickConnectionMode = false;
          this._hidePickHint();
          const c = document.getElementById('game-canvas');
          if (c) c.style.cursor = 'grab';
          document.getElementById('modal-station')?.classList.remove('hidden');
        }
        if (this.voiePointCreationMode) this.toggleVoiePointCreation();
        if (this.tronconCreationMode) this.toggleTronconCreation();
        if (this.manualTronconMode) this.toggleManualTronconCreation();
        if (this.tracerLigneMode) this.toggleTracerLigne();
      }
      if (e.key === 'Delete' && this._lastLineGroupId) {
        const removed = this.game.voiePointManager.deleteLineGroup(this._lastLineGroupId);
        this._lastLineGroupId = null;
        this.game.saveState();
        this._showPickHint(`Supprimé: ${removed} éléments. Cliquer pour un nouveau tracé ou Echap.`);
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
    let touchStart = null, touchDist = null;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && touchStart && this.game.renderer) {
        const dx = e.touches[0].clientX - touchStart.x;
        const dy = e.touches[0].clientY - touchStart.y;
        this.game.renderer.tileMap.pan(dx, dy);
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && touchDist !== null && this.game.renderer) {
        const newDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvas.getBoundingClientRect();
        const delta = newDist > touchDist ? 1 : -1;
        this.game.renderer.tileMap.applyZoom(delta, cx - rect.left, cy - rect.top);
        touchDist = newDist;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { touchStart = null; touchDist = null; });
  }

  handleMapHover(x, y) {
    const renderer = this.game.renderer;
    if (!renderer) return;
    const tooltip = document.getElementById('tooltip');
    const station = renderer.getStationAt(x, y, this.game.world.stations);
    if (station) {
      const typeLabels = { voyageur: 'Voyageurs', marchandise: 'Marchandises', ite: 'ITE', depot: 'Depot', mixed: 'Mixte' };
      const platformNames = station.platformNames?.length > 0 ? station.platformNames.join(', ') : '';
      tooltip.innerHTML = `<div class="tt-name">${station.name}</div><div class="tt-info">${station.platforms} voies${platformNames ? ' (' + platformNames + ')' : ''} | ${typeLabels[station.type] || station.type}</div><div style="font-size:9px;color:#fbbf24;margin-top:2px">Double-clic pour modifier</div>`;
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
        const stName = vp.stationId ? (this.game.world.getStationById(vp.stationId)?.name || '') : '';
        const stLabel = stName ? ` (${stName})` : ' (en ligne)';
        const occLabel = vp.occupiedBy ? ' — OCCUPEE' : '';
        tooltip.innerHTML = `<div class="tt-name">Voie ${vp.voie}${stLabel}${occLabel}</div><div class="tt-info">${tronconsCount} troncon(s)</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Double-clic pour modifier | Shift+drag pour deplacer</div>`;
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y - 10) + 'px';
        tooltip.classList.remove('hidden');
        this._hoveredVoiePoint = vp;
        return;
      }
    }
    this._hoveredVoiePoint = null;
    tooltip.classList.add('hidden');
  }

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        btn.closest('.tab-bar')?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.closest('aside')?.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`)?.classList.add('active');
      });
    });
  }

  setupModals() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.modal')?.classList.add('hidden'));
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    });
  }

  // --- STATION CREATION ---
  toggleStationCreation() {
    this.stationCreationMode = !this.stationCreationMode;
    const btn = document.getElementById('btn-create-station');
    if (btn) {
      btn.textContent = this.stationCreationMode ? '✕ Annuler' : '+ Creer une gare';
      btn.classList.toggle('active-mode', this.stationCreationMode);
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = this.stationCreationMode ? 'crosshair' : 'grab';
  }

  openStationCreationModal(lat, lon) {
    this.stationCreationMode = false;
    const btn = document.getElementById('btn-create-station');
    if (btn) { btn.textContent = '+ Creer une gare'; btn.classList.remove('active-mode'); }
    document.getElementById('game-canvas').style.cursor = 'grab';

    this._editingStationId = null;
    document.getElementById('station-lat').value = lat.toFixed(6);
    document.getElementById('station-lon').value = lon.toFixed(6);
    document.getElementById('station-name').value = '';
    document.getElementById('station-platforms').value = '4';
    document.getElementById('station-platform-names').value = '';
    const closedCb = document.getElementById('station-closed');
    if (closedCb) closedCb.checked = false;
    const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
    if (connectGroup) connectGroup.style.display = '';
    const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
    if (terminusGroup) terminusGroup.style.display = '';
    const saveBtn = document.getElementById('btn-save-station');
    if (saveBtn) saveBtn.textContent = 'Creer la gare';
    // Hide delete button in creation mode
    const delBtn = document.getElementById('btn-delete-station');
    if (delBtn) delBtn.classList.add('hidden');
    // Populate line selector
    const lineSelect = document.getElementById('station-line');
    if (lineSelect) {
      lineSelect.innerHTML = '<option value="">Aucune</option>' +
        this.game.lineManager.getAll().map(l =>
          `<option value="${l.id}">${l.name}${l.code ? ' (' + l.code + ')' : ''}</option>`
        ).join('');
    }
    // Populate connection selector with existing stations sorted by distance
    const connectSelect = document.getElementById('station-connect');
    const connectInfo = document.getElementById('station-connect-info');
    if (connectSelect) {
      const existing = this.game.world.stations.map(s => {
        const d = Math.sqrt(
          Math.pow((s.lat - lat) * 111, 2) +
          Math.pow((s.lon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2)
        );
        return { ...s, dist: d };
      }).sort((a, b) => a.dist - b.dist);

      connectSelect.innerHTML = '<option value="_nearest">La plus proche (auto)</option>' +
        '<option value="">Aucune connexion</option>' +
        existing.map(s =>
          `<option value="${s.id}">${s.name} (${Math.round(s.dist)} km)</option>`
        ).join('');

      if (connectInfo) {
        if (existing.length > 0) {
          connectInfo.textContent = `Plus proche : ${existing[0].name} (~${Math.round(existing[0].dist)} km)`;
        } else {
          connectInfo.textContent = 'Aucune gare existante';
        }
      }
    }

    // Pick-on-map button for connection station
    const pickBtn = document.getElementById('btn-pick-connect-map');
    if (pickBtn) {
      pickBtn.onclick = () => {
        // Hide modal temporarily, enter pick mode on main canvas
        document.getElementById('modal-station')?.classList.add('hidden');
        this._pickConnectionMode = true;
        this._pendingStationLat = lat;
        this._pendingStationLon = lon;
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.style.cursor = 'pointer';
        // Show hint overlay
        this._showPickHint('Cliquer sur une gare existante pour la connecter (Echap pour annuler)');
      };
    }

    // Terminus checkbox logic
    const terminusCheck = document.getElementById('station-terminus');
    const terminusOpts = document.getElementById('station-terminus-options');
    const terminusLineSelect = document.getElementById('station-terminus-line');
    const terminusLineName = document.getElementById('station-terminus-line-name');
    const terminusLineColor = document.getElementById('station-terminus-line-color');
    if (terminusCheck) {
      terminusCheck.checked = false;
      terminusCheck.onchange = () => {
        if (terminusOpts) terminusOpts.classList.toggle('hidden', !terminusCheck.checked);
        if (terminusCheck.checked && terminusLineName) terminusLineName.style.display = '';
        if (terminusCheck.checked && terminusLineColor) terminusLineColor.style.display = '';
      };
    }
    if (terminusOpts) terminusOpts.classList.add('hidden');
    // Populate terminus line selector with open lines (lines with stops but no explicit end terminus)
    if (terminusLineSelect) {
      const openLines = this.game.lineManager.getAll().filter(l => l.stops.length > 0);
      terminusLineSelect.innerHTML = '<option value="_new">Creer une nouvelle ligne</option>' +
        openLines.map(l => `<option value="${l.id}">Terminer : ${l.name}${l.code ? ' (' + l.code + ')' : ''} (${l.stops.length} gares)</option>`).join('');
      terminusLineSelect.onchange = () => {
        const isNew = terminusLineSelect.value === '_new';
        if (terminusLineName) terminusLineName.style.display = isNew ? '' : 'none';
        if (terminusLineColor) terminusLineColor.style.display = isNew ? '' : 'none';
      };
    }

    const loadingEl = document.getElementById('station-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    document.getElementById('modal-station')?.classList.remove('hidden');
  }

  async saveStation() {
    const name = document.getElementById('station-name').value.trim();
    if (!name) return alert('Nom requis');
    let lat = parseFloat(document.getElementById('station-lat').value);
    let lon = parseFloat(document.getElementById('station-lon').value);
    const type = document.getElementById('station-type').value;
    const platforms = parseInt(document.getElementById('station-platforms').value) || 4;
    const platformNamesRaw = document.getElementById('station-platform-names')?.value.trim() || '';
    const platformNames = platformNamesRaw ? platformNamesRaw.split(',').map(s => s.trim()).filter(s => s) : [];

    const closed = document.getElementById('station-closed')?.checked || false;

    // Handle edit mode
    if (this._editingStationId) {
      const station = this.game.world.getStationById(this._editingStationId);
      if (station) {
        station.name = name;
        station.type = type;
        station.platforms = platforms;
        station.platformNames = platformNames;
        station.closed = closed;
        const lineId = document.getElementById('station-line')?.value;
        if (lineId) {
          if (!station.lineIds.includes(lineId)) station.lineIds.push(lineId);
        }
        this.game.platformManager.initStation(station.id, platforms);
      }
      this._editingStationId = null;
      // Restore modal for creation mode
      const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
      if (connectGroup) connectGroup.style.display = '';
      const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
      if (terminusGroup) terminusGroup.style.display = '';
      const btn = document.getElementById('btn-save-station');
      if (btn) btn.textContent = 'Creer la gare';
      document.getElementById('modal-station')?.classList.add('hidden');
      this.game.saveState();
      return;
    }

    const orm = this.game.orm;

    // Snap station to nearest railway node
    const loadingEl = document.getElementById('station-loading');
    if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Accrochage au reseau ferroviaire...'; }
    try {
      const snapped = await orm.snapToRailway(lat, lon, 2);
      if (snapped) {
        lat = snapped.lat;
        lon = snapped.lon;
        console.log(`Station snapped to railway: ${snapped.dist.toFixed(3)} km offset`);
      } else {
        console.warn(`No railway node within 2km for station "${name}"`);
      }
    } catch (e) {
      console.warn('Railway snapping failed:', e);
    }

    const station = this.game.world.addStation({ name, lat, lon, type, platforms, platformNames, closed });
    station.country = orm.getCountryAtPoint(lat, lon);
    station.facilities = [type];

    // Assign to line if selected
    const lineId = document.getElementById('station-line')?.value;
    if (lineId) {
      station.lineIds = [lineId];
      const line = this.game.lineManager.getLine(lineId);
      if (line) {
        line.stops.push(station.id);
      }
    }

    // Init platform manager
    this.game.platformManager.initStation(station.id, platforms);

    // Determine which station to connect to
    const connectChoice = document.getElementById('station-connect')?.value;
    const existingStations = this.game.world.stations.filter(s => s.id !== station.id);

    let connectTo = null;
    if (connectChoice === '') {
      // User chose "Aucune connexion"
      connectTo = null;
    } else if (connectChoice === '_nearest') {
      // Auto: find nearest
      let nearestDist = Infinity;
      for (const s of existingStations) {
        const d = Math.hypot(s.lat - lat, s.lon - lon);
        if (d < nearestDist) { nearestDist = d; connectTo = s; }
      }
      if (nearestDist >= 3) connectTo = null; // too far
    } else if (connectChoice) {
      // User picked a specific station
      connectTo = this.game.world.getStationById(connectChoice);
    }

    if (connectTo) {
      const loadingEl = document.getElementById('station-loading');
      if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Calcul du trace ORM en cours...'; }

      try {
        const route = await orm.findRoute(connectTo.lat, connectTo.lon, lat, lon);
        const distance = orm.getRouteDistance(route);
        const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
        const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;

        this.game.world.addTrack({
          stationA: connectTo.id, stationB: station.id,
          distance: Math.round(distance), maxSpeed: avgSpeed,
          electrified: true, name: `${connectTo.name} - ${name}`,
          route,
        });
        console.log(`Track created: ${connectTo.name} -> ${name}, ${Math.round(distance)} km, ${route.length} points, avg ${avgSpeed} km/h`);
      } catch (e) {
        console.warn('ORM route failed:', e);
        const dist = Math.round(Math.sqrt(Math.pow((lat - connectTo.lat) * 111, 2) + Math.pow((lon - connectTo.lon) * 111 * Math.cos(lat * Math.PI / 180), 2)));
        this.game.world.addTrack({
          stationA: connectTo.id, stationB: station.id,
          distance: dist, maxSpeed: 160, name: `${connectTo.name} - ${name}`,
        });
        console.log(`Fallback track: ${connectTo.name} -> ${name}, ${dist} km (no ORM data)`);
      }
      if (loadingEl) loadingEl.classList.add('hidden');
    }

    // Handle terminus -> auto-create or finish a line
    const isTerminus = document.getElementById('station-terminus')?.checked;
    if (isTerminus) {
      const terminusLineChoice = document.getElementById('station-terminus-line')?.value;
      if (terminusLineChoice === '_new') {
        // Create a new line starting at this station
        const lineName = document.getElementById('station-terminus-line-name')?.value.trim() || `Ligne ${name}`;
        const lineColor = document.getElementById('station-terminus-line-color')?.value || '#3b82f6';
        const newLine = this.game.lineManager.addLine({
          name: lineName,
          color: lineColor,
          code: '',
          stops: [station.id],
          trackIds: [],
        });
        station.lineIds = station.lineIds || [];
        if (!station.lineIds.includes(newLine.id)) station.lineIds.push(newLine.id);
        console.log(`New line created: ${lineName} starting at ${name}`);
      } else if (terminusLineChoice) {
        // Finish an existing line with this station as terminus
        const line = this.game.lineManager.getLine(terminusLineChoice);
        if (line) {
          line.stops.push(station.id);
          station.lineIds = station.lineIds || [];
          if (!station.lineIds.includes(line.id)) station.lineIds.push(line.id);
          // Build track between the last station in the line and this one
          if (line.stops.length >= 2) {
            const prevStId = line.stops[line.stops.length - 2];
            const prevSt = this.game.world.getStationById(prevStId);
            if (prevSt) {
              const existingTrack = this.game.world.getTrackBetween(prevSt.id, station.id);
              if (existingTrack) {
                line.trackIds.push(existingTrack.id);
              } else if (connectTo) {
                // Track was just created above via connectTo, find it
                const newTrack = this.game.world.getTrackBetween(connectTo.id, station.id);
                if (newTrack) line.trackIds.push(newTrack.id);
              }
            }
          }
          console.log(`Line "${line.name}" completed at ${name} (${line.stops.length} stops)`);
        }
      }
    }

    if (type === 'depot') {
      this.game.depotManager.add({ type: 'depot', name: `Depot ${name}`, stationId: station.id, tracks: platforms, cost: 0 });
    }
    if (type === 'ite') {
      this.game.depotManager.add({ type: 'ite-fret', name: `ITE ${name}`, stationId: station.id, tracks: 2, cost: 0 });
    }

    document.getElementById('modal-station')?.classList.add('hidden');
    this.game.saveState();
  }

  _showPickHint(text) {
    let hint = document.getElementById('pick-hint-overlay');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'pick-hint-overlay';
      hint.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fbbf24;padding:8px 16px;border-radius:6px;font-size:12px;z-index:9999;border:1px solid #fbbf24;pointer-events:none';
      document.body.appendChild(hint);
    }
    hint.textContent = text;
    hint.style.display = 'block';
  }

  _hidePickHint() {
    const hint = document.getElementById('pick-hint-overlay');
    if (hint) hint.style.display = 'none';
  }

  handlePickConnection(station) {
    if (!this._pickConnectionMode) return false;
    this._pickConnectionMode = false;
    this._hidePickHint();
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = 'grab';

    // Set the connect dropdown to the picked station
    const connectSelect = document.getElementById('station-connect');
    if (connectSelect) {
      // Make sure the option exists
      let exists = false;
      for (const opt of connectSelect.options) {
        if (opt.value === station.id) { exists = true; break; }
      }
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = station.id;
        opt.textContent = station.name;
        connectSelect.appendChild(opt);
      }
      connectSelect.value = station.id;
    }
    const connectInfo = document.getElementById('station-connect-info');
    if (connectInfo) connectInfo.textContent = `Selectionnee : ${station.name}`;

    // Re-open the modal
    document.getElementById('modal-station')?.classList.remove('hidden');
    return true;
  }

  openEditStationModal(station) {
    this._editingStationId = station.id;
    document.getElementById('station-name').value = station.name;
    document.getElementById('station-lat').value = station.lat.toFixed(6);
    document.getElementById('station-lon').value = station.lon.toFixed(6);
    document.getElementById('station-type').value = station.type;
    document.getElementById('station-platforms').value = station.platforms || 4;
    document.getElementById('station-platform-names').value = (station.platformNames || []).join(', ');
    const closedCb = document.getElementById('station-closed');
    if (closedCb) closedCb.checked = station.closed || false;

    // Populate line selector
    const lineSelect = document.getElementById('station-line');
    if (lineSelect) {
      lineSelect.innerHTML = '<option value="">Aucune</option>' +
        this.game.lineManager.getAll().map(l =>
          `<option value="${l.id}" ${(station.lineIds || []).includes(l.id) ? 'selected' : ''}>${l.name}${l.code ? ' (' + l.code + ')' : ''}</option>`
        ).join('');
    }
    // Hide connection selector for editing
    const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
    if (connectGroup) connectGroup.style.display = 'none';
    // Hide terminus options for editing
    const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
    if (terminusGroup) terminusGroup.style.display = 'none';

    const btn = document.getElementById('btn-save-station');
    if (btn) btn.textContent = 'Modifier la gare';

    // S9: Show delete button in edit mode
    const delBtn = document.getElementById('btn-delete-station');
    if (delBtn) {
      delBtn.classList.remove('hidden');
      delBtn.onclick = () => this.deleteStation(station.id);
    }

    const loadingEl = document.getElementById('station-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    document.getElementById('modal-station')?.classList.remove('hidden');
  }

  // S9: Delete a station safely
  deleteStation(stationId) {
    if (!confirm('Supprimer cette gare ? Les voies connectees seront aussi supprimees.')) return;
    this.game.world.removeStation(stationId);
    this._editingStationId = null;
    // Restore modal state
    const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
    if (connectGroup) connectGroup.style.display = '';
    const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
    if (terminusGroup) terminusGroup.style.display = '';
    const btn = document.getElementById('btn-save-station');
    if (btn) btn.textContent = 'Creer la gare';
    const delBtn = document.getElementById('btn-delete-station');
    if (delBtn) delBtn.classList.add('hidden');
    document.getElementById('modal-station')?.classList.add('hidden');
    this.game.saveState();
  }

  // --- ROLLING STOCK ---
  setupRollingStockPage() {
    document.getElementById('btn-add-stock')?.addEventListener('click', () => this.openStockModal());
    const drop = document.getElementById('stock-image-drop');
    const input = document.getElementById('stock-image-input');
    drop?.addEventListener('click', () => input?.click());
    drop?.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop?.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('dragging');
      if (e.dataTransfer.files[0]) this.loadStockImage(e.dataTransfer.files[0]);
    });
    input?.addEventListener('change', () => { if (input.files[0]) this.loadStockImage(input.files[0]); });
    document.getElementById('btn-save-stock')?.addEventListener('click', () => this.saveStock());
  }

  openStockModal() {
    document.getElementById('modal-add-stock')?.classList.remove('hidden');
    document.getElementById('stock-name').value = '';
    const priceInput = document.getElementById('stock-price');
    if (priceInput) priceInput.value = '0';
    document.getElementById('stock-image-preview')?.classList.add('hidden');
    this._stockImageData = null;

    // Populate cargo types checkboxes
    this._populateCargoTypesCheckboxes();

    // Show/hide cargo types based on category
    const catSel = document.getElementById('stock-category');
    const cargoGroup = document.getElementById('stock-cargo-types-group');
    if (catSel && cargoGroup) {
      const showCargo = () => { cargoGroup.style.display = catSel.value === 'wagon' ? 'block' : 'none'; };
      showCargo();
      catSel.addEventListener('change', showCargo);
    }
  }

  _populateCargoTypesCheckboxes() {
    const list = document.getElementById('stock-cargo-types-list');
    if (!list) return;
    const cargoTypes = this.game.cargoTypes;
    if (!cargoTypes) return;

    let html = '';
    for (const [catKey, cat] of Object.entries(cargoTypes.categories)) {
      html += `<div class="cargo-cat-header">${cat.name}</div><div class="cargo-cat-grid">`;
      for (const t of cat.types) {
        html += `<label class="cargo-cb-label">
          <input type="checkbox" class="stock-cargo-cb" value="${t.type}">
          ${t.name} <span class="cargo-cb-unit">${t.unit}</span>
        </label>`;
      }
      html += `</div>`;
    }
    list.innerHTML = html;
  }

  loadStockImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this._stockImageData = e.target.result;
      const preview = document.getElementById('stock-image-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');

      const img = new Image();
      img.onload = () => {
        const lengthM = (img.naturalWidth * 0.1).toFixed(1);
        const lengthInput = document.getElementById('stock-length');
        if (lengthInput) lengthInput.value = lengthM;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  saveStock() {
    const name = document.getElementById('stock-name').value.trim();
    if (!name) return alert('Nom requis');
    const tonnage = parseInt(document.getElementById('stock-tonnage').value) || 80;
    this.game.rollingStock.add({
      name,
      category: document.getElementById('stock-category').value,
      traction: document.getElementById('stock-traction').value,
      maxSpeed: parseInt(document.getElementById('stock-speed').value) || 160,
      tonnage,
      mass: parseInt(document.getElementById('stock-mass')?.value) || tonnage,
      power: parseInt(document.getElementById('stock-power')?.value) || 0,
      passengerCapacity: parseInt(document.getElementById('stock-capacity').value) || 0,
      freightCapacity: parseInt(document.getElementById('stock-freight-cap').value) || 0,
      length: parseFloat(document.getElementById('stock-length').value) || 20,
      imageData: this._stockImageData,
      seriesName: document.getElementById('stock-series-name')?.value.trim() || '',
      numberStart: document.getElementById('stock-number-start')?.value.trim() || '',
      purchasePrice: parseInt(document.getElementById('stock-price')?.value) || 0,
      cargoTypes: Array.from(document.querySelectorAll('.stock-cargo-cb:checked')).map(cb => cb.value),
    });
    document.getElementById('modal-add-stock')?.classList.add('hidden');
    this.renderStockList();
  }

  renderStockList() {
    const container = document.getElementById('stock-list');
    if (!container) return;
    const items = this.game.rollingStock.getAll();
    if (items.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun materiel. Cliquer "+ Ajouter un engin" pour importer.</p>';
      return;
    }
    container.innerHTML = items.map(item => `
      <div class="card">
        ${item.imageData ? `<img src="${item.imageData}" class="card-img" alt="${item.name}">` : ''}
        <div class="card-title">${item.name}</div>
        <div class="card-info">
          <b>Cat:</b> ${item.category} | <b>Tract:</b> ${item.traction}<br>
          <b>Vmax:</b> ${item.maxSpeed} km/h | <b>Long:</b> ${item.length}m<br>
          <b>Tonnage:</b> ${item.tonnage}t | <b>Masse:</b> ${item.mass}t${item.power ? ` | <b>P:</b> ${item.power}kW` : ''} | <b>Places:</b> ${item.passengerCapacity} | <b>Fret:</b> ${item.freightCapacity}t
          ${item.purchasePrice ? `<br><b>Prix:</b> ${item.purchasePrice.toLocaleString('fr-FR')} €` : ''}
          ${item.seriesName ? `<br><b>Serie:</b> ${item.seriesName}${item.numberStart ? ' n°' + item.numberStart : ''}` : ''}
          ${item.cargoTypes?.length ? `<br><b>Chargements:</b> <span style="font-size:9px">${item.cargoTypes.map(ct => { const info = this.game.cargoTypes?.getTypeInfo?.(ct); return info?.name || ct; }).join(', ')}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-sm danger" onclick="game.ui.deleteStock('${item.id}')">Supprimer</button>
        </div>
      </div>
    `).join('');
  }

  deleteStock(id) {
    this.game.rollingStock.remove(id);
    this.renderStockList();
  }

  // --- RAMES ---
  setupRamePage() {
    document.getElementById('btn-new-rame')?.addEventListener('click', () => this.openRameModal());
    document.getElementById('btn-save-rame')?.addEventListener('click', () => this.saveRame());
  }

  openRameModal() {
    this.currentRameElements = [];
    this.editingRameId = null;
    document.getElementById('rame-name').value = '';
    document.getElementById('modal-rame')?.classList.remove('hidden');
    this.renderRamePicker();
    this.renderRameAssembly();
  }

  renderRamePicker() {
    const container = document.getElementById('rame-stock-picker');
    if (!container) return;
    const items = this.game.rollingStock.getAll();
    container.innerHTML = items.length === 0
      ? '<p style="color:var(--text3);font-size:11px">Aucun materiel. Ajoutez-en d\'abord dans la page Materiel.</p>'
      : items.map(item => `
        <div class="stock-picker-item" onclick="game.ui.addToRame('${item.id}')">
          ${item.imageData ? `<img src="${item.imageData}" alt="${item.name}">` : `<div style="height:30px;width:60px;background:var(--bg);border-radius:2px"></div>`}
          <span>${item.name}${item.purchasePrice ? ` <span style="color:var(--orange);font-size:9px">${(item.purchasePrice/1000).toFixed(0)}k€</span>` : ''}</span>
        </div>
      `).join('');
  }

  addToRame(stockId) {
    const item = this.game.rollingStock.getById(stockId);
    if (!item) return;
    const currentLength = this.currentRameElements.reduce((s, e) => s + e.length, 0);
    if (currentLength + item.length > 750) return alert('Longueur maximale de 750m atteinte !');
    this.currentRameElements.push({ ...item, stockId: item.id });
    this.renderRameAssembly();
  }

  removeFromRame(index) {
    this.currentRameElements.splice(index, 1);
    this.renderRameAssembly();
  }

  renderRameAssembly() {
    const container = document.getElementById('rame-assembly');
    if (!container) return;

    if (this.currentRameElements.length === 0) {
      container.innerHTML = '<p class="rame-empty">Cliquer sur un engin ci-dessous pour l\'ajouter</p>';
    } else {
      container.innerHTML = '<div class="rame-assembly-images">' + this.currentRameElements.map((el, i) => {
        if (el.imageData) {
          return `<img src="${el.imageData}" alt="${el.name}" title="${el.name} (clic = retirer)" onclick="game.ui.removeFromRame(${i})" class="rame-element-img">`;
        }
        return `<div class="rame-element-placeholder" title="${el.name}" onclick="game.ui.removeFromRame(${i})">${el.name}</div>`;
      }).join('') + '</div>';
    }

    const totalLen = this.currentRameElements.reduce((s, e) => s + e.length, 0);
    const totalTon = this.currentRameElements.reduce((s, e) => s + e.tonnage, 0);
    const totalCap = this.currentRameElements.reduce((s, e) => s + e.passengerCapacity, 0);
    const totalPrice = this.currentRameElements.reduce((s, e) => s + (e.purchasePrice || 0), 0);
    const vmax = this.currentRameElements.length > 0 ? Math.min(...this.currentRameElements.map(e => e.maxSpeed)) : 0;
    const tractors = this.currentRameElements.filter(e => e.category === 'locomotive' || e.category === 'automotrice');
    const traction = tractors.length > 0 ? [...new Set(tractors.map(t => t.traction))].join('+') : '-';

    document.getElementById('rame-length').textContent = totalLen.toFixed(1);
    document.getElementById('rame-tonnage').textContent = totalTon;
    document.getElementById('rame-places').textContent = totalCap;
    document.getElementById('rame-vmax').textContent = vmax;
    document.getElementById('rame-traction').textContent = traction;
    const priceEl = document.getElementById('rame-price');
    if (priceEl) priceEl.textContent = totalPrice.toLocaleString('fr-FR');

    const fill = document.getElementById('rame-length-fill');
    if (fill) {
      const pct = Math.min(100, (totalLen / 750) * 100);
      fill.style.width = pct + '%';
      fill.style.background = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--green)';
    }
  }

  saveRame() {
    const name = document.getElementById('rame-name').value.trim();
    if (!name) return alert('Nom requis');
    if (this.currentRameElements.length === 0) return alert('Ajoutez au moins un element');

    const totalPrice = this.currentRameElements.reduce((s, e) => s + (e.purchasePrice || 0), 0);
    if (totalPrice > 0) {
      if (this.game.economy.balance < totalPrice) {
        return alert(`Solde insuffisant ! Coût: ${totalPrice.toLocaleString('fr-FR')} € — Solde: ${Math.round(this.game.economy.balance).toLocaleString('fr-FR')} €`);
      }
      this.game.economy.addExpense(totalPrice, 'achat', `Achat rame ${name}`);
    }

    this.game.rameManager.add({
      name,
      elements: this.currentRameElements.map(e => e.stockId),
      elementDetails: this.currentRameElements.map(e => ({
        name: e.name, category: e.category, traction: e.traction,
        maxSpeed: e.maxSpeed, tonnage: e.tonnage,
        mass: e.mass || e.tonnage, power: e.power || 0,
        passengerCapacity: e.passengerCapacity, freightCapacity: e.freightCapacity,
        length: e.length, imageData: e.imageData,
        purchasePrice: e.purchasePrice || 0,
      })),
    });
    document.getElementById('modal-rame')?.classList.add('hidden');
    this.renderRamesList();
  }

  renderRamesList() {
    const container = document.getElementById('rames-list');
    if (!container) return;
    const rames = this.game.rameManager.getAll();
    if (rames.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune rame. Cliquer "+ Nouvelle rame".</p>';
      return;
    }
    container.innerHTML = rames.map(r => `
      <div class="rame-card">
        <div class="rame-card-header">
          <span class="card-title">${r.name}</span>
          <button class="btn-sm danger" onclick="game.ui.deleteRame('${r.id}')">Supprimer</button>
        </div>
        <div class="rame-card-images">
          ${r.elementDetails.map(e => e.imageData
            ? `<img src="${e.imageData}" alt="${e.name}" title="${e.name}">`
            : `<span class="rame-text-el">${e.name}</span>`
          ).join('')}
        </div>
        <div class="card-info">
          <b>Long:</b> ${r.totalLength.toFixed(1)}m | <b>Tonnage:</b> ${r.totalTonnage}t |
          <b>Places:</b> ${r.totalCapacity} | <b>Fret:</b> ${r.totalFreightCapacity}t | <b>Vmax:</b> ${r.maxSpeed} km/h |
          <b>Traction:</b> ${r.traction}
        </div>
        <div class="card-info" style="font-size:10px;color:var(--text3)">
          <b>Mise en service:</b> ${r.createdDate} | <b>Km parcourus:</b> ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km${r.elementDetails.some(e => e.purchasePrice) ? ` | <b>Valeur:</b> ${r.elementDetails.reduce((s,e) => s + (e.purchasePrice || 0), 0).toLocaleString('fr-FR')} €` : ''}
        </div>
      </div>
    `).join('');
  }

  deleteRame(id) {
    this.game.rameManager.remove(id);
    this.renderRamesList();
  }

  // --- SCHEDULES ---
  setupSchedulePage() {
    document.getElementById('btn-new-schedule')?.addEventListener('click', () => this.openScheduleModal());
    document.getElementById('btn-save-schedule')?.addEventListener('click', () => this.saveSchedule());
    document.getElementById('sched-sort')?.addEventListener('change', () => this.renderSchedulesList());
  }

  openScheduleModal(editService) {
    this._editingScheduleId = editService?.id || null;
    if (editService) {
      this.schedStops = editService.stops.map(s => {
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
          arrTimeMin: s.arrivalTime,
          depTimeMin: s.departureTime,
          arrTimeStr: this.minToTimeStr(s.arrivalTime),
          depTimeStr: this.minToTimeStr(s.departureTime),
          platform: s.platform || '',
        };
      });
      document.getElementById('sched-name').value = editService.name;
      document.getElementById('sched-return-name').value = editService.returnName || '';
      this._schedReturnPlatforms = editService.returnPlatforms ? { ...editService.returnPlatforms } : {};
      const rtCheck = document.getElementById('sched-round-trip');
      if (rtCheck) rtCheck.checked = editService.roundTrip;
      document.getElementById('sched-multi-departures').value = editService.multiDepartures || 1;
      document.getElementById('sched-terminus-wait').value = editService.terminusWait || 10;
      // Populate run days
      const editDays = editService.runDays || [0,1,2,3,4,5,6];
      document.querySelectorAll('.sched-run-day').forEach(cb => {
        cb.checked = editDays.includes(parseInt(cb.value));
      });
      document.getElementById('sched-run-dates').value = (editService.runDates || []).join(', ');
    } else {
      this.schedStops = [];
      document.getElementById('sched-name').value = '';
      document.getElementById('sched-return-name').value = '';
      this._schedReturnPlatforms = {};
      const rtCheck = document.getElementById('sched-round-trip');
      if (rtCheck) rtCheck.checked = false;
      document.getElementById('sched-multi-departures').value = '1';
      document.getElementById('sched-terminus-wait').value = '10';
      // Default: all days checked, no specific dates
      document.querySelectorAll('.sched-run-day').forEach(cb => { cb.checked = true; });
      document.getElementById('sched-run-dates').value = '';
    }
    document.getElementById('modal-schedule')?.classList.remove('hidden');

    const rameSelect = document.getElementById('sched-rame');
    const rames = this.game.rameManager.getAll();
    rameSelect.innerHTML = rames.map(r => `<option value="${r.id}">${r.name} (${r.maxSpeed} km/h)</option>`).join('');
    if (editService) rameSelect.value = editService.rameId;
    rameSelect.onchange = () => this.recalcStopsFrom(1);

    // Auto 24h button
    document.getElementById('btn-auto-ar')?.addEventListener('click', () => this._calcAutoAR());

    this.renderSchedStops();
    this.setupSchedMap();
  }

  _calcAutoAR() {
    if (this.schedStops.length < 2) return;
    const firstDep = this.schedStops[0].depTimeMin;
    const lastArr = this.schedStops[this.schedStops.length - 1].arrTimeMin;
    const oneWayMin = lastArr - firstDep;
    if (oneWayMin <= 0) return;
    const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 10;
    // One round trip = oneWay + terminusWait + oneWay + terminusWait
    const oneRoundTrip = (oneWayMin * 2) + (terminusWait * 2);
    const maxAR = Math.max(1, Math.floor((24 * 60) / oneRoundTrip));
    document.getElementById('sched-multi-departures').value = maxAR;
  }

  setupSchedMap() {
    const canvas = document.getElementById('sched-map-canvas');
    if (!canvas) return;
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

      // Draw user's tracks (simplified, viewport-culled, single batch)
      ctx.strokeStyle = 'rgba(100, 160, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const track of world.tracks) {
        if (track.route && track.route.length > 2) {
          const rF = track.route[0], rL = track.route[track.route.length - 1];
          const tMinLat = Math.min(rF.lat, rL.lat), tMaxLat = Math.max(rF.lat, rL.lat);
          const tMinLon = Math.min(rF.lon, rL.lon), tMaxLon = Math.max(rF.lon, rL.lon);
          if (tMaxLat < vMinLat || tMinLat > vMaxLat || tMaxLon < vMinLon || tMinLon > vMaxLon) continue;
          const step = Math.max(1, Math.floor(track.route.length / 60));
          const p0 = tileMap.worldToScreen(rF.lat, rF.lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let r = step; r < track.route.length; r += step) {
            const pr = tileMap.worldToScreen(track.route[r].lat, track.route[r].lon, canvas.width, canvas.height);
            ctx.lineTo(pr.x, pr.y);
          }
        } else {
          const a = world.getStationById(track.stationA);
          const b = world.getStationById(track.stationB);
          if (!a || !b) continue;
          if (Math.max(a.lat, b.lat) < vMinLat || Math.min(a.lat, b.lat) > vMaxLat) continue;
          if (Math.max(a.lon, b.lon) < vMinLon || Math.min(a.lon, b.lon) > vMaxLon) continue;
          const pa = tileMap.worldToScreen(a.lat, a.lon, canvas.width, canvas.height);
          const pb = tileMap.worldToScreen(b.lat, b.lon, canvas.width, canvas.height);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        }
      }
      ctx.stroke();

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

      // Draw route between selected stops (yellow)
      if (this.schedStops.length > 1) {
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
        for (let i = 0; i < this.schedStops.length - 1; i++) {
          const sa = world.getStationById(this.schedStops[i].stationId);
          const sb = world.getStationById(this.schedStops[i + 1].stationId);
          if (!sa || !sb) continue;
          const track = world.getTrackBetween(sa.id, sb.id);
          if (track && track.route && track.route.length > 2) {
            const step = Math.max(1, Math.floor(track.route.length / 80));
            ctx.beginPath();
            const p0 = tileMap.worldToScreen(track.route[0].lat, track.route[0].lon, canvas.width, canvas.height);
            ctx.moveTo(p0.x, p0.y);
            for (let r = step; r < track.route.length; r += step) {
              const pr = tileMap.worldToScreen(track.route[r].lat, track.route[r].lon, canvas.width, canvas.height);
              ctx.lineTo(pr.x, pr.y);
            }
            const pL = tileMap.worldToScreen(track.route[track.route.length - 1].lat, track.route[track.route.length - 1].lon, canvas.width, canvas.height);
            ctx.lineTo(pL.x, pL.y);
            ctx.stroke();
          } else {
            const pa = tileMap.worldToScreen(sa.lat, sa.lon, canvas.width, canvas.height);
            const pb = tileMap.worldToScreen(sb.lat, sb.lon, canvas.width, canvas.height);
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          }
        }
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

        // Draw troncons — batch into single path, skip off-screen, simplify at low zoom
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const simplifyStep = tileMap.zoomLevel >= 13 ? 1 : tileMap.zoomLevel >= 10 ? 3 : 6;
        for (const trc of vpm.getAllTroncons()) {
          if (!trc.route || trc.route.length < 2) continue;
          // Quick bounds check using first and last route points
          const rFirst = trc.route[0];
          const rLast = trc.route[trc.route.length - 1];
          const trcMinLat = Math.min(rFirst.lat, rLast.lat);
          const trcMaxLat = Math.max(rFirst.lat, rLast.lat);
          const trcMinLon = Math.min(rFirst.lon, rLast.lon);
          const trcMaxLon = Math.max(rFirst.lon, rLast.lon);
          if (trcMaxLat < vpMinLat || trcMinLat > vpMaxLat || trcMaxLon < vpMinLon || trcMinLon > vpMaxLon) continue;

          const p0 = tileMap.worldToScreen(rFirst.lat, rFirst.lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let r = simplifyStep; r < trc.route.length; r += simplifyStep) {
            const pr = tileMap.worldToScreen(trc.route[r].lat, trc.route[r].lon, canvas.width, canvas.height);
            ctx.lineTo(pr.x, pr.y);
          }
          // Always include last point
          const pL = tileMap.worldToScreen(rLast.lat, rLast.lon, canvas.width, canvas.height);
          ctx.lineTo(pL.x, pL.y);
        }
        ctx.stroke();

        // Draw voie point markers — only at zoom >= 11, viewport-culled
        if (tileMap.zoomLevel >= 11) {
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

    drawMap();

    // Tile loading: periodically redraw to show loaded tiles
    this._schedMapInterval = setInterval(() => { if (document.getElementById('modal-schedule')?.classList.contains('hidden')) return; requestDraw(); }, 250);

    let schedDrag = false, schedDragStart = null, totalDragDist = 0;

    canvas.onmousedown = (e) => {
      schedDrag = true;
      schedDragStart = { x: e.offsetX, y: e.offsetY };
      totalDragDist = 0;
    };

    canvas.onmousemove = (e) => {
      if (schedDrag && schedDragStart) {
        const dx = e.offsetX - schedDragStart.x;
        const dy = e.offsetY - schedDragStart.y;
        totalDragDist += Math.abs(dx) + Math.abs(dy);
        tileMap.pan(dx, dy);
        schedDragStart = { x: e.offsetX, y: e.offsetY };
        requestDraw();
      }
    };

    canvas.onmouseup = (e) => {
      if (totalDragDist < 5) {
        const x = e.offsetX, y = e.offsetY;

        // Check voie points first (smaller targets, higher priority for waypoint)
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

        // If voie point is closer, add as invisible waypoint
        if (closestVP && minVPDist < minDist) {
          this.addSchedVoiePointStop(closestVP);
        } else if (closest) {
          this.addSchedStop(closest);
        } else {
          // Click on empty space: snap to nearest tronçon or ORM rail as waypoint
          const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
          this._addMapWaypoint(worldPos.lat, worldPos.lon);
        }
      }
      schedDrag = false;
      schedDragStart = null;
    };

    canvas.onwheel = (e) => {
      e.preventDefault();
      tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
      requestDraw();
    };

    this._drawSchedMap = drawMap;
  }

  async addSchedStop(station) {
    if (station.closed) {
      alert('Cette gare est fermee — aucun train ne peut la desservir.');
      return;
    }
    const rameId = document.getElementById('sched-rame').value;
    const rame = this.game.rameManager.getById(rameId);
    const rameSpeed = rame ? rame.maxSpeed : 160;

    let arrTimeMin, depTimeMin;
    if (this.schedStops.length === 0) {
      // Use current Paris time as default departure, user can change it
      const pt = this.game.engine.getParisTime();
      const currentMin = pt.hours * 60 + pt.minutes;
      // Round up to next 5 minutes
      arrTimeMin = Math.ceil(currentMin / 5) * 5;
      depTimeMin = arrTimeMin;
    } else {
      const prevStop = this.schedStops[this.schedStops.length - 1];
      const prevStation = this.game.world.getStationById(prevStop.stationId);

      let travelTime = 15;
      if (prevStation) {
        const existingTrack = this.game.world.getTrackBetween(prevStation.id, station.id);
        if (existingTrack && existingTrack.route && existingTrack.route.length > 1) {
          travelTime = this.game.orm.calculateTravelTime(existingTrack.route, rameSpeed);
        } else {
          try {
            const route = await this.game.orm.findRoute(prevStation.lat, prevStation.lon, station.lat, station.lon);
            travelTime = this.game.orm.calculateTravelTime(route, rameSpeed);
          } catch (e) {
            const dist = this._approxRailDistance(prevStation.lat, prevStation.lon, station.lat, station.lon);
            travelTime = Math.round((dist / rameSpeed) * 60) || 1;
          }
        }
      }
      arrTimeMin = prevStop.depTimeMin + travelTime;
      depTimeMin = arrTimeMin + 2;
    }

    this.schedStops.push({
      stationId: station.id,
      stationName: station.name,
      type: 'arret',
      arrTimeMin,
      depTimeMin,
      arrTimeStr: this.minToTimeStr(arrTimeMin),
      depTimeStr: this.minToTimeStr(depTimeMin),
      platform: '',
    });

    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
  }

  async addSchedVoiePointStop(voiePoint) {
    // Add voie point as invisible waypoint (no stop, no time, just passage obligé)
    const rameId = document.getElementById('sched-rame').value;
    const rame = this.game.rameManager.getById(rameId);
    const rameSpeed = rame ? rame.maxSpeed : 160;

    let arrTimeMin, depTimeMin;
    if (this.schedStops.length === 0) {
      const pt = this.game.engine.getParisTime();
      const currentMin = pt.hours * 60 + pt.minutes;
      arrTimeMin = Math.ceil(currentMin / 5) * 5;
      depTimeMin = arrTimeMin;
    } else {
      const prevStop = this.schedStops[this.schedStops.length - 1];
      const prevCoords = this._getStopCoords(prevStop);
      let travelTime = 5;
      if (prevCoords) {
        try {
          const route = await this.game.orm.findRoute(prevCoords.lat, prevCoords.lon, voiePoint.lat, voiePoint.lon);
          travelTime = this.game.orm.calculateTravelTime(route, rameSpeed);
        } catch (e) {
          const dist = this._approxRailDistance(prevCoords.lat, prevCoords.lon, voiePoint.lat, voiePoint.lon);
          travelTime = Math.ceil((dist / rameSpeed) * 60) || 1;
        }
      }
      arrTimeMin = prevStop.depTimeMin + travelTime;
      depTimeMin = arrTimeMin; // no stop time for waypoint
    }

    // If voie point is linked to a station, show "GareName — Voie X"
    let vpName = `Voie ${voiePoint.voie}`;
    let vpStationId = null;
    if (voiePoint.stationId) {
      const st = this.game.world.getStationById(voiePoint.stationId);
      if (st) { vpName = `${st.name} — Voie ${voiePoint.voie}`; vpStationId = st.id; }
    }

    this.schedStops.push({
      stationId: vpStationId,
      voiePointId: voiePoint.id,
      stationName: vpName,
      type: voiePoint.stationId ? 'arret' : 'waypoint',
      arrTimeMin,
      depTimeMin,
      arrTimeStr: this.minToTimeStr(arrTimeMin),
      depTimeStr: this.minToTimeStr(depTimeMin),
      platform: voiePoint.voie,
    });

    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
  }

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

    const prevStop = this.schedStops[this.schedStops.length - 1];
    const prevCoords = this._getStopCoords(prevStop);
    let travelTime = 5;
    if (prevCoords) {
      try {
        const route = await this.game.orm.findRoute(prevCoords.lat, prevCoords.lon, snappedLat, snappedLon);
        travelTime = this.game.orm.calculateTravelTime(route, rameSpeed);
      } catch (e) {
        const dist = this._approxRailDistance(prevCoords.lat, prevCoords.lon, snappedLat, snappedLon);
        travelTime = Math.ceil((dist / rameSpeed) * 60) || 1;
      }
    }
    const arrTimeMin = prevStop.depTimeMin + travelTime;

    this.schedStops.push({
      stationId: null,
      voiePointId: vpId,
      stationName: `Waypoint (${snappedLat.toFixed(4)}, ${snappedLon.toFixed(4)})`,
      type: 'waypoint',
      arrTimeMin,
      depTimeMin: arrTimeMin,
      arrTimeStr: this.minToTimeStr(arrTimeMin),
      depTimeStr: this.minToTimeStr(arrTimeMin),
      platform: '',
    });

    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
    this.game.saveState();
  }

  minToTimeStr(m) {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  timeStrToMin(s) {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  incrementTime(timeStr, minutes) {
    return this.minToTimeStr(this.timeStrToMin(timeStr) + minutes);
  }

  renderSchedStops() {
    const container = document.getElementById('sched-stops-list');
    if (!container) return;

    if (this.schedStops.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte ci-dessus</p>';
      return;
    }

    if (!this._schedReturnPlatforms) this._schedReturnPlatforms = {};

    container.innerHTML = this.schedStops.map((stop, i) => {
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

      return `
        ${travelInfo}
        <div class="sched-stop-row">
          <span style="color:var(--text3);font-size:10px;width:16px">${i + 1}</span>
          <span class="stop-name">${stop.stationName}</span>
          <select onchange="game.ui.updateSchedStop(${i}, 'type', this.value)">
            <option value="arret" ${stop.type === 'arret' ? 'selected' : ''}>Arret</option>
            <option value="passage" ${stop.type === 'passage' ? 'selected' : ''}>Passage</option>
            <option value="waypoint" ${stop.type === 'waypoint' ? 'selected' : ''}>Waypoint</option>
          </select>
          ${stop.type === 'waypoint' ? `
            <span style="font-size:9px;color:var(--text3);font-style:italic">via</span>
            ${platformSelect}
          ` : stop.type === 'passage' ? `
            <label style="font-size:9px;color:var(--text3)">Pass:</label>
            <input type="text" value="${stop.arrTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'arrTime', this.value)">
          ` : isFirst ? `
            <label style="font-size:9px;color:var(--text3)">Dep:</label>
            <input type="text" value="${stop.depTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'depTime', this.value)">
            ${platformSelect}
          ` : `
            <label style="font-size:9px;color:var(--text3)">Arr:</label>
            <input type="text" value="${stop.arrTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'arrTime', this.value)">
            ${!isLast ? `<label style="font-size:9px;color:var(--text3)">Arret:</label>
            <input type="number" value="${Math.max(0, (stop.depTimeMin || 0) - (stop.arrTimeMin || 0))}" min="0" max="120" style="width:45px" onchange="game.ui.updateSchedStop(${i}, 'stopDuration', this.value)"> <span style="font-size:9px;color:var(--text3)">min</span>` : ''}
            ${platformSelect}
          `}
          <button class="btn-remove-stop" onclick="game.ui.removeSchedStop(${i})">x</button>
        </div>
      `;
    }).join('');

    // Add return leg stops if round-trip is checked
    const rtChecked = document.getElementById('sched-round-trip')?.checked;
    if (rtChecked && this.schedStops.length >= 2) {
      const reversed = [...this.schedStops].reverse();
      const returnHtml = reversed.map((stop, i) => {
        const station = this.game.world.getStationById(stop.stationId);
        const stName = station?.name || stop.stationName || '?';
        const isFirst = i === 0;
        const isLast = i === reversed.length - 1;
        const typeLabel = stop.type === 'waypoint' ? 'passage' : (isFirst ? 'depart' : (isLast ? 'terminus' : stop.type));
        const typeColor = typeLabel === 'depart' ? '#22c55e' : (typeLabel === 'terminus' ? '#ef4444' : (typeLabel === 'passage' ? '#8b5cf6' : 'var(--text3)'));

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
          ${platformSelect}
        </div>`;
      }).join('');
      if (returnHtml) {
        container.innerHTML += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">
          <div style="font-size:10px;color:#f59e0b;font-weight:600;margin-bottom:4px">↩ Trajet retour (${reversed.length} arrets)</div>
          ${returnHtml}
        </div>`;
      }
    }
  }

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
    // Auto-recalculate all subsequent stops (await async routing)
    await this.recalcStopsFrom(index + 1);
    this.renderSchedStops();
  }

  updateReturnPlatform(stationId, value) {
    if (!this._schedReturnPlatforms) this._schedReturnPlatforms = {};
    if (value) {
      this._schedReturnPlatforms[stationId] = value;
    } else {
      delete this._schedReturnPlatforms[stationId];
    }
  }

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
  }

  _getStopCoords(stop) {
    // Resolve lat/lon for any stop type (station, voie point, waypoint)
    if (stop.voiePointId && this.game.voiePointManager) {
      const vp = this.game.voiePointManager.getVoiePointById(stop.voiePointId);
      if (vp) return { lat: vp.lat, lon: vp.lon };
    }
    if (stop.stationId) {
      const st = this.game.world.getStationById(stop.stationId);
      if (st) return { lat: st.lat, lon: st.lon };
    }
    return null;
  }

  async _getSegmentTravelTime(prevStop, curStop, rameSpeed) {
    const prevCoords = this._getStopCoords(prevStop);
    const curCoords = this._getStopCoords(curStop);
    if (!prevCoords || !curCoords) return 15;

    const prevStation = prevStop.stationId ? this.game.world.getStationById(prevStop.stationId) : null;
    const curStation = curStop.stationId ? this.game.world.getStationById(curStop.stationId) : null;

    if (prevStation && curStation) {
      const existingTrack = this.game.world.getTrackBetween(prevStation.id, curStation.id);
      if (existingTrack && existingTrack.route && existingTrack.route.length > 1) {
        return this.game.orm.calculateTravelTime(existingTrack.route, rameSpeed);
      }
    }
    try {
      const route = await this.game.orm.findRoute(prevCoords.lat, prevCoords.lon, curCoords.lat, curCoords.lon);
      return this.game.orm.calculateTravelTime(route, rameSpeed);
    } catch (e) {
      const dist = this._approxRailDistance(prevCoords.lat, prevCoords.lon, curCoords.lat, curCoords.lon);
      return Math.round((dist / rameSpeed) * 60) || 1;
    }
  }

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

      const travelTime = await this._getSegmentTravelTime(prevStop, curStop, rameSpeed);

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
  }

  removeSchedStop(index) {
    this.schedStops.splice(index, 1);
    this.recalcStopsFrom(index);
    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
  }

  async saveSchedule() {
    const name = document.getElementById('sched-name').value.trim();
    const rameId = document.getElementById('sched-rame').value;
    if (!name) return alert('Nom requis');
    if (this.schedStops.length < 2) return alert('Il faut au moins 2 arrets');

    const rame = this.game.rameManager.getById(rameId);
    const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
    const multiDepartures = parseInt(document.getElementById('sched-multi-departures')?.value) || 1;
    const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 10;

    // Build route requests in parallel for speed
    const routePromises = [];
    for (let i = 0; i < this.schedStops.length - 1; i++) {
      const stopA = this.schedStops[i];
      const stopB = this.schedStops[i + 1];
      let fromLat, fromLon, toLat, toLon;
      if (stopA.voiePointId) {
        const vp = this.game.voiePointManager.getVoiePointById(stopA.voiePointId);
        fromLat = vp?.lat; fromLon = vp?.lon;
      } else {
        const st = this.game.world.getStationById(stopA.stationId);
        if (st && stopA.platform && this.game.voiePointManager) {
          const svp = this.game.voiePointManager.getStationVoiePoint(st.id, stopA.platform);
          if (svp) { fromLat = svp.lat; fromLon = svp.lon; }
          else { fromLat = st.lat; fromLon = st.lon; }
        } else {
          fromLat = st?.lat; fromLon = st?.lon;
        }
      }
      if (stopB.voiePointId) {
        const vp = this.game.voiePointManager.getVoiePointById(stopB.voiePointId);
        toLat = vp?.lat; toLon = vp?.lon;
      } else {
        const st = this.game.world.getStationById(stopB.stationId);
        if (st && stopB.platform && this.game.voiePointManager) {
          const svp = this.game.voiePointManager.getStationVoiePoint(st.id, stopB.platform);
          if (svp) { toLat = svp.lat; toLon = svp.lon; }
          else { toLat = st.lat; toLon = st.lon; }
        } else {
          toLat = st?.lat; toLon = st?.lon;
        }
      }
      if (fromLat != null && toLat != null) {
        // Priority 1: Try tronçon graph routing (exact player infrastructure)
        const trcResult = this.game.voiePointManager?.findTronconRoute(fromLat, fromLon, toLat, toLon);
        if (trcResult && trcResult.route && trcResult.route.length >= 2) {
          routePromises.push(Promise.resolve(trcResult.route));
          continue;
        }
        // Priority 2: Existing world track
        const fromSt = stopA.stationId ? this.game.world.getStationById(stopA.stationId) : null;
        const toSt = stopB.stationId ? this.game.world.getStationById(stopB.stationId) : null;
        if (fromSt && toSt) {
          const existingTrack = this.game.world.getTrackBetween(fromSt.id, toSt.id);
          if (existingTrack && existingTrack.route && existingTrack.route.length > 1) {
            const needReverse = existingTrack.stationA !== fromSt.id;
            routePromises.push(Promise.resolve(needReverse ? [...existingTrack.route].reverse() : existingTrack.route));
            continue;
          }
        }
        // Priority 3: ORM fallback
        routePromises.push(
          this.game.orm.findRoute(fromLat, fromLon, toLat, toLon)
            .catch(() => [{ lat: fromLat, lon: fromLon, maxSpeed: 160 }, { lat: toLat, lon: toLon, maxSpeed: 160 }])
        );
      } else {
        routePromises.push(Promise.resolve([]));
      }
    }
    const routes = await Promise.all(routePromises);

    const stops = this.schedStops.map(s => ({
      stationId: s.stationId,
      voiePointId: s.voiePointId || null,
      type: s.type,
      departureTime: s.depTimeMin,
      arrivalTime: s.arrTimeMin,
      platform: s.platform || '',
    }));

    let totalDist = 0;
    for (const route of routes) {
      totalDist += this.game.orm.getRouteDistance(route);
    }

    // If editing, remove old service first
    if (this._editingScheduleId) {
      this.game.scheduleCreator.removeService(this._editingScheduleId);
    }

    const isWorkTrain = document.getElementById('sched-work-train')?.checked || false;
    const returnName = document.getElementById('sched-return-name')?.value.trim() || '';
    const returnPlatforms = this._schedReturnPlatforms || {};

    // Read run days from checkboxes
    const runDays = [];
    document.querySelectorAll('.sched-run-day:checked').forEach(cb => runDays.push(parseInt(cb.value)));
    if (runDays.length === 0) runDays.push(0,1,2,3,4,5,6); // fallback: all days

    // Read specific run dates
    const runDatesStr = document.getElementById('sched-run-dates')?.value.trim() || '';
    const runDates = runDatesStr ? runDatesStr.split(',').map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];

    this.game.scheduleCreator.addService({
      name, rameId, stops, routes, roundTrip, multiDepartures, terminusWait,
      totalDistance: 0, plannedDistance: Math.round(totalDist),
      isWorkTrain, returnName, returnPlatforms,
      runDays, runDates,
    }, rame, this.game.world);

    this._editingScheduleId = null;
    if (this._schedMapInterval) { clearInterval(this._schedMapInterval); this._schedMapInterval = null; }
    document.getElementById('modal-schedule')?.classList.add('hidden');
    this.renderSchedulesList();
    this.game.saveState();
  }

  editSchedule(id) {
    const svc = this.game.scheduleCreator.services.find(s => s.id === id);
    if (svc) this.openScheduleModal(svc);
  }

  renderSchedulesList() {
    const container = document.getElementById('schedules-list');
    if (!container) return;
    const services = this.game.scheduleCreator.services;
    if (services.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun trajet. Cliquer "+ Creer un trajet" pour commencer.</p>';
      return;
    }

    const sortMode = document.getElementById('sched-sort')?.value || 'creation';
    let sorted = [...services];

    if (sortMode === 'departure') {
      sorted.sort((a, b) => (a.stops[0]?.departureTime || 0) - (b.stops[0]?.departureTime || 0));
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

    // Build group headers for rame and route sort modes
    let lastGroupKey = null;
    const getGroupKey = (svc) => {
      if (sortMode === 'rame') {
        const r = this.game.rameManager.getById(svc.rameId);
        return r ? r.name : 'Sans rame';
      }
      if (sortMode === 'route') {
        const fst = this.game.world.getStationById(svc.stops[0]?.stationId)?.name || '?';
        const lst = this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId)?.name || '?';
        return `${fst} → ${lst}`;
      }
      return null;
    };

    container.innerHTML = sorted.map(svc => {
      const stopsPreview = svc.stops.map(s => {
        const st = this.game.world.getStationById(s.stationId);
        const name = st ? st.name : s.stationId;
        const arr = this.minToTimeStr(s.arrivalTime);
        const dep = this.minToTimeStr(s.departureTime);
        if (s.type === 'waypoint') return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${name})</span>`;
        return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
      }).join('<span style="color:var(--text3)"> → </span>');

      let returnPreview = '';
      if (svc.roundTrip) {
        const retStops = svc.buildReturnStops();
        const retStr = retStops.map(s => {
          const st = this.game.world.getStationById(s.stationId);
          const name = st ? st.name : s.stationId;
          const arr = this.minToTimeStr(s.arrivalTime);
          const dep = this.minToTimeStr(s.departureTime);
          if (s.type === 'waypoint') return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${name})</span>`;
          return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
        }).join('<span style="color:var(--text3)"> → </span>');
        returnPreview = `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#f59e0b;font-size:9px;margin-right:4px">↩ Retour (${svc.terminusWait} min attente):</span>${retStr}</div>`;
      }

      const rame = this.game.rameManager.getById(svc.rameId);
      const statusLabel = svc.isReturnLeg ? '<span style="color:#f59e0b;font-size:9px"> (retour)</span>' : '';
      // S11: Show trip count and direction names
      const firstSt = this.game.world.getStationById(svc.stops[0]?.stationId);
      const lastSt = this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId);
      const dirLabel = firstSt && lastSt ? `${firstSt.name} → ${lastSt.name}` : '';
      const tripInfo = svc.roundTrip && svc.multiDepartures > 1 ? ` x${svc.multiDepartures} AR` : svc.roundTrip ? ' A/R' : '';
      const dayNames = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
      const rd = svc.runDays || [0,1,2,3,4,5,6];
      const daysLabel = rd.length === 7 ? 'TLJ' : rd.map(d => dayNames[d]).join(' ');
      const datesLabel = svc.runDates && svc.runDates.length > 0 ? ` +${svc.runDates.length} date(s)` : '';
      // Group header
      let groupHeader = '';
      const gk = getGroupKey(svc);
      if (gk !== null && gk !== lastGroupKey) {
        lastGroupKey = gk;
        groupHeader = `<div style="background:var(--bg3);padding:6px 12px;margin:8px 0 4px;border-radius:4px;font-size:12px;font-weight:600;color:var(--accent);border-left:3px solid var(--accent)">${gk}</div>`;
      }

      const depTime = this.minToTimeStr(svc.stops[0]?.departureTime || 0);

      return `${groupHeader}
        <div class="sched-item">
          <div class="sched-item-header">
            <span style="color:var(--text3);font-size:10px;min-width:38px">${depTime}</span>
            <span class="sched-item-name">${svc.name}${statusLabel}</span>
            <span class="sched-item-rame">${rame ? rame.name : 'N/A'}</span>
            <span style="color:var(--text3);font-size:10px">${Math.round(svc.plannedDistance || svc.totalDistance)} km${tripInfo}</span>
            <span style="color:#60a5fa;font-size:9px">${daysLabel}${datesLabel}</span>
            <button class="btn-sm" onclick="game.ui.editSchedule('${svc.id}')">Modifier</button>
            <button class="btn-sm" onclick="game.ui.duplicateSchedulePrompt('${svc.id}')">Dupliquer</button>
            <button class="btn-sm" onclick="game.ui.toggleSchedule('${svc.id}')">${svc.active ? 'Desactiver' : 'Activer'}</button>
            <button class="btn-sm danger" onclick="game.ui.deleteSchedule('${svc.id}')">Supprimer</button>
          </div>
          <div style="font-size:10px;color:var(--text2);margin-bottom:2px">${dirLabel}</div>
          <div class="sched-stops-preview">${stopsPreview}</div>
          ${returnPreview}
        </div>
      `;
    }).join('');
  }

  toggleSchedule(id) {
    const svc = this.game.scheduleCreator.services.find(s => s.id === id);
    if (svc) {
      svc.active = !svc.active;
      this.game.scheduleCreator._invalidateActiveCache();
    }
    this.renderSchedulesList();
  }

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
  }

  deleteSchedule(id) {
    this.game.scheduleCreator.removeService(id);
    this.renderSchedulesList();
  }

  // --- LINES ---
  setupLinePage() {
    document.getElementById('btn-new-line')?.addEventListener('click', () => this.openLineModal());
    document.getElementById('btn-save-line')?.addEventListener('click', () => this.saveLine());
    this.lineStops = [];
    this.lineMapCenter = null;
    this.lineMapScale = null;
    this._editingLineId = null;

    // Station creator in Lines page
    document.getElementById('btn-new-station-lines')?.addEventListener('click', () => {
      const creator = document.getElementById('lines-station-creator');
      if (!creator) return;
      creator.classList.remove('hidden');
      document.getElementById('lsc-name').value = '';
      document.getElementById('lsc-lat').value = '';
      document.getElementById('lsc-lon').value = '';
      document.getElementById('lsc-platforms').value = '4';
      document.getElementById('lsc-type').value = 'voyageur';
      // Populate connect dropdown with existing stations
      const connectSel = document.getElementById('lsc-connect');
      if (connectSel) {
        let opts = '<option value="">Aucune connexion</option><option value="_nearest">La plus proche (auto)</option>';
        for (const st of this.game.world.stations) {
          opts += `<option value="${st.id}">${st.name}</option>`;
        }
        connectSel.innerHTML = opts;
      }
      // Populate line dropdown
      const lineSel = document.getElementById('lsc-line');
      if (lineSel) {
        let opts = '<option value="">Aucune</option>';
        for (const line of this.game.lineManager.getAll()) {
          opts += `<option value="${line.id}">${line.name}</option>`;
        }
        lineSel.innerHTML = opts;
      }
    });
    document.getElementById('btn-lsc-cancel')?.addEventListener('click', () => {
      document.getElementById('lines-station-creator')?.classList.add('hidden');
    });
    document.getElementById('btn-lsc-save')?.addEventListener('click', () => this.saveStationFromLines());
  }

  async saveStationFromLines() {
    const name = document.getElementById('lsc-name')?.value.trim();
    let lat = parseFloat(document.getElementById('lsc-lat')?.value);
    let lon = parseFloat(document.getElementById('lsc-lon')?.value);
    const type = document.getElementById('lsc-type')?.value || 'voyageur';
    const platforms = parseInt(document.getElementById('lsc-platforms')?.value) || 4;

    if (!name) return alert('Nom de gare requis');
    if (isNaN(lat) || isNaN(lon)) return alert('Latitude et longitude requises');

    const orm = this.game.orm;
    const loadingEl = document.getElementById('lsc-loading');

    // Snap to railway
    if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Accrochage au reseau ferroviaire...'; }
    try {
      const snapped = await orm.snapToRailway(lat, lon, 2);
      if (snapped) { lat = snapped.lat; lon = snapped.lon; }
    } catch (e) { console.warn('Snap failed:', e); }

    const closed = document.getElementById('lsc-closed')?.checked || false;
    const station = this.game.world.addStation({ name, lat, lon, type, platforms, platformNames: [], closed });
    station.country = orm.getCountryAtPoint(lat, lon);
    station.facilities = [type];
    this.game.platformManager.initStation(station.id, platforms);

    // Assign to line
    const lineId = document.getElementById('lsc-line')?.value;
    if (lineId) {
      station.lineIds = [lineId];
      const line = this.game.lineManager.getLine(lineId);
      if (line) line.stops.push(station.id);
    }

    // Connect to another station
    const connectChoice = document.getElementById('lsc-connect')?.value;
    let connectTo = null;
    if (connectChoice === '_nearest') {
      let nearestDist = Infinity;
      for (const s of this.game.world.stations) {
        if (s.id === station.id) continue;
        const d = Math.hypot(s.lat - lat, s.lon - lon);
        if (d < nearestDist) { nearestDist = d; connectTo = s; }
      }
      if (nearestDist >= 3) connectTo = null;
    } else if (connectChoice) {
      connectTo = this.game.world.getStationById(connectChoice);
    }

    if (connectTo) {
      if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Calcul du trace ORM en cours...'; }
      try {
        const route = await orm.findRoute(connectTo.lat, connectTo.lon, lat, lon);
        const distance = orm.getRouteDistance(route);
        const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
        const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
        this.game.world.addTrack({
          stationA: connectTo.id, stationB: station.id,
          distance: Math.round(distance), maxSpeed: avgSpeed,
          electrified: true, name: `${connectTo.name} - ${name}`,
          route,
        });
      } catch (e) {
        console.warn('ORM route failed:', e);
        const dist = Math.round(Math.sqrt(Math.pow((lat - connectTo.lat) * 111, 2) + Math.pow((lon - connectTo.lon) * 111 * Math.cos(lat * Math.PI / 180), 2)));
        this.game.world.addTrack({
          stationA: connectTo.id, stationB: station.id,
          distance: dist, maxSpeed: 160, name: `${connectTo.name} - ${name}`,
        });
      }
    }

    if (loadingEl) loadingEl.classList.add('hidden');
    document.getElementById('lines-station-creator')?.classList.add('hidden');
    this.game.saveState();
    this.renderLinesList();
  }

  openLineModal(editLine) {
    this.lineStops = [];
    this._editingLineId = null;
    this.lineMapCenter = null;
    this.lineMapScale = null;

    if (editLine) {
      this._editingLineId = editLine.id;
      document.getElementById('line-name').value = editLine.name;
      document.getElementById('line-code').value = editLine.code || '';
      document.getElementById('line-color').value = editLine.color || '#3b82f6';
      document.getElementById('modal-line-title').textContent = 'Modifier la ligne';
      this.lineStops = editLine.stops.map(stId => {
        const st = this.game.world.getStationById(stId);
        return { stationId: stId, stationName: st ? st.name : stId };
      });
    } else {
      document.getElementById('line-name').value = '';
      document.getElementById('line-code').value = '';
      document.getElementById('line-color').value = '#3b82f6';
      document.getElementById('modal-line-title').textContent = 'Creer une ligne';
    }

    document.getElementById('modal-line')?.classList.remove('hidden');
    this.renderLineStops();
    setTimeout(() => this.setupLineMap(), 50);
  }

  setupLineMap() {
    const canvas = document.getElementById('line-map-canvas');
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight || 300;

    const ctx = canvas.getContext('2d');
    const world = this.game.world;

    if (!this.lineMapCenter) {
      if (world.stations.length > 0) {
        let sumLat = 0, sumLon = 0;
        for (const st of world.stations) { sumLat += st.lat; sumLon += st.lon; }
        this.lineMapCenter = { lat: sumLat / world.stations.length, lon: sumLon / world.stations.length };
      } else {
        this.lineMapCenter = { lat: 46.8, lon: 2.3 };
      }
    }
    if (!this.lineMapScale) {
      this.lineMapScale = world.stations.length > 1 ? 0.02 : 0.04;
    }

    const project = (lat, lon) => {
      const cx = this.lineMapCenter.lon;
      const cy = this.lineMapCenter.lat;
      const scale = this.lineMapScale;
      return {
        x: (lon - cx) / scale + canvas.width / 2,
        y: (cy - lat) / scale + canvas.height / 2,
      };
    };

    const lineColor = document.getElementById('line-color')?.value || '#3b82f6';

    const drawMap = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw existing tracks in gray
      for (const track of world.tracks) {
        const a = world.getStationById(track.stationA);
        const b = world.getStationById(track.stationB);
        if (!a || !b) continue;
        const pa = project(a.lat, a.lon);
        const pb = project(b.lat, b.lon);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }

      // Draw existing lines with their colors
      for (const line of this.game.lineManager.getAll()) {
        if (line.id === this._editingLineId) continue;
        ctx.strokeStyle = line.color + '60';
        ctx.lineWidth = 3;
        for (let i = 0; i < line.stops.length - 1; i++) {
          const sa = world.getStationById(line.stops[i]);
          const sb = world.getStationById(line.stops[i + 1]);
          if (!sa || !sb) continue;
          const pa = project(sa.lat, sa.lon);
          const pb = project(sb.lat, sb.lon);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }

      // Draw stations
      for (const st of world.stations) {
        const p = project(st.lat, st.lon);
        if (p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20) continue;
        const isSelected = this.lineStops.some(s => s.stationId === st.id);
        ctx.fillStyle = isSelected ? lineColor : '#3b82f6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(st.name, p.x + 8, p.y + 4);
      }

      // Draw current line route
      const lc = document.getElementById('line-color')?.value || '#3b82f6';
      for (let i = 0; i < this.lineStops.length - 1; i++) {
        const sa = world.getStationById(this.lineStops[i].stationId);
        const sb = world.getStationById(this.lineStops[i + 1].stationId);
        if (!sa || !sb) continue;

        // Check if there's a shared track
        const track = world.getTrackBetween(sa.id, sb.id);
        if (track) {
          ctx.strokeStyle = lc;
          ctx.lineWidth = 3;
          if (track.route && track.route.length > 1) {
            ctx.beginPath();
            const p0 = project(track.route[0].lat, track.route[0].lon);
            ctx.moveTo(p0.x, p0.y);
            for (let j = 1; j < track.route.length; j++) {
              const p = project(track.route[j].lat, track.route[j].lon);
              ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
          } else {
            const pa = project(sa.lat, sa.lon);
            const pb = project(sb.lat, sb.lon);
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          }
        } else {
          const pa = project(sa.lat, sa.lon);
          const pb = project(sb.lat, sb.lon);
          ctx.strokeStyle = lc;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw stop order numbers
      for (let i = 0; i < this.lineStops.length; i++) {
        const st = world.getStationById(this.lineStops[i].stationId);
        if (!st) continue;
        const p = project(st.lat, st.lon);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(String(i + 1), p.x - 3, p.y - 8);
      }
    };

    drawMap();

    let drag = false, dragStart = null, totalDragDist = 0;

    canvas.onmousedown = (e) => {
      drag = true;
      dragStart = { x: e.offsetX, y: e.offsetY };
      totalDragDist = 0;
    };
    canvas.onmousemove = (e) => {
      if (drag && dragStart) {
        const dx = e.offsetX - dragStart.x;
        const dy = e.offsetY - dragStart.y;
        totalDragDist += Math.abs(dx) + Math.abs(dy);
        this.lineMapCenter.lon -= dx * this.lineMapScale;
        this.lineMapCenter.lat += dy * this.lineMapScale;
        dragStart = { x: e.offsetX, y: e.offsetY };
        drawMap();
      }
    };
    canvas.onmouseup = (e) => {
      if (totalDragDist < 5) {
        const x = e.offsetX, y = e.offsetY;
        let closest = null, minDist = Infinity;
        for (const st of world.stations) {
          const p = project(st.lat, st.lon);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < minDist && d < 20) { minDist = d; closest = st; }
        }
        if (closest) this.addLineStop(closest);
      }
      drag = false;
      dragStart = null;
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.2 : 0.83;
      this.lineMapScale = Math.max(0.002, Math.min(0.2, this.lineMapScale * factor));
      drawMap();
    };

    this._drawLineMap = drawMap;
  }

  addLineStop(station) {
    // Don't add duplicate consecutive stops
    if (this.lineStops.length > 0 && this.lineStops[this.lineStops.length - 1].stationId === station.id) return;

    this.lineStops.push({
      stationId: station.id,
      stationName: station.name,
    });
    this.renderLineStops();
    if (this._drawLineMap) this._drawLineMap();
  }

  removeLineStop(index) {
    this.lineStops.splice(index, 1);
    this.renderLineStops();
    if (this._drawLineMap) this._drawLineMap();
  }

  renderLineStops() {
    const container = document.getElementById('line-stops-list');
    if (!container) return;
    if (this.lineStops.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte pour definir la ligne</p>';
      return;
    }
    container.innerHTML = this.lineStops.map((stop, i) => {
      const isShared = i > 0 ? !!this.game.world.getTrackBetween(this.lineStops[i - 1].stationId, stop.stationId) : false;
      const sharedInfo = (i > 0 && isShared) ? '<span style="color:#16a34a;font-size:9px"> (troncon existant)</span>' : (i > 0 ? '<span style="color:#f59e0b;font-size:9px"> (nouveau troncon)</span>' : '');
      return `
        <div class="sched-stop-row">
          <span style="color:var(--text3);font-size:10px;width:16px">${i + 1}</span>
          <span class="stop-name">${stop.stationName}${sharedInfo}</span>
          <button class="btn-remove-stop" onclick="game.ui.removeLineStop(${i})">x</button>
        </div>
      `;
    }).join('');
  }

  async saveLine() {
    const name = document.getElementById('line-name').value.trim();
    if (!name) return alert('Nom requis');
    if (this.lineStops.length < 2) return alert('Il faut au moins 2 gares');

    const color = document.getElementById('line-color').value || '#3b82f6';
    const code = document.getElementById('line-code').value.trim();
    const stops = this.lineStops.map(s => s.stationId);

    const loadingEl = document.getElementById('line-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');

    if (this._editingLineId) {
      // Update existing line
      const line = this.game.lineManager.getLine(this._editingLineId);
      if (line) {
        // Remove old line references from stations
        for (const oldStId of line.stops) {
          const st = this.game.world.getStationById(oldStId);
          if (st) st.lineIds = (st.lineIds || []).filter(lid => lid !== line.id);
        }
        line.name = name;
        line.color = color;
        line.code = code;
        line.stops = stops;

        // Build track IDs
        const trackIds = [];
        for (let i = 0; i < stops.length - 1; i++) {
          const stA = this.game.world.getStationById(stops[i]);
          const stB = this.game.world.getStationById(stops[i + 1]);
          if (!stA || !stB) { trackIds.push(null); continue; }
          let existing = this.game.world.getTrackBetween(stA.id, stB.id);
          if (existing) {
            trackIds.push(existing.id);
          } else {
            try {
              const route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
              const distance = this.game.orm.getRouteDistance(route);
              const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
              const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
              const track = this.game.world.addTrack({
                stationA: stA.id, stationB: stB.id,
                distance: Math.round(distance), maxSpeed: avgSpeed,
                electrified: true, name: `${stA.name} - ${stB.name}`, route,
              });
              trackIds.push(track.id);
            } catch (e) {
              const dist = Math.round(Math.sqrt(Math.pow((stB.lat - stA.lat) * 111, 2) + Math.pow((stB.lon - stA.lon) * 111 * Math.cos(stA.lat * Math.PI / 180), 2)));
              const track = this.game.world.addTrack({ stationA: stA.id, stationB: stB.id, distance: dist, maxSpeed: 160, name: `${stA.name} - ${stB.name}` });
              trackIds.push(track.id);
            }
          }
        }
        line.trackIds = trackIds;

        // Update station references
        for (const stId of stops) {
          const st = this.game.world.getStationById(stId);
          if (st) {
            if (!st.lineIds) st.lineIds = [];
            if (!st.lineIds.includes(line.id)) st.lineIds.push(line.id);
          }
        }
      }
    } else {
      // Create new line
      const line = await this.game.lineManager.buildLine(
        { name, color, code, stops },
        this.game.world,
        this.game.orm
      );
      if (line) {
        for (const stId of stops) {
          const st = this.game.world.getStationById(stId);
          if (st) {
            if (!st.lineIds) st.lineIds = [];
            if (!st.lineIds.includes(line.id)) st.lineIds.push(line.id);
          }
        }
      }
    }

    if (loadingEl) loadingEl.classList.add('hidden');
    document.getElementById('modal-line')?.classList.add('hidden');
    this.renderLinesList();
    this.game.saveState();
  }

  renderLinesList() {
    // Render stations list
    const stationsContainer = document.getElementById('lines-stations-list');
    if (stationsContainer) {
      const stations = this.game.world.stations || [];
      if (stations.length > 0) {
        stationsContainer.innerHTML = `
          <h3 style="font-size:13px;margin:0 0 6px;color:var(--text2)">Gares (${stations.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
            ${stations.map(st => {
              const typeLabel = { voyageur: 'Voy', marchandise: 'Fret', mixed: 'Mix', depot: 'Dep', ite: 'ITE' }[st.type] || '';
              const closedTag = st.closed ? ' <span style="color:#ef4444;font-size:9px">Fermee</span>' : '';
              return `<span class="line-stop-tag" style="font-size:10px;cursor:pointer;${st.closed ? 'opacity:0.6;' : ''}" title="${st.lat.toFixed(4)}, ${st.lon.toFixed(4)} | ${st.platforms || '?'} voies${st.closed ? ' | FERMEE' : ''}" onclick="game.ui.editStationFromLines('${st.id}')">${st.name} <span style="color:var(--text3);font-size:9px">${typeLabel}</span>${closedTag}</span>`;
            }).join('')}
          </div>
        `;
      } else {
        stationsContainer.innerHTML = '';
      }
    }

    const container = document.getElementById('lines-list');
    if (!container) return;
    const lines = this.game.lineManager.getAll();
    if (lines.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune ligne. Cliquer "+ Creer une ligne" pour commencer.</p>';
      return;
    }

    container.innerHTML = lines.map(line => {
      const stopsPreview = line.stops.map(stId => {
        const st = this.game.world.getStationById(stId);
        return st ? st.name : stId;
      });
      const firstStop = stopsPreview[0] || '?';
      const lastStop = stopsPreview[stopsPreview.length - 1] || '?';

      // Count shared tracks
      let sharedCount = 0;
      for (const trkId of line.trackIds) {
        if (!trkId) continue;
        const linesOnTrack = this.game.lineManager.getLinesForTrack(trkId);
        if (linesOnTrack.length > 1) sharedCount++;
      }

      const totalDist = line.trackIds.reduce((sum, trkId) => {
        if (!trkId) return sum;
        const track = this.game.world.tracks.find(t => t.id === trkId);
        return sum + (track ? track.distance : 0);
      }, 0);

      return `
        <div class="line-item" style="border-left:4px solid ${line.color}">
          <div class="line-item-header">
            <span class="line-item-name" style="color:${line.color}">${line.code ? '[' + line.code + '] ' : ''}${line.name}</span>
            <span style="color:var(--text3);font-size:10px">${Math.round(totalDist)} km | ${line.stops.length} gares${sharedCount > 0 ? ' | ' + sharedCount + ' troncon(s) partage(s)' : ''}</span>
            <button class="btn-sm" onclick="game.ui.editLine('${line.id}')">Modifier</button>
            <button class="btn-sm danger" onclick="game.ui.deleteLine('${line.id}')">Supprimer</button>
          </div>
          <div class="line-route-preview">
            ${stopsPreview.map((name, i) =>
              `<span class="line-stop-tag">${name}</span>${i < stopsPreview.length - 1 ? '<span style="color:var(--text3)"> → </span>' : ''}`
            ).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  editStationFromLines(stationId) {
    const station = this.game.world.getStationById(stationId);
    if (station) this.openEditStationModal(station);
  }

  editLine(id) {
    const line = this.game.lineManager.getLine(id);
    if (line) this.openLineModal(line);
  }

  deleteLine(id) {
    if (!confirm('Supprimer cette ligne ?')) return;
    const line = this.game.lineManager.getLine(id);
    if (line) {
      // Remove line references from stations
      for (const stId of line.stops) {
        const st = this.game.world.getStationById(stId);
        if (st) st.lineIds = (st.lineIds || []).filter(lid => lid !== id);
      }
    }
    this.game.lineManager.removeLine(id);
    this.renderLinesList();
    this.game.saveState();
  }

  // --- DEPOTS ---
  setupDepotPage() {
    document.getElementById('btn-add-depot')?.addEventListener('click', () => this.openDepotModal());
    document.getElementById('btn-save-depot')?.addEventListener('click', () => this.saveDepot());
  }

  openDepotModal() {
    document.getElementById('modal-depot')?.classList.remove('hidden');
    document.getElementById('depot-name').value = '';
    const select = document.getElementById('depot-station');
    select.innerHTML = this.game.world.stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  saveDepot() {
    const data = {
      type: document.getElementById('depot-type').value,
      name: document.getElementById('depot-name').value.trim() || 'Depot',
      stationId: document.getElementById('depot-station').value,
      tracks: parseInt(document.getElementById('depot-tracks').value) || 4,
      cost: parseInt(document.getElementById('depot-cost').value) || 50000,
    };
    this.game.depotManager.add(data, this.game.economy);
    document.getElementById('modal-depot')?.classList.add('hidden');
    this.renderDepotsList();
  }

  renderDepotsList() {
    const depotsContainer = document.getElementById('depots-list');
    const iteContainer = document.getElementById('ite-list');
    const depots = this.game.depotManager.getDepots();
    const ites = this.game.depotManager.getITEs();
    const allStock = this.game.rollingStock.getAll().filter(s => s.category === 'locomotive' || s.category === 'automotrice');

    const renderDepotCard = (d) => {
      const station = this.game.world.getStationById(d.stationId);
      const rescueList = d.rescueLocos.length > 0
        ? d.rescueLocos.map(r => `
          <div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:10px">
            <span style="color:${r.deployed ? '#ef4444' : '#22c55e'}">${r.deployed ? 'En mission' : 'Disponible'}</span>
            <span style="flex:1">${r.stockName}</span>
            <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui.removeRescueLoco('${d.id}','${r.stockId}')">x</button>
          </div>
        `).join('')
        : '<span style="color:var(--text3);font-size:10px">Aucune machine de secours</span>';

      // Build stock picker (only locos/automotrices not already assigned)
      const assignedIds = d.rescueLocos.map(r => r.stockId);
      const availableStock = allStock.filter(s => !assignedIds.includes(s.id));
      const stockOptions = availableStock.map(s =>
        `<option value="${s.id}">${s.seriesName ? s.seriesName + ' ' + (s.numberStart || '') : s.name}</option>`
      ).join('');

      return `
        <div class="card">
          <div class="card-title">${d.name}</div>
          <div class="card-info">
            <b>Type:</b> ${d.getTypeLabel()}<br>
            <b>Gare:</b> ${station ? station.name : d.stationId}<br>
            <b>Voies:</b> ${d.tracks} | <b>Cout:</b> ${d.cost.toLocaleString()} EUR
          </div>
          ${d.type === 'depot' ? `
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
              <div style="font-size:11px;font-weight:600;margin-bottom:4px">Machines de secours</div>
              ${rescueList}
              ${availableStock.length > 0 ? `
                <div style="display:flex;gap:4px;margin-top:4px">
                  <select id="rescue-stock-${d.id}" style="flex:1;font-size:10px">${stockOptions}</select>
                  <button class="btn-sm" style="font-size:9px" onclick="game.ui.addRescueLoco('${d.id}')">+ Ajouter</button>
                </div>
              ` : ''}
            </div>
            ${this._renderDepotQueueSection(d)}
            ${this._renderMaintenanceButton(d)}
          ` : ''}
          <div class="card-actions">
            <button class="btn-sm danger" onclick="game.ui.deleteDepot('${d.id}')">Supprimer</button>
          </div>
        </div>
      `;
    };

    const renderIteCard = (d) => {
      const station = this.game.world.getStationById(d.stationId);
      return `
        <div class="card">
          <div class="card-title">${d.name}</div>
          <div class="card-info">
            <b>Type:</b> ${d.getTypeLabel()}<br>
            <b>Gare:</b> ${station ? station.name : d.stationId}<br>
            <b>Voies:</b> ${d.tracks} | <b>Cout:</b> ${d.cost.toLocaleString()} EUR
          </div>
          <div class="card-actions">
            <button class="btn-sm danger" onclick="game.ui.deleteDepot('${d.id}')">Supprimer</button>
          </div>
        </div>
      `;
    };

    if (depotsContainer) {
      depotsContainer.innerHTML = depots.length === 0
        ? '<p style="color:var(--text3);font-size:11px;padding:10px">Aucun</p>'
        : depots.map(renderDepotCard).join('');
    }
    if (iteContainer) {
      iteContainer.innerHTML = ites.length === 0
        ? '<p style="color:var(--text3);font-size:11px;padding:10px">Aucun</p>'
        : ites.map(renderIteCard).join('');
    }
  }

  addRescueLoco(depotId) {
    const select = document.getElementById(`rescue-stock-${depotId}`);
    if (!select || !select.value) return;
    const stock = this.game.rollingStock.getAll().find(s => s.id === select.value);
    if (!stock) return;
    const displayName = stock.seriesName ? `${stock.seriesName} ${stock.numberStart || ''}`.trim() : stock.name;
    this.game.depotManager.addRescueLoco(depotId, stock.id, displayName);
    this.game.saveState();
    this.renderDepotsList();
  }

  removeRescueLoco(depotId, stockId) {
    this.game.depotManager.removeRescueLoco(depotId, stockId);
    this.game.saveState();
    this.renderDepotsList();
  }

  deleteDepot(id) {
    this.game.depotManager.remove(id);
    this.renderDepotsList();
  }

  _renderDepotQueueSection(depot) {
    const dm = this.game.depotManager;
    const repairs = dm.repairQueue.filter(r => r.depotId === depot.id);
    const maint = dm.maintenanceQueue.filter(m => m.depotId === depot.id);
    if (repairs.length === 0 && maint.length === 0) return '';
    const items = [
      ...repairs.map(r => `<div style="font-size:10px;padding:2px 0"><span style="color:#ef4444">Reparation</span> ${r.serviceName} — ${Math.ceil(r.remainingMin)} min</div>`),
      ...maint.map(m => `<div style="font-size:10px;padding:2px 0"><span style="color:#3b82f6">Entretien</span> ${m.rameName} — ${Math.ceil(m.remainingMin)} min</div>`),
    ];
    return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">En atelier</div>${items.join('')}</div>`;
  }

  _renderMaintenanceButton(depot) {
    // List all RAMES not already in maintenance (preventive maintenance available for any rame)
    const allRames = this.game.rameManager.getAll();
    const dm = this.game.depotManager;
    const available = allRames.filter(r =>
      !r.inMaintenance && !dm.isRameInMaintenance(r.id)
    );
    if (available.length === 0) return '';
    const opts = available.map(r => `<option value="${r.id}">${r.name} (${Math.round(r.wearLevel)}%)</option>`).join('');
    return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">Entretien preventif (rame)</div>
      <div style="display:flex;gap:4px">
        <select id="maint-rame-${depot.id}" style="flex:1;font-size:10px">${opts}</select>
        <button class="btn-sm" style="font-size:9px" onclick="game.ui.sendRameToMaintenance('${depot.id}')">Envoyer</button>
      </div>
    </div>`;
  }

  sendRameToMaintenance(depotId) {
    const select = document.getElementById(`maint-rame-${depotId}`);
    if (!select || !select.value) return;
    const rameId = select.value;
    const rame = this.game.rameManager.getById(rameId);
    if (!rame) return;
    rame.inMaintenance = true;
    // Stop all services using this rame
    const services = this.game.scheduleCreator.getActiveServices();
    for (const svc of services) {
      if (svc.rame && svc.rame.id === rameId) {
        svc.train.inMaintenance = true;
        svc.speed = 0;
        svc.train.speed = 0;
      }
    }
    this.game.depotManager.sendRameToMaintenance(rameId, rame.name, depotId);
    this.game.saveState();
    this.renderDepotsList();
  }

  // --- INCIDENTS ---
  setupIncidentPage() {
    document.getElementById('btn-add-incident-type')?.addEventListener('click', () => {
      document.getElementById('inc-name').value = '';
      document.getElementById('inc-impact').value = 'slow';
      document.getElementById('inc-speed-limit').value = '30';
      document.getElementById('inc-duration').value = '60';
      document.getElementById('inc-speed-group').style.display = 'block';
      // Populate station selectors (gare A and gare B)
      const stations = this.game.world.stations || [];
      const stationOpts = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      const selectA = document.getElementById('inc-station-a');
      const selectB = document.getElementById('inc-station-b');
      if (selectA) selectA.innerHTML = stationOpts || '<option>Aucune gare</option>';
      if (selectB) selectB.innerHTML = stationOpts || '<option>Aucune gare</option>';
      // Default: select second station for B if available
      if (selectB && stations.length > 1) selectB.selectedIndex = 1;
      document.getElementById('modal-incident')?.classList.remove('hidden');
    });
    document.getElementById('inc-impact')?.addEventListener('change', (e) => {
      document.getElementById('inc-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
    });
    document.getElementById('btn-save-incident')?.addEventListener('click', () => this.saveIncident());
    document.getElementById('btn-add-works')?.addEventListener('click', () => this.openWorksModal());
    document.getElementById('works-impact')?.addEventListener('change', (e) => {
      document.getElementById('works-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
    });
    document.getElementById('btn-save-works')?.addEventListener('click', () => this.saveWorks());
  }

  saveIncident() {
    const name = document.getElementById('inc-name').value.trim() || 'Incident';
    const stationAId = document.getElementById('inc-station-a').value;
    const stationBId = document.getElementById('inc-station-b').value;
    const effect = document.getElementById('inc-impact').value;
    const speedLimit = parseInt(document.getElementById('inc-speed-limit').value) || 30;
    const duration = parseInt(document.getElementById('inc-duration').value) || 60;
    const pt = this.game.engine.getParisTime();
    const timeOfDay = pt.hours * 60 + pt.minutes;

    const stA = this.game.world.getStationById(stationAId);
    const stB = this.game.world.getStationById(stationBId);
    if (!stA || !stB) return alert('Sélectionnez deux gares valides');
    if (stationAId === stationBId) return alert('Les deux gares doivent être différentes');

    const trackName = `${stA.name} — ${stB.name}`;

    // Find route between the two stations for precise impact zone
    let route = null;
    const existingTrack = this.game.world.getTrackBetween(stationAId, stationBId);
    if (existingTrack?.route?.length > 1) {
      route = existingTrack.route;
    } else {
      try {
        route = this.game.orm.findRouteSync?.(stA.lat, stA.lon, stB.lat, stB.lon) || null;
      } catch (e) { /* fallback below */ }
    }

    this.game.incidentManager.createIncident({
      name,
      trackName,
      stationA: stationAId,
      stationB: stationBId,
      stationAName: stA.name,
      stationBName: stB.name,
      route,
      effect,
      speedLimit: effect === 'stop' ? 0 : speedLimit,
      duration,
      startTime: timeOfDay,
    }, this.game.world);

    document.getElementById('modal-incident')?.classList.add('hidden');
    this.renderIncidentsPage();
  }

  openWorksModal() {
    document.getElementById('modal-works')?.classList.remove('hidden');
    document.getElementById('works-name').value = '';
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    document.getElementById('works-start-date').value = today;
    document.getElementById('works-end-date').value = tomorrow;
    document.getElementById('works-start-time').value = '22:00';
    document.getElementById('works-end-time').value = '05:00';

    const select = document.getElementById('works-track');
    select.innerHTML = this.game.world.tracks.map(t => `<option value="${t.id}">${t.name || t.id}</option>`).join('');
  }

  saveWorks() {
    this.game.worksManager.add({
      name: document.getElementById('works-name').value.trim() || 'Travaux',
      trackId: document.getElementById('works-track').value,
      startDate: document.getElementById('works-start-date').value,
      startTime: document.getElementById('works-start-time').value || '22:00',
      endDate: document.getElementById('works-end-date').value,
      endTime: document.getElementById('works-end-time').value || '05:00',
      impact: document.getElementById('works-impact').value,
      speedLimit: parseInt(document.getElementById('works-speed-limit').value) || 40,
    });
    document.getElementById('modal-works')?.classList.add('hidden');
    this.renderIncidentsPage();
  }

  renderIncidentsPage() {
    const activeList = document.getElementById('active-incidents-list');
    const worksList = document.getElementById('planned-works-list');

    // Set up event delegation once (mousedown to avoid re-render race on Opera/others)
    if (activeList && !activeList._delegated) {
      activeList._delegated = true;
      activeList.addEventListener('mousedown', (e) => {
        const t = e.target;
        const btn = t.dataset?.deleteIncident ? t : (t.closest ? t.closest('[data-delete-incident]') : t.parentElement?.closest('[data-delete-incident]'));
        if (btn && btn.dataset?.deleteIncident) {
          e.preventDefault();
          e.stopPropagation();
          this.deleteIncident(btn.dataset.deleteIncident);
        }
      });
    }
    if (worksList && !worksList._delegated) {
      worksList._delegated = true;
      worksList.addEventListener('mousedown', (e) => {
        const t = e.target;
        const btn = t.dataset?.deleteWorks ? t : (t.closest ? t.closest('[data-delete-works]') : t.parentElement?.closest('[data-delete-works]'));
        if (btn && btn.dataset?.deleteWorks) {
          e.preventDefault();
          e.stopPropagation();
          this.deleteWorks(btn.dataset.deleteWorks);
        }
      });
    }

    const active = this.game.incidentManager.getActiveIncidents();
    if (activeList) {
      activeList.innerHTML = active.length === 0
        ? '<div class="no-incidents">Aucun incident en cours</div>'
        : active.map(inc => `
            <div class="incident-item">
              <div style="flex:1">
                <div class="incident-name">${inc.name}</div>
                <div class="incident-desc">${inc.trackName || (inc.stationAName && inc.stationBName ? inc.stationAName + ' — ' + inc.stationBName : 'Zone')} - ${inc.effect === 'stop' ? '<span style="color:#7B1E1E;font-weight:700">Interruption</span>' : '<span style="color:#FFE135;font-weight:700">Ralenti ' + (inc.speedLimit || 30) + ' km/h</span>'}</div>
                <div class="incident-time">${Math.ceil(inc.remaining)} min restantes</div>
              </div>
              <button class="btn-sm danger incident-delete-btn" data-delete-incident="${inc.id}" title="Supprimer l'incident">✕</button>
            </div>
          `).join('');
    }

    const works = this.game.worksManager.getAll();
    if (worksList) {
      worksList.innerHTML = works.length === 0
        ? '<div class="no-incidents">Aucun travaux programmes</div>'
        : works.map(w => {
            const track = this.game.world.tracks.find(t => t.id === w.trackId);
            return `
              <div class="works-item">
                <span class="works-name">${w.name}</span> - ${track ? track.name : w.trackId}<br>
                ${w.getDateRange()}<br>
                <span style="font-size:10px;color:var(--text3)">Actif chaque jour de ${w.startTime} a ${w.endTime}</span><br>
                Impact: ${w.impact === 'stop' ? 'Interruption' : 'Ralenti ' + w.speedLimit + ' km/h'}
                ${w.active ? ' <b style="color:var(--red)">EN COURS</b>' : ''}
                <button class="btn-sm danger incident-delete-btn" style="float:right" data-delete-works="${w.id}" title="Supprimer les travaux">✕</button>
              </div>
            `;
          }).join('');
    }
  }

  deleteIncident(id) {
    this.game.incidentManager.removeIncident(id, this.game.world);
    this.renderIncidentsPage();
  }

  deleteWorks(id) {
    this.game.worksManager.remove(id);
    this.renderIncidentsPage();
  }

  // --- ECONOMY ---
  setupEconomyPage() {
    const ticketInput = document.getElementById('eco-ticket-price');
    const freightInput = document.getElementById('eco-freight-price');
    ticketInput?.addEventListener('change', () => {
      this.game.economy.ticketPricePerKm = parseFloat(ticketInput.value) || 0.12;
    });
    freightInput?.addEventListener('change', () => {
      this.game.economy.freightPricePerTKm = parseFloat(freightInput.value) || 0.08;
    });

    // Logo import
    const logoDrop = document.getElementById('logo-drop');
    const logoInput = document.getElementById('logo-input');
    logoDrop?.addEventListener('click', () => logoInput?.click());
    logoDrop?.addEventListener('dragover', e => { e.preventDefault(); logoDrop.style.borderColor = '#38bdf8'; });
    logoDrop?.addEventListener('dragleave', () => { logoDrop.style.borderColor = ''; });
    logoDrop?.addEventListener('drop', e => {
      e.preventDefault(); logoDrop.style.borderColor = '';
      const f = e.dataTransfer?.files[0]; if (f) this._loadLogo(f);
    });
    logoInput?.addEventListener('change', e => { const f = e.target.files[0]; if (f) this._loadLogo(f); });

    // Restore logo
    if (this.game.economy._companyLogo) this._applyLogo(this.game.economy._companyLogo);

    // Bulletin
    document.getElementById('btn-generate-bulletin')?.addEventListener('click', () => this._generateBulletin());
    // Fiche horaire de gare
    document.getElementById('btn-generate-fiche-horaire')?.addEventListener('click', () => this._openFicheHoraireModal());
  }

  _loadLogo(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      this.game.economy._companyLogo = data;
      this._applyLogo(data);
    };
    reader.readAsDataURL(file);
  }

  _applyLogo(dataUrl) {
    const img = document.getElementById('company-logo');
    if (img) { img.src = dataUrl; img.style.display = 'inline-block'; }
    const drop = document.getElementById('logo-drop');
    if (drop) drop.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain">`;
  }

  _generateBulletin() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return alert('jsPDF non charge — verifiez votre connexion internet');
    try {
    const doc = new jsPDF();
    // Helper: strip accents for jsPDF default font compatibility
    const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
    const eco = this.game.economy;
    const company = noAcc(this.game.account.companyName || 'Rail Empire');
    const now = new Date().toLocaleDateString('fr-FR');
    const lastBulletin = eco._lastBulletinDate || null;
    const pw = doc.internal.pageSize.getWidth();

    // Helper: draw line separator
    const drawLine = (yPos) => { doc.setDrawColor(180); doc.line(10, yPos, pw - 10, yPos); };
    // Helper: page footer
    const addFooter = () => {
      doc.setFontSize(8); doc.setTextColor(150); doc.setFont(undefined, 'italic');
      doc.text(`${company} -- Bulletin genere automatiquement -- ${now}`, pw / 2, 290, { align: 'center' });
      doc.setTextColor(0); doc.setFont(undefined, 'normal');
    };

    // ========== PAGE 1 : PAGE DE GARDE ==========
    // Logo en haut à droite + nom compagnie dessous
    if (eco._companyLogo) {
      try { doc.addImage(eco._companyLogo, 'PNG', pw - 50, 15, 35, 35); } catch(e) {}
    }
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(80);
    doc.text(company, pw - 32, eco._companyLogo ? 56 : 25, { align: 'center' });

    // Titre centré au milieu de la page
    doc.setTextColor(0);
    doc.setFontSize(28); doc.setFont(undefined, 'bold');
    doc.text('Bulletin', pw / 2, 100, { align: 'center' });
    doc.setFontSize(22);
    doc.text('recapitulatif', pw / 2, 115, { align: 'center' });
    doc.setFontSize(18); doc.setFont(undefined, 'normal');
    doc.text('de votre compagnie', pw / 2, 128, { align: 'center' });

    // Date + période
    drawLine(145);
    doc.setFontSize(11); doc.setTextColor(80);
    doc.text(`Genere le ${now}`, pw / 2, 155, { align: 'center' });
    if (lastBulletin) {
      doc.text(`Periode : depuis le ${lastBulletin}`, pw / 2, 163, { align: 'center' });
    } else {
      doc.text('Premier bulletin de la compagnie', pw / 2, 163, { align: 'center' });
    }
    doc.setTextColor(0);
    addFooter();

    // ========== PAGE 2 : SOMMAIRE ==========
    doc.addPage();
    doc.setFontSize(20); doc.setFont(undefined, 'bold');
    doc.text('Sommaire', pw / 2, 30, { align: 'center' });
    drawLine(36);

    const sections = [
      { num: '1', title: 'Finances', page: 3 },
      { num: '2', title: 'Transport & Reseau', page: 3 },
      { num: '3', title: 'Services actifs', page: 4 },
      { num: '4', title: lastBulletin ? 'Nouvelles rames' : 'Parc de rames', page: 5 },
      { num: '5', title: 'Incidents', page: 6 },
    ];
    let sy = 50;
    doc.setFontSize(13);
    for (const s of sections) {
      doc.setFont(undefined, 'bold');
      doc.text(`${s.num}.`, 20, sy);
      doc.setFont(undefined, 'normal');
      doc.text(s.title, 30, sy);
      doc.text(`p. ${s.page}`, pw - 25, sy, { align: 'right' });
      // Dotted line between title and page number
      doc.setLineDash([1, 1], 0);
      const titleW = doc.getTextWidth(s.title);
      doc.line(30 + titleW + 3, sy + 0.5, pw - 30, sy + 0.5);
      doc.setLineDash([], 0);
      sy += 10;
    }
    addFooter();

    // ========== PAGE 3 : FINANCES + TRANSPORT ==========
    doc.addPage();
    let y = 20;

    // Section 1: Finances
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('1. Finances', 10, y); y += 2;
    drawLine(y); y += 8;
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text('Solde actuel :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(eco.formatAmount(eco.balance), 65, y); doc.setFont(undefined, 'normal'); y += 7;
    doc.text('Recettes totales :', 14, y);
    doc.setTextColor(34, 139, 34); doc.text(`+${eco.formatAmount(eco.revenue)}`, 65, y); doc.setTextColor(0); y += 7;
    doc.text('Depenses totales :', 14, y);
    doc.setTextColor(200, 0, 0); doc.text(`-${eco.formatAmount(eco.expenses)}`, 65, y); doc.setTextColor(0); y += 7;
    doc.text('Amendes :', 14, y);
    doc.setTextColor(200, 0, 0); doc.text(`-${eco.formatAmount(eco.penalties)}`, 65, y); doc.setTextColor(0); y += 12;

    // Section 2: Transport & Réseau
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('2. Transport & Reseau', 10, y); y += 2;
    drawLine(y); y += 8;
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text('Passagers transportes :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(eco.totalPassengers.toLocaleString('fr-FR'), 75, y); doc.setFont(undefined, 'normal'); y += 7;
    doc.text('Fret transporte :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(`${eco.totalFreightTonnes.toLocaleString('fr-FR')} tonnes`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
    const tracks = this.game.world.tracks || [];
    let trackKm = Math.round(tracks.reduce((s, t) => s + (t.distance || 0), 0));
    if (this.game.voiePointManager) {
      trackKm += Math.round(this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0));
    }
    doc.text('Km de voies possedes :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(`${trackKm.toLocaleString('fr-FR')} km`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
    const rames = this.game.rameManager.getAll();
    const totalTrainKm = Math.round(rames.reduce((s, r) => s + (r.totalKmRun || 0), 0));
    doc.text('Kilometrage total trains :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(`${totalTrainKm.toLocaleString('fr-FR')} km`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
    doc.text('Nombre de gares :', 14, y);
    const stations = this.game.world.stations || [];
    doc.setFont(undefined, 'bold'); doc.text(`${stations.length}`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
    doc.text('Nombre de rames :', 14, y);
    doc.setFont(undefined, 'bold'); doc.text(`${rames.length}`, 75, y); doc.setFont(undefined, 'normal');
    addFooter();

    // ========== PAGE 4 : SERVICES ==========
    doc.addPage();
    y = 20;
    const services = this.game.scheduleCreator.getActiveServices();
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(`3. Services actifs (${services.length})`, 10, y); y += 2;
    drawLine(y); y += 8;
    doc.setFontSize(10);
    for (const svc of services) {
      if (y > 265) { doc.addPage(); y = 15; }
      doc.setFont(undefined, 'bold');
      doc.text(noAcc(svc.name), 14, y); y += 5;
      doc.setFont(undefined, 'normal');
      const stopsStr = svc.stops.map(s => {
        const st = this.game.world.getStationById(s.stationId);
        return st ? st.name : '?';
      }).join('  >  ');
      // Word wrap long routes
      const lines = doc.splitTextToSize(noAcc(stopsStr), pw - 30);
      doc.text(lines, 18, y); y += lines.length * 4 + 1;
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`Distance: ${Math.round(svc.totalDistance || 0)} km | Aller-retour: ${svc.roundTrip ? 'Oui' : 'Non'} | Multi: x${svc.multiDepartures || 1}`, 18, y);
      doc.setTextColor(0); doc.setFontSize(10); y += 8;
    }
    addFooter();

    // ========== PAGE 5 : RAMES ==========
    doc.addPage();
    y = 20;
    const newRames = lastBulletin ? rames.filter(r => r.createdDate >= lastBulletin) : rames;
    const rameTitle = lastBulletin ? `4. Nouvelles rames (${newRames.length})` : `4. Parc de rames (${rames.length})`;
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(rameTitle, 10, y); y += 2;
    drawLine(y); y += 8;
    doc.setFontSize(10);
    for (const r of (newRames.length > 0 ? newRames : rames)) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFont(undefined, 'bold');
      doc.text(noAcc(r.name), 14, y); y += 5;
      doc.setFont(undefined, 'normal'); doc.setFontSize(9);
      doc.text(noAcc(`${r.totalLength.toFixed(0)}m | ${r.totalTonnage}t | ${r.totalCapacity} places | Fret: ${r.totalFreightCapacity}t | Vmax: ${r.maxSpeed} km/h`), 18, y); y += 4;
      doc.text(noAcc(`Mise en service: ${r.createdDate} | Km: ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km | Traction: ${r.traction}`), 18, y); y += 5;
      // Images
      let imgX = 18;
      for (const e of r.elementDetails) {
        if (e.imageData && y < 255 && imgX < pw - 40) {
          try { doc.addImage(e.imageData, 'PNG', imgX, y, 25, 8); imgX += 28; } catch(err) {}
        }
      }
      if (imgX > 18) y += 11;
      doc.setFontSize(10);
      y += 4;
    }
    addFooter();

    // ========== PAGE 6 : INCIDENTS ==========
    doc.addPage();
    y = 20;
    const incidents = this.game.incidentManager?.getActiveIncidents?.() || [];
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(`5. Incidents (${incidents.length})`, 10, y); y += 2;
    drawLine(y); y += 8;
    if (incidents.length === 0) {
      doc.setFontSize(11); doc.setFont(undefined, 'italic'); doc.setTextColor(120);
      doc.text('Aucun incident actif.', 14, y);
      doc.setTextColor(0);
    } else {
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      for (const inc of incidents) {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.setFont(undefined, 'bold');
        doc.text(noAcc(inc.name || 'Incident'), 14, y);
        doc.setFont(undefined, 'normal'); y += 5;
        doc.text(`Impact: ${inc.impact || '?'} | Rayon: ${inc.radius || '?'} km | Duree: ${inc.duration || '?'} min`, 18, y); y += 7;
      }
    }
    addFooter();

    eco._lastBulletinDate = now;
    doc.save(`bulletin_${company.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
    } catch (err) { console.error('Bulletin PDF error:', err); alert('Erreur generation PDF: ' + err.message); }
  }

  _openFicheHoraireModal() {
    const modal = document.getElementById('modal-fiche-horaire');
    const select = document.getElementById('fiche-horaire-station');
    if (!modal || !select) return;

    // Populate station list sorted alphabetically
    const stations = [...(this.game.world.stations || [])].sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = stations.map(st => `<option value="${st.id}">${st.name}</option>`).join('');

    modal.classList.remove('hidden');

    // Bind generate button (replace handler to avoid duplicates)
    const btn = document.getElementById('btn-fiche-horaire-go');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const stationId = select.value;
        if (!stationId) return;
        modal.classList.add('hidden');
        this._generateFicheHoraire(stationId);
      });
    }
  }

  _generateFicheHoraire(stationId) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return alert('jsPDF non charge');
    try {
    const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
    const minToStr = (m) => { const h = Math.floor(m / 60) % 24; const mi = Math.round(m % 60); return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`; };

    const station = this.game.world.getStationById(stationId);
    if (!station) return alert('Gare introuvable');
    const stationName = noAcc(station.name);
    const company = noAcc(this.game.account.companyName || 'Rail Empire');
    const now = new Date().toLocaleDateString('fr-FR');

    // Collect all services that stop at this station (type 'arret')
    const allServices = this.game.scheduleCreator.services || [];
    const entries = [];

    for (const svc of allServices) {
      if (!svc.active) continue;
      const stops = svc.stops || [];

      // Find this station in the forward stops
      for (let i = 0; i < stops.length; i++) {
        if (stops[i].stationId !== stationId) continue;
        if (stops[i].type !== 'arret') continue;

        // Determine destination (last arret stop after this one)
        let destStop = null, destStation = null;
        for (let j = stops.length - 1; j > i; j--) {
          if (stops[j].type === 'arret' && stops[j].stationId) {
            destStop = stops[j];
            destStation = this.game.world.getStationById(stops[j].stationId);
            break;
          }
        }
        if (!destStation) continue; // Skip if this is the last stop (terminus)

        // Intermediate stops (between this station and destination, only 'arret' type)
        const intermediates = [];
        for (let j = i + 1; j < stops.length; j++) {
          if (stops[j] === destStop) break;
          if (stops[j].type !== 'arret' || !stops[j].stationId) continue;
          const intSt = this.game.world.getStationById(stops[j].stationId);
          if (intSt) {
            intermediates.push({
              name: noAcc(intSt.name),
              depTime: minToStr(stops[j].departureTime),
            });
          }
        }

        // Platform at this station
        const voie = stops[i].platform || '';

        entries.push({
          serviceName: noAcc(svc.name),
          depTime: stops[i].departureTime,
          depTimeStr: minToStr(stops[i].departureTime),
          destination: noAcc(destStation.name),
          destArrTime: minToStr(destStop.arrivalTime),
          intermediates,
          voie,
        });
      }

      // Also check return leg if round trip
      if (svc.roundTrip) {
        const retStops = svc.buildReturnStops();
        for (let i = 0; i < retStops.length; i++) {
          if (retStops[i].stationId !== stationId) continue;
          if (retStops[i].type !== 'arret') continue;

          let destStop = null, destStation = null;
          for (let j = retStops.length - 1; j > i; j--) {
            if (retStops[j].type === 'arret' && retStops[j].stationId) {
              destStop = retStops[j];
              destStation = this.game.world.getStationById(retStops[j].stationId);
              break;
            }
          }
          if (!destStation) continue;

          const intermediates = [];
          for (let j = i + 1; j < retStops.length; j++) {
            if (retStops[j] === destStop) break;
            if (retStops[j].type !== 'arret' || !retStops[j].stationId) continue;
            const intSt = this.game.world.getStationById(retStops[j].stationId);
            if (intSt) {
              intermediates.push({
                name: noAcc(intSt.name),
                depTime: minToStr(retStops[j].departureTime),
              });
            }
          }

          const voie = retStops[i].platform || '';
          const retName = svc.returnName ? noAcc(svc.returnName) : noAcc(svc.name) + ' (retour)';

          entries.push({
            serviceName: retName,
            depTime: retStops[i].departureTime,
            depTimeStr: minToStr(retStops[i].departureTime),
            destination: noAcc(destStation.name),
            destArrTime: minToStr(destStop.arrivalTime),
            intermediates,
            voie,
          });
        }
      }
    }

    // Sort by departure time
    entries.sort((a, b) => a.depTime - b.depTime);

    if (entries.length === 0) {
      return alert(`Aucun service ne dessert ${station.name}`);
    }

    // Generate PDF
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // --- HEADER ---
    let y = 15;
    doc.setFillColor(0, 40, 85);
    doc.rect(0, 0, pw, 30, 'F');
    doc.setTextColor(255);
    doc.setFontSize(16); doc.setFont(undefined, 'bold');
    doc.text(stationName, pw / 2, 13, { align: 'center' });
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(`Fiche horaire -- ${company} -- ${now}`, pw / 2, 21, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`${entries.length} train(s)`, pw / 2, 27, { align: 'center' });
    doc.setTextColor(0);
    y = 36;

    // --- COLUMN HEADERS ---
    doc.setFillColor(230, 230, 230);
    doc.rect(10, y - 4, pw - 20, 8, 'F');
    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60);
    doc.text('Dep.', 12, y);
    doc.text('Service', 30, y);
    doc.text('Destination', 70, y);
    doc.text('Arr.', 140, y);
    doc.text('Voie', pw - 18, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;

    // --- ENTRIES ---
    for (const entry of entries) {
      // Check page overflow
      const neededHeight = 14 + entry.intermediates.length * 4;
      if (y + neededHeight > 275) {
        // Footer
        doc.setFontSize(7); doc.setTextColor(150); doc.setFont(undefined, 'italic');
        doc.text(`${stationName} -- ${company}`, pw / 2, 290, { align: 'center' });
        doc.setTextColor(0); doc.setFont(undefined, 'normal');
        doc.addPage();
        y = 15;
      }

      // Separator line
      doc.setDrawColor(200);
      doc.line(10, y - 2, pw - 10, y - 2);

      // Departure time (bold, large)
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(entry.depTimeStr, 12, y + 2);

      // Service name
      doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
      doc.text(entry.serviceName, 30, y + 2);
      doc.setTextColor(0);

      // Destination (bold, prominent)
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(entry.destination, 70, y + 2);

      // Arrival time at destination
      doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
      doc.text(entry.destArrTime, 140, y + 2);
      doc.setTextColor(0);

      // Voie (right column, highlighted)
      if (entry.voie) {
        doc.setFontSize(10); doc.setFont(undefined, 'bold');
        doc.text(String(entry.voie), pw - 18, y + 2, { align: 'center' });
      }

      y += 7;

      // Intermediate stations (smaller, grey)
      if (entry.intermediates.length > 0) {
        doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(120);
        const intText = entry.intermediates.map(s => `${s.name} (${s.depTime})`).join('  |  ');
        // Split long text across lines
        const lines = doc.splitTextToSize(intText, pw - 40);
        for (const line of lines) {
          doc.text(line, 30, y);
          y += 3.5;
        }
        doc.setTextColor(0);
      }

      y += 4;
    }

    // Final separator
    doc.setDrawColor(200);
    doc.line(10, y - 2, pw - 10, y - 2);

    // Footer
    doc.setFontSize(7); doc.setTextColor(150); doc.setFont(undefined, 'italic');
    doc.text(`${stationName} -- ${company} -- Genere automatiquement`, pw / 2, 290, { align: 'center' });
    doc.setTextColor(0);

    doc.save(`fiche_horaire_${stationName.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
    } catch (err) { console.error('Fiche horaire PDF error:', err); alert('Erreur generation PDF: ' + err.message); }
  }

  renderEconomyPage() {
    const eco = this.game.economy;
    const el = (id) => document.getElementById(id);
    if (el('eco-balance')) el('eco-balance').textContent = eco.formatAmount(eco.balance);
    if (el('eco-revenue')) el('eco-revenue').textContent = '+' + eco.formatAmount(eco.revenue);
    if (el('eco-expenses')) el('eco-expenses').textContent = '-' + eco.formatAmount(eco.expenses);
    if (el('eco-penalties')) el('eco-penalties').textContent = '-' + eco.formatAmount(eco.penalties);
    if (el('eco-passengers')) el('eco-passengers').textContent = eco.totalPassengers.toLocaleString('fr-FR');
    if (el('eco-freight-tonnes')) el('eco-freight-tonnes').textContent = eco.totalFreightTonnes.toLocaleString('fr-FR');

    // Km de voies possédés (tracks + tronçons)
    if (el('eco-track-km')) {
      const tracks = this.game.world.tracks || [];
      let totalTrackKm = tracks.reduce((s, t) => s + (t.distance || 0), 0);
      if (this.game.voiePointManager) {
        totalTrackKm += this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0);
      }
      el('eco-track-km').textContent = Math.round(totalTrackKm).toLocaleString('fr-FR');
    }
    // Total km parcourus par tous les trains (sum all services per rame)
    if (el('eco-total-train-km')) {
      const rameKm = new Map();
      for (const svc of this.game.scheduleCreator.getActiveServices()) {
        if (svc.rame && svc.train) {
          const rid = svc.rame.id;
          rameKm.set(rid, (rameKm.get(rid) || 0) + (svc.train.totalKmRun || 0));
        }
      }
      let totalKm = 0;
      for (const r of this.game.rameManager.getAll()) {
        totalKm += rameKm.get(r.id) || r.totalKmRun || 0;
      }
      el('eco-total-train-km').textContent = Math.round(totalKm).toLocaleString('fr-FR');
    }

    const histEl = el('eco-history');
    if (histEl) {
      histEl.innerHTML = eco.history.slice().reverse().slice(0, 40).map(e => `
        <div class="eco-entry ${e.type === 'revenue' ? 'revenue-entry' : 'expense-entry'}">
          <span>${e.description || e.category}</span>
          <span>${e.type === 'revenue' ? '+' : '-'}${eco.formatAmount(e.amount)}</span>
        </div>
      `).join('');
    }
  }

  // --- UPDATE LOOP ---
  update(activeServices) {
    const engine = this.game.engine;
    const eco = this.game.economy;

    document.getElementById('clock').textContent = engine.getFormattedTime();
    document.getElementById('date-display').textContent = engine.getFormattedDate();
    document.getElementById('balance').textContent = eco.formatAmount(eco.balance);

    // Weather widget in header
    try {
      const ww = document.getElementById('weather-widget');
      if (ww) ww.innerHTML = this.game.weather.renderWidget();
    } catch(e) { /* graceful */ }

    if (this.activePage === 'map') {
      this.updateTrainsList(activeServices);
      this.updateFreightTab();
    }
    if (this.activePage === 'economy') this.renderEconomyPage();
    if (this.activePage === 'incidents') this.renderIncidentsPage();

    this.updateAlertBanner();
  }

  updateTrainsList(services) {
    const container = document.getElementById('trains-list');
    if (!container) return;

    // Show only active trains (moving or stopped at station) + rescue services + in repair/maintenance
    const activeTrains = services.filter(svc =>
      svc && svc.train && (
        svc.isRescue ||
        svc.state === 'moving' || svc.state === 'stopped_at_station' ||
        svc.train.speed > 0 ||
        svc.train.breakdown || svc.train.inMaintenance
      )
    );

    if (activeTrains.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:10px">Aucun train en service. Creez un trajet dans "Horaires".</p>';
      return;
    }

    const html = activeTrains.map(svc => {
      const t = svc.train;
      if (!t) return '';

      // S1.1: Delay status with ±0.5 min neutral zone to avoid flickering
      const rawDelay = t.delay || 0;
      const delayVal = rawDelay === 0 ? 0 : Math.round(rawDelay);
      let delayLabel, delayClass;
      if (delayVal > 0) {
        delayLabel = `+${delayVal} min`;
        delayClass = 'delay-late';
      } else if (delayVal < 0) {
        delayLabel = `- ${Math.abs(delayVal)} min`;
        delayClass = 'delay-early';
      } else {
        delayLabel = 'À l\'heure';
        delayClass = 'delay-ok';
      }

      // Rescue services have simplified display
      if (svc.isRescue) {
        const stateLabels = { en_route: 'En route', recovering: 'Remorquage', returning: 'Retour depot' };
        const stateLabel = stateLabels[svc.rescueState] || '';
        return `
          <div class="train-card-fixed" style="border-color:#ef4444">
            <div class="tc-row1">
              <span class="train-color" style="background:#ef4444"></span>
              <span class="tc-name">${svc.name}</span>
              <span class="tc-speed">${Math.round(t.speed)} km/h</span>
            </div>
            <div class="tc-row2">
              <span style="color:#ef4444;font-weight:600;font-size:10px">SECOURS</span>
              <span style="color:var(--text2);font-size:10px">${stateLabel}</span>
            </div>
          </div>
        `;
      }

      // S3: Approach / platform / regulation status
      let contextLabel = '', contextClass = '';
      const _nsCtx = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
      const _isWaypoint = _nsCtx?.type === 'waypoint';
      if (svc.state === 'stopped_at_station' && !_isWaypoint) {
        const stName = t.stoppedAt?.name || '';
        const voie = t.platform ? ` Voie ${t.platform}` : '';
        if (svc._atTerminus) {
          contextLabel = stName ? `Terminus — ${stName}${voie}` : 'Terminus';
          contextClass = 'ctx-quai';
        } else {
          contextLabel = stName ? `À quai — ${stName}${voie}` : 'À quai';
          contextClass = 'ctx-quai';
        }
      } else if (t.blockedBy) {
        contextLabel = 'Régulation du trafic';
        contextClass = 'ctx-regulation';
      } else if (svc.state === 'moving' && t.speed > 0) {
        const target = typeof svc.getTargetStation === 'function' ? svc.getTargetStation() : null;
        if (target && svc.position) {
          let tgtLat = target.lat, tgtLon = target.lon;
          const ns = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
          if (ns && this.game.voiePointManager) {
            // Priority: use exact voie point, then station voie point by platform name
            if (ns.voiePointId) {
              const vp = this.game.voiePointManager.getVoiePointById(ns.voiePointId);
              if (vp) { tgtLat = vp.lat; tgtLon = vp.lon; }
            } else if (ns.platform) {
              const svp = this.game.voiePointManager.getStationVoiePoint(target.id, ns.platform);
              if (svp) { tgtLat = svp.lat; tgtLon = svp.lon; }
            }
          }
          const dLat = (tgtLat - svc.position.lat) * 111;
          const dLon = (tgtLon - svc.position.lon) * 111 * Math.cos(svc.position.lat * Math.PI / 180);
          const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
          if (distKm < 0.3 && !_isWaypoint) {
            contextLabel = 'À l\'approche';
            contextClass = 'ctx-approach';
          }
        }
      }

      // "Circule sur Voie X" — use the train's current voie from schedule data
      let circuleSurVoie = '';
      if (svc.state === 'moving' && svc.position && this.game.voiePointManager) {
        // Priority: 1) previous stop's voie, 2) nearest voie point
        const prevStopIdx = (svc.currentStopIndex || 1) - 1;
        const curStops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : [];
        const prevStop = curStops[prevStopIdx];
        let voie = prevStop?.platform || null;
        if (!voie) {
          voie = this.game.voiePointManager.getVoieAtPosition(svc.position);
        }
        if (voie) {
          circuleSurVoie = `Circule sur Voie ${voie}`;
        }
      }

      // Next stop info — include scheduled voie if set
      const nextStop = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
      const targetStation = typeof svc.getTargetStation === 'function' ? svc.getTargetStation() : null;
      let nextInfo;
      if (svc._atTerminus && svc._nextDepartureTime != null) {
        const pt = this.game?.engine?.getParisTime?.();
        const currentMin = pt ? pt.hours * 60 + pt.minutes : 0;
        const waitMin = Math.max(0, Math.round(svc._nextDepartureTime - currentMin));
        nextInfo = `Terminus — départ dans ${waitMin} min`;
      } else if (svc.completed) {
        nextInfo = 'Service terminé';
      } else if (nextStop && targetStation) {
        // For voie point waypoints, name already contains voie info
        const voie = (nextStop.platform && nextStop.stationId) ? ` Voie ${nextStop.platform}` : '';
        nextInfo = `→ ${targetStation.name}${voie}`;
      } else if (nextStop) {
        nextInfo = `→ ...`;
      } else {
        nextInfo = 'Termine';
      }

      // S4 + S12: Platform label with station name + "Voie X"
      let platformLabel = '';
      if (t.platform) {
        const stoppedStation = t.stoppedAt;
        let voieName;
        if (stoppedStation?.platformNames?.length >= t.platform) {
          voieName = stoppedStation.platformNames[t.platform - 1];
        } else {
          voieName = String(t.platform);
        }
        const stName = stoppedStation?.name || '';
        platformLabel = stName ? `${stName} Voie ${voieName}` : `Voie ${voieName}`;
      }

      // S12: Train identification (series + number)
      const displayName = t.seriesName ? `${t.seriesName} ${t.number || ''}`.trim() : svc.name;

      // S2: Train images (scrollable zone)
      let imageHtml = '';
      if (svc.rame && svc.rame.elementDetails) {
        const imgs = svc.rame.elementDetails
          .filter(e => e.imageData)
          .map(e => `<img src="${e.imageData}" class="tc-train-img">`)
          .join('');
        if (imgs) {
          imageHtml = `<div class="tc-images-scroll">${imgs}</div>`;
        }
      }

      // Incident status
      let incidentHtml = '';
      if (t.incident) {
        const incColor = t.incident.effect === 'stop' ? '#f87171' : '#facc15';
        const incLabel = t.incident.effect === 'stop' ? 'Interruption' : `Ralentissement (${t.incident.speedLimit} km/h)`;
        const incIcon = t.incident.effect === 'stop' ? '<img src="img/interruption.png" style="height:12px;vertical-align:middle;margin-right:3px">' : '<img src="img/ralentissement.png" style="height:12px;vertical-align:middle;margin-right:3px">';
        incidentHtml = `<div class="tc-line"><span style="color:${incColor};font-weight:600;font-size:10px">${incIcon}${incLabel}${t.incident.name ? ' — ' + t.incident.name : ''}</span></div>`;
      }

      // Breakdown status
      let breakdownHtml = '';
      if (t.breakdown) {
        const repairInfo = this.game.depotManager.getRepairInfo(svc.id);
        const repairLabel = repairInfo ? ` — Reparation ${Math.ceil(repairInfo.remainingMin)} min` : '';
        breakdownHtml = `<div class="tc-line"><span style="color:#ef4444;font-weight:600;font-size:10px">EN PANNE${repairLabel}</span></div>`;
      }

      // Maintenance status (check rame)
      let maintenanceHtml = '';
      if (t.inMaintenance || (svc.rame && svc.rame.inMaintenance)) {
        const rameId = svc.rame?.id;
        const maintInfo = rameId ? this.game.depotManager.getRameMaintenanceInfo(rameId) : null;
        const maintLabel = maintInfo ? ` — ${Math.ceil(maintInfo.remainingMin)} min` : '';
        maintenanceHtml = `<div class="tc-line"><span style="color:#3b82f6;font-weight:600;font-size:10px">EN MAINTENANCE${maintLabel}</span></div>`;
      }

      // Wear info (use rame as source of truth)
      const rameWear = svc.rame ? (svc.rame.wearLevel || 0) : (t.wearLevel || 0);
      const rameKm = svc.rame ? (svc.rame.totalKmRun || 0) : (t.totalKmRun || 0);
      const wearHtml = rameKm > 0 ? `<div class="tc-line"><span style="color:var(--text3);font-size:9px">Usure: ${Math.round(rameWear)}% · Total: ${Math.round(rameKm)} km</span></div>` : '';

      return `
        <div class="train-card-fixed">
          <div class="tc-line tc-header">
            <span class="train-color" style="background:${t.color}"></span>
            <span class="tc-name">${displayName}</span>
          </div>
          ${imageHtml}
          <div class="tc-line"><span class="tc-speed">${Math.round(t.speed)} km/h</span></div>
          <div class="tc-line"><span class="${delayClass}">${delayLabel}</span></div>
          ${contextLabel ? `<div class="tc-line"><span class="${contextClass}">${contextLabel}</span></div>` : ''}
          ${circuleSurVoie ? `<div class="tc-line"><span style="color:#94a3b8;font-size:10px">${circuleSurVoie}</span></div>` : ''}
          ${platformLabel ? `<div class="tc-line"><span class="tc-voie">${platformLabel}</span></div>` : ''}
          <div class="tc-line"><span class="tc-next">${nextInfo}</span></div>
          ${incidentHtml}
          ${breakdownHtml}
          ${maintenanceHtml}
          ${wearHtml}
        </div>
      `;
    }).join('');
    // S10: Only update DOM if content actually changed to avoid flicker
    if (container.innerHTML !== html) container.innerHTML = html;
  }

  garageService(svcId) {
    const svc = this.game.scheduleCreator.services.find(s => s.id === svcId);
    if (!svc) return;
    const sel = document.getElementById(`garage-vp-${svcId}`);
    if (!sel) return;
    svc.garageToVoiePoint(sel.value);
  }

  resumeFromGarage(svcId) {
    const svc = this.game.scheduleCreator.services.find(s => s.id === svcId);
    if (!svc) return;
    svc.resumeFromGarage();
  }

  updateFreightTab() {
    const container = document.getElementById('freight-list');
    if (!container) return;
    const contracts = this.game.freightManager.contracts;
    const active = contracts.filter(c => c.active);
    const completed = contracts.filter(c => !c.active);

    container.innerHTML = `
      <div class="section-title">Contrats actifs (${active.length})</div>
      ${active.map(c => `
        <div class="contract-item">
          <b>${c.cargoName}</b>: ${c.quantity} ${c.unit}<br>
          ${c.from} -> ${c.to}<br>
          ${this.game.economy.formatAmount(c.payment)}
          <div class="progress-bar"><div class="progress-fill" style="width:${c.progress || 0}%"></div></div>
        </div>
      `).join('')}
      <div class="section-title">Completes (${completed.length})</div>
    `;
  }

  updateAlertBanner() {
    const bannerInterruptions = document.getElementById('alert-banner-interruptions');
    const bannerSlowdowns = document.getElementById('alert-banner-slowdowns');
    const legacyBanner = document.getElementById('alert-banner');

    const incidents = this.game.incidentManager.getActiveIncidents();
    const dateStr = this.game.engine.getParisDate();
    const timeOfDay = this.game.engine.getParisTime().hours * 60 + this.game.engine.getParisTime().minutes;
    const activeWorks = this.game.worksManager.getActive(dateStr, timeOfDay);

    const interruptions = [];
    const slowdowns = [];

    for (const inc of incidents) {
      const zone = inc.trackName || 'Zone inconnue';
      const label = `${inc.name} - ${zone} (${Math.ceil(inc.remaining)} min)`;
      if (inc.effect === 'stop') {
        interruptions.push(label);
      } else {
        slowdowns.push(`${label} - ${inc.speedLimit} km/h`);
      }
    }
    for (const w of activeWorks) {
      if (w.impact === 'stop') {
        interruptions.push(`TRAVAUX: ${w.name} EN COURS`);
      } else {
        slowdowns.push(`TRAVAUX: ${w.name} EN COURS - ${w.speedLimit || 40} km/h`);
      }
    }

    // Helper to set banner content with icon and optional scrolling
    const setBanner = (el, items, iconSrc) => {
      if (!el) return;
      if (items.length === 0) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      const joined = items.join('  \u00b7  ');
      const contentKey = iconSrc + joined;
      if (el._lastContent === contentKey) return;
      el._lastContent = contentKey;
      const icon = `<img class="alert-icon" src="${iconSrc}">`;
      if (items.length > 1) {
        el.classList.add('scrolling');
        const dur = Math.max(10, joined.length * 0.3);
        el.innerHTML = `${icon}<span class="alert-text" style="animation-duration:${dur}s">${joined}</span>`;
      } else {
        el.classList.remove('scrolling');
        el.innerHTML = `${icon}<span class="alert-text">${joined}</span>`;
      }
    };

    setBanner(bannerInterruptions, interruptions, 'img/interruption.png');
    setBanner(bannerSlowdowns, slowdowns, 'img/ralentissement.png');

    // Legacy single banner fallback
    if (legacyBanner && !bannerInterruptions) {
      const all = [...interruptions, ...slowdowns];
      if (all.length > 0) {
        legacyBanner.textContent = all.join(' | ');
        legacyBanner.classList.remove('hidden');
      } else {
        legacyBanner.classList.add('hidden');
      }
    }
  }

  // --- VOIE POINTS SYSTEM ---

  setupVoiePointButtons() {
    document.getElementById('btn-create-voie-point')?.addEventListener('click', () => {
      this.toggleVoiePointCreation();
    });
    document.getElementById('btn-create-troncon')?.addEventListener('click', () => {
      this.toggleTronconCreation();
    });
    document.getElementById('btn-create-troncon-manual')?.addEventListener('click', () => {
      this.toggleManualTronconCreation();
    });
    document.getElementById('btn-tracer-ligne')?.addEventListener('click', () => {
      this.toggleTracerLigne();
    });
    document.getElementById('btn-save-vp')?.addEventListener('click', () => {
      this._saveVoiePoint();
    });
    document.getElementById('btn-delete-vp')?.addEventListener('click', () => {
      this._deleteVoiePoint();
    });

    // Map buttons for signal box & regulation zone
    document.getElementById('btn-create-signalbox')?.addEventListener('click', () => {
      const name = prompt('Nom du poste d\'aiguillage :') || '';
      const radius = parseFloat(prompt('Rayon d\'influence (km) :', '10')) || 10;
      this.game._pendingSignalBox = { name, radiusKm: radius };
      this.game._pendingRegZone = null;
      this._showPickHint('Cliquez sur la carte pour placer le poste d\'aiguillage');
      document.getElementById('game-canvas').style.cursor = 'crosshair';
    });
    document.getElementById('btn-create-regzone')?.addEventListener('click', () => {
      const name = prompt('Nom de la zone de régulation :') || '';
      const radius = parseFloat(prompt('Rayon de la zone (km) :', '30')) || 30;
      this.game._pendingRegZone = { name, radiusKm: radius };
      this.game._pendingSignalBox = null;
      this._showPickHint('Cliquez sur la carte pour placer la zone de régulation');
      document.getElementById('game-canvas').style.cursor = 'crosshair';
    });
  }

  toggleVoiePointCreation() {
    this.voiePointCreationMode = !this.voiePointCreationMode;
    if (this.voiePointCreationMode) {
      this.tronconCreationMode = false;
      this.stationCreationMode = false;
      this._tronconPointA = null;
    }
    const btn = document.getElementById('btn-create-voie-point');
    if (btn) {
      btn.textContent = this.voiePointCreationMode ? '✕ Annuler' : '+ Point de voie';
      btn.classList.toggle('active-mode', this.voiePointCreationMode);
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = this.voiePointCreationMode ? 'crosshair' : 'grab';
    // Reset other buttons
    const stBtn = document.getElementById('btn-create-station');
    if (stBtn && this.voiePointCreationMode) { stBtn.textContent = '+ Creer une gare'; stBtn.classList.remove('active-mode'); }
    const trcBtn = document.getElementById('btn-create-troncon');
    if (trcBtn && this.voiePointCreationMode) { trcBtn.textContent = '+ Troncon'; trcBtn.classList.remove('active-mode'); }
  }

  toggleTronconCreation() {
    this.tronconCreationMode = !this.tronconCreationMode;
    if (this.tronconCreationMode) {
      this.voiePointCreationMode = false;
      this.stationCreationMode = false;
      this._tronconPointA = null;
    }
    const btn = document.getElementById('btn-create-troncon');
    if (btn) {
      btn.textContent = this.tronconCreationMode ? '✕ Annuler' : '+ Troncon';
      btn.classList.toggle('active-mode', this.tronconCreationMode);
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = this.tronconCreationMode ? 'pointer' : 'grab';
    // Reset other buttons
    const stBtn = document.getElementById('btn-create-station');
    if (stBtn && this.tronconCreationMode) { stBtn.textContent = '+ Creer une gare'; stBtn.classList.remove('active-mode'); }
    const vpBtn = document.getElementById('btn-create-voie-point');
    if (vpBtn && this.tronconCreationMode) { vpBtn.textContent = '+ Point de voie'; vpBtn.classList.remove('active-mode'); }
    if (this.tronconCreationMode) {
      this._showPickHint('Cliquer sur le point de depart (gare ou point de voie)');
    } else {
      this._hidePickHint();
    }
  }

  _populateVpStationDropdown(selectedStationId, lat, lon) {
    const sel = document.getElementById('vp-station');
    if (!sel) return;
    sel.innerHTML = '<option value="">Aucune (point en ligne)</option>';
    // Sort stations by distance from the voie point
    const stations = [...this.game.world.stations].sort((a, b) => {
      const dA = Math.hypot((a.lat - lat) * 111, (a.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
      const dB = Math.hypot((b.lat - lat) * 111, (b.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
      return dA - dB;
    });
    for (const st of stations) {
      const dist = Math.hypot((st.lat - lat) * 111, (st.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
      const label = `${st.name} (${dist.toFixed(1)} km)`;
      const opt = document.createElement('option');
      opt.value = st.id;
      opt.textContent = label;
      if (st.id === selectedStationId) opt.selected = true;
      sel.appendChild(opt);
    }
    // Auto-select nearest station if < 2km and creating new
    if (!selectedStationId && stations.length > 0) {
      const nearest = stations[0];
      const dist = Math.hypot((nearest.lat - lat) * 111, (nearest.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
      if (dist < 2) sel.value = nearest.id;
    }
  }

  openVoiePointModal(lat, lon) {
    this.voiePointCreationMode = false;
    const btn = document.getElementById('btn-create-voie-point');
    if (btn) { btn.textContent = '+ Point de voie'; btn.classList.remove('active-mode'); }
    document.getElementById('game-canvas').style.cursor = 'grab';

    this._editingVoiePointId = null;
    document.getElementById('vp-modal-title').textContent = 'Nouveau point de voie';
    document.getElementById('vp-voie').value = '1';
    document.getElementById('vp-lat').value = lat.toFixed(6);
    document.getElementById('vp-lon').value = lon.toFixed(6);
    document.getElementById('btn-delete-vp').classList.add('hidden');
    document.getElementById('btn-save-vp').textContent = 'Creer le point';
    document.getElementById('vp-troncons-list').innerHTML = '';
    this._populateVpStationDropdown(null, lat, lon);
    document.getElementById('modal-voie-point')?.classList.remove('hidden');
  }

  openEditVoiePointModal(vp) {
    this._editingVoiePointId = vp.id;
    document.getElementById('vp-modal-title').textContent = 'Modifier le point de voie';
    document.getElementById('vp-voie').value = vp.voie;
    document.getElementById('vp-lat').value = vp.lat.toFixed(6);
    document.getElementById('vp-lon').value = vp.lon.toFixed(6);
    document.getElementById('btn-delete-vp').classList.remove('hidden');
    document.getElementById('btn-save-vp').textContent = 'Enregistrer';
    this._populateVpStationDropdown(vp.stationId, vp.lat, vp.lon);

    // Show connected troncons
    const vpm = this.game.voiePointManager;
    const troncons = vpm.getTronconsForPoint(vp.id);
    const trcList = document.getElementById('vp-troncons-list');
    if (troncons.length > 0) {
      trcList.innerHTML = '<div style="font-size:10px;color:var(--text2);margin-bottom:4px;font-weight:600">Troncons connectes:</div>' +
        troncons.map(trc => {
          const otherPt = trc.pointA === vp.id ? trc.pointB : trc.pointA;
          const otherName = this._getPointName(otherPt);
          return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;padding:2px 0">
            <span>→ ${otherName} (${Math.round(trc.distance)} km)</span>
            <button onclick="game.ui._deleteTroncon('${trc.id}')" style="background:#7f1d1d;color:#fff;border:none;border-radius:3px;font-size:9px;padding:1px 6px;cursor:pointer">✕</button>
          </div>`;
        }).join('');
    } else {
      trcList.innerHTML = '<div style="font-size:10px;color:var(--text3)">Aucun troncon</div>';
    }

    document.getElementById('modal-voie-point')?.classList.remove('hidden');
  }

  _getPointName(pointId) {
    const vp = this.game.voiePointManager.getVoiePointById(pointId);
    if (vp) return `Voie ${vp.voie} (${vp.lat.toFixed(3)}, ${vp.lon.toFixed(3)})`;
    const st = this.game.world.getStationById(pointId);
    if (st) return st.name;
    return pointId;
  }

  _saveVoiePoint() {
    const voie = document.getElementById('vp-voie').value;
    const lat = parseFloat(document.getElementById('vp-lat').value);
    const lon = parseFloat(document.getElementById('vp-lon').value);
    const stationId = document.getElementById('vp-station')?.value || null;
    const vpm = this.game.voiePointManager;

    if (this._editingVoiePointId) {
      const vp = vpm.getVoiePointById(this._editingVoiePointId);
      if (vp) {
        vp.voie = voie;
        vp.lat = lat;
        vp.lon = lon;
        vp.stationId = stationId;
      }
    } else {
      vpm.addVoiePoint({ lat, lon, voie, stationId });
    }

    document.getElementById('modal-voie-point')?.classList.add('hidden');
    this.game.saveState();
  }

  _deleteVoiePoint() {
    if (!this._editingVoiePointId) return;
    if (!confirm('Supprimer ce point de voie et ses troncons ?')) return;
    this.game.voiePointManager.removeVoiePoint(this._editingVoiePointId);
    document.getElementById('modal-voie-point')?.classList.add('hidden');
    this.game.saveState();
  }

  _deleteTroncon(trcId) {
    if (!confirm('Supprimer ce troncon ?')) return;
    this.game.voiePointManager.removeTroncon(trcId);
    // Refresh modal if open
    if (this._editingVoiePointId) {
      const vp = this.game.voiePointManager.getVoiePointById(this._editingVoiePointId);
      if (vp) this.openEditVoiePointModal(vp);
    }
    this.game.saveState();
  }

  async _handleTronconClick(x, y) {
    const renderer = this.game.renderer;
    const vpm = this.game.voiePointManager;
    const world = this.game.world;

    // Find nearest station or voie point
    let closest = null, minDist = Infinity, closestType = null;

    for (const st of world.stations) {
      const p = renderer.latLonToScreen(st.lat, st.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist && d < 25) { minDist = d; closest = st; closestType = 'station'; }
    }
    for (const vp of vpm.getAll()) {
      const p = renderer.latLonToScreen(vp.lat, vp.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist && d < 25) { minDist = d; closest = vp; closestType = 'voiepoint'; }
    }

    if (!closest) return;

    if (!this._tronconPointA) {
      // First point selected
      this._tronconPointA = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };
      this._showPickHint(`Point A: ${closestType === 'station' ? closest.name : 'V' + closest.voie} — Cliquer sur le point B`);
    } else {
      // Second point selected — create troncon
      if (closest.id === this._tronconPointA.id) {
        this._showPickHint('Meme point! Choisissez un point different.');
        return;
      }

      const ptA = this._tronconPointA;
      const ptB = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };

      // Try to get ORM route between the two points
      let route = [];
      let distance = 0;
      try {
        route = await this.game.orm.findRoute(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
        distance = this.game.orm.getRouteDistance(route);
      } catch (e) {
        // Fallback: straight line
        const dLat = (ptB.lat - ptA.lat) * 111;
        const dLon = (ptB.lon - ptA.lon) * 111 * Math.cos(ptA.lat * Math.PI / 180);
        distance = Math.sqrt(dLat * dLat + dLon * dLon);
        route = [
          { lat: ptA.lat, lon: ptA.lon, maxSpeed: 160 },
          { lat: ptB.lat, lon: ptB.lon, maxSpeed: 160 },
        ];
      }

      vpm.addTroncon({
        pointA: ptA.id,
        pointB: ptB.id,
        route,
        distance: Math.round(distance),
      });

      this._tronconPointA = null;
      this._showPickHint('Troncon cree ! Cliquer pour en creer un autre ou Echap pour quitter.');
      this.game.saveState();
    }
  }

  // --- Manual troncon tracing ---

  toggleManualTronconCreation() {
    this.manualTronconMode = !this.manualTronconMode;
    if (this.manualTronconMode) {
      this.voiePointCreationMode = false;
      this.stationCreationMode = false;
      this.tronconCreationMode = false;
      this._manualTronconPointA = null;
      this._manualTronconWaypoints = [];
    }
    const btn = document.getElementById('btn-create-troncon-manual');
    if (btn) {
      btn.textContent = this.manualTronconMode ? '✕ Annuler tracé' : '+ Tracé manuel';
      btn.classList.toggle('active-mode', this.manualTronconMode);
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = this.manualTronconMode ? 'crosshair' : 'grab';
    // Reset other mode buttons
    const trcBtn = document.getElementById('btn-create-troncon');
    if (trcBtn && this.manualTronconMode) { trcBtn.textContent = '+ Troncon'; trcBtn.classList.remove('active-mode'); }
    const vpBtn = document.getElementById('btn-create-voie-point');
    if (vpBtn && this.manualTronconMode) { vpBtn.textContent = '+ Point de voie'; vpBtn.classList.remove('active-mode'); }
    if (this.manualTronconMode) {
      this._showPickHint('Cliquer sur le point de départ (gare ou point de voie)');
    } else {
      this._hidePickHint();
      this._manualTronconWaypoints = [];
      this._manualTronconPointA = null;
    }
  }

  _handleManualTronconClick(x, y) {
    const renderer = this.game.renderer;
    const vpm = this.game.voiePointManager;
    const world = this.game.world;

    // Check if clicking near a station or voie point
    let closest = null, minDist = Infinity, closestType = null;
    for (const st of world.stations) {
      const p = renderer.latLonToScreen(st.lat, st.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist && d < 25) { minDist = d; closest = st; closestType = 'station'; }
    }
    for (const vp of vpm.getAll()) {
      const p = renderer.latLonToScreen(vp.lat, vp.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist && d < 25) { minDist = d; closest = vp; closestType = 'voiepoint'; }
    }

    if (!this._manualTronconPointA) {
      // Must click a station or voie point as starting point
      if (!closest) {
        this._showPickHint('Cliquer sur un point existant (gare ou point de voie) pour démarrer');
        return;
      }
      this._manualTronconPointA = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };
      this._manualTronconWaypoints = [{ lat: closest.lat, lon: closest.lon }];
      this._showPickHint(`Départ: ${closestType === 'station' ? closest.name : 'Voie ' + closest.voie} — Cliquer pour tracer, cliquer un point pour terminer`);
    } else if (closest && closest.id !== this._manualTronconPointA.id) {
      // Clicked on a target point — finalize the tronçon
      this._manualTronconWaypoints.push({ lat: closest.lat, lon: closest.lon });
      this._finalizeManualTroncon(closest);
    } else {
      // Clicked on empty space — add waypoint
      const worldPos = renderer.tileMap.screenToWorld(x, y, renderer.logicalWidth, renderer.logicalHeight);
      this._manualTronconWaypoints.push({ lat: worldPos.lat, lon: worldPos.lon, maxSpeed: 160 });
      this._showPickHint(`${this._manualTronconWaypoints.length} points tracés — Cliquer un point existant pour terminer`);
    }
  }

  _finalizeManualTroncon(endPoint) {
    const vpm = this.game.voiePointManager;
    const ptA = this._manualTronconPointA;
    const route = this._manualTronconWaypoints.map(wp => ({
      lat: wp.lat, lon: wp.lon, maxSpeed: wp.maxSpeed || 160,
    }));

    // Calculate distance from waypoints
    let distance = 0;
    for (let i = 1; i < route.length; i++) {
      const dLat = (route[i].lat - route[i-1].lat) * 111;
      const dLon = (route[i].lon - route[i-1].lon) * 111 * Math.cos(route[i].lat * Math.PI / 180);
      distance += Math.sqrt(dLat * dLat + dLon * dLon);
    }

    vpm.addTroncon({
      pointA: ptA.id,
      pointB: endPoint.id,
      route,
      distance: Math.round(distance),
    });

    this._manualTronconPointA = null;
    this._manualTronconWaypoints = [];
    this._showPickHint('Tronçon tracé ! Cliquer pour en tracer un autre ou Echap pour quitter.');
    this.game.saveState();
  }

  // --- TRACER LIGNE (infrastructure import from OSM) ---

  toggleTracerLigne() {
    this.tracerLigneMode = !this.tracerLigneMode;
    if (this.tracerLigneMode) {
      this.voiePointCreationMode = false;
      this.stationCreationMode = false;
      this.tronconCreationMode = false;
      this.manualTronconMode = false;
      this._tracerLignePointA = null;
    }
    const btn = document.getElementById('btn-tracer-ligne');
    if (btn) {
      btn.textContent = this.tracerLigneMode ? '✕ Annuler' : 'Tracer ligne';
      btn.classList.toggle('active-mode', this.tracerLigneMode);
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = this.tracerLigneMode ? 'crosshair' : 'grab';
    if (this.tracerLigneMode) {
      this._showPickHint('Cliquer sur le point A (gare, point de voie, ou un point sur la carte)');
    } else {
      this._hidePickHint();
      this._tracerLignePointA = null;
    }
  }

  async _handleTracerLigneClick(x, y) {
    const renderer = this.game.renderer;
    const worldPos = renderer.tileMap.screenToWorld(x, y, renderer.logicalWidth, renderer.logicalHeight);

    // Try to snap to existing station or voie point
    let snapped = null;
    const world = this.game.world;
    const vpm = this.game.voiePointManager;
    for (const st of world.stations) {
      const p = renderer.latLonToScreen(st.lat, st.lon);
      if (Math.hypot(p.x - x, p.y - y) < 25) { snapped = { lat: st.lat, lon: st.lon, name: st.name, stationId: st.id }; break; }
    }
    if (!snapped) {
      for (const vp of vpm.getAll()) {
        const p = renderer.latLonToScreen(vp.lat, vp.lon);
        if (Math.hypot(p.x - x, p.y - y) < 25) { snapped = { lat: vp.lat, lon: vp.lon, name: 'Voie ' + vp.voie }; break; }
      }
    }
    const point = snapped || { lat: worldPos.lat, lon: worldPos.lon, name: `(${worldPos.lat.toFixed(4)}, ${worldPos.lon.toFixed(4)})` };

    if (!this._tracerLignePointA) {
      this._tracerLignePointA = point;
      this._showPickHint(`Point A: ${point.name} — Cliquer sur le point B`);
    } else {
      const ptA = this._tracerLignePointA;
      this._showPickHint('Import en cours...');

      try {
        const result = await this.game.orm.importInfrastructure(ptA.lat, ptA.lon, point.lat, point.lon);
        if (result.voiePoints.length === 0) {
          this._showPickHint('Aucune voie ferrée trouvée entre ces 2 points. Réessayez.');
          this._tracerLignePointA = null;
          return;
        }

        // Tag everything with a group ID for bulk delete
        const lineGroupId = `line-${Date.now()}`;

        // Link voie points near existing stations
        for (const vpData of result.voiePoints) {
          vpData.lineGroupId = lineGroupId;
          for (const st of world.stations) {
            const d = Math.sqrt(Math.pow((vpData.lat - st.lat) * 111, 2) + Math.pow((vpData.lon - st.lon) * 111 * Math.cos(st.lat * Math.PI / 180), 2));
            if (d < 0.5) { // within 500m of station
              vpData.stationId = st.id;
              break;
            }
          }
          // Don't duplicate existing voie points at same location
          const existing = vpm.getAll().find(v => {
            const d = Math.sqrt(Math.pow((v.lat - vpData.lat) * 111, 2) + Math.pow((v.lon - vpData.lon) * 111 * Math.cos(v.lat * Math.PI / 180), 2));
            return d < 0.02 && v.voie === vpData.voie; // within 20m and same voie
          });
          if (!existing) {
            vpm.addVoiePoint(vpData);
          } else {
            // Remap tronçons to use existing VP
            for (const trc of result.troncons) {
              if (trc.pointA === vpData.id) trc.pointA = existing.id;
              if (trc.pointB === vpData.id) trc.pointB = existing.id;
            }
          }
        }

        // Add tronçons (keep all — no dédoublonnage, parallel tracks are valid!)
        let addedTrc = 0;
        for (const trcData of result.troncons) {
          trcData.lineGroupId = lineGroupId;
          if (trcData.pointA === trcData.pointB) continue;
          vpm.addTroncon(trcData);
          addedTrc++;
        }

        this.game.saveState();
        this._lastLineGroupId = lineGroupId;
        this._tracerLignePointA = null;
        const vpCount = result.voiePoints.length;
        const trackInfo = result.troncons.length > 0 ? ` (${addedTrc} tronçons)` : '';
        this._showPickHint(`Import OK: ${vpCount} points de voie${trackInfo}. Cliquer pour un autre tracé, Suppr pour annuler l'import, ou Echap.`);
      } catch (e) {
        console.error('Tracer ligne error:', e);
        this._showPickHint('Erreur lors de l\'import. Réessayez.');
        this._tracerLignePointA = null;
      }
    }
  }

  // --- MAP SEARCH (Nominatim geocoding) ---
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
  }

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
  }

  // --- MOBILE NAV ---
  setupMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.querySelector('.nav-tabs');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-btn')) nav.classList.remove('open'); });
  }

  // ============================================================
  // INFOGARE
  // ============================================================

  renderInfogarePage() {
    const sel = document.getElementById('infogare-station');
    if (!sel) return;
    const stations = this.game.world.stations.filter(s => !s.closed);
    sel.innerHTML = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const btn = document.getElementById('btn-infogare-show');
    if (btn) btn.onclick = () => this._showInfogareBoard();
  }

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
        const delay = Math.round(svc.delay || 0);

        results.push({
          svcId: svc.id,
          name: svc.name,
          trainNumber: svc.train?.number || '',
          seriesName: svc.train?.seriesName || '',
          destination: destStation?.name || '?',
          origin: origStation?.name || '?',
          depTime, arrTime, waitMin,
          isDeparture, isArrival, isFirst, isLast,
          servedStations, fromStations,
          delay,
          line,
          lineCode: line?.code || '',
          lineName: line?.name || '',
          lineColor: line?.color || '#3b82f6',
          voie: stop.platform || svc.train?.platform || '',
          state: svc.state,
          speed: svc.speed || 0,
          rame: svc.rame,
        });
      }
    }

    // Filter by mode
    if (mode === 'sncf-arr') {
      return results.filter(r => r.isArrival).sort((a, b) => ((a.arrTime || 0) - (b.arrTime || 0) + 1440) % 1440 - ((b.arrTime || 0) - (b.arrTime || 0) + 1440) % 1440);
    }
    // Default: departures
    const deps = results.filter(r => r.isDeparture);
    deps.sort((a, b) => {
      const wa = a.waitMin != null ? a.waitMin : 9999;
      const wb = b.waitMin != null ? b.waitMin : 9999;
      return wa - wb;
    });
    return deps;
  }

  _fmtTime(min) {
    if (min == null || isNaN(min)) return '--h--';
    const h = Math.floor(((min % 1440) + 1440) % 1440 / 60);
    const m = Math.round(((min % 1440) + 1440) % 1440 % 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  _fmtWait(min) {
    if (min == null) return '';
    if (min <= 0) return "a l'approche";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`;
  }

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

    switch (displayType) {
      case 'rer-ratp': board.innerHTML = this._renderRerRatp(station, trains, nowStr); break;
      case 'rer-sncf': board.innerHTML = this._renderRerSncf(station, trains, nowStr); break;
      case 'sncf-dep': board.innerHTML = this._renderSncfDep(station, trains, nowStr); break;
      case 'sncf-arr': board.innerHTML = this._renderSncfArr(station, trains, nowStr); break;
      case 'old-sncf': board.innerHTML = this._renderOldSncf(station, trains, nowStr); break;
    }

    // Setup train click handlers for platform display
    board.querySelectorAll('[data-svc-id]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this._showPlatformDisplay(el.dataset.svcId, stationId));
    });

    // Auto-refresh every 10 seconds
    if (this._infogareInterval) clearInterval(this._infogareInterval);
    this._infogareInterval = setInterval(() => {
      if (this.activePage !== 'infogare') { clearInterval(this._infogareInterval); return; }
      this._showInfogareBoard();
    }, 10000);
  }

  // --- RER RATP --- pixel-perfect dark screen
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
  }

  // --- RER SNCF --- dark navy, colored line circles, white separators
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
  }

  // --- SNCF DEPARTS (blue) --- exact replica with voie badges
  _renderSncfDep(station, trains, nowStr) {
    let rows = '';
    for (const t of trains) {
      const delayStr = t.delay > 0 ? `<span class="ig-sncf-delay">retard ${t.delay} min.</span>` : '<span class="ig-sncf-ontime">a l\'heure</span>';
      const served = t.servedStations.map(s => `<span class="ig-sncf-dot">\u2022</span> ${s}`).join(' ');
      const voieNum = parseInt(t.voie) || 0;
      const voieClass = voieNum > 10 ? 'ig-sncf-voie-high' : 'ig-sncf-voie-low';
      rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-logo-icon">${t.seriesName || 'SNCF'}</span>
          <span class="ig-sncf-status">${delayStr}</span>
          <span class="ig-sncf-time">${this._fmtTime(t.depTime)}</span>
          <span class="ig-sncf-dest">${t.destination}</span>
          <span class="ig-sncf-voie">${t.voie ? `<span class="ig-sncf-voie-num ${voieClass}">${t.voie}</span>` : ''}</span>
        </div>
        ${served ? `<div class="ig-sncf-served">${served}</div>` : ''}
      </div>`;
    }

    return `<div class="ig-sncf-board ig-sncf-dep">
      <div class="ig-sncf-header ig-sncf-header-dep">
        <div class="ig-sncf-header-title">Departs Grandes Lignes</div>
        <div class="ig-sncf-header-sub">Mainline departures - Abfahrt Fernverkehr</div>
      </div>
      <div class="ig-sncf-colheader"><span>train n\u00b0</span><span>heure</span><span>destination</span><span>voie</span></div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
      <div class="ig-sncf-footer">
        <div class="ig-sncf-legend"><span class="ig-sncf-legend-sq" style="background:#d4a017"></span> voies 2 a 12, <span class="ig-sncf-legend-sq" style="background:#3366cc"></span> voies 23 a 30</div>
        <div class="ig-sncf-clock">${nowStr.replace(':','.')}</div>
        <div class="ig-sncf-logo">SNCF</div>
      </div>
    </div>`;
  }

  // --- SNCF ARRIVEES (green) --- exact replica
  _renderSncfArr(station, trains, nowStr) {
    let rows = '';
    for (const t of trains) {
      const delayStr = t.delay > 0 ? `<span class="ig-sncf-delay">retard ${t.delay} min.</span>` : '<span class="ig-sncf-ontime">a l\'heure</span>';
      const from = t.fromStations.map(s => `<span class="ig-sncf-dot">\u2022</span> ${s}`).join(' ');
      const stateStr = t.state === 'stopped_at_station' && t.isLast ? '<span class="ig-sncf-arrived">arrive</span>' : '';
      const voieNum = parseInt(t.voie) || 0;
      const voieClass = voieNum > 10 ? 'ig-sncf-voie-high' : 'ig-sncf-voie-low';
      rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-logo-icon">${t.seriesName || 'SNCF'}</span>
          <span class="ig-sncf-status">${stateStr || delayStr}</span>
          <span class="ig-sncf-time">${this._fmtTime(t.arrTime)}</span>
          <span class="ig-sncf-dest">${t.origin}</span>
          <span class="ig-sncf-voie">${t.voie ? `<span class="ig-sncf-voie-num ${voieClass}">${t.voie}</span>` : ''}</span>
        </div>
        ${from ? `<div class="ig-sncf-served">${from}</div>` : ''}
      </div>`;
    }

    return `<div class="ig-sncf-board ig-sncf-arr">
      <div class="ig-sncf-header ig-sncf-header-arr">
        <div class="ig-sncf-header-title">Arrivees Grandes Lignes</div>
        <div class="ig-sncf-header-sub">Mainline arrivals - Ankunft Fernverkehr</div>
      </div>
      <div class="ig-sncf-colheader"><span>train n\u00b0</span><span>heure</span><span>provenance</span><span>voie</span></div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
      <div class="ig-sncf-footer">
        <div class="ig-sncf-legend"><span class="ig-sncf-legend-sq" style="background:#d4a017"></span> voies 2 a 12, <span class="ig-sncf-legend-sq" style="background:#3366cc"></span> voies 23 a 30</div>
        <div class="ig-sncf-clock">${nowStr.replace(':','.')}</div>
        <div class="ig-sncf-logo">SNCF</div>
      </div>
    </div>`;
  }

  // --- OLD SNCF (Solari split-flap) --- exact Gare du Nord style
  _renderOldSncf(station, trains, nowStr) {
    let rows = '';
    for (const t of trains) {
      const servedTxt = t.servedStations.join('  ').toUpperCase();
      const destFull = `${t.destination.toUpperCase()}${servedTxt ? '  ' + servedTxt : ''}`;
      const remarks = (t.seriesName || '').toUpperCase();
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
  }

  _animateSolari() {
    const cells = document.querySelectorAll('.ig-solari-cell');
    cells.forEach((el, idx) => {
      el.classList.add('ig-solari-flip');
      el.style.animationDelay = `${Math.floor(idx / 5) * 0.12}s`;
    });
  }

  // --- PLATFORM DISPLAY (click on a train) ---
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
    const delayStr = svc.delay > 0 ? `Retard ${svc.delay} min` : '';
    const numCars = svc.rame?.elementDetails?.length || 8;

    const board = document.getElementById('infogare-board');
    if (!board) return;

    if (isGrandeLigne) {
      board.innerHTML = this._renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
    } else {
      board.innerHTML = this._renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
    }

    board.querySelector('.ig-platform-back')?.addEventListener('click', () => this._showInfogareBoard());
  }

  // --- Platform Grande Ligne --- exact Ouigo/TGV display
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
  }

  // --- Platform Banlieue --- exact Transilien cream display
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
  }

  // ==================== DASHBOARD ====================
  renderDashboard() {
    try {
      const container = document.getElementById('dashboard-container');
      this.game.dashboard.render(container, this.game);
    } catch(e) { console.warn('Dashboard render error:', e); }
  }

  // ==================== GRAPHIQUE DE MARCHE ====================
  renderGraphMarche() {
    try {
      const container = document.getElementById('graph-marche-container');
      this.game.graphMarche.render(container, this.game);
    } catch(e) { console.warn('GraphMarche render error:', e); }
  }

  // ==================== STAFF ====================
  renderStaffPage() {
    try {
      const container = document.getElementById('staff-container');
      this.game.staffManager.render(container, this.game);
    } catch(e) { console.warn('Staff render error:', e); }
  }

  // ==================== BANK ====================
  renderBankPage() {
    try {
      const container = document.getElementById('bank-container');
      this.game.bank.render(container, this.game);
    } catch(e) { console.warn('Bank render error:', e); }
  }

  // ==================== WEATHER ====================
  renderWeatherPage() {
    try {
      const container = document.getElementById('weather-container');
      this.game.weather.render(container);
    } catch(e) { console.warn('Weather render error:', e); }
  }

  // ==================== UNIONS ====================
  renderUnionsPage() {
    try {
      const container = document.getElementById('unions-container');
      this.game.unions.render(container, this.game);
    } catch(e) { console.warn('Unions render error:', e); }
  }

  // ==================== SEASONAL ====================
  renderSeasonalPage() {
    try {
      const container = document.getElementById('seasonal-container');
      this.game.seasonal.render(container, this.game);
    } catch(e) { console.warn('Seasonal render error:', e); }
  }

  // ==================== CONNECTIONS ====================
  renderConnectionsPage() {
    try {
      const container = document.getElementById('connections-container');
      this.game.connections.render(container, this.game);
    } catch(e) { console.warn('Connections render error:', e); }
  }

  // ==================== STATION UPGRADES ====================
  renderStationUpgradesPage() {
    try {
      const container = document.getElementById('station-upgrades-container');
      this.game.stationUpgrades.render(container, this.game);
    } catch(e) { console.warn('StationUpgrades render error:', e); }
  }

  // ==================== JUNCTIONS ====================
  renderJunctionsPage() {
    try {
      const container = document.getElementById('junctions-container');
      this.game.junctionManager.render(container, this.game);
    } catch(e) { console.warn('Junctions render error:', e); }
  }

  // ==================== CARGO TYPES ====================
  renderCargoTypesPage() {
    try {
      const container = document.getElementById('cargo-types-container');
      this.game.cargoTypes.render(container, this.game);
    } catch(e) { console.warn('CargoTypes render error:', e); }
  }

  // ==================== ITE MODULES ====================
  renderITEModulesPage() {
    try {
      const container = document.getElementById('ite-modules-container');
      this.game.iteModules.render(container, this.game);
    } catch(e) { console.warn('ITEModules render error:', e); }
  }

  // ==================== INDUSTRIAL CLIENTS ====================
  renderIndustrialClientsPage() {
    try {
      const container = document.getElementById('industrial-clients-container');
      this.game.industrialClients.render(container, this.game);
    } catch(e) { console.warn('IndustrialClients render error:', e); }
  }

  // ==================== SHUNTING ====================
  renderShuntingPage() {
    try {
      const container = document.getElementById('shunting-container');
      this.game.shuntingManager.render(container, this.game);
    } catch(e) { console.warn('Shunting render error:', e); }
  }
}
