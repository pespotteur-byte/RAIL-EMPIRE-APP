/** Small read-only contracts: these pages never advance trains or issue network requests. */
export interface TrainPicture {
    elementId?: unknown;
    name?: unknown;
    instanceName?: unknown;
    imageData?: unknown;
    category?: unknown;
    flipped?: unknown;
    length?: unknown;
}
export interface FleetRow {
    id: string;
    name: string;
    number: string;
    category: string;
    state: string;
    speed: number;
    delay: number;
    origin: string;
    destination: string;
    departure: number | null;
    arrival: number | null;
    rameName: string;
    elements: readonly TrainPicture[];
}
export interface BoardRow {
    key: string;
    serviceId: string;
    name: string;
    number: string;
    category: string;
    destination: string;
    origin: string;
    via: readonly string[];
    platform: string;
    plannedMinute: number;
    waitMinute: number;
    delay: number;
    cancelled: boolean;
    state: string;
    reason: string;
    dayOffset: number;
}
/** Cargo statistics already include both generic freight and fulfilled contracts. Never add them twice. */
export declare function transportTotals(economy: {
    totalPassengers?: unknown;
    totalFreightTonnes?: unknown;
}, cargo: {
    totalTonnage?: unknown;
} | null | undefined): {
    passengers: number;
    freightTonnes: number;
};
export declare function clockText(minute: number | null): string;
export declare function trainStatus(state: string, delay: number, speed: number): string;
export declare function safeSprite(value: unknown): string;
export declare function setText(root: HTMLElement, selector: string, text: string): void;
