import { haversineDistance } from './simulation.js';
import { incrementTrailingNumber } from './schedule-logic.js';

// LVM-01 — couleurs des catégories de train (miroir de renderer.js, annexe 2a).
const LVM_CAT_COLORS = { voyageur: '#3b82f6', fret: '#22c55e', travaux: '#f59e0b', machine: '#a855f7' };
const LVM_CAT_LABELS = { voyageur: 'Voyageur', fret: 'Fret', travaux: 'Travaux', machine: 'Machine' };
const LVM_CAT_ICONS = { voyageur: 'img/livemap/train_voyageur.png', fret: 'img/livemap/train_fret.png', travaux: 'img/livemap/train_travaux.png', machine: 'img/livemap/train_generic.png' };

// Infogare image overlays — the user's annex images are used as background, dynamic text is placed on top.
const IG_IMAGE_LAYOUTS = {
  'sncf-dep': {
    file: 'img/infogare/AFL-DP.png',
    width: 1100, height: 610,
    bg: '#0b1836',
    header: { bg: '#fff', color: '#000' },
    headerFields: [
      { type: 'clock', x: 4, y: 5, w: 12, h: 6, color: '#000', bg: '#fff', fontSize: 20, align: 'left' },
      { type: 'station', x: 25, y: 5, w: 50, h: 6, color: '#000', bg: '#fff', fontSize: 18, align: 'center', weight: 700 },
      { type: 'static', x: 88, y: 5, w: 10, h: 6, text: 'SNCF', color: '#c00', bg: '#fff', fontSize: 14, align: 'center', style: 'font-style:italic;font-weight:900' }
    ],
    blocks: [
      { y: 25.9, h: 19.2, viaY: 33.9, viaH: 5.6, remarkY: 40.8, remarkH: 4.3, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26}, remark:{x:30,w:55} },
      { y: 52.3, h: 13.4, viaY: 60.3, viaH: 5.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26} },
      { y: 78.0, h: 13.3, viaY: 85.9, viaH: 5.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26} }
    ]
  },
  'sncf-arr': {
    file: 'img/infogare/AFL-AR.png',
    width: 1100, height: 621,
    bg: '#0b2e12',
    header: { bg: '#fff', color: '#000' },
    headerFields: [
      { type: 'clock', x: 4, y: 5, w: 12, h: 6, color: '#000', bg: '#fff', fontSize: 20, align: 'left' },
      { type: 'station', x: 25, y: 5, w: 50, h: 6, color: '#000', bg: '#fff', fontSize: 18, align: 'center', weight: 700 },
      { type: 'static', x: 88, y: 5, w: 10, h: 6, text: 'SNCF', color: '#c00', bg: '#fff', fontSize: 14, align: 'center', style: 'font-style:italic;font-weight:900' }
    ],
    blocks: [
      { y: 23.8, h: 12.4, viaY: 31.9, viaH: 4.3, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 40.9, h: 14.5, viaY: 49.8, viaH: 5.6, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 59.9, h: 12.1, viaY: 67.6, viaH: 4.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 77.8, h: 11.9, viaY: 85.5, viaH: 4.2, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} }
    ]
  },
  'cati-ar': {
    file: 'img/infogare/CATI-AR.png',
    width: 1100, height: 611,
    bg: '#0b2e12',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 10, color: '#fff', bg: '#0b2e12', fontSize: 16, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 12, h: 7, color: '#fff', bg: '#1e40af', fontSize: 16, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 5, h: 15.5, viaY: 12.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 20.5, h: 15.5, viaY: 28, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 36, h: 15.5, viaY: 43.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 51.5, h: 15.5, viaY: 59, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 67, h: 15.5, viaY: 74.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 81.5, h: 13.5, viaY: 86, viaH: 7.5, status:{x:9,w:14,h:6.5}, time: {x:24,w:12,h:6.5}, provenance:{x:38,w:45,h:6.5}, via:{x:9,w:74,h:6.5} }
    ]
  },
  'cati-3-3': {
    file: 'img/infogare/CATI-3-3.png',
    width: 250, height: 138,
    bg: '#0b1836',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 11, color: '#fff', bg: '#0b1836', fontSize: 8, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 12, h: 13, viaY: 19, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 25, h: 13, viaY: 32, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 38, h: 13, viaY: 45, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 51, h: 13, viaY: 58, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 64, h: 13, viaY: 71, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 77, h: 13, viaY: 84, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} }
    ]
  },
  'cati-complet': {
    file: 'img/infogare/CATI-COMPLET.png',
    width: 250, height: 137,
    bg: '#0b1836',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 11, color: '#fff', bg: '#0b1836', fontSize: 8, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 12, h: 14, viaY: 17, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 26, h: 14, viaY: 31, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 40, h: 14, viaY: 45, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 54, h: 14, viaY: 59, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 68, h: 14, viaY: 73, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} }
    ]
  }
};

