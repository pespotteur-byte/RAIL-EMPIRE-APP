const nonNegative = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value :
    typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
export function syncMaterialMileage(material, train) {
    train.totalKmRun = material.totalKmRun = nonNegative(material.totalKmRun, train.totalKmRun);
    train.kmSinceLastMaint = material.kmSinceLastMaint = nonNegative(material.kmSinceLastMaint, train.kmSinceLastMaint);
    train.wearLevel = material.wearLevel = Math.min(100, nonNegative(material.wearLevel, train.wearLevel));
}
export function advanceMaterialMileage(material, train, distanceKm) {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0)
        return;
    if (material)
        syncMaterialMileage(material, train);
    const source = material || train;
    source.totalKmRun = nonNegative(source.totalKmRun) + distanceKm;
    source.kmSinceLastMaint = nonNegative(source.kmSinceLastMaint) + distanceKm;
    // Increment remaining wear, not mileage/250: lubricant, overhaul and routine
    // servicing deliberately have different effects on these two counters.
    source.wearLevel = Math.min(100, nonNegative(source.wearLevel) + distanceKm / 250);
    if (material)
        syncMaterialMileage(material, train);
}
