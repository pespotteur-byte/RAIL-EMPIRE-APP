/**
 * HOTFIX55 — catalogue unique des seuils météo ferroviaires.
 * L'UI et le moteur des trains utilisent exactement cette table.
 */
export interface WeatherRailLevel {
    id: string;
    label: string;
    rank: number;
    color: string;
}
export type WeatherThresholdDirection = 'high' | 'low';
export interface WeatherThreshold {
    label: string;
    unit: string;
    direction: WeatherThresholdDirection;
    bands: number[];
    effects: string[];
}
export interface RailWeatherState {
    [key: string]: unknown;
    precipitation?: number;
    rain?: number;
    snowfall?: number;
    rain6hMm?: number;
    precipitation6h?: number;
    rain24hMm?: number;
    precipitation24h?: number;
    snowDepthCm?: number;
    windSpeed?: number;
    windGust?: number;
    visibilityM?: number;
    visibility?: number;
    temperature?: number;
    weatherCode?: number;
    humidity?: number;
    type?: string;
}
export interface RailWeatherMetric {
    id: string;
    value: unknown;
    rank: number;
    level: WeatherRailLevel;
    [key: string]: unknown;
}
export interface RailWeatherEvaluation {
    rank: number;
    level: WeatherRailLevel;
    metrics: RailWeatherMetric[];
    tags: string[];
    reasons: string[];
    brakeFactor: number;
    speedCap: number;
    hazards: Record<string, number>;
}
export declare const WEATHER_RAIL_LEVELS: WeatherRailLevel[];
export declare const WEATHER_RAIL_THRESHOLDS: Record<string, WeatherThreshold>;
/**
 * Évalue les risques et retourne les impacts ferroviaires applicables.
 * Les caps sont volontairement progressifs : pas de pénalité sur une météo simplement "mauvaise".
 */
export declare function evaluateRailWeather(state?: RailWeatherState, trainSpeedKmh?: number, realism?: number): RailWeatherEvaluation;
