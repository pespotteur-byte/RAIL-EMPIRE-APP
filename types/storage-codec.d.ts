/** RC14: lossless persistence including shared SC columns. The RE13 envelope remains readable
 * by RC13: this release adds reference candidates, NOT rounding, pruning or a new codec. */
export declare const COMPACT_FORMAT = "RE13-JSON-1";
export type JsonPath = string[];
export interface CompactJson {
    json: string;
    rawBytes: number;
    compactBytes: number;
    duplicateBytes: number;
    references: number;
}
export interface BinaryJson {
    codec: 'RE13/gzip' | 'RE13/json';
    data: Blob;
    rawBytes: number;
    compactBytes: number;
    storedBytes: number;
    duplicateBytes: number;
    references: number;
}
export interface CompactOptions {
    dictionaryChars?: number;
    minChars?: number;
}
/** References are OUTSIDE the user document, not reserved keys inside game data. */
export declare function compactJson(value: unknown, options?: CompactOptions): CompactJson;
/** Each restored copy is independent: editing one schedule never changes another. */
export declare function expandJson(json: string): unknown;
/** Backpressure limits input chunks to 32,768 UTF-16 units (at most 96 KiB UTF-8); surrogate pairs are not cut. */
export declare function textByteStream(text: string): ReadableStream<Uint8Array>;
export declare function encodeCompact(compact: CompactJson): Promise<BinaryJson>;
export declare function encodeJson(value: unknown): Promise<BinaryJson>;
export declare function decodeJson(payload: Pick<BinaryJson, 'codec' | 'data'>): Promise<unknown>;
