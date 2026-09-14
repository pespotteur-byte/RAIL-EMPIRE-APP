# Rail Empire — checkpoint RC6 de travail

**Ce paquet est une sauvegarde de chantier, pas une RC6 déclarée stable. Conserver RC5 et ne pas écraser une partie de production.**

## Travaux conservés

Le patch ajoute une date d’exploitation persistante pour les services legacy, cherche une occurrence admissible autour de minuit, distingue date de fin et date de départ, réarme une mission récurrente et interdit une reprise à l’origine lorsque la rame est connue dans une autre gare. Les EVO terminées restent des mouvements uniques. Ces changements doivent être qualifiés avec les autres règles d’exploitation avant clôture.

Le calcul physique du SC utilise une enveloppe de restrictions de queue par tas de minimums sur les cellules existantes. Aucune géométrie n’est supprimée. Les décisions d’autorité de mouvement sont sélectionnées en un passage sans tableaux filtrés intermédiaires. Les anciens calculateurs RC5 restent fournis, inchangés, pour comparaison.

Les trois nouveaux fichiers de tests couvrent le calendrier, l’équivalence des restrictions de queue et la priorité/publication des autorités de mouvement. Les tests de calendrier peuvent être rejoués contre RC5 via RE_BASE.

## Résultats enregistrés dans cette tentative

Ces nombres sont extraits des journaux présents. « Non terminé » ne signifie pas « réussi ».

| Journal | Tests | Réussites | Échecs | Fin détectée |
|---|---:|---:|---:|---|
| `rc6-targeted-final.tap` | 26 | 26 | 0 | oui |
| `calendar-rc5.tap` | 14 | 2 | 12 | oui |
| `repair-second.tap` | 222 | 222 | 0 | oui |
| `standard-final.tap` | 102834 | 102834 | 0 | oui |

Gate S3 : `GATE_EXIT=1`.

### Échecs de la suite de réparation conservés

Aucun échec listé dans ce journal. Consulter son indicateur de fin avant de conclure à un succès.

## TypeScript et reconstruction

Les modifications applicatives sont écrites en TypeScript ; les JavaScript exécutables sont des sorties de compilation. Les dettes historiques de typage ne sont pas déclarées résolues par cette conversion. Consulter `TYPESCRIPT_AUDIT.json` et `BUILD_COMPARISON.json` pour les comptages de cette tentative.

## Registre

Le dernier taux de clôture qualifié reste celui de RC5 : **63/77, soit 81,8 %**. Aucun gain de performances n’est compté comme fermeture gameplay. Le défaut des services legacy terminés non réarmés le lendemain est un dossier distinct à intégrer dans le registre de la prochaine version qualifiée ; la présente archive ne prétend pas clôturer SC29 ou ce nouveau dossier sur la seule base des nouveaux tests.

## Limites

Pas de certification navigateur ou de longue partie pour ce checkpoint. Le cas exact du train durablement limité à 12 km/h sur le PC du joueur n’est pas clos. TAQ, continuité des voies, secours, consommables et rattrapage complet restent hors de cette passe.

## Reprise du chantier

La base complète se trouve dans cette archive. Les preuves nouvelles sont dans `QA/RE_REPAIR_RC6`. Le fichier `RC5_TO_RC6_WORK.patch` permet de relire les modifications, et `CHECKPOINT_STATUS.json` contient les résultats structurés. Les échecs doivent être diagnostiqués avant de présenter ce checkpoint comme un nouveau build validé.
