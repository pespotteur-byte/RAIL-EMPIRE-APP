// Pure helpers for the Schedule Creator remaster (Remaster P0 — SC / ARR).
// Dependency-free so they can be unit-tested without the DOM or the game engine.
//
// Checklist coverage:
//   SC-03 auto numbering: aller = impair, retour = pair (aller+1)
//   SC-06 attente terminus par défaut = 5 min (modifiable) — décision #5
//   ARR-01 C = Circulation, S = Service
//   ARR-02 sautable uniquement entre crochets [C] / [S]
//   ARR-03 arrêt non crocheté = incompressible (toujours marqué)
//   ARR-04 probabilité de saut = 25 %
//   ARR-05 tirage rejoué à chaque circulation (RNG injectable, hors seed)

// SC-06 — default terminus turnaround (minutes).
export const DEFAULT_TERMINUS_WAIT_MIN = 5;

// ARR-04 — skip probability for a bracketed [C]/[S] stop.
export const SKIP_PROBABILITY = 0.25;

// SC-03 — force a positive odd number (aller).
export function toOdd(n) {
  const v = Math.max(1, Math.floor(Number(n) || 1));
  return v % 2 === 0 ? v + 1 : v;
}

// SC-03 — return-leg number for a given forward (odd) number: the previous even
// (aller 001 -> retour 000, aller 003 -> retour 002, etc.).
export function returnNumberFor(forwardNumber) {
  return Math.max(0, toOdd(forwardNumber) - 1);
}

// SC-03 — the k-th forward number after a base odd number (keeps it odd).
// incrementForward(1, 1) => 3, incrementForward(1, 2) => 5 ...
export function incrementForward(baseOdd, k = 1) {
  return toOdd(baseOdd) + 2 * Math.max(0, Math.floor(k));
}

// SC-03/SC-05 — increment the trailing digits of a service name by `delta`,
// preserving the original padding. If the name has no trailing number, treat the
// implicit base forward number as 1 and append `1 + delta` (so a duplicate at
// step 2 becomes "Nom 3", the matching return becomes "Nom 2", etc.).
export function incrementTrailingNumber(name, delta = 2) {
  const s = String(name || '');
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) {
    // No trailing digits: assume base forward number is 1, so append 1 + delta.
    const n = 1 + delta;
    if (n < 0) return s;
    return `${s} ${n}`;
  }
  const prefix = m[1];
  const num = parseInt(m[2], 10);
  const padLen = m[2].length;
  return prefix + String(num + delta).padStart(padLen, '0');
}

// ARR-01/02/03 — parse a stop label into its circulation type and whether it
// may be skipped. Only bracketed markers ([C]/[S]) are skippable; a bare C/S
// (or no marker) is an incompressible stop.
//   "Melun [C]"  -> { code:'C', skippable:true,  clean:'Melun' }
//   "Melun (S)"  -> { code:'S', skippable:true,  clean:'Melun' }  (parens accepted)
//   "Melun C"    -> { code:'C', skippable:false, clean:'Melun' }
//   "Melun"      -> { code:null, skippable:false, clean:'Melun' }
export function parseStopType(label) {
  const raw = (label == null ? '' : String(label)).trim();
  const bracketed = raw.match(/[[(]\s*([CS])\s*[\])]\s*$/i);
  if (bracketed) {
    return {
      code: bracketed[1].toUpperCase(),
      skippable: true,
      clean: raw.slice(0, bracketed.index).trim(),
    };
  }
  const bare = raw.match(/\s([CS])$/);
  if (bare) {
    return {
      code: bare[1].toUpperCase(),
      skippable: false,
      clean: raw.slice(0, bare.index).trim(),
    };
  }
  return { code: null, skippable: false, clean: raw };
}

// ARR-04/05 — draw whether this stop is skipped on THIS circulation.
// rng defaults to Math.random so each circulation is independent of any seed.
export function rollSkip(rng = Math.random) {
  return rng() < SKIP_PROBABILITY;
}

// ARR-02/04/05 — decide if a stop is skipped this circulation: only skippable
// (bracketed) stops can be, then the 25 % draw applies.
export function shouldSkipStop(label, rng = Math.random) {
  return parseStopType(label).skippable && rollSkip(rng);
}

// SC-02 — compute the passage time at every real station a leg traverses
// (point g), even the ones where the train does not stop. Given the leg's
// departure time at A, arrival time at B and the cumulative distances (km) of
// each intermediate station from A, times are interpolated by distance.
//   depTimeA, arrTimeB : minutes
//   cumDistsKm         : ascending distances from A (0 = A ... total = B)
// Returns an array of passage times (minutes) aligned with cumDistsKm.
export function interpolatePassageTimes(depTimeA, arrTimeB, cumDistsKm) {
  if (!Array.isArray(cumDistsKm) || cumDistsKm.length === 0) return [];
  const total = cumDistsKm[cumDistsKm.length - 1] || 0;
  const span = arrTimeB - depTimeA;
  return cumDistsKm.map((d) => {
    if (total <= 0) return depTimeA;
    return depTimeA + span * (d / total);
  });
}
