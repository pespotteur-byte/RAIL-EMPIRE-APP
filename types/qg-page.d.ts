import { type FleetRow } from './operations-view-model.js';
export interface HeadquartersData {
    company: string;
    passengers: number;
    freightTonnes: number;
    clock: string;
    rows: FleetRow[];
}
export declare class HeadquartersPage {
    private data;
    private list;
    private timer;
    private search;
    private root;
    private compositions;
    constructor(root: HTMLElement, data: () => HeadquartersData);
    private row;
    refresh(reset?: boolean): void;
    setActive(active: boolean): void;
    dispose(): void;
}
