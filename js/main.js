import { SimulationEngine } from './engine.js?v=1784200000';
import { SeededRng, setGlobalRng } from './rng.js?v=1784200000';
import { World, createDefaultWorld } from './world.js?v=1784200000';
import { Renderer } from './renderer.js?v=1784200000';
import { UI } from './ui.js?v=1784200000';
import { Economy } from './economy.js?v=1784200000';
import { IncidentManager } from './incidents.js?v=1784200000';
import { FreightManager } from './freight.js?v=1784200000';
import { ScheduleManager } from './schedule.js?v=1784200000';
import { GameStorage } from './storage.js?v=1784200000';
import { AccountManager } from './account.js?v=1784200000';
import { RollingStockManager } from './rolling-stock.js?v=1784200000';
import { RameManager } from './rame.js?v=1784200000';
import { ScheduleCreator, cantonManager } from './schedule-creator.js?v=1784200000';
import { DepotManager } from './depot.js?v=1784200000';
import { WorksManager } from './works.js?v=1784200000';
import { ORMClient } from './orm.js?v=1784200000';
import { LineManager, PlatformManager } from './line.js?v=1784200000';
import { SillonManager } from './sillon.js?v=1784200000';
import { VoiePointManager } from './voie-points.js?v=1784200000';
import { Dashboard } from './dashboard.js?v=1784200000';
import { GraphMarche } from './graph-marche.js?v=1784200000';
import { StaffManager } from './staff.js?v=1784200000';
import { Tutorial } from './tutorial.js?v=1784200000';
import { Bank } from './bank.js?v=1784200000';
import { Weather } from './weather.js?v=1784200000';
import { Unions } from './unions.js?v=1784200000';
import { SeasonalSchedule } from './seasonal.js?v=1784200000';
import { Connections } from './connections.js?v=1784200000';
import { StationUpgrades } from './station-upgrades.js?v=1784200000';
import { A12Model } from './a12-model.js?v=1784200000';
import { PlayerSignalManager } from './signaling.js?v=1784200000';
import { JunctionManager } from './junctions.js?v=1784200000';
import { CargoTypeManager } from './cargo-types.js?v=1784200000';
import { ITEModules } from './ite-modules.js?v=1784200000';
import { IndustrialClients } from './industrial-clients.js?v=1784200000';
import { ShuntingManager } from './shunting.js?v=1784200000';
import { CATALOG, CATALOG_CARGO_TYPES } from './catalog-data.js?v=1784200000';
import { getWTrafficCatalog } from './catalog-data-wtraffic.js?v=1784200000';
import { CATALOG_PACK_RE } from './catalog-data-pack-re.js?v=1784200000';
import { adminSync } from './admin-sync.js?v=1784200000';

class RailEmpire {
  constructor() {
    // DET-01 : PRNG déterministe de partie
    this.rng = new SeededRng(Date.now());
    setGlobalRng(this.rng);
    // DET-05 : curseurs de réalisme (1.0 = normal)
    this.realismSettings = {
      physics: 2.0,
      weather: 2.0,
      breakdown: 2.0,
      delayTolerance: 120,
    };
    this.engine = new SimulationEngine();
    this.world = createDefaultWorld();
    this.economy = new Economy();
    this.incidentManager = new IncidentManager();
    this.freightManager = new FreightManager();
    this.scheduleManager = new ScheduleManager();
    this.storage = new GameStorage();
    this.account = new AccountManager();
    this.rollingStock = new RollingStockManager();
    this.rameManager = new RameManager();
    this.scheduleCreator = new ScheduleCreator();
    this.depotManager = new DepotManager();
    this.worksManager = new WorksManager();
    this.orm = new ORMClient();
    this.lineManager = new LineManager();
    this.sillonManager = new SillonManager();
    this.platformManager = new PlatformManager();
    this.voiePointManager = new VoiePointManager();
    // R-08 : brancher les aiguillages/tronçons utilisateur au graphe de routage ORM
    this.orm.setUserTronconProvider(() => this.voiePointManager.getAllTroncons());
    this.voiePointManager.onChange = () => this.orm.markGraphDirty();
    this.dashboard = new Dashboard();
    this.graphMarche = new GraphMarche();
    this.staffManager = new StaffManager();
    this.tutorial = new Tutorial();
    this.bank = new Bank();
    this.weather = new Weather();
    this.a12Model = new A12Model(this);
    this.signalManager = new PlayerSignalManager();
    this.scheduleCreator.weather = this.weather;
    this.unions = new Unions();
    this.seasonal = new SeasonalSchedule();
    this.connections = new Connections();
    this.stationUpgrades = new StationUpgrades();
    this.junctionManager = new JunctionManager();
    this.cargoTypes = new CargoTypeManager();
    this.iteModules = new ITEModules();
    this.industrialClients = new IndustrialClients();
    this.shuntingManager = new ShuntingManager();
    this.cantonManager = cantonManager;
    this.renderer = null;
    this.ui = null;
    this.running = false;
    this.autoSaveInterval = null;

    this.init();
  }

