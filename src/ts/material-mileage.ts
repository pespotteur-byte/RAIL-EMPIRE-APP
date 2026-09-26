/** The material is authoritative; a prepared service only mirrors its counters.
 * Workshop reductions must never be undone by an older service snapshot. */
export interface MaterialMileage {
  totalKmRun?: number;
  kmSinceLastMaint?: number;
  wearLevel?: number;
}
/** 100 % d'usure atteints après 50 000 km sans entretien. */
export const WEAR_FULL_KM = 50000;
export const WEAR_KM_PER_PERCENT = WEAR_FULL_KM / 100;
const nonNegative = (value: unknown, fallback: unknown = 0): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value :
  typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
export function syncMaterialMileage(material: MaterialMileage, train: MaterialMileage): void {
  train.totalKmRun = material.totalKmRun = nonNegative(material.totalKmRun, train.totalKmRun);
  train.kmSinceLastMaint = material.kmSinceLastMaint = nonNegative(material.kmSinceLastMaint, train.kmSinceLastMaint);
  train.wearLevel = material.wearLevel = Math.min(100, nonNegative(material.wearLevel, train.wearLevel));
}
export function advanceMaterialMileage(material: MaterialMileage | null | undefined, train: MaterialMileage, distanceKm: number): void {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return;
  if (material) syncMaterialMileage(material, train);
  const source = material || train;
  source.totalKmRun = nonNegative(source.totalKmRun) + distanceKm;
  source.kmSinceLastMaint = nonNegative(source.kmSinceLastMaint) + distanceKm;
  // Increment remaining wear, not mileage/WEAR_KM_PER_PERCENT: lubricant, overhaul
  // and routine servicing deliberately have different effects on these two counters.
  source.wearLevel = Math.min(100, nonNegative(source.wearLevel) + distanceKm / WEAR_KM_PER_PERCENT);
  if (material) syncMaterialMileage(material, train);
}
