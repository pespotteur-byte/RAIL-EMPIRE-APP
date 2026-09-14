# Rail Empire — Gameplay Repair RC10

**12 septembre 2026 · Build `S3_GAMEPLAY_REPAIR_RC10_1199repair10` · Base : archive RC9 fournie.**

## Bilan

Le registre historique passe de **75/87 (86,2 %) à 79/87 (90,8 %)**. Quatre dossiers sont clôturés dans leur périmètre défini : **LM06, ECO05, FEAT02, FEAT03**. Il reste **trois partiels et cinq ouverts**. Le dénominateur reste 87 : il ne représente ni tous les bugs possibles, ni une garantie de disponibilité ou d'exactitude de toute la simulation.

La livraison conserve le jeu complet, les ressources RC9, les sources, les déclarations et les bundles précompilés. Les protections raster OSM/ORM de RC9 restent en place ; aucune levée de blocage fournisseur n'est annoncée.

## 1. Mouvement : un seul contrôleur, même hors champ — LM06

`ActiveService.moveMacro` délègue désormais au contrôleur `moveUpdate`, au lieu d'entretenir une deuxième implémentation des limitations, de la traction, du freinage, des incidents, des occupations et des transitions. Les contrôles du train réel ne dépendent plus du choix entre ces deux corps de méthode.

Un deuxième défaut touchait le temps accumulé à basse cadence : une promotion vers le groupe haute fréquence pouvait laisser des secondes dans l'ancien groupe. Le vrai `moveTick` récupère maintenant ce temps une seule fois ; une redescente de cadence ne le rejoue pas, et le changement de groupe ne le tronque pas.

Les **13 nouveaux tests** couvrent huit scénarios à entrées et pas de temps identiques (marche normale, arrivée, passage, rampe, absence de puissance, gazole vide, incident STOP, maintenance), le freinage de fin de liaison, deux contrôles d'accumulation sur le vrai `moveTick`, et deux essais de 360 secondes sur voie partagée. Dans ces derniers, un fret de 750 m immobilisé est protégé face à un suiveur de 750 m, en mouvement complet puis macro : pas de recouvrement, suiveur effectivement freiné.

**Limite :** l'ordonnancement conserve ses cadences différentes, notamment des pas grossiers hors champ. Partager les règles ne rend pas deux intégrations numériques de pas différents universellement identiques. Ces essais ne certifient ni tout réseau dense, ni le replay hors ligne. Le blocage durable utilisateur vers 12 km/h reste **LM03 partiel**.

## 2. Offres industrielles : une destination doit être reliée — ECO05

Le nouveau module strict `freight-network.ts` construit un graphe dirigé à partir des **liaisons connues localement** : voies disposant d'une géométrie valide, chemins V2 de version `VALID` à jour, itinéraires aller et retours legacy explicitement fournis. Les identifiants des gares et des points techniques sont conservés ; la proximité géographique ne crée pas de raccordement.

Les chemins synthétiques, incomplets ou marqués inutilisables sont rejetés. Une géométrie aller n'est pas retournée arbitrairement : le sens inverse exige un itinéraire explicite ou des attributs qui l'autorisent. Les fermetures portées par les voies et les gares du graphe sont prises en compte à la génération. Les occurrences V2 compilées périmées ne ressuscitent pas une version invalidée.

La génération quotidienne filtre les destinations par accessibilité dans ce graphe et par aptitude fret connue de la gare. Le graphe est local à la génération, avec réutilisation des recherches par origine ; **aucune requête OSM/ORM/Overpass supplémentaire** n'est ajoutée. L'interface indique les clients sans liaison connue ou sans équipement fret.

