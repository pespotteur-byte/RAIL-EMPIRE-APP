import type { RailWeatherEvaluation } from './weather-thresholds.js';
import type { Weather } from './weather.js';
import type { TileMap as TileMapType } from './map.js';
import type { RailEmpire } from './main.js';
type WeatherPoint = {
    [key: string]: unknown;
    lat?: number;
    lon?: number;
    type?: string;
    label?: string;
    temperature?: number;
    apparentTemp?: number;
    humidity?: number;
    windSpeed?: number;
    windGust?: number;
    windDirection?: number;
    precipitation?: number;
    rain6hMm?: number;
    rain24hMm?: number;
    snowfall?: number;
    snowDepthCm?: number;
    visibility?: number;
    visibilityM?: number;
    pressure?: number;
    cloudCover?: number;
    weatherCode?: number;
    risk?: RailWeatherEvaluation;
};
type WeatherGridPoint = WeatherPoint & {
    lat: number;
    lon: number;
    windSpeed: number;
};
type DragState = {
    x: number;
    y: number;
    moved: boolean;
};
type WeatherCanvas = HTMLCanvasElement & {
    _weatherDpr?: number;
};
export declare class WeatherMapView {
    weather: Weather;
    map: TileMapType;
    layer: string;
    grid: WeatherGridPoint[];
    gridLoading: boolean;
    selected: WeatherPoint | null;
    forecast: ForecastRow[];
    _token: number;
    _gridTimer: ReturnType<typeof setTimeout> | null;
    _drag: DragState | null;
    _game: RailEmpire | null;
    constructor(weather: Weather);
    render(container: HTMLElement, game?: RailEmpire | null): void;
    _wire(container: HTMLElement, canvas: WeatherCanvas, token: number): void;
    _resize(canvas: WeatherCanvas): void;
    _drawLoop(container: HTMLElement, canvas: WeatherCanvas, token: number): void;
    _drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void;
    _drawTrains(ctx: CanvasRenderingContext2D, w: number, h: number): void;
    _bounds(canvas: WeatherCanvas): {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    };
    _scheduleGrid(container: HTMLElement, delay?: number): void;
    _loadGrid(container: HTMLElement): Promise<void>;
    _inspectPoint(container: HTMLElement, lat: number, lon: number, title: string): Promise<void>;
    _pointHtml(s: WeatherPoint, lat: number, lon: number, title: string): string;
    _forecastHtml(rows: __S3Struct90): string;
    _thresholdHtml(): string;
    _updateLegend(container: HTMLElement): void;
}
type ForecastRow = {
    time: string | number | Date;
    temperature_2m?: unknown;
    precipitation?: unknown;
    wind_gusts_10m?: unknown;
};
type __S3Struct90 = ForecastRow[];
export {};
