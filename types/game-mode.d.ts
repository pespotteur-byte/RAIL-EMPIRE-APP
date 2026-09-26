/**
 * Mode de jeu : « facile » laisse tous les systèmes avancés facultatifs et sans
 * pénalité ; « expert » impose roulements, personnel, entretien en dépôt et IA
 * concurrentes, avec impact réel sur l'exploitation.
 */
export type GameMode = 'facile' | 'expert';
export type ModeFlags = {
    gameMode?: GameMode | string;
    rotationsRequired?: boolean;
    personnelRequired?: boolean;
    depotsRequired?: boolean;
    aiCompetitors?: boolean;
};
/** Usure à partir de laquelle une rame ne peut plus partir sans entretien (mode expert). */
export declare const DEPOT_BLOCK_WEAR_PCT = 90;
export declare function normalizeGameMode(v: unknown): GameMode;
/** Applique les contraintes du mode : expert force tous les systèmes avancés. */
export declare function applyGameMode<T extends ModeFlags>(settings: T, mode: unknown): T;
export declare function isExpert(settings: ModeFlags | null | undefined): boolean;
/**
 * Motif de blocage au départ imposé par l'entretien en dépôt (mode expert /
 * dépôts obligatoires), ou '' si la rame peut circuler.
 */
export declare function depotDepartureBlock(settings: ModeFlags | null | undefined, rame: {
    wearLevel?: unknown;
    inMaintenance?: unknown;
    name?: unknown;
} | null | undefined): string;
