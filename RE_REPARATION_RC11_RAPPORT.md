# Rail Empire — Rapport de réparation RC11

Build : `S3_GAMEPLAY_REPAIR_RC11_1199repair11` — 12 septembre 2026.
Base réelle : archive RC10 fournie, SHA-256 `50a999bce0db631a4c8c6d28b67f76119f938dd071129ea5e0e838780b5d3d45`.

## Résultat et portée

**83/87 dossiers historiques clos : 95,4 %.** Quatre clôtures depuis RC10 (79/87) : SC21, SC22, SC28, QA03. Restent partiels LM03 et TIME05 ; restent ouverts DDS03 et DDS04. Le registre distingue précisément correction d’un défaut, fonctionnalité non implémentée et comportement non reproduit sur la sauvegarde du joueur.

Ce n’est ni un pourcentage de « tous les bugs possibles », ni une probabilité de fiabilité. Aucun nouveau dossier n’a été retiré du dénominateur. Le traitement client des refus OSM/ORM hérité de RC9 est conservé, mais aucune levée de la 403 réelle n’est affirmée.

## SC21 — Continuité physique entre services

Le contrôle de disponibilité ne s’arrête plus au nom de la gare. Une identité de voie native/OSM connue est transmise par le matériel, les arrêts compilés, les véhicules détachés et les sauvegardes. Le libellé peut changer sans changer l’identité physique. Les alias sont limités aux références physiques compatibles ; deux voies portant le même nom ne sont pas automatiquement identiques.

Un départ situé sur une autre voie est retenu avec `MATERIAL_TRACK_TRANSFER_REQUIRED`. Cela s’applique aussi au retour. Le retour implicite ne remplace plus automatiquement une voie paire par une voie impaire. Une ancienne position inconnue reste assignable à la première utilisation ; une position physique connue ne peut pas être effacée par un libellé vide.

Un transfert explicite dans la même gare est testé avec le véritable contrôleur de mouvement : A/voie 1 → jonction → A/voie 2. Des positions intermédiaires sont atteintes avant la disponibilité en voie 2. Ce n’est pas une mutation immédiate d’un identifiant. Une annulation en ligne conserve une localisation technique aux coordonnées réelles, au lieu d’envoyer le matériel à la prochaine gare prévue. Modifier les spécifications d’un véhicule détaché ne le remet plus à l’emplacement de sa rame d’origine.

**Limite : aucun plan automatique général de triage/remise en tête n’est inventé.** Le transfert requiert un itinéraire explicite valide. Les tests de mouvement/occupation existants restent actifs.

Preuves : `re-rc11-material-track.test.mjs` (17 cas) ; `BEFORE_AFTER.json` compare les deux runtimes réels. RC10 créait un service depuis la mauvaise voie ; RC11 le retient.

## SC22 — TAQ et changement de cabine

Le drapeau TAQ, auparavant perdu lors de la compilation V2, est conservé dans les arrêts, versions ajustées, sauvegardes et retours. Un TAQ impose un arrêt réel, y compris sur un arrêt précédemment facultatif.

La composition doit disposer d’une traction active et d’un poste de conduite à l’extrémité qui deviendra la tête. Une locomotive seule ou une composition réversible déclarée peut effectuer un changement de cabine. Une rame terminée par un wagon ordinaire reste retenue pour remise en tête : attendre longtemps ne suffit plus à la rendre fictivement réversible.

Les 300 secondes minimales sont une **règle du jeu**, mesurée depuis l’arrivée réelle et après les opérations de composition. Ce n’est pas une durée réglementaire ni constructeur. L’attente survit à minuit et au rechargement ; une modification de composition relance la préparation. La voie reste occupée. Une anomalie de géométrie sous la rame empêche l’application.

À la fin de l’opération, la référence passe de l’ancienne tête à l’ancienne queue : l’empreinte physique de la rame ne translate pas et aucun kilomètre fictif n’est ajouté. L’ordre des éléments et leur orientation sont inversés ; la géométrie de départ doit reprendre la voie effectivement occupée. Le terminus n’efface pas le train avant l’opération, et le retour automatique ne change pas de cabine deux fois.

Les régressions ont révélé un cas supplémentaire : restaurer la direction d’un service encore sans rame déréférençait `null`. Le code traite désormais cette absence sans fabriquer une composition ni perdre l’heure réelle d’arrivée.

**Limites :** pas de contournement automatique de locomotive, pas de garantie de compatibilité des télécommandes réelles entre engins. Une composition ou une géométrie inconnue peut rester bloquée avec son motif, plutôt que franchir une manœuvre non définie.

Preuves : `re-rc11-turnback.test.mjs` (21 cas), ancienne suite `tmp-v1199-runtime-snapshot-hardening.test.mjs` inchangée et verte, comparaison de compilation RC10/RC11.

