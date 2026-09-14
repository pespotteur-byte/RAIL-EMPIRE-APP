/**
 * Saison 3 migration bridge for legacy DOM-heavy controllers.
 *
 * Rail Empire historically binds known, pre-rendered controls by id/query and
 * then uses their input/button properties directly.  During incremental TS
 * migration we keep that runtime contract explicit instead of scattering
 * hundreds of non-null assertions through unchanged UI logic.
 *
 * This file has no runtime output beyond `export {}`.
 */
export {};

type JsPdfDocument = {
  internal: { pageSize: { getWidth(): number } };
  addImage(...args: unknown[]): unknown; addPage(...args: unknown[]): unknown; getTextWidth(text: string): number;
  line(...args: unknown[]): unknown; rect(...args: unknown[]): unknown; save(filename: string): unknown;
  setDrawColor(...args: unknown[]): unknown; setFillColor(...args: unknown[]): unknown; setFont(...args: unknown[]): unknown;
  setFontSize(...args: unknown[]): unknown; setLineDash(...args: unknown[]): unknown; setTextColor(...args: unknown[]): unknown;
  splitTextToSize(text: string, width: number): string[]; text(...args: unknown[]): unknown;
};
type JsPdfBridge = { jsPDF?: new (...args: unknown[]) => JsPdfDocument };

declare global {
  interface Error { code?: string; }


  interface Window { jspdf: JsPdfBridge; __railEmpireEnsureCatalogBundle?: () => unknown | Promise<unknown>; }

  interface Element {
    value: string;
    checked: boolean;
    disabled: boolean;
    selectionStart: number | null;
    selectionEnd: number | null;
    selectionDirection: 'forward' | 'backward' | 'none' | null;
    onclick: ((this: Element, ev: MouseEvent) => unknown) | null;
    onchange: ((this: Element, ev: Event) => unknown) | null;
    oninput: ((this: Element, ev: Event) => unknown) | null;
    ondragover: ((this: Element, ev: DragEvent) => unknown) | null;
    ondragleave: ((this: Element, ev: DragEvent) => unknown) | null;
    ondrop: ((this: Element, ev: DragEvent) => unknown) | null;
    onkeydown: ((this: Element, ev: KeyboardEvent) => unknown) | null;
    style: CSSStyleDeclaration;
    dataset: DOMStringMap;
    focus(options?: FocusOptions): void;
    setSelectionRange(start: number | null, end: number | null, direction?: 'forward' | 'backward' | 'none'): void;
  }

  interface Document {
    getElementById(elementId: string): HTMLElement;
    querySelector(selectors: string): HTMLElement;
    querySelectorAll(selectors: string): NodeListOf<any>;
  }

  interface Element {
    querySelector(selectors: string): HTMLElement;
    querySelectorAll(selectors: string): NodeListOf<any>;
  }

  var __RE_AUDIO_DIAG: unknown;
  var __RE_LIVEMAP_AUDIO_DIAG: unknown;
}
