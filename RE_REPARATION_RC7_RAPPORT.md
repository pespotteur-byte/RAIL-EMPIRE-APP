# Rail Empire — Gameplay Repair RC7

## Livraison et point de départ

Cette version repart de l’archive **RC6R réellement disponible et vérifiée**, sans mélanger des correctifs hypothétiques provenant d’une annonce antérieure. SHA256 de la base : `9668e63421741f638546dd102e9a8d331ef91d567c59427220d8ed4fb80cd1a5`.

Le livrable est le jeu complet : sources TypeScript, sorties JavaScript et déclarations, trois bundles, données, images, audio et preuves. Les modules et bundles ont été reconstruits dans un dossier indépendant et comparés. La vérification après compression est fournie séparément dans `RE_RC7_VERIFICATION.json` et le SHA256 de l’archive dans `RE_REPAIR_RC7_SHA256.txt`.

**Avancement suivi : 74 dossiers clos sur 87, soit 85,1 %.** La base RC6R comptait 71/84. Trois nouvelles causes ont été ajoutées et corrigées. Les retouches de physique, de protection des voies et de sauvegarde complètent des familles existantes, sans gonfler le compteur. Six dossiers restent partiels et sept ouverts. Ce pourcentage n’est ni une mesure de tout le code sans bug, ni une estimation du temps restant.

## 1. Passages sans arrêt : le train ne freine plus comme pour un arrêt commercial

### Défaut reproduit

Les branches de fin de liaison imposaient un freinage jusqu’à environ 1 km/h avant d’appeler la transition vers le prochain point. Cette condition s’appliquait aussi aux stops `passage` et `waypoint`. La méthode d’arrivée savait conserver la vitesse d’un passage, mais était appelée après le freinage injustifié.

### Correction

Le mouvement complet et le mouvement macro distinguent désormais l’arrêt réel du passage. Arriver au dernier sommet, ou le franchir pendant un tick, passe à la liaison suivante sans déclencher un freinage de gare. Un arrêt commercial conserve, lui, sa phase de freinage.

La suppression de ce freinage ne supprime pas les contraintes suivantes :

- le prochain véritable arrêt, la prochaine baisse de vitesse et une rupture d’électrification dans l’horizon de freinage sont anticipés au-delà du point de passage ;
- une continuation intermédiaire absente ou dont les extrémités sont disjointes de plus de deux mètres déclenche `PASSAGE_ROUTE_INVALID`, sans téléportation ni validation de l’arrivée suivante ;
- l’occupation par l’arrière et les limites de vitesse encore applicables sont conservées lors du changement de liaison.

**Preuves :** `re-rc7-movement.test.mjs`, groupes `RC7-PASS-*`, et `browser/rc7-memory-smoke.json` → `nonstopPassage`. Le témoin navigateur franchit le point à 30 km/h et continue sur la liaison suivante, sans escale artificielle. Une deuxième observation confirme l’avancement.

**Sources :** `src/ts/schedule-creator.ts`, `_isPassThroughStop`, `_passageContinuationIssue`, `_holdAtInvalidPassage`, `_passageLookAheadCap`, `moveUpdate`, `moveMacro`, `arriveAtStation`.

**Clôture : LM18**, uniquement sur ces chemins reproduits. Ce n’est pas une certification du replay de toutes les contraintes historiques après une longue absence.

## 2. Attente de trois secondes après un changement de liaison

### Défaut reproduit pendant l’essai navigateur

Après une arrivée intermédiaire, `_resetState()` vidait la géométrie mise en cache mais conservait `_routeKey`. L’orchestrateur de mouvement considérait alors que le service était déjà initialisé et pouvait le ranger dans la cadence lente, jusqu’au prochain traitement macro de trois secondes. Le phénomène existait même avec un seul train, indépendamment du nombre total requis normalement pour le LOD.

### Correction

