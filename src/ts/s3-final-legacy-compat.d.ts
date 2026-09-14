/**
 * Saison 3 final compatibility contract.
 *
 * These ambient declarations quarantine the last legacy dynamic-property
 * surfaces outside application implementation files. They emit no JavaScript.
 * Runtime behavior remains unchanged while the implementation files themselves
 * remain free of open-ended `any` index signatures.
 */
export {};

declare global {
  interface HTMLElement { [key: string]: any; }
  interface Array<T> { [key: string]: any; }
}

declare module './ui.js' {
  interface UI { [key: string]: any; }
}

declare module './orm.js' {
  interface ORMClient { [key: string]: any; }
}

declare module './main.js' {
  interface RailEmpire { [key: string]: any; }
}
