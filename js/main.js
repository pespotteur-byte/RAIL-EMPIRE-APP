import { SimulationEngine } from './engine.js?v=1779406655';
import { World, createDefaultWorld } from './world.js?v=1779406655';
import { Renderer } from './renderer.js?v=1779406655';
import { UI } from './ui.js?v=1779406655';
import { Economy } from './economy.js?v=1779406655';
import { IncidentManager } from './incidents.js?v=1779406655';
import { FreightManager } from './freight.js?v=1779406655';
import { ScheduleManager } from './schedule.js?v=1779406655';
import { GameStorage } from './storage.js?v=1779406655';
import { AccountManager } from './account.js?v=1779406655';
import { RollingStockManager } from './rolling-stock.js?v=1779406655';
import { RameManager } from './rame.js?v=1779406655';
import { ScheduleCreator, cantonManager } from './schedule-creator.js?v=1779406655';
import { DepotManager } from './depot.js?v=1779406655';
import { WorksManager } from './works.js?v=1779406655';
import { ORMClient } from './orm.js?v=1779406655';
import { LineManager, PlatformManager } from './line.js?v=1779406655';
import { VoiePointManager } from './voie-points.js?v=1779406655';
import { Dashboard } from './dashboard.js?v=1779406655';
import { GraphMarche } from './graph-marche.js?v=1779406655';
import { StaffManager } from './staff.js?v=1779406655';
import { Tutorial } from './tutorial.js?v=1779406655';
import { Bank } from './bank.js?v=1779406655';
import { Weather } from './weather.js?v=1779406655';
import { Unions } from './unions.js?v=1779406655';
import { SeasonalSchedule } from './seasonal.js?v=1779406655';
import { Connections } from './connections.js?v=1779406655';
import { StationUpgrades } from './station-upgrades.js?v=1779406655';
import { JunctionManager } from './junctions.js?v=1779406655';
import { CargoTypeManager } from './cargo-types.js?v=1779406655';
import { ITEModules } from './ite-modules.js?v=1779406655';
import { IndustrialClients } from './industrial-clients.js?v=1779406655';
import { ShuntingManager } from './shunting.js?v=1779406655';

