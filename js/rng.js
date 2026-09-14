// RE Saison 3 / TypeScript Alpha 1
// PRNG déterministe pour la simulation (DET-01/02).
export class SeededRng {
    constructor(seed = 12345) {
        this._seed = ((seed || 0) >>> 0) || 0x6D2B79F5;
    }
    setSeed(seed) {
        this._seed = ((seed || 0) >>> 0) || 0x6D2B79F5;
    }
    getState() {
        return this._seed;
    }
    setState(state) {
        this._seed = ((state || 0) >>> 0) || 0x6D2B79F5;
    }
    // xorshift32 — retourne un nombre dans [0, 1)
    random() {
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
    randomInt(n) {
        return Math.floor(this.random() * n);
    }
}
let _globalRng = null;
export function setGlobalRng(rng) {
    _globalRng = rng;
}
export function getGlobalRng() {
    return _globalRng || Math; // fallback Math si pas initialisé (tests)
}
