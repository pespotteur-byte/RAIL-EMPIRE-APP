/** Exact rear-clearance envelope on the SC's existing numerical cells.
 * Each positive speed transition contributes its old speed until the complete
 * consist clears it. A min-heap merges overlapping restrictions, instead of
 * revisiting every cell under every transition. No geometry is discarded.
 */
export declare function rearClearanceCaps(distance: Float64Array, originalLimit: Float64Array, transitionUp: Uint8Array, lengthM: number): Float64Array;