La clé est vidée lors de la réinitialisation. Les deux branches de préparation de `main.moveTick()` vérifient maintenant aussi la correspondance de la liaison et la présence de sa géométrie. Une ancienne clé ne suffit plus à empêcher l’initialisation du tronçon suivant.

**Preuves :** tests `RC7-LOD-*` sur la méthode `moveTick` extraite du vrai module compilé, avec un service réel puis un ensemble de 601 descripteurs ; dans ce deuxième test les autres descripteurs ne sont pas une simulation complète de 600 trains. Le test navigateur distinct utilise, lui, 600 véritables `ActiveService`.

Le passage navigateur corrigé donne `state=moving`, index suivant, vitesse 30 et LOD `high`, avec une distance totale passant de **1,123615933 à 1,127782600 km** entre deux observations.

**Sources :** `schedule-creator.ts` → `_resetState` ; `main.ts` → les deux chemins d’initialisation de `moveTick`.

**Clôture : LM19. Le dossier utilisateur LM03 reste partiel.** Une attente périodique de trois secondes n’est pas la preuve du blocage durable à 12 km/h observé avec sa sauvegarde. Le correctif n’autorise donc pas à déclarer ce symptôme exact définitivement supprimé.

## 3. Cohérence physique du mouvement réel

Les corrections précédentes du calculateur théorique ne garantissaient pas la même chose dans les fonctions de circulation en direct. Cette passe a reproduit des écarts dans ces fonctions.

### Accélération fictive et rampe

Le mode macro utilisait un plancher d’accélération positif. Une formation sans puissance pouvait donc commencer à accélérer sur voie horizontale. Le mouvement réel rejetait également l’accélération nette négative lorsqu’une faible puissance ne permettait pas de soutenir la vitesse en rampe.

La force résultante est maintenant conservée, y compris sans puissance. Le contrôleur laisse la vitesse diminuer sous l’effet de la résistance et de la rampe, même lorsque la vitesse cible reste égale à la vitesse courante. L’absence de puissance ne reçoit plus d’accélération artificielle minimale.

**Tests :** formation de 1 000 tonnes, puissance nulle sur le plat ; formation de 100 kW à 80 km/h dans une rampe de 30 ‰ ; résistance en roue libre ; contrôleur à vitesse cible constante. Les deux modes de mouvement sont testés. Cela ne raccorde pas encore les jauges de carburant et de fluides à la traction : **FEAT03 reste ouvert**.

### Queue du train et changement de liaison

Le macro consulte la même limite d’infrastructure tenant compte de la longueur que le mouvement complet. L’entrée de la locomotive sur une zone plus rapide ne libère pas la restriction tant que l’arrière n’a pas quitté la précédente.

Les restrictions résiduelles sont enregistrées en fonction de la distance effectivement parcourue. Elles survivent au point de passage et à l’arrêt intermédiaire : une attente à quai n’efface pas artificiellement les wagons encore présents sur l’approche. Plusieurs courtes liaisons et restrictions successives sont prises en compte.

L’état est sauvegardé dans le format compact legacy et dans les snapshots V2, normalisé au chargement et restauré lors d’un rollback de catch-up. La fin effective/libération complète du service le vide. Les anciennes sauvegardes sans ce champ restent chargeables, mais ne permettent pas de reconstruire avec certitude toutes les restrictions d’une liaison déjà quittée avant leur enregistrement.

**Sources :** `_computePhysicsAccel`, `_applyPhysicalSpeedTarget`, `_getInfraSpeedLimit`, `_capturePassageTailSpeedLimits`, `_getPassageTailSpeedLimit` ; `schedule-v2-runtime.ts` pour snapshot/restauration/rollback ; nouveau module `tail-speed-index.ts`.

### Barrière de position avant le déplacement

