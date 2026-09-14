export function catalogRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value : null;
}
export function industryPatchHost(value) {
    const record = catalogRecord(value);
    if (!record || typeof record.getIndustryTypes !== 'function')
        return null;
    return record;
}
