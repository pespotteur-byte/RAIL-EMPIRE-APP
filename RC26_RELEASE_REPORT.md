# Rail Empire 1.1.99 — RC26 TRAFFIC CLASS RULES FINAL

## Portée
RC26 conserve RC25 et ajoute les dernières règles métier du Schedule Creator / incidents avant livraison.

## Règles de classification
- **Voyageur** : seul type éligible à `Malaise voyageur` et `Forte affluence à bord`.
- **Fret, W, HLP, TM, Infra, TTX** : exclus de ces deux incidents.
- **W** signifie matériel voyageurs vide.
- **W, HLP, TM** : aucun chargement voyageurs/fret/contrat ; un ancien état chargé est remis à zéro au rechargement et au passage en gare.
- Les variantes techniques legacy `M-` et `EVO` restent traitées comme mouvements vides.
- `Problème de porte` n’est pas modifié : il reste un incident matériel et peut donc toucher une rame W disposant de portes/capacité.

## Robustesse
- Les contrats fret cachés sont supprimés lors du passage vers W/HLP/TM.
- Les snapshots legacy et V2 ne peuvent pas réinjecter un chargement dans un mouvement vide.
- Le marqueur cache historique `1199repair24` est volontairement conservé : il fait partie du contrat QA de la branche 1.1.99, tandis que l’identité sémantique du build est RC26.

## Validation
- TypeScript build : **PASS**.
- TypeScript typecheck : **PASS**.
- Tests ciblés HOTFIX84 : **6/6**.
- Régression S3 : **278/278 fichiers actifs** (4 shards, 0 échec).
- Suite Repair historique : **1084/1084 tests**.
- Contrats cache/build RC7 + 3D courants : **PASS**.