La distance autorisée vers le train physiquement détecté devant est vérifiée **avant** d’appliquer le déplacement dans les deux modes, y compris lorsque le pas atteint une fin de liaison. L’ancien garde-fou intervenant après le mouvement pouvait être contourné par cette transition ; le macro ne possédait pas cette protection équivalente.

Le moteur réutilise le train déjà identifié par son contrôle de proximité ; il ne déclenche pas un parcours supplémentaire de toute la flotte pour cette barrière. Le freinage normal et les réservations de cantons restent actifs. Les essais couvrent un train arrêté devant, en milieu et en fin de liaison, y compris lorsque l’occupation par canton n’est pas enregistrée, afin de vérifier ce dernier recours indépendamment.

**Ces travaux complètent SC03/SC04/LM06 sans trois nouveaux points de clôture. LM06 reste partiel : l’équivalence générale full/macro dans toutes les configurations multi-trains n’est pas certifiée.**

## 4. Réservation des voies et économie du retour

### Une voie explicitement demandée n’est plus remplacée silencieusement

Dans le gestionnaire natif de points de voie, demander `A`, `1 bis` ou `V1M` ne doit pas provoquer la réservation d’une autre voie parce que la première n’a pas été trouvée. Un identifiant appartenant à une autre gare est également refusé. Les alias numériques `V1`, `voie 1` et `1` restent reconnus ; un service sans préférence peut toujours utiliser le choix automatique.

**Limite :** le pont SC-runtime doit encore propager partout une identité physique canonique indépendante du nom. Un libellé fantaisiste ne sera plus remplacé en silence, mais peut désormais conduire à un refus visible. C’est préférable au départ sur une voie différente ; **SC20 n’est pas clos**.

### Retour routé indépendamment

La collecte des kilomètres et métadonnées facturés prenait encore la route aller par ordre inverse lorsque le retour utilisait un itinéraire réellement différent. Elle sélectionne maintenant le tronçon actif du retour.

**Test :** aller de 1 km, retour indépendant de plus de 20 km avec une géométrie et une limite différentes. Le traitement économique reçoit les points et kilomètres du retour, pas ceux de l’aller. Les tarifs ne sont pas changés.

**Clôture : ECO12.** Source : `arriveAtStation()` utilise `_routeForStopIndex()` lors de l’assemblage des tronçons économiques.

## 5. Performances : index des restrictions encore sous la rame

Le nouveau module TypeScript `TailSpeedIndex` regroupe les distances et minima par blocs de 64 segments. Les requêtes sautent les blocs entiers lorsque c’est possible, puis conservent le calcul exact en bordure. Près d’une limite numérique ambiguë, le calcul original est repris. Aucun point, canton ou attribut physique n’est supprimé.

L’index est activé seulement lorsque la géométrie est assez dense et que la longueur du train ferait parcourir beaucoup de segments. Les géométries ordinaires gardent la méthode simple. Un premier prototype activé trop largement augmentait leur coût : ses mesures sont conservées dans `BENCHMARK_INITIAL_NON_ADAPTIVE.json` au lieu d’être dissimulées.

### Mesures finales — 4 000 interrogations de la vraie fonction `_getInfraSpeedLimit`

| Géométrie / rame | RC6R | RC7 | Résultat |
|---|---:|---:|---|
| 1 000 segments de 100 m / rame de 200 m | 0,136 ms | 0,289 ms | Surcoût de 0,153 ms sur le lot |
| 50 000 segments de 10 m / rame de 750 m | 0,715 ms | 0,667 ms | ×1,07 |
| 150 000 segments de 10 cm, limite uniforme / 750 m | 43,834 ms | 4,274 ms | ×10,25 |
| Même densité, limites V30/V160 variables / 750 m | 48,645 ms | 4,357 ms | ×11,16 |

Médianes de neuf mesures après trois échauffements, exécutions séquentielles dans des processus Node séparés. Les valeurs par scénario sont fournies dans `BENCHMARK.json`. Le nouveau chemin est comparé sur **40 000 requêtes individuelles aléatoires reproductibles**, et les checksums de sortie des quatre benchmarks sont identiques. Les mesures submillisecondes des cas ordinaires sont particulièrement sensibles au bruit d’exécution.

