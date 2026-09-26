/**
 * Rapport d'exploitation du QG : 7 jours à 1 an, exporté en PDF via la boîte
 * d'impression du navigateur (fonctionne hors connexion et en file://).
 */
export declare const QG_REPORT_PERIODS: Array<{
    days: number;
    label: string;
}>;
export type QgHistoryEntry = {
    type?: unknown;
    amount?: unknown;
    category?: unknown;
    description?: unknown;
    time?: unknown;
};
export type QgRameRow = {
    name: string;
    serial: string;
    elements: string[];
    totalKm: number;
    wearLevel: number;
    inMaintenance: boolean;
    defects: number;
    location: string;
};
export type QgTrainRow = {
    name: string;
    number: string;
    origin: string;
    destination: string;
    state: string;
    delay: number;
    rameName: string;
};
export type QgStaffRow = {
    role: string;
    count: number;
    onDuty: number;
};
export interface QgReportInput {
    company: string;
    generatedAt: string;
    days: number;
    nowMs: number;
    balance: number;
    history: QgHistoryEntry[];
    passengers: number;
    freightTonnes: number;
    rames: QgRameRow[];
    trains: QgTrainRow[];
    staff: QgStaffRow[];
    mode: 'facile' | 'expert';
}
export type QgFinanceSummary = {
    revenue: number;
    expenses: number;
    penalties: number;
    net: number;
    byCategory: Array<{
        category: string;
        revenue: number;
        expenses: number;
    }>;
    entries: number;
};
export declare function summarizeFinance(history: QgHistoryEntry[], nowMs: number, days: number): QgFinanceSummary;
export declare function buildQgReportHtml(input: QgReportInput): string;
/** Ouvre le rapport dans une fenêtre dédiée et lance la boîte d'impression. */
export declare function openQgReport(html: string): boolean;
