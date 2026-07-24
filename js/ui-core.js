import { haversineDistance } from './simulation.js?v=1784931679';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784931679';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784931679';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784931679';
import { UIMap } from './ui-map.js?v=1784931679';
import { UIEntity } from './ui-entity.js?v=1784931679';
import { UISchedule } from './ui-schedule.js?v=1784931679';
import { UIEconomy } from './ui-economy.js?v=1784931679';
import { UIInfogare } from './ui-infogare.js?v=1784931679';

export class UI {
  constructor(game) {
      this.game = game;
      this.activePage = 'map';
      this.selectedService = null;
      this._followService = null;
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
      this._infogarePage = 0; // IX — scrolling pages over 24h of trains
      this.iteCreationMode = false;
      this.industryCreationMode = false;
      this._pendingITE = null;
      this._iteMapTileMap = null;
      this._iteMapInterval = null;
      this._iteTrackPoints = [];
      this._lastTrainsListUpdate = 0;
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

  destroy() {
      if (this._approachInterval) { clearInterval(this._approachInterval); this._approachInterval = null; }
      if (this._schedMapInterval) { clearInterval(this._schedMapInterval); this._schedMapInterval = null; }
      if (this._sillonMapInterval) { clearInterval(this._sillonMapInterval); this._sillonMapInterval = null; }
      if (this._iteMapInterval) { clearInterval(this._iteMapInterval); this._iteMapInterval = null; }
      if (this._worksMapInterval) { clearInterval(this._worksMapInterval); this._worksMapInterval = null; }
      if (this._infogareInterval) { clearInterval(this._infogareInterval); this._infogareInterval = null; }
      this._stopInfogareClock();
      if (this._dashboardInterval) { clearInterval(this._dashboardInterval); this._dashboardInterval = null; }
    }

  setupAll() {
      this.setupNav();
      this.setupMapEvents();
      this.setupTabs();
      this.setupRollingStockPage();
      this.setupRamePage();
      this.setupLiveryPage();
      this.setupSchedulePage();
      this.setupLinePage();
      this.setupDepotPage();
      this.setupITEPage();
      this.setupIncidentPage();
      this.setupEconomyPage();
      this.setupModals();
      this.setupVoiePointButtons();
      this.setupMapSearch();
      this.setupLivemapPanelDrag();
      this.setupMobileNav();
    }

  refreshAll() {
      if (this.activePage === 'rolling-stock') this.renderStockList();
      else if (this.activePage === 'rames') this.renderRamesList();
      else if (this.activePage === 'liveries') this.renderLiveriesPage();
      else if (this.activePage === 'schedules') this.renderSchedulesList();
      else if (this.activePage === 'lines') this.renderLinesList();
      else if (this.activePage === 'depots') this.renderDepotsList();
      else if (this.activePage === 'incidents') this.renderIncidentsPage();
      else if (this.activePage === 'infogare') this.renderInfogarePage();
      else if (this.activePage === 'dashboard') this.renderDashboard();
      else if (this.activePage === 'graph-marche') this.renderGraphMarche();
      else if (this.activePage === 'staff') this.renderStaffPage();
      else if (this.activePage === 'weather') this.renderWeatherPage();
      else if (this.activePage === 'cargo-types') this.renderCargoTypesPage();
      else if (this.activePage === 'industrial-clients') this.renderIndustrialClientsPage();
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

  _setupPageGroups() {
      for (const tabs of PAGE_GROUPS) {
        if (tabs.length < 2) continue;
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
      // XV-XX : pages supprimées ou fusionnées — redirections.
      const DELETED_PAGES = {
        seasonal: 'weather',
        connections: 'map',
        'station-upgrades': 'map',
        junctions: 'map',
        'ite-modules': 'map',
        shunting: 'map',
        economy: 'dashboard',
        bank: 'dashboard',
      };
      if (DELETED_PAGES[page]) page = DELETED_PAGES[page];
      this.activePage = page;
      if (page !== 'dashboard' && this._dashboardInterval) {
        clearInterval(this._dashboardInterval);
        this._dashboardInterval = null;
      }
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      // NAV — un enfant fusionné garde le bouton de nav de son parent actif.
      const navKey = PAGE_PARENT[page] || page;
      document.querySelector(`.nav-btn[data-page="${navKey}"]`)?.classList.add('active');
      document.querySelectorAll('.subnav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${page}`)?.classList.add('active');

      if (page === 'rolling-stock') this.renderStockList();
      if (page === 'rames') this.renderRamesList();
      if (page === 'liveries') this.renderLiveriesPage();
      if (page === 'schedules') this.renderSchedulesList();
      if (page === 'lines') this.renderLinesList();
      if (page === 'depots') this.renderDepotsList();
      if (page === 'incidents') this.renderIncidentsPage();
      if (page === 'infogare') this.renderInfogarePage();
      if (page === 'dashboard') this.renderDashboard();
      if (page === 'graph-marche') this.renderGraphMarche();
      if (page === 'staff') this.renderStaffPage();
      if (page === 'weather') this.renderWeatherPage();
      if (page === 'cargo-types') this.renderCargoTypesPage();
      if (page === 'industrial-clients') this.renderIndustrialClientsPage();
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
        const now = Date.now();
        if (now - this._lastTrainsListUpdate > 500) {
          this._lastTrainsListUpdate = now;
          this.updateTrainsList(activeServices);
        }
        this.updateFreightTab();
      }
      if (this.activePage === 'economy') this.renderEconomyPage();
      if (this.activePage === 'incidents') this.renderIncidentsPage();

      this.updateAlertBanner();
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
        const safeJoined = escapeHtml(joined);
        if (items.length > 1) {
          el.classList.add('scrolling');
          const dur = Math.max(10, safeJoined.length * 0.3);
          el.innerHTML = `${icon}<span class="alert-text" style="animation-duration:${dur}s">${safeJoined}</span>`;
        } else {
          el.classList.remove('scrolling');
          el.innerHTML = `${icon}<span class="alert-text">${safeJoined}</span>`;
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

  setupMobileNav() {
      const toggle = document.getElementById('nav-toggle');
      const nav = document.querySelector('.nav-tabs');
      if (!toggle || !nav) return;
      toggle.addEventListener('click', () => nav.classList.toggle('open'));
      nav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-btn')) nav.classList.remove('open'); });
    }
}

Object.assign(UI.prototype, UIMap, UIEntity, UISchedule, UIEconomy, UIInfogare);
