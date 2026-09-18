# Rail Empire V2

Réécriture du moteur en TypeScript strict, à partir de RC28 (référence fonctionnelle).
Objectifs : fiabilité, ≤ 3 Go de RAM, pas de vieux systèmes empilés, navigateur seul (`file://`).

## Architecture

| Paquet | Rôle | DOM ? |
| --- | --- | --- |
| `packages/data` | formats compacts, chunks JSONP `file://`, catalogue (index + 128 shards), référentiel monde en tuiles 2°, recherche | non |
| `packages/core` | simulation à pas fixe (SoA, snapshots `Float32Array` transférés), protocole worker | non |
| `packages/render` | carte : PixiJS WebGL/WebGPU, fallback Canvas 2D, même interface `MapRenderer` | oui |
| `apps/game` | Preact + signals, worker de simulation, livemap, build IIFE ouvrable en double-clic | oui |
| `tools` | génération des données depuis RC28, bancs de budget | Node |

Règles : `@re/core` et `@re/data` n'ont accès ni à `window` ni au DOM (lint), aucun `any`, `noUncheckedIndexedAccess`.

## Commandes

```bash
cd v2 && npm ci
node ../scripts/export-native-catalog.mjs   # catalogue RC28 → catalogue-natif/data/catalog.native.json
npm run data:build                           # → apps/game/public/data (≈ 710 chunks, 49 Mo)
npm run check                                # typecheck + lint + tests
npm run perf                                 # budgets mémoire / latence sur les données réelles
npm run dev                                  # Vite (http)
npm run build                                # apps/game/dist/index.html, ouvrable en file://
```

`?canvas2d` dans l'URL force le fallback Canvas 2D.

## Budgets (tools/data-budget.perf.test.ts)

- chunk ≤ 8 Mo ; index catalogue (36 307 fiches) chargé < 1,5 s et < 60 Mo de heap (mesuré ≈ 13 Mo) ;
- tuile monde < 6 Mo de heap (Île-de-France ≈ 1,1 Mo pour 2 tuiles) ; recherche < 150 ms ;
- index des noms < 60 Mo (mesuré ≈ 23 Mo), libéré après usage.
