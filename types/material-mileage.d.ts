/** The material is authoritative; a prepared service only mirrors its counters.
 * Workshop reductions must never be undone by an older service snapshot. */
export interface MaterialMileage {
    totalKmRun?: number;
    kmSinceLastMaint?: number;
    wearLevel?: number;
}
export declare function syncMaterialMileage(material: MaterialMileage, train: MaterialMileage): void;
export declare function advanceMaterialMileage(material: MaterialMileage | null | undefined, train: MaterialMileage, distanceKm: number): void;
