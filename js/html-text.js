/** Escape a plain model value at the HTML boundary, never when persisting it.
 * Suitable for text nodes and quoted ordinary attributes, NOT raw CSS/JS/URLs.
 */
const ENTITIES = Object.freeze({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
});
export function htmlText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ENTITIES[char]);
}
/** Legacy inline handlers have two parsers (HTML attribute, then JavaScript).
 * Encode the CONTENT of an already quoted JS string without inserting new quotes.
 * The escape also works for backtick strings; `${` cannot start interpolation.
 */
export function htmlJsString(value) {
    return String(value ?? '').replace(/[\\'"`<>&$\u0000-\u001f\u2028\u2029]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}
/** Complete primitive argument in a legacy inline handler, not a JS fragment. */
export function htmlJsValue(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? String(value) : 'null';
    if (typeof value === 'boolean')
        return String(value);
    if (value == null)
        return 'null';
    return '&quot;' + htmlJsString(value) + '&quot;';
}
