export type CatalogLoadProgress = (done: number, total: number, count: number, chunk: unknown[]) => void;
export declare function loadBatch186FullCatalogAdditions(onProgress?: CatalogLoadProgress): Promise<unknown[]>;
