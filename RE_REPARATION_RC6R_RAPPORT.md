# Rail Empire — Réparation et qualification RC6R

Date : 11 septembre 2026. Identifiant de cache : `1199repair601`.

## 1. Provenance et statut

La base réelle est `Rail_Empire_S3_RC6_CHECKPOINT_TRAVAIL.zip`. La dernière version livrée et documentée avant cette reprise était RC5. Les retouches supplémentaires annoncées dans le dernier échange n’étaient pas dans cette archive : elles ont été reconstruites, reproduites et testées pendant cette reprise. Il ne s’agit pas de certifier rétroactivement l’ancienne annonce d’une RC6 finale introuvable.

RC6R conserve les changements du checkpoint (calendrier legacy et optimisations physiques), complète les réparations, recompile les sorties et les trois bundles réellement lancés. Les anciens rapports RC1–RC6 conservés dans le paquet sont historiques ; ce rapport et le registre RC6R décrivent l’état livré.

La qualification décrite ici repose sur la compilation, les tests automatisés, les comparaisons de résultats et les essais Chromium précisés ci-dessous. Elle n’est pas une preuve d’absence universelle de bugs, ni une validation des services externes ou du navigateur de l’utilisateur.

## 2. Résultats vérifiés

| Contrôle | Résultat |
|---|---:|
| Construction TS, contrôles stricts isolés et audit AST | PASS |
| Suite standard `npm test` | 102 834 / 102 834, aucun échec ni skip |
| Suite ciblée `npm run test:repair` | 262 / 262, aucun échec ni skip |
| Nouveaux tests de cette reprise | 40 / 40 |
| Gate globale S3 | 232 / 232 fichiers actifs |
| Recompilation dans un répertoire neuf | 90 JS + 90 déclarations identiques |
| Reconstruction indépendante des bundles | 3 / 3 identiques |
| Navigation Chromium | 15 pages principales, aucune exception JS non gérée |
| Administration Chromium | Import, suppression, édition, échappement et dialogues : PASS |
| Progression réelle hors page | 1 puis 600 ActiveServices, PASS sur les scénarios testés |

Les suites se recouvrent. Les 262 tests incluent les 40 nouveaux et les tests hérités : ces nombres ne s’additionnent pas. Les 232 entrées S3 sont des fichiers de tests, pas 232 assertions. Le runner exécute les 199 fichiers fonctionnels puis 33 fichiers sensibles aux timings en série ; ses 11 anciennes archives supersédées restent documentées avec leurs remplacements, aucune nouvelle exclusion n’a été ajoutée.

### Avant/après des nouveaux cas

Les mêmes 35 nouveaux tests gameplay, exécutés contre le checkpoint inchangé, donnent **24 échecs / 11 réussites**. Ils passent tous après réparation. Les 5 tests supplémentaires portent sur le nouveau module TypeScript des actions HTML ; leur absence dans l’ancienne version n’a pas été transformée en cinq bugs gameplay.

Le checkpoint contenait également 14 tests de calendrier comparés à RC5 : 12 échecs / 2 témoins réussis dans le journal RC5 archivé. Ces 14 tests passent dans la suite actuelle.

Le premier essai S3 de cette reprise a révélé un identifiant de cache non numérique (`1199repair6r`) incompatible avec les contrôles de lancement. L’identifiant final est `1199repair601`, sans relâcher le contrôle. Les anciens tests contenant littéralement RC5/RC6 ont reçu uniquement le nouveau numéro de cache. **49 fichiers de tests existants changent sur cette seule métadonnée, aucune assertion métier préexistante n’est assouplie.** La comparaison automatique est dans CHANGE_PROVENANCE.json. Le journal de l’essai initial est conservé.

## 3. Dépôts : pas de transfert partiellement effectué

`src/ts/depot.ts`, méthodes `enterRame` et `leaveRame`.

Avant : demander une entrée dans un dépôt plein pouvait supprimer la réservation du dépôt de départ avant de découvrir qu’il n’y avait aucune place. La rame n’entrait pas, mais son ancienne voie était devenue libre. Une sortie demandée sur le mauvais dépôt pouvait aussi modifier ses drapeaux de présence.

Après : recherche d’une place ou de la réservation déjà détenue AVANT toute mutation. Le refus ne touche ni aux places précédentes ni à la localisation ou aux états des services. Une entrée répétée ne prend pas deux places ; une vraie entrée/une vraie sortie continue de fonctionner.