Les **25 tests** comprennent les réseaux isolés, l'orientation, les fermetures, les cycles, 15 000 sommets sans récursion, les chemins V2 obsolètes, les retours explicites et l'appel réel au générateur. **Une liaison inconnue suspend l'offre ; elle n'est pas déclarée impossible sur le réseau réel.** Il ne s'agit pas d'un calcul global de routabilité pour toutes les destinations d'Europe. La compatibilité du matériel, les contraintes dynamiques d'exploitation et la disponibilité d'un sillon restent des contrôles distincts lors de l'affectation et de la circulation.

## 3. Améliorations de gare : les achats atteignent le moteur — FEAT02

La capacité supplémentaire des quais est consultée par le gestionnaire de réservation et le sélecteur des voies numérotées. Le nombre natif de quais n'est pas modifié : le bonus n'est donc pas additionné de nouveau à chaque chargement. Une voie OSM déjà occupée ne devient pas libre parce qu'un module a été acheté.

Le garage payé crée une capacité au dépôt de la gare via `DepotManager`. Il n'apporte ni atelier gratuit, ni stock de carburant offert, ni débit supplémentaire. Les achats suivants préservent les occupations et les extensions payées séparément. Les marqueurs de propriété sont sauvegardés pour éviter la duplication. **Il s'agit d'une capacité de garage au point-gare, pas d'une géométrie ferroviaire créée ni d'un déplacement de rame automatiquement exécuté.** Les manœuvres physiques restent SC21/SC22.

L'équipement fret est maintenant consulté lors du chargement et du déchargement. Les gares fret/mixte et les ITE construits restent utilisables ; le module permet d'équiper une gare qui ne l'était pas. Sans équipement, le fret chargé reste à bord et ne génère pas une livraison fictive.

Les bonus de satisfaction des halls, écrans, restaurants et WiFi alimentent un indicateur issu des voyageurs réellement descendus, pondéré par leur nombre. Cet indicateur est sauvegardé et affiché sur le tableau de bord ; il reste absent tant qu'aucune observation n'existe. Les bonus de fréquentation antérieurs sont conservés.

Les **16 tests** couvrent l'allocation réelle du troisième quai, vingt rechargements sans cumul, l'import d'une sauvegarde sans bonus, les voies physiques occupées, les capacités de dépôt, les achats invalides, le fret, les voyageurs et les sauvegardes. Les achats sont également exercés par clic dans Chromium. Les noms de gare sont échappés dans la vue modifiée ; ce travail limité ne clôture pas **QA03**, qui concerne toutes les vues historiques.

## 4. Consommables, traction et propreté — FEAT03

Les règles sont regroupées dans le nouveau module strict `consumable-effects.ts`. Elles constituent un **modèle de jeu explicite**, pas des valeurs de consommation ou des prescriptions constructeur.

Un réservoir déclaré vide bloque la puissance thermique. L'huile moteur et le liquide de refroidissement épuisés bloquent également la partie thermique ; les fluides de transmission/hydraulique déclarés épuisés affectent les unités motrices concernées par le modèle de rame. Le départ est retenu ; un train en marche freine jusqu'à l'arrêt. La cause reste un manque de ressource et n'est pas convertie artificiellement en panne mécanique.

Un bimode alimenté par une caténaire compatible conserve sa traction même avec le gazole vide et n'en consomme pas. Une locomotive diesel-électrique n'est pas confondue avec un bimode. En composition mixte, seules les puissances effectivement disponibles sont additionnées. Une fréquence de ligne inconnue n'est pas inventée à 0 Hz ; une incompatibilité explicite reste traitée.

Le sable épuisé réduit la traction sous précipitations, sans affaiblir arbitrairement le freinage. Le lave-glace vide limite la vitesse à 80 km/h par précipitations. L'AdBlue ne concerne qu'un équipement déclaré de capacité positive ; à épuisement, la puissance thermique est réduite à 50 %, règle d'équilibrage annoncée. Les consommations suivent la distance réellement parcourue, restent bornées et ne progressent pas à l'arrêt. Les valeurs thermiques dépendent du mode de traction actif ; le découpage spatial d'un pas traversant une frontière d'électrification reste une approximation du moteur.

