# Rail Empire — Saison 3 TypeScript Alpha 21

## Objectif

Alpha 21 démarre la phase de durcissement après la migration applicative complète atteinte en Alpha 20. Aucun changement de gameplay n'est introduit.

## Changements

- 72 modules applicatifs restent sous source TypeScript autoritative.
- Ajout de 5 contrats de déclaration `.d.ts` pour les modules catalogue générés directement consommés par `main.ts`.
- Suppression de tous les `@ts-ignore` des sources TypeScript.
- Les imports navigateur volontairement cache-bustés (`?v=...`) restent inchangés au runtime et utilisent `@ts-expect-error` plutôt que `@ts-ignore`.
- L'audit S3 échoue désormais si un `@ts-ignore` ou un `@ts-nocheck` réapparaît, ou si un module JS applicatif perd sa source TS.
- Identité du bundle `file://` portée à `S3-TYPESCRIPT-ALPHA21`.

## Audit final

- Modules TypeScript : 72
- Contrats `.d.ts` générés/legacy : 5
- Lignes TypeScript : 64 103
- JS applicatifs sans source TS : 0
- `@ts-nocheck` : 0
- `@ts-ignore` : 0
- `@ts-expect-error` : 28 (imports navigateur avec query string uniquement)
- `any` explicites approximatifs : 7 721 — prochaine cible de durcissement.

## Validation

- `npm run typecheck` : OK
- chaîne Alpha 21 -> Alpha 20 -> Alpha 19 : OK
- suite Alpha 19 : 168 / 168 OK
- benchmark performance ciblé : 3 / 3 OK
- après reconstruction du bundle `file://` : 29 / 29 tests sensibles/bundle OK

## Parité runtime

Les seuls écarts JavaScript directs par rapport à Alpha 20 sont des commentaires TypeScript émis, le retrait de commentaires `@ts-ignore`, et l'identité de build Alpha 21 dans les bundles. Les imports, fonctions et chemins runtime sont conservés.
