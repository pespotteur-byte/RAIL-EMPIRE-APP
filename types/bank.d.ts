type LoanKind = 'small' | 'medium' | 'large' | 'mega';
type StoredLoanKind = LoanKind | 'legacy';
interface LoanConfig {
    amount: number;
    rate: number;
    duration: number;
    label: string;
}
interface BankLoan {
    id: string;
    type: StoredLoanKind;
    principal: number;
    rate: number;
    totalDue: number;
    remaining: number;
    dailyPayment: number;
    daysLeft: number;
    totalDays: number;
    takenDate?: number;
    [key: string]: unknown;
}
interface EconomyLike {
    balance: number;
    history: Array<Record<string, unknown>>;
    addExpense(amount: number, category: string, description: string): unknown;
}
interface BankGameLike {
    economy: EconomyLike;
    saveState?: () => unknown;
}
/**
 * Bank — Loan system for Rail Empire.
 * Additive module: adds borrowing/repayment mechanics to economy.
 */
export declare class Bank {
    loans: BankLoan[];
    maxLoans: number;
    startingBalance: number | null;
    creditLimitRatio: number;
    lastRepaymentDate: string;
    interestRates: Record<LoanKind, LoanConfig>;
    constructor();
    private _isLoanKind;
    /** Pure preview, also used by the click handler and mutation boundary. */
    canBorrow(economy: EconomyLike, type: unknown): boolean;
    /**
     * Take out a loan. Returns the loan object or null if at max.
     */
    borrow(economy: EconomyLike, type: unknown): BankLoan | null;
    /** Process daily loan repayments. Called from economy daily hook. */
    processDailyRepayments(economy: EconomyLike, dateStr?: string): void;
    getTotalDebt(): number;
    getTotalPrincipalDebt(): number;
    getCreditLimit(initialBalance?: number): number;
    getTotalDailyPayment(): number;
    /** Render the bank section (integrated into Finances page or standalone). */
    render(container: HTMLElement | null, game: BankGameLike): void;
    toSave(): {
        loans: BankLoan[];
        startingBalance: number | null;
        lastRepaymentDate: string;
    };
    loadFromSave(s: unknown): void;
}
export {};
