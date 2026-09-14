import { type BoardRow } from './operations-view-model.js';
export interface StationBoardData {
    station: string;
    clock: string;
    date: string;
    rows: BoardRow[];
}
export declare class RailEmpireBoard {
    private root;
    private data;
    private list;
    private horizon;
    private active;
    private timer;
    private morePending;
    private request;
    private stationKey;
    private arrivals;
    private search;
    constructor(root: HTMLElement, data: (horizonMinutes: number, arrivals: boolean) => StationBoardData);
    show(stationId: string): void;
    private mode;
    private more;
    private row;
    refresh(reset?: boolean): void;
    setActive(active: boolean): void;
    dispose(): void;
}
