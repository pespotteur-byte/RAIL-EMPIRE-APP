interface FinanceEconomy {
    balance: number;
    revenue: number;
    expenses: number;
    penalties: number;
    _currentDayRevenue: number;
    _currentDayExpenses: number;
    historyInheritedTruncation: boolean;
    history: Record<string, unknown>[];
    dailySnapshots: Record<string, unknown>[];
    revenueByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    lineRevenue: Record<string, number>;
    lineExpense: Record<string, number>;
    toSave(): unknown;
}
interface FinanceBank {
    getTotalDebt(): number;
    toSave(): unknown;
}
export interface FinanceView {
    page: number;
    query: string;
    type: string;
    from: string;
    to: string;
}
export declare function financePage(history: readonly Record<string, unknown>[], view: FinanceView, size?: number): {
    rows: Record<string, unknown>[];
    count: number;
    page: number;
};
export declare function financialCSV(history: readonly Record<string, unknown>[]): string;
export declare function renderFinancialPanel(host: HTMLElement, economy: FinanceEconomy, bank: FinanceBank | null | undefined, view: FinanceView): void;
export {};
