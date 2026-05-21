/**
 * SeasonalSchedule — Summer/winter timetable system.
 * Manages timetable grids and automatic switching.
 */
export class SeasonalSchedule {
  constructor() {
    this.mode = 'normal';           // 'normal', 'summer', 'winter'
    this.autoSwitch = true;
    this.summerStart = { month: 6, day: 1 };  // June 1
    this.summerEnd = { month: 9, day: 30 };   // Sept 30
    this._lastMode = 'normal';
    this.serviceOverrides = {};     // serviceId -> { summer: {active, freq}, winter: {active, freq} }
    this.peakServices = [];         // extra services active only in summer
  }

  /**
   * Check date and switch timetable if needed. Called from daily hook.
   */
  checkSeason(dateStr) {
    if (!this.autoSwitch || !dateStr) return;

    const parts = dateStr.split('-');
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const isSummer = (month > this.summerStart.month || (month === this.summerStart.month && day >= this.summerStart.day)) &&
                     (month < this.summerEnd.month || (month === this.summerEnd.month && day <= this.summerEnd.day));

    const newMode = isSummer ? 'summer' : 'winter';
    if (newMode !== this.mode) {
      this._lastMode = this.mode;
      this.mode = newMode;
    }
  }

  /**
   * Should this service run today based on seasonal schedule?
   */
  isServiceActive(serviceId) {
    const override = this.serviceOverrides[serviceId];
    if (!override) return true; // no override = always active

    const seasonCfg = override[this.mode] || override.normal;
    if (!seasonCfg) return true;
    return seasonCfg.active !== false;
  }

  /**
   * Get frequency multiplier for a service in current season.
   */
  getFrequencyMultiplier(serviceId) {
    const override = this.serviceOverrides[serviceId];
    if (!override) return 1;

    const seasonCfg = override[this.mode] || override.normal;
    if (!seasonCfg) return 1;
    return seasonCfg.freq || 1;
  }

  /**
   * Set seasonal override for a service.
   */
  setOverride(serviceId, season, config) {
    if (!this.serviceOverrides[serviceId]) {
      this.serviceOverrides[serviceId] = {};
    }
    this.serviceOverrides[serviceId][season] = config;
  }

  /**
   * Add a peak-season-only service.
   */
  addPeakService(serviceConfig) {
    this.peakServices.push({
      id: `peak-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      ...serviceConfig,
    });
  }

  /**
   * Render seasonal schedule management.
   */
  render(container, game) {
    if (!container) return;

    const modeColor = this.mode === 'summer' ? '#f97316' : this.mode === 'winter' ? '#38bdf8' : 'var(--text)';
    const modeIcon = this.mode === 'summer' ? '☀️' : this.mode === 'winter' ? '❄️' : '🔄';
    const modeLabel = this.mode === 'summer' ? 'Grille été' : this.mode === 'winter' ? 'Grille hiver' : 'Normal';

    const services = game.scheduleCreator?.services || [];

    container.innerHTML = `
      <div class="dash-section">
        <h3>Horaires Saisonniers</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Grille active</div>
            <div class="dash-kpi-value" style="color:${modeColor}">${modeIcon} ${modeLabel}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Changement auto</div>
            <div class="dash-kpi-value" style="color:${this.autoSwitch ? 'var(--green)' : 'var(--text3)'}">
              ${this.autoSwitch ? 'Activé' : 'Désactivé'}
            </div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Période été</div>
            <div class="dash-kpi-value" style="font-size:14px">${this.summerStart.day}/${this.summerStart.month} → ${this.summerEnd.day}/${this.summerEnd.month}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Services configurés</div>
            <div class="dash-kpi-value">${Object.keys(this.serviceOverrides).length}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Changer de grille</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <button class="seasonal-switch btn-primary" data-mode="summer" style="font-size:11px;padding:8px 14px;background:#f97316">
            ☀️ Grille été
          </button>
          <button class="seasonal-switch btn-primary" data-mode="winter" style="font-size:11px;padding:8px 14px;background:#38bdf8">
            ❄️ Grille hiver
          </button>
          <button class="seasonal-switch btn-primary" data-mode="normal" style="font-size:11px;padding:8px 14px;background:#6b7280">
            🔄 Normal
          </button>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text2)">
            <input type="checkbox" id="seasonal-auto" ${this.autoSwitch ? 'checked' : ''}> Changement auto
          </label>
        </div>
      </div>

      <div class="dash-section">
        <h3>Configuration par service</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr">
            <span>Service</span><span>Normal</span><span>Été</span><span>Hiver</span>
          </div>
          ${services.length === 0 ? '<div style="padding:8px;color:var(--text3)">Aucun service créé</div>' :
            services.slice(0, 30).map(svc => {
              const ov = this.serviceOverrides[svc.id] || {};
              const sumActive = ov.summer?.active !== false;
              const winActive = ov.winter?.active !== false;
              return `<div class="dash-train-row" style="grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr">
                <span>${svc.name || svc.id}</span>
                <span style="color:var(--green)">✓</span>
                <span>
                  <button class="seasonal-toggle btn-sm" data-svc="${svc.id}" data-season="summer"
                    style="background:${sumActive ? 'var(--green)' : '#ef4444'}">${sumActive ? '✓' : '✗'}</button>
                </span>
                <span>
                  <button class="seasonal-toggle btn-sm" data-svc="${svc.id}" data-season="winter"
                    style="background:${winActive ? 'var(--green)' : '#ef4444'}">${winActive ? '✓' : '✗'}</button>
                </span>
              </div>`;
            }).join('')}
        </div>
      </div>
    `;

    // Event handlers
    container.querySelectorAll('.seasonal-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        this.render(container, game);
      });
    });

    const autoCheck = container.querySelector('#seasonal-auto');
    if (autoCheck) {
      autoCheck.addEventListener('change', () => {
        this.autoSwitch = autoCheck.checked;
      });
    }

    container.querySelectorAll('.seasonal-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const svcId = btn.dataset.svc;
        const season = btn.dataset.season;
        if (!this.serviceOverrides[svcId]) this.serviceOverrides[svcId] = {};
        const current = this.serviceOverrides[svcId][season]?.active !== false;
        this.serviceOverrides[svcId][season] = { active: !current };
        this.render(container, game);
      });
    });
  }

  toSave() {
    return {
      mode: this.mode,
      autoSwitch: this.autoSwitch,
      summerStart: this.summerStart,
      summerEnd: this.summerEnd,
      serviceOverrides: this.serviceOverrides,
      peakServices: this.peakServices,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.mode = s.mode || 'normal';
    this.autoSwitch = s.autoSwitch !== false;
    this.summerStart = s.summerStart || { month: 6, day: 1 };
    this.summerEnd = s.summerEnd || { month: 9, day: 30 };
    this.serviceOverrides = s.serviceOverrides || {};
    this.peakServices = s.peakServices || [];
  }
}
