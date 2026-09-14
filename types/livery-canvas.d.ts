import { type LiveryImage, type LiveryPlacement, type CompositeFrame } from './livery-model.js';
export declare function decodeLiveryImage(source: string): Promise<HTMLImageElement>;
export declare function drawLivery(canvas: HTMLCanvasElement, base: HTMLImageElement | null, cargo: HTMLImageElement, placement: LiveryPlacement): CompositeFrame | null;
export declare function canvasPNG(canvas: HTMLCanvasElement): Promise<Blob>;
export declare function blobDataURL(blob: Blob): Promise<string>;
export declare function canvasAsset(canvas: HTMLCanvasElement): Promise<LiveryImage>;
export declare function importLiveryImage(file: File): Promise<{
    asset: LiveryImage;
    image: HTMLImageElement;
}>;
export declare function downloadLiveryPNG(blob: Blob, label: string): void;
