import { SimulationEngine } from './engine.js';
import { World, createDefaultWorld } from './world.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { Economy } from './economy.js';
import { IncidentManager } from './incidents.js';
import { FreightManager } from './freight.js';
import { ScheduleManager } from './schedule.js';
import { GameStorage } from './storage.js';
import { AccountManager } from './account.js';
import { RollingStockManager } from './rolling-stock.js';
import { RameManager } from './rame.js';
import { ScheduleCreator } from './schedule-creator.js';
import { DepotManager } from './depot.js';
import { WorksManager } from './works.js';
import { ORMClient } from './orm.js';

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
  }

  exportSaveFile() {
    const state = {
      companyName: this.account.companyName,
      economy: this.economy.toSave(),
      world: this.world.toSave(),
      rollingStock: this.rollingStock.toSave(),
      rames: this.rameManager.toSave(),
      schedules: this.scheduleCreator.toSave(),
      depots: this.depotManager.toSave(),
      incidentTypes: this.incidentManager.getCustomTypes(),
      works: this.worksManager.toSave(),
      freightContracts: this.freightManager.toSave(),
      ormRoutes: this.orm.toSave(),
      exportDate: new Date().toISOString(),
    };
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rail-empire-${this.account.companyName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadState(s) {
    if (s.economy) this.economy.loadFromSave(s.economy);
    if (s.world) this.world.loadFromSave(s.world);
    if (s.rollingStock) this.rollingStock.loadFromSave(s.rollingStock);
    if (s.rames) this.rameManager.loadFromSave(s.rames);
    if (s.schedules) this.scheduleCreator.loadFromSave(s.schedules, this.rameManager, this.world);
    if (s.depots) this.depotManager.loadFromSave(s.depots);
    if (s.incidentTypes) this.incidentManager.loadCustomTypes(s.incidentTypes);
    if (s.works) this.worksManager.loadFromSave(s.works);
    if (s.freightContracts) this.freightManager.loadFromSave(s.freightContracts);
    if (s.ormRoutes) this.orm.loadFromSave(s.ormRoutes);
  }

  saveState() {
    const state = {
      companyName: this.account.companyName,
      economy: this.economy.toSave(),
      world: this.world.toSave(),
      rollingStock: this.rollingStock.toSave(),
      rames: this.rameManager.toSave(),
      schedules: this.scheduleCreator.toSave(),
      depots: this.depotManager.toSave(),
      incidentTypes: this.incidentManager.getCustomTypes(),
      works: this.worksManager.toSave(),
      freightContracts: this.freightManager.toSave(),
      ormRoutes: this.orm.toSave(),
    };
    this.storage.saveGame(state);
  }

  moveTick(dt, timeOfDay) {
    const activeServices = this.scheduleCreator.getActiveServices();
    for (const svc of activeServices) {
      svc.moveUpdate(dt, timeOfDay, activeServices);
    }
  }

  tick(timeOfDay, dateStr, pt) {
    const activeSchedules = this.scheduleCreator.getActiveServices();

    for (const svc of activeSchedules) {
      svc.scheduleTick(timeOfDay, dateStr, this.economy);
    }

    this.incidentManager.update(timeOfDay, activeSchedules, this.depotManager, this.world);
    this.worksManager.update(dateStr, timeOfDay, this.world);

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

    if (this.renderer) {
      this.renderer.render(this.world, activeServices, this.engine, this.depotManager);
    }

    if (this.ui) {
      this.ui.update(activeServices);
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}

window.game = new RailEmpire();
