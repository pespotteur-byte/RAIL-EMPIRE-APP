/** Presentation-only lighting. Never changes the simulation clock or weather.
 * NASA VIIRS/Black Marble is coarse regional radiance, not street-level night photography.
 * At close zoom we preserve the detailed basemap instead of magnifying its light halos.
 */
export type GPSLightingMode = 'auto' | 'day' | 'night';
export declare const GPS_LIGHTING_STORAGE_KEY = "rail-empire.gps-lighting.v1";
export declare const NIGHT_LIGHTS_NATIVE_ZOOM = 8;
export declare const NIGHT_LIGHTS_END_ZOOM = 10;
export declare const NIGHT_LIGHTS_MAX_OPACITY = 0.3;
export declare const SATELLITE_NIGHT_TINT = "rgba(2,8,20,0.48)";
export declare const OSM_DARK_FILTER = "invert(90%) hue-rotate(180deg) brightness(82%) contrast(92%) saturate(72%)";
export declare function normalizeGPSLighting(value: unknown): GPSLightingMode;
export declare function clockNightAmount(minutes: number): number;
export declare function resolveGPSLighting(mode: unknown, minutes: number, originalOSM: boolean): {
    mode: GPSLightingMode;
    amount: number;
    night: boolean;
    mapNight: boolean;
};
export declare function nightLightsOpacity(zoom: number, enabled: boolean, satellite: boolean): number;
export declare function nightAppearanceLabel(enabled: boolean, satellite: boolean, zoom: number): string;
