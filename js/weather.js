/**
 * Weather — Live weather system using Open-Meteo API.
 * Fetches real weather data based on map center position.
 * Falls back to simulated weather if API is unavailable.
 */
export class Weather {
  constructor() {
    this.current = 'clear';      // clear, rain, snow, storm, heat, fog
    this.temperature = 18;       // °C
    this.windSpeed = 0;          // km/h
    this.humidity = 50;          // %
    this.precipitation = 0;      // mm
    this.cloudCover = 0;         // %
    this.season = 'spring';
    this.locationName = '';      // reverse geocoded name
    this._lastFetchTime = 0;
    this._fetchCooldown = 300000; // 5 min between API calls (real time)
    this._lastLat = 0;
    this._lastLon = 0;
    this._fetchInProgress = false;
    this._liveDataAvailable = false;
    this._wmoDescription = '';

    // RainViewer radar data
    this.radarTimestamps = [];
    this.radarHost = '';
    this._lastRadarFetch = 0;
    this._radarFetchCooldown = 600000; // 10 min

    this._effects = {
      clear:  { speedMult: 1.0,  icon: '☀️',  label: 'Dégagé',      color: '#fbbf24' },
      rain:   { speedMult: 0.90, icon: '🌧️',  label: 'Pluie',       color: '#60a5fa' },
      snow:   { speedMult: 0.70, icon: '❄️',  label: 'Neige',       color: '#e2e8f0' },
      storm:  { speedMult: 0.60, icon: '⛈️',  label: 'Tempête',     color: '#a855f7' },
      heat:   { speedMult: 0.85, icon: '🌡️',  label: 'Canicule',    color: '#ef4444' },
      fog:    { speedMult: 0.75, icon: '🌫️',  label: 'Brouillard',  color: '#94a3b8' },
    };

    // WMO weather code mapping
    this._wmoMapping = {
      0: { type: 'clear', desc: 'Ciel dégagé' },
      1: { type: 'clear', desc: 'Principalement dégagé' },
      2: { type: 'clear', desc: 'Partiellement nuageux' },
      3: { type: 'fog', desc: 'Couvert' },
      45: { type: 'fog', desc: 'Brouillard' },
      48: { type: 'fog', desc: 'Brouillard givrant' },
      51: { type: 'rain', desc: 'Bruine légère' },
      53: { type: 'rain', desc: 'Bruine modérée' },
      55: { type: 'rain', desc: 'Bruine forte' },
      56: { type: 'rain', desc: 'Bruine verglaçante légère' },
      57: { type: 'rain', desc: 'Bruine verglaçante forte' },
      61: { type: 'rain', desc: 'Pluie légère' },
      63: { type: 'rain', desc: 'Pluie modérée' },
      65: { type: 'rain', desc: 'Pluie forte' },
      66: { type: 'rain', desc: 'Pluie verglaçante légère' },
      67: { type: 'rain', desc: 'Pluie verglaçante forte' },
      71: { type: 'snow', desc: 'Neige légère' },
      73: { type: 'snow', desc: 'Neige modérée' },
      75: { type: 'snow', desc: 'Neige forte' },
      77: { type: 'snow', desc: 'Grains de neige' },
      80: { type: 'rain', desc: 'Averses légères' },
      81: { type: 'rain', desc: 'Averses modérées' },
      82: { type: 'storm', desc: 'Averses violentes' },
      85: { type: 'snow', desc: 'Averses de neige légères' },
      86: { type: 'snow', desc: 'Averses de neige fortes' },
      95: { type: 'storm', desc: 'Orage' },
      96: { type: 'storm', desc: 'Orage avec grêle légère' },
      99: { type: 'storm', desc: 'Orage avec grêle forte' },
    };
  }

