/** Self-contained worker implementation: the emitted JS function is embedded by
 * storage.ts. No executable JS template bypasses the TypeScript compiler. */
export interface SaveWorkerRequest { id: number; state: string; mode: 'storage' | 'export'; }
export interface SaveWorkerResponse { id: number; ok: boolean; gzip?: boolean; buffer?: ArrayBuffer; json?: string; error?: string; }
export interface SaveWorkerScope {
  onmessage: ((event: MessageEvent<SaveWorkerRequest>) => void) | null;
  postMessage(message: SaveWorkerResponse, transfer?: Transferable[]): void;
}
export function installSaveSerializerWorker(scope: SaveWorkerScope): void {
  scope.onmessage = async (event) => {
    const { id, state: json, mode } = event.data;
    try {
      if (typeof json !== 'string') throw new Error('Snapshot JSON manquant');
      if (typeof CompressionStream !== 'undefined' && (mode === 'export' || typeof DecompressionStream !== 'undefined')) {
        const source = new Blob([json]);
        const buffer = await new Response(source.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
        if (mode === 'export' || buffer.byteLength < source.size) {
          scope.postMessage({ id, ok: true, gzip: true, buffer }, [buffer]);
          return;
        }
      }
      scope.postMessage({ id, ok: true, gzip: false, json });
    } catch (error) {
      scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}
