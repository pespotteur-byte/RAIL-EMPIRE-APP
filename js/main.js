import { SimulationEngine } from './engine.js?v=1778517600';
import { World, createDefaultWorld } from './world.js?v=1778517600';
import { Renderer } from './renderer.js?v=1778517600';
import { UI } from './ui.js?v=1778517600';
import { Economy } from './economy.js?v=1778517600';
import { IncidentManager } from './incidents.js?v=1778517600';
import { FreightManager } from './freight.js?v=1778517600';
import { ScheduleManager } from './schedule.js?v=1778517600';
import { GameStorage } from './storage.js?v=1778517600';
import { AccountManager } from './account.js?v=1778517600';
import { RollingStockManager } from './rolling-stock.js?v=1778517600';
import { RameManager } from './rame.js?v=1778517600';
import { ScheduleCreator, cantonManager } from './schedule-creator.js?v=1778517600';
import { DepotManager } from './depot.js?v=1778517600';
import { WorksManager } from './works.js?v=1778517600';
import { ORMClient } from './orm.js?v=1778517600';
import { LineManager, PlatformManager } from './line.js?v=1778517600';
import { VoiePointManager } from './voie-points.js?v=1778517600';

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
    this.cantonManager = cantonManager;
    this.renderer = null;
    this.ui = null;
    this.running = false;
    this.autoSaveInterval = null;

    this.init();
  }

  init() {
    const btnNew = document.getElementById('btn-new-game');
    const btnLoad = document.getElementById('btn-load-game');
    const nameInput = document.getElementById('login-name');

    if (this.storage.hasSave()) {
      btnLoad.style.display = 'block';
      const saved = this.storage.loadGame();
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

    btnLoad.addEventListener('click', () => {
      const saved = this.storage.loadGame();
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
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const saved = JSON.parse(ev.target.result);
          if (!saved.companyName) throw new Error('Fichier invalide');
          this.account.companyName = saved.companyName;
          nameInput.value = saved.companyName;
          this.loadState(saved);
          this.storage.saveGame(saved);
          this.startGame(saved);
        } catch (err) {
          alert('Erreur: fichier de sauvegarde invalide.\n' + err.message);
        }
      };
      reader.readAsText(file);
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
    loadFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const saved = JSON.parse(ev.target.result);
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
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    this.engine.paused = false;
    this.running = true;
    this.engine.onTick = (timeOfDay, dateStr, pt) => this.tick(timeOfDay, dateStr, pt);
    this.engine.onMoveTick = (dt, timeOfDay) => this.moveTick(dt, timeOfDay);
    this.gameLoop();
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

  exportSaveFile() {
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
        exportDate: new Date().toISOString(),
      };
      // Use a seen set to avoid circular reference crashes
      const seen = new WeakSet();
      const json = JSON.stringify(state, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return undefined; // skip circular refs
          seen.add(value);
        }
        // Skip non-serializable types
        if (typeof value === 'function') return undefined;
        if (value !== value) return null; // NaN → null
        if (value === Infinity || value === -Infinity) return null;
        return value;
      }, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rail-empire-${this.account.companyName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      const activeServices = this.scheduleCreator.getActiveServices();
      const pt = this.engine.getParisTime();
      const currentTimeOfDay = pt.hours * 60 + pt.minutes;
      const dateStr = this.engine.getParisDate();

      // Start from save time (current time minus elapsed), not current time
      let timeOfDay = currentTimeOfDay - (elapsedSeconds / 60);
      if (timeOfDay < 0) timeOfDay += 1440;

      // Use larger steps for long fast-forwards to save CPU
      const stepDt = elapsedSeconds > 600 ? 5 : 1;
      let lastMinute = Math.floor(timeOfDay);

      let remaining = elapsedSeconds;
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
          // Process incidents and daily charges during fast-forward
          this.incidentManager.update(currentMinute, activeServices, this.depotManager, this.world);
          if (currentMinute === 0) {
            this.economy.processDailyCharges(activeServices, this.depotManager.getAll(), dateStr);
          }
          lastMinute = currentMinute;
        }
      }
      console.log(`Fast-forward complete. Simulated ${Math.round(elapsedSeconds)}s of game time.`);
      // Validate service states against current time
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
    // Sync rame km from active services — sum km from all services using same rame
    const rameKmMap = new Map();
    for (const svc of this.scheduleCreator.getActiveServices()) {
      if (svc.rame && svc.train) {
        const rid = svc.rame.id;
        rameKmMap.set(rid, (rameKmMap.get(rid) || 0) + (svc.train.totalKmRun || 0));
      }
    }
    for (const [rid, km] of rameKmMap) {
      const rame = this.rameManager.getById(rid);
      if (rame) rame.totalKmRun = km;
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
    };
    this.storage.saveGame(state);
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
    for (const sid of maintainedIds) {
      const svc = activeSchedules.find(s => s.id === sid);
      if (svc) { svc.train.wearLevel = 0; svc.train.kmSinceLastMaint = 0; svc.train.inMaintenance = false; svc.state = 'waiting'; }
    }

    if (timeOfDay % 60 === 0) {
      this.freightManager.maybeGenerate(this.world.stations, timeOfDay);
    }

    // Revenue collected inside service.completeService -> economy.processServiceRevenue

    if (timeOfDay === 0) {
      this.economy.processDailyCharges(
        activeSchedules,
        this.depotManager.getAll(),
        dateStr
      );
    }
  }

  gameLoop() {
    if (!this.running) return;

    this.engine.update();

    const activeServices = this.scheduleCreator.getActiveServices();
    // Include rescue services for rendering
    const rescueServices = this.depotManager.getRescueServices();
    const allVisibleServices = [...activeServices, ...rescueServices];

    if (this.renderer) {
      this.renderer.render(this.world, allVisibleServices, this.engine, this.depotManager, this.lineManager, this.platformManager, this.voiePointManager);
    }

    // S17: Throttle UI updates to ~4Hz to avoid excessive DOM manipulation
    const now = performance.now();
    if (!this._lastUIUpdate || now - this._lastUIUpdate > 250) {
      this._lastUIUpdate = now;
      if (this.ui) {
        this.ui.update(allVisibleServices);
      }
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}

window.game = new RailEmpire();
