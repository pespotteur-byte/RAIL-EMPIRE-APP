# Saison 3 — TypeScript Alpha 2

Migration pure, sans changement de gameplay.

## Ajouts

- `movement-authority` porté en TypeScript strict.
- `rail-section-geometry` porté en TypeScript strict.
- Types publics générés pour les décisions de mouvement, contraintes, sections, routes et bindings ORM.
- Script de parité `tools/typescript/ts-parity-alpha2.mjs`.
- Cache bundle `1199ts2`.

## Validation

- Typecheck strict : OK.
- Tests ciblés : 10 406 / 10 406.
- Parité `MovementAuthority` : 3 000 / 3 000.
- Parité géométrie ferroviaire : 3 000 / 3 000.
- Parité physique Alpha 1 : 500 / 500.

## Suite générale finale

- 102 834 tests exécutés.
- 102 833 verts.
- 1 rouge : `REG-01/02/04`, strictement identique sur la baseline HOTFIX83 (`Cannot read properties of null (reading 'name')`).
- Aucun nouvel échec lié au portage.

## Taille migrée

- 793 lignes de source TypeScript réparties sur 5 modules.
- 5 fichiers `.d.ts` générés dans `types/`.