Preuves : cinq cas DEPOT dans `js/__tests__/re-rc6r-depot-mileage.test.mjs`. Cette correction n’est pas une refonte des trajets physiques entre dépôts.

## 4. Matériel : une maintenance n’est plus annulée par un service ancien

Nouveau module `src/ts/material-mileage.ts`, raccordé à `_trackWear`, `completeService` et `RailEmpire._saveStateNow`.

Les compteurs de la rame sont désormais la référence ; ceux du train préparé ne sont que des miroirs. Le déplacement augmente une fois le kilométrage, le kilométrage depuis entretien et l’usure restante. La réduction d’usure appliquée par l’atelier n’est pas recalculée à partir d’un ancien kilométrage. Les miroirs sont remis en cohérence au lieu de recopier leur maximum périmé vers la rame.

Un véritable appel de sauvegarde du jeu a été exécuté dans Chromium : rame initialement à 10 000 km / 40 d’usure, service préparé, entretien ramenant les compteurs d’entretien/usure à zéro, puis `_saveStateNow`. **Rame, train et snapshot conservent tous zéro ; les 10 000 km totaux restent présents.** Le transport de stockage a été intercepté uniquement pour observer le snapshot ; le chemin qui le construit est celui du jeu.

Six tests de kilométrage couvrent aussi deux services partageant la même rame, les réductions d’atelier, la fin du service et les deltas invalides. Ce correctif ne rend pas le carburant et tous les fluides physiquement contraignants : FEAT03 reste ouvert.

## 5. Banque : une règle commune au moteur et aux boutons

`src/ts/bank.ts`, `canBorrow`, `borrow`, `render`, `loadFromSave`, `processDailyRepayments`.

Le moteur limite l’encours en principal, alors que l’UI ajoutait les intérêts pour refuser un emprunt. Le même test d’éligibilité est maintenant utilisé pour l’état du bouton, le clic et l’attribution effective. Exemple reproduit dans le vrai DOM : base 20 M€, plafond en principal 10 M€, emprunt 10 M€ accepté et trésorerie passant de 20 à 30 M€.

L’affichage initial prévisualise le plafond sans modifier la trésorerie de référence. Un `startingBalance: null` sauvegardé reste non initialisé, au lieu de devenir zéro et de désactiver de fait la limite après rechargement. Les refus n’affectent pas les comptes ; le nombre maximal d’emprunts reste appliqué.

Autre correction : un ancien emprunt chargé avec 1 000 € restants, un dernier jour et une échéance incohérente de 1 € ne disparaît plus après le paiement de 1 €. Sa dernière échéance règle son reliquat. Une même date de remboursement ne débite pas deux fois, y compris après sauvegarde.

Huit tests bancaires et un clic dans Chromium. Les politiques historiques pour une base de crédit non positive n’ont pas été redéfinies ; aucune prétention à simuler une vraie banque.

## 6. Calendrier legacy et remise en service quotidienne

Changements du checkpoint RC6 maintenant intégrés et qualifiés : date d’exploitation distincte de la date d’horloge, service retardé du lundi 23 h 59 admis mardi 0 h 03 avec quatre minutes de retard, cohérence des jours spécifiques et sauvegardes, fin après minuit qui ne consomme pas le service du lendemain. Un service terminé est réarmé pour une occurrence ultérieure ; un déplacement automatique EVO reste unique.

Compléments de cette reprise : remise à zéro de l’identité affichée de l’aller, des états ITE transitoires, des efforts de traction/freinage, du dernier instant d’arrivée et des accumulateurs de mouvement de l’occurrence précédente. Les pannes et la maintenance réelles ne sont pas supprimées. La position connue de la rame reste contrôlée : réarmer ne signifie pas la téléporter depuis son terminus vers l’origine.

Preuves : `re-rc6-calendar.test.mjs` (14) et `re-rc6r-calendar-reset.test.mjs` (5). Cela ne refond pas la gestion des voies exactes, ni les manœuvres de rebroussement : SC20–SC22 restent non clos.

## 7. Petits deltas, longues pauses et dates importées

`src/ts/shunting.ts` : un grand delta traverse les phases successives, mais seul le temps nécessaire jusqu’à la fin entre dans `totalElapsed`. Une manœuvre de 60 minutes ne reçoit plus arbitrairement 1 060 minutes de durée après une pause. Les opérations indépendantes n’absorbent pas le temps excédentaire les unes des autres. Tests par pas unitaires, grandes étapes, fractions et sauvegarde.

