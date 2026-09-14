/** Exact in-memory clone for editable schedule graphs. Avoids lossy JSON route
 * packing/reconstruction; preserves prototypes and within-copy aliases, never
 * aliases mutable objects between the source and a copy. */
export function cloneEditableGraph<T>(source: T): T {
  const seen = new Map<object, object>();
  const copy = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const old = seen.get(value); if (old) return old;
    if (value instanceof Date) { const out = new Date(value.getTime()); seen.set(value,out); return out; }
    if (value instanceof Map) { const out = new Map<unknown,unknown>(); seen.set(value,out); for (const [k,v] of value) out.set(copy(k),copy(v)); return out; }
    if (value instanceof Set) { const out = new Set<unknown>(); seen.set(value,out); for (const v of value) out.add(copy(v)); return out; }
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) throw new Error('Type binaire inattendu dans un horaire.');
    // Native shallow copies retain the engine's optimized object shapes.
    // Only nested objects need recursion; primitive route columns stay fast.
    const out: Record<string, unknown> | unknown[] = Array.isArray(value) ? value.slice() : {...value};
    const prototype=Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype!==Object.prototype) Object.setPrototypeOf(out,prototype);
    seen.set(value,out);
    for (const key of Object.keys(value)) {
      const item=(value as Record<string,unknown>)[key];
      if(item!==null&&typeof item==='object') {
        const cloned=copy(item);
        if(key==='__proto__')Object.defineProperty(out,key,{value:cloned,enumerable:true,configurable:true,writable:true});
        else (out as Record<string,unknown>)[key]=cloned;
      } else if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key)) {
        Object.defineProperty(out,key,{value:item,enumerable:true,configurable:true,writable:true});
      }
    }
    return out;
  };
  return copy(source) as T;
}

/** Compile the reference graph once for a synchronous duplication batch.
 * Each invocation allocates EVERY mutable node afresh. Only immutable primitive
 * templates and reference indices are reused; the plan is discarded at batch end.
 * This avoids repeated key inspection and Map lookups for railway snapshots. */
export function prepareEditableClone<T>(source:T):()=>T {
  type Ref={node:number}|{value:unknown};
  type Entry={kind:'array'|'object';template:unknown[]|Record<string,unknown>;prototype:object|null;links:Array<[string,number]>;extras:Array<[string,unknown]>}
    |{kind:'date';time:number}|{kind:'map';entries:Array<[Ref,Ref]>}|{kind:'set';values:Ref[]};
  const originals:object[]=[],indices=new Map<object,number>(),entries:Entry[]=[];
  const ref=(value:unknown):Ref=>{
    if(value===null||typeof value!=='object')return {value};
    let node=indices.get(value);if(node===undefined){node=originals.length;indices.set(value,node);originals.push(value);}return {node};
  };
  const root=ref(source);
  for(let index=0;index<originals.length;index++){
    const value=originals[index]!;
    if(value instanceof Date){entries.push({kind:'date',time:value.getTime()});continue;}
    if(value instanceof Map){entries.push({kind:'map',entries:Array.from(value,([k,v])=>[ref(k),ref(v)])});continue;}
    if(value instanceof Set){entries.push({kind:'set',values:Array.from(value,v=>ref(v))});continue;}
    if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)throw new Error('Type binaire inattendu dans un horaire.');
    const array=Array.isArray(value),template:unknown[]|Record<string,unknown>=array?value.slice():{...value},links:Array<[string,number]>=[],extras:Array<[string,unknown]>=[];
    for(const key of Object.keys(value)){
      const item=(value as Record<string,unknown>)[key],r=ref(item);
      if('node'in r)links.push([key,r.node]);
      else if(array&&!/^(0|[1-9][0-9]*)$/.test(key))extras.push([key,item]);
    }
    entries.push({kind:array?'array':'object',template,prototype:Object.getPrototypeOf(value),links,extras});
  }
  return ()=>{
    const copies:object[]=entries.map(entry=>{
      if(entry.kind==='date')return new Date(entry.time);
      if(entry.kind==='map')return new Map<unknown,unknown>();
      if(entry.kind==='set')return new Set<unknown>();
      if(entry.kind==='array'){
        const result=(entry.template as unknown[]).slice();
        for(const [key,value]of entry.extras)Object.defineProperty(result,key,{value,enumerable:true,configurable:true,writable:true});
        return result;
      }
      const result={...entry.template};if(entry.prototype!==Object.prototype)Object.setPrototypeOf(result,entry.prototype);return result;
    });
    const deref=(r:Ref):unknown=>'node'in r?copies[r.node]:r.value;
    for(let index=0;index<entries.length;index++){
      const entry=entries[index]!,out=copies[index]!;
      if(entry.kind==='map'){for(const [k,v]of entry.entries)(out as Map<unknown,unknown>).set(deref(k),deref(v));}
      else if(entry.kind==='set'){for(const v of entry.values)(out as Set<unknown>).add(deref(v));}
      else if(entry.kind==='array'||entry.kind==='object')for(const [key,target]of entry.links){
        if(key==='__proto__')Object.defineProperty(out,key,{value:copies[target],enumerable:true,configurable:true,writable:true});
        else(out as Record<string,unknown>)[key]=copies[target];
      }
    }
    return deref(root) as T;
  };
}

