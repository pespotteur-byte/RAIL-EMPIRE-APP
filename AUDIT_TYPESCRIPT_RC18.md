# Audit TypeScript approfondi — RC18 FULL

## Conclusion

**Les sources applicatives inventoriées sont écrites en TypeScript ; le typage strict de bout en bout n’est pas terminé.** Les deux affirmations ne sont pas équivalentes.

Le contrôle compte 115 modules d’implémentation `.ts`, trois fichiers de contrats `.d.ts`, 115 modules JavaScript compilés et trois bundles générés. Aucun module applicatif JavaScript orphelin, aucun script applicatif inline et aucun gestionnaire d’événement HTML inline n’a été détecté dans le périmètre inventorié. Les données, bibliothèques externes, tests et outils de construction ne sont pas assimilés aux sources applicatives. Le navigateur exécute les fichiers JavaScript produits par la compilation.

## Corrections RC18

Le code du worker de sauvegarde n’est plus une chaîne contenant un programme JavaScript écrit à la main. Il est rédigé dans `src/ts/save-serializer-worker.ts`, typé, compilé puis installé à partir de sa fonction émise. Les requêtes et réponses du worker ont des contrats explicites.

Les définitions de ressources, équipements et opérations du dépôt utilisent de vrais types métier. Le registre des requêtes ORM interrompues utilise `AbortController`. Les gestionnaires critiques de la classe principale ont des types explicites. Les erreurs ainsi rendues visibles ont été corrigées, notamment des conversions vers les champs de formulaire et des noms de propriété d’incident.

Les `any` explicites passent de **48 à 36**, sans remplacement par une nouvelle série de suppressions. Le budget par fichier est abaissé en conséquence : réintroduire les douze `any` retirés fait échouer l’audit. Les `@ts-expect-error` restent à **28** ; aucun `@ts-ignore` ni `@ts-nocheck` n’a été ajouté.

Les quatre nouveaux modules (transaction d’état, verrou d’import, worker et identité du build) sont vérifiés dans une configuration isolée : strict, vérification des déclarations, accès indexés potentiellement absents, propriétés optionnelles exactes et variables inutilisées, sans les déclarations globales de compatibilité du jeu.

## Pourquoi la compilation générale ne suffit pas

Le fichier `src/ts/s3-final-legacy-compat.d.ts` conserve cinq signatures d’index très larges, notamment sur `HTMLElement`, `Array`, `UI`, `ORMClient` et `RailEmpire`. Une signature de la forme `[key: string]: any` autorise des accès que des contrats explicites devraient vérifier. D’autres surcharges de compatibilité DOM rendent certains résultats artificiellement non nuls. La configuration générale utilise aussi `skipLibCheck: true`.

L’expérience `scripts/audit-typescript-deep.cjs` retire du programme les cinq signatures globales et active la vérification des déclarations. Elle **ne modifie pas la production, ne supprime pas les surcharges DOM restantes et n’émet aucun code**.

Résultat sur RC18 : **4 688 diagnostics**. Une large part correspond à des propriétés non déclarées, surtout dans l’interface, la classe principale, ORM et le Schedule Creator. Ce nombre ne mesure ni un pourcentage de portage restant ni 4 688 bugs d’exécution. Il démontre que le résultat « zéro erreur » du build compatible ne certifie pas des contrats complets.

## Inventaire de la dette restante

| Fichier | `any` explicites |
|---|---:|
| `ui.ts` | 17 |
| `orm.ts` | 10 |
| `s3-final-legacy-compat.d.ts` | 5 |
| `legacy-ui-compat.ts` | 2 |
| `schedule-v2-model.ts` | 1 |
| `weather.ts` | 1 |
| **Total** | **36** |

Le petit pont de chargement différé `new Function('url', 'return import(url)')` de l’annonceur reste également identifié : ce n’est pas un module métier non porté, mais son existence doit être distinguée du worker auparavant écrit en JavaScript dans une chaîne. Les bibliothèques CDN restent des dépendances externes.

## Critère de fin du chantier

La prochaine étape technique est de remplacer progressivement les propriétés implicites par des contrats de gestionnaires, de composants DOM et de messages réseau, puis de supprimer les signatures globales sans masquage. Les suppressions doivent être justifiées ou retirées après correction. Chaque lot doit conserver les comportements, les compilations isolées, les benchmarks et la reconstruction reproductible.

**RC18 ne déclare donc pas ce chantier clos.** Les preuves sont [l’audit d’inventaire](QA/RE_REPAIR_RC18/TYPESCRIPT_AUDIT.json), [l’expérience stricte](QA/RE_REPAIR_RC18/TYPESCRIPT_STRICTNESS_PROBE.json), [le budget réduit](scripts/typescript-debt-budget.json) et [la configuration des nouveaux modules](tsconfig.rc18-core.json).
