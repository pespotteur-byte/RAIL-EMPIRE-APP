/** RC10 gameplay rules, not manufacturer fuel/maintenance specifications. */
type RecordValue = Record<string, unknown>;
type ResourceKey = 'fuelCapacityL' | 'fuelL' | 'sandCapacityKg' | 'sandKg' | 'oilCapacityL' | 'oilL' | 'coolantCapacityL' | 'coolantL' | 'adblueCapacityL' | 'adblueL' | 'gearboxOilCapacityL' | 'gearboxOilL' | 'hydraulicOilCapacityL' | 'hydraulicOilL' | 'washerCapacityL' | 'washerL';
type Consumables = Partial<Record<ResourceKey, number>>;
type Material = {
    totalPower?: number;
    traction?: string;
    totalCapacity?: number;
    consumables?: Consumables;
    cleanliness?: {
        exterior?: unknown;
        interior?: unknown;
    };
    elementDetails?: readonly RecordValue[];
};
type Section = {
    electrified?: unknown;
    voltage?: readonly unknown[];
    frequency?: readonly unknown[];
};
export type ResourceEffects = {
    powerW: number;
    fuelUnits: number;
    poweredUnits: number;
    tractionFactor: number;
    speedCap: number;
    stopReason: string;
    warnings: string[];
};
/** Pure and live: refuelling or a consist edit takes effect on the next tick. */
export declare function materialResourceEffects(rame: Material | null | undefined, section?: Section, weather?: string): ResourceEffects;
/** Consumption follows actual distance and the active traction mode only. */
export declare function consumeMaterialResources(rame: Material | null | undefined, distKm: number, section?: Section): void;
export declare function passengerCleanlinessPenalty(rame: Material | null | undefined): number;
export declare function passengerSatisfactionScore(rame: Material | null | undefined, delayMinutes: unknown, stationBonus: unknown): number;
export {};
