import { haversineDistance } from './simulation.js?v=1784931688';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784931688';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784931688';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784931688';

export const UIEntity = {
  toggleStationCreation() {
      this.stationCreationMode = !this.stationCreationMode;
      if (!this.stationCreationMode && this._multiCreateMode === 'station') {
        // Single click to deactivate clears multi-mode too
        this._multiCreateMode = null;
        document.getElementById('btn-create-station')?.classList.remove('multi-mode');
      }
      const btn = document.getElementById('btn-create-station');
      if (btn) {
        btn.textContent = this.stationCreationMode ? '✕ Annuler' : '+ Creer une gare';
        btn.classList.toggle('active-mode', this.stationCreationMode);
      }
      const canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.cursor = this.stationCreationMode ? 'crosshair' : 'grab';
    },

  toggleIndustryCreation() {
      this.industryCreationMode = !this.industryCreationMode;
      const btn = document.getElementById('btn-create-industry');
      if (btn) {
        btn.textContent = this.industryCreationMode ? '✕ Annuler' : '+ Industrie';
        btn.classList.toggle('active-mode', this.industryCreationMode);
      }
      const canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.cursor = this.industryCreationMode ? 'crosshair' : 'grab';
      if (this.industryCreationMode) {
        this._showPickHint('Cliquez sur la carte pour placer une nouvelle industrie (Echap pour annuler)');
      } else {
        this._hidePickHint();
      }
    },

  openStationCreationModal(lat, lon) {
      this.stationCreationMode = false;
      const btn = document.getElementById('btn-create-station');
      if (btn) { btn.textContent = '+ Creer une gare'; btn.classList.remove('active-mode'); }
      document.getElementById('game-canvas').style.cursor = 'grab';

      this._editingStationId = null;
      document.getElementById('station-lat').value = lat.toFixed(6);
      document.getElementById('station-lon').value = lon.toFixed(6);
      document.getElementById('station-lat').readOnly = true;
      document.getElementById('station-lon').readOnly = true;
      document.getElementById('station-name').value = '';
      document.getElementById('station-platforms').value = '4';
      document.getElementById('station-platform-names').value = '';
      // Player note: creation mode hides platforms/connection, defaults are applied.
      document.getElementById('station-platforms-row').style.display = 'none';
      const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
      if (platformNamesGroup) { platformNamesGroup.style.display = 'none'; }
      const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
      if (connectGroup) { connectGroup.style.display = 'none'; }
      const closedCb = document.getElementById('station-closed');
      if (closedCb) closedCb.checked = false;
      const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
      if (terminusGroup) terminusGroup.style.display = 'none';
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
      const connectSearch = document.getElementById('station-connect-search');
      if (connectSelect) {
        const existing = this.game.world.stations.map(s => {
          const d = Math.sqrt(
            Math.pow((s.lat - lat) * 111, 2) +
            Math.pow((s.lon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2)
          );
          return { ...s, dist: d };
        }).sort((a, b) => a.dist - b.dist);

        this._stationConnectOptions = existing;

        const renderOptions = (filter = '') => {
          const term = filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const filtered = existing.filter(s => {
            const name = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return name.includes(term);
          });
          connectSelect.innerHTML = '<option value="">Aucune connexion</option>' +
            filtered.map(s =>
              `<option value="${s.id}">${s.name} (${Math.round(s.dist)} km)</option>`
            ).join('');
        };
        renderOptions();
        connectSelect.value = '';

        if (connectSearch) {
          connectSearch.value = '';
          connectSearch.oninput = () => renderOptions(connectSearch.value);
        }

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

      // Type change: show/hide fields for poste types
      const typeSelect = document.getElementById('station-type');
      const radiusGroup = document.getElementById('station-radius-group');
      const platformsRow = document.getElementById('station-platforms-row');
      const closedGroup = document.getElementById('station-closed')?.closest('.form-group');
      const modalTitle = document.getElementById('modal-station-title');
      const nameInput = document.getElementById('station-name');
      const _updateTypeFields = () => {
        const val = typeSelect.value;
        const isPoste = val === 'poste_aiguillage' || val === 'poste_regulation';
        const isDepot = val === 'depot';
        if (radiusGroup) radiusGroup.classList.toggle('hidden', !isPoste);
        if (platformsRow) platformsRow.style.display = isPoste ? 'none' : '';
        if (platformNamesGroup) platformNamesGroup.style.display = isPoste ? 'none' : '';
        if (connectGroup) connectGroup.style.display = 'none';
        if (terminusGroup) terminusGroup.style.display = 'none';
        if (closedGroup) closedGroup.style.display = isPoste ? 'none' : '';
        const lineSelectGroup = document.getElementById('station-line')?.closest('.form-group');
        if (lineSelectGroup) lineSelectGroup.style.display = 'none';
        if (val === 'poste_aiguillage') {
          if (modalTitle) modalTitle.textContent = "Créer un poste d'aiguillage";
          if (saveBtn) saveBtn.textContent = "Créer le poste d'aiguillage";
          if (nameInput) nameInput.placeholder = "ex: Poste Paris-Nord";
        } else if (val === 'poste_regulation') {
          if (modalTitle) modalTitle.textContent = 'Créer un poste de régulation';
          if (saveBtn) saveBtn.textContent = 'Créer le poste de régulation';
          if (nameInput) nameInput.placeholder = 'ex: Régulation Île-de-France';
        } else if (isDepot) {
          if (modalTitle) modalTitle.textContent = this._editingStationId ? "Modifier l'ITE Dépôt" : 'Créer un ITE Dépôt de maintenance';
          if (saveBtn) saveBtn.textContent = this._editingStationId ? "Modifier l'ITE Dépôt" : "Créer l'ITE Dépôt";
          if (nameInput) nameInput.placeholder = 'ex: Dépôt de Lyon Vénissieux';
        } else {
          if (modalTitle) modalTitle.textContent = this._editingStationId ? 'Modifier la gare' : 'Creer une gare';
          if (saveBtn) saveBtn.textContent = this._editingStationId ? 'Modifier la gare' : 'Creer la gare';
          if (nameInput) nameInput.placeholder = 'ex: Paris Gare du Nord';
        }
        const radiusInput = document.getElementById('station-radius');
        if (radiusInput && isPoste) {
          radiusInput.value = val === 'poste_regulation' ? '30' : '10';
        }
      };
      if (typeSelect) {
        typeSelect.value = 'mixed';
        typeSelect.onchange = _updateTypeFields;
      }
      _updateTypeFields();

      const loadingEl = document.getElementById('station-loading');
      if (loadingEl) loadingEl.classList.add('hidden');
      document.getElementById('modal-station')?.classList.remove('hidden');
    },

  async saveStation() {
      const name = document.getElementById('station-name').value.trim();
      if (!name) return alertToast('Nom requis');
      let lat = parseFloat(document.getElementById('station-lat').value);
      let lon = parseFloat(document.getElementById('station-lon').value);
      const type = document.getElementById('station-type').value;
      const platforms = parseInt(document.getElementById('station-platforms').value) || 4;
      const platformNamesRaw = document.getElementById('station-platform-names')?.value.trim() || '';
      const platformNames = platformNamesRaw ? platformNamesRaw.split(',').map(s => s.trim()).filter(s => s) : [];

      const closed = document.getElementById('station-closed')?.checked || false;

      // Handle poste types — create in staffManager, not as a station
      if (type === 'poste_aiguillage' || type === 'poste_regulation') {
        const radiusKm = parseFloat(document.getElementById('station-radius')?.value) || (type === 'poste_regulation' ? 30 : 10);
        if (type === 'poste_aiguillage') {
          this.game.staffManager.addSignalBox({ name, lat, lon, radiusKm });
        } else {
          this.game.staffManager.addZone(name, lat, lon, radiusKm);
        }
        document.getElementById('modal-station')?.classList.add('hidden');
        this.game.saveState();
        return;
      }

      // Handle edit mode
      if (this._editingStationId) {
        const station = this.game.world.getStationById(this._editingStationId);
        if (station) {
          station.name = name;
          station.lat = lat;
          station.lon = lon;
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
        // Auto: find nearest station within 50 km (player feedback + remaster I).
        let nearestDist = Infinity;
        for (const s of existingStations) {
          const d = haversineDistance(s.lat, s.lon, lat, lon);
          if (d < nearestDist) { nearestDist = d; connectTo = s; }
        }
        if (nearestDist >= 50) connectTo = null; // too far
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
        } catch (e) {
          console.warn('ORM route failed:', e);
          const dist = Math.round(Math.sqrt(Math.pow((lat - connectTo.lat) * 111, 2) + Math.pow((lon - connectTo.lon) * 111 * Math.cos(lat * Math.PI / 180), 2)));
          this.game.world.addTrack({
            stationA: connectTo.id, stationB: station.id,
            distance: dist, maxSpeed: 160, name: `${connectTo.name} - ${name}`,
          });
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
          }
        }
      }

      if (type === 'depot') {
        this.game.depotManager.add({ type: 'depot', name: `Depot ${name}`, stationId: station.id, tracks: platforms, cost: 0, infrastructure: ['rotonde', 'technicentre'] }, this.game.economy);
      }
      if (type === 'ite') {
        this.game.depotManager.add({ type: 'ite-fret', name: `ITE ${name}`, stationId: station.id, tracks: 2, cost: 0 });
      }

      document.getElementById('modal-station')?.classList.add('hidden');
      this.game.saveState();
      // Keep the station creation tool selected so the player can chain placements.
      // (Échap or a click on the button deselects it.)
      if (!this._editingStationId) {
        setTimeout(() => {
          if (!this.stationCreationMode) this.toggleStationCreation();
          this._showPickHint('Gare creee — cliquez sur la carte pour en placer une autre, Echap pour quitter.');
        }, 100);
      }
    },

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
    },

  _hidePickHint() {
      const hint = document.getElementById('pick-hint-overlay');
      if (hint) hint.style.display = 'none';
    },

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
    },

  openEditStationModal(station) {
      this._editingStationId = station.id;
      document.getElementById('station-name').value = station.name;
      document.getElementById('station-lat').value = station.lat.toFixed(6);
      document.getElementById('station-lon').value = station.lon.toFixed(6);
      // Note joueurs : GPS et type modifiables en édition
      document.getElementById('station-lat').readOnly = false;
      document.getElementById('station-lon').readOnly = false;
      // Show hidden fields from creation mode so they can be edited.
      document.getElementById('station-platforms-row').style.display = '';
      const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
      if (platformNamesGroup) { platformNamesGroup.style.display = ''; }
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
    },

  deleteStation(stationId) {
      if (!confirm('Supprimer cette gare ? Les voies connectees seront aussi supprimees.')) return;
      this.game.world.removeStation(stationId);
      this._editingStationId = null;
      // Restore modal state
      document.getElementById('station-platforms-row').style.display = 'none';
      const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
      if (platformNamesGroup) platformNamesGroup.style.display = 'none';
      const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
      if (connectGroup) connectGroup.style.display = 'none';
      const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
      if (terminusGroup) terminusGroup.style.display = '';
      const btn = document.getElementById('btn-save-station');
      if (btn) btn.textContent = 'Creer la gare';
      const delBtn = document.getElementById('btn-delete-station');
      if (delBtn) delBtn.classList.add('hidden');
      document.getElementById('modal-station')?.classList.add('hidden');
      this.game.saveState();
    },

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
      const search = document.getElementById('stock-search');
      const catFilter = document.getElementById('stock-cat-filter');
      search?.addEventListener('input', () => { this._stockPage = 0; this.renderStockList(); });
      catFilter?.addEventListener('change', () => { this._stockPage = 0; this._populateStockSubcatFilter(); this.renderStockList(); });
      document.getElementById('stock-subcat-filter')?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
      document.getElementById('stock-per-page')?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
      this._populateStockSubcatFilter();
    },

  _populateStockSubcatFilter() {
      const sel = document.getElementById('stock-subcat-filter');
      const catFilter = document.getElementById('stock-cat-filter');
      if (!sel || !catFilter) return;
      const isWagon = catFilter.value === 'wagon';
      sel.style.display = isWagon ? 'inline-block' : 'none';
      if (!isWagon) { sel.value = ''; return; }
      const current = sel.value;
      const labels = {
        tombereau: 'Tombercau', citerne: 'Citerne', gaz: 'Gazier', 'porte-auto': 'Porte-Auto',
        tremie: 'Trémic', cerealier: 'Céréalier', ciment: 'Ciment', silos: 'Silos',
        plat: 'Plat', ttx: 'TTX', intermodal: 'Intermodal', speciaux: 'Spéciaux',
        couvert: 'Couvert', bache: 'Bâché', infra: 'Infral'
      };
      const distinct = new Set(this.game.rollingStock.getAll().filter(i => i.category === 'wagon' && i.wagonSubCategory).map(i => i.wagonSubCategory));
      let html = '<option value="">Tous les wagons</option>';
      for (const [val, label] of Object.entries(labels)) {
        if (distinct.has(val)) html += `<option value="${val}">${label}</option>`;
      }
      sel.innerHTML = html;
      if (Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    },

  openStockModal() {
      this._editingStockId = null;
      const title = document.getElementById('stock-modal-title');
      if (title) title.textContent = 'Ajouter un engin';
      const saveBtn = document.getElementById('btn-save-stock');
      if (saveBtn) saveBtn.textContent = "Enregistrer l'engin";

      document.getElementById('modal-add-stock')?.classList.remove('hidden');
      // Reset all fields to defaults (a previous edit may have left values).
      this._setStockField('stock-name', '');
      this._setStockField('stock-series-name', '');
      this._setStockField('stock-category', 'locomotive');
      this._setStockField('stock-speed', '160');
      this._setStockField('stock-power', '0');
      this._setStockField('stock-length', '20');
      this._setStockField('stock-mass', '80');
      this._setStockField('stock-capacity', '0');
      this._setStockField('stock-freight-cap', '0');
      this._setStockWagonSubcat('');
      this._setStockTraction(['Diesel']);
      document.getElementById('stock-image-preview')?.classList.add('hidden');
      this._stockImageData = null;

      // Populate cargo types checkboxes and computed fields
      this._populateCargoTypesCheckboxes();
      this._wireStockCategoryToggle();
      this._updateStockComputedFields();
    },

  _setStockField(id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val;
    },

  _setStockTraction(values) {
      const checkboxes = document.querySelectorAll('.stock-traction-cb');
      const set = new Set(values.map(v => v.toLowerCase()));
      checkboxes.forEach(cb => { cb.checked = set.has(cb.value.toLowerCase()); });
    },

  _getStockTraction() {
      return Array.from(document.querySelectorAll('.stock-traction-cb:checked')).map(cb => cb.value);
    },

  _getStockTractionString() {
      const vals = this._getStockTraction();
      if (vals.length === 0) return 'none';
      return vals.join('+');
    },

  _setStockWagonSubcat(val) {
      const el = document.getElementById('stock-wagon-subcat');
      if (el) el.value = val;
    },

  _getStockWagonSubcat() {
      return document.getElementById('stock-wagon-subcat')?.value || '';
    },

  _computeStockTonnage() {
      const category = document.getElementById('stock-category')?.value || 'locomotive';
      const mass = parseFloat(document.getElementById('stock-mass')?.value) || 0;
      const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
      return category === 'wagon' ? Math.round(mass + freightCap) : Math.round(mass);
    },

  _calculateStockPrice() {
      const category = document.getElementById('stock-category')?.value || 'locomotive';
      const power = parseFloat(document.getElementById('stock-power')?.value) || 0;
      const capacity = parseFloat(document.getElementById('stock-capacity')?.value) || 0;
      const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
      // MAT-04 : prix calculé selon le type d'engin.
      if (category === 'locomotive' || category === 'automotrice') {
        return Math.max(0, Math.round(power * 1000));
      }
      if (category === 'voiture') {
        return Math.max(0, Math.round(capacity * 100));
      }
      if (category === 'wagon') {
        return Math.max(0, Math.round(freightCap * 100));
      }
      return 0;
    },

  _updateStockComputedFields() {
      const tonnage = this._computeStockTonnage();
      const price = this._calculateStockPrice();
      const tonEl = document.getElementById('stock-tonnage-display');
      if (tonEl) tonEl.textContent = `${tonnage} t`;
      const priceEl = document.getElementById('stock-price-display');
      if (priceEl) priceEl.textContent = `${price.toLocaleString('fr-FR')} €`;
    },

  _wireStockCategoryToggle() {
      const catSel = document.getElementById('stock-category');
      const cargoGroup = document.getElementById('stock-cargo-types-group');
      const subcatGroup = document.getElementById('stock-wagon-subcat-group');
      if (!catSel) return;
      const onChange = () => {
        const isWagon = catSel.value === 'wagon';
        if (cargoGroup) cargoGroup.style.display = isWagon ? 'block' : 'none';
        if (subcatGroup) subcatGroup.style.display = isWagon ? 'block' : 'none';
        this._updateStockComputedFields();
      };
      catSel.onchange = onChange;
      onChange();
      // recompute computed fields when any numeric input changes
      ['stock-mass','stock-speed','stock-power','stock-capacity','stock-freight-cap'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => this._updateStockComputedFields());
      });
      document.querySelectorAll('.stock-traction-cb').forEach(cb => {
        cb.addEventListener('change', () => this._updateStockComputedFields());
      });
    },

  editStock(id) {
      const item = this.game.rollingStock.getById(id);
      if (!item) return;
      this._editingStockId = id;
      const title = document.getElementById('stock-modal-title');
      if (title) title.textContent = "Modifier l'engin";
      const saveBtn = document.getElementById('btn-save-stock');
      if (saveBtn) saveBtn.textContent = 'Enregistrer les modifications';

      document.getElementById('modal-add-stock')?.classList.remove('hidden');
      this._setStockField('stock-name', item.name || '');
      this._setStockField('stock-series-name', item.seriesName || '');
      this._setStockField('stock-category', item.category || 'locomotive');
      this._setStockTraction((item.traction || 'none').split('+').map(s => s.trim()).filter(Boolean));
      this._setStockField('stock-speed', item.maxSpeed ?? 160);
      this._setStockField('stock-power', item.power ?? 0);
      this._setStockField('stock-length', item.length ?? 20);
      this._setStockField('stock-mass', item.mass ?? 80);
      this._setStockField('stock-capacity', item.passengerCapacity ?? 0);
      this._setStockField('stock-freight-cap', item.freightCapacity ?? 0);
      this._setStockWagonSubcat(item.wagonSubCategory || '');

      this._stockImageData = item.imageData || null;
      const preview = document.getElementById('stock-image-preview');
      if (preview) {
        if (item.imageData) { preview.src = item.imageData; preview.classList.remove('hidden'); }
        else preview.classList.add('hidden');
      }

      this._populateCargoTypesCheckboxes();
      const sel = new Set(item.cargoTypes || []);
      document.querySelectorAll('.stock-cargo-cb').forEach(cb => { cb.checked = sel.has(cb.value); });
      this._wireStockCategoryToggle();
      this._updateStockComputedFields();
    },

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
    },

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
    },

  saveStock() {
      const name = document.getElementById('stock-name').value.trim();
      if (!name) return alertToast('Nom requis');
      const category = document.getElementById('stock-category').value;
      const mass = parseFloat(document.getElementById('stock-mass')?.value) || 80;
      const freightCapacity = parseFloat(document.getElementById('stock-freight-cap').value) || 0;
      const tonnage = category === 'wagon' ? Math.round(mass + freightCapacity) : Math.round(mass);
      const data = {
        name,
        category,
        traction: this._getStockTractionString(),
        maxSpeed: parseInt(document.getElementById('stock-speed').value) || 160,
        tonnage,
        mass,
        power: parseInt(document.getElementById('stock-power')?.value) || 0,
        passengerCapacity: parseInt(document.getElementById('stock-capacity').value) || 0,
        freightCapacity,
        length: parseFloat(document.getElementById('stock-length').value) || 20,
        imageData: this._stockImageData,
        seriesName: document.getElementById('stock-series-name')?.value.trim() || '',
        purchasePrice: this._calculateStockPrice(),
        cargoTypes: Array.from(document.querySelectorAll('.stock-cargo-cb:checked')).map(cb => cb.value),
        wagonSubCategory: this._getStockWagonSubcat(),
      };
      if (this._editingStockId) {
        this.game.rollingStock.update(this._editingStockId, data);
        this._editingStockId = null;
      } else {
        this.game.rollingStock.add(data);
      }
      document.getElementById('modal-add-stock')?.classList.add('hidden');
      this.game.saveState?.();
      this.renderStockList();
    },

  renderStockList() {
      const container = document.getElementById('stock-list');
      if (!container) return;
      this._populateStockSubcatFilter();
      const pager = document.getElementById('stock-pager');
      const countEl = document.getElementById('stock-count');
      const all = this.game.rollingStock.getAll();
      if (all.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun materiel. Cliquer "+ Ajouter un engin" pour importer.</p>';
        if (pager) pager.innerHTML = '';
        if (countEl) countEl.textContent = '';
        return;
      }
      const q = (document.getElementById('stock-search')?.value || '').trim().toLowerCase();
      const cat = document.getElementById('stock-cat-filter')?.value || '';
      const subcat = document.getElementById('stock-subcat-filter')?.value || '';
      let items = all;
      if (cat) items = items.filter(i => i.category === cat);
      if (subcat) items = items.filter(i => i.wagonSubCategory === subcat);
      if (q) items = items.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.seriesName || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.traction || '').toLowerCase().includes(q) ||
        (i.wagonSubCategory || '').toLowerCase().includes(q));
      const PAGE = parseInt(document.getElementById('stock-per-page')?.value) || 60;
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / PAGE));
      if (this._stockPage == null) this._stockPage = 0;
      if (this._stockPage >= pages) this._stockPage = pages - 1;
      const start = this._stockPage * PAGE;
      const view = items.slice(start, start + PAGE);
      if (countEl) countEl.textContent = `${total} engin${total > 1 ? 's' : ''}` + (total !== all.length ? ` / ${all.length}` : '');
      if (total === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun résultat pour cette recherche.</p>';
        if (pager) pager.innerHTML = '';
        return;
      }
      container.innerHTML = view.map(item => {
        const subLabel = item.wagonSubCategory ? ` — ${escapeHtml(item.wagonSubCategory)}` : '';
        const powerTxt = item.power ? ` · ${item.power} kW` : '';
        const cargoTxt = item.cargoTypes?.length ? ` · ${item.cargoTypes.map(ct => { const info = this.game.cargoTypes?.getTypeInfo?.(ct); return escapeHtml(info?.name || ct); }).join(', ')}` : '';
        const safeName = escapeHtml(item.name);
        const safeImageData = escapeHtml(item.imageData);
        return `
        <div class="card stock-card">
          ${item.imageData ? `<img src="${safeImageData}" loading="lazy" class="card-img" alt="${safeName}">` : ''}
          <div class="card-title" title="${safeName}">${safeName}</div>
          <div class="card-info">
            <div class="stock-line"><span class="stock-label">Cat :</span> ${escapeHtml(item.category)}${subLabel}</div>
            <div class="stock-line"><span class="stock-label">Tract :</span> ${escapeHtml(item.traction || '—')}${powerTxt}</div>
            <div class="stock-line"><span class="stock-label">Perf :</span> ${item.maxSpeed} km/h · ${item.length}m · ${item.tonnage}t</div>
            <div class="stock-line"><span class="stock-label">Charge :</span> ${item.passengerCapacity} places · ${item.freightCapacity}t fret${cargoTxt}</div>
            ${item.purchasePrice ? `<div class="stock-line"><span class="stock-label">Prix :</span> ${item.purchasePrice.toLocaleString('fr-FR')} €</div>` : ''}
            ${item.seriesName ? `<div class="stock-line"><span class="stock-label">Série :</span> ${escapeHtml(item.seriesName)}</div>` : ''}
            ${item.notes ? `<div class="stock-line" style="color:var(--text2)"><span class="stock-label">Note :</span> ${escapeHtml(item.notes)}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-sm" onclick="game.ui.editStock('${jsString(item.id)}')">Modifier</button>
            <button class="btn-sm danger" onclick="game.ui.deleteStock('${jsString(item.id)}')">Supprimer</button>
          </div>
        </div>
      `;}).join('');
      if (pager) {
        if (pages <= 1) { pager.innerHTML = ''; }
        else {
          pager.innerHTML = `
            <button class="btn-sm" ${this._stockPage === 0 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${this._stockPage - 1})">‹ Préc.</button>
            <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._stockPage + 1} / ${pages}</span>
            <button class="btn-sm" ${this._stockPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${this._stockPage + 1})">Suiv. ›</button>`;
        }
      }
    },

  stockPageGo(p) {
      this._stockPage = p;
      this.renderStockList();
      document.getElementById('stock-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

  deleteStock(id) {
      if (!confirm('Supprimer cet engin ?')) return;
      this.game.rollingStock.remove(id);
      this.game.saveState();
      this.renderStockList();
    },

  setupRamePage() {
      document.getElementById('btn-new-rame')?.addEventListener('click', () => this.openRameModal());
      document.getElementById('btn-save-rame')?.addEventListener('click', () => this.saveRame());
      const pickerSearch = document.getElementById('rame-search');
      if (pickerSearch) pickerSearch.addEventListener('input', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
      document.getElementById('rame-cat-filter')?.addEventListener('change', () => { this._ramePickerPage = 0; this._populateRameSubcatFilter(); this.renderRamePicker(); });
      document.getElementById('rame-subcat-filter')?.addEventListener('change', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
      document.getElementById('btn-clear-rame')?.addEventListener('click', () => {
        this.currentRameElements = [];
        this.renderRameAssembly();
      });
      document.getElementById('btn-upload-livery')?.addEventListener('click', () => this.uploadLiveryFromRame());
      const liverySel = document.getElementById('rame-livery');
      if (liverySel) liverySel.addEventListener('change', () => this._applySelectedLiveryName());
      // Section III — recherche et pagination de la liste des rames.
      this._ramesPage = 0;
      const ramesSearch = document.getElementById('rames-search');
      if (ramesSearch) ramesSearch.addEventListener('input', () => { this._ramesPage = 0; this.renderRamesList(); });
      const ramesPerPage = document.getElementById('rames-per-page');
      if (ramesPerPage) ramesPerPage.addEventListener('change', () => { this._ramesPage = 0; this.renderRamesList(); });
    },

  async _populateLiverySelect(selectedId = '') {
      const sel = document.getElementById('rame-livery');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Livrée d\'origine —</option>';
      try {
        const liveries = await this.game.liveryManager.list();
        for (const l of liveries) {
          const opt = document.createElement('option');
          opt.value = l.id;
          opt.textContent = l.name;
          if (String(l.id) === String(selectedId)) opt.selected = true;
          sel.appendChild(opt);
        }
      } catch (e) {
        console.warn('Failed to load liveries:', e);
      }
    },

  async uploadLiveryFromRame() {
      const fileInput = document.getElementById('rame-livery-file');
      const nameInput = document.getElementById('rame-livery-name');
      const file = fileInput?.files?.[0];
      const name = (nameInput?.value || '').trim();
      const base = this.currentRameElements[0];
      if (!base) return alertToast('Ajoutez d\'abord un engin dans la rame pour en faire le matériel d\'origine');
      if (!file) return alertToast('Choisissez une image');
      if (!name) return alertToast('Nommez la livrée');
      const baseStockId = base.stockId || base.id;
      try {
        const l = await this.game.liveryManager.upload(file, name, baseStockId, base.name);
        await this._populateLiverySelect(l.id);
        document.getElementById('rame-name').value = l.name;
        fileInput.value = '';
        nameInput.value = '';
        alertToast('Livrée uploadée');
      } catch (e) {
        alertToast('Erreur upload livrée: ' + e.message);
      }
    },

  _applySelectedLiveryName() {
      const sel = document.getElementById('rame-livery');
      if (!sel || !sel.value) return;
      const opt = sel.options[sel.selectedIndex];
      const nameInput = document.getElementById('rame-name');
      if (opt && nameInput && !nameInput.value.trim()) {
        nameInput.value = opt.textContent;
      }
    },

  _populateRameSubcatFilter() {
      const sel = document.getElementById('rame-subcat-filter');
      const catFilter = document.getElementById('rame-cat-filter');
      if (!sel || !catFilter) return;
      const isWagon = catFilter.value === 'wagon';
      sel.style.display = isWagon ? 'inline-block' : 'none';
      if (!isWagon) { sel.value = ''; return; }
      const current = sel.value;
      const labels = {
        tombereau: 'Tombercau', citerne: 'Citerne', gaz: 'Gazier', 'porte-auto': 'Porte-Auto',
        tremie: 'Trémic', cerealier: 'Céréalier', ciment: 'Ciment', silos: 'Silos',
        plat: 'Plat', ttx: 'TTX', intermodal: 'Intermodal', speciaux: 'Spéciaux',
        couvert: 'Couvert', bache: 'Bâché', infra: 'Infral'
      };
      const distinct = new Set(this.game.rollingStock.getAll().filter(i => i.category === 'wagon' && i.wagonSubCategory).map(i => i.wagonSubCategory));
      let html = '<option value="">Tous les wagons</option>';
      for (const [val, label] of Object.entries(labels)) {
        if (distinct.has(val)) html += `<option value="${val}">${label}</option>`;
      }
      sel.innerHTML = html;
      if (Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    },

  async openRameModal() {
      this.currentRameElements = [];
      this.editingRameId = null;
      this._ramePickerPage = 0;
      document.getElementById('rame-name').value = '';
      const ser = document.getElementById('rame-serial'); if (ser) ser.value = '';
      const s = document.getElementById('rame-search'); if (s) s.value = '';
      const c = document.getElementById('rame-cat-filter'); if (c) c.value = '';
      const sc = document.getElementById('rame-subcat-filter'); if (sc) sc.value = '';
      const q = document.getElementById('rame-qty'); if (q) q.value = '1';
      const lf = document.getElementById('rame-livery-file'); if (lf) lf.value = '';
      const ln = document.getElementById('rame-livery-name'); if (ln) ln.value = '';
      this._populateRameSubcatFilter();
      this._populateLiverySelect();
      const depotSel = document.getElementById('rame-depot');
      if (depotSel) {
        const depots = this.game.depotManager.getDepots();
        depotSel.innerHTML = '<option value="">— Aucun —</option>' + depots.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('');
      }
      document.getElementById('modal-rame')?.classList.remove('hidden');
      await this._loadLiveryStockItems();
      this.renderRamePicker();
      this.renderRameAssembly();
    },

  async _loadLiveryStockItems() {
      this._liveryStockItems = {};
      try {
        const liveries = await this.game.liveryManager.list();
        for (const l of liveries) {
          const base = this.game.rollingStock.getById(l.base_stock_id);
          if (!base) continue;
          const id = `livery:${l.id}`;
          this._liveryStockItems[id] = {
            ...base,
            id,
            name: l.name,
            liveryId: l.id,
            liveryName: l.name,
            baseStockId: base.id,
            imageData: base.imageData || null,
          };
        }
      } catch (e) {
        console.warn('Failed to load livery stock items:', e);
      }
    },

  renderRamePicker() {
      const container = document.getElementById('rame-stock-picker');
      if (!container) return;
      const pager = document.getElementById('rame-picker-pager');
      const countEl = document.getElementById('rame-picker-count');
      const stock = this.game.rollingStock.getAll();
      const liveries = Object.values(this._liveryStockItems || {});
      const all = [...stock, ...liveries];
      if (all.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px">Aucun materiel. Ajoutez-en d\'abord dans la page Materiel.</p>';
        if (pager) pager.innerHTML = '';
        if (countEl) countEl.textContent = '';
        return;
      }
      this._populateRameSubcatFilter();
      const query = (document.getElementById('rame-search')?.value || '').trim().toLowerCase();
      const cat = document.getElementById('rame-cat-filter')?.value || '';
      const subcat = document.getElementById('rame-subcat-filter')?.value || '';
      let items = all;
      if (cat) items = items.filter(i => i.category === cat);
      if (subcat) items = items.filter(i => i.wagonSubCategory === subcat);
      if (query) items = items.filter(i =>
        (i.name || '').toLowerCase().includes(query) ||
        (i.seriesName || '').toLowerCase().includes(query) ||
        (i.notes || '').toLowerCase().includes(query) ||
        (i.category || '').toLowerCase().includes(query) ||
        (i.traction || '').toLowerCase().includes(query) ||
        (i.wagonSubCategory || '').toLowerCase().includes(query) ||
        (i.liveryName || '').toLowerCase().includes(query));
      const PAGE = 60;
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / PAGE));
      if (this._ramePickerPage == null) this._ramePickerPage = 0;
      if (this._ramePickerPage >= pages) this._ramePickerPage = pages - 1;
      const start = this._ramePickerPage * PAGE;
      const view = items.slice(start, start + PAGE);
      if (countEl) countEl.textContent = `${total} engin${total > 1 ? 's' : ''}` + (total !== all.length ? ` / ${all.length}` : '');
      if (total === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px;grid-column:1/-1">Aucun résultat.</p>';
        if (pager) pager.innerHTML = '';
        return;
      }
      container.innerHTML = view.map(item => {
        const safeName = escapeHtml(item.name);
        const safeCategory = escapeHtml(item.category);
        const safeNotes = item.notes ? ` — ${escapeHtml(item.notes)}` : '';
        const baseLabel = item.liveryName ? `Livrée sur ${escapeHtml(item.category)}` : `${safeCategory}${safeNotes}`;
        const price = item.purchasePrice ? ` <span style="color:var(--orange);font-size:9px">${(item.purchasePrice/1000).toFixed(0)}k€</span>` : '';
        let imgHtml;
        if (item.liveryId) {
          imgHtml = `<img data-livery-id="${Number(item.liveryId)}" src="" loading="lazy" alt="${safeName}" style="height:30px;width:60px;object-fit:contain">`;
        } else if (item.imageData) {
          imgHtml = `<img src="${escapeHtml(item.imageData)}" loading="lazy" alt="${safeName}">`;
        } else {
          imgHtml = `<div style="height:30px;width:60px;background:var(--bg);border-radius:2px"></div>`;
        }
        return `
          <div class="stock-picker-item" onclick="game.ui.addToRame('${jsString(item.id)}', event)" title="${safeName} — ${baseLabel}, ${item.maxSpeed} km/h, ${item.length}m">
            ${imgHtml}
            <span>${safeName}${price}</span>
          </div>
        `;
      }).join('');
      this._applyLiveryImages(container);
      if (pager) {
        pager.innerHTML = pages <= 1 ? '' : `
          <button class="btn-sm" ${this._ramePickerPage === 0 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${this._ramePickerPage - 1})">‹ Préc.</button>
          <span style="margin:0 12px;align-self:center;font-size:12px">Page ${this._ramePickerPage + 1} / ${pages}</span>
          <button class="btn-sm" ${this._ramePickerPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${this._ramePickerPage + 1})">Suiv. ›</button>`;
      }
    },

  ramePickerPageGo(p) {
      this._ramePickerPage = p;
      this.renderRamePicker();
      document.getElementById('rame-stock-picker')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

  addToRame(stockId, evOrFlipped) {
      let item = this.game.rollingStock.getById(stockId);
      let liveryId = '';
      let liveryName = '';
      let baseStockId = stockId;
      if (!item && stockId.startsWith('livery:')) {
        const virtual = this._liveryStockItems?.[stockId];
        if (!virtual) return;
        item = this.game.rollingStock.getById(virtual.baseStockId);
        if (!item) return;
        liveryId = virtual.liveryId;
        liveryName = virtual.liveryName;
        baseStockId = virtual.baseStockId;
      }
      if (!item) return;
      const flipped = (evOrFlipped && (typeof evOrFlipped === 'boolean' ? evOrFlipped : evOrFlipped.ctrlKey)) || false;
      let qty = parseInt(document.getElementById('rame-qty')?.value || '1', 10);
      if (!isFinite(qty) || qty < 1) qty = 1;
      let currentLength = this.currentRameElements.reduce((s, e) => s + e.length, 0);
      let added = 0;
      const nameInput = document.getElementById('rame-name');
      const serialInput = document.getElementById('rame-serial');
      const firstInRame = this.currentRameElements.length === 0;
      for (let n = 0; n < qty; n++) {
        if (currentLength + item.length > 750) break;
        // Annexe 8 : numérotation automatique par série dans la rame.
        const instanceNumber = item.seriesName
          ? this.game.rollingStock.nextSeriesNumber(item.seriesName)
          : null;
        const instanceName = liveryName || instanceNumber || item.name;
        this.currentRameElements.push({
          ...item,
          stockId: baseStockId,
          name: liveryName || item.name,
          instanceName,
          instanceNumber,
          liveryId,
          liveryName,
          flipped,
        });
        // Annexe 8 : le nom/n° de série de la rame reprend le premier engin numéroté.
        if (firstInRame && n === 0) {
          if (nameInput && !nameInput.value.trim()) nameInput.value = instanceName;
          if (serialInput && !serialInput.value.trim()) serialInput.value = instanceName;
        }
        currentLength += item.length;
        added++;
      }
      if (added < qty) {
        alertToast(added === 0
          ? 'Longueur maximale de 750m atteinte !'
          : `Longueur max 750m atteinte : ${added}/${qty} engin(s) ajouté(s).`);
      }
      this.renderRameAssembly();
    },

  onRameElementClick(index, ev) {
      if (ev?.ctrlKey) {
        this.flipRameElement(index);
      } else {
        this.removeFromRame(index);
      }
    },

  flipRameElement(index) {
      const el = this.currentRameElements[index];
      if (!el) return;
      el.flipped = !el.flipped;
      this.renderRameAssembly();
    },

  removeFromRame(index) {
      this.currentRameElements.splice(index, 1);
      this.renderRameAssembly();
    },

  renderRameAssembly() {
      const container = document.getElementById('rame-assembly');
      if (!container) return;

      if (this.currentRameElements.length === 0) {
        container.innerHTML = '<p class="rame-empty">Cliquer sur un engin ci-dessous pour l\'ajouter</p>';
      } else {
        const last = this.currentRameElements.length - 1;
        container.innerHTML = '<div class="rame-assembly-images">' + this.currentRameElements.map((el, i) => {
          const label = escapeHtml(el.instanceName || el.name);
          let imgHtml = '';
          const transforms = [];
          if (el.liveryId) {
            imgHtml = `<img data-livery-id="${Number(el.liveryId)}" src="" alt="${label}" title="${label} (clic = retirer, Ctrl+clic = retourner)" onclick="game.ui.onRameElementClick(${i}, event)" class="rame-element-img">`;
          } else if (el.imageData) {
            if (el.isDrivingTrailer && this.currentRameElements.length > 1) {
              const isLeft = i === 0;
              const isRight = i === last;
              const isLeftImage = el.imageData.toLowerCase().endsWith('_l.gif');
              // Cab must face outward. Right-facing image (/_R.gif or .gif) at left end => flip.
              // Left-facing image (/_L.gif) at right end => flip.
              if ((isLeft && !isLeftImage) || (isRight && isLeftImage)) {
                transforms.push('scaleX(-1)');
              }
            }
            if (el.flipped) transforms.push('scaleX(-1)');
            const style = transforms.length ? `transform: ${transforms.join(' ')};` : '';
            imgHtml = `<img src="${escapeHtml(el.imageData)}" alt="${label}" title="${label} (clic = retirer, Ctrl+clic = retourner)" onclick="game.ui.onRameElementClick(${i}, event)" class="rame-element-img"${style ? ` style="${style}"` : ''}>`;
          } else {
            imgHtml = `<div class="rame-element-placeholder" title="${label}" onclick="game.ui.removeFromRame(${i})">${label}</div>`;
          }
          if (el.flipped && el.liveryId) transforms.push('scaleX(-1)');
          const style = transforms.length ? ` style="transform: ${transforms.join(' ')};"` : '';
          if (style) imgHtml = imgHtml.replace(/class="rame-element-img"/, `class="rame-element-img"${style}`);
          return `<div class="rame-element-wrap">${imgHtml}<span class="rame-element-label">${label}</span></div>`;
        }).join('') + '</div>';
        this._applyLiveryImages(container);
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
    },

  saveRame() {
      const nameInput = document.getElementById('rame-name');
      const liverySel = document.getElementById('rame-livery');
      let liveryId = liverySel?.value || '';
      let liveryName = liveryId ? (liverySel.options[liverySel.selectedIndex]?.textContent || '') : '';
      // Si aucune livrée n'est sélectionnée, la rame peut hériter de la livrée du premier élément.
      const firstElement = this.currentRameElements[0] || null;
      if (!liveryId && firstElement?.liveryId) {
        liveryId = firstElement.liveryId;
        liveryName = firstElement.liveryName;
      }
      const name = (nameInput?.value || liveryName || firstElement?.instanceName || '').trim();
      if (!name) return alertToast('Nom requis');
      if (this.currentRameElements.length === 0) return alertToast('Ajoutez au moins un element');

      const totalPrice = this.currentRameElements.reduce((s, e) => s + (e.purchasePrice || 0), 0);
      if (totalPrice > 0) {
        if (this.game.economy.balance < totalPrice) {
          return alertToast(`Solde insuffisant ! Coût: ${totalPrice.toLocaleString('fr-FR')} € — Solde: ${Math.round(this.game.economy.balance).toLocaleString('fr-FR')} €`);
        }
        this.game.economy.addExpense(totalPrice, 'achat', `Achat rame ${name}`);
      }

      const depotId = document.getElementById('rame-depot')?.value || '';
      const serialNumber = document.getElementById('rame-serial')?.value.trim() || '';
      this.game.rameManager.add({
        name,
        serialNumber,
        depotId,
        liveryId,
        liveryName,
        elements: this.currentRameElements.map(e => e.stockId),
        elementDetails: this.currentRameElements.map(e => ({
          name: e.name, instanceName: e.instanceName, seriesName: e.seriesName,
          category: e.category, traction: e.traction,
          maxSpeed: e.maxSpeed, tonnage: e.tonnage,
          mass: e.mass || e.tonnage, power: e.power || 0,
          passengerCapacity: e.passengerCapacity, freightCapacity: e.freightCapacity,
          length: e.length, imageData: e.imageData || '',
          purchasePrice: e.purchasePrice || 0,
          wagonSubCategory: e.wagonSubCategory || '',
          flipped: e.flipped || false,
          liveryId: e.liveryId || '',
          liveryName: e.liveryName || '',
        })),
      });
      document.getElementById('modal-rame')?.classList.add('hidden');
      this.renderRamesList();
    },

  renderRamesList() {
      const container = document.getElementById('rames-list');
      const pager = document.getElementById('rames-pager');
      if (!container) return;
      const all = this.game.rameManager.getAll();
      if (all.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune rame. Cliquer "+ Nouvelle rame".</p>';
        if (pager) pager.innerHTML = '';
        return;
      }

      const q = (document.getElementById('rames-search')?.value || '').trim().toLowerCase();
      let items = all;
      if (q) {
        items = items.filter(r =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.serialNumber || '').toLowerCase().includes(q) ||
          (r.elementDetails || []).some(e => (e.instanceName || e.name || '').toLowerCase().includes(q))
        );
      }

      const perPage = parseInt(document.getElementById('rames-per-page')?.value || '50', 10) || 50;
      this._ramesPage = this._ramesPage || 0;
      const pages = Math.max(1, Math.ceil(items.length / perPage));
      if (this._ramesPage >= pages) this._ramesPage = pages - 1;
      const start = this._ramesPage * perPage;
      const view = items.slice(start, start + perPage);

      if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun résultat pour cette recherche.</p>';
        if (pager) pager.innerHTML = '';
        return;
      }

      container.innerHTML = view.map(r => {
        const rameName = escapeHtml(r.name);
        const rameSerial = r.serialNumber ? ` <span style="font-size:11px;color:var(--text3);font-weight:400">(${escapeHtml(r.serialNumber)})</span>` : '';
        const images = r.elementDetails.map(e => {
          const label = escapeHtml(e.instanceName || e.name);
          const style = e.flipped ? 'transform: scaleX(-1);' : '';
          if (e.liveryId) {
            return `<img data-livery-id="${Number(e.liveryId)}" src="" alt="${label}" title="${label}"${style ? ` style="${style}"` : ''}>`;
          }
          return e.imageData
            ? `<img src="${escapeHtml(e.imageData)}" alt="${label}" title="${label}"${style ? ` style="${style}"` : ''}>`
            : `<span class="rame-text-el">${label}</span>`;
        }).join('');
        const depotName = r.depotId ? escapeHtml(this.game.depotManager.getAll().find(d => d.id === r.depotId)?.name || r.depotId) : '';
        const locationLabel = r.currentLocation ? escapeHtml(this._rameLocationLabel(r)) : '';
        return `
        <div class="rame-card">
          <div class="rame-card-header">
            <span class="card-title">${rameName}${rameSerial}</span>
            <span style="display:flex;gap:6px">
              <button class="btn-sm" onclick="game.ui.renameRame('${jsString(r.id)}')">Renommer</button>
              <button class="btn-sm danger" onclick="game.ui.deleteRame('${jsString(r.id)}')">Supprimer</button>
            </span>
          </div>
          <div class="rame-card-images">
            ${images}
          </div>
          <div class="card-info">
            <b>Long:</b> ${r.totalLength.toFixed(1)}m | <b>Tonnage:</b> ${r.totalTonnage}t |
            <b>Places:</b> ${r.totalCapacity} | <b>Fret:</b> ${r.totalFreightCapacity}t | <b>Vmax:</b> ${r.maxSpeed} km/h |
            <b>Traction:</b> ${escapeHtml(r.traction)}
          </div>
          <div class="card-info" style="font-size:10px;color:var(--text3)">
            <b>Mise en service:</b> ${r.createdDate} | <b>Km parcourus:</b> ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km${r.elementDetails.some(e => e.purchasePrice) ? ` | <b>Valeur:</b> ${r.elementDetails.reduce((s,e) => s + (e.purchasePrice || 0), 0).toLocaleString('fr-FR')} €` : ''}
            ${r.depotId ? `| <b>Dépôt:</b> ${depotName}` : ''}
            ${r.currentLocation ? `| <b>Position:</b> ${locationLabel}` : ''}
          </div>
        </div>
      `}).join('');
      this._applyLiveryImages(container);

      if (pager) {
        if (pages <= 1) { pager.innerHTML = ''; }
        else {
          pager.innerHTML = `
            <button class="btn-sm" ${this._ramesPage === 0 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${this._ramesPage - 1})">‹ Préc.</button>
            <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._ramesPage + 1} / ${pages}</span>
            <button class="btn-sm" ${this._ramesPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${this._ramesPage + 1})">Suiv. ›</button>`;
        }
      }
    },

  ramesPageGo(p) {
      this._ramesPage = p;
      this.renderRamesList();
      document.getElementById('rames-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

  _rameLocationLabel(r) {
      const loc = r.currentLocation || {};
      if (loc.serviceId) {
        const svc = this.game.scheduleCreator.services.find(s => s.id === loc.serviceId);
        if (svc) return `En service ${svc.name} (${svc.state || ''})`;
      }
      if (loc.stationId) {
        const st = this.game.world.getStationById(loc.stationId);
        if (st) return `Gare ${st.name}`;
      }
      if (loc.depotId) {
        const d = this.game.depotManager.getDepotById?.(loc.depotId);
        if (d) return `Dépôt ${d.name}`;
      }
      if (loc.lat != null && loc.lon != null) return `Route (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})`;
      return 'Inconnue';
    },

  deleteRame(id) {
      if (!confirm('Supprimer cette rame ?')) return;
      this.game.rameManager.remove(id);
      this.game.saveState();
      this.renderRamesList();
    },

  renameRame(id) {
      const r = this.game.rameManager.getById(id);
      if (!r) return;
      const name = prompt('Nouveau nom de la rame :', r.name);
      if (name && name.trim()) {
        r.name = name.trim();
        this.game.saveState();
        this.renderRamesList();
      }
    },

  setupLiveryPage() {
      document.getElementById('btn-upload-page-livery')?.addEventListener('click', () => this.uploadLiveryPage());
      document.getElementById('livery-page-file')?.addEventListener('change', () => this.uploadLiveryPage());
      this._setupLiveryBaseStockSearch();
    },

  _setupLiveryBaseStockSearch() {
      if (this._liverySearchAttached) return;
      const input = document.getElementById('livery-page-base-stock-input');
      const hidden = document.getElementById('livery-page-base-stock');
      const results = document.getElementById('livery-base-stock-results');
      if (!input || !hidden || !results) return;
      this._liverySearchAttached = true;
      const show = (filter = '') => {
        const q = filter.toLowerCase().trim();
        const stock = this.game.rollingStock.getAll() || [];
        const filtered = stock.filter(i => `${i.name || ''} ${i.category || ''} ${i.id || ''}`.toLowerCase().includes(q)).slice(0, 50);
        if (filtered.length === 0) { results.style.display = 'none'; return; }
        results.innerHTML = filtered.map(i => `<div class="livery-base-stock-item" data-id="${escapeHtml(String(i.id))}" data-name="${escapeHtml(i.name)}" style="padding:6px 10px;cursor:pointer;color:#fff;border-bottom:1px solid #222;font-size:12px">${escapeHtml(i.name)} <span style="color:#888">(${escapeHtml(i.category || '')})</span></div>`).join('');
        results.style.display = 'block';
        results.querySelectorAll('.livery-base-stock-item').forEach(el => {
          el.addEventListener('mousedown', e => {
            e.preventDefault();
            hidden.value = el.getAttribute('data-id');
            input.value = el.getAttribute('data-name');
            results.style.display = 'none';
          });
        });
      };
      input.addEventListener('focus', () => show(input.value));
      input.addEventListener('input', () => show(input.value));
      input.addEventListener('keydown', e => { if (e.key === 'Escape') results.style.display = 'none'; });
      input.addEventListener('blur', () => setTimeout(() => results.style.display = 'none', 150));
    },

  async uploadLiveryPage() {
      const fileInput = document.getElementById('livery-page-file');
      const nameInput = document.getElementById('livery-page-name');
      const baseSel = document.getElementById('livery-page-base-stock');
      const baseInput = document.getElementById('livery-page-base-stock-input');
      const file = fileInput?.files?.[0];
      const name = (nameInput?.value || file?.name || '').trim();
      const baseStockId = baseSel?.value || '';
      if (!file) return alertToast('Choisissez une image');
      if (!name) return alertToast('Nommez la livrée');
      if (!baseStockId) return alertToast('Sélectionnez le matériel d\'origine');
      const baseItem = this.game.rollingStock.getById(baseStockId);
      try {
        await this.game.liveryManager.upload(file, name, baseStockId, baseItem?.name || '');
        fileInput.value = '';
        nameInput.value = '';
        baseSel.value = '';
        if (baseInput) baseInput.value = '';
        alertToast('Livrée uploadée');
        this.renderLiveriesPage();
      } catch (e) {
        alertToast('Erreur upload : ' + e.message);
      }
    },

  async renderLiveriesPage() {
      const container = document.getElementById('liveries-list');
      if (!container) return;
      this._setupLiveryBaseStockSearch();
      try {
        const liveries = await this.game.liveryManager.list();
        if (liveries.length === 0) {
          container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune livrée. Uploadez une image ci-dessus.</p>';
          return;
        }
        const rames = this.game.rameManager.getAll();
        const cards = [];
        for (const l of liveries) {
          const usedBy = rames.filter(r => String(r.liveryId) === String(l.id));
          const rameList = usedBy.length
            ? `<div style="margin-top:6px;font-size:11px;color:var(--text2)">Utilisée par : ${usedBy.map(r => escapeHtml(r.name)).join(', ')}</div>`
            : '<div style="margin-top:6px;font-size:11px;color:var(--text3)">Non utilisée</div>';
          const baseName = escapeHtml(l.base_stock_name || this.game.rollingStock.getById(l.base_stock_id)?.name || l.base_stock_id || 'Inconnu');
          cards.push(`
            <div class="livery-card" style="border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg2);display:flex;flex-direction:column;gap:6px">
              <div style="height:100px;background:var(--bg1);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden">
                <img data-livery-id="${Number(l.id)}" src="" style="max-width:100%;max-height:100%;object-fit:contain" alt="${escapeHtml(l.name)}">
              </div>
              <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.name)}</div>
              <div style="font-size:11px;color:var(--text2)">Sur : ${baseName}</div>
              <div style="font-size:10px;color:var(--text3)">${(l.size / 1024).toFixed(1)} kB</div>
              ${rameList}
              <button class="btn-sm danger" onclick="game.ui.deleteLiveryPage(${Number(l.id)})">Supprimer</button>
            </div>
          `);
        }
        container.innerHTML = cards.join('');
        this._applyLiveryImages(container);
      } catch (e) {
        console.warn('renderLiveriesPage error:', e);
        container.innerHTML = '<p style="color:var(--red);text-align:center;padding:40px">Erreur de chargement des livrées.</p>';
      }
    },

  async _applyLiveryImages(container) {
      if (!container) return;
      const imgs = container.querySelectorAll('img[data-livery-id]');
      for (const img of imgs) {
        const id = img.getAttribute('data-livery-id');
        if (!id) continue;
        try {
          const url = await this.game.liveryManager.loadImage(id);
          if (url) img.src = url;
        } catch (e) {
          console.warn('Livery image load failed:', e);
        }
      }
    },

  async deleteLiveryPage(id) {
      if (!confirm('Supprimer cette livrée ?')) return;
      try {
        await this.game.liveryManager.delete(id);
        // Dissociate from rames
        for (const r of this.game.rameManager.getAll()) {
          if (String(r.liveryId) === String(id)) {
            r.liveryId = '';
            r.liveryName = '';
          }
        }
        this.game.saveState();
        this.renderLiveriesPage();
        this.renderRamesList();
      } catch (e) {
        alertToast('Erreur suppression : ' + e.message);
      }
    },

  setupLinePage() {
      document.getElementById('btn-new-line')?.addEventListener('click', () => this.openLineModal());
      document.getElementById('btn-save-line')?.addEventListener('click', () => this.saveLine());
      document.getElementById('btn-line-manual')?.addEventListener('click', () => this._toggleLineManual());
      document.getElementById('btn-line-clear-manual')?.addEventListener('click', () => this._clearLineManual());
      document.getElementById('btn-line-finish-manual')?.addEventListener('click', () => this._finishLineManual());
      this.lineStops = [];
      this.lineMapCenter = null;
      this.lineMapScale = null;
      this._editingLineId = null;
      this._lineManualMode = false;
      this._lineManualSegmentIndex = -1;
      this._lineManualPoints = [];
      this._lineManualRoute = null;
      this._lineManualDrag = null;
      this._lineManualRoutes = [];
      this._lineManualVoie = {};

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

      // Section V — Sillons automatiques
      document.getElementById('btn-new-sillon')?.addEventListener('click', () => this.openSillonCreator());
      document.getElementById('btn-save-sillon')?.addEventListener('click', () => this.saveSillon());
      document.getElementById('btn-cancel-sillon')?.addEventListener('click', () => {
        document.getElementById('sillon-creator')?.classList.add('hidden');
        this._resetSillonManual();
      });
      document.getElementById('btn-sillon-manual')?.addEventListener('click', () => this._toggleSillonManualMode());
      document.getElementById('btn-sillon-clear-manual')?.addEventListener('click', () => this._clearSillonManualTrace());
      document.getElementById('btn-sillon-finish-manual')?.addEventListener('click', () => this._finishSillonManual());
      document.getElementById('sillon-from')?.addEventListener('change', () => { this._updateSillonName(); this._syncSillonManualEndpoints(); });
      document.getElementById('sillon-to')?.addEventListener('change', () => { this._updateSillonName(); this._syncSillonManualEndpoints(); });
      document.getElementById('sillon-name')?.addEventListener('input', () => { this._sillonNameTouched = true; });

      const sillonsList = document.getElementById('sillons-list');
      if (sillonsList && !sillonsList._delegated) {
        sillonsList._delegated = true;
        sillonsList.addEventListener('mousedown', (e) => {
          const btn = e.target.closest ? e.target.closest('[data-delete-sillon]') : null;
          if (btn && btn.dataset.deleteSillon) {
            e.preventDefault();
            e.stopPropagation();
            this.deleteSillon(btn.dataset.deleteSillon);
          }
        });
      }
    },

  async saveStationFromLines() {
      const name = document.getElementById('lsc-name')?.value.trim();
      let lat = parseFloat(document.getElementById('lsc-lat')?.value);
      let lon = parseFloat(document.getElementById('lsc-lon')?.value);
      const type = document.getElementById('lsc-type')?.value || 'voyageur';
      const platforms = parseInt(document.getElementById('lsc-platforms')?.value) || 4;

      if (!name) return alertToast('Nom de gare requis');
      if (isNaN(lat) || isNaN(lon)) return alertToast('Latitude et longitude requises');

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
          const electrified = route.some(r => r.electrified === false) ? false : true;
          this.game.world.addTrack({
            stationA: connectTo.id, stationB: station.id,
            distance: Math.round(distance), maxSpeed: avgSpeed,
            electrified, name: `${connectTo.name} - ${name}`,
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
      this.game.renderer?.invalidateStatic();
      this.renderLinesList();
    },

  openLineModal(editLine) {
      this.lineStops = [];
      this._editingLineId = null;
      this.lineMapCenter = null;
      this.lineMapScale = null;
      this._lineManualMode = false;
      this._lineManualSegmentIndex = -1;
      this._lineManualPoints = [];
      this._lineManualRoute = null;
      this._lineManualDrag = null;
      this._lineManualRoutes = [];
      this._lineManualVoie = {};

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
      this._populateLineStationSelect();
      this._setupLineStationSearch();
      setTimeout(() => this.setupLineMap(), 50);
    },

  _populateLineStationSelect(filter = '') {
      const select = document.getElementById('line-station-select');
      if (!select) return;
      const term = filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const stations = (this.game.world.stations || [])
        .filter(st => {
          const name = (st.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return name.includes(term);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      select.innerHTML = stations.map(st => `<option value="${escapeHtml(st.id)}">${escapeHtml(st.name)}</option>`).join('');
      select.dataset.stations = JSON.stringify(stations.map(s => ({ id: s.id, name: s.name })));
    },

  _setupLineStationSearch() {
      const search = document.getElementById('line-station-search');
      const select = document.getElementById('line-station-select');
      const btn = document.getElementById('btn-line-add-station');
      if (search) {
        search.oninput = () => this._populateLineStationSelect(search.value);
      }
      if (btn) {
        btn.onclick = () => {
          const stId = select?.value;
          if (!stId) return;
          const station = this.game.world.getStationById(stId);
          if (station) this.addLineStop(station);
        };
      }
    },

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

      const unproject = (x, y) => {
        const cx = this.lineMapCenter.lon;
        const cy = this.lineMapCenter.lat;
        const scale = this.lineMapScale;
        return {
          lon: cx + (x - canvas.width / 2) * scale,
          lat: cy - (y - canvas.height / 2) * scale,
        };
      };

      const getSegmentStations = (i) => {
        const sa = world.getStationById(this.lineStops[i]?.stationId);
        const sb = world.getStationById(this.lineStops[i + 1]?.stationId);
        return { sa, sb };
      };

      const drawMap = () => {
        const lineColor = document.getElementById('line-color')?.value || '#3b82f6';
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
          const isSegStart = this._lineManualMode && this.lineStops[this._lineManualSegmentIndex]?.stationId === st.id;
          const isSegEnd = this._lineManualMode && this.lineStops[this._lineManualSegmentIndex + 1]?.stationId === st.id;
          ctx.fillStyle = isSegStart || isSegEnd ? '#f59e0b' : (isSelected ? lineColor : '#3b82f6');
          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px sans-serif';
          ctx.fillText(st.name, p.x + 8, p.y + 4);
        }

        // Draw voie points (platforms) when manual mode is active
        if (this._lineManualMode && this.game.voiePointManager) {
          const idx = this._lineManualSegmentIndex;
          const segStartId = this.lineStops[idx]?.stationId;
          const segEndId = this.lineStops[idx + 1]?.stationId;
          for (const vp of this.game.voiePointManager.getAll()) {
            const p = project(vp.lat, vp.lon);
            if (p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) continue;
            const isSeg = vp.stationId === segStartId || vp.stationId === segEndId;
            if (!isSeg) continue;
            const startSel = document.getElementById('line-manual-start-voie')?.value;
            const endSel = document.getElementById('line-manual-end-voie')?.value;
            const isActive = vp.id === startSel || vp.id === endSel;
            ctx.fillStyle = isActive ? '#22c55e' : '#a855f7';
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.PI / 4);
            const sz = isActive ? 5 : 3;
            ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
            ctx.restore();
          }
        }

        // Draw current line route
        const lc = lineColor;
        for (let i = 0; i < this.lineStops.length - 1; i++) {
          const { sa, sb } = getSegmentStations(i);
          if (!sa || !sb) continue;

          const isManualSegment = this._lineManualMode && i === this._lineManualSegmentIndex;
          const storedRoute = this._lineManualRoutes[i];

          if (storedRoute && storedRoute.length >= 2) {
            ctx.strokeStyle = lc;
            ctx.lineWidth = 3;
            ctx.beginPath();
            const p0 = project(storedRoute[0].lat, storedRoute[0].lon);
            ctx.moveTo(p0.x, p0.y);
            for (let j = 1; j < storedRoute.length; j++) {
              const p = project(storedRoute[j].lat, storedRoute[j].lon);
              ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
          } else if (isManualSegment && this._lineManualRoute && this._lineManualRoute.length >= 2) {
            ctx.strokeStyle = lc;
            ctx.lineWidth = 3;
            ctx.beginPath();
            const p0 = project(this._lineManualRoute[0].lat, this._lineManualRoute[0].lon);
            ctx.moveTo(p0.x, p0.y);
            for (let j = 1; j < this._lineManualRoute.length; j++) {
              const p = project(this._lineManualRoute[j].lat, this._lineManualRoute[j].lon);
              ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
          } else {
            const track = world.getTrackBetween(sa.id, sb.id);
            if (track && track.route && track.route.length > 1) {
              ctx.strokeStyle = lc;
              ctx.lineWidth = 3;
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
              ctx.strokeStyle = lc;
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 4]);
              ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // Draw manual control points
        if (this._lineManualMode && this._lineManualRoute && this._lineManualRoute.length >= 2) {
          for (let i = 0; i < this._lineManualRoute.length; i++) {
            const pt = this._lineManualRoute[i];
            if (!pt.control) continue;
            const p = project(pt.lat, pt.lon);
            const isEnd = (i === 0 || i === this._lineManualRoute.length - 1);
            ctx.fillStyle = isEnd ? '#f59e0b' : '#38bdf8';
            ctx.beginPath(); ctx.arc(p.x, p.y, isEnd ? 6 : 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            if (!isEnd) {
              ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 2; ctx.stroke();
            }
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

      const findNearestManualPoint = (x, y) => {
        if (!this._lineManualMode) return -1;
        let bestIdx = -1, bestD = Infinity;
        for (let i = 0; i < this._lineManualPoints.length; i++) {
          const p = project(this._lineManualPoints[i].lat, this._lineManualPoints[i].lon);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestD = d; bestIdx = i; }
        }
        return bestD <= 12 ? bestIdx : -1;
      };

      const isNearStation = (x, y, radius = 14) => {
        for (const st of world.stations) {
          const p = project(st.lat, st.lon);
          if (Math.hypot(p.x - x, p.y - y) <= radius) return true;
        }
        return false;
      };

      const findNearestSegmentVoiePoint = (x, y, radius = 14) => {
        if (!this._lineManualMode || !this.game.voiePointManager) return null;
        const idx = this._lineManualSegmentIndex;
        const segStartId = this.lineStops[idx]?.stationId;
        const segEndId = this.lineStops[idx + 1]?.stationId;
        if (!segStartId || !segEndId) return null;
        let best = null, bestD = Infinity;
        for (const vp of this.game.voiePointManager.getAll()) {
          if (vp.stationId !== segStartId && vp.stationId !== segEndId) continue;
          const p = project(vp.lat, vp.lon);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD && d < radius) { bestD = d; best = vp; }
        }
        return best;
      };

      canvas.onmousedown = (e) => {
        const x = e.offsetX, y = e.offsetY;
        drag = true;
        dragStart = { x, y };
        totalDragDist = 0;

        if (this._lineManualMode) {
          const idx = findNearestManualPoint(x, y);
          if (idx >= 0) {
            if (e.ctrlKey || e.button === 2) {
              this._lineManualPoints.splice(idx, 1);
              this._rebuildLineManualRoute();
              drawMap();
            } else {
              this._lineManualDrag = { index: idx, startX: x, startY: y, moved: false };
            }
            drag = false; dragStart = null; totalDragDist = 0;
            return;
          }
        }
      };

      canvas.onmousemove = (e) => {
        if (this._lineManualDrag) {
          const dx = e.offsetX - this._lineManualDrag.startX;
          const dy = e.offsetY - this._lineManualDrag.startY;
          if (!this._lineManualDrag.moved && Math.hypot(dx, dy) < 4) return;
          this._lineManualDrag.moved = true;
          const w = unproject(e.offsetX, e.offsetY);
          const snapped = this._snapToTrack(w.lat, w.lon);
          const pt = this._lineManualPoints[this._lineManualDrag.index];
          if (pt) { pt.lat = snapped ? snapped.lat : w.lat; pt.lon = snapped ? snapped.lon : w.lon; }
          this._rebuildLineManualRoute();
          drawMap();
          return;
        }
        if (drag && dragStart) {
          const dx = e.offsetX - dragStart.x;
          const dy = e.offsetY - dragStart.y;
          totalDragDist += Math.abs(dx) + Math.abs(dy);
          this.lineMapCenter.lon -= dx * this.lineMapScale;
          this.lineMapCenter.lat += dy * this.lineMapScale;
          dragStart = { x: e.offsetX, y: e.offsetY };
          drawMap();
          return;
        }
        // Hover feedback
        const x = e.offsetX, y = e.offsetY;
        let cursor = 'default';
        if (this._lineManualMode && findNearestManualPoint(x, y) >= 0) cursor = 'grab';
        else {
          for (const st of world.stations) {
            const p = project(st.lat, st.lon);
            if (Math.hypot(p.x - x, p.y - y) < 16) { cursor = 'pointer'; break; }
          }
        }
        canvas.style.cursor = cursor;
      };

      canvas.onmouseup = (e) => {
        if (this._lineManualDrag) {
          const wasMoved = this._lineManualDrag.moved;
          this._lineManualDrag = null;
          if (wasMoved) { drag = false; dragStart = null; totalDragDist = 0; return; }
        }
        if (totalDragDist < 5) {
          const x = e.offsetX, y = e.offsetY;
          if (this._lineManualMode) {
            if (e.shiftKey) {
              const idx = findNearestManualPoint(x, y);
              if (idx >= 0) {
                this._lineManualPoints.splice(idx, 1);
                this._rebuildLineManualRoute();
                drawMap();
              }
              drag = false; dragStart = null; totalDragDist = 0;
              return;
            }
            const nearVp = findNearestSegmentVoiePoint(x, y);
            if (nearVp) {
              const idx = this._lineManualSegmentIndex;
              if (!this._lineManualVoie) this._lineManualVoie = {};
              if (!this._lineManualVoie[idx]) this._lineManualVoie[idx] = {};
              const segStartId = this.lineStops[idx]?.stationId;
              if (nearVp.stationId === segStartId) this._lineManualVoie[idx].start = nearVp.id;
              else this._lineManualVoie[idx].end = nearVp.id;
              this._populateLineManualVoieSelects();
              this._rebuildLineManualRoute();
              drawMap();
              drag = false; dragStart = null; totalDragDist = 0;
              return;
            }
            if (isNearStation(x, y, 16)) {
              drag = false; dragStart = null; totalDragDist = 0;
              return;
            }
            const w = unproject(x, y);
            const snapped = this._snapToTrack(w.lat, w.lon);
            const pt = snapped || w;
            this._lineManualPoints.push({ lat: pt.lat, lon: pt.lon });
            this._rebuildLineManualRoute();
            drawMap();
          } else {
            let closest = null, minDist = Infinity;
            for (const st of world.stations) {
              const p = project(st.lat, st.lon);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minDist && d < 20) { minDist = d; closest = st; }
            }
            if (closest) this.addLineStop(closest);
          }
        }
        drag = false;
        dragStart = null;
        totalDragDist = 0;
      };

      canvas.ondblclick = (e) => {
        if (!this._lineManualMode) return;
        const idx = findNearestManualPoint(e.offsetX, e.offsetY);
        if (idx >= 0) {
          this._lineManualPoints.splice(idx, 1);
          this._rebuildLineManualRoute();
          drawMap();
        }
      };

      canvas.onwheel = (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.2 : 0.83;
        this.lineMapScale = Math.max(0.002, Math.min(0.2, this.lineMapScale * factor));
        drawMap();
      };

      this._drawLineMap = drawMap;
      this._updateLineManualUI();
    },

  addLineStop(station) {
      if (this._lineManualMode) {
        alertToast('Terminez le tracé manuel du segment avant d\'ajouter une gare.');
        return;
      }
      // Don't add duplicate consecutive stops
      if (this.lineStops.length > 0 && this.lineStops[this.lineStops.length - 1].stationId === station.id) return;

      this.lineStops.push({
        stationId: station.id,
        stationName: station.name,
      });
      this.renderLineStops();
      if (this._drawLineMap) this._drawLineMap();
    },

  removeLineStop(index) {
      this.lineStops.splice(index, 1);
      this._lineManualMode = false;
      this._lineManualSegmentIndex = -1;
      this._lineManualPoints = [];
      this._lineManualRoute = null;
      this._lineManualDrag = null;
      this._lineManualRoutes = this._lineManualRoutes.slice(0, Math.max(0, this.lineStops.length - 1));
      this.renderLineStops();
      this._updateLineManualUI();
      if (this._drawLineMap) this._drawLineMap();
    },

  _getLineManualVoiePoint(idx, which) {
      const voieId = (this._lineManualVoie && this._lineManualVoie[idx] && this._lineManualVoie[idx][which]) || '';
      if (!voieId || !this.game.voiePointManager) return null;
      return this.game.voiePointManager.getVoiePointById(voieId);
    },

  _rebuildLineManualRoute() {
      const idx = this._lineManualSegmentIndex;
      if (idx < 0 || idx >= this.lineStops.length - 1) return;
      const sa = this.game.world.getStationById(this.lineStops[idx].stationId);
      const sb = this.game.world.getStationById(this.lineStops[idx + 1].stationId);
      if (!sa || !sb) return;
      const startVoie = this._getLineManualVoiePoint(idx, 'start');
      const endVoie = this._getLineManualVoiePoint(idx, 'end');
      const start = { lat: startVoie ? startVoie.lat : sa.lat, lon: startVoie ? startVoie.lon : sa.lon, maxSpeed: 160, control: true };
      const end = { lat: endVoie ? endVoie.lat : sb.lat, lon: endVoie ? endVoie.lon : sb.lon, maxSpeed: 160, control: true };
      const controls = this._lineManualPoints.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: 160, control: true }));
      this._lineManualRoute = this._buildManualRoute(start, controls, end, 160);
    },

  _populateLineManualVoieSelects() {
      const idx = this._lineManualSegmentIndex;
      const startSel = document.getElementById('line-manual-start-voie');
      const endSel = document.getElementById('line-manual-end-voie');
      if (!startSel || !endSel || idx < 0 || idx >= this.lineStops.length - 1) return;
      const sa = this.game.world.getStationById(this.lineStops[idx].stationId);
      const sb = this.game.world.getStationById(this.lineStops[idx + 1].stationId);
      const base = '<option value="">Gare (centre)</option>';
      const vpm = this.game.voiePointManager;
      const optsFor = (st) => {
        if (!st || !vpm) return base;
        const vps = vpm.getStationVoiePoints(st.id) || [];
        if (!vps.length) return base;
        return base + vps.map(vp => `<option value="${escapeHtml(vp.id)}">Voie ${escapeHtml(vp.voie)} ${vp.ref ? '(' + escapeHtml(vp.ref) + ')' : ''}</option>`).join('');
      };
      startSel.innerHTML = optsFor(sa);
      endSel.innerHTML = optsFor(sb);
      const cur = (this._lineManualVoie && this._lineManualVoie[idx]) || {};
      startSel.value = cur.start || '';
      endSel.value = cur.end || '';
      const onChange = () => {
        if (!this._lineManualVoie) this._lineManualVoie = {};
        this._lineManualVoie[idx] = { start: startSel.value, end: endSel.value };
        this._rebuildLineManualRoute();
        if (this._drawLineMap) this._drawLineMap();
      };
      startSel.onchange = onChange;
      endSel.onchange = onChange;
    },

  _toggleLineManual() {
      if (this._lineManualMode) {
        this._lineManualMode = false;
        this._lineManualSegmentIndex = -1;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        this._lineManualDrag = null;
      } else {
        if (this.lineStops.length < 2) return alertToast('Il faut au moins 2 gares pour tracer un segment.');
        const idx = this.lineStops.length - 2;
        this._lineManualSegmentIndex = idx;
        const route = this._lineManualRoutes[idx];
        if (route && route.length >= 2) {
          this._lineManualPoints = route.filter((p, i) => p.control && i !== 0 && i !== route.length - 1).map(p => ({ lat: p.lat, lon: p.lon }));
        } else {
          this._lineManualPoints = [];
        }
        this._lineManualMode = true;
        this._populateLineManualVoieSelects();
        this._rebuildLineManualRoute();
      }
      this._updateLineManualUI();
      if (this._drawLineMap) this._drawLineMap();
    },

  _clearLineManual() {
      if (this._lineManualSegmentIndex >= 0) this._lineManualRoutes[this._lineManualSegmentIndex] = null;
      this._lineManualPoints = [];
      this._lineManualRoute = null;
      if (this._drawLineMap) this._drawLineMap();
    },

  _finishLineManual() {
      if (!this._lineManualMode) return;
      this._rebuildLineManualRoute();
      if (!this._lineManualRoute || this._lineManualRoute.length < 2) {
        alertToast('Tracé invalide. Ajoutez au moins un point intermédiaire.');
        return;
      }
      this._lineManualRoutes[this._lineManualSegmentIndex] = this._lineManualRoute;
      this._lineManualMode = false;
      this._lineManualSegmentIndex = -1;
      this._lineManualPoints = [];
      this._lineManualRoute = null;
      this._lineManualDrag = null;
      this._updateLineManualUI();
      if (this._drawLineMap) this._drawLineMap();
    },

  _updateLineManualUI() {
      const manual = document.getElementById('btn-line-manual');
      const clear = document.getElementById('btn-line-clear-manual');
      const finish = document.getElementById('btn-line-finish-manual');
      const hint = document.getElementById('line-manual-hint');
      const voieRow = document.getElementById('line-voie-row');
      if (manual) {
        manual.textContent = this._lineManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement le segment';
        manual.classList.toggle('active', this._lineManualMode);
        manual.disabled = this.lineStops.length < 2 && !this._lineManualMode;
      }
      if (clear) clear.classList.toggle('hidden', !this._lineManualMode);
      if (finish) finish.classList.toggle('hidden', !this._lineManualMode);
      if (voieRow) voieRow.classList.toggle('hidden', !this._lineManualMode);
      if (this._lineManualMode) this._populateLineManualVoieSelects();
      if (hint) {
        if (this._lineManualMode) {
          hint.textContent = 'Cliquez pour ajouter des points entre les deux points de voie. Glissez pour déplacer. Ctrl / clic droit / double-clic pour supprimer.';
        } else {
          hint.textContent = this.lineStops.length >= 2 ? 'Vous pouvez tracer manuellement le dernier segment pour remplacer le calcul ORM.' : 'Ajoutez au moins 2 gares pour tracer un segment.';
        }
      }
    },

  renderLineStops() {
      const container = document.getElementById('line-stops-list');
      if (!container) return;
      if (this.lineStops.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte pour definir la ligne</p>';
        return;
      }
      container.innerHTML = this.lineStops.map((stop, i) => {
        const isShared = i > 0 ? !!this.game.world.getTrackBetween(this.lineStops[i - 1].stationId, stop.stationId) : false;
        const hasManual = i > 0 && this._lineManualRoutes[i - 1];
        const manualLabel = hasManual ? '<span style="color:#38bdf8;font-size:9px"> (tracé manuel)</span>' : '';
        const sharedInfo = (i > 0 && isShared) ? '<span style="color:#16a34a;font-size:9px"> (troncon existant)</span>' : (i > 0 ? '<span style="color:#f59e0b;font-size:9px"> (nouveau troncon)</span>' : '');
        return `
          <div class="sched-stop-row">
            <span style="color:var(--text3);font-size:10px;width:16px">${i + 1}</span>
            <span class="stop-name">${stop.stationName}${sharedInfo}${manualLabel}</span>
            <button class="btn-remove-stop" onclick="game.ui.removeLineStop(${i})">x</button>
          </div>
        `;
      }).join('');
    },

  async saveLine() {
      const name = document.getElementById('line-name').value.trim();
      if (!name) return alertToast('Nom requis');
      if (this.lineStops.length < 2) return alertToast('Il faut au moins 2 gares');
      if (this._lineManualMode) this._finishLineManual();
      if (this._lineManualMode) return;

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
            const manualRoute = this._lineManualRoutes[i];
            if (manualRoute && manualRoute.length >= 2) {
              const distance = this.game.orm.getRouteDistance(manualRoute);
              const speeds = manualRoute.filter(r => r.maxSpeed).map(r => r.maxSpeed);
              const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
              const electrified = manualRoute.some(r => r.electrified === false) ? false : true;
              const track = this.game.world.addTrack({
                stationA: stA.id, stationB: stB.id,
                distance: Math.round(distance), maxSpeed: avgSpeed,
                electrified, name: `${stA.name} - ${stB.name}`, route: manualRoute,
              });
              trackIds.push(track.id);
            } else {
              let existing = this.game.world.getTrackBetween(stA.id, stB.id);
              if (existing) {
                trackIds.push(existing.id);
              } else {
                try {
                  const route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
                  const distance = this.game.orm.getRouteDistance(route);
                  const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
                  const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
                  const electrified = route.some(r => r.electrified === false) ? false : true;
                  const track = this.game.world.addTrack({
                    stationA: stA.id, stationB: stB.id,
                    distance: Math.round(distance), maxSpeed: avgSpeed,
                    electrified, name: `${stA.name} - ${stB.name}`, route,
                  });
                  trackIds.push(track.id);
                } catch (e) {
                  const dist = Math.round(Math.sqrt(Math.pow((stB.lat - stA.lat) * 111, 2) + Math.pow((stB.lon - stA.lon) * 111 * Math.cos(stA.lat * Math.PI / 180), 2)));
                  const track = this.game.world.addTrack({ stationA: stA.id, stationB: stB.id, distance: dist, maxSpeed: 160, name: `${stA.name} - ${stB.name}` });
                  trackIds.push(track.id);
                }
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
          { name, color, code, stops, manualRoutes: this._lineManualRoutes },
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
      this.game.renderer?.invalidateStatic();
    },

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
                const safeName = escapeHtml(st.name);
                const title = `${st.lat.toFixed(4)}, ${st.lon.toFixed(4)} | ${st.platforms || '?'} voies${st.closed ? ' | FERMEE' : ''}`;
                return `<span class="line-stop-tag" style="font-size:10px;cursor:pointer;${st.closed ? 'opacity:0.6;' : ''}" title="${escapeHtml(title)}" onclick="game.ui.editStationFromLines('${jsString(st.id)}')">${safeName} <span style="color:var(--text3);font-size:9px">${typeLabel}</span>${closedTag}</span>`;
              }).join('')}
            </div>
          `;
        } else {
          stationsContainer.innerHTML = '';
        }
      }

      // TRV-07 — état du réseau (lignes, usure, incidents)
      const networkContainer = document.getElementById('network-state');
      if (networkContainer) {
        const troncons = this.game.voiePointManager?.troncons || [];
        const avgWear = troncons.length > 0 ? (troncons.reduce((s, t) => s + (t.wear || 0), 0) / troncons.length).toFixed(1) : '0';
        const maxWear = troncons.length > 0 ? Math.max(...troncons.map(t => t.wear || 0)).toFixed(1) : '0';
        const closedTracks = troncons.filter(t => t.closed).length;
        const lineRows = this.game.lineManager.getAll().map(line => {
          const stA = this.game.world.getStationById(line.stops[0]);
          const stB = this.game.world.getStationById(line.stops[line.stops.length - 1]);
          const label = escapeHtml((stA?.name || '?') + ' ↔ ' + (stB?.name || '?'));
          const tracks = line.trackIds.map(id => this.game.world.tracks.find(t => t.id === id) || this.game.voiePointManager?.getTronconById(id)).filter(Boolean);
          const wear = tracks.length ? (tracks.reduce((s, t) => s + (t.wear || 0), 0) / tracks.length).toFixed(1) : '-';
          const incidents = this.game.incidentManager?.getActiveIncidentsOnLine(line.stops) || [];
          const status = incidents.length ? '<span style="color:#ef4444">Perturbé</span>' : '<span style="color:#22c55e">Ouvert</span>';
          return `<div class="dash-train-row" style="grid-template-columns:2fr 2fr 1fr 1fr"><span>${escapeHtml(line.name)}</span><span style="color:var(--text3);font-size:10px">${label}</span><span>${wear}%</span><span>${status}</span></div>`;
        }).join('') || '<div style="padding:8px;color:var(--text3)">Aucune ligne</div>';
        networkContainer.innerHTML = `
          <h3 style="margin:0 0 8px;font-size:13px">Etat du reseau</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
            <span>Troncons : <b>${troncons.length}</b></span>
            <span>Usure moyenne : <b>${avgWear}%</b></span>
            <span>Usure max : <b style="color:${parseFloat(maxWear) > 50 ? '#ef4444' : '#22c55e'}">${maxWear}%</b></span>
            ${closedTracks ? `<span style="color:#ef4444">Fermes : ${closedTracks}</span>` : ''}
          </div>
          <div class="dash-train-table" style="margin-top:8px">
            <div class="dash-train-header" style="grid-template-columns:2fr 2fr 1fr 1fr"><span>Ligne</span><span>Axe A↔B</span><span>Usure</span><span>Etat</span></div>
            ${lineRows}
          </div>
        `;
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
          return escapeHtml(st ? st.name : stId);
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

        const safeLineIdJs = jsString(line.id);
        const safeLineName = escapeHtml(line.name);
        const safeLineCode = line.code ? `[${escapeHtml(line.code)}] ` : '';
        return `
          <div class="line-item" style="border-left:4px solid ${escapeHtml(line.color)}">
            <div class="line-item-header">
              <span class="line-item-name" style="color:${escapeHtml(line.color)}">${safeLineCode}${safeLineName}</span>
              <span style="color:var(--text3);font-size:10px">${Math.round(totalDist)} km | ${line.stops.length} gares${sharedCount > 0 ? ' | ' + sharedCount + ' troncon(s) partage(s)' : ''}</span>
              <button class="btn-sm" onclick="game.ui.editLine('${safeLineIdJs}')">Modifier</button>
              <button class="btn-sm danger" onclick="game.ui.deleteLine('${safeLineIdJs}')">Supprimer</button>
            </div>
            <div class="line-route-preview">
              ${stopsPreview.map((name, i) =>
                `<span class="line-stop-tag">${name}</span>${i < stopsPreview.length - 1 ? '<span style="color:var(--text3)"> → </span>' : ''}`
              ).join('')}
            </div>
          </div>
        `;
      }).join('');

      this.renderSillonsList();
    },

  editStationFromLines(stationId) {
      const station = this.game.world.getStationById(stationId);
      if (station) this.openEditStationModal(station);
    },

  editLine(id) {
      const line = this.game.lineManager.getLine(id);
      if (line) this.openLineModal(line);
    },

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
    },

  openSillonCreator() {
      const creator = document.getElementById('sillon-creator');
      if (!creator) return;
      const fromSel = document.getElementById('sillon-from');
      const toSel = document.getElementById('sillon-to');
      const opts = this.game.world.stations.map(st => `<option value="${escapeHtml(st.id)}">${escapeHtml(st.name)}</option>`).join('');
      if (fromSel) fromSel.innerHTML = '<option value="">—</option>' + opts;
      if (toSel) toSel.innerHTML = '<option value="">—</option>' + opts;
      this._resetSillonManual();
      this._sillonNameTouched = false;
      this._updateSillonName();
      this._updateSillonManualUI();
      creator.classList.remove('hidden');
      // Le canvas a besoin d'un reflow pour avoir une taille ; on initialise la carte au prochain frame.
      requestAnimationFrame(() => this.setupSillonMap());
    },

  async saveSillon() {
      const name = document.getElementById('sillon-name')?.value.trim();
      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      if (!name) return alertToast('Nom requis');
      if (!fromId || !toId) return alertToast('Sélectionnez les gares A et B');
      if (fromId === toId) return alertToast('Les gares doivent être différentes');

      const stA = this.game.world.getStationById(fromId);
      const stB = this.game.world.getStationById(toId);
      if (!stA || !stB) return alertToast('Gares invalides');

      // If the player traced points but did not click "Finish", auto-finalize on save.
      if (this._sillonManualPoints && this._sillonManualPoints.length > 0 && this._sillonManualStart && this._sillonManualEnd) {
        this._rebuildSillonManualRoute();
      }

      const loadingEl = document.getElementById('sillon-creator-loading');
      if (loadingEl) loadingEl.classList.remove('hidden');

      let route = null;
      let distance = 0;
      let maxSpeed = 160;
      let electrified = true;

      if (this._sillonManualRoute && this._sillonManualRoute.length >= 2) {
        route = this._sillonManualRoute;
      } else {
        try {
          route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
        } catch (e) {
          console.warn('ORM route failed for sillon', e);
        }
        if (!route || route.length < 2) {
          if (loadingEl) loadingEl.classList.add('hidden');
          return alertToast('Impossible de calculer un itineraire ferroviaire entre ces gares. Vérifiez le réseau ORM ou utilisez le tracé manuel.');
        }
        distance = this.game.orm.getRouteDistance(route);
        const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
        maxSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160;
        electrified = route.some(r => r.electrified === false) ? false : true;
        route = this.game.orm.getRouteSegments(route).map(s => ({ lat: s.from.lat, lon: s.from.lon, maxSpeed: s.maxSpeed })).concat([{ lat: route[route.length - 1].lat, lon: route[route.length - 1].lon, maxSpeed: route[route.length - 1].maxSpeed || 160 }]);
      }

      if (route && route.length >= 2) {
        distance = this.game.orm.getRouteDistance(route);
        const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
        maxSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160;
        electrified = route.some(r => r.electrified === false) ? false : true;
      }

      this.game.sillonManager.add({
        name,
        fromStationId: fromId,
        toStationId: toId,
        fromStationName: stA.name,
        toStationName: stB.name,
        route,
        distance,
        maxSpeed,
        electrified,
      });

      if (loadingEl) loadingEl.classList.add('hidden');
      document.getElementById('sillon-creator')?.classList.add('hidden');
      this._resetSillonManual();
      this.renderLinesList();
      this.game.saveState();
    },

  renderSillonsList() {
      const container = document.getElementById('sillons-list');
      if (!container) return;
      const sillons = this.game.sillonManager.getAll();
      if (sillons.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:20px">Aucun sillon automatique. Créez-en un pour accélérer les horaires.</p>';
        return;
      }
      container.innerHTML = sillons.map(s => `
        <div class="sillon-item">
          <div>
            <b>${s.name}</b> — ${s.fromStationName} → ${s.toStationName}<br>
            <span>${Math.round(s.distance)} km · Vmax ${s.maxSpeed} km/h · ${s.electrified !== false ? 'électrifié' : 'non électrifié'}</span>
          </div>
          <button class="btn-sm danger" data-delete-sillon="${s.id}" title="Supprimer le sillon">✕</button>
        </div>
      `).join('');
    },

  deleteSillon(id) {
      if (!confirm('Supprimer ce sillon ?')) return;
      this.game.sillonManager.remove(id);
      this.renderLinesList();
      this.game.saveState();
    },

  _updateSillonName() {
      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      const nameInput = document.getElementById('sillon-name');
      if (!fromId || !toId || !nameInput) return;
      if (this._sillonNameTouched) return;
      const next = this.game.sillonManager.getNextName(fromId, toId);
      const current = nameInput.value.trim();
      if (!current) {
        nameInput.value = next;
      }
    },

  _resetSillonManual() {
      this._sillonManualMode = false;
      this._sillonManualStart = null;
      this._sillonManualEnd = null;
      this._sillonManualPoints = [];
      this._sillonManualRoute = null;
      this._sillonManualDrag = null;
    },

  _syncSillonManualEndpoints() {
      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      const fromSt = fromId ? this.game.world.getStationById(fromId) : null;
      const toSt = toId ? this.game.world.getStationById(toId) : null;
      if (fromSt) this._sillonManualStart = { lat: fromSt.lat, lon: fromSt.lon, id: fromSt.id, name: fromSt.name };
      else this._sillonManualStart = null;
      if (toSt) this._sillonManualEnd = { lat: toSt.lat, lon: toSt.lon, id: toSt.id, name: toSt.name };
      else this._sillonManualEnd = null;
      if (this._sillonTileMap) {
        if (fromSt && toSt) {
          this._sillonTileMap.centerLat = (fromSt.lat + toSt.lat) / 2;
          this._sillonTileMap.centerLon = (fromSt.lon + toSt.lon) / 2;
          const cosLat = Math.cos(this._sillonTileMap.centerLat * Math.PI / 180);
          const latSpan = Math.abs(fromSt.lat - toSt.lat) + 0.05;
          const lonSpan = Math.abs(fromSt.lon - toSt.lon) * cosLat + 0.05;
          const spanDeg = Math.max(latSpan, lonSpan);
          this._sillonTileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg) + 1));
        } else if (fromSt) {
          this._sillonTileMap.centerLat = fromSt.lat;
          this._sillonTileMap.centerLon = fromSt.lon;
          this._sillonTileMap.zoomLevel = 10;
        }
      }
      if (this._sillonManualMode) this._rebuildSillonManualRoute();
      if (this._drawSillonMap) this._drawSillonMap();
    },

  _rebuildSillonManualRoute() {
      if (!this._sillonManualStart || !this._sillonManualEnd) return;
      const start = { lat: this._sillonManualStart.lat, lon: this._sillonManualStart.lon, maxSpeed: 160 };
      const end = { lat: this._sillonManualEnd.lat, lon: this._sillonManualEnd.lon, maxSpeed: 160 };
      const controls = this._sillonManualPoints.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: 160 }));
      this._sillonManualRoute = this._buildManualRoute(start, controls, end, 160);
    },

  _toggleSillonManualMode() {
      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      if (!this._sillonManualMode) {
        if (!fromId || !toId) return alertToast('Sélectionnez d\'abord les gares A et B.');
        this._sillonManualMode = true;
        this._syncSillonManualEndpoints();
      } else {
        this._sillonManualMode = false;
        if (!this._sillonManualRoute) this._sillonManualPoints = [];
      }
      this._updateSillonManualUI();
      if (this._drawSillonMap) this._drawSillonMap();
    },

  _finishSillonManual() {
      if (!this._sillonManualMode) return;
      this._rebuildSillonManualRoute();
      if (!this._sillonManualRoute || this._sillonManualRoute.length < 2) return alertToast('Tracé invalide.');
      this._sillonManualMode = false;
      this._updateSillonManualUI();
      if (this._drawSillonMap) this._drawSillonMap();
    },

  _clearSillonManualTrace() {
      this._sillonManualPoints = [];
      this._sillonManualRoute = null;
      this._sillonManualMode = false;
      this._updateSillonManualUI();
      if (this._drawSillonMap) this._drawSillonMap();
    },

  _updateSillonManualUI() {
      const manual = document.getElementById('btn-sillon-manual');
      const clear = document.getElementById('btn-sillon-clear-manual');
      const finish = document.getElementById('btn-sillon-finish-manual');
      const hint = document.getElementById('sillon-manual-hint');
      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      if (manual) {
        manual.textContent = this._sillonManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement';
        manual.classList.toggle('active', this._sillonManualMode);
        manual.disabled = !fromId || !toId;
      }
      if (clear) clear.classList.toggle('hidden', !this._sillonManualMode);
      if (finish) finish.classList.toggle('hidden', !this._sillonManualMode);
      if (hint) {
        if (this._sillonManualMode) hint.textContent = 'Cliquez pour ajouter un point (50 m). Glissez un point pour le déplacer. Ctrl / clic droit / double-clic sur un point pour le supprimer. Cliquez "Terminer" quand le tracé est complet.';
        else if (!fromId || !toId) hint.textContent = 'Sélectionnez les gares A et B, puis cliquez sur "Tracer manuellement" pour dessiner le sillon sur la carte.';
        else if (this._sillonManualRoute) hint.textContent = 'Tracé manuel enregistré. Vous pouvez le refaire avec "Tracer manuellement".';
        else hint.textContent = 'Cliquez sur "Tracer manuellement" pour dessiner le sillon, ou laissez l\'ORM calculer automatiquement.';
      }
    },

  setupSillonMap() {
      if (this._sillonMapInterval) { clearInterval(this._sillonMapInterval); this._sillonMapInterval = null; }
      const canvas = document.getElementById('sillon-map-canvas');
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const ctx = canvas.getContext('2d');
      const world = this.game.world;
      if (!this._sillonTileMap) {
        const mainTileMap = this.game.renderer.tileMap;
        this._sillonTileMap = new mainTileMap.constructor();
      }
      const tileMap = this._sillonTileMap;
      tileMap.viewportWidth = canvas.width;
      tileMap.viewportHeight = canvas.height;

      const fromId = document.getElementById('sillon-from')?.value;
      const toId = document.getElementById('sillon-to')?.value;
      const fromSt = fromId ? world.getStationById(fromId) : null;
      const toSt = toId ? world.getStationById(toId) : null;
      if (fromSt && toSt) {
        tileMap.centerLat = (fromSt.lat + toSt.lat) / 2;
        tileMap.centerLon = (fromSt.lon + toSt.lon) / 2;
        const cosLat = Math.cos(tileMap.centerLat * Math.PI / 180);
        const latSpan = Math.abs(fromSt.lat - toSt.lat) + 0.05;
        const lonSpan = Math.abs(fromSt.lon - toSt.lon) * cosLat + 0.05;
        const spanDeg = Math.max(latSpan, lonSpan);
        tileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg) + 1));
      } else if (fromSt) {
        tileMap.centerLat = fromSt.lat;
        tileMap.centerLon = fromSt.lon;
        tileMap.zoomLevel = 10;
      } else if (world.stations.length > 0) {
        let sumLat = 0, sumLon = 0;
        for (const st of world.stations) { sumLat += st.lat; sumLon += st.lon; }
        tileMap.centerLat = sumLat / world.stations.length;
        tileMap.centerLon = sumLon / world.stations.length;
        tileMap.zoomLevel = world.stations.length > 5 ? 7 : 8;
      } else {
        tileMap.centerLat = 46.8;
        tileMap.centerLon = 2.3;
        tileMap.zoomLevel = 6;
      }

      let drawPending = false;
      const requestDraw = () => {
        if (drawPending) return;
        drawPending = true;
        requestAnimationFrame(() => { drawPending = false; drawMap(); });
      };

      const drawMap = () => {
        const creator = document.getElementById('sillon-creator');
        if (!creator || creator.classList.contains('hidden')) return;
        tileMap.renderTiles(ctx, canvas.width, canvas.height);
        const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
        const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
        const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
        const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
        const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
        const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;

        // Existing sillons (faint)
        for (const s of this.game.sillonManager.getAll()) {
          if (!s.route || s.route.length < 2) continue;
          ctx.strokeStyle = 'rgba(74,222,128,0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(s.route[0].lat, s.route[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < s.route.length; i++) {
            const p = tileMap.worldToScreen(s.route[i].lat, s.route[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }

        // Stations
        for (const st of world.stations) {
          if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon) continue;
          const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
          const isStart = this._sillonManualStart && this._sillonManualStart.id === st.id;
          const isEnd = this._sillonManualEnd && this._sillonManualEnd.id === st.id;
          ctx.fillStyle = isStart ? '#22c55e' : isEnd ? '#f97316' : '#3b82f6';
          ctx.beginPath(); ctx.arc(p.x, p.y, (isStart || isEnd) ? 7 : 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
          if (tileMap.zoomLevel >= 8) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.fillText(st.name, p.x + 8, p.y + 4);
          }
        }

        // Manual trace
        let trace = this._sillonManualRoute;
        if (!trace && this._sillonManualStart && this._sillonManualEnd) {
          const start = { lat: this._sillonManualStart.lat, lon: this._sillonManualStart.lon, maxSpeed: 160 };
          const end = { lat: this._sillonManualEnd.lat, lon: this._sillonManualEnd.lon, maxSpeed: 160 };
          const controls = this._sillonManualPoints.map(p => ({ ...p, maxSpeed: 160 }));
          trace = this._densifyRoute([start, ...controls, end], 0.05);
        }
        if (trace && trace.length >= 2) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(trace[0].lat, trace[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < trace.length; i++) {
            const p = tileMap.worldToScreen(trace[i].lat, trace[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          for (let i = 0; i < trace.length; i++) {
            const pt = trace[i];
            if (!pt.control && i !== 0 && i !== trace.length - 1) continue;
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            const isEnd = (i === 0 || i === trace.length - 1);
            ctx.fillStyle = isEnd ? '#f59e0b' : '#38bdf8';
            ctx.beginPath(); ctx.arc(p.x, p.y, isEnd ? 6 : 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            if (!isEnd) {
              ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 2; ctx.stroke();
            }
          }
        } else if (this._sillonManualStart && this._sillonManualEnd) {
          ctx.strokeStyle = 'rgba(250,204,21,0.4)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          const a = tileMap.worldToScreen(this._sillonManualStart.lat, this._sillonManualStart.lon, canvas.width, canvas.height);
          const b = tileMap.worldToScreen(this._sillonManualEnd.lat, this._sillonManualEnd.lon, canvas.width, canvas.height);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      this._drawSillonMap = drawMap;

      if (canvas._sillonBound) {
        requestDraw();
        return;
      }
      canvas._sillonBound = true;

      let drag = false, dragStart = null, totalDragDist = 0;
      const findNearestManualPoint = (x, y) => {
        let bestIdx = -1, bestD = Infinity;
        for (let i = 0; i < this._sillonManualPoints.length; i++) {
          const p = tileMap.worldToScreen(this._sillonManualPoints[i].lat, this._sillonManualPoints[i].lon, canvas.width, canvas.height);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestD = d; bestIdx = i; }
        }
        return bestD <= 12 ? bestIdx : -1;
      };
      canvas.onmousedown = (e) => {
        const x = e.offsetX, y = e.offsetY;
        drag = true; dragStart = { x, y }; totalDragDist = 0;
        if (this._sillonManualMode && this._sillonManualPoints.length) {
          const idx = findNearestManualPoint(x, y);
          if (idx >= 0) {
            if (e.ctrlKey || e.button === 2) {
              this._sillonManualPoints.splice(idx, 1);
              this._rebuildSillonManualRoute();
              requestDraw();
            } else {
              this._sillonManualDrag = { index: idx, startX: x, startY: y, moved: false };
            }
            drag = false; dragStart = null; totalDragDist = 0;
            return;
          }
        }
      };
      canvas.onmousemove = (e) => {
        if (this._sillonManualDrag) {
          const dx = e.offsetX - this._sillonManualDrag.startX;
          const dy = e.offsetY - this._sillonManualDrag.startY;
          if (!this._sillonManualDrag.moved && Math.hypot(dx, dy) < 4) return;
          this._sillonManualDrag.moved = true;
          const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
          const snapped = this._snapToTrack(w.lat, w.lon);
          const pt = this._sillonManualPoints[this._sillonManualDrag.index];
          if (pt) { pt.lat = snapped ? snapped.lat : w.lat; pt.lon = snapped ? snapped.lon : w.lon; }
          this._rebuildSillonManualRoute();
          requestDraw();
          return;
        }
        if (drag && dragStart) {
          const dx = e.offsetX - dragStart.x;
          const dy = e.offsetY - dragStart.y;
          totalDragDist += Math.abs(dx) + Math.abs(dy);
          tileMap.pan(dx, dy);
          dragStart = { x: e.offsetX, y: e.offsetY };
          requestDraw();
          return;
        }
        // Hover feedback
        const x = e.offsetX, y = e.offsetY;
        let cursor = 'default';
        if (this._sillonManualMode && findNearestManualPoint(x, y) >= 0) cursor = 'grab';
        else {
          for (const st of world.stations) {
            const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
            if (Math.hypot(p.x - x, p.y - y) < 16) { cursor = 'pointer'; break; }
          }
        }
        canvas.style.cursor = cursor;
      };
      canvas.onmouseup = (e) => {
        if (this._sillonManualDrag) {
          const wasMoved = this._sillonManualDrag.moved;
          this._sillonManualDrag = null;
          if (wasMoved) { drag = false; dragStart = null; totalDragDist = 0; return; }
        }
        if (totalDragDist < 5) {
          const x = e.offsetX, y = e.offsetY;
          if (this._sillonManualMode) {
            if (e.shiftKey) {
              const idx = findNearestManualPoint(x, y);
              if (idx >= 0) {
                this._sillonManualPoints.splice(idx, 1);
                this._rebuildSillonManualRoute();
                requestDraw();
              }
              drag = false; dragStart = null; totalDragDist = 0;
              return;
            }
            const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
            if (!this._sillonManualStart || !this._sillonManualEnd) return;
            const snapped = this._snapToTrack(worldPos.lat, worldPos.lon);
            const pt = snapped || worldPos;
            this._sillonManualPoints.push({ lat: pt.lat, lon: pt.lon });
            this._rebuildSillonManualRoute();
            requestDraw();
          } else {
            let closest = null, minDist = Infinity;
            for (const st of world.stations) {
              const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minDist && d < 20) { minDist = d; closest = st; }
            }
            if (closest) {
              const fromSel = document.getElementById('sillon-from');
              const toSel = document.getElementById('sillon-to');
              if (fromSel && !fromSel.value) {
                fromSel.value = closest.id;
                this._updateSillonName();
                this._syncSillonManualEndpoints();
              } else if (toSel && !toSel.value) {
                toSel.value = closest.id;
                this._updateSillonName();
                this._syncSillonManualEndpoints();
              }
            }
          }
        }
        drag = false; dragStart = null; totalDragDist = 0;
      };
      // Double-click a manual point to delete it (same as schedule-creator node delete gesture)
      canvas.ondblclick = (e) => {
        if (!this._sillonManualMode) return;
        const idx = findNearestManualPoint(e.offsetX, e.offsetY);
        if (idx >= 0) {
          this._sillonManualPoints.splice(idx, 1);
          this._rebuildSillonManualRoute();
          requestDraw();
        }
      };
      canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
      canvas.oncontextmenu = (e) => { e.preventDefault(); };

      this._sillonMapInterval = setInterval(() => {
        if (document.getElementById('sillon-creator')?.classList.contains('hidden')) return;
        requestDraw();
      }, 250);

      requestDraw();
    },

  setupITEPage() {
      document.getElementById('btn-create-ite')?.addEventListener('click', () => this.openITECreation());
      document.getElementById('btn-ite-finish-track')?.addEventListener('click', () => this._finishITETrack());
      document.getElementById('btn-save-ite')?.addEventListener('click', () => this.saveITE());
      document.getElementById('modal-ite')?.querySelector('.modal-close')?.addEventListener('click', () => this._closeITECreator());
    },

  openITECreation() {
      this.iteCreationMode = true;
      this._pendingITE = { lat: null, lon: null, tracks: [] };
      this._iteTrackPoints = [];
      this._showPickHint('Cliquez sur la carte pour placer l\'ITE');
      const canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.cursor = 'crosshair';
    },

  _closeITECreator() {
      this.iteCreationMode = false;
      this._pendingITE = null;
      this._iteTrackPoints = [];
      if (this._iteMapInterval) { clearInterval(this._iteMapInterval); this._iteMapInterval = null; }
      this._iteMapTileMap = null;
      const canvas = document.getElementById('game-canvas');
      if (canvas) canvas.style.cursor = 'grab';
      this._hidePickHint();
      document.getElementById('modal-ite')?.classList.add('hidden');
    },

  openItemModal(lat, lon) {
      const modal = document.getElementById('modal-ite');
      if (!modal) return;
      document.getElementById('ite-lat').value = lat;
      document.getElementById('ite-lon').value = lon;
      document.getElementById('ite-name').value = '';
      document.getElementById('ite-type').value = 'ite-fret';
      document.getElementById('ite-tracks').value = 2;
      document.getElementById('ite-cost').value = 50000;
      document.querySelectorAll('.ite-cargo').forEach(cb => cb.checked = false);
      document.getElementById('ite-track-name').value = '';
      this._pendingITE = { lat, lon, tracks: [] };
      this._iteTrackPoints = [];
      this._updateITETrackUI();
      modal.classList.remove('hidden');
      requestAnimationFrame(() => this.setupITEMap());
    },

  setupITEMap() {
      if (this._iteMapInterval) { clearInterval(this._iteMapInterval); this._iteMapInterval = null; }
      const canvas = document.getElementById('ite-map-canvas');
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const ctx = canvas.getContext('2d');
      if (!this._iteMapTileMap) {
        const mainTileMap = this.game.renderer.tileMap;
        this._iteMapTileMap = new mainTileMap.constructor();
      }
      const tileMap = this._iteMapTileMap;
      tileMap.viewportWidth = canvas.width;
      tileMap.viewportHeight = canvas.height;
      const lat = parseFloat(document.getElementById('ite-lat')?.value);
      const lon = parseFloat(document.getElementById('ite-lon')?.value);
      if (!isNaN(lat) && !isNaN(lon)) {
        tileMap.centerLat = lat;
        tileMap.centerLon = lon;
        tileMap.zoomLevel = 15;
      } else {
        tileMap.centerLat = 46.8; tileMap.centerLon = 2.3; tileMap.zoomLevel = 6;
      }

      let drawPending = false;
      const requestDraw = () => {
        if (drawPending) return;
        drawPending = true;
        requestAnimationFrame(() => { drawPending = false; drawMap(); });
      };

      const drawMap = () => {
        const modal = document.getElementById('modal-ite');
        if (!modal || modal.classList.contains('hidden')) return;
        tileMap.renderTiles(ctx, canvas.width, canvas.height);
        const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
        const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
        const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
        const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
        const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
        const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;

        // ITE marker
        const center = tileMap.worldToScreen(lat, lon, canvas.width, canvas.height);
        ctx.fillStyle = '#10b981';
        ctx.beginPath(); ctx.arc(center.x, center.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        // Track polyline
        if (this._iteTrackPoints.length >= 2) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(this._iteTrackPoints[0].lat, this._iteTrackPoints[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < this._iteTrackPoints.length; i++) {
            const p = tileMap.worldToScreen(this._iteTrackPoints[i].lat, this._iteTrackPoints[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        if (this._iteTrackPoints.length > 0) {
          for (const pt of this._iteTrackPoints) {
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            ctx.fillStyle = '#a5f3fc';
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          }
        }
        // Dashed line from ITE marker to first point
        if (this._iteTrackPoints.length === 1) {
          const p = tileMap.worldToScreen(this._iteTrackPoints[0].lat, this._iteTrackPoints[0].lon, canvas.width, canvas.height);
          ctx.strokeStyle = 'rgba(250,204,21,0.5)';
          ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      this._drawITEMap = drawMap;

      if (canvas._iteBound) { requestDraw(); return; }
      canvas._iteBound = true;

      let drag = false, dragStart = null, totalDragDist = 0;
      canvas.onmousedown = (e) => { drag = true; dragStart = { x: e.offsetX, y: e.offsetY }; totalDragDist = 0; };
      canvas.onmousemove = (e) => {
        if (drag && dragStart) {
          const dx = e.offsetX - dragStart.x;
          const dy = e.offsetY - dragStart.y;
          totalDragDist += Math.abs(dx) + Math.abs(dy);
          tileMap.pan(dx, dy);
          dragStart = { x: e.offsetX, y: e.offsetY };
          requestDraw();
        }
      };
      canvas.onmouseup = (e) => {
        if (totalDragDist < 5) {
          const x = e.offsetX, y = e.offsetY;
          if (e.shiftKey) {
            let bestIdx = -1, bestD = Infinity;
            for (let i = 0; i < this._iteTrackPoints.length; i++) {
              const p = tileMap.worldToScreen(this._iteTrackPoints[i].lat, this._iteTrackPoints[i].lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < bestD) { bestD = d; bestIdx = i; }
            }
            if (bestIdx >= 0 && bestD < 12) {
              this._iteTrackPoints.splice(bestIdx, 1);
              this._updateITETrackUI();
              requestDraw();
            }
            drag = false; dragStart = null; totalDragDist = 0;
            return;
          }
          const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
          this._iteTrackPoints.push({ lat: worldPos.lat, lon: worldPos.lon });
          this._updateITETrackUI();
          requestDraw();
        }
        drag = false; dragStart = null; totalDragDist = 0;
      };
      canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
      canvas.oncontextmenu = (e) => { e.preventDefault(); };

      this._iteMapInterval = setInterval(() => {
        const modal = document.getElementById('modal-ite');
        if (!modal || modal.classList.contains('hidden')) return;
        requestDraw();
      }, 250);

      requestDraw();
    },

  _updateITETrackUI() {
      const finish = document.getElementById('btn-ite-finish-track');
      const hint = document.getElementById('ite-track-hint');
      if (finish) finish.classList.toggle('hidden', this._iteTrackPoints.length < 2);
      if (hint) {
        if (this._iteTrackPoints.length < 2) hint.textContent = 'Cliquez sur la carte pour placer les points de la voie (50 m). Shift+clic pour supprimer un point.';
        else hint.textContent = `${this._iteTrackPoints.length} point(s). Cliquez "Terminer voie" pour valider.`;
      }
    },

  _finishITETrack() {
      if (!this._pendingITE || this._iteTrackPoints.length < 2) return;
      const nameInput = document.getElementById('ite-track-name');
      const name = (nameInput?.value.trim()) || `Voie ${(this._pendingITE.tracks.length + 1)}`;
      const route = this._densifyRoute(this._iteTrackPoints.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: 30 })));
      const lengthM = Math.round(this.game.orm.getRouteDistance(route) * 1000);
      this._pendingITE.tracks.push({ name, length: lengthM, route });
      this._iteTrackPoints = [];
      if (nameInput) nameInput.value = '';
      this._updateITETrackUI();
      this._renderITEPendingTracks();
      if (this._drawITEMap) this._drawITEMap();
    },

  _renderITEPendingTracks() {
      const list = document.getElementById('ite-tracks-list');
      if (!list || !this._pendingITE) return;
      list.innerHTML = this._pendingITE.tracks.length === 0
        ? '<span style="color:var(--text3)">Aucune voie tracée</span>'
        : this._pendingITE.tracks.map((t, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid var(--border)">
            <span><b>${t.name}</b> — ${t.length} m</span>
            <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui._removeITEPendingTrack(${i})">x</button>
          </div>`).join('');
    },

  _removeITEPendingTrack(index) {
      if (!this._pendingITE) return;
      this._pendingITE.tracks.splice(index, 1);
      this._renderITEPendingTracks();
    },

  saveITE() {
      const modal = document.getElementById('modal-ite');
      if (!modal) return;
      const name = document.getElementById('ite-name')?.value.trim() || 'ITE';
      const type = document.getElementById('ite-type')?.value || 'ite-fret';
      const lat = parseFloat(document.getElementById('ite-lat')?.value);
      const lon = parseFloat(document.getElementById('ite-lon')?.value);
      const tracks = parseInt(document.getElementById('ite-tracks')?.value) || 2;
      const cost = parseInt(document.getElementById('ite-cost')?.value) || 50000;
      const cargoTypes = [...document.querySelectorAll('.ite-cargo:checked')].map(cb => cb.value);
      if (isNaN(lat) || isNaN(lon)) return alertToast('Localisation invalide.');

      const station = this.game.world.addStation({ name, lat, lon, type: 'ite', platforms: tracks, platformNames: [] });
      station.country = this.game.orm.getCountryAtPoint(lat, lon);
      this.game.platformManager.initStation(station.id, tracks);

      this.game.depotManager.add({
        type,
        name,
        stationId: station.id,
        tracks,
        cost,
        iteTracks: (this._pendingITE?.tracks || []).map(t => ({ name: t.name, length: t.length, cargoType: '' })),
        iteCargoTypes: cargoTypes,
      }, this.game.economy);

      this.game.saveState();
      this.game.renderer?.invalidateStatic();
      this._closeITECreator();
      this.renderDepotsList();
    },

  setupDepotPage() {
      document.getElementById('btn-add-depot')?.addEventListener('click', () => this.openDepotModal());
      document.getElementById('btn-save-depot')?.addEventListener('click', () => this.saveDepot());
      document.getElementById('btn-add-ite-track')?.addEventListener('click', () => this.addITETrack());
      document.getElementById('depot-type')?.addEventListener('change', () => this._toggleITEEditor());
    },

  openDepotModal() {
      this._pendingDepotITETarget = null; // stored ITE target if created from map
      this._pendingITETracks = [];
      document.getElementById('modal-depot')?.classList.remove('hidden');
      document.getElementById('depot-name').value = '';
      const typeSel = document.getElementById('depot-type');
      if (typeSel) typeSel.value = 'depot';
      const select = document.getElementById('depot-station');
      if (select) select.innerHTML = '<option value="">—</option>' + this.game.world.stations.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
      this._toggleITEEditor();
      this._renderITETrackList();
    },

  _toggleITEEditor() {
      const type = document.getElementById('depot-type')?.value || 'depot';
      const editor = document.getElementById('depot-ite-editor');
      if (editor) editor.classList.toggle('hidden', !type.startsWith('ite'));
    },

  _renderITETrackList() {
      const list = document.getElementById('depot-ite-tracks-list');
      if (!list) return;
      list.innerHTML = (this._pendingITETracks || []).map((t, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px">
          <span><b>${t.name}</b> — ${t.length} m${t.cargoType ? ' (' + t.cargoType + ')' : ''}</span>
          <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui.removeITETrack(${i})">x</button>
        </div>
      `).join('') || '<span style="color:var(--text3);font-size:10px">Aucune voie saisie</span>';
    },

  removeITETrack(index) {
      if (!this._pendingITETracks) return;
      this._pendingITETracks.splice(index, 1);
      this._renderITETrackList();
    },

  addITETrack() {
      const name = document.getElementById('depot-ite-track-name')?.value.trim();
      const length = parseInt(document.getElementById('depot-ite-track-length')?.value) || 0;
      const cargoType = document.getElementById('depot-ite-track-cargo')?.value || '';
      if (!name || length <= 0) return alertToast('Nom et longueur requis');
      if (!this._pendingITETracks) this._pendingITETracks = [];
      this._pendingITETracks.push({ name, length, cargoType });
      this._renderITETrackList();
      document.getElementById('depot-ite-track-name').value = '';
      document.getElementById('depot-ite-track-length').value = '300';
    },

  saveDepot() {
      const type = document.getElementById('depot-type')?.value || 'depot';
      const stationId = document.getElementById('depot-station')?.value;
      if (!stationId) return alertToast('Sélectionnez une gare');
      const infra = [...document.querySelectorAll('.depot-infra:checked')].map(cb => cb.value);
      const data = {
        type,
        name: document.getElementById('depot-name')?.value.trim() || 'Depot',
        stationId,
        tracks: parseInt(document.getElementById('depot-tracks')?.value) || 4,
        cost: parseInt(document.getElementById('depot-cost')?.value) || 50000,
        infrastructure: type === 'depot' ? infra : [],
        iteTracks: type.startsWith('ite') ? (this._pendingITETracks || []) : [],
        iteCargoTypes: type.startsWith('ite') ? [...new Set((this._pendingITETracks || []).map(t => t.cargoType).filter(Boolean))] : [],
      };
      this.game.depotManager.add(data, this.game.economy);
      document.getElementById('modal-depot')?.classList.add('hidden');
      this.renderDepotsList();
      this.game.saveState();
    },

  renderDepotsList() {
      const depotsContainer = document.getElementById('depots-list');
      const iteContainer = document.getElementById('ite-list');
      const depots = this.game.depotManager.getDepots();
      const ites = this.game.depotManager.getITEs();

      // MNT-05 : notification de pièces détachées sous-stock
      const lowStock = this.game.depotManager.getLowStockDepots(2);
      const alertHtml = lowStock.length
        ? `<div style="margin-bottom:10px;padding:8px;border-radius:4px;background:#451a1a;color:#fca5a5;font-size:11px">
            <b>Stocks faibles de pièces détachées :</b> ${lowStock.map(x => `${x.depot.name} (${x.low.join(', ')})`).join(' ; ')}
           </div>`
        : '';
      const bulkHtml = depots.length
        ? `<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;font-size:11px">
            <span style="color:var(--text3)">Livraison groupée :</span>
            <select id="bulk-spare-type" style="font-size:10px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              <option value="moteur">Moteur</option>
              <option value="freins">Freins</option>
              <option value="climatisation">Climatisation</option>
              <option value="portes">Portes</option>
              <option value="fanaux">Fanaux</option>
            </select>
            <input id="bulk-spare-qty" type="number" value="2" min="1" style="width:50px;font-size:10px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px">
            <button class="btn-sm" style="font-size:9px" onclick="game.ui.buyBulkSparePart()">Commander tous les dépôts</button>
           </div>`
        : '';
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

        const ramesHere = this.game.rameManager.getAll().filter(r => r.depotId === d.id);
        const ramesList = ramesHere.length > 0
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;margin-bottom:4px">Rames affectées (${ramesHere.length})</div>${ramesHere.map(r => {
              const engines = (r.elementDetails || []).map(e => `<div style="padding-left:8px;font-size:9px;color:var(--text3)">• ${e.instanceName || e.name} (${e.category})</div>`).join('');
              return `<div style="font-size:10px;padding:2px 0"><b>${r.name}</b>${engines}</div>`;
            }).join('')}</div>`
          : '';
        const maintenanceCount = this.game.rameManager.getAll().filter(r => r.recommendedMaintenance && !this.game.depotManager.isRameInMaintenance(r.id)).length;
        const bulkMaintButton = (d.type === 'depot' && maintenanceCount > 0)
          ? `<button class="btn-sm" style="font-size:9px;margin-top:6px" onclick="game.ui.bulkSendToMaintenance('${d.id}')">Rapatrier ${maintenanceCount} rame(s) recommandée(s)</button>`
          : '';

        return `
          <div class="card">
            <div class="card-title">${d.name}</div>
            <div class="card-info">
              <b>Type:</b> ${d.getTypeLabel()}<br>
              <b>Gare:</b> ${station ? station.name : d.stationId}<br>
              <b>Voies:</b> ${d.tracks} | <b>Cout:</b> ${d.cost.toLocaleString()} EUR${d.infrastructure?.length ? '<br><b>Infra:</b> ' + d.infrastructure.join(', ') : ''}
            </div>
            ${ramesList}
            ${bulkMaintButton}
            ${d.type === 'depot' ? `
              <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
                <div style="font-size:11px;font-weight:600;margin-bottom:4px">Machines de secours (max 2)</div>
                ${rescueList}
                ${availableStock.length > 0 && d.rescueLocos.length < 2 ? `
                  <div style="display:flex;gap:4px;margin-top:4px">
                    <select id="rescue-stock-${d.id}" style="flex:1;font-size:10px">${stockOptions}</select>
                    <button class="btn-sm" style="font-size:9px" onclick="game.ui.addRescueLoco('${d.id}')">+ Ajouter</button>
                  </div>
                ` : ''}
              </div>
              <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
                <div style="font-size:11px;font-weight:600;margin-bottom:4px">Pièces détachées</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:10px">
                  ${Object.entries(d.spareParts || {}).map(([type, qty]) => `
                    <span style="white-space:nowrap">${type}: ${qty} <button class="btn-sm" style="font-size:9px;padding:1px 4px" onclick="game.ui.buySparePart('${d.id}','${type}',1)">+</button></span>
                  `).join('')}
                </div>
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
        const totalLen = d.iteTracks.reduce((s, t) => s + (Number(t.length) || 0), 0);
        const tracksHtml = d.iteTracks.length > 0
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:10px">${d.iteTracks.map(t => `<div>${t.name}: ${t.length} m${t.cargoType ? ' · ' + t.cargoType : ''}</div>`).join('')}<div style="font-weight:600;margin-top:4px">Total longueur utile: ${totalLen} m</div></div>`
          : '';
        return `
          <div class="card">
            <div class="card-title">${d.name}</div>
            <div class="card-info">
              <b>Type:</b> ${d.getTypeLabel()}<br>
              <b>Gare:</b> ${station ? station.name : d.stationId}<br>
              <b>Voies:</b> ${d.tracks} | <b>Cout:</b> ${d.cost.toLocaleString()} EUR
            </div>
            ${tracksHtml}
            <div class="card-actions">
              <button class="btn-sm danger" onclick="game.ui.deleteDepot('${d.id}')">Supprimer</button>
            </div>
          </div>
        `;
      };

      if (depotsContainer) {
        const cards = depots.length === 0
          ? '<p style="color:var(--text3);font-size:11px;padding:10px">Aucun</p>'
          : depots.map(renderDepotCard).join('');
        depotsContainer.innerHTML = alertHtml + bulkHtml + cards;
      }
      if (iteContainer) {
        iteContainer.innerHTML = ites.length === 0
          ? '<p style="color:var(--text3);font-size:11px;padding:10px">Aucun</p>'
          : ites.map(renderIteCard).join('');
      }
    },

  addRescueLoco(depotId) {
      const select = document.getElementById(`rescue-stock-${depotId}`);
      if (!select || !select.value) return;
      const stock = this.game.rollingStock.getAll().find(s => s.id === select.value);
      if (!stock) return;
      const displayName = stock.seriesName ? `${stock.seriesName} ${stock.numberStart || ''}`.trim() : stock.name;
      const ok = this.game.depotManager.addRescueLoco(depotId, stock.id, displayName, stock.traction);
      if (!ok) return alertToast('Maximum 2 machines de secours par dépôt.');
      this.game.saveState();
      this.renderDepotsList();
    },

  removeRescueLoco(depotId, stockId) {
      this.game.depotManager.removeRescueLoco(depotId, stockId);
      this.game.saveState();
      this.renderDepotsList();
    },

  buySparePart(depotId, type, qty) {
      const depot = this.game.depotManager.getDepotById(depotId);
      if (!depot) return;
      const prices = { moteur: 5000, freins: 3000, climatisation: 2000, portes: 1500, fanaux: 1000 };
      const cost = (prices[type] || 1000) * qty;
      if (this.game.economy.balance < cost) return alertToast('Fonds insuffisants.');
      if (depot.addSpareParts(type, qty)) {
        this.game.economy.addExpense(cost, 'maintenance', `Achat pièce détachée : ${type} x${qty}`);
        this.game.saveState();
        this.renderDepotsList();
      }
    },

  buyBulkSparePart() {
      const typeSelect = document.getElementById('bulk-spare-type');
      const qtyInput = document.getElementById('bulk-spare-qty');
      if (!typeSelect || !qtyInput) return;
      const type = typeSelect.value;
      const qty = parseInt(qtyInput.value) || 1;
      const res = this.game.depotManager.buyBulkSpareParts(type, qty, this.game.economy);
      if (!res.ok) return alertToast(`Fonds insuffisants. Coût total : ${res.totalCost.toLocaleString('fr-FR')} €`);
      this.game.saveState();
      this.renderDepotsList();
    },

  deleteDepot(id) {
      if (!confirm('Supprimer ce d\u00e9p\u00f4t ?')) return;
      this.game.depotManager.remove(id);
      this.game.saveState();
      this.renderDepotsList();
    },

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
    },

  _renderMaintenanceButton(depot) {
      // List all RAMES not already in maintenance (preventive maintenance available for any rame)
      const allRames = this.game.rameManager.getAll();
      const dm = this.game.depotManager;
      const available = allRames.filter(r =>
        !r.inMaintenance && !dm.isRameInMaintenance(r.id)
      );
      if (available.length === 0) return '';
      // MNT-06 : rames avec maintenance préventive recommandée en premier
      const sorted = [...available].sort((a, b) => (b.recommendedMaintenance ? 1 : 0) - (a.recommendedMaintenance ? 1 : 0));
      const opts = sorted.map(r => {
        const badge = r.recommendedMaintenance ? ' [RECOMMANDÉ]' : '';
        const wear = Math.round(r.wearLevel);
        const km = Math.round(r.kmSinceLastMaint);
        return `<option value="${r.id}">${r.name} (${wear}% / ${km} km)${badge}</option>`;
      }).join('');
      return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:600;margin-bottom:4px">Entretien preventif (rame)</div>
        <div style="display:flex;gap:4px">
          <select id="maint-rame-${depot.id}" style="flex:1;font-size:10px">${opts}</select>
          <button class="btn-sm" style="font-size:9px" onclick="game.ui.sendRameToMaintenance('${depot.id}')">Envoyer</button>
        </div>
      </div>`;
    },

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
    },

  bulkSendToMaintenance(depotId) {
      const rames = this.game.rameManager.getAll().filter(r => r.recommendedMaintenance && !this.game.depotManager.isRameInMaintenance(r.id));
      let count = 0;
      for (const rame of rames) {
        rame.inMaintenance = true;
        const services = this.game.scheduleCreator.getActiveServices();
        for (const svc of services) {
          if (svc.rame && svc.rame.id === rame.id) {
            svc.train.inMaintenance = true;
            svc.speed = 0;
            svc.train.speed = 0;
          }
        }
        this.game.depotManager.sendRameToMaintenance(rame.id, rame.name, depotId);
        count++;
      }
      if (count > 0) this.game.saveState();
      this.renderDepotsList();
    },

  setupIncidentPage() {
      document.getElementById('btn-add-works')?.addEventListener('click', () => this.openWorksModal());
      document.getElementById('works-impact')?.addEventListener('change', (e) => {
        document.getElementById('works-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
      });
      document.getElementById('works-recurrence')?.addEventListener('change', (e) => {
        document.getElementById('works-days-group').style.display = e.target.value === 'weekly' ? 'block' : 'none';
      });
      document.getElementById('btn-save-works')?.addEventListener('click', () => this.saveWorks());
      document.getElementById('btn-works-manual')?.addEventListener('click', () => this._toggleWorksManualMode());
      document.getElementById('btn-works-finish-manual')?.addEventListener('click', () => this._finishWorksManual());
      document.getElementById('btn-works-clear-manual')?.addEventListener('click', () => this._clearWorksManualTrace());
      document.getElementById('works-station-a')?.addEventListener('change', () => { this._syncWorksManualEndpoints(); this._updateWorksManualUI(); });
      document.getElementById('works-station-b')?.addEventListener('change', () => { this._syncWorksManualEndpoints(); this._updateWorksManualUI(); });

      // Predefined incident type toggles (Annexe 11)
      const typesTable = document.getElementById('incident-types-table');
      if (typesTable && !typesTable._delegated) {
        typesTable._delegated = true;
        typesTable.addEventListener('change', (e) => {
          const cb = e.target.closest('.incident-type-cb');
          if (cb) {
            this.game.incidentManager.toggleType(cb.dataset.typeId, cb.checked);
            this.game.saveState();
          }
        });
      }
    },

  openWorksModal() {
      document.getElementById('modal-works')?.classList.remove('hidden');
      document.getElementById('works-name').value = '';
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      document.getElementById('works-start-date').value = today;
      document.getElementById('works-end-date').value = tomorrow;
      document.getElementById('works-start-time').value = '22:00';
      document.getElementById('works-end-time').value = '05:00';
      const recSel = document.getElementById('works-recurrence');
      if (recSel) recSel.value = 'daily';
      document.getElementById('works-days-group')?.style.setProperty('display', 'none');
      document.querySelectorAll('.works-day').forEach(cb => cb.checked = true);

      const opts = this.game.world.stations.map(st => `<option value="${escapeHtml(st.id)}">${escapeHtml(st.name)}</option>`).join('');
      const aSel = document.getElementById('works-station-a');
      const bSel = document.getElementById('works-station-b');
      if (aSel) aSel.innerHTML = '<option value="">—</option>' + opts;
      if (bSel) bSel.innerHTML = '<option value="">—</option>' + opts;

      this._resetWorksManual();
      this._updateWorksManualUI();
      requestAnimationFrame(() => this.setupWorksMap());
    },

  async saveWorks() {
      const aId = document.getElementById('works-station-a')?.value;
      const bId = document.getElementById('works-station-b')?.value;
      if (!aId || !bId) return alertToast('Sélectionnez les gares A et B.');
      if (aId === bId) return alertToast('Les gares doivent être différentes.');
      const stA = this.game.world.getStationById(aId);
      const stB = this.game.world.getStationById(bId);
      if (!stA || !stB) return alertToast('Gares invalides.');

      if (this._worksManualPoints && this._worksManualPoints.length > 0 && this._worksManualStart && this._worksManualEnd) {
        this._rebuildWorksManualRoute();
      }

      let route = null;
      let manualRoute = null;
      if (this._worksManualRoute && this._worksManualRoute.length >= 2) {
        route = this._worksManualRoute;
        manualRoute = this._worksManualRoute;
      } else {
        try {
          route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
        } catch (e) {
          console.warn('ORM route failed for works', e);
        }
        if (!route || route.length < 2) return alertToast('Impossible de calculer un itinéraire ferroviaire entre ces gares. Vérifiez le réseau ORM ou utilisez le tracé manuel.');
        route = this.game.orm.getRouteSegments(route).map(s => ({ lat: s.from.lat, lon: s.from.lon, maxSpeed: s.maxSpeed })).concat([{ lat: route[route.length - 1].lat, lon: route[route.length - 1].lon, maxSpeed: route[route.length - 1].maxSpeed || 160 }]);
      }

      const recurrence = document.getElementById('works-recurrence')?.value || 'daily';
      const daysOfWeek = recurrence === 'weekly'
        ? [...document.querySelectorAll('.works-day:checked')].map(cb => parseInt(cb.value))
        : [0,1,2,3,4,5,6];
      this.game.worksManager.add({
        name: document.getElementById('works-name').value.trim() || 'Travaux',
        stationA: aId,
        stationB: bId,
        route,
        manualRoute,
        startDate: document.getElementById('works-start-date').value,
        startTime: document.getElementById('works-start-time').value || '22:00',
        endDate: document.getElementById('works-end-date').value,
        endTime: document.getElementById('works-end-time').value || '05:00',
        impact: document.getElementById('works-impact').value,
        speedLimit: parseInt(document.getElementById('works-speed-limit').value) || 40,
        recurrence,
        daysOfWeek,
      });
      this._resetWorksManual();
      document.getElementById('modal-works')?.classList.add('hidden');
      this.renderIncidentsPage();
      this.game.saveState();
    },

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

      const typesTable = document.getElementById('incident-types-table');
      if (typesTable) {
        const types = this.game.incidentManager.getAllTypes();
        typesTable.innerHTML = `
          <table class="incident-table">
            <thead>
              <tr>
                <th>Actif</th>
                <th>Nom</th>
                <th>Impact</th>
                <th>Conditions</th>
                <th>Proba</th>
                <th>Saisons</th>
                <th>Duree</th>
              </tr>
            </thead>
            <tbody>
              ${types.map(t => `
                <tr>
                  <td><input type="checkbox" class="incident-type-cb" data-type-id="${t.id}" ${t.enabled ? 'checked' : ''}></td>
                  <td>${t.name}</td>
                  <td>${t.impact}</td>
                  <td style="font-size:10px;color:var(--text3)">${t.special}</td>
                  <td>${t.id === 'train-breakdown' ? `${t.probability}% hiver / ${t.summerProbability}% ete` : t.probability + '%'}</td>
                  <td>${t.seasons.join(', ')}</td>
                  <td>${t.durationMin}${t.durationMax !== t.durationMin ? '-' + t.durationMax : ''} min</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      const works = this.game.worksManager.getAll();
      if (worksList) {
        worksList.innerHTML = works.length === 0
          ? '<div class="no-incidents">Aucun travaux programmes</div>'
          : works.map(w => {
              const stA = this.game.world.getStationById(w.stationA);
              const stB = this.game.world.getStationById(w.stationB);
              const sectionName = (stA?.name || '?') + ' — ' + (stB?.name || '?');
              return `
                <div class="works-item">
                  <span class="works-name">${w.name}</span> - ${sectionName}${w.manualRoute ? ' (tracé manuel)' : ''}<br>
                  ${w.getDateRange()}<br>
                  <span style="font-size:10px;color:var(--text3)">${w.recurrence === 'once' ? 'Le ' + w.startDate : w.recurrence === 'weekly' ? 'Hebdo : ' + w.daysOfWeek.join(',') : 'Chaque jour'} de ${w.startTime} a ${w.endTime}</span><br>
                  Impact: ${w.impact === 'stop' ? 'Interruption' : 'Ralenti ' + w.speedLimit + ' km/h'}
                  ${w.active ? ' <b style="color:var(--red)">EN COURS</b>' : ''}
                  <button class="btn-sm danger incident-delete-btn" style="float:right" data-delete-works="${w.id}" title="Supprimer les travaux">✕</button>
                </div>
              `;
            }).join('');
      }
    },

  deleteIncident(id) {
      this.game.incidentManager.removeIncident(id, this.game.world);
      this.renderIncidentsPage();
    },

  deleteWorks(id) {
      this.game.worksManager.remove(id);
      this.renderIncidentsPage();
    },

  _resetWorksManual() {
      this._worksManualMode = false;
      this._worksManualStart = null;
      this._worksManualEnd = null;
      this._worksManualPoints = [];
      this._worksManualRoute = null;
    },

  _syncWorksManualEndpoints() {
      const aId = document.getElementById('works-station-a')?.value;
      const bId = document.getElementById('works-station-b')?.value;
      const aSt = aId ? this.game.world.getStationById(aId) : null;
      const bSt = bId ? this.game.world.getStationById(bId) : null;
      if (aSt) this._worksManualStart = { lat: aSt.lat, lon: aSt.lon, id: aSt.id, name: aSt.name };
      else this._worksManualStart = null;
      if (bSt) this._worksManualEnd = { lat: bSt.lat, lon: bSt.lon, id: bSt.id, name: bSt.name };
      else this._worksManualEnd = null;
      if (this._worksTileMap) {
        if (aSt && bSt) {
          this._worksTileMap.centerLat = (aSt.lat + bSt.lat) / 2;
          this._worksTileMap.centerLon = (aSt.lon + bSt.lon) / 2;
          const cosLat = Math.cos(this._worksTileMap.centerLat * Math.PI / 180);
          const latSpan = Math.abs(aSt.lat - bSt.lat) + 0.05;
          const lonSpan = Math.abs(aSt.lon - bSt.lon) * cosLat + 0.05;
          const spanDeg = Math.max(latSpan, lonSpan);
          this._worksTileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg)));
        } else if (aSt) {
          this._worksTileMap.centerLat = aSt.lat;
          this._worksTileMap.centerLon = aSt.lon;
          this._worksTileMap.zoomLevel = 10;
        }
      }
      if (this._worksManualMode) this._rebuildWorksManualRoute();
      if (this._drawWorksMap) this._drawWorksMap();
    },

  _rebuildWorksManualRoute() {
      if (!this._worksManualStart || !this._worksManualEnd) return;
      const start = { lat: this._worksManualStart.lat, lon: this._worksManualStart.lon, maxSpeed: 160 };
      const end = { lat: this._worksManualEnd.lat, lon: this._worksManualEnd.lon, maxSpeed: 160 };
      const controls = this._worksManualPoints.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: 160 }));
      this._worksManualRoute = this._buildManualRoute(start, controls, end, 160);
    },

  _toggleWorksManualMode() {
      const aId = document.getElementById('works-station-a')?.value;
      const bId = document.getElementById('works-station-b')?.value;
      if (!this._worksManualMode) {
        if (!aId || !bId) return alertToast('Sélectionnez d\'abord les gares A et B.');
        this._worksManualMode = true;
        this._syncWorksManualEndpoints();
      } else {
        this._worksManualMode = false;
        if (!this._worksManualRoute) this._worksManualPoints = [];
      }
      this._updateWorksManualUI();
      if (this._drawWorksMap) this._drawWorksMap();
    },

  _finishWorksManual() {
      if (!this._worksManualMode) return;
      this._rebuildWorksManualRoute();
      if (!this._worksManualRoute || this._worksManualRoute.length < 2) return alertToast('Tracé invalide.');
      this._worksManualMode = false;
      this._updateWorksManualUI();
      if (this._drawWorksMap) this._drawWorksMap();
    },

  _clearWorksManualTrace() {
      this._worksManualPoints = [];
      this._worksManualRoute = null;
      this._worksManualMode = false;
      this._updateWorksManualUI();
      if (this._drawWorksMap) this._drawWorksMap();
    },

  _updateWorksManualUI() {
      const manual = document.getElementById('btn-works-manual');
      const clear = document.getElementById('btn-works-clear-manual');
      const finish = document.getElementById('btn-works-finish-manual');
      const hint = document.getElementById('works-manual-hint');
      const aId = document.getElementById('works-station-a')?.value;
      const bId = document.getElementById('works-station-b')?.value;
      if (manual) {
        manual.textContent = this._worksManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement';
        manual.classList.toggle('active', this._worksManualMode);
        manual.disabled = !aId || !bId;
      }
      if (clear) clear.classList.toggle('hidden', !this._worksManualMode);
      if (finish) finish.classList.toggle('hidden', !this._worksManualMode);
      if (hint) {
        if (this._worksManualMode) hint.textContent = 'Cliquez pour ajouter un point (50 m). Shift+clic sur un point pour le supprimer. Cliquez "Terminer" quand la portion fermée est tracée.';
        else if (!aId || !bId) hint.textContent = 'Sélectionnez les gares A et B. Le tracé ORM entre les deux sera fermé pendant la période.';
        else if (this._worksManualRoute) hint.textContent = 'Tracé manuel enregistré. Vous pouvez le refaire avec "Tracer manuellement".';
        else hint.textContent = 'Sélectionnez les gares A et B, puis cliquez sur "Tracer manuellement" pour indiquer la portion précise fermée.';
      }
    },

  setupWorksMap() {
      if (this._worksMapInterval) { clearInterval(this._worksMapInterval); this._worksMapInterval = null; }
      const canvas = document.getElementById('works-map-canvas');
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const ctx = canvas.getContext('2d');
      const world = this.game.world;
      if (!this._worksTileMap) {
        const mainTileMap = this.game.renderer.tileMap;
        this._worksTileMap = new mainTileMap.constructor();
      }
      const tileMap = this._worksTileMap;
      tileMap.viewportWidth = canvas.width;
      tileMap.viewportHeight = canvas.height;

      this._syncWorksManualEndpoints();

      let drawPending = false;
      const requestDraw = () => {
        if (drawPending) return;
        drawPending = true;
        requestAnimationFrame(() => { drawPending = false; drawMap(); });
      };

      const drawMap = () => {
        const modal = document.getElementById('modal-works');
        if (!modal || modal.classList.contains('hidden')) return;
        tileMap.renderTiles(ctx, canvas.width, canvas.height);
        const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
        const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
        const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
        const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
        const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
        const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;

        // Existing tracks (faint)
        for (const t of world.tracks) {
          if (!t.route || t.route.length < 2) continue;
          ctx.strokeStyle = 'rgba(148,163,184,0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(t.route[0].lat, t.route[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < t.route.length; i++) {
            const p = tileMap.worldToScreen(t.route[i].lat, t.route[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }

        // Planned works (faint red)
        for (const w of this.game.worksManager.getAll()) {
          const r = w.manualRoute || w.route;
          if (!r || r.length < 2) continue;
          ctx.strokeStyle = 'rgba(239,68,68,0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(r[0].lat, r[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < r.length; i++) {
            const p = tileMap.worldToScreen(r[i].lat, r[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }

        // Stations
        for (const st of world.stations) {
          if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon) continue;
          const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
          const isStart = this._worksManualStart && this._worksManualStart.id === st.id;
          const isEnd = this._worksManualEnd && this._worksManualEnd.id === st.id;
          ctx.fillStyle = isStart ? '#22c55e' : isEnd ? '#f97316' : '#3b82f6';
          ctx.beginPath(); ctx.arc(p.x, p.y, (isStart || isEnd) ? 7 : 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
          if (tileMap.zoomLevel >= 8) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.fillText(st.name, p.x + 8, p.y + 4);
          }
        }

        // Manual trace
        let trace = this._worksManualRoute;
        if (!trace && this._worksManualStart && this._worksManualEnd) {
          const start = { lat: this._worksManualStart.lat, lon: this._worksManualStart.lon, maxSpeed: 160 };
          const end = { lat: this._worksManualEnd.lat, lon: this._worksManualEnd.lon, maxSpeed: 160 };
          const controls = this._worksManualPoints.map(p => ({ ...p, maxSpeed: 160 }));
          trace = this._densifyRoute([start, ...controls, end], 0.05);
        }
        if (trace && trace.length >= 2) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const p0 = tileMap.worldToScreen(trace[0].lat, trace[0].lon, canvas.width, canvas.height);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < trace.length; i++) {
            const p = tileMap.worldToScreen(trace[i].lat, trace[i].lon, canvas.width, canvas.height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          for (let i = 0; i < trace.length; i++) {
            const pt = trace[i];
            if (!pt.control && i !== 0 && i !== trace.length - 1) continue;
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            const isEnd = (i === 0 || i === trace.length - 1);
            ctx.fillStyle = isEnd ? '#f59e0b' : '#fca5a5';
            ctx.beginPath(); ctx.arc(p.x, p.y, isEnd ? 5 : 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          }
        } else if (this._worksManualStart && this._worksManualEnd) {
          ctx.strokeStyle = 'rgba(239,68,68,0.4)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          const a = tileMap.worldToScreen(this._worksManualStart.lat, this._worksManualStart.lon, canvas.width, canvas.height);
          const b = tileMap.worldToScreen(this._worksManualEnd.lat, this._worksManualEnd.lon, canvas.width, canvas.height);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      this._drawWorksMap = drawMap;

      if (canvas._worksBound) {
        requestDraw();
        return;
      }
      canvas._worksBound = true;

      let drag = false, dragStart = null, totalDragDist = 0;
      canvas.onmousedown = (e) => { drag = true; dragStart = { x: e.offsetX, y: e.offsetY }; totalDragDist = 0; };
      canvas.onmousemove = (e) => {
        if (drag && dragStart) {
          const dx = e.offsetX - dragStart.x;
          const dy = e.offsetY - dragStart.y;
          totalDragDist += Math.abs(dx) + Math.abs(dy);
          tileMap.pan(dx, dy);
          dragStart = { x: e.offsetX, y: e.offsetY };
          requestDraw();
        }
      };
      canvas.onmouseup = (e) => {
        if (totalDragDist < 5) {
          const x = e.offsetX, y = e.offsetY;
          if (this._worksManualMode) {
            if (e.shiftKey) {
              let bestIdx = -1, bestD = Infinity;
              for (let i = 0; i < this._worksManualPoints.length; i++) {
                const p = tileMap.worldToScreen(this._worksManualPoints[i].lat, this._worksManualPoints[i].lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < bestD) { bestD = d; bestIdx = i; }
              }
              if (bestIdx >= 0 && bestD < 12) {
                this._worksManualPoints.splice(bestIdx, 1);
                this._rebuildWorksManualRoute();
                requestDraw();
              }
              drag = false; dragStart = null; totalDragDist = 0;
              return;
            }
            const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
            if (!this._worksManualStart || !this._worksManualEnd) return;
            const snapped = this._snapToTrack(worldPos.lat, worldPos.lon);
            const pt = snapped || worldPos;
            this._worksManualPoints.push({ lat: pt.lat, lon: pt.lon });
            this._rebuildWorksManualRoute();
            requestDraw();
          } else {
            let closest = null, minDist = Infinity;
            for (const st of world.stations) {
              const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
              const d = Math.hypot(p.x - x, p.y - y);
              if (d < minDist && d < 20) { minDist = d; closest = st; }
            }
            if (closest) {
              const aSel = document.getElementById('works-station-a');
              const bSel = document.getElementById('works-station-b');
              if (aSel && !aSel.value) {
                aSel.value = closest.id;
                this._syncWorksManualEndpoints();
                this._updateWorksManualUI();
              } else if (bSel && !bSel.value) {
                bSel.value = closest.id;
                this._syncWorksManualEndpoints();
                this._updateWorksManualUI();
              }
            }
          }
        }
        drag = false; dragStart = null; totalDragDist = 0;
      };
      canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
      canvas.oncontextmenu = (e) => { e.preventDefault(); };

      this._worksMapInterval = setInterval(() => {
        if (document.getElementById('modal-works')?.classList.contains('hidden')) return;
        requestDraw();
      }, 250);

      requestDraw();
    },

  setupVoiePointButtons() {
      document.getElementById('btn-create-voie-point')?.addEventListener('click', () => {
        this.toggleVoiePointCreation();
      });
      document.getElementById('btn-create-voie-point')?.addEventListener('dblclick', () => {
        this._multiCreateMode = 'voiepoint';
        if (!this.voiePointCreationMode) this.toggleVoiePointCreation();
        document.getElementById('btn-create-voie-point')?.classList.add('multi-mode');
      });
      document.getElementById('btn-create-troncon')?.addEventListener('click', () => {
        this.toggleTronconCreation();
      });
      document.getElementById('btn-create-troncon')?.addEventListener('dblclick', () => {
        this._multiCreateMode = 'troncon';
        if (!this.tronconCreationMode) this.toggleTronconCreation();
        document.getElementById('btn-create-troncon')?.classList.add('multi-mode');
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

      // XXI — create an industrial site directly on the livemap
      document.getElementById('btn-create-industry')?.addEventListener('click', () => {
        this.toggleIndustryCreation();
      });
    },

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
    },

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
    },

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
    },

  openVoiePointModal(lat, lon) {
      // Mode multi-création : le point de voie reste sélectionné jusqu'à Échap (note joueurs)
      // this.voiePointCreationMode = false;
      // const btn = document.getElementById('btn-create-voie-point');
      // if (btn) { btn.textContent = '+ Point de voie'; btn.classList.remove('active-mode'); }
      // document.getElementById('game-canvas').style.cursor = 'grab';

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
    },

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
    },

  _getPointName(pointId) {
      const vp = this.game.voiePointManager.getVoiePointById(pointId);
      if (vp) return `Voie ${vp.voie} (${vp.lat.toFixed(3)}, ${vp.lon.toFixed(3)})`;
      const st = this.game.world.getStationById(pointId);
      if (st) return st.name;
      return pointId;
    },

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
    },

  _deleteVoiePoint() {
      if (!this._editingVoiePointId) return;
      if (!confirm('Supprimer ce point de voie et ses troncons ?')) return;
      this.game.voiePointManager.removeVoiePoint(this._editingVoiePointId);
      document.getElementById('modal-voie-point')?.classList.add('hidden');
      this.game.saveState();
    },

  _deleteTroncon(trcId) {
      if (!confirm('Supprimer ce troncon ?')) return;
      this.game.voiePointManager.removeTroncon(trcId);
      // Refresh modal if open
      if (this._editingVoiePointId) {
        const vp = this.game.voiePointManager.getVoiePointById(this._editingVoiePointId);
        if (vp) this.openEditVoiePointModal(vp);
      }
      this.game.saveState();
    },

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
    },

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
    },

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
    },

  _finalizeManualTroncon(endPoint) {
      const vpm = this.game.voiePointManager;
      const ptA = this._manualTronconPointA;
      const coarseRoute = this._manualTronconWaypoints.map(wp => ({
        lat: wp.lat, lon: wp.lon, maxSpeed: wp.maxSpeed || 30,
      }));

      // Player note / Annex 6 — livemap manual tronçon must keep one point every 50 m.
      const route = this._densifyRoute(coarseRoute, 0.05);

      // Recalculate distance from the densified route.
      let distance = 0;
      for (let i = 1; i < route.length; i++) {
        distance += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
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
    },

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
    },

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
};