/** Increment the last numerical group, preserving leading zeros and suffixes.
 * BigInt avoids silently rounding serial numbers longer than 15 digits. */
export function incrementLabel(value: unknown, delta: number): string {
  const text = String(value ?? '').trim();
  const m = /^(.*?)(\d+)(\D*)$/.exec(text);
  if (!m) return text;
  if (!Number.isSafeInteger(delta)) throw new Error('Incrément de numéro invalide.');
  const next = BigInt(m[2]!) + BigInt(delta);
  if (next < 0n) throw new Error('Numéro négatif interdit.');
  return m[1]! + next.toString().padStart(m[2]!.length,'0') + m[3]!;
}
export class LabelAllocator {
  private used: Set<string>;
  constructor(labels: Iterable<unknown>, private readonly insensitive = false) {
    this.used = new Set(Array.from(labels, x => this.key(String(x ?? '').trim())).filter(Boolean));
  }
  private key(label: string): string { return this.insensitive ? label.toLocaleLowerCase('fr') : label; }
  has(label: string): boolean { return this.used.has(this.key(label.trim())); }
  claim(preferred: unknown, step = 1): string {
    if (!Number.isSafeInteger(step) || step < 1) throw new Error('Pas de numérotation invalide.');
    const base = String(preferred ?? '').trim() || '1';
    let value = base, suffix = 2;
    while (this.has(value)) {
      const next = incrementLabel(value,step);
      value = next !== value ? next : `${base} ${suffix++}`;
    }
    this.used.add(this.key(value)); return value;
  }
  next(source: unknown, delta = 1, step = 1): string {
    const text = String(source ?? '').trim();
    const incremented = incrementLabel(text,delta);
    return this.claim(incremented === text ? `${text || 'Copie'} 2` : incremented, step);
  }
}
export function duplicatedTrainName(name: unknown, sourceNumber: unknown, targetNumber: unknown, delta: number, names: LabelAllocator): string {
  const raw = String(name ?? '').trim(); if (!raw) return '';
  // Purely descriptive names remain descriptive (existing Schedule Creator rule).
  if (!/\d/.test(raw)) return raw;
  const from = String(sourceNumber ?? '').trim(), to = String(targetNumber ?? '').trim();
  if (from && from !== to) {
    const escape = from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const replaced = raw.replace(new RegExp(`(^|[^A-Za-z0-9])${escape}(?=$|[^A-Za-z0-9])`,'g'), (_m, prefix: string) => `${prefix}${to}`);
    if (replaced !== raw) return names.claim(names.has(replaced)?`${replaced} (2)`:replaced,1);
  }
  return names.next(raw,Math.max(1,delta),delta>1?2:1);
}