class RailEmpire {
  constructor() {
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
    this.platformManager = new PlatformManager();
    this.voiePointManager = new VoiePointManager();
    this.dashboard = new Dashboard();
    this.graphMarche = new GraphMarche();
    this.staffManager = new StaffManager();
    this.tutorial = new Tutorial();
    this.bank = new Bank();
    this.weather = new Weather();
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

    // Setup station creation button
    document.getElementById('btn-create-station')?.addEventListener('click', () => {
      this.ui.toggleStationCreation();
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

    this.engine.paused = false;
    this.running = true;
    this.engine.onTick = (timeOfDay, dateStr, pt) => this.tick(timeOfDay, dateStr, pt);
    this.engine.onMoveTick = (dt, timeOfDay) => this.moveTick(dt, timeOfDay);
    this.gameLoop();
    // Clear previous autoSave interval to prevent double-save on re-login
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => this.saveState(), 10000);

    // Save on tab hide, fast-forward on tab return
    this._lastVisibleTime = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveState();
        this._lastVisibleTime = Date.now();
      } else {
        const elapsed = (Date.now() - this._lastVisibleTime) / 1000;
        if (elapsed > 5 && elapsed < 86400) {
          this._fastForward(elapsed);
          this.saveState();
        }
      }
    });
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
    if (s.economy) this.economy.loadFromSave(s.economy);
    if (s.world) this.world.loadFromSave(s.world);
    if (s.rollingStock) this.rollingStock.loadFromSave(s.rollingStock);
    if (s.rames) this.rameManager.loadFromSave(s.rames);
    if (s.schedules) this.scheduleCreator.loadFromSave(s.schedules, this.rameManager, this.world);
    if (s.depots) this.depotManager.loadFromSave(s.depots);
    if (s.activeIncidents) this.incidentManager.loadFromSave(s.activeIncidents, this.world);
    if (s.works) this.worksManager.loadFromSave(s.works);
    if (s.freightContracts) this.freightManager.loadFromSave(s.freightContracts);
    if (s.ormRoutes) this.orm.loadFromSave(s.ormRoutes);
    if (s.lines) this.lineManager.loadFromSave(s.lines);
    if (s.voiePoints) this.voiePointManager.loadFromSave(s.voiePoints);
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
    // Clear voie point occupations on reload (prevent ghost occupations after crash)
    for (const vp of this.voiePointManager.getAll()) { vp.occupiedBy = null; }
    for (const trc of this.voiePointManager.getAllTroncons()) { trc.occupiedBy = null; }

    // Initialize platform manager for all stations
    for (const st of this.world.stations) {
      this.platformManager.initStation(st.id, st.platforms || 2);
    }

    // Fast-forward simulation based on elapsed time since save
    if (s.saveTime) {
      const elapsed = (Date.now() - s.saveTime) / 1000; // seconds
      if (elapsed > 0 && elapsed < 86400) { // max 24h fast-forward
        console.log(`Fast-forwarding simulation by ${Math.round(elapsed)}s`);
        this._fastForward(elapsed);
      }
    }
  }

  _fastForward(elapsedSeconds) {
    try {
      // Cap fast-forward to prevent browser freeze (max 3600 iterations)
      const maxSimSeconds = 3600;
      const cappedElapsed = Math.min(elapsedSeconds, 86400);
      const activeServices = this.scheduleCreator.getActiveServices();
      const pt = this.engine.getParisTime();
      const currentTimeOfDay = pt.hours * 60 + pt.minutes;
      const dateStr = this.engine.getParisDate();

      // Start from save time (current time minus elapsed), not current time
      let timeOfDay = currentTimeOfDay - (cappedElapsed / 60);
      if (timeOfDay < 0) timeOfDay += 1440;

      // Adaptive step size: scale up for long absences to cap total iterations
      const stepDt = Math.max(1, Math.ceil(cappedElapsed / maxSimSeconds));
      let lastMinute = Math.floor(timeOfDay);

      let remaining = cappedElapsed;
      while (remaining > 0) {
        const dt = Math.min(stepDt, remaining);
        for (const svc of activeServices) {
          svc.moveUpdate(dt, timeOfDay, activeServices);
        }
        remaining -= dt;
        timeOfDay += (dt / 60);
        if (timeOfDay >= 1440) timeOfDay -= 1440;

        // Process schedule ticks + revenue each simulated minute
        const currentMinute = Math.floor(timeOfDay);
        if (currentMinute !== lastMinute) {
          for (const svc of activeServices) {
            svc.scheduleTick(currentMinute, dateStr, this.economy);
          }
          this.incidentManager.update(currentMinute, activeServices, this.depotManager, this.world);
          if (currentMinute === 0) {
            this.economy.processDailyCharges(activeServices, this.depotManager.getAll(), dateStr);
          }
          lastMinute = currentMinute;
        }
      }
      console.log(`Fast-forward complete. Simulated ${Math.round(cappedElapsed)}s (step=${stepDt}s).`);
      this._validateServiceStates(currentTimeOfDay, dateStr);
    } catch (e) {
      console.warn('Fast-forward error (ignored):', e);
    }
  }

  _validateServiceStates(timeOfDay, dateStr) {
    const services = this.scheduleCreator.getActiveServices();
    for (const svc of services) {
      if (!svc.active) continue;
      const stops = svc.getCurrentStops();
      if (!stops || stops.length < 2) continue;
      const firstDep = stops[0]?.departureTime ?? 0;
      const lastArr = stops[stops.length - 1]?.arrivalTime ?? firstDep + 120;

      // Always clear stale blocked state after fast-forward
      svc.train.blockedBy = false;
      svc.train._stoppedSinceGameTime = null;

      // Midnight-safe: is timeOfDay outside the service window?
      const beforeDep = !this._timeGte(timeOfDay, firstDep);
      const afterArr = this._timeGte(timeOfDay, lastArr + 31);

      if (beforeDep || afterArr) {
        svc.state = 'waiting';
        svc.currentStopIndex = 0;
        svc.speed = 0;
        svc.train.speed = 0;
        svc.train.stoppedAt = null;
        svc.position = null;
        svc._resetState();
        if (afterArr) {
          svc.completed = true;
          svc.completedDate = dateStr;
        }
      }
    }
  }

  // Midnight-safe time comparison
  _timeGte(a, b) {
    let d = a - b;
    if (d > 720) d -= 1440;
    else if (d < -720) d += 1440;
    return d >= 0;
  }

  saveState() {
    // Sync rame km: use the rame's own accumulated km (source of truth),
    // not the sum of all services (which would multiply km)
    for (const svc of this.scheduleCreator.getActiveServices()) {
      if (svc.rame && svc.train && svc.state === 'moving') {
        // Rame km is already synced in moveUpdate() — just ensure consistency
        svc.rame.totalKmRun = Math.max(svc.rame.totalKmRun || 0, svc.train.totalKmRun || 0);
        svc.rame.kmSinceLastMaint = Math.max(svc.rame.kmSinceLastMaint || 0, svc.train.kmSinceLastMaint || 0);
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
    };
    try { this.storage.saveGame(state).catch(e => console.warn('Auto-save failed:', e)); } catch(e) { console.warn('Auto-save failed:', e); }
  }

  moveTick(dt, timeOfDay) {
    const activeServices = this.scheduleCreator.getActiveServices();
    // Check incident positions BEFORE movement so effect is immediate
    this.incidentManager.checkTrainPositions(activeServices, this.depotManager, this.world);
    for (const svc of activeServices) {
      svc.moveUpdate(dt, timeOfDay, activeServices);
    }
    // Update rescue locomotives movement
    this.depotManager.updateRescues(dt);
  }

  tick(timeOfDay, dateStr, pt) {
    this.timeOfDay = timeOfDay;
    const activeSchedules = this.scheduleCreator.getActiveServices();

    for (const svc of activeSchedules) {
      svc.scheduleTick(timeOfDay, dateStr, this.economy);
    }

    this.incidentManager.update(timeOfDay, activeSchedules, this.depotManager, this.world);
    this.worksManager.update(dateStr, timeOfDay, this.world);

    // Update repair & maintenance queues
    const { repairedIds, maintainedIds } = this.depotManager.updateRepairs(1);
    for (const sid of repairedIds) {
      const svc = activeSchedules.find(s => s.id === sid);
      if (svc) { svc.train.breakdown = null; svc.train.state = 'waiting'; svc.state = 'waiting'; }
    }
    for (const rameId of maintainedIds) {
      // Reset the rame itself
      const rame = this.rameManager.getById(rameId);
      if (rame) {
        rame.kmSinceLastMaint = 0;
        rame.wearLevel = 0;
        rame.inMaintenance = false;
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
      this.freightManager.maybeGenerate(this.world.stations, timeOfDay);
    }

    // Periodic canton cleanup every 5 in-game minutes to prevent memory leaks
    if (timeOfDay % 5 === 0) {
      this.cantonManager.cleanup();
    }

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
    }

    // Weather update every minute
    try {
      const mapLat = this.renderer?.map?.centerLat;
      const mapLon = this.renderer?.map?.centerLon;
      this.weather.update(timeOfDay, dateStr, mapLat, mapLon);
    } catch(e) { /* graceful */ }

    // Shunting operations update every minute
    try { this.shuntingManager.update(1); } catch(e) { /* graceful */ }

    // Update radar tile URL from weather data
    try {
      const radarPath = this.weather.getLatestRadarPath();
      if (radarPath && this.renderer?.map) {
        this.renderer.map.setRadarTileUrl(this.weather.getRadarTileUrl(radarPath));
      }
    } catch(e) { /* graceful */ }

    // Dashboard + Graph hooks (every minute, wrapped in try/catch for safety)
    try { this.dashboard.record(this); } catch(e) { /* graceful */ }
    try { this.graphMarche.record(this, timeOfDay); } catch(e) { /* graceful */ }
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

        const activeServices = this.scheduleCreator.getActiveServices();
        const rescueServices = this.depotManager.getRescueServices();
        const allVisibleServices = [...activeServices, ...rescueServices];

        if (this.renderer) {
          this.renderer.render(this.world, allVisibleServices, this.engine, this.depotManager, this.lineManager, this.platformManager, this.voiePointManager);
        }

        if (!this._lastUIUpdate || now - this._lastUIUpdate > 250) {
          this._lastUIUpdate = now;
          if (this.ui) {
            this.ui.update(allVisibleServices);
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