La propreté affecte la demande nouvelle et la satisfaction observée, sans supprimer les voyageurs déjà présents. Les sauvegardes conservent les niveaux, y compris zéro. Pour compatibilité, une ancienne quantité absente ou une capacité explicitement nulle ne crée pas un équipement ni une panne rétroactive.

Les **24 tests** comprennent les cinq ressources bloquantes, départ/mouvement complet/macro, bimode, diesel-électrique, alimentation, rame mixte, quatre météos, fractionnement, consommation nulle à l'arrêt, propreté et sauvegarde. Une véritable opération d'avitaillement au dépôt consomme le stock et restaure la traction seulement à sa fin.

**Préparation importante :** vérifier les niveaux avant départ et après import. L'exécution complète d'un secours physique en ligne n'est pas livrée ici ; **DDS03/DDS04 restent ouverts**. La correction des conséquences de la panne sèche ne prétend pas résoudre à elle seule sa logistique de récupération.

## 5. Comparaison réelle avec RC9

Le script `QA/RE_REPAIR_RC10/before-after.mjs` emploie les mêmes API de production sur la copie intacte RC9 puis sur RC10. Les résultats sont conservés dans `BEFORE_RC9.json` et `AFTER_RC10.json`.

| Scénario | RC9 | RC10 |
|---|---|---|
| Arrivée : mêmes entrées et pas de 0,1 s | Full 79,97624 km/h ; macro 79,98085 km/h | Full et macro 79,97624 km/h |
| Achat d'un quai, deux places déjà prises | Troisième train refusé | Troisième train admis |
| Achat d'une voie de garage | Aucun dépôt créé | Une capacité de dépôt créée |
| Deux gares sans aucune liaison ferroviaire | 9 offres générées | 0 offre inventée |
| Diesel vide, parti à 80 km/h, après 100 s | Environ 120,884 km/h | Arrêt, motif « Gazole épuisé » ; pas de fausse panne mécanique |

Ce sont des reproductions ciblées, pas une mesure de fréquence des anomalies chez tous les joueurs.

## 6. Tests et intégrité du code

| Contrôle exécuté | Résultat |
|---|---:|
| Compilation et vérifications TypeScript de réparation | Réussies |
| Suite standard `npm test` | **102 834 réussis** |
| Suite de réparation `npm run test:repair` | **474/474**, dont **78 nouveaux** |
| Validation générale `npm run test:s3-regression` | **243/243 fichiers actifs** |
| Fichiers de timing dans cette validation | **35**, exécutés séquentiellement |
| Exclusions historiques | **11**, aucune ajoutée |
| Reconstruction dans un dossier vide | **96 JS + 96 déclarations**, identiques octet pour octet |
| Reconstruction des entrées | **3 bundles et 2 HTML**, identiques |
| Ressources comparées directement au ZIP RC9 | **37 221 fichiers identiques**, aucun retrait sur ce périmètre |

Les suites se recouvrent : leurs résultats **ne s'additionnent pas**. L'outil S3 isole chaque fichier dans son propre processus ; les seuils de performance et la liste des exclusions n'ont pas été assouplis.

Deux anciens tests structurels ont été adaptés : HOTFIX51 cherchait les noms de fluides dans le contrôleur avant extraction, HOTFIX81 exigeait des appels dans le corps macro avant suppression de sa duplication. Ils exécutent désormais le comportement réel correspondant. Aucun test n'est supprimé ; les premiers échecs et l'explication sont conservés dans `LEGACY_TEST_MIGRATION.md` et les journaux historiques de cette RC.

L'audit compte **96 modules applicatifs TypeScript**, zéro JS exécutable applicatif sans source associée, et les tables JS restantes sont vérifiées comme données. La dette reste à **48 `any` explicites et 28 `@ts-expect-error`**, sans augmentation. Les anciennes signatures globales de compatibilité affaiblissent encore la vérification : source TypeScript ne signifie pas typage intégralement strict. Outils de construction/tests et bibliothèques externes sont hors de cette affirmation.