Sur le cas dense variable, la première requête après résolution des vitesses coûte environ **0,406 ms au lieu de 0,012 ms**, puis les requêtes profitent de l’index. Son stockage auxiliaire pour ce scénario est de **37 504 octets**, en plus des tableaux de route existants.

**Ce n’est pas une accélération ×11 de tout RE, ni une mesure des FPS.** Le meilleur résultat concerne une géométrie volontairement extrêmement dense. Les services externes, le rendu et la mémoire totale n’ont pas été mesurés par ce benchmark. La construction répétée de géométries inversées legacy et le regard en avant sur de très longues successions de passages restent à profiler ; aucun gain universel sur ces chemins non mesurés n’est annoncé.

## 6. Qualification réellement exécutée

| Vérification | Résultat |
|---|---:|
| Construction TS et contrôles stricts isolés | Réussis |
| Suite standard | 102 834 tests réussis, zéro échec |
| Suite de réparation | 318/318 |
| Nouveaux tests RC7 inclus dans les 318 | 56/56 : 47 mouvement, 8 index, 1 version de build |
| Gate S3 | 235 fichiers actifs réussis sur 235 |
| Recompilation dans un dossier neuf | 91 JS / 91 déclarations identiques |
| Reconstruction indépendante du lancement | 3 bundles et 2 HTML identiques |
| Ressources comparées à RC6R | 37 222 fichiers identiques |
| Navigation Chromium | 15 pages, zéro exception JavaScript non gérée observée |

Les suites se recouvrent. Les nombres ne s’additionnent pas comme autant de vérifications indépendantes.

Sur les **47 tests de mouvement exécutés contre le code RC6R inchangé**, cinq témoins passent et 42 échouent : 35 assertions de comportement et sept appels à des fonctions auxiliaires qui n’existaient pas encore. Ce ne sont pas 42 bugs distincts. La fermeture de trois nouveaux dossiers est conservatrice.

La gate découvre 246 fichiers : 235 actifs et les mêmes 11 anciens fichiers déjà remplacés/exclus dans la base. Aucune nouvelle exclusion n’a été introduite. Quarante-neuf tests contrôlaient littéralement le paramètre de cache `1199repair601` ; seule cette attente a été mise à jour en `1199repair7`, sans assouplir les autres assertions. Un nouveau test vérifie les vrais points d’entrée, en ignorant les commentaires historiques, et le builder actualise les paramètres de cache des deux HTML.

### Limites du test navigateur

La navigation native vers `http://127.0.0.1` et `file://` a été tentée et renvoie `ERR_BLOCKED_BY_ADMINISTRATOR` dans cet environnement. Les essais utilisent donc un DOM Chromium réel, les fichiers fournis injectés et un stockage isolé, sans accès aux services externes.

Le scénario à 600 trains utilise des `ActiveService` réels, répartis sur des corridors synthétiques indépendants : 454 services high et 146 low. Les 600 avancent et restent en mouvement lors des observations Carte → Personnel → Incidents → Carte. Ce n’est pas un réseau densément partagé avec un engorgement réel de quai et une sauvegarde utilisateur.

Les tests incluent également la fenêtre Correspondances, une erreur RH injectée volontairement et affichée comme texte, un clic bancaire au plafond, le snapshot de maintenance et l’administration. L’erreur simulée visible sur la capture d’écran est attendue, non une exception non gérée.

**Pas de certification de l’audio, des tuiles externes, du navigateur Opera de PE ni d’une longue session réelle.**

## 7. TypeScript

L’inventaire syntaxique trouve **91 modules applicatifs TS et 91 sorties compilées**, trois bundles générés et aucune nouvelle source applicative JavaScript sans équivalent TS dans le périmètre contrôlé. Les données pures, outils, tests et références historiques dans QA sont distingués du jeu exécuté.