## SC28 — Stockage borné du maillage physique

Le problème d’allocation est traité par fenêtres, et non en supprimant des contraintes. Au-delà de 20 000 cellules, le calcul conserve un pool de 20 000 cellules numériques au maximum et rejoue les fenêtres avec leurs conditions aux frontières. La séquence numérique complète, les restrictions de vitesse, la queue du train, les rampes, les changements d’alimentation et les temps de chaque segment source sont conservés.

**La borne porte sur les cellules simultanément stockées, pas sur le nombre total de cellules évaluées.** Un profil peut encore nécessiter 150 000 ou 1 000 000 étapes. La géométrie d’entrée, les sorties par segment, les événements de restriction et les métadonnées de fenêtres continuent à croître avec les données. Cette correction ne rend donc pas la RAM totale constante et ne garantit pas l’absence d’OOM du navigateur ou du graphe ORM.

Les 12 tests comprennent 700 profils aléatoires comparés à RC10 avec égalité stricte des nombres et tableaux, de petites fenêtres forcées traversant les transitions, un profil dense de 150 000 segments / 1 500 km et une interception d’allocations sur un million de cellules. Aucun relèvement caché du plafond n’est autorisé par le paramètre de test.

### Mesure CPU / mémoire

Environnement : Node 22.16.0, processeur déclaré AMD EPYC 9V74. Trois échauffements, neuf passes intercalées RC10/RC11, médianes ci-dessous ; GC forcé hors chronométrage. Les entrées sont identiques et les résultats vérifiés. Les durées ne prédisent pas celles de Win7/Opera.

| Scénario | RC10 | RC11 | Rapport CPU RC11/RC10 | Octets des colonnes de cellules RC10 → RC11 |
|---|---:|---:|---:|---:|
| ordinary_300_source_segments | 0.812 ms | 0.827 ms | ×1.02 | 27 000 → 27 000 |
| dense_150000_sources_1500km | 18.999 ms | 68.324 ms | ×3.60 | 6 750 000 → 400 000 |
| one_million_cells_2000km | 43.221 ms | 95.627 ms | ×2.21 | 45 000 000 → 400 000 |

**Le chemin fenêtré est plus lent sur ces grands profils : environ ×3,60 et ×2,21.** Le petit profil varie d’environ 2 %, sans conclusion de gain. Le compromis est mémoire contre calcul supplémentaire ; il ne faut pas transformer ces mesures en gain de FPS. Les octets ci-dessus ne sont pas la RAM totale : ils correspondent aux colonnes numériques identifiées, hors entrées/sorties/métadonnées, ramasse-miettes et environnement.

Preuves : `PHYSICS_BENCHMARK.json`, script `benchmark-physics.mjs`, `re-rc11-physics-workspace.test.mjs`. La clôture SC28 concerne le plafond d’allocation résidente décrit ici, non une borne du travail total.

## QA03 — Les noms restent du texte

Un encodeur commun protège les textes et attributs HTML ordinaires au moment de l’affichage. Les anciens gestionnaires de clics disposent d’un encodage séparé pour leurs arguments JavaScript. Les noms sauvegardés ne sont pas transformés en entités HTML.

La revue a porté sur 25 modules d’interface, avec reprises des textes indirects et fragments imbriqués : matériel, rames, horaires, roulements, dépôts, personnel, clients industriels, travaux, infogares et autres panneaux. Les fragments HTML intentionnels sont conservés ; leurs noms dynamiques sont encodés aux points d’insertion. Un double encodage détecté pendant la revue a été évité.

Les 21 tests utilisent notamment accents, apostrophes, guillemets, esperluettes, balisage de test et identifiants capables de casser une chaîne mal construite. Dans Chromium, 13 vues sont insérées dans un vrai DOM : aucun élément injecté, aucun code de test exécuté, noms inchangés et deux boutons transmettant exactement leurs identifiants spéciaux. Le nom d’une marchandise imbriqué dans une capacité de rame est également couvert.

**Portée : défaut d’interprétation HTML des noms, pas certification générale de sécurité.** Le filtrage de protocoles d’URL, CSS, extensions, fichiers arbitraires et toute surface non exercée ne sont pas déclarés couverts par ces tests. L’infrastructure d’anciens boutons inline n’est pas entièrement réécrite ; leurs arguments sont encodés.

Preuves : `re-rc11-html-text.test.mjs`, `browser/rc11-memory-smoke.json`, `BEFORE_AFTER.json`. Les inventaires AST et migrations sont conservés dans `HTML_BOUNDARY_PATCHES.json` et `HTML_BOUNDARY_REFINEMENTS.json` ; ces nombres de frontières ne sont pas des nombres de bugs indépendants.

## Qualification de la livraison

