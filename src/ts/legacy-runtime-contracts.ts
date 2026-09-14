// Saison 3 migration bridge for legacy Rail Empire runtime objects.
// The historical JS attaches diagnostic metadata directly to arrays/errors.
// Keep that runtime contract explicit while the final Alpha 20 cleanup
// replaces these ad-hoc metadata carriers with dedicated typed structures.
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