Il reste **48 `any` explicites**, **28 `@ts-expect-error`**, zéro `@ts-ignore` et zéro `@ts-nocheck`, sans augmentation de la dette contrôlée. Les compatibilités globales anciennes affaiblissent encore certains contrôles. Le nouveau module d’index et de normalisation passe un contrôle strict isolé sans ces compatibilités.

Toutes les sources applicatives en TS ne signifie donc pas tout le typage assaini. Le livrable contient du JavaScript généré parce que c’est ce que son navigateur exécute ; il n’est pas nécessaire d’installer Node ou TypeScript pour jouer.

## 8. Dossiers non clos et installation

Restent notamment : identité physique et manœuvres inter-voies, TAQ/formation, plafond absolu de cellules, cas utilisateur des 12 km/h, équivalence générale full/macro, replay complet des longues absences, contrats industriels non routables, tous les effets d’améliorations et de consommables, remorquage et mouvement sécurisé des DDS, et certaines interpolations HTML anciennes. Le registre détaille les six partiels et sept ouverts.

Avant de lancer : **exporter la sauvegarde**, conserver RC6R, extraire RC7 dans **un nouveau dossier**, sans fusion de fichiers, puis ouvrir son `index.html`. Commencer sur une copie de partie. Les limites physiques rétablies peuvent modifier la vitesse réelle de trains auparavant artificiellement favorisés. Après une longue absence, consulter le journal financier comme pour RC6R.

## 9. Reproduire et relire les preuves

Depuis la racine du jeu, avec la version TypeScript déclarée dans `package.json` disponible :

```sh
npm run build:repair
npm run test:repair
npm test
npm run test:s3-regression
```

Tests nouveaux uniquement :

```sh
node --test js/__tests__/re-rc7-movement.test.mjs js/__tests__/re-rc7-tail-index.test.mjs js/__tests__/re-rc7-build-version.test.mjs
```

Régression contre la référence compilée RC6R (code de sortie 1 attendu, puisqu’elle contient les bugs) :

```sh
RE_BASE="$PWD/QA/RE_REPAIR_RC7/baseline" node --test js/__tests__/re-rc7-movement.test.mjs
```

En PowerShell, définir `$env:RE_BASE` vers ce même dossier avant le test, puis supprimer cette variable pour les essais RC7. La référence ne contient que 24 fichiers d’origine nécessaires aux tests, dont les empreintes sont vérifiées contre le ZIP RC6R ; elle n’est pas une deuxième copie jouable du jeu. Cela évite d’alourdir l’archive avec ses anciens bundles et données.

Benchmark reproductible : `python QA/RE_REPAIR_RC7/run-benchmarks.py`. Il écrit les nouvelles mesures dans le dossier QA ; archiver les résultats de livraison avant de le relancer. Les scripts navigateur sont des harnais de laboratoire dépendant de Chromium/Playwright et du montage local de l’environnement, pas des commandes d’installation du jeu.

Le diff lisible se trouve dans `QA/RE_REPAIR_RC7/RC7_SOURCE_CHANGES.diff`. `QUALIFICATION.json`, `REPRODUCIBLE_BUILD.json`, `BASELINE_MANIFEST.json`, `RESOURCE_PARITY.json`, `TYPESCRIPT_AUDIT.json` et les journaux contiennent les éléments de contrôle. Les preuves antérieures sont conservées dans leurs dossiers de version et ne remplacent pas les journaux RC7 finaux.

Le contrôle de l’intégrité de la livraison avec `npm run verify:repair` doit être exécuté avant de reconstruire ou de rejouer les tests, puisque ceux-ci peuvent actualiser des rapports locaux inclus dans le manifeste. Le manifeste décrit le livrable scellé, pas un répertoire de développement après modification.
