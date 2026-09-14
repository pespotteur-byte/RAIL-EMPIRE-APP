export const WEATHER_RAIL_LEVELS = [
    { id: 'normal', label: 'Normal', rank: 0, color: '#22c55e' },
    { id: 'watch', label: 'Vigilance', rank: 1, color: '#eab308' },
    { id: 'degraded', label: 'Dégradé', rank: 2, color: '#f97316' },
    { id: 'severe', label: 'Sévère', rank: 3, color: '#ef4444' },
    { id: 'extreme', label: 'Extrême', rank: 4, color: '#a855f7' },
];
export const WEATHER_RAIL_THRESHOLDS = {
    wind_kmh: {
        label: 'Vent moyen', unit: 'km/h', direction: 'high',
        bands: [50, 70, 90, 110],
        effects: ['Surveillance', 'Adhérence/objets légers', 'Risque obstacle + restriction', 'Risque fort obstacle/caténaire'],
    },
    gust_kmh: {
        label: 'Rafales', unit: 'km/h', direction: 'high',
        bands: [60, 80, 100, 120],
        effects: ['Surveillance', 'Risque objets/arbre', 'Restriction possible', 'Interruption possible'],
    },
    visibility_m: {
        label: 'Visibilité', unit: 'm', direction: 'low',
        bands: [2000, 1000, 500, 200],
        effects: ['Surveillance', 'Freinage anticipé', 'Restriction visibilité', 'Restriction forte'],
    },
    precipitation_mmh: {
        label: 'Précipitations', unit: 'mm/h', direction: 'high',
        bands: [1, 4, 10, 25],
        effects: ['Rail humide', 'Adhérence dégradée', 'Risque ruissellement', 'Risque inondation'],
    },
    precipitation_6h_mm: {
        label: 'Cumul pluie 6 h', unit: 'mm', direction: 'high',
        bands: [15, 30, 50, 80],
        effects: ['Sol humide', 'Ruissellement', 'Risque inondation', 'Risque inondation/coulée'],
    },
    precipitation_24h_mm: {
        label: 'Cumul pluie 24 h', unit: 'mm', direction: 'high',
        bands: [30, 60, 100, 150],
        effects: ['Sol saturé', 'Ruissellement', 'Risque inondation/glissement', 'Risque majeur'],
    },
    snowfall_cmh: {
        label: 'Neige', unit: 'cm/h', direction: 'high',
        bands: [0.2, 1, 3, 6],
        effects: ['Surveillance', 'Adhérence dégradée', 'Aiguillages/roulement', 'Restriction forte'],
    },
    snow_depth_cm: {
        label: 'Neige au sol', unit: 'cm', direction: 'high',
        bands: [2, 5, 15, 30],
        effects: ['Surveillance', 'Accumulation', 'Aiguillages/organes', 'Blocages possibles'],
    },
    temperature_high_c: {
        label: 'Chaleur', unit: '°C', direction: 'high',
        bands: [30, 35, 40, 45],
        effects: ['Surveillance', 'Risque dilatation', 'Risque voie/caténaire', 'Conditions extrêmes'],
    },
    temperature_low_c: {
        label: 'Froid', unit: '°C', direction: 'low',
        bands: [0, -5, -12, -20],
        effects: ['Gel possible', 'Givre/organes', 'Aiguillages/caténaire', 'Conditions extrêmes'],
    },
};
function bandLevel(value, cfg) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 0;
    if (cfg.direction === 'low') {
        let rank = 0;
        for (let i = 0; i < cfg.bands.length; i++)
            if (n <= cfg.bands[i])
                rank = i + 1;
        return rank;
    }
    let rank = 0;
    for (let i = 0; i < cfg.bands.length; i++)
        if (n >= cfg.bands[i])
            rank = i + 1;
    return rank;
}
function metric(id, value, extra = {}) {
    const cfg = WEATHER_RAIL_THRESHOLDS[id];
    const rank = bandLevel(value, cfg);
    return { id, value, rank, level: WEATHER_RAIL_LEVELS[rank], ...extra };
}
/**
 * Évalue les risques et retourne les impacts ferroviaires applicables.
 * Les caps sont volontairement progressifs : pas de pénalité sur une météo simplement "mauvaise".
 */
