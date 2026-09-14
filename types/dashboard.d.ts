import { type ChartPoint } from './dashboard-chart.js';
type __KPM10 = unknown[];
type __KPM19 = {
    "punctualityHistory": unknown;
    "revenueHistory": unknown;
    "passengerHistory": unknown;
    "kmHistory": unknown;
    expenseHistory?: unknown;
    lastRecordBucket?: unknown;
};
import type { RailEmpire } from './main.js';
export declare class Dashboard {
    maxEntries: number;
    expenseHistory: ChartPoint[];
    private _chartViews;
    private _financeView;
    private _chart;
    punctualityHistory: Array<{
        time: string;
        value: number;
    }>;
    revenueHistory: Array<{
        time: string;
        value: number;
    }>;
    passengerHistory: Array<{
        time: string;
        value: number;
    }>;
    kmHistory: Array<{
        time: string;
        value: number;
    }>;
    _lastRecordTime: number;
    _canvasCache: Record<string, unknown>;
    constructor();
    /**
     * Record a snapshot of current game stats (called every 5 in-game minutes).
     */
    record(game: RailEmpire): void;
    _push(arr: __KPM10, entry: unknown): void;
    /**
     * Render the dashboard page into the container element.
     */
    render(container: HTMLElement, game: RailEmpire): void;
    /**
     * X — arrondi au 0,1 près pour les graphiques.
     */
    _fmt(n: number): string;
    /**
     * BUG-11 / responsive : ajuste le canevas à la taille CSS réelle (DPR).
     */
    _fitCanvas(canvas: HTMLCanvasElement): {
        ctx: CanvasRenderingContext2D;
        W: number;
        H: number;
        dpr: number;
    };
    /**
     * Draw a simple line chart on a canvas element.
     */
    _drawLineChart(canvasId: string, data: Array<{
        time: string;
        value: number;
    }>, unit: string, color: string, fixedMin?: number | undefined, fixedMax?: number | undefined): void;
    _drawHorizontalBar(canvasId: string, data: Array<{
        label: string;
        value: number;
        color: string;
    }>): void;
    _drawBarChart(canvasId: string, data: Array<{
        label: string;
        value: number;
    }>, unit: string): void;
    toSave(): {
        punctualityHistory: {
            time: string;
            value: number;
        }[];
        revenueHistory: {
            time: string;
            value: number;
        }[];
        expenseHistory: {
            time: string;
            value: number | null;
        }[];
        lastRecordBucket: number;
        passengerHistory: {
            time: string;
            value: number;
        }[];
        kmHistory: {
            time: string;
            value: number;
        }[];
    };
    loadFromSave(s: __KPM19): void;
}
export {};
