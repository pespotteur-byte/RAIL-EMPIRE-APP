/**
 * Weather — Dynamic weather system with gameplay effects.
 * Read-mostly: only modifies speed limits temporarily.
 */
export class Weather {
  constructor() {
    this.current = 'clear';      // clear, rain, snow, storm, heat, fog
    this.temperature = 18;       // °C
    this.season = 'spring';      // spring, summer, autumn, winter
    this._lastChange = 0;
    this._changeCooldown = 60;   // min between weather changes
    this._seasonalProbs = {
      spring: { clear: 0.45, rain: 0.30, fog: 0.15, storm: 0.10, snow: 0.00, heat: 0.00 },
      summer: { clear: 0.40, rain: 0.10, fog: 0.05, storm: 0.15, snow: 0.00, heat: 0.30 },
      autumn: { clear: 0.30, rain: 0.35, fog: 0.20, storm: 0.10, snow: 0.05, heat: 0.00 },
      winter: { clear: 0.25, rain: 0.15, fog: 0.15, storm: 0.10, snow: 0.35, heat: 0.00 },
    };
    this._effects = {
      clear:  { speedMult: 1.0,  icon: '☀️',  label: 'Dégagé',      color: '#fbbf24' },
      rain:   { speedMult: 0.90, icon: '🌧️',  label: 'Pluie',       color: '#60a5fa' },
      snow:   { speedMult: 0.70, icon: '❄️',  label: 'Neige',       color: '#e2e8f0' },
      storm:  { speedMult: 0.60, icon: '⛈️',  label: 'Tempête',     color: '#a855f7' },
      heat:   { speedMult: 0.85, icon: '🌡️',  label: 'Canicule',    color: '#ef4444' },
      fog:    { speedMult: 0.75, icon: '🌫️',  label: 'Brouillard',  color: '#94a3b8' },
    };
  }

  /**
   * Update weather based on game time. Called from tick().
   */
  update(timeOfDay, dateStr) {
    // Determine season from date
    if (dateStr) {
      const month = parseInt(dateStr.split('-')[1], 10);
      if (month >= 3 && month <= 5) this.season = 'spring';
      else if (month >= 6 && month <= 8) this.season = 'summer';
      else if (month >= 9 && month <= 11) this.season = 'autumn';
      else this.season = 'winter';
    }

    // Temperature varies by season and time
    const baseTemp = { spring: 14, summer: 26, autumn: 10, winter: 2 }[this.season];
    const hourOffset = Math.sin((timeOfDay / 60 - 6) * Math.PI / 12) * 6;
    this.temperature = Math.round(baseTemp + hourOffset + (Math.random() - 0.5) * 2);

    // Weather change every _changeCooldown minutes
    if (timeOfDay - this._lastChange >= this._changeCooldown || this._lastChange === 0) {
      this._lastChange = timeOfDay;
      this._rollWeather();
    }
  }

  _rollWeather() {
    const probs = this._seasonalProbs[this.season] || this._seasonalProbs.spring;
    const rand = Math.random();
    let cumul = 0;
    for (const [type, prob] of Object.entries(probs)) {
      cumul += prob;
      if (rand <= cumul) {
        this.current = type;
        return;
      }
    }
    this.current = 'clear';
  }

  /**
   * Get the speed multiplier for current weather.
   */
  getSpeedMultiplier() {
    return this._effects[this.current]?.speedMult ?? 1.0;
  }

  /**
   * Get display data.
   */
  getDisplay() {
    const e = this._effects[this.current] || this._effects.clear;
    return {
      icon: e.icon,
      label: e.label,
      color: e.color,
      speedPct: Math.round(e.speedMult * 100),
      temperature: this.temperature,
      season: this._seasonLabel(),
    };
  }

  _seasonLabel() {
    return { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' }[this.season] || '';
  }

  /**
   * Render compact weather widget (for header or sidebar).
   */
  renderWidget() {
    const d = this.getDisplay();
    return `<span class="weather-widget" style="color:${d.color}" title="${d.label} — ${d.temperature}°C — Vitesse: ${d.speedPct}%">
      ${d.icon} ${d.temperature}°C
    </span>`;
  }

  /**
   * Render full weather panel (page or section).
   */
  render(container) {
    if (!container) return;
    const d = this.getDisplay();
    const eff = this._effects[this.current];

    container.innerHTML = `
      <div class="dash-section">
        <h3>Météo & Saisons</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Condition</div>
            <div class="dash-kpi-value" style="color:${d.color}">${d.icon} ${d.label}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Température</div>
            <div class="dash-kpi-value" style="color:${this.temperature > 35 ? '#ef4444' : this.temperature < 0 ? '#38bdf8' : 'var(--text)'}">${d.temperature}°C</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Saison</div>
            <div class="dash-kpi-value">${d.season}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Impact vitesse</div>
            <div class="dash-kpi-value" style="color:${d.speedPct < 100 ? '#ef4444' : 'var(--green)'}">${d.speedPct}%</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Effets météo sur le trafic</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.5fr 1fr 1fr 1fr">
            <span></span><span>Condition</span><span>Impact vitesse</span><span>Probabilité (${d.season})</span>
          </div>
          ${Object.entries(this._effects).map(([key, e]) => {
            const prob = this._seasonalProbs[this.season]?.[key] ?? 0;
            const isActive = key === this.current;
            return `<div class="dash-train-row" style="grid-template-columns:0.5fr 1fr 1fr 1fr;${isActive ? 'background:var(--bg3)' : ''}">
              <span>${e.icon}</span>
              <span style="${isActive ? 'font-weight:700' : ''}">${e.label}</span>
              <span style="color:${e.speedMult < 1 ? '#ef4444' : 'var(--green)'}">${Math.round(e.speedMult * 100)}%</span>
              <span>${(prob * 100).toFixed(0)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  toSave() {
    return {
      current: this.current,
      temperature: this.temperature,
      season: this.season,
      _lastChange: this._lastChange,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.current = s.current || 'clear';
    this.temperature = s.temperature ?? 18;
    this.season = s.season || 'spring';
    this._lastChange = s._lastChange || 0;
  }
}