export function evaluateRailWeather(state = {}, trainSpeedKmh = 0, realism = 1) {
    const mult = Math.max(0, Math.min(2, Number(realism) || 0));
    const precip = Math.max(0, Number(state.precipitation ?? state.rain ?? 0) || 0);
    const snow = Math.max(0, Number(state.snowfall ?? 0) || 0);
    const rain6 = Math.max(0, Number(state.rain6hMm ?? state.precipitation6h ?? 0) || 0);
    const rain24 = Math.max(0, Number(state.rain24hMm ?? state.precipitation24h ?? 0) || 0);
    const snowDepth = Math.max(0, Number(state.snowDepthCm ?? 0) || 0);
    const wind = Math.max(0, Number(state.windSpeed ?? 0) || 0);
    const gust = Math.max(wind, Number(state.windGust ?? wind) || 0);
    const visM = Math.max(0, Number(state.visibilityM ?? ((Number(state.visibility) || 10) * 1000)) || 10000);
    const temp = Number(state.temperature);
    const metrics = [
        metric('wind_kmh', wind), metric('gust_kmh', gust), metric('visibility_m', visM),
        metric('precipitation_mmh', precip), metric('precipitation_6h_mm', rain6), metric('precipitation_24h_mm', rain24),
        metric('snowfall_cmh', snow), metric('snow_depth_cm', snowDepth),
    ];
    if (Number.isFinite(temp)) {
        metrics.push(metric('temperature_high_c', temp));
        metrics.push(metric('temperature_low_c', temp));
    }
    // WMO severe phenomena can promote the risk independently of raw gauges.
    const code = Number(state.weatherCode ?? 0);
    let forcedRank = 0;
    const tags = [];
    if ([95, 96, 99].includes(code)) {
        forcedRank = Math.max(forcedRank, 3);
        tags.push('Orage');
    }
    if ([56, 57, 66, 67].includes(code)) {
        forcedRank = Math.max(forcedRank, 3);
        tags.push('Pluie verglaçante');
    }
    if (code === 48) {
        forcedRank = Math.max(forcedRank, 2);
        tags.push('Brouillard givrant');
    }
    if ([82, 86].includes(code)) {
        forcedRank = Math.max(forcedRank, 3);
        tags.push('Averses violentes');
    }
    let rank = Math.max(forcedRank, ...metrics.map(m => m.rank));
    rank = Math.max(0, Math.min(4, rank));
    let brakeFactor = 1;
    let speedCap = Infinity;
    const reasons = [];
    // Adhérence/freinage. Le réalisme module l'intensité, pas le seuil météo.
    if (precip >= 1 || state.type === 'rain') {
        const base = precip >= 25 ? 0.68 : precip >= 10 ? 0.76 : precip >= 4 ? 0.84 : (state.type === 'rain' ? 0.92 : 0.93);
        brakeFactor = Math.min(brakeFactor, 1 - (1 - base) * mult);
        reasons.push(`pluie ${precip.toFixed(1)} mm/h`);
    }
    if (snow >= 0.2 || state.type === 'snow' || [71, 73, 75, 77, 85, 86].includes(code)) {
        const base = snow >= 6 ? 0.50 : snow >= 3 ? 0.58 : snow >= 1 ? 0.66 : (state.type === 'snow' ? 0.55 : 0.78);
        brakeFactor = Math.min(brakeFactor, 1 - (1 - base) * mult);
        if (Number(trainSpeedKmh) >= 140)
            speedCap = Math.min(speedCap, Math.max(80, Number(trainSpeedKmh) - 20 * mult));
        reasons.push(`neige ${snow.toFixed(1)} cm/h`);
    }
    if (visM <= 1000 || state.type === 'fog') {
        const base = visM <= 200 ? 0.68 : visM <= 500 ? 0.78 : (state.type === 'fog' ? 0.85 : 0.88);
        brakeFactor = Math.min(brakeFactor, 1 - (1 - base) * mult);
        if (visM <= 200)
            speedCap = Math.min(speedCap, Math.max(40, 120 - 30 * mult));
        else if (visM <= 500)
            speedCap = Math.min(speedCap, Math.max(60, 160 - 20 * mult));
        reasons.push(`visibilité ${Math.round(visM)} m`);
    }
    if (gust >= 100)
        speedCap = Math.min(speedCap, Math.max(60, 120 - 20 * mult));
    if (gust >= 120)
        speedCap = Math.min(speedCap, Math.max(30, 80 - 20 * mult));
    if ([95, 96, 99, 82].includes(code) || state.type === 'storm')
        brakeFactor = Math.min(brakeFactor, 1 - (1 - 0.60) * mult);
    if ([56, 57, 66, 67].includes(code)) {
        brakeFactor = Math.min(brakeFactor, 1 - (1 - 0.45) * mult);
        speedCap = Math.min(speedCap, Math.max(30, 80 - 20 * mult));
    }
    // Incidents potentials: consommés par le moteur d'incidents lors de ses tirages.
    // Les cumuls 6 h / 24 h évitent qu'une averse brève soit traitée comme une crue durable.
    const freezingRain = [56, 57, 66, 67].includes(code);
    const thunderstorm = [95, 96, 99].includes(code);
    const floodNow = precip >= 10 ? Math.min(1, (precip - 8) / 35) : 0;
    const flood6 = rain6 >= 30 ? Math.min(1, (rain6 - 20) / 60) : 0;
    const flood24 = rain24 >= 60 ? Math.min(1, (rain24 - 40) / 110) : 0;
    const hazards = {
        obstacle: gust >= 80 ? Math.min(1, (gust - 70) / 70) : 0,
        catenary: gust >= 90 || freezingRain || (temp <= -5 && (precip > 0 || snow > 0))
            ? Math.min(1, Math.max((gust - 80) / 70, freezingRain ? 0.85 : 0, Number.isFinite(temp) ? (0 - temp) / 35 : 0)) : 0,
        flooding: Math.max(floodNow, flood6, flood24),
        switchFreeze: Number.isFinite(temp) && temp <= 0 && (precip > 0 || snow > 0 || snowDepth >= 5 || Number(state.humidity) >= 85)
            ? Math.min(1, Math.max((-temp + 2) / 20, snow / 6, snowDepth / 30, freezingRain ? 0.9 : 0)) : 0,
        heatTrack: Number.isFinite(temp) && temp >= 35 ? Math.min(1, (temp - 33) / 17) : 0,
        stormSignal: thunderstorm ? Math.min(1, 0.65 + Math.max(0, gust - 80) / 120) : 0,
        landslide: (precip >= 25 || rain6 >= 50 || rain24 >= 100) ? Math.min(1, Math.max((precip - 15) / 35, (rain6 - 35) / 70, (rain24 - 70) / 120)) : 0,
        snowBlockage: (snow >= 3 || snowDepth >= 15) ? Math.min(1, Math.max((snow - 1) / 6, (snowDepth - 5) / 30)) : 0,
        rollingStock: Math.min(1, Math.max(Number.isFinite(temp) && temp >= 40 ? (temp - 37) / 15 : 0, Number.isFinite(temp) && temp <= -12 ? (-temp - 8) / 25 : 0, snow >= 3 ? snow / 8 : 0, freezingRain ? 0.85 : 0)),
    };
    return {
        rank, level: WEATHER_RAIL_LEVELS[rank], metrics, tags, reasons,
        brakeFactor: Math.max(0.1, Math.min(1, brakeFactor)), speedCap,
        hazards,
    };
}