`src/ts/gameplay-clock.ts` : contrôle civil réel des dates, années bissextiles incluses ; un 30 février n’est pas simplement validé par sa forme. Les timestamps hors domaine de Date sont rejetés avant Intl. Une date invalide ne marque pas une tâche quotidienne comme effectuée. Le registre est sans prototype hérité.

Le rattrapage quotidien est borné à 31 dates par tick, sans les perdre : les journées restantes restent dans le registre pour les ticks suivants. Un test vérifie une année entière. Cela évite de construire/exécuter tout un arriéré pluriannuel dans un seul tick. **Il ne s’agit pas d’un replay chronologique complet des mouvements, arrêts, recettes et infrastructures : TIME05 reste partiel.** Comme dans les réparations précédentes, les règlements manqués peuvent impacter le solde à la reprise.

Preuves : 11 tests dans `re-rc6r-clock-shunting.test.mjs`.

## 8. TypeScript : inventaire réel

90 modules applicatifs `.ts`, 90 sorties `.js`, 90 déclarations recompilées identiquement ; trois bundles générés. Le nouveau module `launch-actions.ts` remplace les deux gestionnaires `onclick` qui subsistaient dans `index.html` (administration et fermeture de fiche horaire). Le texte de confirmation et la destination sont inchangés ; les liaisons ne s’accumulent pas au rappel.

L’audit AST détecte désormais aussi les gestionnaires d’événements inline du HTML. Résultat : aucun JS applicatif non apparié à une source TS, aucun script ou gestionnaire inline dans les deux points d’entrée. Les 85 fichiers JS de données pures sont vérifiés comme tables équivalentes à du JSON ; les outils de test/construction et les bibliothèques externes restent hors de la promesse de sources applicatives TS.

**48 `any` explicites, 28 `@ts-expect-error`, zéro `@ts-ignore`, zéro `@ts-nocheck`.** Les compatibilités globales historiques DOM/Array/UI/ORM restent permissives. Ce n’est pas du typage intégralement assaini. Les six modules couverts par `tsconfig.rc6r-core.json` passent néanmoins un contrôle strict isolé sans ces compatibilités.

Preuves : TYPESCRIPT_AUDIT.json, REPRODUCIBLE_BUILD.json, cinq tests `re-rc6r-launch.test.mjs` et `npm run typecheck:rc6r-core`.

## 9. Performances — mêmes décisions, moins de calculs

Les optimisations du checkpoint sont conservées et maintenant qualifiées avec la suite entière : enveloppe de restrictions de queue via une structure des restrictions actives, et sélection de l’autorité de mouvement en un passage. Le train ne gagne pas sa vitesse en oubliant les signaux ou en retirant des segments.

Mesures sur les fonctions réelles de RC5 et celles livrées en RC6R ; processus isolés, trois échauffements, neuf échantillons, médianes :

| Scénario | RC5 (ms) | RC6R (ms) | Rapport RC5 / RC6R |
|---|---:|---:|---:|
| 500 km, 50 000 segments, V160 uniforme | 10.438 | 5.735 | ×1.82 |
| 500 km, 50 000 segments, V120/V160 alternés | 5.326 | 5.053 | ×1.05 |
| Stress artificiel : 150 000 segments de 10 cm, restrictions rapprochées | 1467.682 | 151.262 | ×9.70 |
| 40 000 cycles complets d’autorité de mouvement | 27.138 | 16.658 | ×1.63 |

Les valeurs de sortie comparées sont identiques dans ces quatre scénarios. Les tests de non-régression des enveloppes et décisions couvrent en outre des profils aléatoires reproductibles et le départage des contraintes. Le cas dense est volontairement artificiel : ce n’est pas une ligne OSM représentative. Le gain de 5 % sur le parcours varié est faible et ne doit pas être présenté comme garanti hors de cet essai.

**Ces mesures ne sont pas des FPS, ni un benchmark de toute la flotte ou du PC de PE.** Elles ne prouvent pas non plus une baisse de toute la mémoire du jeu. Le benchmark conserve ses échantillons bruts, premier appel et paramètres dans BENCHMARK.json ; le worker garde l’étiquette historique RC6 pour le candidat courant, indiquée dans la provenance.

