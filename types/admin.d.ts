interface ZipEntry {
    dir: boolean;
    async(type: 'blob'): Promise<Blob>;
}
interface ZipLibrary {
    loadAsync(data: Blob): Promise<{
        files: Record<string, ZipEntry>;
    }>;
}
declare global {
    interface Window {
        _editItem: (id: string) => void;
        _editIncident: (id: string) => void;
        _deleteIncident: (id: string) => void;
        JSZip?: ZipLibrary;
    }
}
export {};
