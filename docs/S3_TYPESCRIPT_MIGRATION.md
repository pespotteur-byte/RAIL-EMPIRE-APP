# Rail Empire — Saison 3 / TypeScript Alpha 2

## But

Porter progressivement Rail Empire vers TypeScript **sans modifier le comportement validé de la v1.1.99 HOTFIX83**. Le navigateur continue de charger les mêmes fichiers JavaScript dans `js/`; TypeScript devient la source autoritative des modules migrés et compile vers ces chemins historiques.

## Modules TypeScript actifs

### Alpha 1

- `src/ts/rng.ts` → `js/rng.js`
- `src/ts/operational-time.ts` → `js/operational-time.js`
- `src/ts/train-physics.ts` → `js/train-physics.js`

### Alpha 2

- `src/ts/movement-authority.ts` → `js/movement-authority.js`
- `src/ts/rail-section-geometry.ts` → `js/rail-section-geometry.js`

Alpha 2 introduit des contrats typés explicites pour les états `GO / CAUTION / STOP`, les contraintes de mouvement, l'autorité publiée sur un train, les bindings ORM et les sections ferroviaires directionnelles utilisées par Travaux / Dépôts / ITE.

## Contrat de build

- TypeScript 5.8.x
- `strict: true`
- cible ES2020
- modules ES2020
- déclarations `.d.ts` générées dans `types/`
- JavaScript généré directement dans `js/`
- bundle `file://` reconstruit après compilation

Commandes développeur :

```bash
npm install
npm run typecheck
npm run build:ts
npm run test:s3-alpha2
node tools/typescript/ts-parity-alpha1.mjs <baseline-HOTFIX83>
node tools/typescript/ts-parity-alpha2.mjs <baseline-HOTFIX83>
node scripts/build-file-bundle-v1199.cjs
```

Le ZIP livré contient déjà le JavaScript compilé : **aucun build n'est requis pour jouer**.

## Parité validée

- Alpha 1 : 500 profils `train-physics` synthétiques identiques à HOTFIX83.
- Alpha 2 : 3 000 séquences aléatoires `MovementAuthority` identiques à HOTFIX83.
- Alpha 2 : 3 000 jeux de bindings/routes/sections ferroviaires identiques à HOTFIX83.
- Tests ciblés TypeScript Alpha 2 : 10 406 / 10 406 verts.
- Suite générale : 102 833 / 102 834, avec uniquement le même `REG-01/02/04` déjà rouge sur HOTFIX83.

## Règle de migration Saison 3

1. Migrer un groupe cohérent de modules.
2. Compiler vers les chemins JS historiques.
3. Vérifier la parité avec HOTFIX83.
4. Lancer les tests ciblés puis la suite générale.
5. Reconstruire le bundle `file://`.
6. Ne migrer le groupe suivant qu'après validation.

**Pas de réécriture fonctionnelle pendant le portage.** Les changements de gameplay restent des patchs séparés.

## Candidats Alpha 3

Ordre recommandé :

1. `schedule-v2-model.js` et `rotation-v2-model.js` ;
2. modèles de rame / matériel purs ;
3. `schedule-v2-runtime.js` ;
4. seulement ensuite les gros noyaux `simulation.js` / `schedule-creator.js`.

Le DOM/UI (`ui.js`, LiveMap, éditeurs) reste volontairement après le noyau métier.

## Alpha 10
`world`, `global-stations`, `map`, `terrain3d`, `voie-points` migrés.

## Alpha 11
`account`, `admin-sync`, `a12-model`, `sillon`, `operational-icons`, `tutorial`, `dashboard` migrés.


## Alpha 12
`world-rail-cache`, `works-v2-editor`, `infrastructure-v2-editor`, `depot-ite-point-editor` et `infogare-bitmap-font` migrés.

Cette étape commence la migration des éditeurs DOM/cartographiques. Les frontières UI restent volontairement larges (`any` explicites) lorsque l'ancien contrat est dynamique ; elles seront resserrées après migration de `ui.js`/`main.js`. Les imports cache-bustés `?v=` sont conservés pour le navigateur et documentés localement avec `@ts-expect-error`, car TypeScript ne résout pas ces URLs comme des chemins disque.


## Alpha 13
`schedule`, `ite-modules`, `cargo-types` et `graph-marche` migrés. Le Graphique de Marche est désormais un module TypeScript de bout en bout ; les contrôles zoom/pan ajoutés dans HOTFIX76–80 restent couverts par les tests historiques.

## Alpha 14

- `depot.ts`
- `incidents.ts`
- `staff.ts`
- 60 modules TypeScript au total.
- Les dictionnaires métier historiques restent extensibles via des frontières `Record<string, ...>` explicites.
- Aucun `@ts-nocheck`; comportement JS conservé après émission.

## Alpha 21 — durcissement des frontières générées

- Le portage applicatif est complet : 72 modules TypeScript restent les sources autoritatives.
- Ajout de contrats `.d.ts` dédiés aux cinq modules catalogue générés importés directement par `main.ts`.
- Suppression de tous les `@ts-ignore`; les imports navigateur cache-bustés restants utilisent uniquement `@ts-expect-error`, afin qu'une suppression devenue inutile fasse échouer le typecheck.
- L'audit S3 échoue désormais si un `@ts-ignore` réapparaît.
- Aucun changement fonctionnel/gameplay : les chemins JavaScript et les query strings runtime sont conservés.


## Alpha 22 — contrats runtime/persistance

Alpha 22 commence la réduction contrôlée des `any` explicites après la migration complète : horloge/simulation, banque, matériel roulant, timing V2, horaires saisonniers, synchronisation admin, A12 et stockage disposent désormais de contrats structurels ciblés. L'audit bloque toute remontée au-dessus du plafond Alpha 22.

## Alpha 23 — gate anti-régression déterministe

- Durcissement de `schedule-v2-routing` et `schedule-v2-validation` avec parité JavaScript conservée.
- Gate par fichier de test isolé, séparation fonctionnel / timing-performance, timeouts durs et shardage déterministe.
- Validation finale : 205/205 fichiers de tests actifs verts.

## Alpha 24 — modèle de roulements sans `any`

- `rotation-v2-model.ts` passe de 423 `any` explicites à 0.
- Dette globale ramenée à 7 116 `any` explicites.
- 72 sources TypeScript / 64 662 lignes, 0 `@ts-ignore`, 0 `@ts-nocheck`.
- 113/113 tests ciblés roulements/runtime et gate cumulative 205/205 fichiers actifs verts.
- Alpha source-only : 147/147 fichiers runtime `js/`, `index.html` et les deux bundles sont byte-identiques à l'Alpha 23 officielle ; cache navigateur conservé à `1199ts23`.

