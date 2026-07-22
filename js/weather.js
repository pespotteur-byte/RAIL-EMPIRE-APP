/**
 * Weather — Live weather system using Open-Meteo API.
 * Fetches real weather data based on map center position.
 * Falls back to simulated weather if API is unavailable.
 */
import { icon } from './icons.js';
import { getGlobalRng } from './rng.js?v=1784731011';
import { escapeHtml } from './html-utils.js?v=1784731011';
export class Weather {
  constructor() {
    this.current = 'clear';      // clear, rain, snow, storm, heat, fog
    this.temperature = 18;       // °C
    this.windSpeed = 0;          // km/h
    this.humidity = 50;          // %
    this.precipitation = 0;      // mm
    this.cloudCover = 0;         // %
    this.cloudLow = 0;           // % (< 2km altitude)
    this.cloudMid = 0;           // % (2-6km altitude)
    this.cloudHigh = 0;          // % (> 6km altitude)
    this.pressure = 1013;        // hPa
    this.apparentTemp = 18;      // °C (felt temperature)
    this.windDirection = 0;      // degrees
    this.visibility = 10;        // km
    this.uvIndex = 0;
    this.dewpoint = 10;          // °C
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

    // MET-01 — cache météo par point lat/lon (jusqu'à 500 points, 10 min)
    this._pointCache = new Map();
    this._pointFetchQueue = [];
    this._maxPointCache = 500;
    this._pointCooldown = 600000;

    this._effects = {
      clear:  { speedMult: 1.0,  icon: 'sun',         label: 'Dégagé',      color: '#fbbf24' },
      rain:   { speedMult: 0.90, icon: 'rain',        label: 'Pluie',       color: '#60a5fa' },
      snow:   { speedMult: 0.70, icon: 'snow',        label: 'Neige',       color: '#e2e8f0' },
      storm:  { speedMult: 0.60, icon: 'storm',       label: 'Tempête',     color: '#a855f7' },
      heat:   { speedMult: 0.85, icon: 'thermometer', label: 'Canicule',    color: '#ef4444' },
      fog:    { speedMult: 0.75, icon: 'fog',         label: 'Brouillard',  color: '#94a3b8' },
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl,apparent_temperature,visibility,uv_index,dew_point_2m&timezone=auto`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data.current) {
        this.temperature = Math.round(data.current.temperature_2m ?? 18);
        this.humidity = Math.round(data.current.relative_humidity_2m ?? 50);
        this.precipitation = data.current.precipitation ?? 0;
        this.windSpeed = Math.round(data.current.wind_speed_10m ?? 0);
        this.cloudCover = Math.round(data.current.cloud_cover ?? 0);
        this.cloudLow = Math.round(data.current.cloud_cover_low ?? 0);
        this.cloudMid = Math.round(data.current.cloud_cover_mid ?? 0);
        this.cloudHigh = Math.round(data.current.cloud_cover_high ?? 0);
        this.pressure = Math.round(data.current.pressure_msl ?? 1013);
        this.apparentTemp = Math.round(data.current.apparent_temperature ?? this.temperature);
        this.windDirection = Math.round(data.current.wind_direction_10m ?? 0);
        this.visibility = data.current.visibility != null ? Math.round(data.current.visibility / 1000) : 10;
        this.uvIndex = data.current.uv_index ?? 0;
        this.dewpoint = Math.round(data.current.dew_point_2m ?? 10);

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
      // Infrared satellite (cloud cover) data
      if (data.satellite?.infrared) {
        this.cloudTimestamps = data.satellite.infrared.map(p => p.path);
      }
    } catch (e) {
      console.warn('RainViewer fetch failed:', e.message);
    }
  }

  getLatestRadarPath() {
    if (this.radarTimestamps.length === 0) return null;
    return this.radarTimestamps[this.radarTimestamps.length - 1];
  }

  getLatestCloudPath() {
    if (!this.cloudTimestamps || this.cloudTimestamps.length === 0) return null;
    return this.cloudTimestamps[this.cloudTimestamps.length - 1];
  }

  getRadarTileUrl(path) {
    if (!path) return null;
    return `${this.radarHost}${path}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  getCloudTileUrl(path) {
    if (path) {
      // Legacy RainViewer infrared satellite path (gardé pour tests/compat)
      return `${this.radarHost}${path}/256/{z}/{x}/{y}/0/0_0.png`;
    }
    // XIV — vraies images satellites : NASA GIBS VIIRS/NOAA-20 True Color
    // Les composites journaliers NASA ne sont généralement complets que le lendemain
    // (date UTC pleine). On décale de 24 h pour avoir le dernier jour pleinement
    // disponible, ce qui met à jour automatiquement le calque à minuit UTC.
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const date = d.toISOString().split('T')[0];
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`;
  }

  _fallbackWeather() {
    const probs = {
      spring: { clear: 0.45, rain: 0.30, fog: 0.15, storm: 0.10, snow: 0.00, heat: 0.00 },
      summer: { clear: 0.40, rain: 0.10, fog: 0.05, storm: 0.15, snow: 0.00, heat: 0.30 },
      autumn: { clear: 0.30, rain: 0.35, fog: 0.20, storm: 0.10, snow: 0.05, heat: 0.00 },
      winter: { clear: 0.25, rain: 0.15, fog: 0.15, storm: 0.10, snow: 0.35, heat: 0.00 },
    };
    const p = probs[this.season] || probs.spring;
    const rng = getGlobalRng();
    const r = rng.random();
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

  // MET-01 — cache météo par point
  _pointKey(lat, lon) {
    const k = 100;
    return `${Math.round(lat * k)},${Math.round(lon * k)}`;
  }

  _globalPointState() {
    return {
      type: this.current,
      temperature: this.temperature,
      windSpeed: this.windSpeed,
      precipitation: this.precipitation,
      label: this._wmoDescription || (this._effects[this.current]?.label || 'Dégagé'),
      live: this._liveDataAvailable,
    };
  }

  getAt(lat, lon) {
    if (lat == null || lon == null) return this._globalPointState();
    const key = this._pointKey(lat, lon);
    const cached = this._pointCache.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.state;
    this._queuePointFetch(lat, lon);
    return this._globalPointState();
  }

  _queuePointFetch(lat, lon) {
    const key = this._pointKey(lat, lon);
    if (this._pointFetchQueue.some(p => p.key === key)) return;
    this._pointFetchQueue.push({ key, lat, lon, ts: Date.now() });
    if (this._pointFetchQueue.length > this._maxPointCache) this._pointFetchQueue.shift();
    if (!this._pointFetchTimer) {
      this._pointFetchTimer = setTimeout(() => this._processPointFetchQueue(), 200);
    }
  }

  async _processPointFetchQueue() {
    this._pointFetchTimer = null;
    const item = this._pointFetchQueue.shift();
    if (!item) return;
    try {
      const state = await this._fetchLiveWeatherFor(item.lat, item.lon);
      this._pointCache.set(item.key, { state, expiresAt: Date.now() + this._pointCooldown });
      if (this._pointCache.size > this._maxPointCache) {
        const oldest = this._pointCache.keys().next().value;
        this._pointCache.delete(oldest);
      }
    } catch (e) {
      // console.warn('Point weather fetch failed', e.message);
    }
    if (this._pointFetchQueue.length > 0) {
      this._pointFetchTimer = setTimeout(() => this._processPointFetchQueue(), 500);
    }
  }

  async _fetchLiveWeatherFor(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const cur = data.current || {};
    const wmoCode = cur.weather_code ?? 0;
    const wmo = this._wmoMapping[wmoCode] || this._wmoMapping[0];
    let type = wmo.type;
    const temp = Math.round(cur.temperature_2m ?? this.temperature);
    if (temp > 35 && type === 'clear') type = 'heat';
    return {
      type,
      temperature: temp,
      windSpeed: Math.round(cur.wind_speed_10m ?? this.windSpeed),
      precipitation: cur.precipitation ?? 0,
      label: wmo.desc,
      live: true,
    };
  }

  /** Returns the local weather effects at a lat/lon for a train:
   *  - speedCap: an absolute km/h cap to subtract for snow (MET-06)
   *  - brakeFactor: multiplier on deceleration (lower = brake earlier)
   *  - speedMult: multiplier on top speed (kept for display)
   *  - type: weather type
   */
  getSpeedEffectsAt(lat, lon, trainSpeedKmh = 0) {
    const state = this.getAt(lat, lon);
    const type = state.type;
    let speedCap = Infinity;
    let brakeFactor = 1.0;
    // DET-05 : curseur de réalisme météo (0 = sans impact, 1 = normal, 2 = extrême)
    const weatherMult = (typeof window !== 'undefined' && window.game?.realismSettings?.weather) ?? 1;
    // MET-06 — neige : −20 km/h si V ≥ 140 + freinage dégradé
    if (type === 'snow') {
      if (trainSpeedKmh >= 140) speedCap = trainSpeedKmh - 20 * weatherMult;
      const base = 0.55;
      brakeFactor = 1 - (1 - base) * weatherMult;
    } else if (type === 'rain') {
      // MET-03/04 : pluie = freiner plus tôt (pas de baisse de vitesse)
      const base = state.precipitation > 2.5 ? 0.80 : 0.92;
      brakeFactor = 1 - (1 - base) * weatherMult;
    } else if (type === 'storm') {
      // MET-05 : orage/tempête = freiner encore plus tôt
      const base = 0.60;
      brakeFactor = 1 - (1 - base) * weatherMult;
    } else if (type === 'fog') {
      const base = 0.85;
      brakeFactor = 1 - (1 - base) * weatherMult;
    } else if (type === 'heat') {
      brakeFactor = 1.0;
    }
    const speedMult = this._effects[type]?.speedMult ?? 1.0;
    return { type, speedCap, brakeFactor: Math.max(0.1, brakeFactor), speedMult, label: state.label };
  }

  getDisplay() {
    const e = this._effects[this.current] || this._effects.clear;
    return {
      icon: e.icon,
      label: this._wmoDescription || e.label,
      color: e.color,
      speedPct: Math.round(e.speedMult * 100),
      temperature: this.temperature,
      apparentTemp: this.apparentTemp,
      season: this._seasonLabel(),
      humidity: this.humidity,
      windSpeed: this.windSpeed,
      windDirection: this.windDirection,
      precipitation: this.precipitation,
      cloudCover: this.cloudCover,
      cloudLow: this.cloudLow,
      cloudMid: this.cloudMid,
      cloudHigh: this.cloudHigh,
      pressure: this.pressure,
      visibility: this.visibility,
      uvIndex: this.uvIndex,
      dewpoint: this.dewpoint,
      live: this._liveDataAvailable,
    };
  }

  _windDirLabel(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  _seasonLabel() {
    return { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' }[this.season] || '';
  }

  renderWidget() {
    const d = this.getDisplay();
    const liveTag = d.live ? ' LIVE' : '';
    return `<span class="weather-widget" style="color:${d.color}" title="${d.label} — ${d.temperature}°C — Vent: ${d.windSpeed} km/h — Vitesse: ${d.speedPct}%${liveTag}">
      ${icon(d.icon, 14)} ${d.temperature}°C${d.live ? ' <span style="font-size:8px;color:#22c55e;vertical-align:super">LIVE</span>' : ''}
    </span>`;
  }

  render(container) {
    if (!container) return;
    const d = this.getDisplay();

    // Wind direction indicator
    const windArrow = d.windSpeed > 0 ? icon('wind', 12) : '';
    const windClass = d.windSpeed > 80 ? 'color:#ef4444;font-weight:700' : d.windSpeed > 50 ? 'color:#f97316' : d.windSpeed > 20 ? 'color:#eab308' : 'color:var(--text)';

    // Temperature color gradient
    const tempColor = this.temperature > 35 ? '#ef4444' : this.temperature > 25 ? '#f97316' : this.temperature < -5 ? '#818cf8' : this.temperature < 5 ? '#38bdf8' : '#22c55e';

    // Cloud layer bars helper
    const mkCloudBar = (pct, color) => `<div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:5px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div></div><span style="font-size:10px;min-width:28px;text-align:right">${pct}%</span></div>`;

    // Humidity bar
    const humBar = `<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="width:${d.humidity}%;height:100%;background:${d.humidity > 80 ? '#60a5fa' : d.humidity > 50 ? '#3b82f6' : '#2563eb'};border-radius:3px"></div></div><span style="font-size:11px">${d.humidity}%</span></div>`;

    container.innerHTML = `
      <div class="dash-section" style="border-left:3px solid ${d.color};padding-left:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="margin:0">Météo actuelle</h3>
          ${d.live
            ? '<span style="font-size:10px;color:#22c55e;background:#052e16;padding:3px 8px;border-radius:4px;font-weight:600;letter-spacing:0.5px">● LIVE</span>'
            : '<span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:3px 8px;border-radius:4px">SIMULÉE</span>'}
        </div>

        <!-- Big weather display -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px">
          <div style="font-size:48px;line-height:1">${icon(d.icon, 48)}</div>
          <div style="flex:1">
            <div style="font-size:28px;font-weight:700;color:${tempColor}">${d.temperature}°C</div>
            <div style="font-size:14px;color:${d.color};font-weight:600">${escapeHtml(d.label)}</div>
            <div style="font-size:11px;color:var(--text3)">${escapeHtml(d.season)} • Impact vitesse: <span style="color:${d.speedPct < 100 ? '#ef4444' : '#22c55e'};font-weight:600">${d.speedPct}%</span></div>
          </div>
        </div>

        <!-- Felt temp + pressure row -->
        <div style="display:flex;gap:10px;margin-bottom:10px">
          <div style="flex:1;padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:2px">${icon('thermometer', 12)} Ressenti</div>
            <div style="font-size:18px;font-weight:700;color:${tempColor}">${d.apparentTemp}°C</div>
          </div>
          <div style="flex:1;padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:2px">${icon('gauge', 12)} Pression</div>
            <div style="font-size:18px;font-weight:700;color:${d.pressure < 1000 ? '#60a5fa' : d.pressure > 1025 ? '#f97316' : 'var(--text)'}">${d.pressure} hPa</div>
          </div>
        </div>

        <!-- Detail grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${windArrow} Vent</div>
            <div style="font-size:16px;font-weight:600;${windClass}">${d.windSpeed} km/h</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Direction: ${this._windDirLabel(d.windDirection)} (${d.windDirection}°)</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('rain', 12)} Précipitations</div>
            <div style="font-size:16px;font-weight:600;color:${d.precipitation > 0 ? '#60a5fa' : 'var(--text)'}">${d.precipitation} mm</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('droplet', 12)} Humidité</div>
            ${humBar}
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('cloud', 12)} Nuages (total)</div>
            ${mkCloudBar(d.cloudCover, d.cloudCover > 80 ? '#94a3b8' : '#64748b')}
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('eye', 12)} Visibilité</div>
            <div style="font-size:16px;font-weight:600;color:${d.visibility < 2 ? '#ef4444' : d.visibility < 5 ? '#f97316' : 'var(--text)'}">${d.visibility} km</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('thermometer', 12)} Point de rosée</div>
            <div style="font-size:16px;font-weight:600">${d.dewpoint}°C</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg);border-radius:6px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${icon('sun', 12)} Indice UV</div>
            <div style="font-size:16px;font-weight:600;color:${d.uvIndex >= 8 ? '#ef4444' : d.uvIndex >= 6 ? '#f97316' : d.uvIndex >= 3 ? '#eab308' : '#22c55e'}">${d.uvIndex.toFixed(1)}</div>
          </div>
        </div>

        ${d.live ? `<p style="font-size:10px;color:var(--text3);margin-top:10px">${icon('signal', 12)} Données Open-Meteo • Lat ${this._lastLat.toFixed(2)}° Lon ${this._lastLon.toFixed(2)}° • Rafraîchissement toutes les 5 min</p>` : ''}
      </div>

      <div class="dash-section">
        <h3>${icon('cloud', 16)} Couches de nuages en temps réel</h3>
        <div style="padding:10px;background:var(--bg);border-radius:8px">
          <div style="display:flex;align-items:stretch;gap:12px">
            <!-- Cloud column visualization -->
            <div style="width:60px;display:flex;flex-direction:column;gap:2px;position:relative">
              <div style="flex:1;background:${d.cloudHigh > 50 ? 'rgba(148,163,184,' + (d.cloudHigh/100*0.6+0.1) + ')' : 'rgba(71,85,105,0.15)'};border-radius:4px 4px 0 0;min-height:28px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:9px;color:${d.cloudHigh > 50 ? '#e2e8f0' : '#475569'}">${d.cloudHigh}%</span>
              </div>
              <div style="flex:1;background:${d.cloudMid > 50 ? 'rgba(100,116,139,' + (d.cloudMid/100*0.6+0.1) + ')' : 'rgba(71,85,105,0.15)'};min-height:28px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:9px;color:${d.cloudMid > 50 ? '#e2e8f0' : '#475569'}">${d.cloudMid}%</span>
              </div>
              <div style="flex:1;background:${d.cloudLow > 50 ? 'rgba(71,85,105,' + (d.cloudLow/100*0.6+0.1) + ')' : 'rgba(71,85,105,0.15)'};border-radius:0 0 4px 4px;min-height:28px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:9px;color:${d.cloudLow > 50 ? '#e2e8f0' : '#475569'}">${d.cloudLow}%</span>
              </div>
            </div>
            <!-- Cloud layer details -->
            <div style="flex:1;display:flex;flex-direction:column;gap:6px">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <span style="font-size:11px;font-weight:600;color:#c4b5fd">Nuages hauts (cirrus)</span>
                  <span style="font-size:10px;color:var(--text3)">> 6 km</span>
                </div>
                ${mkCloudBar(d.cloudHigh, '#c4b5fd')}
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <span style="font-size:11px;font-weight:600;color:#94a3b8">Nuages moyens (altostratus)</span>
                  <span style="font-size:10px;color:var(--text3)">2 - 6 km</span>
                </div>
                ${mkCloudBar(d.cloudMid, '#94a3b8')}
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <span style="font-size:11px;font-weight:600;color:#64748b">Nuages bas (stratus)</span>
                  <span style="font-size:10px;color:var(--text3)">< 2 km</span>
                </div>
                ${mkCloudBar(d.cloudLow, '#64748b')}
              </div>
            </div>
          </div>
          ${d.live ? '<div style="font-size:9px;color:var(--text3);margin-top:8px;text-align:right">Données live Open-Meteo</div>' : ''}
        </div>
      </div>

      <div class="dash-section">
        <h3>Impact météo sur la circulation</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:50px 1fr 100px 100px">
            <span></span><span>Condition</span><span>Vitesse</span><span>Statut</span>
          </div>
          ${Object.entries(this._effects).map(([key, e]) => {
            const isActive = key === this.current;
            const pct = Math.round(e.speedMult * 100);
            const reduction = 100 - pct;
            return `<div class="dash-train-row" style="grid-template-columns:50px 1fr 100px 100px;${isActive ? 'background:var(--bg3);border-left:3px solid ' + e.color : ''}">
              <span style="font-size:20px">${icon(e.icon, 20)}</span>
              <span style="${isActive ? 'font-weight:700;color:' + e.color : ''}">${e.label}${reduction > 0 ? ` <span style="font-size:10px;color:var(--text3)">(-${reduction}%)</span>` : ''}</span>
              <span style="color:${pct < 100 ? '#ef4444' : '#22c55e'};font-weight:${isActive ? '700' : '400'}">${pct}%</span>
              <span>${isActive ? '<span style="color:#22c55e;font-size:11px;font-weight:600">● ACTIF</span>' : ''}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>${icon('satellite', 16)} Radar, Nuages & Satellite</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div style="padding:10px;background:var(--bg);border-radius:6px">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px">${icon('radar', 14)} Radar</div>
            <div style="font-size:11px;color:var(--text3)">
              ${this.radarTimestamps.length > 0
                ? `<span style="color:#22c55e">●</span> ${this.radarTimestamps.length} images`
                : '<span style="color:#f97316">●</span> Chargement...'}
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">Précipitations en temps réel</div>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:6px">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px">${icon('cloud', 14)} Nuages</div>
            <div style="font-size:11px;color:var(--text3)">
              ${this.cloudTimestamps?.length > 0
                ? `<span style="color:#22c55e">●</span> Satellite IR`
                : `<span style="color:#3b82f6">●</span> Open-Meteo`}
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">Couverture nuageuse live</div>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:6px">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px">${icon('satellite', 14)} Satellite</div>
            <div style="font-size:11px;color:var(--text3)">
              <span style="color:#22c55e">●</span> ArcGIS
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">Imagerie monde</div>
          </div>
        </div>
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
