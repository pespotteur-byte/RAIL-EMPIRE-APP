type JunctionType = 'simple' | 'double' | 'crossing';
type JunctionState = 'normal' | 'reversed' | 'locked';
type Junction = {
    id: string;
    stationId: string;
    name: string;
    type: JunctionType;
    state: JunctionState;
    lastSwitched: number;
};
type Siding = {
    id: string;
    stationId: string;
    name: string;
    capacity: number;
    occupants: string[];
};
import type { World } from './world.js';
import type { RameManager } from './rame.js';
import type { RailEmpire } from './main.js';
export declare class JunctionManager {
    junctions: Junction[];
    sidings: Siding[];
    constructor();
    /**
     * Add a junction/switch at a station.
     */
    addJunction(stationId: unknown, name?: unknown, type?: unknown): Junction | null;
    removeJunction(id: unknown): void;
    /**
     * Add a siding/garage track at a station.
     */
    addSiding(stationId: unknown, name?: unknown, capacity?: unknown): Siding | null;
    removeSiding(id: unknown): void;
    /**
     * Park a rame in a siding.
     */
    parkRame(sidingId: unknown, rameId: unknown): boolean;
    /**
     * Remove a rame from a siding.
     */
    unparkRame(sidingId: unknown, rameId: unknown): boolean;
    /**
     * Switch a junction state.
     */
    switchJunction(junctionId: unknown, newState: unknown): boolean;
    /**
     * Get all junctions for a station.
     */
    getStationJunctions(stationId: unknown): Junction[];
    /**
     * Get all sidings for a station.
     */
    getStationSidings(stationId: unknown): Siding[];
    render(container: HTMLElement, game: RailEmpire): void;
    _renderStationDetail(container: HTMLElement, stationId: unknown, game: RailEmpire): void;
    toSave(): {
        junctions: Junction[];
        sidings: Siding[];
    };
    loadFromSave(s: unknown, world?: World | null, rameManager?: RameManager | null): void;
}
export {};
