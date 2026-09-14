// RE Saison 3 / TypeScript Alpha 1
// PRNG déterministe pour la simulation (DET-01/02).

export interface RandomSource {
  random(): number;
}

export class SeededRng implements RandomSource {
  private _seed: number;

  constructor(seed = 12345) {
    this._seed = ((seed || 0) >>> 0) || 0x6D2B79F5;
  }

  setSeed(seed: number): void {
    this._seed = ((seed || 0) >>> 0) || 0x6D2B79F5;
  }

  getState(): number {
    return this._seed;
  }

  setState(state: number): void {
    this._seed = ((state || 0) >>> 0) || 0x6D2B79F5;
  }

  // xorshift32 — retourne un nombre dans [0, 1)
  random(): number {
    let x = this._seed;
    x ^= (x << 13);
    x = x >>> 0;
    x ^= (x >>> 17);
    x = x >>> 0;
    x ^= (x << 5);
    x = x >>> 0;
    this._seed = x;
    return (x >>> 0) / 4294967296;
  }

  randomInt(n: number): number {
    return Math.floor(this.random() * n);
  }
}

let _globalRng: RandomSource | null = null;

export function setGlobalRng(rng: RandomSource | null): void {
  _globalRng = rng;
}

export function getGlobalRng(): RandomSource {
  return _globalRng || Math; // fallback Math si pas initialisé (tests)
}
