/** RC19. Navigation changes the viewport/cursor, never the financial values. */
export interface ChartPoint {
    time: string;
    value: number | null;
}
export interface ChartSeries {
    name: string;
    color: string;
    points: readonly ChartPoint[];
}
export interface ChartView {
    start: number;
    end: number;
    cursor: number;
    follow: boolean;
}
export declare function chartWindow(count: number, start: number, end: number): [number, number];
export declare function zoomChartWindow(count: number, start: number, end: number, anchor: number, factor: number): [number, number];
export declare function renderInteractiveChart(canvas: HTMLCanvasElement, series: readonly ChartSeries[], unit: string, view: ChartView, options?: {
    bars?: boolean;
    min?: number;
    max?: number;
}): void;
