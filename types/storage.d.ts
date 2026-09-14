import { type BinaryJson } from './storage-codec.js';
interface SaveOptions {
    lowMemory?: boolean;
}
export interface SaveInfo {
    sizeBytes: number;
    sizeKB: number;
    sizeMB: string;
    compressed: boolean;
    backend: string;
    rawBytes?: number;
    references?: number;
    reductionRatio?: number;
}
export declare class GameStorage {
    _ready: Promise<boolean>;
    lastError: string | null;
    constructor();
    hasSave(): boolean;
    hasSaveAsync(): Promise<boolean>;
    _writeIndexed(payload: BinaryJson, updatedAt?: number): Promise<boolean>;
    saveGame(state: unknown, options?: SaveOptions | null): Promise<boolean>;
    makeExportBlob(state: unknown): Promise<{
        blob: Blob;
        ext: '.json.gz' | '.json';
    }>;
    _parseStored(stored: string | Blob | null | undefined, codec?: BinaryJson['codec']): Promise<unknown>;
    loadGame(): Promise<unknown>;
    deleteSave(): Promise<boolean>;
    getSaveInfo(): SaveInfo | null;
}
export {};