## 7. Navigateur : ce qui est réellement vérifié

Le HTML, la feuille de style et les vrais bundles livrés sont injectés dans Chromium isolé. Les pages sont ouvertes, les interfaces cliquées et le moteur réellement exécuté. Le réseau externe est intercepté, le stockage du harnais est en mémoire.

Les **600 services synthétiques sur corridors indépendants** avancent pendant les changements Carte → Personnel → Incidents → Carte, avec 454 services haute cadence et 146 basse cadence dans ce scénario. Les essais supplémentaires vérifient l'identité de voie après renommage, le dégagement de queue, un passage direct, les opérations économiques déjà protégées, les achats de modules, la sauvegarde et les effets des ressources. Le panneau OSM/ORM et le refus simulé 403 restent vérifiés, avec attribution et capture à largeur 768 px.

L'ouverture native, tant HTTP local que `file://`, est bloquée ici par `ERR_BLOCKED_BY_ADMINISTRATOR`. Ce refus est consigné dans `browser/native-navigation.json`, distinct d'un défaut démontré du jeu. **Les essais injectés ne certifient donc pas le lanceur Windows, Opera/Win7, la sauvegarde réelle du joueur, l'audio distant ou le comportement des fournisseurs OSM réels.** La cause exacte de sa 403 n'est pas observée.

## 8. Performance : coût mesuré, pas promesse de FPS

Mesure isolée Node 22.16 : 5 000 appels au vrai contrôleur macro, après une chauffe et sur sept répétitions, médiane. Les deux versions sont exécutées successivement sans navigateur ni validation de tests en parallèle. Même scénario géométrique, mais les vérifications de jeu nouvellement actives font du travail supplémentaire.

| Composition du scénario | RC9 | RC10 | Variation locale |
|---|---:|---:|---:|
| Objet de rame legacy | 18,625 ms | 22,463 ms | **+20,6 %** |
| Une locomotive + 50 wagons | 26,019 ms | 31,579 ms | **+21,4 %** |

**Cette RC n'est pas présentée comme un gain de FPS.** Ce coût représente ici environ une microseconde supplémentaire par appel de contrôleur. Il ne permet pas de prédire la variation du temps d'image de tout le jeu ni celle du PC du joueur. Les contrôles de timing existants passent, mais une longue session réelle sur son matériel reste nécessaire. Les mesures brutes, la méthode et le périmètre sont livrés dans `BENCH_RC9.json`, `BENCH_RC10.json` et `BENCH_COMPARISON.json`.

## 9. Dossiers non clos et installation

Restent partiels : **LM03** (blocage durable vers 12 km/h), **TIME05** (replay complet après longue absence), **QA03** (échappement HTML de toutes les vues). Restent ouverts : **SC21/SC22** (continuité inter-voies et manœuvres compatibles), **SC28** (plafond absolu de cellules physiques), **DDS03/DDS04** (remorquage physique et autorité de mouvement des secours). Le travail sur OSM/ORM demeure suivi hors du taux historique.

Exportez la sauvegarde RC9, gardez cette version et extrayez RC10 dans un nouveau dossier. Gardez le lancement HTTP local et la même origine de stockage ; réimportez l'export lorsque l'origine change. Contrôlez les consommables et les équipements fret désormais effectifs. Lire `LIRE_AVANT_RC10.md`.

Le manifeste `QA/FILE_SHA256_MANIFEST.txt` couvre les fichiers livrés, sauf lui-même. L'archive finale est relue pour son CRC et pour chaque empreinte du manifeste ; le résultat de scellage et l'empreinte du ZIP sont fournis séparément dans `RE_RC10_PACK_INTEGRITY.json` afin de ne pas créer une référence circulaire. Les preuves historiques RC9 et précédentes restent identifiées comme telles.