// NAV-01/02/03/04 — fusions de pages (A1.2). Les pages fusionnées gardent leur
// contenu mais sont regroupées sous une page parente via des sous-onglets.
// child -> parent (le bouton de nav du parent reste actif sur l'enfant).
const PAGE_PARENT = { economy: 'dashboard', bank: 'dashboard', unions: 'staff', seasonal: 'weather' };
// Groupes de sous-onglets injectés en tête des pages membres.
const PAGE_GROUPS = [
  [['dashboard', 'Dashboard'], ['economy', 'Finances'], ['bank', 'Banque']],
  [['staff', 'Personnel'], ['unions', 'Syndicats']],
  [['weather', 'Météo'], ['seasonal', 'Saisons']],
];

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
    this._schedPage = 0;
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

    this._setupPageGroups();
  }

  // NAV-01/02/03/04 — injecte une barre de sous-onglets en tête de chaque page
  // membre d'un groupe fusionné, pour naviguer entre parent et enfants.
  _setupPageGroups() {
    for (const tabs of PAGE_GROUPS) {
      const barHtml = `<div class="subnav">${tabs
        .map(([p, l]) => `<button class="subnav-btn" data-page="${p}">${l}</button>`)
        .join('')}</div>`;
      for (const [pageId] of tabs) {
        const pageEl = document.getElementById(`page-${pageId}`);
        if (pageEl && !pageEl.querySelector(':scope > .subnav')) {
          pageEl.insertAdjacentHTML('afterbegin', barHtml);
        }
      }
    }
    document.querySelectorAll('.subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
    });
  }

  switchPage(page) {
    this.activePage = page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    // NAV — un enfant fusionné garde le bouton de nav de son parent actif.
    const navKey = PAGE_PARENT[page] || page;
    document.querySelector(`.nav-btn[data-page="${navKey}"]`)?.classList.add('active');
    document.querySelectorAll('.subnav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
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
      // Industry drag-to-move (shift+click)
      if (e.shiftKey && this._hoveredIndustry) {
        this._draggingIndustry = this._hoveredIndustry;
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
      // Finish industry drag — persist the new location
      if (this._draggingIndustry) {
        const ind = this._draggingIndustry;
        this._draggingIndustry = null;
        canvas.style.cursor = 'grab';
        this.game.industrialClients.setLocationOverride(ind._key, ind.lat, ind.lon);
        this.game.saveState();
        return;
      }
      if (!this.dragMoved && this.game.renderer) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // LVM-04/06 — clic sur un train : sélection + panneau détail.
        const _anyMode = this._pickConnectionMode || this.tronconCreationMode
          || this.manualTronconMode || this.tracerLigneMode || this.voiePointCreationMode
          || this.stationCreationMode || this.game._pendingSignalBox || this.game._pendingRegZone;
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
          || this.stationCreationMode || this.game._pendingSignalBox || this.game._pendingRegZone;
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
  }

  handleMapHover(x, y) {
    const renderer = this.game.renderer;
    if (!renderer) return;
    this._hoveredIndustry = null;
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

    // Industry markers (only interactive when the layer is shown)
    if (document.getElementById('toggle-industries')?.checked) {
      const ind = renderer.getIndustryAt(x, y);
      if (ind) {
        tooltip.innerHTML = `<div class="tt-name">${ind.name}</div><div class="tt-info">${ind.industryName}</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Shift+drag pour deplacer</div>`;
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y - 10) + 'px';
        tooltip.classList.remove('hidden');
        this._hoveredIndustry = ind;
        return;
      }
    }
    tooltip.classList.add('hidden');
  }

  // LVM-04 — trouve le service (train) le plus proche du clic écran (rayon px).
  _findServiceAtScreen(x, y) {
    const renderer = this.game.renderer;
    if (!renderer || !this.game.scheduleCreator) return null;
    const services = this.game.scheduleCreator.getActiveServices();
    let best = null, bestD = 16; // seuil px
    for (const svc of services) {
      if (!svc.position || svc.state === 'completed') continue;
      if (svc.state === 'waiting' && !svc.train?.stoppedAt) continue;
      const p = renderer.latLonToScreen(svc.position.lat, svc.position.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = svc; }
    }
    return best;
  }

  selectService(svc) {
    this.selectedService = svc;
    this._lvpKey = null; // force un rebuild complet
    this._lastSelectedForScroll = null; // force le bandeau à scroller sur la carte
    this._syncLivemapPanel();
  }

  // Appelé à chaque frame (updateTrainsList) : rebuild seulement si le trajet
  // change (leg aller/retour, nb d'arrêts), sinon simple rafraîchissement léger
  // pour ne pas casser le bandeau défilant ni le bouton fermer.
  _syncLivemapPanel() {
    const svc = this.selectedService;
    const panel = document.getElementById('livemap-train-panel');
    if (!panel) return;
    if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
      this.selectedService = null;
      this._lvpKey = null;
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
    // Rafraîchissement léger
    const t = svc.train;
    const sp = document.getElementById('lvp-speed');
    if (sp) sp.textContent = `${Math.round(t.speed)} km/h`;
    const dl = document.getElementById('lvp-delay');
    if (dl) {
      const d = Math.round(t.delay || 0);
      dl.className = d > 0 ? 'late' : d < 0 ? 'early' : 'ok';
      dl.textContent = d > 0 ? `+${d} min` : d < 0 ? `- ${Math.abs(d)} min` : `à l'heure`;
    }
    const cur = svc.currentStopIndex || 0;
    panel.querySelectorAll('.lvp-stop').forEach((el, i) => {
      el.classList.toggle('cur', i === cur);
    });
  }

  selectServiceById(id) {
    const svc = this.game.scheduleCreator?.services.find(s => s.id === id);
    if (svc) this.selectService(svc);
  }

  deselectService() {
    this.selectedService = null;
    this._lastSelectedForScroll = null;
    document.getElementById('livemap-train-panel')?.classList.add('hidden');
  }

  // LVM-03/04/06 — panneau détail du train sélectionné (annexes 4-5).
  _renderLivemapPanel() {
    const panel = document.getElementById('livemap-train-panel');
    if (!panel) return;
    const svc = this.selectedService;
    // Le service a pu se terminer / disparaître : on referme.
    if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
      this.selectedService = null;
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
    const d = Math.round(t.delay || 0);

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

    // Annex 5 — planned (crossed-out) vs recalculated (violet circle) times.
    const buildTimes = (s, i) => {
      const isFirst = i === 0;
      const isLast = i === stops.length - 1;
      const isWp = s.type === 'waypoint' || !s.stationId;
      const arr = s.arrivalTime ?? s.departureTime ?? 0;
      const dep = s.departureTime ?? s.arrivalTime ?? 0;
      const actualArr = arr + d;
      const actualDep = dep + d;
      const dwell = (!isFirst && !isLast && !isWp && dep > arr) ? Math.max(0, Math.round(dep - arr)) : 0;
      const dwellTxt = dwell > 0 ? ` · ${dwell} min d'arrêt` : '';
      const baseLabel = isFirst ? `dép ${fmt(dep)}`
        : isLast ? `arr ${fmt(arr)}`
        : isWp ? `pass ${fmt(arr)}`
        : `${fmt(arr)}–${fmt(dep)}${dwellTxt}`;
      const actLabel = isFirst ? `dép ${fmt(actualDep)}`
        : isLast ? `arr ${fmt(actualArr)}`
        : isWp ? `pass ${fmt(actualArr)}`
        : `${fmt(actualArr)}–${fmt(actualDep)}${dwellTxt}`;
      const showRecalc = d !== 0 && i >= curIdx;
      if (!showRecalc) return `<span class="lvp-base-time">${baseLabel}</span>`;
      const cls = d > 0 ? 'lvp-recalc-late' : 'lvp-recalc-early';
      return `<span class="lvp-base-time" style="text-decoration:line-through;color:#888;margin-right:4px">${baseLabel}</span><span class="lvp-recalc ${cls}">${actLabel}</span>`;
    };

    const rows = stops.map((s, i) => {
      const isWp = s.type === 'waypoint' || !s.stationId;
      const name = isWp ? 'Waypoint' : (world.getStationById(s.stationId)?.name || '—');
      const cur = i === curIdx ? ' cur' : '';
      const plat = s.platform ? ` (Voie ${s.platform})` : '';
      const typeBadge = s.stopCode ? `<span class="lvp-stop-type">${s.stopCode}</span>` : (isWp ? '<span class="lvp-stop-type wp">WPT</span>' : '');
      return `<div class="lvp-stop${cur}">${typeBadge}<span class="lvp-stop-name${isWp ? ' wp' : ''}">${name}${plat}</span><span class="lvp-stop-times">${buildTimes(s, i)}</span></div>`;
    }).join('');

    const upcoming = stops.slice(curIdx)
      .filter(s => s.stationId)
      .map(s => world.getStationById(s.stationId)?.name)
      .filter(Boolean);
    const bandeau = upcoming.length ? `Prochains arrêts : ${upcoming.join('  •  ')}` : 'Service terminé';

    // Annex 5 — detailed situational info
    const prevStop = stops[prevIdx];
    const curStop = stops[curStationIdx];
    const nextStop = stops[nextIdx];
    const prevName = prevStop?.stationId ? (world.getStationById(prevStop.stationId)?.name || '—') : (prevStop ? 'Waypoint' : '—');
    const curName = curStop?.stationId ? (world.getStationById(curStop.stationId)?.name || '—') : (curStop ? 'Waypoint' : '—');
    let nextName = nextStop?.stationId ? (world.getStationById(nextStop.stationId)?.name || '—') : (nextStop ? 'Waypoint' : '—');
    if (svc.state === 'moving') {
      nextName = curName;
    }
    const destName = stops.length > 1 ? (world.getStationById(stops[stops.length - 1].stationId)?.name || '—') : '—';
    const displayNext = svc.state === 'moving' ? curStop : nextStop;
    const nextArrTime = displayNext ? (displayNext.arrivalTime ?? displayNext.departureTime) : null;
    const nextArrLabel = nextArrTime != null
      ? (d !== 0
          ? ` · Arr. <span style="text-decoration:line-through;color:#888">${fmt(nextArrTime)}</span> <span class="lvp-recalc ${d > 0 ? 'lvp-recalc-late' : 'lvp-recalc-early'}">${fmt(nextArrTime + d)}</span>`
          : ` · Arr. ${fmt(nextArrTime)}`)
      : '';
    const situation = svc.cancelled
      ? '<span style="color:#ef4444;font-weight:600">Service supprimé</span>'
      : (t.speed === 0 && (svc.state === 'stopped_at_station' || svc.train?.stoppedAt)
        ? `Arrêt en gare de <b>${curName}</b>`
        : (curIdx > 0 && curIdx < stops.length
          ? `Se situe entre <b>${prevName}</b> et <b>${curName}</b>`
          : (curIdx === 0 ? `Au départ de <b>${curName}</b>` : `Service terminé`)));

    const rame = svc.rame;
    const composition = rame
      ? `<div style="padding:6px 10px;font-size:10px;color:var(--text2);border-bottom:1px solid #333;background:#0d0d0d">
           <b>Composition :</b> ${rame.name}<br>
           Long: ${rame.totalLength.toFixed(1)}m · Tonnage: ${rame.totalTonnage}t · Vmax: ${rame.maxSpeed} km/h · Traction: ${rame.traction}
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
      <div class="lvp-header" style="background:${catColor}">
        <img src="${panelIcon}" class="lvp-cat" alt="">
        <span class="lvp-title">${displayName}</span>
        ${numLabel}
        <button class="lvp-close" onclick="game.ui.deselectService()" title="Fermer">×</button>
      </div>
      <div class="lvp-sub"><span id="lvp-speed">${Math.round(t.speed)} km/h</span><span id="lvp-delay" class="${d > 0 ? 'late' : d < 0 ? 'early' : 'ok'}">${d > 0 ? '+' + d + ' min' : d < 0 ? '- ' + Math.abs(d) + ' min' : "à l'heure"}</span><span>${LVM_CAT_LABELS[cat] || cat}</span></div>
      <div class="lvp-situation">${situation}</div>
      ${t.delayReason ? `<div class="lvp-delay-reason">${t.delayReason}</div>` : ''}
      <div class="lvp-next">Prochain arrêt : <b>${nextName}</b>${nextArrLabel} · Destination: <b>${destName}</b></div>
      ${composition}
      ${payloadInfo ? `<div class="lvp-payload">${payloadInfo}</div>` : ''}
      <div class="lvp-bandeau"><span class="lvp-bandeau-track">${bandeau}</span></div>
      <div class="lvp-stops">${rows}</div>
      <div class="lvp-legend">dép = départ · pass = passage · arr = arrivée</div>
    `;
    panel.classList.remove('hidden');
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
    // BUG-12 : validation du point de voie avec Entrée (découplée du focus souris)
    document.getElementById('modal-voie-point')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._saveVoiePoint(); }
    });
    document.getElementById('modal-station')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.saveStation(); }
    });
    // Modals do NOT close on outside click (player feedback)
  }

  // --- STATION CREATION ---
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
  }

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
      this.game.depotManager.add({ type: 'depot', name: `Depot ${name}`, stationId: station.id, tracks: platforms, cost: 0, infrastructure: ['rotonde', 'technicentre'] }, this.game.economy);
    }
    if (type === 'ite') {
      this.game.depotManager.add({ type: 'ite-fret', name: `ITE ${name}`, stationId: station.id, tracks: 2, cost: 0 });
    }

    document.getElementById('modal-station')?.classList.add('hidden');
    this.game.saveState();
    // Multi-creation: re-enter station creation mode
    if (this._multiCreateMode === 'station') {
      setTimeout(() => this.toggleStationCreation(), 100);
    }
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
  }

  // S9: Delete a station safely
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
    const search = document.getElementById('stock-search');
    const catFilter = document.getElementById('stock-cat-filter');
    search?.addEventListener('input', () => { this._stockPage = 0; this.renderStockList(); });
    catFilter?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
  }

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
  }

  _setStockField(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  _setStockTraction(values) {
    const checkboxes = document.querySelectorAll('.stock-traction-cb');
    const set = new Set(values.map(v => v.toLowerCase()));
    checkboxes.forEach(cb => { cb.checked = set.has(cb.value.toLowerCase()); });
  }

  _getStockTraction() {
    return Array.from(document.querySelectorAll('.stock-traction-cb:checked')).map(cb => cb.value);
  }

  _getStockTractionString() {
    const vals = this._getStockTraction();
    if (vals.length === 0) return 'none';
    return vals.join('+');
  }

  _setStockWagonSubcat(val) {
    const el = document.getElementById('stock-wagon-subcat');
    if (el) el.value = val;
  }

  _getStockWagonSubcat() {
    return document.getElementById('stock-wagon-subcat')?.value || '';
  }

  _computeStockTonnage() {
    const category = document.getElementById('stock-category')?.value || 'locomotive';
    const mass = parseFloat(document.getElementById('stock-mass')?.value) || 0;
    const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
    return category === 'wagon' ? Math.round(mass + freightCap) : Math.round(mass);
  }

  _calculateStockPrice() {
    const category = document.getElementById('stock-category')?.value || 'locomotive';
    const mass = parseFloat(document.getElementById('stock-mass')?.value) || 0;
    const maxSpeed = parseFloat(document.getElementById('stock-speed')?.value) || 0;
    const power = parseFloat(document.getElementById('stock-power')?.value) || 0;
    const capacity = parseFloat(document.getElementById('stock-capacity')?.value) || 0;
    const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
    const traction = this._getStockTraction();
    // MAT-04 : calcul automatique du prix selon caractéristiques physiques.
    // coefficients choisis pour rester cohérents à l'échelle du jeu (€).
    let price = mass * 800 + maxSpeed * 100 + power * 150 + capacity * 1200 + freightCap * 80;
    // légère surcote multi-courant
    const nbTraction = Math.max(1, traction.length);
    price *= (1 + (nbTraction - 1) * 0.08);
    // les locomotives/automotrices coûtent plus cher que les wagons passifs
    if (category === 'locomotive') price *= 1.3;
    if (category === 'automotrice') price *= 1.15;
    return Math.max(0, Math.round(price));
  }

  _updateStockComputedFields() {
    const tonnage = this._computeStockTonnage();
    const price = this._calculateStockPrice();
    const tonEl = document.getElementById('stock-tonnage-display');
    if (tonEl) tonEl.textContent = `${tonnage} t`;
    const priceEl = document.getElementById('stock-price-display');
    if (priceEl) priceEl.textContent = `${price.toLocaleString('fr-FR')} €`;
  }

  // Wire the category->cargo-types visibility toggle (idempotent: replaces the node's listener).
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
  }

  // Open the modal pre-filled to edit an existing engin.
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
  }

  renderStockList() {
    const container = document.getElementById('stock-list');
    if (!container) return;
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
    let items = all;
    if (cat) items = items.filter(i => i.category === cat);
    if (q) items = items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.seriesName || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.traction || '').toLowerCase().includes(q));
    const PAGE = 60;
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
    container.innerHTML = view.map(item => `
      <div class="card">
        ${item.imageData ? `<img src="${item.imageData}" loading="lazy" class="card-img" alt="${item.name}">` : ''}
        <div class="card-title">${item.name}</div>
        <div class="card-info">
          <b>Cat:</b> ${item.category}${item.wagonSubCategory ? ` — ${item.wagonSubCategory}` : ''} | <b>Tract:</b> ${item.traction}<br>
          <b>Vmax:</b> ${item.maxSpeed} km/h | <b>Long:</b> ${item.length}m<br>
          <b>Tonnage:</b> ${item.tonnage}t | <b>Masse:</b> ${item.mass}t${item.power ? ` | <b>P:</b> ${item.power}kW` : ''} | <b>Places:</b> ${item.passengerCapacity} | <b>Fret:</b> ${item.freightCapacity}t
          ${item.purchasePrice ? `<br><b>Prix:</b> ${item.purchasePrice.toLocaleString('fr-FR')} €` : ''}
          ${item.seriesName ? `<br><b>Serie:</b> ${item.seriesName}` : ''}
          ${item.cargoTypes?.length ? `<br><b>Chargements:</b> <span style="font-size:9px">${item.cargoTypes.map(ct => { const info = this.game.cargoTypes?.getTypeInfo?.(ct); return info?.name || ct; }).join(', ')}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-sm" onclick="game.ui.editStock('${item.id}')">Modifier</button>
          <button class="btn-sm danger" onclick="game.ui.deleteStock('${item.id}')">Supprimer</button>
        </div>
      </div>
    `).join('');
    if (pager) {
      if (pages <= 1) { pager.innerHTML = ''; }
      else {
        pager.innerHTML = `
          <button class="btn-sm" ${this._stockPage === 0 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${this._stockPage - 1})">‹ Préc.</button>
          <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._stockPage + 1} / ${pages}</span>
          <button class="btn-sm" ${this._stockPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${this._stockPage + 1})">Suiv. ›</button>`;
      }
    }
  }

  stockPageGo(p) {
    this._stockPage = p;
    this.renderStockList();
    document.getElementById('stock-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  deleteStock(id) {
    if (!confirm('Supprimer cet engin ?')) return;
    this.game.rollingStock.remove(id);
    this.game.saveState();
    this.renderStockList();
  }

  // --- RAMES ---
  setupRamePage() {
    document.getElementById('btn-new-rame')?.addEventListener('click', () => this.openRameModal());
    document.getElementById('btn-save-rame')?.addEventListener('click', () => this.saveRame());
    const pickerSearch = document.getElementById('rame-search');
    if (pickerSearch) pickerSearch.addEventListener('input', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
    document.getElementById('rame-cat-filter')?.addEventListener('change', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
    document.getElementById('btn-clear-rame')?.addEventListener('click', () => {
      this.currentRameElements = [];
      this.renderRameAssembly();
    });
    // Section III — recherche et pagination de la liste des rames.
    this._ramesPage = 0;
    const ramesSearch = document.getElementById('rames-search');
    if (ramesSearch) ramesSearch.addEventListener('input', () => { this._ramesPage = 0; this.renderRamesList(); });
    const ramesPerPage = document.getElementById('rames-per-page');
    if (ramesPerPage) ramesPerPage.addEventListener('change', () => { this._ramesPage = 0; this.renderRamesList(); });
  }

  openRameModal() {
    this.currentRameElements = [];
    this.editingRameId = null;
    this._ramePickerPage = 0;
    document.getElementById('rame-name').value = '';
    const ser = document.getElementById('rame-serial'); if (ser) ser.value = '';
    const s = document.getElementById('rame-search'); if (s) s.value = '';
    const c = document.getElementById('rame-cat-filter'); if (c) c.value = '';
    const q = document.getElementById('rame-qty'); if (q) q.value = '1';
    const depotSel = document.getElementById('rame-depot');
    if (depotSel) {
      const depots = this.game.depotManager.getDepots();
      depotSel.innerHTML = '<option value="">— Aucun —</option>' + depots.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }
    document.getElementById('modal-rame')?.classList.remove('hidden');
    this.renderRamePicker();
    this.renderRameAssembly();
  }

  renderRamePicker() {
    const container = document.getElementById('rame-stock-picker');
    if (!container) return;
    const pager = document.getElementById('rame-picker-pager');
    const countEl = document.getElementById('rame-picker-count');
    const all = this.game.rollingStock.getAll();
    if (all.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:11px">Aucun materiel. Ajoutez-en d\'abord dans la page Materiel.</p>';
      if (pager) pager.innerHTML = '';
      if (countEl) countEl.textContent = '';
      return;
    }
    const query = (document.getElementById('rame-search')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('rame-cat-filter')?.value || '';
    let items = all;
    if (cat) items = items.filter(i => i.category === cat);
    if (query) items = items.filter(i =>
      (i.name || '').toLowerCase().includes(query) ||
      (i.seriesName || '').toLowerCase().includes(query) ||
      (i.category || '').toLowerCase().includes(query) ||
      (i.traction || '').toLowerCase().includes(query));
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
    container.innerHTML = view.map(item => `
        <div class="stock-picker-item" onclick="game.ui.addToRame('${item.id}')" title="${item.name} — ${item.category}, ${item.maxSpeed} km/h, ${item.length}m">
          ${item.imageData ? `<img src="${item.imageData}" loading="lazy" alt="${item.name}">` : `<div style="height:30px;width:60px;background:var(--bg);border-radius:2px"></div>`}
          <span>${item.name}${item.purchasePrice ? ` <span style="color:var(--orange);font-size:9px">${(item.purchasePrice/1000).toFixed(0)}k€</span>` : ''}</span>
        </div>
      `).join('');
    if (pager) {
      pager.innerHTML = pages <= 1 ? '' : `
        <button class="btn-sm" ${this._ramePickerPage === 0 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${this._ramePickerPage - 1})">‹ Préc.</button>
        <span style="margin:0 12px;align-self:center;font-size:12px">Page ${this._ramePickerPage + 1} / ${pages}</span>
        <button class="btn-sm" ${this._ramePickerPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${this._ramePickerPage + 1})">Suiv. ›</button>`;
    }
  }

  ramePickerPageGo(p) {
    this._ramePickerPage = p;
    this.renderRamePicker();
    document.getElementById('rame-stock-picker')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  addToRame(stockId) {
    const item = this.game.rollingStock.getById(stockId);
    if (!item) return;
    let qty = parseInt(document.getElementById('rame-qty')?.value || '1', 10);
    if (!isFinite(qty) || qty < 1) qty = 1;
    let currentLength = this.currentRameElements.reduce((s, e) => s + e.length, 0);
    let added = 0;
    for (let n = 0; n < qty; n++) {
      if (currentLength + item.length > 750) break;
      // Annexe 8 : numérotation automatique par série dans la rame.
      const instanceNumber = item.seriesName
        ? this.game.rollingStock.nextSeriesNumber(item.seriesName)
        : null;
      const instanceName = instanceNumber || item.name;
      this.currentRameElements.push({ ...item, stockId: item.id, instanceName, instanceNumber });
      currentLength += item.length;
      added++;
    }
    if (added < qty) {
      alert(added === 0
        ? 'Longueur maximale de 750m atteinte !'
        : `Longueur max 750m atteinte : ${added}/${qty} engin(s) ajouté(s).`);
    }
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
        const label = el.instanceName || el.name;
        const inner = el.imageData
          ? `<img src="${el.imageData}" alt="${label}" title="${label} (clic = retirer)" onclick="game.ui.removeFromRame(${i})" class="rame-element-img">`
          : `<div class="rame-element-placeholder" title="${label}" onclick="game.ui.removeFromRame(${i})">${label}</div>`;
        return `<div class="rame-element-wrap">${inner}<span class="rame-element-label">${label}</span></div>`;
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

    const depotId = document.getElementById('rame-depot')?.value || '';
    const serialNumber = document.getElementById('rame-serial')?.value.trim() || '';
    this.game.rameManager.add({
      name,
      serialNumber,
      depotId,
      elements: this.currentRameElements.map(e => e.stockId),
      elementDetails: this.currentRameElements.map(e => ({
        name: e.name, instanceName: e.instanceName, seriesName: e.seriesName,
        category: e.category, traction: e.traction,
        maxSpeed: e.maxSpeed, tonnage: e.tonnage,
        mass: e.mass || e.tonnage, power: e.power || 0,
        passengerCapacity: e.passengerCapacity, freightCapacity: e.freightCapacity,
        length: e.length, imageData: e.imageData,
        purchasePrice: e.purchasePrice || 0,
        wagonSubCategory: e.wagonSubCategory || '',
      })),
    });
    document.getElementById('modal-rame')?.classList.add('hidden');
    this.renderRamesList();
  }

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

    container.innerHTML = view.map(r => `
      <div class="rame-card">
        <div class="rame-card-header">
          <span class="card-title">${r.name}${r.serialNumber ? ` <span style="font-size:11px;color:var(--text3);font-weight:400">(${r.serialNumber})</span>` : ''}</span>
          <button class="btn-sm danger" onclick="game.ui.deleteRame('${r.id}')">Supprimer</button>
        </div>
        <div class="rame-card-images">
          ${r.elementDetails.map(e => {
            const label = e.instanceName || e.name;
            return e.imageData
              ? `<img src="${e.imageData}" alt="${label}" title="${label}">`
              : `<span class="rame-text-el">${label}</span>`;
          }).join('')}
        </div>
        <div class="card-info">
          <b>Long:</b> ${r.totalLength.toFixed(1)}m | <b>Tonnage:</b> ${r.totalTonnage}t |
          <b>Places:</b> ${r.totalCapacity} | <b>Fret:</b> ${r.totalFreightCapacity}t | <b>Vmax:</b> ${r.maxSpeed} km/h |
          <b>Traction:</b> ${r.traction}
        </div>
        <div class="card-info" style="font-size:10px;color:var(--text3)">
          <b>Mise en service:</b> ${r.createdDate} | <b>Km parcourus:</b> ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km${r.elementDetails.some(e => e.purchasePrice) ? ` | <b>Valeur:</b> ${r.elementDetails.reduce((s,e) => s + (e.purchasePrice || 0), 0).toLocaleString('fr-FR')} €` : ''}
          ${r.depotId ? `| <b>Dépôt:</b> ${(this.game.depotManager.getAll().find(d => d.id === r.depotId)?.name || r.depotId)}` : ''}
          ${r.currentLocation ? `| <b>Position:</b> ${this._rameLocationLabel(r)}` : ''}
        </div>
      </div>
    `).join('');

    if (pager) {
      if (pages <= 1) { pager.innerHTML = ''; }
      else {
        pager.innerHTML = `
          <button class="btn-sm" ${this._ramesPage === 0 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${this._ramesPage - 1})">‹ Préc.</button>
          <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._ramesPage + 1} / ${pages}</span>
          <button class="btn-sm" ${this._ramesPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${this._ramesPage + 1})">Suiv. ›</button>`;
      }
    }
  }

  ramesPageGo(p) {
    this._ramesPage = p;
    this.renderRamesList();
    document.getElementById('rames-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
  }

  deleteRame(id) {
    if (!confirm('Supprimer cette rame ?')) return;
    this.game.rameManager.remove(id);
    this.game.saveState();
    this.renderRamesList();
  }

  // --- SCHEDULES ---
  setupSchedulePage() {
    document.getElementById('btn-new-schedule')?.addEventListener('click', () => this.openScheduleModal());
    document.getElementById('btn-save-schedule')?.addEventListener('click', () => this.saveSchedule());
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
  }

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
  }

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
  }

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
    this._traceEditMode = false;
    this._traceSelectedPoint = null;
    this._traceDragging = null;
    this._updateManualUI();

    document.getElementById('modal-schedule')?.classList.remove('hidden');

    const rameSelect = document.getElementById('sched-rame');
    const rames = this.game.rameManager.getAll();
    rameSelect.innerHTML = rames.map(r => `<option value="${r.id}">${r.name} (${r.maxSpeed} km/h)</option>`).join('');
    if (editService) rameSelect.value = editService.rameId;
    rameSelect.onchange = () => { this.recalcStopsFrom(1); this._renderContractPicker(); };

    // Auto 24h button
    document.getElementById('btn-auto-ar')?.addEventListener('click', () => this._calcAutoAR());

    this._renderContractPicker(editService?.assignedContractId || '');
    this.renderSchedStops();
    this.setupSchedMap();
  }

  // Section X — affiche le sélecteur de contrat fret pour un service marchandise
  _renderContractPicker(selectedId = '') {
    const row = document.getElementById('sched-contract-row');
    const select = document.getElementById('sched-contract');
    const type = document.getElementById('sched-service-type')?.value || 'passager';
    if (!row || !select) return;
    const rameId = document.getElementById('sched-rame')?.value;
    const rame = rameId ? this.game.rameManager.getById(rameId) : null;
    const hasFreight = rame && (rame.totalFreightCapacity > 0 || rame.elementDetails?.some(e => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0));
    row.style.display = (type === 'passager' && hasFreight) ? 'flex' : 'none';

    const contracts = this.game.freightManager?.getAllActive() || [];
    const opts = contracts.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.from} → ${c.to} : ${c.cargoName} (${c.quantity}${c.unit}) — ${c.payment.toLocaleString()} €</option>`).join('');
    select.innerHTML = '<option value="">— Aucun contrat assigné —</option>' + opts;
  }

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
            ctx.fillStyle = isSelected ? '#38bdf8' : (isEnd ? '#f59e0b' : (isControl ? '#a5f3fc' : 'rgba(255,255,255,0.7)'));
            ctx.beginPath();
            ctx.arc(p.x, p.y, isSelected ? 7 : (isEnd ? 5 : (isControl ? 4 : 2.5)), 0, Math.PI * 2);
            ctx.fill();
            if (isSelected || isControl) {
              ctx.strokeStyle = isSelected ? '#fff' : '#38bdf8'; ctx.lineWidth = 1.5; ctx.stroke();
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
        for (const pt of this._manualControlPoints) {
          const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        for (const pt of [this._manualStartCoords, ...this._manualControlPoints]) {
          const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
          ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
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
      // 1) Trace point drag: grab a 50 m vertex to reshape the route.
      const traceHit = this._findNearestTracePoint(x, y, tileMap, canvas);
      if (traceHit && this._traceEditMode) {
        const route = this._manualRoutes[traceHit.leg];
        let control = traceHit.pt && traceHit.pt.control ? traceHit.pt : null;
        if (e.ctrlKey || e.button === 2) {
          this._removeTracePoint(traceHit.leg, traceHit.index);
          this._traceSelectedPoint = null;
        } else {
          if (!control) {
            // Dragging a densified point creates a new control point at that location.
            control = this._insertControlAt(traceHit.leg, traceHit.index, traceHit.pt.lat, traceHit.pt.lon);
          }
          this._traceSelectedPoint = { leg: traceHit.leg, control };
          this._traceDragging = { leg: traceHit.leg, control, startX: x, startY: y };
          requestDraw();
        }
        schedDrag = false; schedDragStart = null; totalDragDist = 0;
        return;
      }
      schedDrag = true;
      schedDragStart = { x, y };
      totalDragDist = 0;
    };

    canvas.onmousemove = (e) => {
      if (this._traceDragging) {
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
      const traceHit = this._findNearestTracePoint(x, y, tileMap, canvas);
      if (traceHit) cursor = 'grab';
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

      if (this._traceDragging) {
        const dw = this._traceDragging; this._traceDragging = null;
        // End of a trace-point drag: recompute travel times from this leg onward.
        await this._recalcAfterTraceEdit(dw.leg);
        this.game.saveState();
        schedDrag = false; schedDragStart = null; totalDragDist = 0;
        return;
      }
      if (totalDragDist < 5) {
        const x = e.offsetX, y = e.offsetY;

        // Manual trace mode (SC-04): choose a start point, add waypoints, then click a target point to finish — like livemap.
        if (this._manualMode) {
          const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
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

    canvas.onwheel = (e) => {
      e.preventDefault();
      tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
      requestDraw();
    };
    canvas.oncontextmenu = (e) => { e.preventDefault(); };

    this._drawSchedMap = drawMap;
    this._recalcPreviewRoutes();
  }

  // --- Manual trace helpers (remaster IV) ---

  _toggleManualMode() {
    if (this._manualMode) {
      // cancel manual mode, keep control points? If no next stop yet, just exit
      this._manualMode = false;
      this._manualStartCoords = null;
      this._manualControlPoints = [];
    } else {
      this._manualMode = true;
      this._manualStartCoords = this.schedStops.length > 0 ? this._getStopCoords(this.schedStops[this.schedStops.length - 1]) : null;
      this._manualControlPoints = [];
    }
    this._updateManualUI();
    if (this._drawSchedMap) this._drawSchedMap();
  }

  _clearManualTrace() {
    this._manualRoutes[this._manualRoutes.length - 1] = null;
    this._manualControlPoints = [];
    this._manualMode = false;
    this._manualStartCoords = null;
    this._updateManualUI();
    this._recalcPreviewRoutes();
  }

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
      btn.textContent = hasStart ? 'Terminer (cliquer gare/point)' : 'Choisir le départ';
      btn.style.background = '#3b82f6';
      btn.style.color = '#fff';
      clear.classList.remove('hidden');
      hint.textContent = hasStart
        ? 'Mode manuel actif — cliquez pour poser des points, gare/point de voie pour terminer ce segment.'
        : 'Mode manuel — cliquez sur la gare ou le point de voie de départ (comme sur la livemap).';
    } else {
      btn.textContent = 'Tracer manuellement (points 50 m)';
      btn.style.background = '';
      btn.style.color = '';
      clear.classList.add('hidden');
      const base = "Cliquer sur les gares de la carte pour définir le trajet. Les horaires sont calculés automatiquement depuis les données ORM et la rame.";
      const editHint = hasTrace ? " Attrapez un point blanc pour déplacer le tracé, Shift+clic sur un segment pour ajouter un point, Ctrl+clic pour supprimer." : '';
      hint.textContent = base + editHint;
    }
  }

  // SC-04 — switch between forward and independent return editing.
  async _toggleReturnEditMode() {
    const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
    if (!roundTrip) return;
    if (this._forwardStops.length < 2) return alert('Definissez d\'abord un aller avec au moins 2 arrets.');

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
    this._manualMode = false;
    this._manualControlPoints = [];
    this._manualStartCoords = null;
    this._updateManualUI();
    this.renderSchedStops();
    this._recalcPreviewRoutes();
  }

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
  }

  _generateDefaultReturnRoutes() {
    const rev = (this._forwardManualRoutes || []).slice().reverse();
    return rev.map(r => {
      if (!r || r.length < 2) return null;
      // Reverse the ordered lat/lon list for the return direction.
      const reversed = [...r].reverse().map(p => ({ ...p }));
      return this._densifyRoute(reversed);
    });
  }

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
  }

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
  }

  _toggleTraceEdit() {
    this._traceEditMode = !this._traceEditMode;
    if (!this._traceEditMode) this._traceSelectedPoint = null;
    this._updateManualUI();
    if (this._drawSchedMap) this._drawSchedMap();
  }

  _deleteSelectedTracePoint() {
    if (!this._traceSelectedPoint) return;
    this._removeTraceControl(this._traceSelectedPoint.leg, this._traceSelectedPoint.control);
    this._traceSelectedPoint = null;
    this._updateManualUI();
  }

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
  }

  _addManualPoint(lat, lon) {
    if (this._manualStartCoords) {
      this._manualControlPoints.push({ lat, lon });
      if (this._drawSchedMap) this._drawSchedMap();
    }
  }

  _finishManualLeg(endStop, maxSpeed = 30) {
    if (!this._manualMode || !this._manualStartCoords) return;
    const endCoords = this._getStopCoords(endStop);
    if (!endCoords) return;
    const route = this._buildManualRoute(this._manualStartCoords, this._manualControlPoints, endCoords, maxSpeed);
    const legIdx = Math.max(0, this.schedStops.length - 1); // leg between last existing stop and endStop
    this._manualRoutes[legIdx] = route;
    this._manualMode = false;
    this._manualControlPoints = [];
    this._manualStartCoords = null;
    this._updateManualUI();
  }

  _buildManualRoute(start, controls, end, maxSpeed = 30) {
    const points = [{ ...start, maxSpeed, control: true }, ...controls.map(p => ({ ...p, maxSpeed, control: true })), { ...end, maxSpeed, control: true }];
    return this._densifyRoute(points, 0.05);
  }

  // --- Sillon picker (Section V integration) ---
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
  }

  _resolveSillonPicker(index) {
    const modal = document.getElementById('modal-sillon-picker');
    if (modal) modal.classList.add('hidden');
    if (this._pendingSillonResolve) {
      const resolve = this._pendingSillonResolve;
      this._pendingSillonResolve = null;
      resolve(index);
    }
  }

  async _pickSillonForLeg(prevStop, newStop, legIdx) {
    if (!this.game.sillonManager || !prevStop?.stationId || !newStop?.stationId) return null;
    const sillons = this.game.sillonManager.getBetween(prevStop.stationId, newStop.stationId);
    if (!sillons.length) return null;

    const prevName = prevStop.stationName;
    const newName = newStop.stationName;
    const choice = await this.openSillonPicker(sillons, prevName, newName);
    if (choice === null || choice === 'orm') return null;

    const sillon = sillons[choice];
    if (!sillon || !sillon.route?.length) return null;

    // Densify to 50 m points like manual trace.
    const route = this._densifyRoute(sillon.route.map(p => ({ lat: p.lat, lon: p.lon, maxSpeed: p.maxSpeed || sillon.maxSpeed })));
    if (!this._manualRoutes) this._manualRoutes = [];
    this._manualRoutes[legIdx] = route;
    this._sillonLegSelection = this._sillonLegSelection || {};
    this._sillonLegSelection[legIdx] = sillon.name;
    return route;
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
  }

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
      type: voiePoint.stationId ? 'arret' : 'waypoint',
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
  }

  // Perpendicular distance (km) from a point to segment AB, plus the clamped
  // projection parameter t in [0,1] (used by SC-10 waypoint insertion).
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
    if (field === 'stopCode') {
      stop.stopCode = value || '';
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
  }

  // Snap a coordinate to the nearest tronçon route point (sync). Returns null
  // if no track is within ~5 km. Used when a dragged waypoint is released so it
  // sticks to the real rail, mirroring _addMapWaypoint's snapping.
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
  }

  // --- Trace editing helpers (remaster IV — points auto every 50 m) ---

  // Densify a polyline so consecutive vertices are at most `spacingKm` apart.
  // If the input route has control points (manual trace), keep those vertices
  // and densify only between them. Otherwise densify the whole polyline.
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
  }

  // Recompute a route so that it keeps roughly 50 m spacing after a manual edit.
  _resampleRoute(route, spacingKm = 0.05) {
    return this._densifyRoute(route, spacingKm);
  }

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
  }

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
  }

  // Extract the control vertices from a manual-route densified array.
  _extractRouteControls(route) {
    if (!route || route.length < 2) return [];
    return route.filter(p => p && p.control);
  }

  // Find the previous and next control points bounding a route index.
  _controlBoundsForIndex(route, index) {
    let prev = index, next = index;
    while (prev > 0 && !route[prev].control) prev--;
    while (next < route.length - 1 && !route[next].control) next++;
    return { prev, next };
  }

  // Insert a new control point on the segment that contains `route[index]` and return it.
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
  }

  // Insert a point into the trace route at a specific segment and resample.
  _insertTracePoint(leg, index, lat, lon) {
    this._insertControlAt(leg, index, lat, lon);
    this._recalcAfterTraceEdit(leg);
  }

  // Remove the nearest control point to the clicked densified point (start/end protected).
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
  }

  // Move a control point (or insert one at the clicked location) and resample the affected leg.
  _moveTracePoint(leg, control, lat, lon) {
    if (!control) return;
    const snapped = this._snapToTrack(lat, lon);
    control.lat = snapped ? snapped.lat : lat;
    control.lon = snapped ? snapped.lon : lon;
    const route = this._manualRoutes[leg];
    const controls = this._extractRouteControls(route);
    this._manualRoutes[leg] = this._densifyRoute(controls);
  }

  async _recalcAfterTraceEdit(leg) {
    // Recompute travel time for the affected leg and all subsequent stops.
    await this.recalcStopsFrom(leg + 1);
    this.renderSchedStops();
    if (this._drawSchedMap) this._drawSchedMap();
  }

  // Keep the parallel manual-routes array aligned with schedStops legs.
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
  }

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
  }

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
  }

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
  }

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
    if (route && route.length >= 2) {
      return this.game.orm.calculateTravelTime(route, rame || rameSpeed);
    }
    const prevCoords = this._getStopCoords(prevStop);
    const curCoords = this._getStopCoords(curStop);
    if (!prevCoords || !curCoords) return 15;
    const dist = this._approxRailDistance(prevCoords.lat, prevCoords.lon, curCoords.lat, curCoords.lon);
    return Math.round((dist / rameSpeed) * 60) || 1;
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
  }

  removeSchedStop(index) {
    this.schedStops.splice(index, 1);
    this._adjustManualRoutesForRemove(index);
    this.recalcStopsFrom(index);
    this.renderSchedStops();
    this._recalcPreviewRoutes();
  }

  startInsertStop(index) {
    if (this._manualMode) this._toggleManualMode();
    this._insertAfterIndex = index;
    this._traceSelectedPoint = null;
    this._traceDragging = null;
    this._updateManualUI();
  }

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
      if (item.closed) { alert('Cette gare est fermée — aucun train ne peut la desservir.'); return; }
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
  }

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
  }

  async saveSchedule() {
    const name = document.getElementById('sched-name').value.trim();
    const rameId = document.getElementById('sched-rame').value;
    if (!name) return alert('Nom requis');

    const rame = this.game.rameManager.getById(rameId);
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

    if (this._forwardStops.length < 2) return alert('Il faut au moins 2 arrets');

    // Build forward routes.
    const forwardStops = this._forwardStops;
    const forwardRoutes = await this._buildSaveRoutes(forwardStops, this._forwardManualRoutes);
    const invalidForward = forwardRoutes.findIndex(r => !r || r.length < 2);
    if (invalidForward >= 0) {
      return alert(`Impossible de calculer un itineraire ferroviaire entre les arrets aller #${invalidForward + 1} et #${invalidForward + 2}. Verifiez les points de voie / le reseau ORM.`);
    }

    // Build return routes/stops if a return leg has been defined; otherwise fall back to the reversed forward leg.
    let returnStops = [];
    let returnRoutes = [];
    if (roundTrip && this._returnStops && this._returnStops.length >= 2) {
      returnStops = this._returnStops;
      returnRoutes = await this._buildSaveRoutes(returnStops, this._returnManualRoutes);
      const invalidReturn = returnRoutes.findIndex(r => !r || r.length < 2);
      if (invalidReturn >= 0) {
        return alert(`Impossible de calculer un itineraire ferroviaire entre les arrets retour #${invalidReturn + 1} et #${invalidReturn + 2}. Verifiez les points de voie / le reseau ORM.`);
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
        return alert('Un HLP (Haut le pied) est un convoi de locomotives seules, maximum 2.');
      }
    }
    if (serviceType === 'tm') {
      const locoCount = rame.elementDetails.filter(e => e.category === 'locomotive' || e.category === 'automotrice').length;
      if (locoCount < 3 || locoCount > 12 || rame.elementDetails.length !== locoCount) {
        return alert('Un TM (Train de machines) compte 3 à 12 locomotives, rien d’autre.');
      }
    }
    if (serviceType === 'm-') {
      // CVO-05 : machine de manœuvre = une seule locomotive rattachée à un dépôt
      const locoCount = rame.elementDetails.filter(e => e.category === 'locomotive' || e.category === 'automotrice').length;
      if (locoCount !== 1 || rame.elementDetails.length !== 1) {
        return alert('Une machine de manœuvre (M-) est constituée d\'une seule locomotive.');
      }
      if (!rame.depotId) {
        return alert('Une machine de manœuvre (M-) doit être rattachée à un dépôt.');
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

    const sortMode = document.getElementById('sched-sort')?.value || 'departure';
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

    const perPage = 50;
    const total = sorted.length;
    const pageCount = Math.ceil(total / perPage) || 1;
    this._schedPage = Math.max(0, Math.min(this._schedPage, pageCount - 1));
    const start = this._schedPage * perPage;
    const pageItems = sorted.slice(start, start + perPage);
    const itemsHtml = pageItems.map(svc => {
      const stopsPreview = svc.stops.map(s => {
        const st = this.game.world.getStationById(s.stationId);
        const name = st ? st.name : s.stationId;
        const arr = this.minToTimeStr(s.arrivalTime);
        const dep = this.minToTimeStr(s.departureTime);
        if (s.type === 'waypoint') return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${name})</span>`;
        return `<span class="sched-stop-tag ${s.type}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${name}</span>`;
      }).join('<span style="color:var(--text3)"> → </span>');

      // SC-02 — display computed passage times for every real station on the route.
      const passagePreview = (svc._passageStops?.length)
        ? `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#22c55e;font-size:9px;margin-right:4px">Passages :</span>${svc._passageStops.map(p => {
          return `<span class="sched-stop-tag passage">${this.minToTimeStr(p.time)} ${p.name}</span>`;
        }).join('<span style="color:var(--text3)"> → </span>')}</div>`
        : '';

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
      const typeLabels = {
        passager: 'Voy', w: 'W', hlp: 'HLP', tm: 'TM', evo: 'EVO', work: 'Travaux'
      };
      const typeBadge = svc.serviceType && svc.serviceType !== 'passager'
        ? `<span style="display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 4px;font-size:9px;color:#94a3b8;margin-right:6px">${typeLabels[svc.serviceType] || svc.serviceType}</span>`
        : '';
      // INC-04 — motifs de retard/panne/incident dans le bilan du trajet
      const delayReason = svc.train?.delayReason || svc.delayReason || '';
      const breakdown = svc.train?.breakdown;
      const incident = svc.train?.incident;
      const bilanRows = [];
      if (svc.completed) bilanRows.push(`<span style="color:#22c55e">Terminé${svc.completedDate ? ' le ' + svc.completedDate : ''}</span>`);
      if (delayReason) bilanRows.push(`<span style="color:#f59e0b">Retard : ${delayReason}</span>`);
      if (breakdown?.type) bilanRows.push(`<span style="color:#ef4444">Panne : ${breakdown.type}</span>`);
      if (incident?.name || incident?.effect) bilanRows.push(`<span style="color:#ef4444">Incident : ${incident.name || incident.effect}</span>`);
      const bilanHtml = bilanRows.length > 0
        ? `<div class="sched-bilan" style="margin-top:6px;padding:6px 8px;background:var(--bg3);border-radius:4px;font-size:10px;display:flex;flex-wrap:wrap;gap:8px">${bilanRows.join('')}</div>`
        : '';
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
      // SC-03 — numéro de service : aller impair / retour pair.
      const numLabel = svc.number != null
        ? `<span style="color:#fbbf24;font-size:10px;font-weight:700;min-width:34px" title="N° aller${svc.roundTrip ? ' / retour' : ''}">N°${svc.number}${svc.roundTrip && svc.returnNumber != null ? '/' + svc.returnNumber : ''}</span>`
        : '';

      return `${groupHeader}
        <div class="sched-item">
          <div class="sched-item-header" onclick="game.ui.toggleSchedDetail('${svc.id}')" style="cursor:pointer">
            <span class="sched-caret" id="sched-caret-${svc.id}" style="color:var(--text3);font-size:10px;width:12px;transition:transform .15s">▸</span>
            <span style="color:var(--text3);font-size:10px;min-width:38px">${depTime}</span>
            ${numLabel}
            ${typeBadge}
            <span class="sched-item-name">${svc.name}${statusLabel}</span>
            <span class="sched-item-rame">${rame ? rame.name : 'N/A'}</span>
            <span style="color:var(--text3);font-size:10px">${Math.round(svc.plannedDistance || svc.totalDistance)} km${tripInfo}</span>
            <span style="color:#60a5fa;font-size:9px">${daysLabel}${datesLabel}</span>
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.editSchedule('${svc.id}')">Modifier</button>
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.duplicateSchedulePrompt('${svc.id}')">Dupliquer</button>
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.toggleSchedule('${svc.id}')">${svc.active ? 'Desactiver' : 'Activer'}</button>
            <button class="btn-sm danger" onclick="event.stopPropagation();game.ui.deleteSchedule('${svc.id}')">Supprimer</button>
          </div>
          <div class="sched-detail hidden" id="sched-detail-${svc.id}">
            <div style="font-size:10px;color:var(--text2);margin:4px 0 2px">${dirLabel}</div>
            <div class="sched-stops-preview">${stopsPreview}</div>
            ${passagePreview}
            ${returnPreview}
            ${bilanHtml}
          </div>
        </div>
      `;
    }).join('');

    const controls = pageCount > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:8px;background:var(--bg3);border-radius:4px;font-size:11px">
        <span>Page ${this._schedPage + 1} / ${pageCount} — ${total} trajets</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" ${this._schedPage === 0 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(-1)">Précédent</button>
          <button class="btn-sm" ${this._schedPage >= pageCount - 1 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(1)">Suivant</button>
        </div>
      </div>` : '';
    container.innerHTML = itemsHtml + controls;
  }

  changeSchedPage(delta) {
    this._schedPage += delta;
    this.renderSchedulesList();
  }

  // SC-08 — clic sur une ligne = menu déroulant détaillé du trajet.
  toggleSchedDetail(id) {
    const detail = document.getElementById(`sched-detail-${id}`);
    const caret = document.getElementById(`sched-caret-${id}`);
    if (!detail) return;
    const open = detail.classList.toggle('hidden');
    if (caret) caret.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
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
    if (!confirm('Supprimer ce service ?')) return;
    this.game.scheduleCreator.removeService(id);
    this.game.saveState();
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

    // SIG-08 — signaux ajoutables par le joueur
    document.getElementById('btn-add-signal')?.addEventListener('click', () => this.addPlayerSignal());

    // Section V — Sillons automatiques
    document.getElementById('btn-new-sillon')?.addEventListener('click', () => this.openSillonCreator());
    document.getElementById('btn-save-sillon')?.addEventListener('click', () => this.saveSillon());
    document.getElementById('btn-cancel-sillon')?.addEventListener('click', () => {
      document.getElementById('sillon-creator')?.classList.add('hidden');
    });

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
    this._populateLineStationSelect();
    this._setupLineStationSearch();
    setTimeout(() => this.setupLineMap(), 50);
  }

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
    select.innerHTML = stations.map(st => `<option value="${st.id}">${st.name}</option>`).join('');
    select.dataset.stations = JSON.stringify(stations.map(s => ({ id: s.id, name: s.name })));
  }

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
        const label = (stA?.name || '?') + ' ↔ ' + (stB?.name || '?');
        const tracks = line.trackIds.map(id => this.game.world.tracks.find(t => t.id === id) || this.game.voiePointManager?.getTronconById(id)).filter(Boolean);
        const wear = tracks.length ? (tracks.reduce((s, t) => s + (t.wear || 0), 0) / tracks.length).toFixed(1) : '-';
        const incidents = this.game.incidentManager?.getActiveIncidentsOnLine(line.stops) || [];
        const status = incidents.length ? '<span style="color:#ef4444">Perturbé</span>' : '<span style="color:#22c55e">Ouvert</span>';
        return `<div class="dash-train-row" style="grid-template-columns:2fr 2fr 1fr 1fr"><span>${line.name}</span><span style="color:var(--text3);font-size:10px">${label}</span><span>${wear}%</span><span>${status}</span></div>`;
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

    this.renderSillonsList();
    this.renderSignals();
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

  // --- SIGNAUX JOUEUR (SIG-08) ---
  _populateSignalStations() {
    const selA = document.getElementById('signal-station-a');
    const selB = document.getElementById('signal-station-b');
    if (!selA || !selB) return;
    const stations = (this.game.world?.stations || []).map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
    const opts = '<option value="">—</option>' + stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (selA.innerHTML !== opts) selA.innerHTML = opts;
    if (selB.innerHTML !== opts) selB.innerHTML = opts;
  }

  addPlayerSignal() {
    const name = document.getElementById('signal-name')?.value.trim() || 'Signal';
    const stationA = document.getElementById('signal-station-a')?.value;
    const stationB = document.getElementById('signal-station-b')?.value;
    const type = document.getElementById('signal-type')?.value || 'ralentissement';
    const speedLimit = parseInt(document.getElementById('signal-speed')?.value) || 40;
    if (!stationA || !stationB || stationA === stationB) {
      alert('Selectionnez deux gares differentes.');
      return;
    }
    this.game.signalManager.add({ name, stationA, stationB, type, speedLimit: type === 'arret' ? 0 : speedLimit, active: true });
    this.game.saveState();
    this.renderSignals();
  }

  deletePlayerSignal(id) {
    if (!confirm('Supprimer ce signal ?')) return;
    this.game.signalManager.remove(id);
    this.game.saveState();
    this.renderSignals();
  }

  renderSignals() {
    this._populateSignalStations();
    const container = document.getElementById('signals-list');
    if (!container) return;
    const signals = this.game.signalManager.getAll();
    if (signals.length === 0) {
      container.innerHTML = '<span style="color:var(--text3);font-size:11px">Aucun signal personnel.</span>';
      return;
    }
    container.innerHTML = signals.map(s => {
      const stA = this.game.world.getStationById(s.stationA)?.name || s.stationA;
      const stB = this.game.world.getStationById(s.stationB)?.name || s.stationB;
      const color = s.type === 'arret' ? '#ef4444' : s.type === 'avertissement' ? '#f59e0b' : '#38bdf8';
      const limit = s.type === 'arret' ? 'Arret' : `${s.speedLimit} km/h`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span><b style="color:${color}">${s.name}</b> — ${stA} ↔ ${stB} (${s.type}, ${limit})</span>
        <button class="btn-sm danger" onclick="game.ui.deletePlayerSignal('${s.id}')">Supprimer</button>
      </div>`;
    }).join('');
  }

  // --- SILLONS (Section V) ---
  openSillonCreator() {
    const creator = document.getElementById('sillon-creator');
    if (!creator) return;
    const fromSel = document.getElementById('sillon-from');
    const toSel = document.getElementById('sillon-to');
    const opts = this.game.world.stations.map(st => `<option value="${st.id}">${st.name}</option>`).join('');
    if (fromSel) fromSel.innerHTML = '<option value="">—</option>' + opts;
    if (toSel) toSel.innerHTML = '<option value="">—</option>' + opts;
    document.getElementById('sillon-name').value = 'V1';
    creator.classList.remove('hidden');
  }

  async saveSillon() {
    const name = document.getElementById('sillon-name')?.value.trim();
    const fromId = document.getElementById('sillon-from')?.value;
    const toId = document.getElementById('sillon-to')?.value;
    if (!name) return alert('Nom requis');
    if (!fromId || !toId) return alert('Sélectionnez les gares A et B');
    if (fromId === toId) return alert('Les gares doivent être différentes');

    const stA = this.game.world.getStationById(fromId);
    const stB = this.game.world.getStationById(toId);
    if (!stA || !stB) return alert('Gares invalides');

    const loadingEl = document.getElementById('sillon-creator-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');

    let route = null;
    try {
      route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
    } catch (e) {
      console.warn('ORM route failed for sillon', e);
    }

    if (loadingEl) loadingEl.classList.add('hidden');

    if (!route || route.length < 2) {
      return alert('Impossible de calculer un itineraire ferroviaire entre ces gares. Verifiez le reseau ORM ou utilisez des gares proches.');
    }

    const distance = this.game.orm.getRouteDistance(route);
    const speeds = route.filter(r => r.maxSpeed).map(r => r.maxSpeed);
    const maxSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160;

    this.game.sillonManager.add({
      name,
      fromStationId: fromId,
      toStationId: toId,
      fromStationName: stA.name,
      toStationName: stB.name,
      route: this.game.orm.getRouteSegments(route).map(s => ({ lat: s.from.lat, lon: s.from.lon, maxSpeed: s.maxSpeed })).concat([{ lat: route[route.length - 1].lat, lon: route[route.length - 1].lon, maxSpeed: route[route.length - 1].maxSpeed || 160 }]),
      distance,
      maxSpeed,
      electrified: route.some(r => r.electrified === false) ? false : true,
    });

    document.getElementById('sillon-creator')?.classList.add('hidden');
    this.renderLinesList();
    this.game.saveState();
  }

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
  }

  deleteSillon(id) {
    if (!confirm('Supprimer ce sillon ?')) return;
    this.game.sillonManager.remove(id);
    this.renderLinesList();
    this.game.saveState();
  }

  // --- DEPOTS / ITE ---
  setupDepotPage() {
    document.getElementById('btn-add-depot')?.addEventListener('click', () => this.openDepotModal());
    document.getElementById('btn-save-depot')?.addEventListener('click', () => this.saveDepot());
    document.getElementById('btn-add-ite-track')?.addEventListener('click', () => this.addITETrack());
    document.getElementById('depot-type')?.addEventListener('change', () => this._toggleITEEditor());
  }

  openDepotModal() {
    this._pendingDepotITETarget = null; // stored ITE target if created from map
    this._pendingITETracks = [];
    document.getElementById('modal-depot')?.classList.remove('hidden');
    document.getElementById('depot-name').value = '';
    const typeSel = document.getElementById('depot-type');
    if (typeSel) typeSel.value = 'depot';
    const select = document.getElementById('depot-station');
    if (select) select.innerHTML = '<option value="">—</option>' + this.game.world.stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    this._toggleITEEditor();
    this._renderITETrackList();
  }

  _toggleITEEditor() {
    const type = document.getElementById('depot-type')?.value || 'depot';
    const editor = document.getElementById('depot-ite-editor');
    if (editor) editor.classList.toggle('hidden', !type.startsWith('ite'));
  }

  _renderITETrackList() {
    const list = document.getElementById('depot-ite-tracks-list');
    if (!list) return;
    list.innerHTML = (this._pendingITETracks || []).map((t, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px">
        <span><b>${t.name}</b> — ${t.length} m${t.cargoType ? ' (' + t.cargoType + ')' : ''}</span>
        <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui.removeITETrack(${i})">x</button>
      </div>
    `).join('') || '<span style="color:var(--text3);font-size:10px">Aucune voie saisie</span>';
  }

  removeITETrack(index) {
    if (!this._pendingITETracks) return;
    this._pendingITETracks.splice(index, 1);
    this._renderITETrackList();
  }

  addITETrack() {
    const name = document.getElementById('depot-ite-track-name')?.value.trim();
    const length = parseInt(document.getElementById('depot-ite-track-length')?.value) || 0;
    const cargoType = document.getElementById('depot-ite-track-cargo')?.value || '';
    if (!name || length <= 0) return alert('Nom et longueur requis');
    if (!this._pendingITETracks) this._pendingITETracks = [];
    this._pendingITETracks.push({ name, length, cargoType });
    this._renderITETrackList();
    document.getElementById('depot-ite-track-name').value = '';
    document.getElementById('depot-ite-track-length').value = '300';
  }

  saveDepot() {
    const type = document.getElementById('depot-type')?.value || 'depot';
    const stationId = document.getElementById('depot-station')?.value;
    if (!stationId) return alert('Sélectionnez une gare');
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
  }

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
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;margin-bottom:4px">Rames affectées (${ramesHere.length})</div>${ramesHere.map(r => `<div style="font-size:10px;padding:2px 0">${r.name}</div>`).join('')}</div>`
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
  }

  addRescueLoco(depotId) {
    const select = document.getElementById(`rescue-stock-${depotId}`);
    if (!select || !select.value) return;
    const stock = this.game.rollingStock.getAll().find(s => s.id === select.value);
    if (!stock) return;
    const displayName = stock.seriesName ? `${stock.seriesName} ${stock.numberStart || ''}`.trim() : stock.name;
    const ok = this.game.depotManager.addRescueLoco(depotId, stock.id, displayName, stock.traction);
    if (!ok) return alert('Maximum 2 machines de secours par dépôt.');
    this.game.saveState();
    this.renderDepotsList();
  }

  removeRescueLoco(depotId, stockId) {
    this.game.depotManager.removeRescueLoco(depotId, stockId);
    this.game.saveState();
    this.renderDepotsList();
  }

  buySparePart(depotId, type, qty) {
    const depot = this.game.depotManager.getDepotById(depotId);
    if (!depot) return;
    const prices = { moteur: 5000, freins: 3000, climatisation: 2000, portes: 1500, fanaux: 1000 };
    const cost = (prices[type] || 1000) * qty;
    if (this.game.economy.balance < cost) return alert('Fonds insuffisants.');
    if (depot.addSpareParts(type, qty)) {
      this.game.economy.addExpense(cost, 'maintenance', `Achat pièce détachée : ${type} x${qty}`);
      this.game.saveState();
      this.renderDepotsList();
    }
  }

  // MNT-05 : achat groupé de pièces détachées pour tous les dépôts
  buyBulkSparePart() {
    const typeSelect = document.getElementById('bulk-spare-type');
    const qtyInput = document.getElementById('bulk-spare-qty');
    if (!typeSelect || !qtyInput) return;
    const type = typeSelect.value;
    const qty = parseInt(qtyInput.value) || 1;
    const res = this.game.depotManager.buyBulkSpareParts(type, qty, this.game.economy);
    if (!res.ok) return alert(`Fonds insuffisants. Coût total : ${res.totalCost.toLocaleString('fr-FR')} €`);
    this.game.saveState();
    this.renderDepotsList();
  }

  deleteDepot(id) {
    if (!confirm('Supprimer ce d\u00e9p\u00f4t ?')) return;
    this.game.depotManager.remove(id);
    this.game.saveState();
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
    document.getElementById('btn-add-works')?.addEventListener('click', () => this.openWorksModal());
    document.getElementById('works-impact')?.addEventListener('change', (e) => {
      document.getElementById('works-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
    });
    document.getElementById('works-recurrence')?.addEventListener('change', (e) => {
      document.getElementById('works-days-group').style.display = e.target.value === 'weekly' ? 'block' : 'none';
    });
    document.getElementById('btn-save-works')?.addEventListener('click', () => this.saveWorks());

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
  }

  // Kept for backward compatibility / admin use; not exposed in normal UI.

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

    const select = document.getElementById('works-track');
    select.innerHTML = this.game.world.tracks.map(t => `<option value="${t.id}">${t.name || t.id}</option>`).join('');
  }

  saveWorks() {
    const recurrence = document.getElementById('works-recurrence')?.value || 'daily';
    const daysOfWeek = recurrence === 'weekly'
      ? [...document.querySelectorAll('.works-day:checked')].map(cb => parseInt(cb.value))
      : [0,1,2,3,4,5,6];
    this.game.worksManager.add({
      name: document.getElementById('works-name').value.trim() || 'Travaux',
      trackId: document.getElementById('works-track').value,
      startDate: document.getElementById('works-start-date').value,
      startTime: document.getElementById('works-start-time').value || '22:00',
      endDate: document.getElementById('works-end-date').value,
      endTime: document.getElementById('works-end-time').value || '05:00',
      impact: document.getElementById('works-impact').value,
      speedLimit: parseInt(document.getElementById('works-speed-limit').value) || 40,
      recurrence,
      daysOfWeek,
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
            const track = this.game.world.tracks.find(t => t.id === w.trackId);
            return `
              <div class="works-item">
                <span class="works-name">${w.name}</span> - ${track ? track.name : w.trackId}<br>
                ${w.getDateRange()}<br>
                <span style="font-size:10px;color:var(--text3)">${w.recurrence === 'once' ? 'Le ' + w.startDate : w.recurrence === 'weekly' ? 'Hebdo : ' + w.daysOfWeek.join(',') : 'Chaque jour'} de ${w.startTime} a ${w.endTime}</span><br>
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

    // Show only active trains (moving or stopped at station) + rescue services + breakdowns.
    // DEP-06 : trains en maintenance absents du bandeau train.
    // At massive scale we cap the list to keep the DOM small.
    const MAX_TRAINS_LIST = 100;
    const activeTrains = [];
    let overflow = false;
    for (const svc of services) {
      if (!svc || !svc.train || svc.train.inMaintenance || (svc.rame && svc.rame.inMaintenance)) continue;
      const t = svc.train;
      if (
        svc.isRescue ||
        svc.state === 'moving' || svc.state === 'stopped_at_station' ||
        // LVM-04/Annexe 4 : trains en attente à quai (pré-départ) et trains visibles sur la carte
        (svc.state === 'waiting' && svc.position && t.stoppedAt) ||
        t.speed > 0 ||
        t.breakdown
      ) {
        activeTrains.push(svc);
        if (activeTrains.length >= MAX_TRAINS_LIST) {
          overflow = true;
          break;
        }
      }
    }

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
      let nextDistKm = null;
      const _nsCtx = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
      const _isWaypoint = _nsCtx?.type === 'waypoint';
      if ((svc.state === 'stopped_at_station' || (svc.state === 'waiting' && t.stoppedAt)) && !_isWaypoint) {
        const stName = t.stoppedAt?.name || '';
        const voie = t.platform ? ` Voie ${t.platform}` : '';
        if (svc._atTerminus) {
          contextLabel = stName ? `Terminus — ${stName}${voie}` : 'Terminus';
          contextClass = 'ctx-quai';
        } else if (svc.state === 'waiting') {
          const waitMin = this.game?.engine ? Math.max(0, Math.round(((svc.stops?.[0]?.departureTime ?? 0) - (this.game.engine.getParisTime().hours * 60 + this.game.engine.getParisTime().minutes)))) : 0;
          contextLabel = stName ? `En attente — ${stName}${voie} (${waitMin} min)` : 'En attente';
          contextClass = 'ctx-quai';
        } else {
          contextLabel = stName ? `À quai — ${stName}${voie}` : 'À quai';
          contextClass = 'ctx-quai';
        }
      } else if (t.signalAlert === 'closed') {
        contextLabel = 'Arrêt pour signal fermé';
        contextClass = 'ctx-signal-closed';
      } else if (t.blockedBy || t.signalAlert === 'caution') {
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
          } else {
            // Annex 5 / phone note : contexte "se situe entre A et B".
            const currentStops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : [];
            const curIdx = svc.currentStopIndex || 0;
            const prevIdx = curIdx > 0 ? curIdx - 1 : 0;
            const nextIdx = curIdx > 0 ? curIdx : Math.min(1, currentStops.length - 1);
            const prevS = currentStops[prevIdx];
            const nextS = currentStops[nextIdx];
            const prevName = prevS?.stationName || this.game.world?.getStationById(prevS?.stationId)?.name || '';
            const nextName = nextS?.stationName || this.game.world?.getStationById(nextS?.stationId)?.name || '';
            if (prevName && nextName && prevName !== nextName) {
              contextLabel = `Se situe entre ${prevName} et ${nextName}`;
              contextClass = 'ctx-between';
              nextDistKm = distKm;
            } else if (nextName) {
              contextLabel = `Au départ de ${nextName}`;
              contextClass = 'ctx-between';
              nextDistKm = distKm;
            }
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

      // Next stop info — Annex 4: "Prochain arrêt : X - Arrivée prévue à XhX"
      const nextStop = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
      const targetStation = typeof svc.getTargetStation === 'function' ? svc.getTargetStation() : null;
      let nextInfo;
      if (svc._atTerminus && svc._nextDepartureTime != null) {
        const pt = this.game?.engine?.getParisTime?.();
        const currentMin = pt ? pt.hours * 60 + pt.minutes : 0;
        const waitMin = Math.max(0, Math.round(svc._nextDepartureTime - currentMin));
        nextInfo = `Terminus — départ dans ${waitMin} min`;
      } else if (svc.cancelled) {
        nextInfo = 'Service supprimé';
      } else if (svc.completed) {
        nextInfo = 'Service terminé';
      } else if (nextStop && targetStation) {
        const fmtTime = (m) => this.minToTimeStr(((Math.round(m) % 1440) + 1440) % 1440);
        const voie = (nextStop.platform && nextStop.stationId) ? ` Voie ${nextStop.platform}` : '';
        const plannedArr = nextStop.arrivalTime ?? 0;
        const actualArr = plannedArr + delayVal;
        const plannedStr = fmtTime(plannedArr);
        const actualStr = fmtTime(actualArr);
        const distStr = nextDistKm != null ? ` — ${Math.round(nextDistKm)} km` : '';
        const arrStr = delayVal !== 0
          ? `<span style="text-decoration:line-through;color:#888">${plannedStr}</span> <span style="color:#facc15;font-weight:600">${actualStr}</span>`
          : actualStr;
        nextInfo = `Prochain arrêt : ${targetStation.name}${voie} — Arrivée prévue à ${arrStr}${distStr}`;
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

      // S2: Train images (scrollable zone) — absent pour les trains de travaux.
      let imageHtml = '';
      if (!svc.isWorkTrain && svc.serviceType !== 'work' && svc.rame && svc.rame.elementDetails) {
        const imgs = svc.rame.elementDetails
          .filter(e => e.imageData)
          .map(e => `<img src="${e.imageData}" class="tc-train-img">`)
          .join('');
        if (imgs) {
          imageHtml = `<div class="tc-images-scroll">${imgs}</div>`;
        }
      }

      // Annexes 4-5 — charge transportée dans le bandeau train (utilise les comptages réels).
      let payloadHtml = '';
      if (svc.rame && svc.serviceType !== 'work') {
        const rame = svc.rame;
        if (svc.category === 'fret' || rame.totalFreightCapacity > 0) {
          const load = Math.max(0, svc._onboardFreight != null ? Math.round(svc._onboardFreight) : Math.round(rame.totalFreightCapacity * 0.7));
          payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${load} tonnes de frets transportées</span></div>`;
        } else if (svc.category === 'voyageur' || rame.totalCapacity > 0) {
          const pax = Math.max(0, svc._onboardPax != null ? Math.round(svc._onboardPax) : Math.round(rame.totalCapacity * 0.7));
          payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${pax} passagers à bord</span></div>`;
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

      const cat = svc.category || t.category || 'voyageur';
      const catColor = LVM_CAT_COLORS[cat] || t.color;
      const iconSrc = LVM_CAT_ICONS[cat] || LVM_CAT_ICONS.generic;
      const selCls = this.selectedService?.id === svc.id ? ' tc-selected' : '';
      return `
        <div class="train-card-fixed${selCls}" style="cursor:pointer" onclick="game.ui.selectServiceById('${svc.id}')">
          <div class="tc-line tc-header">
            <img src="${iconSrc}" class="tc-icon" alt="" style="background:${catColor}">
            <div class="tc-scroll"><span class="tc-scroll-text tc-name">${displayName}</span></div>
            ${svc.cancelled ? '<span style="background:#ef4444;color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;margin-left:auto;flex-shrink:0">Supprimé</span>' : (svc.completed ? '<span style="background:#16a34a;color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;margin-left:auto;flex-shrink:0">Terminé</span>' : '')}
          </div>
          ${imageHtml}
          ${payloadHtml}
          <div class="tc-line"><span class="tc-speed">${Math.round(t.speed)} km/h</span></div>
          <div class="tc-line"><span class="${delayClass}">${delayLabel}</span></div>
          ${contextLabel ? `<div class="tc-line tc-scroll"><span class="tc-scroll-text ${contextClass}">${contextLabel}</span></div>` : ''}
          ${circuleSurVoie ? `<div class="tc-line"><span style="color:#94a3b8;font-size:10px">${circuleSurVoie}</span></div>` : ''}
          ${platformLabel ? `<div class="tc-line"><span class="tc-voie">${platformLabel}</span></div>` : ''}
          <div class="tc-line tc-scroll"><span class="tc-scroll-text tc-next">${nextInfo}</span></div>
          ${incidentHtml}
          ${breakdownHtml}
          ${maintenanceHtml}
          ${wearHtml}
        </div>
      `;
    }).join('');
    if (overflow) {
      html += `<div style="color:var(--text3);font-size:10px;text-align:center;padding:6px">+ de nombreux autres trains actifs</div>`;
    }
    // S10: Only update DOM if content actually changed to avoid flicker
    if (container.innerHTML !== html) container.innerHTML = html;

    // LVM-06 — le train sélectionné reste visible en haut du bandeau.
    if (this.selectedService && this._lastSelectedForScroll !== this.selectedService.id) {
      this._lastSelectedForScroll = this.selectedService.id;
      const selectedCard = container.querySelector('.tc-selected');
      if (selectedCard) selectedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // LVM-06 — garde le panneau du train sélectionné à jour chaque frame.
    this._syncLivemapPanel();
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

        // Prochains arrêts avec horaires (pour écran quai)
        const nextStops = [];
        for (let j = i + 1; j < stops.length; j++) {
          if (stops[j].type === 'waypoint' || stops[j].type === 'passage') continue;
          const st = this.game.world.getStationById(stops[j].stationId);
          if (st) nextStops.push({ name: st.name, time: stops[j].arrivalTime });
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

        // Annexes 20/23 — TRAIN COMPLET / supprimé
        const isCancelled = svc.cancelled || svc.state === 'cancelled';
        const totalPax = svc.rame?.totalCapacity || 0;
        const onboardPax = svc._onboardPax || 0;
        const totalFrt = svc.rame?.totalFreightCapacity || 0;
        const onboardFrt = svc._onboardFreight || 0;
        const isFull = totalPax > 0 && onboardPax >= totalPax * 0.9;
        const isFreightFull = totalFrt > 0 && onboardFrt >= totalFrt * 0.9;

        results.push({
          svcId: svc.id,
          name: svc.name,
          trainNumber: svc.train?.number || '',
          seriesName: svc.train?.seriesName || '',
          destination: destStation?.name || '?',
          origin: origStation?.name || '?',
          depTime, arrTime, waitMin,
          isDeparture, isArrival, isFirst, isLast,
          servedStations, fromStations, nextStops,
          delay,
          isCancelled,
          isFull,
          isFreightFull,
          line,
          lineCode: line?.code || '',
          lineName: line?.name || '',
          lineColor: line?.color || '#3b82f6',
          voie: stop.platform || svc.train?.platform || String(i + 1),
          state: svc.state,
          speed: svc.speed || 0,
          rame: svc.rame,
        });
      }
    }

    // IG-07 — scroll infini sur 24h : on garde les trains dans les prochaines 24h
    const wrap = t => (t % 1440 + 1440) % 1440;

    if (mode === 'sncf-arr' || mode === 'afl-arrivee' || mode === 'cati-ar') {
      const arr = results.filter(r => r.isArrival && r.arrTime != null)
        .map(r => ({ ...r, waitMin: wrap(r.arrTime - now) }))
        .filter(r => r.waitMin <= 1440);
      arr.sort((a, b) => a.waitMin - b.waitMin);
      return arr;
    }

    const deps = results.filter(r => r.isDeparture && r.waitMin != null && r.waitMin <= 1440);
    deps.sort((a, b) => a.waitMin - b.waitMin);
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

  _fmtDelay(min) {
    if (min == null || min <= 0) return "a l'heure";
    if (min < 60) return `retard ${Math.round(min)} min.`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `retard ${h}h${m.toString().padStart(2, '0')}` : `retard ${h}h`;
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
      case 'sncf-dep': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr); break;
      case 'sncf-arr': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr); break;
      case 'afl-depart': board.innerHTML = this._renderImageMode('sncf-dep', station, trains, nowStr); break;
      case 'afl-arrivee': board.innerHTML = this._renderImageMode('sncf-arr', station, trains, nowStr); break;
      case 'cati-ar': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr); break;
      case 'old-sncf': board.innerHTML = this._renderPalette(station, trains, nowStr); break;
      case 'flash-circulation': board.innerHTML = this._renderFlashCirculation(station, nowStr); break;
      case 'cati-3-3': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr); break;
      case 'cati-complet': board.innerHTML = this._renderImageMode(displayType, station, trains, nowStr); break;
      case 'ecran-quai': board.innerHTML = this._renderEcranQuai(station, trains, nowStr); break;
    }

    // Setup train click handlers for platform display
    board.querySelectorAll('[data-svc-id]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this._showPlatformDisplay(el.dataset.svcId, stationId));
    });

    this._animateInfogareBoard(board, displayType);

    // Auto-refresh every 5 seconds (data), plus a 1s clock update
    if (this._infogareInterval) clearInterval(this._infogareInterval);
    this._infogareInterval = setInterval(() => {
      if (this.activePage !== 'infogare') { clearInterval(this._infogareInterval); this._stopInfogareClock(); return; }
      this._showInfogareBoard();
    }, 5000);
  }

  _stopInfogareClock() {
    if (this._infogareClockInterval) { clearInterval(this._infogareClockInterval); this._infogareClockInterval = null; }
  }

  _animateInfogareBoard(board, displayType) {
    const lower = displayType.toLowerCase();
    board.classList.remove('ig-board-entrance','ig-anim-pulse','ig-anim-flash','ig-anim-shake');
    void board.offsetWidth; // force reflow
    board.classList.add('ig-board-entrance');

    // staggered row entrance
    const rows = board.querySelectorAll('[data-svc-id], .ig-sncf-row, .ig-cati-row, .ig-cati-33-row, .ig-rsncf-row, .ig-ratp-row, .ig-solari-row');
    rows.forEach((el, i) => {
      el.classList.add('ig-row-entrance');
      el.style.animationDelay = `${i * 0.05}s`;
    });

    // blink / pulse statuses
    const statusEls = board.querySelectorAll('.ig-sncf-status, .ig-cati-num, .ig-quai-status, .ig-afl-delay, .ig-ratp-wait-approche, .ig-pgl-delay, .ig-pban-delay, .ig-flash-sign-info');
    statusEls.forEach(el => {
      const txt = el.textContent.toLowerCase();
      if (txt.includes('supprim') || txt.includes('annul') || txt.includes('cancel')) {
        el.classList.add('ig-status-cancel');
      } else if (txt.includes('retard') || txt.includes('retardé') || txt.includes('delayed')) {
        el.classList.add('ig-status-delay');
      } else if (txt.includes("approche") || txt.includes('approach')) {
        el.classList.add('ig-status-approach');
      }
    });

    // AFL / Flash / Quai pulse when disrupted
    const isDisrupted = board.textContent.toLowerCase().includes('retard') || board.textContent.toLowerCase().includes('supprim') || board.textContent.toLowerCase().includes('travaux');
    if (isDisrupted) {
      if (lower.includes('afl')) board.classList.add('ig-anim-pulse');
      if (lower.includes('flash')) board.querySelector('.ig-flash-sign-body')?.classList.add('ig-anim-pulse');
      if (lower.includes('quai')) board.querySelector('.ig-quai-status')?.classList.add('ig-anim-pulse');
    }

    // start live clock
    this._stopInfogareClock();
    this._updateInfogareClocks(board);
    this._infogareClockInterval = setInterval(() => {
      if (this.activePage !== 'infogare') { this._stopInfogareClock(); return; }
      const b = document.getElementById('infogare-board');
      if (b) this._updateInfogareClocks(b);
    }, 1000);
  }

  _updateInfogareClocks(board) {
    const pt = this.game.engine.getParisTime();
    const nowStr = `${pt.hours.toString().padStart(2,'0')}:${pt.minutes.toString().padStart(2,'0')}`;
    const nowStrDot = nowStr.replace(':', '.');
    const nowStrSpace = nowStr.replace(':', ' ');

    // any element whose class contains "clock" inside the board, plus palette digital
    board.querySelectorAll('[class*="clock"], .ig-palette-time-digital').forEach(el => {
      const txt = el.textContent;
      if (txt.includes(':')) el.textContent = nowStr;
      else if (txt.includes('.')) el.textContent = nowStrDot;
      else if (txt.includes('h')) { /* keep h format in palette? palette uses digital */ }
      else el.textContent = nowStr;
    });

    // palette analog clock
    const hourHand = board.querySelector('.ig-palette-clock-hand');
    const minHand = board.querySelector('.ig-palette-clock-hand-min');
    if (hourHand && minHand) {
      const totalMin = pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60;
      hourHand.style.transform = `rotate(${(totalMin / 2) % 360}deg)`;
      minHand.style.transform = `rotate(${(totalMin * 6) % 360}deg)`;
    }

    // footer clocks (second span inside cati/afl/sncf footers)
    board.querySelectorAll('.ig-cati-footer, .ig-afl-footer, .ig-sncf-footer').forEach(foot => {
      const last = foot.lastElementChild;
      if (last && last.textContent.match(/\d{1,2}[:.h ]\d{2}/)) {
        if (last.textContent.includes('.')) last.textContent = nowStrDot;
        else last.textContent = nowStr;
      }
    });
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
      const m = (t.trainNumber || t.name).match(/^([A-Za-z]+)(.*)$/);
      const type = m ? m[1] : (t.seriesName || 'TER');
      const num = m ? m[2].trim() : (t.trainNumber || t.name);
      let statusStr = '', remark = '';
      if (t.isCancelled) {
        statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
        remark = 'La clientèle est invitée à emprunter le train suivant.';
      } else if (t.isFull || t.isFreightFull) {
        statusStr = `<span class="ig-sncf-full">TRAIN COMPLET</span>`;
      } else if (t.delay > 0) {
        statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
        remark = t.delayReason || 'Incident en cours d’identification';
      } else {
        statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
      }
      const stops = t.servedStations.slice(0, 6).join(' \u2022 ');
      rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-time">${this._fmtTime(t.depTime)}</span>
          <span class="ig-sncf-trainid">
            <span class="ig-sncf-type">${type || t.seriesName || 'TER'}</span>
            <span class="ig-sncf-trainnum">${num || t.trainNumber || t.name}</span>
          </span>
          <span class="ig-sncf-destcol">
            <span class="ig-sncf-dest">${t.destination}</span>
            ${stops ? `<span class="ig-sncf-stops">${stops}</span>` : ''}
          </span>
          <span class="ig-sncf-status">${statusStr}</span>
        </div>
        ${remark ? `<div class="ig-sncf-remark">${remark}</div>` : ''}
      </div>`;
    }

    return `<div class="ig-sncf-board ig-sncf-dep">
      <div class="ig-sncf-topbar">
        <div class="ig-sncf-topclock">${nowStr}</div>
        <div class="ig-sncf-topstation">${station?.name || ''}</div>
        <div class="ig-sncf-topsncf">SNCF</div>
      </div>
      <div class="ig-sncf-header ig-sncf-header-dep">
        <span></span>
        <span>N°</span>
        <span>DESTINATION</span>
        <span></span>
      </div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
    </div>`;
  }

  // --- SNCF ARRIVEES (green) --- exact replica
  _renderSncfArr(station, trains, nowStr) {
    let rows = '';
    for (const t of trains) {
      const m = (t.trainNumber || t.name).match(/^([A-Za-z]+)(.*)$/);
      const type = m ? m[1] : (t.seriesName || 'TER');
      const num = m ? m[2].trim() : (t.trainNumber || t.name);
      let statusStr = '', remark = '';
      if (t.isCancelled) {
        statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
      } else if (t.delay > 0) {
        statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
        remark = t.delayReason || 'Conditions climatiques exceptionnelles';
      } else {
        statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
      }
      rows += `<div class="ig-sncf-row" data-svc-id="${t.svcId}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-time">${this._fmtTime(t.arrTime)}</span>
          <span class="ig-sncf-trainid">
            <span class="ig-sncf-type">${type || t.seriesName || 'TER'}</span>
            <span class="ig-sncf-trainnum">${num || t.trainNumber || t.name}</span>
          </span>
          <span class="ig-sncf-destcol">
            <span class="ig-sncf-dest">${t.origin}</span>
          </span>
          <span class="ig-sncf-status">${statusStr}</span>
          <span class="ig-sncf-voie">${t.voie || ''}</span>
        </div>
        ${remark ? `<div class="ig-sncf-remark">${remark}</div>` : ''}
      </div>`;
    }

    return `<div class="ig-sncf-board ig-sncf-arr">
      <div class="ig-sncf-topbar">
        <div class="ig-sncf-topclock">${nowStr}</div>
        <div class="ig-sncf-topstation">${station?.name || ''}</div>
        <div class="ig-sncf-topsncf">SNCF</div>
      </div>
      <div class="ig-sncf-header ig-sncf-header-arr">
        <span></span>
        <span>N°</span>
        <span>PROVENANCE</span>
        <span></span>
        <span>VOIE</span>
      </div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
    </div>`;
  }

  // --- OLD SNCF (Solari split-flap) --- exact Gare du Nord style
  _renderOldSncf(station, trains, nowStr) {
    let rows = '';
    for (const t of trains) {
      const servedTxt = t.servedStations.join('  ').toUpperCase();
      const destFull = `${t.destination.toUpperCase()}${servedTxt ? '  ' + servedTxt : ''}`;
      let remarks = (t.seriesName || '').toUpperCase();
      if (t.isCancelled) remarks = 'SUPP';
      else if (t.isFull || t.isFreightFull) remarks = 'PLEIN';
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

  // --- Flash Circulation : panneau bleu/jaune d'info trafic réseau (image annexe INFOGARE) ---
  _renderFlashCirculation(station, nowStr) {
    const im = this.game.incidentManager;
    const bulletins = im?.getBulletins?.() || [];
    const services = this.game.scheduleCreator?.services || [];
    const delayed = services.filter(s => s.active && s.delay >= 15).slice(0, 6);
    const pt = this.game.engine?.getParisTime?.();
    const timeOfDay = pt ? (pt.hours * 60 + pt.minutes) : 0;
    const dateStr = this.game.engine?.currentDate || this.game.engine?.getParisDate?.() || '';
    const works = this.game.worksManager?.getActive?.(dateStr, timeOfDay) || [];

    const items = [];
    for (const b of bulletins) items.push(`${b.name} : ${b.description || 'perturbation en cours'}`);
    for (const d of delayed) items.push(`${d.name} — retard ${Math.round(d.delay)} min`);
    for (const w of works) items.push(`Travaux en cours : ${w.name || w.type || 'chantier'}`);
    const mainText = items.length ? items.join(' / ') : 'Trafic fluide sur le réseau.';
    const ticker = items.length ? `${items.join('   +++   ')}   +++   ` : 'Circulation normale.';

    const W = 250, H = 140, scale = 3;
    const img = 'img/infogare/FLASH-CIRCULATION.png';
    let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
    html += `<div class="ig-image-block" style="top:0;left:22%;width:78%;height:100%;background:#fec152;"></div>`;
    html += this._igField({x:28,y:11,w:66,h:55}, mainText, {color:'#000080',fontSize:6*scale,weight:700,style:'white-space:normal;overflow-wrap:break-word;line-height:1.2;'}, 0);
    html += this._igField({x:28,y:72,w:67,h:10}, 'INFORMATIONS A SUIVRE', {color:'#000080',fontSize:6*scale,weight:700,align:'center'}, 0);
    html += this._igField({x:4,y:86,w:69,h:8}, ticker, {color:'#fff',fontSize:5*scale,bg:'#0b4f9b',style:'white-space:nowrap;'}, 0);
    const clock = nowStr.replace(':', ' ');
    html += this._igField({x:73,y:90,w:23,h:7}, clock, {color:'#fff',fontSize:6*scale,bg:'#0b4f9b',align:'center',weight:700}, 0);
    html += `</div>`;
    return html;
  }

  // --- CATI 3-3 : 2 groupes de 3 lignes (tableau compact) ---
  _renderCATI3_3(station, trains, nowStr) {
    const dep = trains.filter(r => r.isDeparture).slice(0, 6);
    const mid = Math.ceil(dep.length / 2);
    const left = dep.slice(0, mid);
    const right = dep.slice(mid);
    const cell = t => {
      const stops = t.servedStations.slice(0, 2).join(' ');
      return `<div class="ig-cati-33-row" data-svc-id="${t.svcId}">
        <span class="ig-cati-33-stops">${stops}</span>
        <span class="ig-cati-33-time">${this._fmtTime(t.depTime)}</span>
        <span class="ig-cati-33-dest">${t.destination}</span>
      </div>`;
    };
    const col = items => items.length ? items.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>';
    const first = dep[0];
    const topInfo = first ? `${this._fmtTime(first.depTime)} ${first.destination}` : 'Aucun train';
    return `<div class="ig-cati-board ig-cati-3-3">
      <div class="ig-cati-header">
        <span class="ig-cati-station">${station?.name || ''}</span>
        <span class="ig-cati-title">${topInfo}</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-33-cols">
        <div class="ig-cati-33-col">${col(left)}</div>
        <div class="ig-cati-33-col">${col(right)}</div>
      </div>
      <div class="ig-cati-footer"><span>CATI 3-3</span><span>${nowStr}</span></div>
      <div class="ig-cati-side">départs</div>
    </div>`;
  }

  // --- AFL Départ : annonce lumineuse du prochain départ ---
  _renderAFLDepart(station, trains, nowStr) {
    const t = trains.find(r => r.isDeparture) || trains[0];
    if (!t) return `<div class="ig-afl-board"><div class="ig-afl-station">${station?.name || ''}</div><div class="ig-afl-msg">Aucun départ prévu</div></div>`;
    const delay = `<span class="${t.delay > 0 ? 'ig-afl-delay' : 'ig-afl-ontime'}">${this._fmtDelay(t.delay).replace(/^retard /, 'Retard ')}</span>`;
    const via = t.servedStations?.slice(0, 4).join(' – ') || '';
    return `<div class="ig-afl-board" data-svc-id="${t.svcId}">
      <div class="ig-afl-header">${station?.name || ''} <span class="ig-afl-clock">${nowStr}</span></div>
      <div class="ig-afl-prochain">Prochain départ</div>
      <div class="ig-afl-destination">${t.destination}</div>
      ${via ? `<div class="ig-afl-via">via ${via}</div>` : ''}
      <div class="ig-afl-line">${this._fmtTime(t.depTime)} ${delay}</div>
      <div class="ig-afl-details">Train ${t.name} — Voie ${t.voie || '—'}</div>
    </div>`;
  }

  // --- AFL Arrivée : annonce lumineuse de la prochaine arrivée ---
  _renderAFLArrivee(station, trains, nowStr) {
    const t = trains.find(r => r.isArrival) || trains[0];
    if (!t) return `<div class="ig-afl-board ig-afl-arr"><div class="ig-afl-station">${station?.name || ''}</div><div class="ig-afl-msg">Aucune arrivée prévue</div></div>`;
    const status = t.state === 'stopped_at_station' && t.isLast ? 'Arrivé' : `dans ${this._fmtWait(t.waitMin) || '—'}`;
    const from = t.fromStations?.slice(-3).join(' – ') || '';
    return `<div class="ig-afl-board ig-afl-arr" data-svc-id="${t.svcId}">
      <div class="ig-afl-header">${station?.name || ''} <span class="ig-afl-clock">${nowStr}</span></div>
      <div class="ig-afl-prochain">Prochaine arrivée</div>
      <div class="ig-afl-destination">${t.origin}</div>
      ${from ? `<div class="ig-afl-via">depuis ${from}</div>` : ''}
      <div class="ig-afl-line">${this._fmtTime(t.arrTime)} — ${status}</div>
      <div class="ig-afl-details">Train ${t.name} — Voie ${t.voie || '—'}</div>
    </div>`;
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
    const delayStr = this._fmtDelay(svc.delay);
    const numCars = svc.rame?.elementDetails?.length || 8;

    const board = document.getElementById('infogare-board');
    if (!board) return;

    if (isGrandeLigne) {
      board.innerHTML = this._renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
    } else {
      board.innerHTML = this._renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
    }

    this._animateInfogareBoard(board, 'platform');
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

  // --- CATI Complet : liste pleine largeur 4 colonnes ---
  _renderCATIComplet(station, trains, nowStr) {
    const dep = trains.filter(r => r.isDeparture).slice(0, 12);
    const head = `<div class="ig-cati-row ig-cati-head">
      <span class="ig-cati-logo-h"></span><span>Train</span><span>Heure</span><span>Destination</span>
    </div>`;
    const cell = t => `<div class="ig-cati-row" data-svc-id="${t.svcId}">
      <span class="ig-cati-logo">SNCF</span>
      <span class="ig-cati-num">${t.trainNumber || t.name.split(' ')[0] || t.name}</span>
      <span class="ig-cati-time">${this._fmtTime(t.depTime)}</span>
      <span class="ig-cati-dest">${t.destination}</span>
    </div>`;
    return `<div class="ig-cati-board ig-cati-complet">
      <div class="ig-cati-header">
        <span class="ig-cati-station">${station?.name || ''}</span>
        <span class="ig-cati-title">Départs — Affichage complet</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-full">${head}${dep.length ? dep.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>'}</div>
      <div class="ig-cati-footer"><span>24h • Toutes destinations</span><span>${nowStr}</span></div>
      <div class="ig-cati-side">départs</div>
    </div>`;
  }

  // --- CATI Arrivées : tableau vert ---
  _renderCATIAr(station, trains, nowStr) {
    const arr = trains.filter(r => r.isArrival).slice(0, 12);
    const cell = t => {
      let status = '';
      if (t.isCancelled) status = '<span style="color:#f87171;font-weight:700">Supprimé</span>';
      else if (t.delay > 0) status = `<span style="color:#facc15;font-weight:700">retard ${Math.round(t.delay)} min</span>`;
      const stops = t.fromStations.slice(0, 5).join(' \u2022 ');
      return `<div class="ig-cati-row" data-svc-id="${t.svcId}">
        <span class="ig-cati-logo">SNCF</span>
        <span class="ig-cati-num">${status || '&nbsp;'}</span>
        <span class="ig-cati-time">${this._fmtTime(t.arrTime)}</span>
        <span class="ig-cati-destcol">
          <span class="ig-cati-dest" style="color:#fff">${t.origin}</span>
          ${stops ? `<span class="ig-cati-stops" style="color:#cbd5e1;font-size:10px">${stops}</span>` : ''}
        </span>
      </div>`;
    };
    const head = `<div class="ig-cati-row ig-cati-head" style="background:#1a5e1a">
      <span class="ig-cati-logo-h"></span><span>Retard</span><span>Heure</span><span>Provenance</span>
    </div>`;
    return `<div class="ig-cati-board ig-cati-ar" style="background:#0b2e12">
      <div class="ig-cati-header" style="background:#1a5e1a">
        <span class="ig-cati-station">${station?.name || ''}</span>
        <span class="ig-cati-title">Arrivées — Affichage complet</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-full">${head}${arr.length ? arr.map(cell).join('') : '<div class="ig-cati-empty">Aucune arrivée</div>'}</div>
      <div class="ig-cati-footer" style="background:#1a5e1a"><span>24h • Toutes provenances</span><span>${nowStr}</span></div>
      <div class="ig-cati-side" style="background:#0b2e12">arrivées</div>
    </div>`;
  }

  // --- Écran quai : prochain départ sur la voie (image annexe INFOGARE) ---
  _renderEcranQuai(station, trains, nowStr) {
    const t = trains.find(r => r.isDeparture);
    if (!t) return `<div class="ig-image-board" style="background:#0b4f9b;width:1100px;max-width:1100px;aspect-ratio:1100/616;align-items:center;justify-content:center;color:#fff;display:flex;font-size:24px;">Aucun départ prévu</div>`;
    const msg = t.isCancelled ? 'SUPPRIMÉ' : (t.delay > 0 ? `RETARD ${this._fmtDelay(t.delay)}` : "à l'heure");
    const trainNum = t.trainNumber || t.name;
    const W = 1100, H = 616, scale = 1;
    const img = 'img/infogare/ECRAN-QUAI.png';
    const pt = this.game.engine?.getParisTime?.();
    const clockStr = pt ? `${String(pt.hours).padStart(2,'0')} ${String(pt.minutes).padStart(2,'0')} ${String(pt.seconds).padStart(2,'0')}` : nowStr.replace(':', ' ');
    let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
    // masques pour cacher le texte de l'image d'origine
    html += `<div class="ig-image-block" style="top:8%;left:0;width:38%;height:82%;background:#f5eef4;"></div>`;
    html += `<div class="ig-image-block" style="top:0;left:38%;width:62%;height:90%;background:#0b4f9b;"></div>`;
    html += `<div class="ig-image-block" style="top:90%;left:0;width:100%;height:10%;background:#0b4f9b;"></div>`;
    html += this._igField({x:5,y:9,w:15,h:10}, this._fmtTime(t.depTime), {color:'#000',fontSize:20*scale,weight:700}, 0);
    html += this._igField({x:22,y:12,w:15,h:6}, msg, {color:'#16a34a',fontSize:12*scale,weight:700}, 0);
    html += this._igField({x:5,y:21,w:35,h:10}, t.destination, {color:'#000',fontSize:18*scale,weight:700,textTransform:'uppercase'}, 0);
    html += this._igField({x:5,y:32,w:30,h:6}, `${t.name.split(' ')[0] || t.name} ${trainNum}`, {color:'#000',fontSize:13*scale,weight:700}, 0);
    const nextStops = (t.nextStops || []).slice(0, 15);
    const rowH = 5.2;
    const startY = 10;
    for (let i = 0; i < nextStops.length; i++) {
      const s = nextStops[i];
      const y = startY + i * rowH;
      const txt = `<span style="color:#facc15">•</span> <span style="color:#fff">${this._fmtTime(s.time)} ${s.name}</span>`;
      html += this._igField({x:42,y,w:55,h:rowH - 0.2}, txt, {color:'#fff',fontSize:13*scale,weight:600}, 0);
    }
    const ticker = `ON. LES VOYAGEURS A DESTINATION DE ${t.destination}`;
    html += this._igField({x:5,y:92,w:70,h:5}, ticker, {color:'#fff',fontSize:12*scale,weight:700,style:'white-space:nowrap;'}, 0);
    html += this._igField({x:82,y:92,w:12,h:5}, clockStr, {color:'#fff',fontSize:12*scale,align:'center',weight:700}, 0);
    html += `</div>`;
    return html;
  }

  // --- Palette SNCF moderne (image annexe INFOGARE : 2 colonnes, horloge, défilant) ---
  _renderPalette(station, trains, nowStr) {
    const all = trains.filter(r => r.isDeparture).slice(0, 32);
    const left = all.filter((_, i) => i % 2 === 0).slice(0, 11);
    const right = all.filter((_, i) => i % 2 === 1).slice(0, 11);
    const W = 1100, H = 207, scale = 1;
    const img = 'img/infogare/PALETTE.png';
    const bg = '#1a1a1a';
    const pt = this.game.engine?.getParisTime?.();
    const clockStr = pt ? `${String(pt.hours).padStart(2,'0')} ${String(pt.minutes).padStart(2,'0')}` : nowStr.replace(':', ' ');

    // incidents / ticker
    const im = this.game.incidentManager;
    const bulletins = im?.getBulletins?.() || [];
    const tickerText = bulletins.length ? bulletins[0].name.toUpperCase() : 'CIRCULATION NORMALE';

    let html = `<div class="ig-image-board" style="background-image:url('${img}');width:${W * scale}px;max-width:${W * scale}px;aspect-ratio:${W}/${H};">`;
    html += `<div class="ig-image-block" style="top:0%;height:11%;background:${bg};"></div>`;
    html += this._igField({x:1,y:2,w:85,h:6}, 'Trains au départ  •  Train departures  •  Abfahrende Züge', {color:'#facc15',fontSize:12*scale,bg:'#1a1a1a',weight:700}, 0);

    const rowH = 7.6;
    const startY = 11;
    const col = (t, base, rowY) => {
      if (!t) return '';
      const type = (t.name.split(' ')[0] || t.name).toUpperCase();
      const num = (t.trainNumber || '').toUpperCase();
      const time = this._fmtTime(t.depTime).replace('h', ':');
      const dest = (t.destination || '').toUpperCase();
      let part = (t.seriesName || 'TER').toUpperCase();
      if (t.isCancelled) part = 'SUPP';
      else if (t.isFull || t.isFreightFull) part = 'PLEIN';
      const status = t.delay > 0 ? `RET ${t.delay}M` : (t.isCancelled ? 'SUPP' : "OK");
      let s = '';
      s += this._igField({x:base + 2, y:rowY + 0.5, w:6, h:4.5}, type, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 8, y:rowY + 0.5, w:8, h:4.5}, num, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 16, y:rowY + 0.5, w:8, h:4.5}, time, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 24, y:rowY + 0.5, w:15, h:4.5}, dest, {color:'#fff', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 39, y:rowY + 0.5, w:7, h:4.5}, part, {color:'#facc15', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 46, y:rowY + 0.5, w:7, h:4.5}, status, {color:'#4ade80', fontSize:9*scale, weight:700, bg:bg}, 0);
      s += this._igField({x:base + 53, y:rowY + 0.5, w:4, h:4.5}, t.voie || '', {color:'#000', fontSize:9*scale, weight:900, align:'center', bg:'#facc15'}, 0);
      return s;
    };

    for (let i = 0; i < 10; i++) {
      const rowY = startY + i * rowH;
      html += `<div class="ig-image-block" style="top:${rowY}%;height:${rowH}%;background:${bg};"></div>`;
      html += col(left[i], 0, rowY);
      html += col(right[i], 50, rowY);
    }

    // horloge numérique sur cadran + défilant
    html += this._igField({x:86,y:87,w:8,h:8}, clockStr, {color:'#facc15',fontSize:10*scale,bg:bg,align:'center',weight:700}, 0);
    html += this._igField({x:89,y:85,w:9,h:14}, tickerText, {color:'#000',fontSize:8*scale,bg:'#f97316',weight:700,style:'white-space:normal;overflow-wrap:break-word;line-height:1.1;'}, 0);
    html += `</div>`;
    return html;
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
  // MET-08 / NAV-04 : Saisons fusionnées dans la page Météo
  renderWeatherPage() {
    try {
      const container = document.getElementById('weather-container');
      if (!container) return;
      container.innerHTML = '<div id="weather-content"></div><div id="weather-seasonal" style="margin-top:16px"></div>';
      this.game.weather.render(document.getElementById('weather-content'));
      this.game.seasonal.render(document.getElementById('weather-seasonal'), this.game);
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
      document.getElementById('btn-create-cargo-type')?.addEventListener('click', () => this.openCargoTypeModal());
    } catch(e) { console.warn('CargoTypes render error:', e); }
  }

  openCargoTypeModal() {
    const modal = document.getElementById('modal-cargo-type');
    if (!modal) return;
    const catSel = document.getElementById('cargo-type-category');
    if (catSel) {
      catSel.innerHTML = Object.entries(this.game.cargoTypes.categories)
        .map(([key, cat]) => `<option value="${key}">${cat.name}</option>`).join('')
        + `<option value="__new__">+ Nouvelle catégorie…</option>`;
    }
    const newcatGroup = document.getElementById('cargo-type-newcat-group');
    const toggleNewcat = () => { if (newcatGroup) newcatGroup.classList.toggle('hidden', catSel.value !== '__new__'); };
    if (catSel) catSel.onchange = toggleNewcat;
    toggleNewcat();
    this._setStockField('cargo-type-newcat', '');
    this._setStockField('cargo-type-name', '');
    this._setStockField('cargo-type-unit', 't');
    this._setStockField('cargo-type-price', '0');
    const hz = document.getElementById('cargo-type-hazard'); if (hz) hz.checked = false;
    const saveBtn = document.getElementById('btn-save-cargo-type');
    if (saveBtn) saveBtn.onclick = () => this.saveCargoType();
    modal.classList.remove('hidden');
  }

  saveCargoType() {
    const catSel = document.getElementById('cargo-type-category');
    const res = this.game.cargoTypes.addCustomType({
      categoryKey: catSel?.value,
      categoryName: document.getElementById('cargo-type-newcat')?.value,
      name: document.getElementById('cargo-type-name')?.value,
      unit: document.getElementById('cargo-type-unit')?.value || 't',
      pricePerUnit: document.getElementById('cargo-type-price')?.value,
      hazard: document.getElementById('cargo-type-hazard')?.checked,
    });
    if (!res.ok) { alert(res.error || 'Erreur'); return; }
    this.game.saveState();
    document.getElementById('modal-cargo-type')?.classList.add('hidden');
    this.renderCargoTypesPage();
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

  // --- Infogare image-overlay renderer (annex images as background) ---
  _renderImageMode(displayType, station, trains, nowStr) {
    const layout = IG_IMAGE_LAYOUTS[displayType];
    if (!layout) return '';
    const isArr = ['sncf-arr', 'afl-arrivee', 'cati-ar'].includes(displayType);
    const dirField = isArr ? 'provenance' : 'dest';
    const scale = layout.scale || (layout.width < 500 ? 2 : 1);

    const fmtStyle = (f, extra = '') => {
      const parts = [
        `left:${f.x}%`, `top:${f.y}%`, `width:${f.w}%`, `height:${f.h}%`,
        `color:${f.color || '#fff'}`,
        f.bg ? `background:${f.bg}` : '',
        `font-size:${(f.fontSize || 14) * scale}px`,
        `text-align:${f.align || 'left'}`,
        `justify-content:${f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start')}`,
        f.weight ? `font-weight:${f.weight}` : '',
        f.style || '', extra
      ];
      return parts.filter(Boolean).join(';');
    };

    let html = `<div class="ig-image-board" style="background-image:url('${layout.file}');width:${layout.width * scale}px;max-width:${layout.width * scale}px;aspect-ratio:${layout.width}/${layout.height};">`;

    // header fields
    for (const f of layout.headerFields || []) {
      let txt = '';
      if (f.type === 'clock') txt = nowStr;
      else if (f.type === 'station') txt = station?.name || '';
      else if (f.type === 'static') txt = f.text || '';
      html += `<div class="ig-image-field ig-image-header-field" style="${fmtStyle(f)}">${txt}</div>`;
    }

    // train blocks
    const use = trains.slice(0, layout.blocks.length);
    for (let i = 0; i < layout.blocks.length; i++) {
      const b = layout.blocks[i];
      const t = use[i];
      html += `<div class="ig-image-block" style="top:${b.y}%;height:${b.h}%;background:${layout.bg};"></div>`;
      if (!t) continue;
      const m = (t.trainNumber || t.name).match(/^([A-Za-z]+)(.*)$/);
      const type = m ? m[1] : (t.seriesName || 'TER');
      const num = m ? m[2].trim() : (t.trainNumber || t.name);
      const viaStops = isArr ? (t.fromStations || []) : (t.servedStations || []);
      const stops = viaStops.slice(0, 8).join(' \u2022 ');
      const viaText = stops;
      let statusHtml = '', remarkTxt = '';
      if (t.isCancelled) {
        statusHtml = `<span style="color:#fff;background:#dc2626;padding:2px 6px;border-radius:3px;text-transform:uppercase;">supprimé</span>`;
        remarkTxt = 'La clientèle est invitée à emprunter le train suivant.';
      } else if (t.delay > 0) {
        statusHtml = `<span style="color:#facc15;">retardé ${Math.round(t.delay)} min</span>`;
        remarkTxt = t.delayReason || 'Incident en cours d\'identification';
      } else {
        statusHtml = `<span style="color:#4ade80;">à l'heure</span>`;
      }

      // time
      const timeStr = this._fmtTime(isArr ? t.arrTime : t.depTime);
      html += this._igField(b.time, timeStr, { color: b.time?.color || '#facc15', fontSize: (b.time?.fontSize || 18) * scale, weight: b.time?.weight || 700, align: b.time?.align }, b.y);
      // type + number (stacked)
      html += this._igField(b.type, type || t.seriesName || 'TER', { color: b.type?.color || '#fff', fontSize: (b.type?.fontSize || 13) * scale, weight: b.type?.weight || 700 }, b.y + (b.type?.yOff || 0));
      html += this._igField(b.num, num || t.trainNumber || t.name, { color: b.num?.color || '#93c5fd', fontSize: (b.num?.fontSize || 13) * scale, weight: b.num?.weight || 700 }, b.y + (b.num?.yOff || 0));
      // destination / provenance
      const destTxt = isArr ? (t.origin || '') : (t.destination || '');
      html += this._igField(b[dirField], destTxt, { color: b[dirField]?.color || '#fff', fontSize: (b[dirField]?.fontSize || 17) * scale, weight: b[dirField]?.weight || 700, textTransform: b[dirField]?.textTransform || 'uppercase' }, b.y);
      // via stops
      html += this._igField(b.via, viaText, { color: b.via?.color || '#ffffff', fontSize: (b.via?.fontSize || 11) * scale }, b.y + (b.viaY - b.y));
      // status
      html += this._igField(b.status, statusHtml, { color: b.status?.color || '#facc15', fontSize: (b.status?.fontSize || 12) * scale, weight: b.status?.weight || 700, align: b.status?.align || 'right' }, b.y);
      // voie (arrivals)
      if (b.voie) {
        const voieExtra = { color: b.voie.color || '#fff', fontSize: (b.voie.fontSize || 16) * scale, weight: b.voie.weight || 900, align: b.voie.align || 'center', bg: b.voie.bg || '#f59e0b' };
        html += this._igField(b.voie, t.voie || '', voieExtra, b.y + (b.voie?.yOff || 0));
      }
      // remark (departures)
      if (b.remark && remarkTxt) {
        html += this._igField(b.remark, remarkTxt, { color: '#facc15', fontSize: 11 * scale }, b.y + (b.remarkY - b.y));
      }
    }
    html += `</div>`;
    return html;
  }

  _igField(spec, content, extra, yOff = 0) {
    if (!spec) return '';
    const style = [
      `left:${spec.x}%`, `top:${(spec.y || 0) + yOff}%`, `width:${spec.w}%`, `height:${spec.h}%`,
      `color:${extra.color || '#fff'}`, `font-size:${extra.fontSize || 14}px`,
      `text-align:${extra.align || 'left'}`,
      `justify-content:${extra.align === 'center' ? 'center' : (extra.align === 'right' ? 'flex-end' : 'flex-start')}`,
      `text-transform:${extra.textTransform || 'none'}`,
      extra.weight ? `font-weight:${extra.weight}` : '',
      extra.bg ? `background:${extra.bg}` : '',
      extra.style || ''
    ].filter(Boolean).join(';');
    return `<div class="ig-image-field" style="${style}">${content}</div>`;
  }
}
