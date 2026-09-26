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
    private onExport?;
    private list;
    private timer;
    private search;
    private root;
    private compositions;
    constructor(root: HTMLElement, data: () => HeadquartersData, onExport?: ((days: number) => void) | undefined);
    private row;
    refresh(reset?: boolean): void;
    setActive(active: boolean): void;
    dispose(): void;
}
