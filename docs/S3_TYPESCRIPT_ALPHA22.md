# Rail Empire — Saison 3 TypeScript Alpha 22

## Objectif

Première passe de réduction substantielle des `any` explicites après Alpha 21, sans changement volontaire de gameplay. La priorité est donnée aux frontières qui transportent des données sensibles : temps, horaires, sauvegardes, matériel roulant et économie.

## Modules durcis

- `engine.ts` : horloge de Paris, callbacks minute/seconde et pas de mouvement.
- `storage.ts` : IndexedDB, sérialisation worker, gzip, migration localStorage et export.
- `schedule-v2-timing.ts` : legs ORM, profil physique, météo et temps calculés.
- `rolling-stock.ts` : modèle matériel, index catalogue et sauvegardes.
- `bank.ts` : contrats emprunts/remboursements et sauvegarde.
- `seasonal.ts` : modes été/hiver, overrides et restauration.
- `admin-sync.ts` : overrides catalogue et incidents administrateur.
- `a12-model.ts`, `schedule.ts`, `account.ts` et interfaces catalogue.

## Garde-fous

- `@ts-ignore` reste interdit.
- `@ts-nocheck` reste interdit.
- aucun JS applicatif ne peut perdre sa source TypeScript.
- l'audit Alpha 22 refuse désormais un total supérieur à **7 599** `any` explicites approximatifs.

## Résultat de la passe

- baseline Alpha 21 : 7 721 `any` explicites approximatifs.
- Alpha 22 : 7 599.
- réduction : **122** annotations `any` supprimées/remplacées par des contrats réels.

## Compatibilité

Le runtime navigateur reste JavaScript précompilé et `file://` reste supporté. Les modifications de cette alpha sont de typage/validation et de structure interne ; aucune règle de circulation, économie ou horaire n'est volontairement modifiée.

## Validation finale

- `npm run typecheck` : OK.
- audit Alpha 22 : 72 modules TS, 5 contrats `.d.ts`, 0 JS applicatif orphelin, 0 `@ts-ignore`, 0 `@ts-nocheck`.
- tests ciblés matériel/banque/timing : **5 507 / 5 507**.
- chaîne Alpha 21 → Alpha 20 → Alpha 19 : **168 / 168**.
- benchmark performance ciblé : **3 / 3**.
- contrats post-bundle `file://` : **14 / 14**.
- smoke test sauvegarde/chargement faible mémoire : OK.
- cache runtime : `1199ts22` dans `index.html` et dans le bundle catalogue différé.

Deux tests historiques de bundle ont été rendus compatibles avec la nomenclature de cache TypeScript (`1199tsXX`) en plus de l'ancienne nomenclature HOTFIX (`1199depXX`); leur exigence fonctionnelle reste inchangée.
