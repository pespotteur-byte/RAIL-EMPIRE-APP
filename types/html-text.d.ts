export declare function htmlText(value: unknown): string;
/** Legacy inline handlers have two parsers (HTML attribute, then JavaScript).
 * Encode the CONTENT of an already quoted JS string without inserting new quotes.
 * The escape also works for backtick strings; `${` cannot start interpolation.
 */
export declare function htmlJsString(value: unknown): string;
/** Complete primitive argument in a legacy inline handler, not a JS fragment. */
export declare function htmlJsValue(value: unknown): string;
