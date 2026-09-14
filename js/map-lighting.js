export const GPS_LIGHTING_STORAGE_KEY = 'rail-empire.gps-lighting.v1';
export const NIGHT_LIGHTS_NATIVE_ZOOM = 8;
export const NIGHT_LIGHTS_END_ZOOM = 10;
export const NIGHT_LIGHTS_MAX_OPACITY = 0.30;
export const SATELLITE_NIGHT_TINT = 'rgba(2,8,20,0.48)';
export const OSM_DARK_FILTER = 'invert(90%) hue-rotate(180deg) brightness(82%) contrast(92%) saturate(72%)';
export function normalizeGPSLighting(value) {
    return value === 'day' || value === 'night' ? value : 'auto';
}
export function clockNightAmount(minutes) {
    if (!Number.isFinite(minutes))
        return 0;
    const hour = ((minutes % 1440) + 1440) % 1440 / 60;
    if (hour < 5.5 || hour >= 21)
        return 1;
    if (hour < 7)
        return (7 - hour) / 1.5;
    if (hour >= 19.5)
        return (hour - 19.5) / 1.5;
    return 0;
}
export function resolveGPSLighting(mode, minutes, originalOSM) {
    const selected = normalizeGPSLighting(mode);
    const amount = selected === 'night' ? 1 : selected === 'day' ? 0 : clockNightAmount(minutes);
    const night = amount > 0.45;
    // RC21 contract: Auto preserves an explicitly selected ORIGINAL OSM basemap.
    // A manual Night selection is explicit consent to a local dark style on that same source.
    return { mode: selected, amount, night, mapNight: night && (!originalOSM || selected === 'night') };
}
export function nightLightsOpacity(zoom, enabled, satellite) {
    if (!enabled || !satellite || !Number.isFinite(zoom) || zoom >= NIGHT_LIGHTS_END_ZOOM)
        return 0;
    const t = Math.max(0, Math.min(1, (zoom - NIGHT_LIGHTS_NATIVE_ZOOM) / (NIGHT_LIGHTS_END_ZOOM - NIGHT_LIGHTS_NATIVE_ZOOM)));
    // Smooth fade, zero at z10: no regional pixels stretched at GPS/street zoom.
    return NIGHT_LIGHTS_MAX_OPACITY * (1 - t * t * (3 - 2 * t));
}
export function nightAppearanceLabel(enabled, satellite, zoom) {
    if (!enabled)
        return 'Jour · fond sélectionné';
    if (!satellite)
        return 'Nuit · style sombre local du fond sélectionné';
    return nightLightsOpacity(zoom, enabled, satellite) > 0
        ? 'Nuit régionale · lumières NASA atténuées'
        : 'Nuit détaillée · satellite de jour assombri, sans halos NASA';
}
