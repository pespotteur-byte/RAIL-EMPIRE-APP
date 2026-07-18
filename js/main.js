import { SimulationEngine } from './engine.js?v=1784250038';
import { SeededRng, setGlobalRng } from './rng.js?v=1784250038';
import { World, createDefaultWorld } from './world.js?v=1784250038';
import { Renderer } from './renderer.js?v=1784250038';
import { UI } from './ui.js?v=1784250038';
import { Economy } from './economy.js?v=1784250038';
import { IncidentManager } from './incidents.js?v=1784250038';
import { FreightManager } from './freight.js?v=1784250038';
import { ScheduleManager } from './schedule.js?v=1784250038';
import { GameStorage } from './storage.js?v=1784250038';
import { AccountManager } from './account.js?v=1784250038';
import { RollingStockManager } from './rolling-stock.js?v=1784250038';
import { RameManager } from './rame.js?v=1784250038';
import { ScheduleCreator, cantonManager } from './schedule-creator.js?v=1784250038';
import { DepotManager } from './depot.js?v=1784250038';
import { WorksManager } from './works.js?v=1784250038';
import { ORMClient } from './orm.js?v=1784250038';
import { LineManager, PlatformManager } from './line.js?v=1784250038';
import { SillonManager } from './sillon.js?v=1784250038';
import { VoiePointManager } from './voie-points.js?v=1784250038';
import { Dashboard } from './dashboard.js?v=1784250038';
import { GraphMarche } from './graph-marche.js?v=1784250038';
import { StaffManager } from './staff.js?v=1784250038';
import { Tutorial } from './tutorial.js?v=1784250038';
import { Bank } from './bank.js?v=1784250038';
import { Weather } from './weather.js?v=1784250038';
import { Unions } from './unions.js?v=1784250038';
import { SeasonalSchedule } from './seasonal.js?v=1784250038';
import { Connections } from './connections.js?v=1784250038';
import { StationUpgrades } from './station-upgrades.js?v=1784250038';
import { A12Model } from './a12-model.js?v=1784250038';
import { JunctionManager } from './junctions.js?v=1784250038';
import { CargoTypeManager } from './cargo-types.js?v=1784250038';
import { ITEModules } from './ite-modules.js?v=1784250038';
import { IndustrialClients } from './industrial-clients.js?v=1784250038';
import { ShuntingManager } from './shunting.js?v=1784250038';
import { haversineDistance } from './simulation.js?v=1784250038';
import { CATALOG, CATALOG_CARGO_TYPES } from './catalog-data.js?v=1786961000';
import { CATALOG_PACK_RE } from './catalog-data-pack-re.js?v=1784250038';
import { adminSync } from './admin-sync.js?v=1784250038';

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
    // SAV : nouvelle partie = heure réelle ; chargement = temps de la sauvegarde
    if (savedState?.gameTime != null && savedState?.gameDate) {
      this.engine.setGameTime(savedState.gameTime, savedState.gameDate);
    } else {
      this.engine.setGameTime(null, null);
    }
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
    // 2) Seed the rolling-stock entries (MLG + Pack RE).
    let allCatalog = [...(Array.isArray(CATALOG) ? CATALOG : [])];
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
    const priceSlowInput = document.getElementById('settings-price-slow');
    const priceRegionalInput = document.getElementById('settings-price-regional');
    const priceIntercityInput = document.getElementById('settings-price-intercity');
    const priceFastInput = document.getElementById('settings-price-fast');
    const priceTgvInput = document.getElementById('settings-price-tgv');
    const freightPriceInput = document.getElementById('settings-freight');
    const priceSlowVal = document.getElementById('settings-price-slow-val');
    const priceRegionalVal = document.getElementById('settings-price-regional-val');
    const priceIntercityVal = document.getElementById('settings-price-intercity-val');
    const priceFastVal = document.getElementById('settings-price-fast-val');
    const priceTgvVal = document.getElementById('settings-price-tgv-val');
    const freightVal = document.getElementById('settings-freight-val');
    const saveBtn = document.getElementById('settings-save');

    // Load saved settings
    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem('re_player_settings') || '{}');
    } catch (e) {}
    if (settings.realism) {
      this.realismSettings = { ...this.realismSettings, ...settings.realism };
    }

    const updateRealismLabels = () => {
      if (physicsVal) physicsVal.textContent = Number(physicsInput.value).toFixed(2);
      if (weatherVal) weatherVal.textContent = Number(weatherInput.value).toFixed(2);
      if (breakdownVal) breakdownVal.textContent = Number(breakdownInput.value).toFixed(2);
      if (delayToleranceVal) delayToleranceVal.textContent = delayToleranceInput.value;
    };

    const fmtPrice = (v, unit) => `${Number(v).toFixed(2)} ${unit}`;
    const updatePriceLabels = () => {
      if (priceSlowVal) priceSlowVal.textContent = fmtPrice(priceSlowInput.value, '€/pax·km');
      if (priceRegionalVal) priceRegionalVal.textContent = fmtPrice(priceRegionalInput.value, '€/pax·km');
      if (priceIntercityVal) priceIntercityVal.textContent = fmtPrice(priceIntercityInput.value, '€/pax·km');
      if (priceFastVal) priceFastVal.textContent = fmtPrice(priceFastInput.value, '€/pax·km');
      if (priceTgvVal) priceTgvVal.textContent = fmtPrice(priceTgvInput.value, '€/pax·km');
      if (freightVal) freightVal.textContent = fmtPrice(freightPriceInput.value, '€/t·km');
    };

    [physicsInput, weatherInput, breakdownInput, delayToleranceInput].forEach(el => {
      el?.addEventListener('input', updateRealismLabels);
    });
    [priceSlowInput, priceRegionalInput, priceIntercityInput, priceFastInput, priceTgvInput, freightPriceInput].forEach(el => {
      el?.addEventListener('input', updatePriceLabels);
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
      const prices = this.economy.passengerPriceByClass || {};
      priceSlowInput.value = prices.slow ?? 0.08;
      priceRegionalInput.value = prices.regional ?? 0.12;
      priceIntercityInput.value = prices.intercity ?? 0.18;
      priceFastInput.value = prices.fast ?? 0.30;
      priceTgvInput.value = prices.tgv ?? 0.50;
      freightPriceInput.value = this.economy.freightPricePerTKm ?? 0.08;
      updateRealismLabels();
      updatePriceLabels();
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

      // Section X — tarifs au km modifiables par le joueur, persistés dans la sauvegarde
      this.economy.passengerPriceByClass = {
        slow: parseFloat(priceSlowInput.value) || 0,
        regional: parseFloat(priceRegionalInput.value) || 0,
        intercity: parseFloat(priceIntercityInput.value) || 0,
        fast: parseFloat(priceFastInput.value) || 0,
        tgv: parseFloat(priceTgvInput.value) || 0,
      };
      this.economy.freightPricePerTKm = parseFloat(freightPriceInput.value) || 0;

      // Save settings
      const s = { logoUrl, companyColor: color, incidentsEnabled: incEnabled, realism: { ...this.realismSettings } };
      try { localStorage.setItem('re_player_settings', JSON.stringify(s)); } catch (e) {}

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
    // SAV : restaurer le temps de jeu sauvegardé (pas l'heure réelle)
    const savedTime = typeof s.gameTime === 'number' ? s.gameTime : null;
    const savedDate = s.gameDate || null;
    if (savedTime != null && savedDate) this.engine.setGameTime(savedTime, savedDate);
    else this.engine.setGameTime(null, null); // anciennes sauvegardes : heure réelle
    if (s.realism) this.realismSettings = { ...this.realismSettings, ...s.realism };
    const loadPt = this.engine.getParisTime();
    const loadTimeMin = loadPt.hours * 60 + loadPt.minutes;
    const loadDateStr = this.engine.getParisDate();
    if (s.economy) this.economy.loadFromSave(s.economy);
    if (s.world) this.world.loadFromSave(s.world);
    if (s.rollingStock) this.rollingStock.loadFromSave(s.rollingStock);
    if (s.rames) this.rameManager.loadFromSave(s.rames);
    if (s.schedules) this.scheduleCreator.loadFromSave(s.schedules, this.rameManager, this.world, loadTimeMin, loadDateStr);
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
      gameTime: this._gameTime ?? this.engine.getParisTime().hours * 60 + this.engine.getParisTime().minutes,
      gameDate: this._currentDate || this.engine.getParisDate(),
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
      rngState: this.rng ? this.rng.getState() : null,
      realism: { ...this.realismSettings },
    };
    try { this.storage.saveGame(state).catch(e => console.warn('Auto-save failed:', e)); } catch(e) { console.warn('Auto-save failed:', e); }
    return state;
  }

  moveTick(dt, timeOfDay) {
    const activeServices = this.scheduleCreator.getActiveServices();
    const movingSvcs = this.scheduleCreator.getMovingServices();
    const movingCount = movingSvcs.length;

    // LOD constants tuned for 100k+ simultaneous trains on low-end hardware.
    const HIGH_BUDGET = 500;        // full physics per tick
    const MEDIUM_INTERVAL = 10;     // macro update every 1.0 s
    const LOW_INTERVAL = 30;        // macro update every 3.0 s
    const MEDIUM_RADIUS_DEG = 0.5;  // ~55 km around camera

    if (!this._tickPhase) this._tickPhase = 0;
    this._tickPhase++;
    const lowPhase = this._tickPhase % LOW_INTERVAL;
    const mediumPhase = this._tickPhase % MEDIUM_INTERVAL;

    // Camera / viewport
    const tm = this.renderer?.tileMap;
    const w = this.renderer?.logicalWidth || 1024;
    const h = this.renderer?.logicalHeight || 768;
    const center = tm ? tm.screenToWorld(w / 2, h / 2, w, h) : null;
    const tl = tm ? tm.screenToWorld(0, 0, w, h) : null;
    const br = tm ? tm.screenToWorld(w, h, w, h) : null;
    const hasViewport = center && tl && br;
    const centerLat = center?.lat ?? 0;
    const centerLon = center?.lon ?? 0;
    const vpMinLat = hasViewport ? Math.min(tl.lat, br.lat) : -90;
    const vpMaxLat = hasViewport ? Math.max(tl.lat, br.lat) : 90;
    const vpMinLon = hasViewport ? Math.min(tl.lon, br.lon) : -180;
    const vpMaxLon = hasViewport ? Math.max(tl.lon, br.lon) : 180;

    // IPCS spatial grid: index moving services by position for O(1) same-track conflict queries
    const SERVICE_GRID_CELL = 0.02; // ~2.2 km
    const serviceGrid = new Map();
    for (const svc of movingSvcs) {
      if (!svc.position) continue;
      const latKey = Math.floor(svc.position.lat / SERVICE_GRID_CELL);
      const lonKey = Math.floor(svc.position.lon / SERVICE_GRID_CELL);
      const key = `${latKey},${lonKey}`;
      if (!serviceGrid.has(key)) serviceGrid.set(key, []);
      serviceGrid.get(key).push(svc);
    }
    this._serviceGrid = serviceGrid;
    this._serviceGridCell = SERVICE_GRID_CELL;

    const routeIndex = new Map();
    const highCandidates = [];
    const mediumList = [];
    let lowList = [];

    // No visible renderer: every train runs as low-LOD macro.
    if (!hasViewport) {
      for (let i = 0; i < movingCount; i++) {
        movingSvcs[i]._lod = 'low';
      }
      lowList = movingSvcs;
    } else {
      for (let i = 0; i < movingCount; i++) {
        const svc = movingSvcs[i];
        if (!svc.position || !svc._state) { svc._lod = 'low'; lowList.push(svc); continue; }
        if (!svc._routeKey) {
          const legKey = `${svc.currentStopIndex}-${svc.isReturnLeg ? 1 : 0}`;
          const route = svc.getCurrentRoute();
          if (route && route.length >= 2) svc._initializeState(route, legKey);
        }
        const route = svc._state.cachedRoute;
        if (!route || route.length < 2) { svc._lod = 'low'; lowList.push(svc); continue; }

        const lat = svc.position.lat;
        const lon = svc.position.lon;
        const inViewport = lat >= vpMinLat && lat <= vpMaxLat && lon >= vpMinLon && lon <= vpMaxLon;
        const dLat = Math.abs(lat - centerLat);
        const dLon = Math.abs(lon - centerLon);
        let lod = 'low';
        if (inViewport) {
          lod = 'high';
          svc._lodDist = dLat + dLon;
          highCandidates.push(svc);
        } else if (dLat < MEDIUM_RADIUS_DEG && dLon < MEDIUM_RADIUS_DEG) {
          lod = 'medium';
          mediumList.push(svc);
        } else {
          lowList.push(svc);
        }
        svc._lod = lod;

        if (lod !== 'low') {
          const key = svc._routeKey || '';
          if (key) {
            let arr = routeIndex.get(key);
            if (!arr) { arr = []; routeIndex.set(key, arr); }
            arr.push(svc);
          }
        }
      }
    }

    // Cap high-priority services and demote overflow to low.
    if (highCandidates.length > HIGH_BUDGET) {
      highCandidates.sort((a, b) => a._lodDist - b._lodDist);
      const keep = highCandidates.slice(0, HIGH_BUDGET);
      const keepSet = new Set(keep);
      for (let i = 0; i < highCandidates.length; i++) {
        const svc = highCandidates[i];
        if (!keepSet.has(svc)) {
          svc._lod = 'low';
          lowList.push(svc);
        }
      }
      highCandidates.length = keep.length;
      for (let i = 0; i < keep.length; i++) highCandidates[i] = keep[i];
    }

    // Pass 2: sort route groups that contain a high-priority train and assign neighbours.
    const LOOKAHEAD = 5;
    const LOOKBEHIND = 2;
    const MAX_GROUP_SORT = 5000;
    for (const [key, group] of routeIndex) {
      if (!group.some(s => s._lod === 'high')) continue;
      let sortGroup = group;
      if (sortGroup.length > MAX_GROUP_SORT) {
        sortGroup = sortGroup.filter(s => s._lod === 'high');
      }
      sortGroup.sort((a, b) => (a._state.index + a._state.progress) - (b._state.index + b._state.progress));
      for (let i = 0; i < sortGroup.length; i++) {
        const svc = sortGroup[i];
        if (svc._lod !== 'high') continue;
        const start = Math.max(0, i - LOOKBEHIND);
        const end = Math.min(sortGroup.length, i + LOOKAHEAD + 1);
        const nearby = new Array(end - start - 1);
        let k = 0;
        for (let j = start; j < end; j++) {
          if (j !== i) nearby[k++] = sortGroup[j];
        }
        svc._nearbyServices = nearby;
      }
    }

    // Pass 3: update high (full physics), medium/low via strided macro updates.
    for (let i = 0; i < highCandidates.length; i++) {
      highCandidates[i].moveUpdate(dt, timeOfDay, activeServices);
    }

    const macroDtMedium = dt * MEDIUM_INTERVAL;
    for (let i = mediumPhase; i < mediumList.length; i += MEDIUM_INTERVAL) {
      mediumList[i].moveMacro(macroDtMedium, timeOfDay, this.economy);
    }

    const macroDtLow = dt * LOW_INTERVAL;
    for (let i = lowPhase; i < lowList.length; i += LOW_INTERVAL) {
      lowList[i].moveMacro(macroDtLow, timeOfDay, this.economy);
    }

    // Incident check on high/medium trains only.
    if (!this._incidentCheckTick) this._incidentCheckTick = 0;
    if (this._incidentCheckTick++ % 6 === 0) {
      const incidentSvcs = [];
      for (let i = 0; i < highCandidates.length; i++) incidentSvcs.push(highCandidates[i]);
      for (let i = 0; i < mediumList.length; i++) incidentSvcs.push(mediumList[i]);
      this.incidentManager.checkTrainPositions(incidentSvcs, this.depotManager, this.world);
    }

    // Dwell timer for stopped trains.
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
    this._gameTime = timeOfDay;
    this._currentDate = dateStr;
    const activeSchedules = this.scheduleCreator.getActiveServices();

    // CVO-04 : création automatique des services EVO (garage/gare → gare de départ)
    for (let i = 0; i < activeSchedules.length; i++) {
      const svc = activeSchedules[i];
      if (svc.state === 'moving' || svc.state === 'departing') continue;
      this.scheduleCreator.ensureEVOForService(svc, this.world, timeOfDay);
    }

    // Build per-minute lookup indexes so isRameInUse and OCC-03 station priority
    // are O(k) instead of O(n²) during this tick.
    this.scheduleCreator.beginTick(timeOfDay);

    // REG-03 : régulation (ordre de passage / garage temporaire) doit être calculée
    // AVANT que scheduleTick ne fasse démarrer les trains, sinon un train retardé
    // et non prioritaire risque de partir avant d'être mis au garage.
    try { this.staffManager.tickRegulateurs(this.scheduleCreator.getActiveServices(), timeOfDay, dateStr, this.realismSettings); } catch(e) { /* graceful */ }

    // INC-03 : incidents (gare, voie, train) doivent être appliqués AVANT
    // scheduleTick, sinon un départ prévu à la même minute qu'un incident
    // ne serait pas bloqué en gare.
    this.incidentManager.update(timeOfDay, activeSchedules, this.depotManager, this.world, dateStr, this.weather?.season);
    this.worksManager.update(dateStr, timeOfDay, this.world);

    // scheduleTick: moving trains already have their state managed by moveUpdate,
    // so only call scheduleTick on non-moving trains (waiting, stopped_at_station, etc.)
    for (let i = 0; i < activeSchedules.length; i++) {
      const svc = activeSchedules[i];
      if (svc.state === 'moving' || svc.state === 'departing') continue;
      svc.scheduleTick(timeOfDay, dateStr, this.economy);
      this.scheduleCreator.updateServiceIndexes(svc, timeOfDay);
    }

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
      // XIV — satellite true color mis à jour chaque minute
      if (this.renderer?.tileMap) {
        this.renderer.tileMap.setCloudTileUrl(this.weather.getCloudTileUrl());
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
        // Moving/departing trains — only high/medium LOD (low are macro/statistical)
        for (let i = 0; i < movingSvcs.length; i++) {
          const svc = movingSvcs[i];
          if (svc.position && svc._lod !== 'low') allVisibleServices.push(svc);
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
          // LVM-04/06 — suit le train sélectionné en temps réel
          if (this.ui) this.ui.applyCameraFollow();
          // Sync radar + cloud tile URLs every ~2s (not every frame)
          if (!this._lastRadarSync || now - this._lastRadarSync > 2000) {
            this._lastRadarSync = now;
            try {
              const rp = this.weather.getLatestRadarPath();
              if (rp) this.renderer.tileMap.setRadarTileUrl(this.weather.getRadarTileUrl(rp));
              // XIV — satellite true color mis à jour toutes les 2 s
              this.renderer.tileMap.setCloudTileUrl(this.weather.getCloudTileUrl());
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
