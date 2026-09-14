export function installSaveSerializerWorker(scope) {
    scope.onmessage = async (event) => {
        const { id, state: json, mode } = event.data;
        try {
            if (typeof json !== 'string')
                throw new Error('Snapshot JSON manquant');
            if (typeof CompressionStream !== 'undefined' && (mode === 'export' || typeof DecompressionStream !== 'undefined')) {
                const source = new Blob([json]);
                const buffer = await new Response(source.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
                if (mode === 'export' || buffer.byteLength < source.size) {
                    scope.postMessage({ id, ok: true, gzip: true, buffer }, [buffer]);
                    return;
                }
            }
            scope.postMessage({ id, ok: true, gzip: false, json });
        }
        catch (error) {
            scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
    };
}
