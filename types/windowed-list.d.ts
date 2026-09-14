/** RC24 — native scrolling; only visible rows have DOM/images. No wheel interception or carousel. */
export interface WindowRange {
    start: number;
    end: number;
    top: number;
    bottom: number;
}
export declare function windowRange(count: number, top: number, height: number, rowHeight: number, overscan?: number): WindowRange;
export declare class WindowedList<T> {
    readonly host: HTMLElement;
    readonly rowHeight: number;
    private key;
    private render;
    private nearEnd?;
    private rows;
    private nodes;
    private top;
    private body;
    private bottom;
    private frame;
    private disposed;
    private lastScrollTop;
    private resize;
    private scroll;
    constructor(host: HTMLElement, rowHeight: number, key: (row: T) => string, render: (row: T, existing: HTMLElement | undefined) => HTMLElement, nearEnd?: (() => void) | undefined);
    setRows(rows: readonly T[], reset?: boolean): void;
    refresh(): void;
    private draw;
    dispose(): void;
}