  /**
   * Update weather — fetches live data from Open-Meteo API.
   */
  update(timeOfDay, dateStr, lat, lon) {
    // Season from date
    if (dateStr) {
      const month = parseInt(dateStr.split('-')[1], 10);
      if (month >= 3 && month <= 5) this.season = 'spring';
      else if (month >= 6 && month <= 8) this.season = 'summer';
      else if (month >= 9 && month <= 11) this.season = 'autumn';
      else this.season = 'winter';
    }

    // Fetch live weather from Open-Meteo (every 5 min real time, or if position changed significantly)
    if (lat && lon) {
      const now = Date.now();
      const posChanged = Math.abs(lat - this._lastLat) > 0.1 || Math.abs(lon - this._lastLon) > 0.1;
      if ((now - this._lastFetchTime > this._fetchCooldown || posChanged) && !this._fetchInProgress) {
        this._fetchLiveWeather(lat, lon);
      }
      // Also fetch radar timestamps
      if (now - this._lastRadarFetch > this._radarFetchCooldown) {
        this._fetchRadarTimestamps();
      }
    }
  }

  async _fetchLiveWeather(lat, lon) {
    this._fetchInProgress = true;
    this._lastLat = lat;
    this._lastLon = lon;
    this._lastFetchTime = Date.now();

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,cloud_cover&timezone=auto`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data.current) {
        this.temperature = Math.round(data.current.temperature_2m ?? 18);
        this.humidity = Math.round(data.current.relative_humidity_2m ?? 50);
        this.precipitation = data.current.precipitation ?? 0;
        this.windSpeed = Math.round(data.current.wind_speed_10m ?? 0);
        this.cloudCover = Math.round(data.current.cloud_cover ?? 0);

        const wmoCode = data.current.weather_code ?? 0;
        const wmo = this._wmoMapping[wmoCode] || this._wmoMapping[0];
        this.current = wmo.type;
        this._wmoDescription = wmo.desc;

        // Override with heat if temperature > 35°C
        if (this.temperature > 35 && this.current === 'clear') {
          this.current = 'heat';
          this._wmoDescription = 'Canicule';
        }

        this._liveDataAvailable = true;
      }
    } catch (e) {
      console.warn('Open-Meteo fetch failed, using fallback:', e.message);
      this._liveDataAvailable = false;
      this._fallbackWeather();
    } finally {
      this._fetchInProgress = false;
    }
  }

  async _fetchRadarTimestamps() {
    this._lastRadarFetch = Date.now();
    try {
      const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.radar?.past) {
        this.radarTimestamps = data.radar.past.map(p => p.path);
        this.radarHost = data.host || 'https://tilecache.rainviewer.com';
      }
    } catch (e) {
      console.warn('RainViewer fetch failed:', e.message);
    }
  }

  getLatestRadarPath() {
    if (this.radarTimestamps.length === 0) return null;
    return this.radarTimestamps[this.radarTimestamps.length - 1];
  }

  getRadarTileUrl(path) {
    if (!path) return null;
    return `${this.radarHost}${path}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  _fallbackWeather() {
    const probs = {
      spring: { clear: 0.45, rain: 0.30, fog: 0.15, storm: 0.10, snow: 0.00, heat: 0.00 },
      summer: { clear: 0.40, rain: 0.10, fog: 0.05, storm: 0.15, snow: 0.00, heat: 0.30 },
      autumn: { clear: 0.30, rain: 0.35, fog: 0.20, storm: 0.10, snow: 0.05, heat: 0.00 },
      winter: { clear: 0.25, rain: 0.15, fog: 0.15, storm: 0.10, snow: 0.35, heat: 0.00 },
    };
    const p = probs[this.season] || probs.spring;
    const r = Math.random();
    let cumul = 0;
    for (const [type, prob] of Object.entries(p)) {
      cumul += prob;
      if (r <= cumul) { this.current = type; return; }
    }
    this.current = 'clear';
  }

  getSpeedMultiplier() {
    return this._effects[this.current]?.speedMult ?? 1.0;
  }

  getDisplay() {
    const e = this._effects[this.current] || this._effects.clear;
    return {
      icon: e.icon,
      label: this._wmoDescription || e.label,
      color: e.color,
      speedPct: Math.round(e.speedMult * 100),
      temperature: this.temperature,
      season: this._seasonLabel(),
      humidity: this.humidity,
      windSpeed: this.windSpeed,
      precipitation: this.precipitation,
      cloudCover: this.cloudCover,
      live: this._liveDataAvailable,
    };
  }

  _seasonLabel() {
    return { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' }[this.season] || '';
  }

  renderWidget() {
    const d = this.getDisplay();
    const liveTag = d.live ? ' LIVE' : '';
    return `<span class="weather-widget" style="color:${d.color}" title="${d.label} — ${d.temperature}°C — Vent: ${d.windSpeed} km/h — Vitesse: ${d.speedPct}%${liveTag}">
      ${d.icon} ${d.temperature}°C${d.live ? ' <span style="font-size:8px;color:#22c55e;vertical-align:super">LIVE</span>' : ''}
    </span>`;
  }

  render(container) {
    if (!container) return;
    const d = this.getDisplay();

    container.innerHTML = `
      <div class="dash-section">
        <h3>Météo en temps réel ${d.live ? '<span style="font-size:10px;color:#22c55e;background:#052e16;padding:2px 6px;border-radius:3px;margin-left:6px">LIVE</span>' : '<span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:2px 6px;border-radius:3px;margin-left:6px">SIMULÉE</span>'}</h3>
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
            <div class="dash-kpi-label">Humidité</div>
            <div class="dash-kpi-value">${d.humidity}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Vent</div>
            <div class="dash-kpi-value" style="color:${d.windSpeed > 60 ? '#ef4444' : d.windSpeed > 30 ? '#f97316' : 'var(--text)'}">${d.windSpeed} km/h</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Précipitations</div>
            <div class="dash-kpi-value" style="color:${d.precipitation > 0 ? '#60a5fa' : 'var(--text)'}">${d.precipitation} mm</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Couverture nuageuse</div>
            <div class="dash-kpi-value">${d.cloudCover}%</div>
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
        ${d.live ? `<p style="font-size:10px;color:var(--text3);margin-top:8px">Données Open-Meteo • Position: ${this._lastLat.toFixed(2)}°N, ${this._lastLon.toFixed(2)}°E • Mise à jour toutes les 5 min</p>` : ''}
      </div>

      <div class="dash-section">
        <h3>Effets météo sur le trafic</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:0.5fr 1fr 1fr">
            <span></span><span>Condition</span><span>Impact vitesse</span>
          </div>
          ${Object.entries(this._effects).map(([key, e]) => {
            const isActive = key === this.current;
            return `<div class="dash-train-row" style="grid-template-columns:0.5fr 1fr 1fr;${isActive ? 'background:var(--bg3)' : ''}">
              <span>${e.icon}</span>
              <span style="${isActive ? 'font-weight:700' : ''}">${e.label}</span>
              <span style="color:${e.speedMult < 1 ? '#ef4444' : 'var(--green)'}">${Math.round(e.speedMult * 100)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Radar précipitations</h3>
        <p style="font-size:11px;color:var(--text3)">
          ${this.radarTimestamps.length > 0
            ? `${this.radarTimestamps.length} images radar disponibles. Activez le filtre radar sur la carte (bouton 🌧️ en haut à gauche) pour voir les précipitations en temps réel.`
            : 'Chargement des données radar RainViewer...'}
        </p>
      </div>
    `;
  }

  toSave() {
    return {
      current: this.current,
      temperature: this.temperature,
      season: this.season,
      _lastLat: this._lastLat,
      _lastLon: this._lastLon,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.current = s.current || 'clear';
    this.temperature = s.temperature ?? 18;
    this.season = s.season || 'spring';
    this._lastLat = s._lastLat || 0;
    this._lastLon = s._lastLon || 0;
  }
}
