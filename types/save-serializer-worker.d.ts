/** Self-contained worker implementation: the emitted JS function is embedded by
 * storage.ts. No executable JS template bypasses the TypeScript compiler. */
export interface SaveWorkerRequest {
    id: number;
    state: string;
    mode: 'storage' | 'export';
}
export interface SaveWorkerResponse {
    id: number;
    ok: boolean;
    gzip?: boolean;
    buffer?: ArrayBuffer;
    json?: string;
    error?: string;
}
export interface SaveWorkerScope {
    onmessage: ((event: MessageEvent<SaveWorkerRequest>) => void) | null;
    postMessage(message: SaveWorkerResponse, transfer?: Transferable[]): void;
}
export declare function installSaveSerializerWorker(scope: SaveWorkerScope): void;
