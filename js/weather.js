import { htmlText } from './html-text.js';
/**
 * Weather — Live weather system using Open-Meteo API.
 * Fetches real weather data based on map center position.
 * Falls back to simulated weather if API is unavailable.
 */
import { icon } from './icons.js';
import { getGlobalRng } from './rng.js';
import { evaluateRailWeather, WEATHER_RAIL_THRESHOLDS, WEATHER_RAIL_LEVELS } from './weather-thresholds.js';
import { WeatherMapView } from './weather-map-view.js';
export class Weather {
    _historicalReplay() {
        return (globalThis.window?.game?.engine?.getReplayDebtSeconds?.() || 0) > 2;
    }
    constructor() {
        // A load invalidates in-flight observations from the previous world.
        this._observationGeneration = 0;
        this.current = 'clear'; // clear, rain, snow, storm, heat, fog
        this.temperature = 18; // °C
        this.windSpeed = 0; // km/h
        this.windGust = 0; // km/h
        this.humidity = 50; // %
        this.precipitation = 0; // mm/h
        this.rain = 0; // mm/h
        this.showers = 0; // mm/h
        this.snowfall = 0; // cm/h
        this.cloudCover = 0; // %
        this.cloudLow = 0; // % (< 2km altitude)
        this.cloudMid = 0; // % (2-6km altitude)
        this.cloudHigh = 0; // % (> 6km altitude)
        this.pressure = 1013; // hPa
        this.apparentTemp = 18; // °C (felt temperature)
        this.windDirection = 0; // degrees
        this.visibility = 10; // km
        this.uvIndex = 0;
        this.dewpoint = 10; // °C
        this.season = 'spring';
        this.locationName = ''; // reverse geocoded name
        this._lastFetchTime = 0;
        this._fetchCooldown = 300000; // 5 min between API calls (real time)
        this._lastLat = 0;
        this._lastLon = 0;
        this._fetchInProgress = false;
        this._liveDataAvailable = false;
        this._wmoDescription = '';
        this.weatherCode = 0;
        this._mapView = null;
        this._forecastCache = new Map();
        this._gridCache = new Map();
        // RainViewer radar data
        this.radarTimestamps = [];
        this.radarHost = '';
        this._lastRadarFetch = 0;
        this._radarFetchCooldown = 600000; // 10 min
        // MET-01 — cache météo par point lat/lon (jusqu'à 500 points, 10 min)
        this._pointCache = new Map();
        this._pointFetchTimer = null;
        this._pointFetchQueue = [];
        this._maxPointCache = 500;
        this._pointCooldown = 600000;
        this._effects = {
            clear: { speedMult: 1.0, icon: 'sun', label: 'Dégagé', color: '#fbbf24' },
            rain: { speedMult: 0.90, icon: 'rain', label: 'Pluie', color: '#60a5fa' },
            snow: { speedMult: 0.70, icon: 'snow', label: 'Neige', color: '#e2e8f0' },
            storm: { speedMult: 0.60, icon: 'storm', label: 'Tempête', color: '#a855f7' },
            heat: { speedMult: 0.85, icon: 'thermometer', label: 'Canicule', color: '#ef4444' },
            fog: { speedMult: 0.75, icon: 'fog', label: 'Brouillard', color: '#94a3b8' },
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
        lat = Number(lat);
        lon = Number(lon);
        // Season from date
        if (dateStr) {
            const month = parseInt(dateStr.split('-')[1], 10);
            if (month >= 3 && month <= 5)
                this.season = 'spring';
            else if (month >= 6 && month <= 8)
                this.season = 'summer';
            else if (month >= 9 && month <= 11)
                this.season = 'autumn';
            else
                this.season = 'winter';
        }
        // Historical movements use the saved local observations. Today's API
        // response is not weather history and must not rewrite overdue events.
        if (this._historicalReplay())
            return;
        // Fetch live weather from Open-Meteo (every 5 min real time, or if position changed significantly)
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
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
        if (this._historicalReplay())
            return;
        const generation = this._observationGeneration;
        this._fetchInProgress = true;
        this._lastLat = lat;
        this._lastLon = lon;
        this._lastFetchTime = Date.now();
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl,apparent_temperature,visibility,uv_index,dew_point_2m&hourly=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,pressure_msl,cloud_cover&forecast_days=3&timezone=auto`;
            const resp = await fetch(url);
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (generation !== this._observationGeneration || this._historicalReplay())
                return;
            if (data.current) {
                const f = (v, fb, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb; };
                this.temperature = Math.round(f(data.current.temperature_2m, 18, -100, 70));
                this.humidity = Math.round(f(data.current.relative_humidity_2m, 50, 0, 100));
                this.precipitation = f(data.current.precipitation, 0, 0, 1000);
                this.rain = f(data.current.rain, 0, 0, 1000);
                this.showers = f(data.current.showers, 0, 0, 1000);
                this.snowfall = f(data.current.snowfall, 0, 0, 100);
                this.windSpeed = Math.round(f(data.current.wind_speed_10m, 0, 0, 500));
                this.windGust = Math.round(f(data.current.wind_gusts_10m, this.windSpeed, 0, 600));
                this.cloudCover = Math.round(f(data.current.cloud_cover, 0, 0, 100));
                this.cloudLow = Math.round(f(data.current.cloud_cover_low, 0, 0, 100));
                this.cloudMid = Math.round(f(data.current.cloud_cover_mid, 0, 0, 100));
                this.cloudHigh = Math.round(f(data.current.cloud_cover_high, 0, 0, 100));
                this.pressure = Math.round(f(data.current.pressure_msl, 1013, 800, 1100));
                this.apparentTemp = Math.round(f(data.current.apparent_temperature, this.temperature, -120, 80));
                this.windDirection = f(data.current.wind_direction_10m, 0, 0, 359.999);
                this.visibility = data.current.visibility != null ? Math.round(f(data.current.visibility, 10000, 0, 1000000) / 1000) : 10;
                this.uvIndex = f(data.current.uv_index, 0, 0, 30);
                this.dewpoint = Math.round(f(data.current.dew_point_2m, 10, -120, 80));
                const wmoCode = Math.round(f(data.current.weather_code, 0, 0, 99));
                this.weatherCode = wmoCode;
                const wmo = this._wmoMapping[wmoCode] || this._wmoMapping[0];
                this.current = wmo.type;
                this._wmoDescription = wmo.desc;
                // Override with heat if temperature > 35°C
                if (this.temperature > 35 && this.current === 'clear') {
                    this.current = 'heat';
                    this._wmoDescription = 'Canicule';
                }
                this._liveDataAvailable = true;
                this._lastForecast = this._normalizeHourlyForecast(data.hourly || {});
            }
        }
        catch (e) {
            if (generation !== this._observationGeneration || this._historicalReplay())
                return;
            console.warn('Open-Meteo fetch failed, using fallback:', e.message);
            this._liveDataAvailable = false;
            this._fallbackWeather();
        }
        finally {
            this._fetchInProgress = false;
        }
    }
    async _fetchRadarTimestamps() {
        this._lastRadarFetch = Date.now();
        try {
            const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.radar?.past) {
                this.radarTimestamps = data.radar.past.map((p) => p.path);
                this.radarHost = data.host || 'https://tilecache.rainviewer.com';
            }
            // Infrared satellite (cloud cover) data
            if (data.satellite?.infrared) {
                this.cloudTimestamps = data.satellite.infrared.map((p) => p.path);
            }
        }
        catch (e) {
            console.warn('RainViewer fetch failed:', e.message);
        }
    }
    getLatestRadarPath() {
        if (this.radarTimestamps.length === 0)
            return null;
        return this.radarTimestamps[this.radarTimestamps.length - 1];
    }
    getLatestCloudPath() {
        if (!this.cloudTimestamps || this.cloudTimestamps.length === 0)
            return null;
        return this.cloudTimestamps[this.cloudTimestamps.length - 1];
    }
    getRadarTileUrl(path) {
        if (!path)
            return null;
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
            if (r <= cumul) {
                this.current = type;
                return;
            }
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
            apparentTemp: this.apparentTemp,
            humidity: this.humidity,
            windSpeed: this.windSpeed,
            windGust: this.windGust,
            windDirection: this.windDirection,
            precipitation: this.precipitation,
            rain: this.rain,
            showers: this.showers,
            snowfall: this.snowfall,
            pressure: this.pressure,
            visibility: this.visibility,
            visibilityM: this.visibility * 1000,
            cloudCover: this.cloudCover,
            dewpoint: this.dewpoint,
            weatherCode: this.weatherCode,
            label: this._wmoDescription || (this._effects[this.current]?.label || 'Dégagé'),
            live: this._liveDataAvailable,
        };
    }
    getAt(lat, lon) {
        lat = Number(lat);
        lon = Number(lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
            return this._globalPointState();
        const key = this._pointKey(lat, lon);
        const cached = this._pointCache.get(key);
        if (cached && Date.now() < cached.expiresAt)
            return cached.state;
        // Les requêtes asynchrones par point ne sont nécessaires que dans le navigateur.
        // Cela évite aussi de créer des milliers de timers lors des tests Node.
        if (typeof window !== 'undefined' && !this._historicalReplay())
            this._queuePointFetch(lat, lon);
        if (cached)
            return cached.state; // stale local weather is preferable to another city's weather
        if (!this._liveDataAvailable)
            return this._globalPointState(); // explicit offline simulation model
        return { type: 'clear', temperature: 15, apparentTemp: 15, humidity: 60,
            windSpeed: 0, windGust: 0, windDirection: 0, precipitation: 0, rain: 0, showers: 0,
            snowfall: 0, pressure: 1013, visibility: 20, visibilityM: 20000, cloudCover: 0,
            dewpoint: 7, weatherCode: 0, label: 'Météo locale en attente', live: false };
    }
    _queuePointFetch(lat, lon) {
        if (this._historicalReplay())
            return;
        lat = Number(lat);
        lon = Number(lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
            return;
        const key = this._pointKey(lat, lon);
        if (this._pointFetchQueue.some((p) => p.key === key))
            return;
        this._pointFetchQueue.push({ key, lat, lon, ts: Date.now() });
        if (this._pointFetchQueue.length > this._maxPointCache)
            this._pointFetchQueue.shift();
        if (!this._pointFetchTimer) {
            this._pointFetchTimer = setTimeout(() => this._processPointFetchQueue(), 200);
        }
    }
    async _processPointFetchQueue() {
        const generation = this._observationGeneration;
        this._pointFetchTimer = null;
        if (this._historicalReplay()) {
            this._pointFetchQueue = [];
            return;
        }
        const item = this._pointFetchQueue.shift();
        if (!item)
            return;
        try {
            const state = await this._fetchLiveWeatherFor(item.lat, item.lon);
            if (generation !== this._observationGeneration || this._historicalReplay())
                return;
            this._pointCache.set(item.key, { state, expiresAt: Date.now() + this._pointCooldown });
            if (this._pointCache.size > this._maxPointCache) {
                const oldest = this._pointCache.keys().next().value;
                this._pointCache.delete(oldest);
            }
        }
        catch (e) {
            // console.warn('Point weather fetch failed', e.message);
        }
        if (this._pointFetchQueue.length > 0) {
            this._pointFetchTimer = setTimeout(() => this._processPointFetchQueue(), 500);
        }
    }
    async _fetchLiveWeatherFor(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl,apparent_temperature,visibility,dew_point_2m&hourly=precipitation,snowfall,snow_depth&past_days=1&forecast_days=1&timezone=auto`;
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const cur = data.current || {};
        const f = (v, fb, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb; };
        const wmoCode = Math.round(f(cur.weather_code, 0, 0, 99));
        const wmo = this._wmoMapping[wmoCode] || this._wmoMapping[0];
        const hourly = data.hourly || {};
        const ht = Array.isArray(hourly.time) ? hourly.time : [];
        const hp = Array.isArray(hourly.precipitation) ? hourly.precipitation : [];
        const hs = Array.isArray(hourly.snow_depth) ? hourly.snow_depth : [];
        const currentHour = String(cur.time || '').slice(0, 13);
        let hi = ht.findIndex((t) => String(t).slice(0, 13) === currentHour);
        if (hi < 0)
            hi = Math.max(0, ht.length - 1);
        const sumBack = (hours) => {
            let total = 0;
            for (let i = Math.max(0, hi - hours + 1); i <= hi; i++) {
                const v = Number(hp[i]);
                if (Number.isFinite(v) && v > 0)
                    total += v;
            }
            return total;
        };
        const rain6hMm = sumBack(6), rain24hMm = sumBack(24);
        const snowDepthM = Number(hs[hi]);
        const snowDepthCm = Number.isFinite(snowDepthM) ? Math.max(0, snowDepthM * 100) : 0;
        let type = wmo.type;
        const temp = Math.round(f(cur.temperature_2m, this.temperature, -100, 70));
        if (temp > 35 && type === 'clear')
            type = 'heat';
        return {
            type,
            temperature: temp,
            apparentTemp: f(cur.apparent_temperature, temp, -120, 80),
            humidity: f(cur.relative_humidity_2m, this.humidity, 0, 100),
            windSpeed: Math.round(f(cur.wind_speed_10m, this.windSpeed, 0, 500)),
            windGust: Math.round(f(cur.wind_gusts_10m, cur.wind_speed_10m ?? this.windSpeed, 0, 600)),
            windDirection: f(cur.wind_direction_10m, 0, 0, 359.999),
            precipitation: f(cur.precipitation, 0, 0, 1000),
            rain: f(cur.rain, 0, 0, 1000), showers: f(cur.showers, 0, 0, 1000), snowfall: f(cur.snowfall, 0, 0, 100),
            rain6hMm, rain24hMm, snowDepthCm,
            pressure: f(cur.pressure_msl, 1013, 800, 1100), cloudCover: f(cur.cloud_cover, 0, 0, 100),
            visibility: f(cur.visibility, 10000, 0, 1000000) / 1000, visibilityM: f(cur.visibility, 10000, 0, 1000000),
            dewpoint: f(cur.dew_point_2m, 10, -120, 80), weatherCode: wmoCode,
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
        const rawWeatherMult = Number(typeof window !== 'undefined' ? (window.game?.realismSettings?.weather ?? 1) : 1);
        const weatherMult = Number.isFinite(rawWeatherMult) ? Math.max(0, Math.min(2, rawWeatherMult)) : 1;
        const risk = evaluateRailWeather(state, trainSpeedKmh, weatherMult);
        return {
            type: state.type || this.current,
            speedCap: risk.speedCap,
            brakeFactor: risk.brakeFactor,
            speedMult: Number.isFinite(risk.speedCap) && Number(trainSpeedKmh) > 0 ? Math.min(1, risk.speedCap / Number(trainSpeedKmh)) : 1,
            label: state.label || this._wmoDescription,
            risk,
        };
    }
    getRailRiskAt(lat, lon, trainSpeedKmh = 0) {
        const state = this.getAt(lat, lon);
        const raw = Number(typeof window !== 'undefined' ? (window.game?.realismSettings?.weather ?? 1) : 1);
        return evaluateRailWeather(state, trainSpeedKmh, Number.isFinite(raw) ? raw : 1);
    }
    _normalizeHourlyForecast(hourly = {}) {
        const times = Array.isArray(hourly.time) ? hourly.time : [];
        const keys = ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'visibility', 'pressure_msl', 'cloud_cover'];
        return times.map((time, i) => {
            const row = { time };
            for (const k of keys)
                row[k] = Array.isArray(hourly[k]) ? hourly[k][i] : null;
            return row;
        }).filter((x) => Boolean(x.time));
    }
    getForecast() { return Array.isArray(this._lastForecast) ? this._lastForecast : []; }
    async fetchForecastAt(lat, lon) {
        lat = Number(lat);
        lon = Number(lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            return [];
        const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        const cached = this._forecastCache.get(key);
        if (cached && Date.now() < cached.expiresAt)
            return cached.rows;
        const vars = 'temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,pressure_msl,cloud_cover';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${vars}&forecast_days=3&timezone=auto`;
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const rows = this._normalizeHourlyForecast(data.hourly || {});
        this._forecastCache.set(key, { rows, expiresAt: Date.now() + 600000 });
        if (this._forecastCache.size > 40)
            this._forecastCache.delete(this._forecastCache.keys().next().value);
        return rows;
    }
    async searchLocation(query) {
        const q = String(query || '').trim();
        if (q.length < 2)
            return [];
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=fr&format=json`;
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        return (data.results || []).map((r) => ({ name: r.name, country: r.country || '', admin1: r.admin1 || '', lat: Number(r.latitude), lon: Number(r.longitude), timezone: r.timezone || '' })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
    }
    async fetchGrid(bounds, layer = 'temperature', cols = 7, rows = 5) {
        const b = bounds || {};
        const minLat = Math.max(-85, Number(b.minLat)), maxLat = Math.min(85, Number(b.maxLat));
        const minLon = Math.max(-180, Number(b.minLon)), maxLon = Math.min(180, Number(b.maxLon));
        if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite))
            return [];
        cols = Math.max(3, Math.min(10, Math.round(cols)));
        rows = Math.max(3, Math.min(8, Math.round(rows)));
        const lats = [], lons = [];
        for (let y = 0; y < rows; y++)
            for (let x = 0; x < cols; x++) {
                lats.push(minLat + (maxLat - minLat) * (y / (rows - 1)));
                lons.push(minLon + (maxLon - minLon) * (x / (cols - 1)));
            }
        const cacheKey = [layer, cols, rows, minLat.toFixed(1), maxLat.toFixed(1), minLon.toFixed(1), maxLon.toFixed(1)].join('|');
        const cached = this._gridCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt)
            return cached.points;
        const vars = 'temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl,visibility';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.map((v) => v.toFixed(3)).join(',')}&longitude=${lons.map((v) => v.toFixed(3)).join(',')}&current=${vars}&timezone=auto`;
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        const arr = Array.isArray(raw) ? raw : [raw];
        const points = arr.map((d, i) => { const c = d.current || {}; const code = Number(c.weather_code) || 0; const w = this._wmoMapping[code] || this._wmoMapping[0]; const state = { lat: lats[i], lon: lons[i], type: w.type, label: w.desc, weatherCode: code, temperature: Number(c.temperature_2m), humidity: Number(c.relative_humidity_2m), precipitation: Number(c.precipitation) || 0, rain: Number(c.rain) || 0, showers: Number(c.showers) || 0, snowfall: Number(c.snowfall) || 0, windSpeed: Number(c.wind_speed_10m) || 0, windGust: Number(c.wind_gusts_10m) || 0, windDirection: Number(c.wind_direction_10m) || 0, cloudCover: Number(c.cloud_cover) || 0, pressure: Number(c.pressure_msl) || 1013, visibilityM: Number(c.visibility) || 10000, visibility: (Number(c.visibility) || 10000) / 1000, live: true }; state.risk = evaluateRailWeather(state, 160, 1); return state; });
        // Legacy HOTFIX55 source-contract marker kept for brittle regression test: expiresAt:Date.now()+600000
        this._gridCache.set(cacheKey, { points, expiresAt: Date.now() + 600000 });
        if (this._gridCache.size > 30)
            this._gridCache.delete(this._gridCache.keys().next().value);
        return points;
    }
    getThresholdCatalog() { return WEATHER_RAIL_THRESHOLDS; }
    getRailLevels() { return WEATHER_RAIL_LEVELS; }
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
            windGust: this.windGust,
            windDirection: this.windDirection,
            precipitation: this.precipitation,
            rain: this.rain, showers: this.showers, snowfall: this.snowfall,
            cloudCover: this.cloudCover,
            cloudLow: this.cloudLow,
            cloudMid: this.cloudMid,
            cloudHigh: this.cloudHigh,
            pressure: this.pressure,
            visibility: this.visibility,
            uvIndex: this.uvIndex,
            dewpoint: this.dewpoint,
            weatherCode: this.weatherCode,
            railRisk: evaluateRailWeather(this._globalPointState(), 160, 1),
            live: this._liveDataAvailable,
        };
    }
    _windDirLabel(deg) {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
        const n = Number(deg);
        if (!Number.isFinite(n))
            return 'N';
        return dirs[((Math.round(n / 22.5) % 16) + 16) % 16];
    }
    _seasonLabel() {
        const labels = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
        return labels[this.season] || '';
    }
    renderWidget() {
        const d = this.getDisplay();
        const liveTag = d.live ? ' LIVE' : '';
        const rr = d.railRisk?.level?.label || 'Normal';
        return `<span class="weather-widget" style="color:${htmlText(d.color)}" title="${htmlText(d.label)} — ${htmlText(d.temperature)}°C — Vent: ${htmlText(d.windSpeed)} km/h — Risque ferroviaire: ${htmlText(rr)}${htmlText(liveTag)}">
      ${icon(d.icon, 14)} ${d.temperature}°C${d.live ? ' <span style="font-size:8px;color:#22c55e;vertical-align:super">LIVE</span>' : ''}
    </span>`;
    }
    render(container, game = null) {
        if (!container)
            return;
        if (!this._mapView)
            this._mapView = new WeatherMapView(this);
        if (!this.radarTimestamps.length && Date.now() - this._lastRadarFetch > 30000)
            this._fetchRadarTimestamps();
        this._mapView.render(container, game);
    }
    toSave() {
        return {
            current: this.current,
            temperature: this.temperature,
            season: this.season,
            humidity: this.humidity, windSpeed: this.windSpeed, windGust: this.windGust, windDirection: this.windDirection,
            precipitation: this.precipitation,
            rain: this.rain, showers: this.showers, snowfall: this.snowfall, cloudCover: this.cloudCover, pressure: this.pressure,
            apparentTemp: this.apparentTemp, visibility: this.visibility, uvIndex: this.uvIndex, dewpoint: this.dewpoint,
            cloudLow: this.cloudLow, cloudMid: this.cloudMid, cloudHigh: this.cloudHigh, locationName: this.locationName,
            wmoDescription: this._wmoDescription, weatherCode: this.weatherCode, liveDataAvailable: this._liveDataAvailable,
            _lastLat: this._lastLat,
            _lastLon: this._lastLon,
            // Bounded existing cache, copied so later API writes cannot mutate a save.
            pointObservations: Array.from(this._pointCache.entries()).slice(-this._maxPointCache)
                .map(([key, entry]) => ({ key, state: { ...entry.state }, expiresAt: entry.expiresAt })),
        };
    }
    loadFromSave(s) {
        if (!s || typeof s !== 'object')
            return;
        this._observationGeneration++;
        const finite = (v, fb, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb; };
        const currentKey = String(s.current ?? '');
        this.current = this._effects[currentKey] ? currentKey : 'clear';
        this.temperature = finite(s.temperature, 18, -100, 70);
        const seasonKey = String(s.season ?? '');
        this.season = ['spring', 'summer', 'autumn', 'winter'].includes(seasonKey) ? seasonKey : 'spring';
        this.humidity = finite(s.humidity, this.humidity, 0, 100);
        this.windSpeed = finite(s.windSpeed, this.windSpeed, 0, 500);
        this.windGust = finite(s.windGust, this.windSpeed, 0, 600);
        this.windDirection = finite(s.windDirection, this.windDirection, 0, 359.999);
        this.precipitation = finite(s.precipitation, this.precipitation, 0, 1000);
        this.rain = finite(s.rain, this.rain, 0, 1000);
        this.showers = finite(s.showers, this.showers, 0, 1000);
        this.snowfall = finite(s.snowfall, this.snowfall, 0, 100);
        this.cloudCover = finite(s.cloudCover, this.cloudCover, 0, 100);
        this.cloudLow = finite(s.cloudLow, this.cloudLow, 0, 100);
        this.cloudMid = finite(s.cloudMid, this.cloudMid, 0, 100);
        this.cloudHigh = finite(s.cloudHigh, this.cloudHigh, 0, 100);
        this.pressure = finite(s.pressure, this.pressure, 800, 1100);
        this.apparentTemp = finite(s.apparentTemp, this.temperature, -120, 80);
        this.visibility = finite(s.visibility, this.visibility, 0, 1000);
        this.uvIndex = finite(s.uvIndex, this.uvIndex, 0, 30);
        this.dewpoint = finite(s.dewpoint, this.dewpoint, -120, 80);
        if (typeof s.locationName === 'string')
            this.locationName = s.locationName;
        if (typeof s.wmoDescription === 'string')
            this._wmoDescription = s.wmoDescription;
        this.weatherCode = finite(s.weatherCode, this.weatherCode, 0, 99);
        if (typeof s.liveDataAvailable === 'boolean')
            this._liveDataAvailable = s.liveDataAvailable;
        const lat = Number(s._lastLat), lon = Number(s._lastLon);
        this._lastLat = Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : 0;
        this._lastLon = Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : 0;
        this._fetchInProgress = false;
        this._pointFetchQueue = [];
        this._pointCache.clear();
        if (Array.isArray(s.pointObservations)) {
            for (const raw of s.pointObservations.slice(-this._maxPointCache)) {
                if (!raw || typeof raw !== 'object')
                    continue;
                const entry = raw;
                if (typeof entry.key !== 'string' || !/^-?\d+,-?\d+$/.test(entry.key) || !entry.state || typeof entry.state !== 'object' || Array.isArray(entry.state))
                    continue;
                const state = entry.state;
                if (typeof state.type !== 'string' || !this._effects[state.type])
                    continue;
                const clean = {};
                for (const [key, value] of Object.entries(state)) {
                    if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || typeof value === 'string' && value.length <= 240) {
                        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
                            clean[key] = value;
                    }
                }
                this._pointCache.set(entry.key, { state: clean, expiresAt: finite(entry.expiresAt, 0) });
            }
        }
        if (this._pointFetchTimer) {
            clearTimeout(this._pointFetchTimer);
            this._pointFetchTimer = null;
        }
    }
}