## 10. Chromium, périmètre et limites

Les navigations natives HTTP localhost et `file://` ont été retentées : toutes deux sont bloquées par la politique de cet environnement (`ERR_BLOCKED_BY_ADMINISTRATOR`). Les scripts ont donc injecté les fichiers fournis dans un vrai DOM Chromium, avec stockage en mémoire et chargement local contrôlé. Il ne s’agit pas d’un navigateur DOM factice, mais ce n’est pas une exécution native du ZIP depuis le PC de l’utilisateur.

Quinze pages principales ouvertes : Carte, Matériel, Rames, Horaires, Roulements, Lignes, Dépôts/ITE, Incidents, Infogare, Dashboard, Graphique, Personnel, Météo, Marchandises et Industriels. L’ouverture d’une page ne certifie pas chaque bouton ou chaque scénario métier de cette page.

Le dialogue Correspondances et sa politique flexible passent. Une erreur RH est volontairement injectée, son diagnostic reste du texte échappé et le jeu continue. L’édition/import de l’administration et sa résistance au nom contenant des balises passent. Le catalogue local est utilisé ; les APIs externes et les voix ne sont pas certifiées.

La boucle réelle du jeu déplace un ActiveService pendant Carte → Personnel → Incidents → Carte, puis 600 services sur des corridors synthétiques indépendants. Les quatre observations ont chacune 600/600 services en mouvement et 600/600 dont la distance a progressé. Répartition observée : 454 high / 146 low. Aucune mise à jour physique manuelle n’a remplacé la boucle du jeu. Cet essai n’est ni une simulation d’interlocking dense à 600 trains, ni une mesure de fluidité, ni une preuve sur la sauvegarde de PE. **LM03, le blocage durable à 12 km/h, reste partiel.**

Fichiers : `browser/rc6r-memory-smoke.json`, `browser/rc6r-admin-smoke.json`, captures et scripts relançables dans ce dossier. Aucune erreur JavaScript non gérée observée ; les avertissements réseau inhérents au mode isolé sont conservés.

## 11. Registre, ressources et livrable

71/84 = 84,5 % de dossiers connus clos, contre 63/77 pour RC5. Un dossier ancien confirmé et sept nouveaux dossiers clos ; aucun partiel converti en point artificiel. Le registre complet et ses limites sont fournis séparément et dans le paquet. Les anciennes clôtures RC5 sont héritées avec leurs tests, pas une nouvelle inspection exhaustive de toutes leurs branches.

Les principales zones ouvertes restent les voies exactes et manœuvres, TAQ, secours/remorquage et leurs règles de circulation, replay des longues absences, contrats générés entre réseaux déconnectés, consommables, autres effets des améliorations de gare et échappement des anciennes vues.

**37,155 ressources** dans `data/`, `img/`, `audio/` et les trois fichiers de catalogue contrôlés sont inchangées par rapport au checkpoint. Les assets n’ont pas été supprimés pour gagner du temps. Le patch de cette reprise est `RC6_CHECKPOINT_TO_RC6R.patch` ; la provenance de l’archive source et des changements de tests est fournie en JSON.

Le paquet complet contient sources, sorties compilées et données. Le manifeste `QA/FILE_SHA256_MANIFEST.txt` est régénéré après les rapports, puis les fichiers de l’archive sont relus et comparés au manifeste. Son entrée auto-référente est nécessairement exclue ; le SHA256 externe porte sur le ZIP entier. Le résultat d’intégrité final est fourni à côté de l’archive, sans dépendre de l’annonce textuelle de cette réponse.

## 12. Utilisation et reproduction

Exporter la sauvegarde, conserver RC5, extraire RC6R dans un nouveau dossier sans mélanger les versions. Lancer `index.html` : aucune installation de TypeScript n’est requise pour jouer. Commencer sur une copie de partie ; consulter le journal financier après une longue absence. Ne pas écraser l’unique sauvegarde d’origine.

Pour les développeurs, avec TypeScript 5.8.3 disponible :

```sh
npm run build:repair
npm test
npm run test:repair
npm run check:s3
npm run verify:repair
```

Les tests externes réseau sont simulés, les anciens échecs sont conservés comme historique. Recompiler réécrit les bundles/audits ; si des fichiers sont volontairement modifiés, le manifeste doit être régénéré avant de créer un nouveau paquet et ne doit plus être présenté comme celui de la livraison originale.