| Contrôle | Résultat |
|---|---:|
| Compilation et groupes de vérification TypeScript, dont nouveau noyau RC11 | Réussis |
| Suite standard | 102 834 réussites, zéro échec |
| Suite réparation | 545/545, dont 71 nouveaux cas |
| Régressions S3 | 247/247 fichiers actifs |
| Répartition S3 | 212 fonctionnels, 35 timing exécutés séparément |
| Anciennes archives de tests supersédées | 11, manifeste inchangé depuis RC10 |
| Reconstruction indépendante | 100 modules JS et 100 déclarations identiques |
| Bundles et entrées reconstruits indépendamment | 3 bundles et 2 pages HTML identiques |
| Ressources comparées directement au ZIP RC10 | 37 221 identiques, zéro ressource retirée/modifiée |
| Sources applicatives | 30 modules existants modifiés et 4 nouveaux |
| Dette TypeScript déclarée | 48 `any` explicites, 28 `@ts-expect-error`, sans augmentation |

Les suites se recouvrent et ne s’additionnent pas. La grande suite standard inclut des essais générés ; 102 834 ne signifie pas autant de bugs distincts corrigés. Aucune nouvelle exclusion n’a été ajoutée. Les seules adaptations d’anciennes assertions concernent 69 occurrences du token de version dans 49 fichiers, conservant le même contrôle d’invalidation du cache. La panne de restauration trouvée par un ancien test a été corrigée dans le code, pas contournée en retirant le test.

L’audit trouve 100 modules applicatifs écrits en TypeScript, sans JS exécutable applicatif non apparié. Les bibliothèques tierces, données JS équivalentes JSON, outils de construction et tests sont hors de cette déclaration. Des signatures d’index permissives héritées dans les contrats DOM/UI/ORM affaiblissent encore le typage : couverture des sources ne signifie pas stricteté complète.

### Navigateur

Le vrai bundle démarre, 15 pages sont parcourues, et 600 trains synthétiques sur 600 avancent au cours des quatre observations carte → personnel → incidents → carte, sans exception de page. Les contrôles d’occupation, de passage sans arrêt, de sauvegarde après maintenance, de banque, des modules de gare et des protections OSM/ORM sont rejoués. Les nouveaux encodeurs et les modules de continuité/TAQ/physique sont aussi chargés depuis le bundle réellement livré.

Le bundle administrateur autonome a également été exécuté dans Chromium : tableau de catalogue présent, recherche sans résultat fonctionnelle et aucune exception de page. Ce contrôle confirme notamment la présence de sa nouvelle dépendance d’encodage.

La navigation HTTP et `file://` native a été tentée dans cette session : Chromium la refuse avec `ERR_BLOCKED_BY_ADMINISTRATOR`. Les essais utilisent donc les fichiers fournis injectés dans un vrai DOM, un stockage mémoire et un réseau externe intercepté. Cela ne certifie pas le lanceur Win7/C#, Opera, l’accès OSM réel, l’audio réel, ni la sauvegarde personnelle du joueur. Les scénarios ferroviaires synthétiques ne reconstituent pas le blocage durable utilisateur à 12 km/h.

## Ce qui reste

**LM03, partiel :** blocage durable à basse vitesse signalé par le joueur ; pas de reproduction sur sa sauvegarde. Les transitions LOD corrigées ne sont pas une preuve de résolution générale.

**TIME05, partiel :** pas de replay exhaustif de toutes les interactions du réseau et opérations pendant une longue absence.

**DDS03 et DDS04, ouverts :** déplacement physique de l’ensemble remorqueur/remorqué et intégration complète du secours aux mêmes contraintes de mouvement. Les protections de départ/manœuvre de RC11 ne terminent pas ces fonctionnalités.

La création automatique d’itinéraires de manœuvre et la remise en tête automatique ne sont pas ajoutées. RC11 empêche certains raccourcis irréalistes ; un mouvement non défini peut rester bloqué. Aucun pourcentage supplémentaire n’est attribué à une fonctionnalité seulement retenue pour sécurité.

## Fichiers et reproduction

Le jeu se lance depuis la racine, pas depuis le dossier de référence `QA/RE_REPAIR_RC11/baseline`. Consulter `LIRE_AVANT_RC11.md` avant l’import de sauvegarde. Le ZIP contient les sources, bundles, ressources, quatre nouveaux fichiers de tests, les preuves et les historiques.

Les scripts de reproduction sont dans `QA/RE_REPAIR_RC11/README.md`. `SUMMARY.json` synthétise les résultats vérifiés. Le manifeste `QA/FILE_SHA256_MANIFEST.txt` est recalculé au scellement ; le ZIP est ensuite relu, vérifié par CRC et comparé à toutes les empreintes. Le compte exact et le SHA-256 de l’archive sont consignés dans le fichier de contrôle externe `RE_RC11_PACK_INTEGRITY.json`.
