# Saison 3 — TypeScript Alpha 1

Baseline fonctionnelle : Rail Empire v1.1.99 HOTFIX83.

## Premier lot porté

- `rng` → TypeScript
- `operational-time` → TypeScript
- `train-physics` → TypeScript

Le JavaScript généré conserve les mêmes chemins afin de ne modifier aucun import historique ni le démarrage direct par `index.html`.

## Toolchain

- TypeScript 5.8.x
- `strict: true`
- ES2020
- déclarations `.d.ts` dans `types/`
- `npm run typecheck`
- `npm run build:ts`
- `npm run test:s3-alpha1`

## Validation

- 435 lignes TypeScript migrées
- 10 399 / 10 399 tests ciblés OK
- 500 / 500 profils de physique comparés identiques à HOTFIX83
- suite générale : 102 833 / 102 834
- unique échec : ancien test `REG-01/02/04`, déjà présent avant le portage

Aucun changement de gameplay volontaire dans cette Alpha.
