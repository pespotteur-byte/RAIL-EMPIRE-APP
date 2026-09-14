export {};
declare global {
    interface Error {
        ormTile?: unknown;
        partialStations?: unknown;
        causes?: unknown;
        requiredBytes?: number;
        budgetBytes?: number;
    }
}
