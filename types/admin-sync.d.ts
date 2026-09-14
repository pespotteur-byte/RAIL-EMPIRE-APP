type CatalogEntry = Record<string, unknown> & {
    id?: unknown;
};
type AdminIncidentEffect = 'speed_reduction' | 'extra_cost' | 'revenue_bonus' | 'delay' | string;
interface AdminIncidentTemplate {
    id: string;
    name: string;
    description: string;
    effect: AdminIncidentEffect;
    severity: unknown;
    hourStart: number;
    hourEnd: number;
    probability: number;
    duration: number;
    [key: string]: unknown;
}
interface ActiveAdminIncident {
    templateId: string;
    name: string;
    description: string;
    effect: AdminIncidentEffect;
    severity: unknown;
    startedAt: number;
    expiresAt: number;
    duration: number;
}
interface AdminOverrides {
    incidents?: AdminIncidentTemplate[];
    modifications?: CatalogEntry[];
    deletions?: unknown[];
    imports?: CatalogEntry[];
    [key: string]: unknown;
}
export declare class AdminSync {
    overrides: AdminOverrides | null;
    incidents: AdminIncidentTemplate[];
    activeIncidents: ActiveAdminIncident[];
    loaded: boolean;
    checkInterval: ReturnType<typeof setInterval> | null;
    optIn: boolean;
    gameTimeGetter: (() => Date) | null;
    constructor();
    _loadOptIn(): boolean;
    setOptIn(value: boolean): void;
    loadOverrides(): Promise<AdminOverrides | null>;
    applyCatalogOverrides(catalog: CatalogEntry[]): CatalogEntry[];
    startIncidentLoop(gameTimeGetter: () => Date): void;
    stopIncidentLoop(): void;
    _tick(): void;
    _trigger(template: AdminIncidentTemplate): void;
    getEffects(): {
        speedMul: number;
        costMul: number;
        revenueMul: number;
        delayMin: number;
    };
    hasActive(): boolean;
}
export declare const adminSync: AdminSync;
export {};
