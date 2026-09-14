export interface CatalogPriceItem {
    [key: string]: unknown;
    name?: string;
    seriesName?: string;
    realIdentitySeries?: string;
    mlgSeriesName?: string;
    maxSpeed?: number;
    power?: number;
    length?: number;
    passengerCapacity?: number;
    freightCapacity?: number;
    imageData?: string;
    category?: string;
    traction?: string;
}
export interface BalancedPriceResult {
    price: number;
    cls: string;
}
export declare function applyBalancedPurchasePrices<T extends CatalogPriceItem>(catalog: readonly T[]): Array<T & {
    purchasePrice: number;
    purchasePriceBasis: string;
    purchasePriceClass: string;
    purchasePriceNote: string;
}>;
export declare function validateBalancedPurchasePrices(catalog: readonly CatalogPriceItem[]): {
    total: number;
    bad: number;
    max: number;
    min: number;
};