  async init() {
    const btnNew = document.getElementById('btn-new-game');
    const btnLoad = document.getElementById('btn-load-game');
    const nameInput = document.getElementById('login-name');

    if (this.storage.hasSave()) {
      btnLoad.style.display = 'block';
      const saved = await this.storage.loadGame();
      if (saved?.companyName) {
        nameInput.value = saved.companyName;
      }
    }

    btnNew.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) return alert('Entrez un nom de compagnie');
      this.account.companyName = name;
      this.startGame(null);
    });

    btnLoad.addEventListener('click', async () => {
      const saved = await this.storage.loadGame();
      if (saved) {
        this.account.companyName = saved.companyName;
        this.loadState(saved);
        this.startGame(saved);
      }
    });

    // Import save file from login screen
    const btnImport = document.getElementById('btn-import-file');
    const importInput = document.getElementById('import-file-input');
    btnImport.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        let text;
        if (file.name.endsWith('.gz')) {
          const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
          text = await new Response(stream).text();
        } else {
          text = await file.text();
        }
        const saved = JSON.parse(text);
        if (!saved.companyName) throw new Error('Fichier invalide');
        this.account.companyName = saved.companyName;
        nameInput.value = saved.companyName;
        this.loadState(saved);
        this.storage.saveGame(saved);
        this.startGame(saved);
      } catch (err) {
        alert('Erreur: fichier de sauvegarde invalide.\n' + err.message);
      }
    });
  }

  startGame(savedState) {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    document.getElementById('company-name').textContent = this.account.companyName;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas);
    this.ui = new UI(this);
    this.ui.setupAll();

    // Setup station creation button (double-click = multi-creation mode)
    document.getElementById('btn-create-station')?.addEventListener('click', () => {
      this.ui.toggleStationCreation();
    });
    document.getElementById('btn-create-station')?.addEventListener('dblclick', () => {
      this.ui._multiCreateMode = 'station';
      if (!this.ui.stationCreationMode) this.ui.toggleStationCreation();
      document.getElementById('btn-create-station')?.classList.add('multi-mode');
    });
    document.getElementById('btn-save-station')?.addEventListener('click', () => {
      this.ui.saveStation();
    });

    // Save to file button
    document.getElementById('btn-save-file')?.addEventListener('click', () => {
      this.exportSaveFile();
    });

    // Load from file button
    const loadFileInput = document.getElementById('load-file-input');
    document.getElementById('btn-load-file')?.addEventListener('click', () => {
      loadFileInput.click();
    });
    loadFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        let text;
        if (file.name.endsWith('.gz')) {
          // Decompress gzipped file
          const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
          text = await new Response(stream).text();
        } else {
          text = await file.text();
        }
        const saved = JSON.parse(text);
        if (!saved.companyName) throw new Error('Fichier invalide');
        this.loadState(saved);
        this.storage.saveGame(saved);
        this.account.companyName = saved.companyName;
        document.getElementById('company-name').textContent = saved.companyName;
        if (this.ui) this.ui.refreshAll();
        alert('Partie chargee avec succes !');
      } catch (err) {
        alert('Erreur: fichier de sauvegarde invalide.\n' + err.message);
      }
      e.target.value = '';
    });

    this.seedCatalog();

    // Load admin overrides (async, non-blocking)
    adminSync.loadOverrides().then(() => {
      if (adminSync.loaded) {
        // Re-seed catalog with overrides applied
        this.seedCatalog();
        // Start incident loop
        adminSync.startIncidentLoop(() => new Date());
      }
    });

    // Settings modal
    this._setupSettings();

    // Incident toast notifications
    window.addEventListener('admin-incident', (e) => {
      const inc = e.detail;
      const toast = document.getElementById('incident-toast');
      document.getElementById('incident-toast-title').textContent = inc.name;
      document.getElementById('incident-toast-desc').textContent = inc.description || '';
      document.getElementById('incident-toast-duration').textContent = `Durée : ${inc.duration} min`;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 8000);
    });

    this.engine.paused = false;
    this.running = true;
    this.engine.onTick = (timeOfDay, dateStr, pt) => this.tick(timeOfDay, dateStr, pt);
    this.engine.onMoveTick = (dt, timeOfDay) => this.moveTick(dt, timeOfDay);
    this.gameLoop();
    // Reload previously loaded OSM areas after save restore (async, non-blocking)
    this.orm.reloadAreas().catch(() => {});
    // Clear previous autoSave interval to prevent double-save on re-login
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => this.saveState(), 10000);

    // Save on tab hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveState();
      }
    });
  }

  // Seed the built-in rolling-stock catalog (idempotent: only adds missing entries by id).
  // Also auto-adds any cargo type referenced by the catalog that the game doesn't know yet.
  seedCatalog() {
    // 1) Ensure cargo types declared by the catalog exist (add the missing ones).
    if (Array.isArray(CATALOG_CARGO_TYPES) && this.cargoTypes?.ensureType) {
      for (const ct of CATALOG_CARGO_TYPES) this.cargoTypes.ensureType(ct.category, ct);
    }
    // 2) Seed the rolling-stock entries (MLG + WTraffic).
    let allCatalog = [...(Array.isArray(CATALOG) ? CATALOG : [])];
    try {
      const wt = getWTrafficCatalog();
      if (Array.isArray(wt)) allCatalog = allCatalog.concat(wt);
    } catch(e) { console.warn('WTraffic catalog load error:', e); }
    if (Array.isArray(CATALOG_PACK_RE)) allCatalog = allCatalog.concat(CATALOG_PACK_RE);
    // 3) Apply admin overrides (modifications, deletions, imports published by admin)
    allCatalog = adminSync.applyCatalogOverrides(allCatalog);
    const existing = new Set(this.rollingStock.getAll().map(i => i.id));
    let added = 0;
    for (const entry of allCatalog) {
      if (existing.has(entry.id)) continue;
      this.rollingStock.add({ ...entry, _catalog: true });
      added++;
    }
    if (added && this.ui) this.ui.renderStockList();
  }

  _setupSettings() {
    const modal = document.getElementById('modal-settings');
    const btnSettings = document.getElementById('btn-settings');
    const nameInput = document.getElementById('settings-company-name');
    const logoInput = document.getElementById('settings-logo-url');
    const colorInput = document.getElementById('settings-company-color');
    const incidentsToggle = document.getElementById('settings-incidents-enabled');
    const physicsInput = document.getElementById('settings-physics');
    const weatherInput = document.getElementById('settings-weather');
    const breakdownInput = document.getElementById('settings-breakdown');
    const delayToleranceInput = document.getElementById('settings-delay-tolerance');
    const physicsVal = document.getElementById('settings-physics-val');
    const weatherVal = document.getElementById('settings-weather-val');
    const breakdownVal = document.getElementById('settings-breakdown-val');
    const delayToleranceVal = document.getElementById('settings-delay-tolerance-val');
    const saveBtn = document.getElementById('settings-save');

    // Load saved settings
    const settings = JSON.parse(localStorage.getItem('re_player_settings') || '{}');
    if (settings.realism) {
      this.realismSettings = { ...this.realismSettings, ...settings.realism };
    }

    const updateRealismLabels = () => {
      if (physicsVal) physicsVal.textContent = Number(physicsInput.value).toFixed(2);
      if (weatherVal) weatherVal.textContent = Number(weatherInput.value).toFixed(2);
      if (breakdownVal) breakdownVal.textContent = Number(breakdownInput.value).toFixed(2);
      if (delayToleranceVal) delayToleranceVal.textContent = delayToleranceInput.value;
    };

    [physicsInput, weatherInput, breakdownInput, delayToleranceInput].forEach(el => {
      el?.addEventListener('input', updateRealismLabels);
    });

    btnSettings.addEventListener('click', () => {
      nameInput.value = this.account.companyName || '';
      logoInput.value = settings.logoUrl || '';
      colorInput.value = settings.companyColor || '#3b82f6';
      incidentsToggle.checked = settings.incidentsEnabled !== false;
      physicsInput.value = this.realismSettings.physics ?? 1;
      weatherInput.value = this.realismSettings.weather ?? 1;
      breakdownInput.value = this.realismSettings.breakdown ?? 1;
      delayToleranceInput.value = this.realismSettings.delayTolerance ?? 30;
      updateRealismLabels();
      modal.classList.remove('hidden');
    });

    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.add('hidden'));

    saveBtn.addEventListener('click', () => {
      const newName = nameInput.value.trim();
      if (newName) {
        this.account.companyName = newName;
        document.getElementById('company-name').textContent = newName;
      }
      const logoUrl = logoInput.value.trim();
      const color = colorInput.value;
      const incEnabled = incidentsToggle.checked;
      this.realismSettings.physics = parseFloat(physicsInput.value) || 1;
      this.realismSettings.weather = parseFloat(weatherInput.value) || 1;
      this.realismSettings.breakdown = parseFloat(breakdownInput.value) || 1;
      this.realismSettings.delayTolerance = parseInt(delayToleranceInput.value) || 30;

      // Save settings
      const s = { logoUrl, companyColor: color, incidentsEnabled: incEnabled, realism: { ...this.realismSettings } };
      localStorage.setItem('re_player_settings', JSON.stringify(s));

      // Apply logo
      const logoEl = document.getElementById('company-logo');
      if (logoUrl) {
        logoEl.src = logoUrl;
        logoEl.style.display = 'inline-block';
      } else {
        logoEl.style.display = 'none';
      }

      // Apply incidents opt-in
      adminSync.setOptIn(incEnabled);

      modal.classList.add('hidden');
      this.saveState();
    });

    // Apply logo on load if saved
    if (settings.logoUrl) {
      const logoEl = document.getElementById('company-logo');
      logoEl.src = settings.logoUrl;
      logoEl.style.display = 'inline-block';
    }
  }

  async exportSaveFile() {
    try {
      const state = {
        companyName: this.account.companyName,
        economy: this.economy.toSave(),
        world: this.world.toSave(),
        rollingStock: this.rollingStock.toSave(),
        rames: this.rameManager.toSave(),
        schedules: this.scheduleCreator.toSave(),
        depots: this.depotManager.toSave(),
        activeIncidents: this.incidentManager.getActiveIncidentsSave(),
        incidentEnabledTypes: this.incidentManager.getEnabledTypes(),
        sillons: this.sillonManager.toSave(),
        works: this.worksManager.toSave(),
        freightContracts: this.freightManager.toSave(),
        ormRoutes: this.orm.toSave(),
        lines: this.lineManager.toSave(),
        voiePoints: this.voiePointManager.toSave(),
        dashboard: this.dashboard.toSave(),
        graphMarche: this.graphMarche.toSave(),
        staff: this.staffManager.toSave(),
        cargoTypes: this.cargoTypes.toSave(),
        iteModules: this.iteModules.toSave(),
        industrialClients: this.industrialClients.toSave(),
        shunting: this.shuntingManager.toSave(),
        signals: this.signalManager.toSave(),
        exportDate: new Date().toISOString(),
      };
      const json = JSON.stringify(state);
      const filename = `rail-empire-${this.account.companyName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}`;

      // Try gzip compression for smaller file
      let blob, ext;
      if (typeof CompressionStream !== 'undefined') {
        try {
          const encoder = new TextEncoder();
          const stream = new Blob([encoder.encode(json)])
            .stream()
            .pipeThrough(new CompressionStream('gzip'));
          blob = await new Response(stream).blob();
          ext = '.json.gz';
        } catch (e) {
          blob = new Blob([json], { type: 'application/json' });
          ext = '.json';
        }
      } else {
        blob = new Blob([json], { type: 'application/json' });
        ext = '.json';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke to ensure download starts on slow browsers
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Export save error:', e);
      alert('Erreur lors de la sauvegarde: ' + e.message);
    }
  }

  loadState(s) {
    if (s.economy) this.economy.loadFromSave(s.economy);
    if (s.world) this.world.loadFromSave(s.world);
    if (s.rollingStock) this.rollingStock.loadFromSave(s.rollingStock);
    if (s.rames) this.rameManager.loadFromSave(s.rames);
    if (s.schedules) this.scheduleCreator.loadFromSave(s.schedules, this.rameManager, this.world);
    if (s.depots) this.depotManager.loadFromSave(s.depots);
    if (s.activeIncidents) this.incidentManager.loadFromSave(s.activeIncidents, this.world);
    if (s.incidentEnabledTypes) this.incidentManager.setEnabledTypes(s.incidentEnabledTypes);
    if (s.works) this.worksManager.loadFromSave(s.works);
    if (s.freightContracts) this.freightManager.loadFromSave(s.freightContracts);
    if (s.ormRoutes) this.orm.loadFromSave(s.ormRoutes);
    if (s.lines) this.lineManager.loadFromSave(s.lines);
    if (s.sillons) this.sillonManager.loadFromSave(s.sillons);
    if (s.voiePoints) this.voiePointManager.loadFromSave(s.voiePoints);
    // R-08 : les tronçons utilisateur doivent être rebranchés au graphe après chargement
    if (s.voiePoints || s.ormRoutes) this.orm.markGraphDirty();
    if (s.dashboard) this.dashboard.loadFromSave(s.dashboard);
    if (s.graphMarche) this.graphMarche.loadFromSave(s.graphMarche);
    if (s.staff) this.staffManager.loadFromSave(s.staff);
    if (s.bank) this.bank.loadFromSave(s.bank);
    if (s.weather) this.weather.loadFromSave(s.weather);
    if (s.unions) this.unions.loadFromSave(s.unions);
    if (s.seasonal) this.seasonal.loadFromSave(s.seasonal);
    if (s.connections) this.connections.loadFromSave(s.connections);
    if (s.stationUpgrades) this.stationUpgrades.loadFromSave(s.stationUpgrades);
    if (s.junctions) this.junctionManager.loadFromSave(s.junctions);
    if (s.cargoTypes) this.cargoTypes.loadFromSave(s.cargoTypes);
    if (s.iteModules) this.iteModules.loadFromSave(s.iteModules);
    if (s.industrialClients) this.industrialClients.loadFromSave(s.industrialClients);
    if (s.shunting) this.shuntingManager.loadFromSave(s.shunting);
    if (s.signals) this.signalManager.loadFromSave(s.signals);
    if (this.rng && typeof s.rngState === 'number') this.rng.setState(s.rngState);
    // Clear voie point occupations on reload (prevent ghost occupations after crash)
    for (const vp of this.voiePointManager.getAll()) { vp.occupiedBy = null; }
    for (const trc of this.voiePointManager.getAllTroncons()) { trc.occupiedBy = null; }

    // Initialize platform manager for all stations
    for (const st of this.world.stations) {
      this.platformManager.initStation(st.id, st.platforms || 2);
    }

  }

  saveState() {
    // Sync rame km: use the rame's own accumulated km (source of truth),
    // not the sum of all services (which would multiply km)
    for (const svc of this.scheduleCreator.getActiveServices()) {
      if (svc.rame && svc.train) {
        const trainKm = svc.train.totalKmRun || 0;
        const trainMaint = svc.train.kmSinceLastMaint || 0;
        const trainWear = svc.train.wearLevel || 0;
        if (isFinite(trainKm) && trainKm > 0) {
          svc.rame.totalKmRun = Math.max(svc.rame.totalKmRun || 0, trainKm);
        }
        if (isFinite(trainMaint) && trainMaint > 0) {
          svc.rame.kmSinceLastMaint = Math.max(svc.rame.kmSinceLastMaint || 0, trainMaint);
        }
        if (isFinite(trainWear) && trainWear > 0) {
          svc.rame.wearLevel = Math.max(svc.rame.wearLevel || 0, trainWear);
        }
      }
    }
    const state = {
      companyName: this.account.companyName,
      saveTime: Date.now(),
      economy: this.economy.toSave(),
      world: this.world.toSave(),
      rollingStock: this.rollingStock.toSave(),
      rames: this.rameManager.toSave(),
      schedules: this.scheduleCreator.toSave(),
      depots: this.depotManager.toSave(),
      activeIncidents: this.incidentManager.getActiveIncidentsSave(),
      incidentEnabledTypes: this.incidentManager.getEnabledTypes(),
      sillons: this.sillonManager.toSave(),
      works: this.worksManager.toSave(),
      freightContracts: this.freightManager.toSave(),
      ormRoutes: this.orm.toSave(),
      lines: this.lineManager.toSave(),
      voiePoints: this.voiePointManager.toSave(),
      dashboard: this.dashboard.toSave(),
      graphMarche: this.graphMarche.toSave(),
      staff: this.staffManager.toSave(),
      bank: this.bank.toSave(),
      weather: this.weather.toSave(),
      unions: this.unions.toSave(),
      seasonal: this.seasonal.toSave(),
      connections: this.connections.toSave(),
      stationUpgrades: this.stationUpgrades.toSave(),
      junctions: this.junctionManager.toSave(),
      cargoTypes: this.cargoTypes.toSave(),
      iteModules: this.iteModules.toSave(),
      industrialClients: this.industrialClients.toSave(),
      shunting: this.shuntingManager.toSave(),
      signals: this.signalManager.toSave(),
      rngState: this.rng ? this.rng.getState() : null,
    };
    try { this.storage.saveGame(state).catch(e => console.warn('Auto-save failed:', e)); } catch(e) { console.warn('Auto-save failed:', e); }
  }

  moveTick(dt, timeOfDay) {
    const activeServices = this.scheduleCreator.getActiveServices();
    const movingSvcs = this.scheduleCreator.getMovingServices();
    const movingCount = movingSvcs.length;

    // --- BUDGET-BASED ROUND-ROBIN ---
    // At massive scale (>500 moving trains), update a budget of trains per tick
    // to keep frame time under control. All trains get simple position interpolation,
    // but only the budget gets full physics.
    const FULL_BUDGET = 500; // max trains with full physics per tick
    const useRoundRobin = movingCount > FULL_BUDGET;
    if (!this._rrOffset) this._rrOffset = 0;

    // Build spatial hash only for budget trains (no need for all 100K)
    if (!this._spatialGrid) this._spatialGrid = new Map();
    this._spatialGrid.clear();
    // Only build spatial hash for trains that get full physics this tick
    if (useRoundRobin) {
      const end = Math.min(this._rrOffset + FULL_BUDGET, movingCount);
      for (let i = this._rrOffset; i < end; i++) {
        const svc = movingSvcs[i];
        if (!svc.position) continue;
        const gx = Math.floor(svc.position.lat * 20);
        const gy = Math.floor(svc.position.lon * 20);
        const key = gx * 10000 + gy; // numeric key (faster than string concat)
        let cell = this._spatialGrid.get(key);
        if (!cell) { cell = []; this._spatialGrid.set(key, cell); }
        cell.push(svc);
      }
      // Also hash trains near the budget slice for proximity checks
      if (this._rrOffset + FULL_BUDGET > movingCount) {
        for (let i = 0; i < (this._rrOffset + FULL_BUDGET) % movingCount; i++) {
          const svc = movingSvcs[i];
          if (!svc.position) continue;
          const gx = Math.floor(svc.position.lat * 20);
          const gy = Math.floor(svc.position.lon * 20);
          const key = gx * 10000 + gy;
          let cell = this._spatialGrid.get(key);
          if (!cell) { cell = []; this._spatialGrid.set(key, cell); }
          cell.push(svc);
        }
      }
    } else {
      for (let i = 0; i < movingCount; i++) {
        const svc = movingSvcs[i];
        if (!svc.position) continue;
        const gx = Math.floor(svc.position.lat * 20);
        const gy = Math.floor(svc.position.lon * 20);
        const key = gx * 10000 + gy;
        let cell = this._spatialGrid.get(key);
        if (!cell) { cell = []; this._spatialGrid.set(key, cell); }
        cell.push(svc);
      }
    }

    // Incident check — only on the budget slice if round-robin
    if (useRoundRobin) {
      // Check incidents every N ticks for full set, but only budget per tick
      if (!this._incidentCheckTick) this._incidentCheckTick = 0;
      if (this._incidentCheckTick++ % Math.ceil(movingCount / FULL_BUDGET) === 0) {
        this.incidentManager.checkTrainPositions(movingSvcs, this.depotManager, this.world);
      }
    } else {
      this.incidentManager.checkTrainPositions(movingSvcs, this.depotManager, this.world);
    }

    // Physics updates
    for (let i = 0; i < movingCount; i++) {
      const svc = movingSvcs[i];

      if (useRoundRobin) {
        // Is this train in the current budget slice?
        const inBudget = (i >= this._rrOffset && i < this._rrOffset + FULL_BUDGET) ||
                         (this._rrOffset + FULL_BUDGET > movingCount && i < (this._rrOffset + FULL_BUDGET) % movingCount);

        if (!inBudget) {
          // Lightweight interpolation: just advance position along current heading
          if (svc.position && svc.speed > 0) {
            const stepKm = svc.speed * dt / 3600;
            if (svc._state?.cachedRoute && svc._state.index < svc._state.cachedRoute.length - 1) {
              const route = svc._state.cachedRoute;
              const idx = svc._state.index;
              const to = route[idx + 1];
              const from = route[idx];
              const segDist = (svc._state.segDists?.[idx]) || 0.5;
              if (segDist > 0) {
                const frac = Math.min(stepKm / segDist, 1);
                svc.position.lat += (to.lat - from.lat) * frac;
                svc.position.lon += (to.lon - from.lon) * frac;
                svc._state.progress += frac;
                if (svc._state.progress >= 1) {
                  svc._state.progress = 0;
                  svc._state.index++;
                }
              }
            }
            svc.totalDistance += stepKm;
            svc.train.totalKm = svc.totalDistance;
          }
          continue;
        }
      }

      // Full physics update for trains in budget
      svc._nearbyServices = null;
      if (svc.position) {
        const gx = Math.floor(svc.position.lat * 20);
        const gy = Math.floor(svc.position.lon * 20);
        const nearby = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const cell = this._spatialGrid.get((gx+dx) * 10000 + (gy+dy));
            if (cell) for (const s of cell) { if (s.id !== svc.id) nearby.push(s); }
          }
        }
        svc._nearbyServices = nearby;
      }
      svc.moveUpdate(dt, timeOfDay, activeServices);
    }

    // Advance round-robin offset
    if (useRoundRobin) {
      this._rrOffset = (this._rrOffset + FULL_BUDGET) % Math.max(1, movingCount);
    }

    // Also update stopped_at_station trains (dwell timer)
    for (let i = 0; i < activeServices.length; i++) {
      const svc = activeServices[i];
      if (svc.state === 'stopped_at_station') {
        svc.moveUpdate(dt, timeOfDay, activeServices);
      }
    }

    // Update rescue locomotives movement
    this.depotManager.updateRescues(dt);
    // Periodic canton cleanup (every ~30s)
    if (!this._lastCantonCleanup) this._lastCantonCleanup = 0;
    const now = performance.now();
    if (now - this._lastCantonCleanup > 30000) {
      this._lastCantonCleanup = now;
      this.cantonManager.cleanup();
    }
  }

  tick(timeOfDay, dateStr, pt) {
    this.timeOfDay = timeOfDay;
    const activeSchedules = this.scheduleCreator.getActiveServices();

    // CVO-04 : création automatique des services EVO (garage/gare → gare de départ)
    for (let i = 0; i < activeSchedules.length; i++) {
      const svc = activeSchedules[i];
      if (svc.state === 'moving' || svc.state === 'departing') continue;
      this.scheduleCreator.ensureEVOForService(svc, this.world, timeOfDay);
    }

    // scheduleTick: moving trains already have their state managed by moveUpdate,
    // so only call scheduleTick on non-moving trains (waiting, stopped_at_station, etc.)
    for (let i = 0; i < activeSchedules.length; i++) {
      const svc = activeSchedules[i];
      if (svc.state === 'moving' || svc.state === 'departing') continue;
      svc.scheduleTick(timeOfDay, dateStr, this.economy);
    }

    this.incidentManager.update(timeOfDay, activeSchedules, this.depotManager, this.world, dateStr, this.weather?.season);
    this.worksManager.update(dateStr, timeOfDay, this.world);

    // Update repair & maintenance queues
    const { repaired, maintainedIds } = this.depotManager.updateRepairs(1);
    for (const { serviceId, repairType } of repaired) {
      const svc = activeSchedules.find(s => s.id === serviceId);
      if (svc) {
        svc.train.breakdown = null;
        svc._rescueDispatched = false;
        svc.train.state = 'waiting';
        svc.state = 'waiting';
      }
    }
    for (const rameId of maintainedIds) {
      // Reset the rame itself
      const rame = this.rameManager.getById(rameId);
      if (rame) {
        rame.kmSinceLastMaint = 0;
        rame.wearLevel = 0;
        rame.inMaintenance = false;
        rame.lastMaintenanceMonth = dateStr ? dateStr.slice(0, 7) : rame.lastMaintenanceMonth;
        rame.recommendedMaintenance = false;
      }
      // Unblock all services using this rame
      for (const svc of activeSchedules) {
        if (svc.rame && svc.rame.id === rameId) {
          svc.train.wearLevel = 0;
          svc.train.kmSinceLastMaint = 0;
          svc.train.inMaintenance = false;
          svc.state = 'waiting';
        }
      }
    }

    if (timeOfDay % 60 === 0) {
      this.freightManager.maybeGenerate(this.world.stations, timeOfDay, this.cargoTypes, this.industrialClients);
    }

    // Periodic canton cleanup every 5 in-game minutes to prevent memory leaks
    if (timeOfDay % 5 === 0) {
      this.cantonManager.cleanup();
    }

    // Auto-assign conductors to services (3×8 shifts, 24h weekly rest)
    try { this.staffManager.tickConductors(activeSchedules, timeOfDay, dateStr); } catch(e) { /* graceful */ }
    // Contrôleurs: random ticket inspections on passenger trains
    try { this.staffManager.tickControleurs(this.economy, activeSchedules, timeOfDay); } catch(e) { /* graceful */ }
    // REG-03 : régulation (ordre de passage / garage) prise par le jeu
    try { this.staffManager.tickRegulateurs(this.scheduleCreator.getActiveServices(), timeOfDay, dateStr, this.realismSettings); } catch(e) { /* graceful */ }

    // Revenue collected inside service.completeService -> economy.processServiceRevenue

    if (timeOfDay === 0) {
      this.economy.processDailyCharges(
        activeSchedules,
        this.depotManager.getAll(),
        dateStr
      );
      // Daily staff salaries
      try { this.staffManager.processDailySalaries(this.economy); } catch(e) { /* graceful */ }
      // Daily bank repayments
      try { this.bank.processDailyRepayments(this.economy); } catch(e) { /* graceful */ }
      // Daily union check
      try { this.unions.dailyUpdate(this); } catch(e) { /* graceful */ }
      // Seasonal schedule check
      try { this.seasonal.checkSeason(dateStr); } catch(e) { /* graceful */ }
      // Daily industrial client contracts
      try { this.industrialClients.generateDailyContracts(this.freightManager, this.world); } catch(e) { /* graceful */ }
      // Daily ITE maintenance costs
      try {
        const iteMaint = this.iteModules.getTotalDailyMaintenance();
        if (iteMaint > 0) this.economy.addExpense(iteMaint, 'maintenance', 'Maintenance ITE');
      } catch(e) { /* graceful */ }
      // MNT-06 : vérification mensuelle de l'entretien préventif recommandé
      try { this.depotManager.checkPreventiveMaintenance(dateStr, this.rameManager); } catch(e) { /* graceful */ }
    }

    // Weather update every minute
    try {
      const mapLat = this.renderer?.tileMap?.centerLat;
      const mapLon = this.renderer?.tileMap?.centerLon;
      this.weather.update(timeOfDay, dateStr, mapLat, mapLon);
    } catch(e) { /* graceful */ }

    // Shunting operations update every minute
    try { this.shuntingManager.update(1); } catch(e) { /* graceful */ }

    // Update radar + cloud tile URLs from weather data
    try {
      const radarPath = this.weather.getLatestRadarPath();
      if (radarPath && this.renderer?.tileMap) {
        this.renderer.tileMap.setRadarTileUrl(this.weather.getRadarTileUrl(radarPath));
      }
      const cloudPath = this.weather.getLatestCloudPath();
      if (cloudPath && this.renderer?.tileMap) {
        this.renderer.tileMap.setCloudTileUrl(this.weather.getCloudTileUrl(cloudPath));
      }
    } catch(e) { /* graceful */ }

    // Dashboard + Graph hooks (every minute, wrapped in try/catch for safety)
    try { this.dashboard.record(this); } catch(e) { /* graceful */ }
    try { this.graphMarche.record(this, timeOfDay); } catch(e) { /* graceful */ }

    // Refresh moving services cache after state transitions
    this.scheduleCreator.refreshMovingCache();
  }

  gameLoop() {
    if (!this.running) return;

    try {
      // Throttle rendering to ~30 FPS max (every ~33ms)
      const now = performance.now();
      if (!this._lastFrameTime) this._lastFrameTime = 0;
      const frameDelta = now - this._lastFrameTime;

      this.engine.update();

      // Only render at ~30fps (skip frames if too fast)
      if (frameDelta >= 30) {
        this._lastFrameTime = now;

        // Use moving services (much smaller subset) for rendering
        const movingSvcs = this.scheduleCreator.getMovingServices();
        const activeServices = this.scheduleCreator.getActiveServices();
        const rescueServices = this.depotManager.getRescueServices();
        // Build visible list: moving + stopped_at_station (have positions) + rescue
        if (!this._visibleBuf) this._visibleBuf = [];
        const allVisibleServices = this._visibleBuf;
        allVisibleServices.length = 0;
        // Moving/departing trains
        for (let i = 0; i < movingSvcs.length; i++) {
          if (movingSvcs[i].position) allVisibleServices.push(movingSvcs[i]);
        }
        // Add stopped_at_station / waiting-with-position (pre-departure) trains
        // At massive scale, these are tracked via a lightweight Set to avoid O(n) scan
        if (!this._stoppedWithPosBuf) this._stoppedWithPosBuf = [];
        const stoppedBuf = this._stoppedWithPosBuf;
        // Rebuild only every 500ms
        if (!this._lastStoppedScan || now - this._lastStoppedScan > 500) {
          this._lastStoppedScan = now;
          stoppedBuf.length = 0;
          for (let i = 0; i < activeServices.length; i++) {
            const svc = activeServices[i];
            if ((svc.state === 'stopped_at_station' || (svc.state === 'waiting' && svc.train?.stoppedAt)) && svc.position) {
              stoppedBuf.push(svc);
            }
          }
        }
        for (let i = 0; i < stoppedBuf.length; i++) allVisibleServices.push(stoppedBuf[i]);
        for (let i = 0; i < rescueServices.length; i++) {
          if (rescueServices[i].position) allVisibleServices.push(rescueServices[i]);
        }

        if (this.renderer) {
          // Sync radar + cloud tile URLs every ~2s (not every frame)
          if (!this._lastRadarSync || now - this._lastRadarSync > 2000) {
            this._lastRadarSync = now;
            try {
              const rp = this.weather.getLatestRadarPath();
              if (rp) this.renderer.tileMap.setRadarTileUrl(this.weather.getRadarTileUrl(rp));
              const cp = this.weather.getLatestCloudPath();
              if (cp) this.renderer.tileMap.setCloudTileUrl(this.weather.getCloudTileUrl(cp));
            } catch(e) { /* graceful */ }
          }
          this.renderer.render(this.world, allVisibleServices, this.engine, this.depotManager, this.lineManager, this.platformManager, this.voiePointManager);
        }

        if (!this._lastUIUpdate || now - this._lastUIUpdate > 250) {
          this._lastUIUpdate = now;
          if (this.ui) {
            this.ui.update(activeServices);
          }
        }
      }
    } catch (e) {
      console.error('Game loop error:', e);
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}

// Global error handler to prevent game crashes
window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.error);
  e.preventDefault();
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  e.preventDefault();
});

window.game = new RailEmpire();
