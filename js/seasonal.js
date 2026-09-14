import { htmlText } from './html-text.js';
import { icon } from './icons.js';
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
/**
 * SeasonalSchedule — Summer/winter timetable system.
 * Manages timetable grids and automatic switching.
 */
export class SeasonalSchedule {
    constructor() {
        this.mode = 'normal';
        this.autoSwitch = true;
        this.summerStart = { month: 6, day: 1 };
        this.summerEnd = { month: 9, day: 30 };
        this._lastMode = 'normal';
        this.serviceOverrides = {};
        this.peakServices = [];
    }
    checkSeason(dateStr) {
        if (!this.autoSwitch || !dateStr)
            return;
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
    isServiceActive(serviceId) {
        const override = this.serviceOverrides[serviceId];
        if (!override)
            return true;
        const seasonCfg = override[this.mode] || override.normal;
        if (!seasonCfg)
            return true;
        return seasonCfg.active !== false;
    }
    getFrequencyMultiplier(serviceId) {
        const override = this.serviceOverrides[serviceId];
        if (!override)
            return 1;
        const seasonCfg = override[this.mode] || override.normal;
        if (!seasonCfg)
            return 1;
        const f = Number(seasonCfg.freq);
        return Number.isFinite(f) && f > 0 ? f : 1;
    }
    setOverride(serviceId, season, config) {
        if (!this.serviceOverrides[serviceId])
            this.serviceOverrides[serviceId] = {};
        this.serviceOverrides[serviceId][season] = config;
    }
    addPeakService(serviceConfig) {
        this.peakServices.push({
            id: `peak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...serviceConfig,
        });
    }
    render(container, game) {
        if (!container)
            return;
        const modeColor = this.mode === 'summer' ? '#f97316' : this.mode === 'winter' ? '#38bdf8' : 'var(--text)';
        const modeIcon = this.mode === 'summer' ? icon('sun', 14) : this.mode === 'winter' ? icon('snow', 14) : icon('transfer', 14);
        const modeLabel = this.mode === 'summer' ? 'Grille été' : this.mode === 'winter' ? 'Grille hiver' : 'Normal';
        const rawServices = game.scheduleCreator?.services || [];
        const seenServiceKeys = new Set();
        const services = rawServices.filter((svc) => {
            const key = svc?._v2ScheduleId || svc?.id;
            if (!key || seenServiceKeys.has(key))
                return false;
            seenServiceKeys.add(key);
            return true;
        });
        container.innerHTML = `
      <div class="dash-section">
        <h3>Horaires Saisonniers</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi"><div class="dash-kpi-label">Grille active</div><div class="dash-kpi-value" style="color:${htmlText(modeColor)}">${modeIcon} ${htmlText(modeLabel)}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Changement auto</div><div class="dash-kpi-value" style="color:${htmlText(this.autoSwitch ? 'var(--green)' : 'var(--text3)')}">${this.autoSwitch ? 'Activé' : 'Désactivé'}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Période été</div><div class="dash-kpi-value" style="font-size:14px">${this.summerStart.day}/${this.summerStart.month} → ${this.summerEnd.day}/${this.summerEnd.month}</div></div>
          <div class="dash-kpi"><div class="dash-kpi-label">Services configurés</div><div class="dash-kpi-value">${Object.keys(this.serviceOverrides).length}</div></div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Changer de grille</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <button class="seasonal-switch btn-primary" data-mode="summer" style="font-size:11px;padding:8px 14px;background:#f97316">Grille été</button>
          <button class="seasonal-switch btn-primary" data-mode="winter" style="font-size:11px;padding:8px 14px;background:#38bdf8">Grille hiver</button>
          <button class="seasonal-switch btn-primary" data-mode="normal" style="font-size:11px;padding:8px 14px;background:#6b7280">Normal</button>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text2)"><input type="checkbox" id="seasonal-auto" ${this.autoSwitch ? 'checked' : ''}> Changement auto</label>
        </div>
      </div>

      <div class="dash-section">
        <h3>Configuration par service</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr"><span>Service</span><span>Normal</span><span>Été</span><span>Hiver</span></div>
          ${services.length === 0 ? '<div style="padding:8px;color:var(--text3)">Aucun service créé</div>' : services.map((svc) => {
            const seasonalKey = svc._v2ScheduleId || svc.id || '';
            const ov = this.serviceOverrides[seasonalKey] || {};
            const sumActive = ov.summer?.active !== false;
            const winActive = ov.winter?.active !== false;
            return `<div class="dash-train-row" style="grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr"><span>${htmlText(svc.name || svc.id)}</span><span style="color:var(--green)">✓</span><span><button class="seasonal-toggle btn-sm" data-svc="${htmlText(seasonalKey)}" data-season="summer" style="background:${htmlText(sumActive ? 'var(--green)' : '#ef4444')}">${sumActive ? '✓' : '✗'}</button></span><span><button class="seasonal-toggle btn-sm" data-svc="${htmlText(seasonalKey)}" data-season="winter" style="background:${htmlText(winActive ? 'var(--green)' : '#ef4444')}">${winActive ? '✓' : '✗'}</button></span></div>`;
        }).join('')}
        </div>
      </div>`;
        container.querySelectorAll('.seasonal-switch').forEach((node) => {
            const btn = node;
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.mode = mode === 'summer' || mode === 'winter' || mode === 'normal' ? mode : 'normal';
                game.scheduleCreator?._invalidateActiveCache?.();
                game.scheduleV2Runtime?.forceSync?.(game.timeOfDay || 0, game._currentDate || game.engine?.getParisDate?.());
                game.saveState?.();
                this.render(container, game);
            });
        });
        const autoCheck = container.querySelector('#seasonal-auto');
        if (autoCheck) {
            autoCheck.addEventListener('change', () => {
                this.autoSwitch = autoCheck.checked;
                game.saveState?.();
            });
        }
        container.querySelectorAll('.seasonal-toggle').forEach((node) => {
            const btn = node;
            btn.addEventListener('click', () => {
                const svcId = btn.dataset.svc || '';
                const season = btn.dataset.season;
                if (season !== 'normal' && season !== 'summer' && season !== 'winter')
                    return;
                if (!this.serviceOverrides[svcId])
                    this.serviceOverrides[svcId] = {};
                const current = this.serviceOverrides[svcId][season]?.active !== false;
                this.serviceOverrides[svcId][season] = { active: !current };
                game.scheduleCreator?._invalidateActiveCache?.();
                game.scheduleV2Runtime?.forceSync?.(game.timeOfDay || 0, game._currentDate || game.engine?.getParisDate?.());
                game.saveState?.();
                this.render(container, game);
            });
        });
    }
    toSave() {
        return { mode: this.mode, autoSwitch: this.autoSwitch, summerStart: this.summerStart, summerEnd: this.summerEnd, serviceOverrides: this.serviceOverrides, peakServices: this.peakServices };
    }
    loadFromSave(rawSave) {
        if (!isRecord(rawSave))
            return;
        const s = rawSave;
        this.mode = s.mode === 'summer' || s.mode === 'winter' || s.mode === 'normal' ? s.mode : 'normal';
        this.autoSwitch = s.autoSwitch !== false;
        const cleanDate = (v, fb) => {
            const rec = isRecord(v) ? v : {};
            const m = Math.floor(Number(rec.month)), d = Math.floor(Number(rec.day));
            return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { month: m, day: d } : fb;
        };
        this.summerStart = cleanDate(s.summerStart, { month: 6, day: 1 });
        this.summerEnd = cleanDate(s.summerEnd, { month: 9, day: 30 });
        this.serviceOverrides = {};
        if (isRecord(s.serviceOverrides)) {
            for (const [id, raw] of Object.entries(s.serviceOverrides)) {
                if (!id || !isRecord(raw))
                    continue;
                const clean = {};
                for (const season of ['normal', 'summer', 'winter']) {
                    const rawSeason = raw[season];
                    if (isRecord(rawSeason)) {
                        const f = Number(rawSeason.freq);
                        clean[season] = { active: rawSeason.active !== false };
                        if (Number.isFinite(f) && f > 0)
                            clean[season].freq = f;
                    }
                }
                this.serviceOverrides[id] = clean;
            }
        }
        this.peakServices = (Array.isArray(s.peakServices) ? s.peakServices : [])
            .filter((x) => isRecord(x) && !!x.id)
            .map((x) => {
            const out = { ...x, id: String(x.id) };
            if ('frequency' in out) {
                const f = Number(out.frequency);
                out.frequency = Number.isFinite(f) && f > 0 ? f : 1;
            }
            return out;
        });
    }
}
