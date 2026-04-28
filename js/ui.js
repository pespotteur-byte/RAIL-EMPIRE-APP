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
    this.schedMapTileMap = null;
  }

  setupAll() {
    this.setupNav();
    this.setupMapEvents();
    this.setupTabs();
    this.setupRollingStockPage();
    this.setupRamePage();
    this.setupSchedulePage();
    this.setupDepotPage();
    this.setupIncidentPage();
    this.setupEconomyPage();
    this.setupModals();
  }

  refreshAll() {
    if (this.activePage === 'rolling-stock') this.renderStockList();
    else if (this.activePage === 'rames') this.renderRamesList();
    else if (this.activePage === 'schedules') this.renderSchedulesList();
    else if (this.activePage === 'depots') this.renderDepotsList();
    else if (this.activePage === 'incidents') this.renderIncidentsPage();
    else if (this.activePage === 'economy') this.renderEconomyPage();
  }

  setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
    });
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
    if (page === 'depots') this.renderDepotsList();
    if (page === 'incidents') this.renderIncidentsPage();
    if (page === 'economy') this.renderEconomyPage();
  }

  setupMapEvents() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;
    });

    canvas.addEventListener('mousemove', (e) => {
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
      if (!this.dragMoved && this.stationCreationMode && this.game.renderer) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
        this.openStationCreationModal(worldPos.lat, worldPos.lon);
      }
      this.isDragging = false;
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
  }

  handleMapHover(x, y) {
    const renderer = this.game.renderer;
    if (!renderer) return;
    const tooltip = document.getElementById('tooltip');
    const station = renderer.getStationAt(x, y, this.game.world.stations);
    if (station) {
      const typeLabels = { voyageur: 'Voyageurs', marchandise: 'Marchandises', ite: 'ITE', depot: 'Depot', mixed: 'Mixte' };
      tooltip.innerHTML = `<div class="tt-name">${station.name}</div><div class="tt-info">${station.platforms} voies | ${typeLabels[station.type] || station.type}</div>`;
      tooltip.style.left = (x + 15) + 'px';
      tooltip.style.top = (y - 10) + 'px';
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }
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

    document.getElementById('station-lat').value = lat.toFixed(6);
    document.getElementById('station-lon').value = lon.toFixed(6);
    document.getElementById('station-name').value = '';
    document.getElementById('station-platforms').value = '4';
    document.getElementById('modal-station')?.classList.remove('hidden');
  }

  async saveStation() {
    const name = document.getElementById('station-name').value.trim();
    if (!name) return alert('Nom requis');
    let lat = parseFloat(document.getElementById('station-lat').value);
    let lon = parseFloat(document.getElementById('station-lon').value);
    const type = document.getElementById('station-type').value;
    const platforms = parseInt(document.getElementById('station-platforms').value) || 4;

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

    const station = this.game.world.addStation({ name, lat, lon, type, platforms });
    station.country = orm.getCountryAtPoint(lat, lon);
    station.facilities = [type];

    const existingStations = this.game.world.stations.filter(s => s.id !== station.id);
    if (existingStations.length > 0) {
      let nearest = null, nearestDist = Infinity;
      for (const s of existingStations) {
        const d = Math.hypot(s.lat - lat, s.lon - lon);
        if (d < nearestDist) { nearestDist = d; nearest = s; }
      }

      if (nearest && nearestDist < 3) {
        const loadingEl = document.getElementById('station-loading');
        if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Calcul du trace ORM en cours...'; }

        try {
          const route = await orm.findRoute(nearest.lat, nearest.lon, lat, lon);
          const distance = orm.getRouteDistance(route);
          const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
          const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;

          this.game.world.addTrack({
            stationA: nearest.id, stationB: station.id,
            distance: Math.round(distance), maxSpeed: avgSpeed,
            electrified: true, name: `${nearest.name} - ${name}`,
            route,
          });
          console.log(`Track created: ${nearest.name} -> ${name}, ${Math.round(distance)} km, ${route.length} points, avg ${avgSpeed} km/h`);
        } catch (e) {
          console.warn('ORM route failed:', e);
          const dist = Math.round(Math.sqrt(Math.pow((lat - nearest.lat) * 111, 2) + Math.pow((lon - nearest.lon) * 111 * Math.cos(lat * Math.PI / 180), 2)));
          this.game.world.addTrack({
            stationA: nearest.id, stationB: station.id,
            distance: dist, maxSpeed: 160, name: `${nearest.name} - ${name}`,
          });
          console.log(`Fallback track: ${nearest.name} -> ${name}, ${dist} km (no ORM data)`);
        }
        if (loadingEl) loadingEl.classList.add('hidden');
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
    document.getElementById('stock-image-preview')?.classList.add('hidden');
    this._stockImageData = null;
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
          <span>${item.name}</span>
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
    const vmax = this.currentRameElements.length > 0 ? Math.min(...this.currentRameElements.map(e => e.maxSpeed)) : 0;
    const tractors = this.currentRameElements.filter(e => e.category === 'locomotive' || e.category === 'automotrice');
    const traction = tractors.length > 0 ? [...new Set(tractors.map(t => t.traction))].join('+') : '-';

    document.getElementById('rame-length').textContent = totalLen.toFixed(1);
    document.getElementById('rame-tonnage').textContent = totalTon;
    document.getElementById('rame-places').textContent = totalCap;
    document.getElementById('rame-vmax').textContent = vmax;
    document.getElementById('rame-traction').textContent = traction;

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

    this.game.rameManager.add({
      name,
      elements: this.currentRameElements.map(e => e.stockId),
      elementDetails: this.currentRameElements.map(e => ({
        name: e.name, category: e.category, traction: e.traction,
        maxSpeed: e.maxSpeed, tonnage: e.tonnage,
        mass: e.mass || e.tonnage, power: e.power || 0,
        passengerCapacity: e.passengerCapacity, freightCapacity: e.freightCapacity,
        length: e.length, imageData: e.imageData,
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
          <b>Places:</b> ${r.totalCapacity} | <b>Vmax:</b> ${r.maxSpeed} km/h |
          <b>Traction:</b> ${r.traction}
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
  }

  openScheduleModal() {
    this.schedStops = [];
    document.getElementById('sched-name').value = '';
    document.getElementById('sched-round-trip')?.removeAttribute('checked');
    document.getElementById('sched-terminus-wait').value = '10';
    document.getElementById('modal-schedule')?.classList.remove('hidden');

    const rameSelect = document.getElementById('sched-rame');
    const rames = this.game.rameManager.getAll();
    rameSelect.innerHTML = rames.map(r => `<option value="${r.id}">${r.name} (${r.maxSpeed} km/h)</option>`).join('');
    rameSelect.onchange = () => this.recalcStopsFrom(1);

    this.renderSchedStops();
    this.setupSchedMap();
  }

  setupSchedMap() {
    const canvas = document.getElementById('sched-map-canvas');
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight || 300;

    const ctx = canvas.getContext('2d');
    const world = this.game.world;

    if (!this.schedMapTileMap) {
      const { TileMap } = window._TileMapClass || {};
      this.schedMapZoom = 7.5;
      this.schedMapCenter = { lat: 49.75, lon: 2.7 };
    }

    const drawMap = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const track of world.tracks) {
        const a = world.getStationById(track.stationA);
        const b = world.getStationById(track.stationB);
        if (!a || !b) continue;
        const pa = this.miniProject(a, canvas);
        const pb = this.miniProject(b, canvas);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }

      for (const st of world.stations) {
        const p = this.miniProject(st, canvas);
        const isSelected = this.schedStops.some(s => s.stationId === st.id);
        ctx.fillStyle = isSelected ? '#fbbf24' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px sans-serif';
        ctx.fillText(st.name, p.x + 7, p.y + 3);
      }

      for (let i = 0; i < this.schedStops.length - 1; i++) {
        const sa = world.getStationById(this.schedStops[i].stationId);
        const sb = world.getStationById(this.schedStops[i + 1].stationId);
        if (!sa || !sb) continue;
        const pa = this.miniProject(sa, canvas);
        const pb = this.miniProject(sb, canvas);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }
    };

    drawMap();

    let schedDrag = false, schedDragStart = null;

    canvas.onmousedown = (e) => { schedDrag = true; schedDragStart = { x: e.offsetX, y: e.offsetY }; };
    canvas.onmousemove = (e) => {
      if (schedDrag && schedDragStart) {
        const dx = e.offsetX - schedDragStart.x;
        const dy = e.offsetY - schedDragStart.y;
        if (this.schedMapCenter) {
          const latRange = this.getMinimapLatRange();
          this.schedMapCenter.lat += dy * (latRange.range / canvas.height);
          this.schedMapCenter.lon -= dx * (latRange.lonRange / canvas.width);
        }
        schedDragStart = { x: e.offsetX, y: e.offsetY };
        drawMap();
      }
    };
    canvas.onmouseup = (e) => {
      if (!schedDrag || (schedDragStart && Math.abs(e.offsetX - schedDragStart.x) < 3 && Math.abs(e.offsetY - schedDragStart.y) < 3)) {
        const x = e.offsetX, y = e.offsetY;
        let closest = null, minDist = Infinity;
        for (const st of world.stations) {
          const p = this.miniProject(st, canvas);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < minDist && d < 15) { minDist = d; closest = st; }
        }
        if (closest) this.addSchedStop(closest);
      }
      schedDrag = false;
    };

    canvas.onwheel = (e) => {
      e.preventDefault();
      this.schedMapZoom = Math.max(3, Math.min(15, (this.schedMapZoom || 7.5) + (e.deltaY < 0 ? 0.5 : -0.5)));
      drawMap();
    };

    this._drawSchedMap = drawMap;
  }

  getMinimapLatRange() {
    const world = this.game.world;
    if (world.stations.length === 0) return { min: 45, max: 52, range: 7, minLon: -2, maxLon: 6, lonRange: 8 };
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const st of world.stations) {
      minLat = Math.min(minLat, st.lat); maxLat = Math.max(maxLat, st.lat);
      minLon = Math.min(minLon, st.lon); maxLon = Math.max(maxLon, st.lon);
    }
    const padLat = Math.max((maxLat - minLat) * 0.2, 1);
    const padLon = Math.max((maxLon - minLon) * 0.2, 1);
    return {
      min: minLat - padLat, max: maxLat + padLat, range: maxLat - minLat + 2 * padLat,
      minLon: minLon - padLon, maxLon: maxLon + padLon, lonRange: maxLon - minLon + 2 * padLon,
    };
  }

  miniProject(station, canvas) {
    const r = this.getMinimapLatRange();
    const zoom = this.schedMapZoom || 7.5;
    const zoomFactor = Math.pow(2, zoom - 7.5);
    const cx = this.schedMapCenter?.lon ?? ((r.minLon + r.maxLon) / 2);
    const cy = this.schedMapCenter?.lat ?? ((r.min + r.max) / 2);
    const visLonRange = r.lonRange / zoomFactor;
    const visLatRange = r.range / zoomFactor;
    const x = ((station.lon - cx) / visLonRange + 0.5) * canvas.width;
    const y = ((cy - station.lat) / visLatRange + 0.5) * canvas.height;
    return { x, y };
  }

  async addSchedStop(station) {
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
            const dist = Math.sqrt(Math.pow((station.lat - prevStation.lat) * 111, 2) + Math.pow((station.lon - prevStation.lon) * 111 * Math.cos(station.lat * Math.PI / 180), 2));
            travelTime = Math.ceil((dist / rameSpeed) * 60 * 1.15);
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
    });

    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
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

    container.innerHTML = this.schedStops.map((stop, i) => {
      const isFirst = i === 0;
      const isLast = i === this.schedStops.length - 1;
      const travelInfo = (i > 0) ? (() => {
        const prev = this.schedStops[i - 1];
        const travelMin = stop.arrTimeMin - prev.depTimeMin;
        return `<div style="font-size:9px;color:var(--text3);text-align:center;padding:1px 0">↓ ${travelMin} min</div>`;
      })() : '';
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
          ` : stop.type === 'passage' ? `
            <label style="font-size:9px;color:var(--text3)">Pass:</label>
            <input type="text" value="${stop.arrTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'arrTime', this.value)">
          ` : `
            <label style="font-size:9px;color:var(--text3)">Arr:</label>
            <input type="text" value="${stop.arrTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'arrTime', this.value)" ${isFirst ? 'disabled' : ''}>
            <label style="font-size:9px;color:var(--text3)">Dep:</label>
            <input type="text" value="${stop.depTimeStr}" style="width:55px" onchange="game.ui.updateSchedStop(${i}, 'depTime', this.value)" ${isLast ? 'disabled' : ''}>
          `}
          <button class="btn-remove-stop" onclick="game.ui.removeSchedStop(${i})">x</button>
        </div>
      `;
    }).join('');
  }

  updateSchedStop(index, field, value) {
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
    // Auto-recalculate all subsequent stops
    this.recalcStopsFrom(index + 1);
    this.renderSchedStops();
  }

  async recalcStopsFrom(fromIndex) {
    if (fromIndex >= this.schedStops.length || fromIndex < 1) return;

    const rameId = document.getElementById('sched-rame')?.value;
    const rame = this.game.rameManager.getById(rameId);
    const rameSpeed = rame ? rame.maxSpeed : 160;

    for (let i = fromIndex; i < this.schedStops.length; i++) {
      const prevStop = this.schedStops[i - 1];
      const curStop = this.schedStops[i];

      const prevStation = this.game.world.getStationById(prevStop.stationId);
      const curStation = this.game.world.getStationById(curStop.stationId);

      let travelTime = 15;
      if (prevStation && curStation) {
        const existingTrack = this.game.world.getTrackBetween(prevStation.id, curStation.id);
        if (existingTrack && existingTrack.route && existingTrack.route.length > 1) {
          travelTime = this.game.orm.calculateTravelTime(existingTrack.route, rameSpeed);
        } else {
          try {
            const route = await this.game.orm.findRoute(prevStation.lat, prevStation.lon, curStation.lat, curStation.lon);
            travelTime = this.game.orm.calculateTravelTime(route, rameSpeed);
          } catch (e) {
            const dist = Math.sqrt(Math.pow((curStation.lat - prevStation.lat) * 111, 2) + Math.pow((curStation.lon - prevStation.lon) * 111 * Math.cos(curStation.lat * Math.PI / 180), 2));
            travelTime = Math.ceil((dist / rameSpeed) * 60 * 1.15);
          }
        }
      }

      curStop.arrTimeMin = prevStop.depTimeMin + travelTime;
      curStop.arrTimeStr = this.minToTimeStr(curStop.arrTimeMin);

      if (curStop.type === 'passage' || curStop.type === 'waypoint') {
        curStop.depTimeMin = curStop.arrTimeMin;
        curStop.depTimeStr = curStop.arrTimeStr;
      } else {
        const stopDuration = Math.max(2, (curStop.depTimeMin || 0) - (curStop.arrTimeMin || 0));
        curStop.depTimeMin = curStop.arrTimeMin + (i === this.schedStops.length - 1 ? 0 : Math.max(stopDuration, 2));
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

    const routes = [];
    for (let i = 0; i < this.schedStops.length - 1; i++) {
      const fromSt = this.game.world.getStationById(this.schedStops[i].stationId);
      const toSt = this.game.world.getStationById(this.schedStops[i + 1].stationId);
      if (fromSt && toSt) {
        const existingTrack = this.game.world.getTrackBetween(fromSt.id, toSt.id);
        if (existingTrack && existingTrack.route && existingTrack.route.length > 1) {
          const needReverse = existingTrack.stationA !== fromSt.id;
          routes.push(needReverse ? [...existingTrack.route].reverse() : existingTrack.route);
        } else {
          try {
            const route = await this.game.orm.findRoute(fromSt.lat, fromSt.lon, toSt.lat, toSt.lon);
            routes.push(route);
          } catch (e) {
            console.warn('ORM route failed:', e);
            routes.push([{ lat: fromSt.lat, lon: fromSt.lon, maxSpeed: 160 }, { lat: toSt.lat, lon: toSt.lon, maxSpeed: 160 }]);
          }
        }
      } else {
        routes.push([]);
      }
    }

    const stops = this.schedStops.map(s => ({
      stationId: s.stationId,
      type: s.type,
      departureTime: s.depTimeMin,
      arrivalTime: s.arrTimeMin,
    }));

    let totalDist = 0;
    for (const route of routes) {
      totalDist += this.game.orm.getRouteDistance(route);
    }

    this.game.scheduleCreator.addService({
      name, rameId, stops, routes, roundTrip, multiDepartures, terminusWait, totalDistance: Math.round(totalDist),
    }, rame, this.game.world);

    document.getElementById('modal-schedule')?.classList.add('hidden');
    this.renderSchedulesList();
  }

  renderSchedulesList() {
    const container = document.getElementById('schedules-list');
    if (!container) return;
    const services = this.game.scheduleCreator.services;
    if (services.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun trajet. Cliquer "+ Creer un trajet" pour commencer.</p>';
      return;
    }

    container.innerHTML = services.map(svc => {
      const stopsPreview = svc.stops.map(s => {
        const st = this.game.world.getStationById(s.stationId);
        const name = st ? st.name : s.stationId;
        const arr = this.minToTimeStr(s.arrivalTime);
        const dep = this.minToTimeStr(s.departureTime);
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
          return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
        }).join('<span style="color:var(--text3)"> → </span>');
        returnPreview = `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#f59e0b;font-size:9px;margin-right:4px">↩ Retour (${svc.terminusWait} min attente):</span>${retStr}</div>`;
      }

      const rame = this.game.rameManager.getById(svc.rameId);
      const statusLabel = svc.isReturnLeg ? '<span style="color:#f59e0b;font-size:9px"> (retour)</span>' : '';
      return `
        <div class="sched-item">
          <div class="sched-item-header">
            <span class="sched-item-name">${svc.name}${statusLabel}</span>
            <span class="sched-item-rame">${rame ? rame.name : 'N/A'}</span>
            <span style="color:var(--text3);font-size:10px">${Math.round(svc.totalDistance)} km${svc.roundTrip ? ' A/R' : ''}</span>
            <button class="btn-sm" onclick="game.ui.toggleSchedule('${svc.id}')">${svc.active ? 'Desactiver' : 'Activer'}</button>
            <button class="btn-sm danger" onclick="game.ui.deleteSchedule('${svc.id}')">Supprimer</button>
          </div>
          <div class="sched-stops-preview">${stopsPreview}</div>
          ${returnPreview}
        </div>
      `;
    }).join('');
  }

  toggleSchedule(id) {
    const svc = this.game.scheduleCreator.services.find(s => s.id === id);
    if (svc) svc.active = !svc.active;
    this.renderSchedulesList();
  }

  deleteSchedule(id) {
    this.game.scheduleCreator.removeService(id);
    this.renderSchedulesList();
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

    const renderList = (items) => items.length === 0
      ? '<p style="color:var(--text3);font-size:11px;padding:10px">Aucun</p>'
      : items.map(d => {
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
        }).join('');

    if (depotsContainer) depotsContainer.innerHTML = renderList(depots);
    if (iteContainer) iteContainer.innerHTML = renderList(ites);
  }

  deleteDepot(id) {
    this.game.depotManager.remove(id);
    this.renderDepotsList();
  }

  // --- INCIDENTS ---
  setupIncidentPage() {
    document.getElementById('btn-add-incident-type')?.addEventListener('click', () => {
      this.editingIncidentId = null;
      document.getElementById('inc-name').value = '';
      document.getElementById('inc-dur-min').value = '15';
      document.getElementById('inc-dur-max').value = '60';
      document.getElementById('inc-impact').value = 'slow';
      document.getElementById('inc-speed-limit').value = '30';
      document.getElementById('inc-probability').value = '0.01';
      document.getElementById('modal-incident')?.classList.remove('hidden');
    });
    document.getElementById('inc-impact')?.addEventListener('change', (e) => {
      document.getElementById('inc-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
    });
    document.getElementById('btn-save-incident-type')?.addEventListener('click', () => this.saveIncidentType());
    document.getElementById('btn-add-works')?.addEventListener('click', () => this.openWorksModal());
    document.getElementById('works-impact')?.addEventListener('change', (e) => {
      document.getElementById('works-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
    });
    document.getElementById('btn-save-works')?.addEventListener('click', () => this.saveWorks());
  }

  saveIncidentType() {
    const data = {
      name: document.getElementById('inc-name').value.trim() || 'Incident',
      impact: document.getElementById('inc-impact').value,
      speedLimit: parseInt(document.getElementById('inc-speed-limit').value) || 30,
      minDuration: parseInt(document.getElementById('inc-dur-min').value) || 15,
      maxDuration: parseInt(document.getElementById('inc-dur-max').value) || 60,
      probability: parseFloat(document.getElementById('inc-probability').value) || 0.01,
    };

    if (this.editingIncidentId) {
      this.game.incidentManager.updateCustomType(this.editingIncidentId, data);
    } else {
      this.game.incidentManager.addCustomType(data);
    }
    this.editingIncidentId = null;
    document.getElementById('modal-incident')?.classList.add('hidden');
    this.renderIncidentsPage();
  }

  editIncidentType(id) {
    const type = this.game.incidentManager.customTypes.find(t => t.id === id);
    if (!type) return;
    this.editingIncidentId = id;
    document.getElementById('inc-name').value = type.name;
    document.getElementById('inc-dur-min').value = type.minDuration;
    document.getElementById('inc-dur-max').value = type.maxDuration;
    document.getElementById('inc-impact').value = type.effect === 'stop' ? 'stop' : 'slow';
    document.getElementById('inc-speed-limit').value = type.speedLimit || 30;
    document.getElementById('inc-probability').value = type.probability;
    document.getElementById('inc-speed-group').style.display = type.effect === 'slow' ? 'block' : 'none';
    document.getElementById('modal-incident')?.classList.remove('hidden');
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
    const typesList = document.getElementById('incident-types-list');
    const worksList = document.getElementById('planned-works-list');

    const active = this.game.incidentManager.getActiveIncidents();
    if (activeList) {
      activeList.innerHTML = active.length === 0
        ? '<div class="no-incidents">Aucun incident en cours</div>'
        : active.map(inc => `
            <div class="incident-item">
              <span class="incident-icon">${inc.icon || '⚠'}</span>
              <div>
                <div class="incident-name">${inc.name}</div>
                <div class="incident-desc">${inc.trackName || 'Zone inconnue'} - ${inc.effect === 'stop' ? '<span style="color:#7B1E1E;font-weight:700">Interruption</span>' : '<span style="color:#FFE135;font-weight:700">Ralenti ' + (inc.speedLimit || 30) + ' km/h</span>'}</div>
                <div class="incident-time">${Math.ceil(inc.remaining)} min restantes</div>
              </div>
            </div>
          `).join('');
    }

    const breakdown = this.game.incidentManager.getBreakdownQueue();
    if (activeList && breakdown.length > 0) {
      activeList.innerHTML += '<h4 style="margin-top:10px;color:var(--red)">Rames en panne (depot requis)</h4>' +
        breakdown.map(b => `<div class="incident-item"><span class="incident-icon">!</span><div>${b.serviceName}</div></div>`).join('');
    }

    const allTypes = this.game.incidentManager.getAllTypes();
    if (typesList) {
      typesList.innerHTML = allTypes.map(t => `
        <div class="card">
          <div class="card-title">${t.icon || '!'} ${t.name}</div>
          <div class="card-info">
            <b>Impact:</b> ${t.effect === 'stop' ? 'Interruption' : 'Ralenti ' + t.speedLimit + ' km/h'}<br>
            <b>Duree:</b> ${t.minDuration}-${t.maxDuration} min<br>
            <b>Proba/h:</b> ${(t.probability * 100).toFixed(1)}%
          </div>
          ${t.custom ? `<div class="card-actions">
            <button class="btn-sm" onclick="game.ui.editIncidentType('${t.id}')">Modifier</button>
            <button class="btn-sm danger" onclick="game.ui.deleteIncidentType('${t.id}')">Supprimer</button>
          </div>` : ''}
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
                Impact: ${w.impact === 'stop' ? 'Interruption' : 'Ralenti ' + w.speedLimit + ' km/h'}
                ${w.active ? ' <b style="color:var(--red)">EN COURS</b>' : ''}
                <button class="btn-sm danger" style="float:right" onclick="game.ui.deleteWorks('${w.id}')">x</button>
              </div>
            `;
          }).join('');
    }
  }

  deleteIncidentType(id) {
    this.game.incidentManager.removeCustomType(id);
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
  }

  renderEconomyPage() {
    const eco = this.game.economy;
    const el = (id) => document.getElementById(id);
    if (el('eco-balance')) el('eco-balance').textContent = eco.formatAmount(eco.balance);
    if (el('eco-revenue')) el('eco-revenue').textContent = '+' + eco.formatAmount(eco.revenue);
    if (el('eco-expenses')) el('eco-expenses').textContent = '-' + eco.formatAmount(eco.expenses);
    if (el('eco-penalties')) el('eco-penalties').textContent = '-' + eco.formatAmount(eco.penalties);

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

    // Show only active trains (moving or stopped at station)
    const activeTrains = services.filter(svc =>
      svc.state === 'moving' || svc.state === 'stopped_at_station' ||
      (svc.train && svc.train.speed > 0)
    );

    if (activeTrains.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:10px">Aucun train en service. Creez un trajet dans "Horaires".</p>';
      return;
    }

    container.innerHTML = activeTrains.map(svc => {
      const t = svc.train;
      const stateLabel = t.breakdown ? 'En panne' :
        t.blockedBy ? 'Bloque (cantonnement)' :
        t.incident ? `Incident: ${t.incident.name}` :
        svc.state === 'waiting' ? 'En attente' :
        svc.state === 'moving' ? (t.speed > 0 ? 'En ligne' : 'Arret') :
        'En gare';
      const stateClass = t.breakdown ? 'status-stopped' :
        t.blockedBy ? 'status-stopped' :
        t.incident ? 'status-stopped' :
        svc.state === 'moving' && t.speed > 0 ? 'status-moving' :
        svc.state === 'waiting' ? 'status-waiting' : 'status-stopped';
      const nextStop = svc.getNextStop();
      const targetStation = svc.getTargetStation();
      const nextInfo = nextStop
        ? `${nextStop.type === 'arret' ? 'Arr.' : 'Pass.'} ${this.minToTimeStr(nextStop.arrivalTime)} ${targetStation?.name || ''}`
        : 'Service termine';

      const ramePreview = svc.rame ? svc.rame.elementDetails.map(e =>
        e.imageData ? `<img src="${e.imageData}">` : ''
      ).join('') : '';

      return `
        <div class="train-item">
          <div class="train-header">
            <span class="train-color" style="background:${t.color}"></span>
            <span class="train-name">${svc.name}</span>
            <span class="train-speed">${Math.round(t.speed)} km/h</span>
          </div>
          <div class="train-details">
            <span class="${stateClass}">${stateLabel}</span>
            <span class="train-next">${nextInfo}</span>
          </div>
          <div class="train-meta">
            <span>Retard: <b class="${t.delay > 0 ? 'delay-late' : 'delay-ok'}">${t.delay} min</b></span>
            <span>${Math.round(svc.totalDistance)} km</span>
          </div>
          ${ramePreview ? `<div class="train-rame-preview">${ramePreview}</div>` : ''}
        </div>
      `;
    }).join('');
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
      const label = `${inc.icon} ${inc.name} - ${zone} (${Math.ceil(inc.remaining)} min)`;
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

    // Update dual banners
    if (bannerInterruptions) {
      if (interruptions.length > 0) {
        bannerInterruptions.textContent = interruptions.join(' | ');
        bannerInterruptions.classList.remove('hidden');
      } else {
        bannerInterruptions.classList.add('hidden');
      }
    }
    if (bannerSlowdowns) {
      if (slowdowns.length > 0) {
        bannerSlowdowns.textContent = slowdowns.join(' | ');
        bannerSlowdowns.classList.remove('hidden');
      } else {
        bannerSlowdowns.classList.add('hidden');
      }
    }

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
}
