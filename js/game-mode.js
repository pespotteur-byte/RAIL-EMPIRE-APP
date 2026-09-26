/**
 * Mode de jeu : « facile » laisse tous les systèmes avancés facultatifs et sans
 * pénalité ; « expert » impose roulements, personnel, entretien en dépôt et IA
 * concurrentes, avec impact réel sur l'exploitation.
 */
/** Usure à partir de laquelle une rame ne peut plus partir sans entretien (mode expert). */
export const DEPOT_BLOCK_WEAR_PCT = 90;
export function normalizeGameMode(v) {
    return v === 'expert' ? 'expert' : 'facile';
}
/** Applique les contraintes du mode : expert force tous les systèmes avancés. */
export function applyGameMode(settings, mode) {
    const m = normalizeGameMode(mode);
    settings.gameMode = m;
    if (m === 'expert') {
        settings.rotationsRequired = true;
        settings.personnelRequired = true;
        settings.depotsRequired = true;
        settings.aiCompetitors = true;
    }
    return settings;
}
export function isExpert(settings) {
    return normalizeGameMode(settings?.gameMode) === 'expert';
}
/**
 * Motif de blocage au départ imposé par l'entretien en dépôt (mode expert /
 * dépôts obligatoires), ou '' si la rame peut circuler.
 */
export function depotDepartureBlock(settings, rame) {
    if (!settings?.depotsRequired || !rame)
        return '';
    if (rame.inMaintenance)
        return 'rame en maintenance au dépôt';
    const wear = Number(rame.wearLevel) || 0;
    if (wear >= DEPOT_BLOCK_WEAR_PCT)
        return `entretien dépôt obligatoire (usure ${Math.round(wear)} %)`;
    return '';
}
