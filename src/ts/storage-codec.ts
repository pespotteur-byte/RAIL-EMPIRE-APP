/** RC14: lossless persistence including shared SC columns. The RE13 envelope remains readable
 * by RC13: this release adds reference candidates, NOT rounding, pruning or a new codec. */
export const COMPACT_FORMAT = 'RE13-JSON-1';
export type JsonPath = string[];
type Reference = [JsonPath, JsonPath];
export interface CompactJson {
  json: string; rawBytes: number; compactBytes: number; duplicateBytes: number; references: number;
}
export interface BinaryJson {
  codec: 'RE13/gzip' | 'RE13/json'; data: Blob; rawBytes: number; compactBytes: number;
  storedBytes: number; duplicateBytes: number; references: number;
}
export interface CompactOptions { dictionaryChars?: number; minChars?: number; }
const CANDIDATES = new Set([
  'routePacked','routePoints','geometry','segments','nodes','nodeIds','ways','route','trackSegments',
  'stations','nativeRefs','stationRef','fromStation','toStation','stationSnapshot',
]);
// Only SC8P1 objects opt into column sharing. Separate namespaces prevent a small,
// single route from acquiring references between unrelated all-zero index columns.
const SC_COLUMNS = new Set(['coords','wayDict','wayIndex','segmentIndex','metaDict','metaIndex']);
const byteSize = (text: string): number => new Blob([text]).size;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/** References are OUTSIDE the user document, not reserved keys inside game data. */
export function compactJson(value: unknown, options: CompactOptions = {}): CompactJson {
  const budget = Math.max(0, options.dictionaryChars ?? 8 * 1024 * 1024);
  const min = Math.max(64, options.minChars ?? 512);
  const paths = new WeakMap<object, JsonPath>();
  const dictionary = new Map<string, JsonPath>();
  const refs: Reference[] = [];
  let retained = 0, duplicateBytes = 0;
  const root = JSON.stringify(value, function (this: object, key: string, entry: unknown): unknown {
    // JSON.stringify's artificial root holder has no path. A real empty-string property does.
    const parent = paths.get(this);
    const path: JsonPath = parent ? [...parent, key] : [];
    if (object(entry)) {
      const column = object(this) && this['format'] === 'SC8P1' && SC_COLUMNS.has(key);
      if (parent && path.length <= 512 && (CANDIDATES.has(key) || column) &&
          (!Array.isArray(entry) || entry.length >= 4)) {
        // Exact string equality, not a hash, decides identity. A bounded dictionary is optional.
        const text = JSON.stringify(entry);
        if (text && text.length >= min) {
          const identity = column ? `SC8P1:${key}\0${text}` : text;
          const source = dictionary.get(identity);
          if (source) {
            refs.push([path, source]); duplicateBytes += byteSize(text) - 4;
            return null;
          }
          if (retained + identity.length <= budget) { dictionary.set(identity, path); retained += identity.length; }
        }
      }
      paths.set(entry, path);
    }
    return entry;
  });
  if (root === undefined) throw new TypeError('La sauvegarde doit être une valeur JSON.');
  const rawBytes = byteSize(root) + duplicateBytes;
  const json = `{"format":"${COMPACT_FORMAT}","root":${root},"refs":${JSON.stringify(refs)}}`;
  return { json, rawBytes, compactBytes: byteSize(json), duplicateBytes, references: refs.length };
}

function at(root: unknown, path: JsonPath): unknown {
  let node = root;
  for (const key of path) {
    if (!object(node) || !Object.prototype.hasOwnProperty.call(node, key))
      throw new Error('Référence de sauvegarde absente.');
    node = node[key];
  }
  return node;
}
function validPath(value: unknown): value is JsonPath {
  return Array.isArray(value) && value.length > 0 && value.length <= 512 && value.every(k => typeof k === 'string');
}
/** Each restored copy is independent: editing one schedule never changes another. */
export function expandJson(json: string): unknown {
  const doc: unknown = JSON.parse(json);
  if (!object(doc) || doc.format !== COMPACT_FORMAT || !Object.prototype.hasOwnProperty.call(doc, 'root') || !Array.isArray(doc.refs))
    throw new Error('Format compact de sauvegarde inconnu.');
  for (const ref of doc.refs as unknown[]) {
    if (!Array.isArray(ref) || ref.length !== 2 || !validPath(ref[0]) || !validPath(ref[1]))
      throw new Error('Référence compacte invalide.');
    const [target, source] = ref as Reference;
    const parent = at(doc.root, target.slice(0, -1));
    const key = target[target.length - 1]!;
    if (!object(parent) || !Object.prototype.hasOwnProperty.call(parent, key) || parent[key] !== null)
      throw new Error('Cible compacte invalide.');
    const original = at(doc.root, source);
    if (!object(original)) throw new Error('Source compacte invalide.');
    // Disallow ancestors (would embed the whole partially expanded save recursively).
    if (source.length < target.length && source.every((k, i) => k === target[i]))
      throw new Error('Référence compacte récursive.');
    Object.defineProperty(parent, key, { value: JSON.parse(JSON.stringify(original)), enumerable: true, configurable: true, writable: true });
  }
  return doc.root;
}

/** Backpressure limits input chunks to 32,768 UTF-16 units (at most 96 KiB UTF-8); surrogate pairs are not cut. */
export function textByteStream(text: string): ReadableStream<Uint8Array> {
  let offset = 0;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset >= text.length) { controller.close(); return; }
    let end = Math.min(text.length, offset + 32768);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
    controller.enqueue(encoder.encode(text.slice(offset, end))); offset = end;
  }});
}
export async function encodeCompact(compact: CompactJson): Promise<BinaryJson> {
  let data: Blob, codec: BinaryJson['codec'] = 'RE13/json';
  if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
    try {
      const compressed = await new Response(textByteStream(compact.json).pipeThrough(new CompressionStream('gzip'))).blob();
      if (compressed.size < compact.compactBytes) { data = compressed; codec = 'RE13/gzip'; }
      else data = new Blob([compact.json], {type:'application/json'});
    } catch { data = new Blob([compact.json], {type:'application/json'}); }
  } else data = new Blob([compact.json], {type:'application/json'});
  return { codec, data, storedBytes:data.size, rawBytes:compact.rawBytes, compactBytes:compact.compactBytes, duplicateBytes:compact.duplicateBytes, references:compact.references };
}
export async function encodeJson(value: unknown): Promise<BinaryJson> { return encodeCompact(compactJson(value)); }
export async function decodeJson(payload: Pick<BinaryJson, 'codec' | 'data'>): Promise<unknown> {
  if (!(payload.data instanceof Blob)) throw new Error('Bloc binaire de sauvegarde invalide.');
  if (payload.codec === 'RE13/gzip') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Décompression gzip indisponible dans ce navigateur.');
    const json = await new Response(payload.data.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return expandJson(json);
  }
  if (payload.codec !== 'RE13/json') throw new Error('Codec de sauvegarde inconnu.');
  return expandJson(await payload.data.text());
}
