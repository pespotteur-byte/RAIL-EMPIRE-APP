# Rail Empire — Gameplay Repair RC4 / TypeScript & performances

Date : 11 septembre 2026. Base immutable : `Rail_Empire_S3_GAMEPLAY_REPAIR_RC3.zip`. Build : `S3_GAMEPLAY_REPAIR_RC4_TS_PERF`.

## Résultat de cette livraison

La RC4 conserve les réparations RC1–RC3, migre les derniers modules applicatifs catalogue et l’administration vers TypeScript, optimise le calcul physique et les recherches de présence au cantonnement, élimine un plantage de grands sillons et le redessin forcé par les secours hors écran.

**Registre gameplay : 60 dossiers clos sur 77 (77,9 %).** RC3 comptait 58 sur 76. LM17 est clos et le nouveau SC30, découvert puis corrigé, est ajouté. Les tâches TypeScript, les gains de performance et l’administration ne sont pas convertis en points de « correction globale ». Voir `RE_REGISTRE_CORRECTIONS_RC4.md`.

Il reste 8 dossiers partiels, 7 ouverts et 2 à confirmer. Ce build n’est pas une certification d’absence de tout bug. Le blocage durable vers 12 km/h décrit par le joueur demeure partiel ; aucune nouvelle reproduction de ce scénario sur son ordinateur n’est prétendue.

## 1. Performance : mesures avant / après

Mesures obtenues avec les vraies fonctions JS issues de RC3 et RC4, chacune dans un processus Node isolé. Pas de modifications de règle pour obtenir un meilleur score.

| Travail exécuté | RC3, médiane | RC4, médiane | Accélération du travail mesuré |
|---|---:|---:|---:|
| Calcul physique : 500 km, 50 000 segments | 30.52 ms | 7.41 ms | ×4.12 |
| Calcul physique : 1 500 km, 150 000 segments | 43.79 ms | 19.14 ms | ×2.29 |
| 4 000 contrôles de canton parmi 1 000 services | 8.28 ms | 0.43 ms | ×19.27 |
| 20 000 contrôles de canton parmi 5 000 services | 191.51 ms | 2.29 ms | ×83.58 |

Ce tableau **n’est pas une mesure des FPS du jeu entier**, ni une garantie d’une flotte maximale. Les deux lignes canton mesurent des contrôles d’occupation, pas une simulation complète de 1 000/5 000 trains. Le cas choisi contient des cantons réellement occupés et vérifie qu’aucun n’est déclaré libre par erreur. L’ancien code parcourt souvent une grande fraction de la flotte ; l’index en évite la répétition.

### Méthode reproductible

CPU hôte : AMD EPYC 9V74 80-Core Processor. Node v22.16.0, Linux x64. Trois tours d’échauffement, neuf échantillons par version et scénario, médiane reportée. Le garbage collector est demandé avant chaque échantillon, hors de la mesure. Les processus RC3 et RC4 sont distincts. Les neuf valeurs, le maximum observé, les entrées et les résultats sont dans `QA/RE_REPAIR_RC4/BENCHMARK.json`.

Les routes physiques sont synthétiques, à segments de 10 mètres, avec des sections V160 et des groupes V30 répétés ; la formation est de 500 tonnes, 5 MW, 200 mètres. Le chronomètre couvre le calcul physique, pas le téléchargement ORM ni le dessin de carte. Les contrôles canton comprennent la construction de l’index lorsqu’il est effectivement consulté. Ne pas comparer ces temps CPU aux temps d’un itinéraire réel sur le PC du joueur.

### Mémoire de processus, pas « RAM de RE »

| Travail exécuté | Pic RSS RC3 | Pic RSS RC4 |
|---|---:|---:|
| Calcul physique : 500 km, 50 000 segments | 90.81 Mio | 63.64 Mio |
| Calcul physique : 1 500 km, 150 000 segments | 143.09 Mio | 112.34 Mio |
| 4 000 contrôles de canton parmi 1 000 services | 29.24 Mio | 33.24 Mio |
| 20 000 contrôles de canton parmi 5 000 services | 36.28 Mio | 37.95 Mio |

Sur les deux cas physiques, le pic du processus baisse d’environ 30 % et 21 %. Pour les recherches canton, l’index consomme au contraire un peu de mémoire supplémentaire : c’est un échange CPU/mémoire, pas un gain universel de RAM. Le RSS inclut Node, les entrées, l’échauffement et le calcul. Il ne mesure pas la mémoire GPU, les tuiles, toute la géométrie ORM ou une longue partie navigateur.

### Optimisation du calcul physique

Fichier : `src/ts/train-physics.ts`, `simulateProfile` (à partir de la zone de discrétisation, vers la ligne 220).

Les objets alloués pour chaque cellule et les copies répétées de paramètres ont été remplacés par des tableaux numériques typés et un objet local de paramètres. La compatibilité de puissance électrique/diesel et la décélération dépendant du segment sont résolues une fois par segment. L’ordre d’accumulation des distances et des temps est conservé.

**Aucun segment ni arrêt n’est retiré pour gagner du temps.** Les limites de vitesse, pentes, électrification, freinage, dégagement de queue, résultats par segment et la convention des vitesses inconnues restent les mêmes. Les tableaux d’entrée et le profil de l’appelant ne sont pas modifiés.

La comparaison porte sur le résultat entier avec `assert.deepEqual`, notamment 250 profils aléatoires reproductibles, un profil figé, une composition mixte, des indices de sortie creux, la puissance nulle et le cas de 400 km V160 terminant à V30. Les tests de régression RC1 restent actifs.

SC28, le plafond de cellules, n’est **pas** clos : la représentation est moins coûteuse, mais le nombre de cellules continue de dépendre de toute la géométrie. Les routes denses ne sont pas arbitrairement décimées.

### Optimisation du cantonnement

Fichiers : `src/ts/simulation.ts`, `beginServiceLookupFrame`, `_lookupPresenceService`, `_isTrainGone` ; `src/ts/main.ts`, `moveTick`.

Un index temporaire associe les identifiants aux services pendant le tick synchrone. Il est construit paresseusement : un tick inactif ne parcourt pas toute la liste pour rien. Il contient des **références vivantes**, pas des booléens de présence figés. Modifier une position, une annulation ou un état reste donc visible au même tick.

Les remplacements de tableau, les changements de longueur, les remplacements de service et les permutations sont vérifiés. Une identité absente de l’index est recherchée dans la liste réelle pour détecter une insertion de même longueur. Le cas initial de doublons conserve la sémantique du premier résultat. La portée est libérée par `finally`, y compris au retour anticipé et sur exception ; elle n’est ni une sauvegarde ni un cache d’occupation durable. Les opérations de sécurité et les réservations restent exécutées.

Preuve : `js/__tests__/re-rc4-cantons.test.mjs`, douze tests. L’optimisation n’établit pas l’équivalence générale de toutes les physiques LOD ni la sécurité de tous les secours : LM06 et DDS04 restent dans le registre.

## 2. Bugs gameplay corrigés

### SC30 — dépassement de la limite d’arguments JavaScript

La fonction d’assemblage RC3 échoue sur 140 000 segments avec `RangeError: Maximum call stack size exceeded`. Le problème vient d’insertions de type `array.push(...grandTableau)` : chaque élément devient un argument de fonction. Ce n’est pas une impossibilité géométrique d’itinéraire.

Les assemblages concernés de `schedule-v2-model.ts`, `schedule-v2-validation.ts`, `schedule-v2-runtime.ts` et plusieurs agrégats de `orm.ts` utilisent des boucles. Les points, leur ordre et leurs contraintes sont conservés. Les extrémités, 140 000 segments, l’électrification, les tensions et les écartements sont contrôlés. Le vrai validateur V2 et le contrôle d’intégrité runtime sont exécutés sur cette géométrie.

Preuve : `js/__tests__/re-rc4-long-route.test.mjs`. Cela corrige une classe d’échec de grandes listes, pas toutes les causes possibles de mémoire insuffisante ou de route introuvable.

### LM17 — redessins hors écran

Dans la véritable boucle `gameLoop`, un secours hors champ ne force plus un rafraîchissement animé. Les services arrêtés et les secours hors champ ne remplissent plus le lot transmis au renderer. La cadence des mouvements visibles et le rafraîchissement statique sont conservés, de même que la progression du moteur lorsque la page carte n’est pas active.

Preuve : `js/__tests__/re-rc4-render.test.mjs`, six scénarios sur la vraie méthode compilée. Les fréquences et deltas de simulation n’ont pas été réduits pour afficher un meilleur score.

## 3. Vérification TypeScript et fin des exceptions applicatives

### Ce qui est désormais couvert

**84 modules applicatifs possèdent une implémentation TypeScript, et leurs 84 sorties JS sont générées par le compilateur.** La recompilation indépendante donne 84/84 JS et 84/84 déclarations identiques. Aucune logique applicative orpheline dans les modules JS runtime inventoriés ; aucun script inline applicatif dans `index.html` ou `admin.html`.

La RC3 avait notamment des adaptations catalogue écrites directement en JavaScript et une administration entièrement inline. La RC4 fournit leurs sources :

- `admin.ts`, avec contrôles DOM explicitement typés et vérification indépendante ;
- `catalog-batch186-full-loader.ts` ;
- `catalog-freight-batch186.ts` et `catalog-freight-batch186-pass2.ts` ;
- `catalog-batch186-category-overrides.ts` et `catalog-cargo-types-base.ts` ;
- `catalog-contracts.ts`, partagé, sans ajout de `any`.

Les anciennes déclarations qui masquaient l’absence d’implémentation sont remplacées. Les constantes et transformations catalogue ont été comparées à RC3, y compris les transformations successives du catalogue complet, les ajouts industriels et le chargement des 63 morceaux dans l’ordre.

### Pourquoi des fichiers JavaScript restent dans le jeu

Le navigateur lance du JavaScript compilé. Les trois bundles sont des produits de construction, non des sources à éditer : démarrage, catalogue différé et administration. Le bootstrap du bundler et les outils de build/test restent du JavaScript d’outillage ; ils ne sont pas prétendus migrés eux aussi.

L’inventaire distingue également **85 fichiers de données pures** : trois grandes tables catalogue, 63 morceaux de catalogue et 19 assets de réseau. Leur AST est vérifié : valeurs JSON, tableaux/objets littéraux ou affectations de packs, sans fonctions, appels, getters, calculs ou spreads. Ils ne sont pas blanchis par leur nom de fichier.

Les bibliothèques tierces chargées par CDN (comme jsPDF/JSZip), les outils QA et les fixtures ne deviennent pas du TypeScript parce que RE l’utilise. Le périmètre « source applicative en TS » ne veut donc pas dire « aucune extension .js dans le ZIP ».

### Typage strict : dette encore réelle

Le comptage AST donne **48 `any` explicites**, y compris génériques et assertions :

| Fichier | `any` |
|---|---:|
| `ui.ts` | 17 |
| `depot.ts` | 11 |
| `orm.ts` | 11 |
| `s3-final-legacy-compat.d.ts` | 5 |
| `legacy-ui-compat.ts` | 2 |
| `schedule-v2-model.ts` | 1 |
| `weather.ts` | 1 |

Il reste 28 `@ts-expect-error`, aucun `@ts-ignore` et aucun `@ts-nocheck`. Les signatures globales permissives sur HTMLElement, Array, UI, ORMClient et RailEmpire, ainsi que des surcharges DOM historiques, continuent d’affaiblir une partie du contrôle. **Ce n’est donc pas du TypeScript intégralement assaini au sens strict.** Aucun contournement supplémentaire n’a été ajouté dans cette passe.

Le nouvel audit remplace l’ancien comptage grossier par regex. Une limite de dette par fichier bloque toute hausse d’`any`, et une limite séparée surveille les suppressions. Une table prétendument « data » qui recevrait du code cesse d’être exemptée. `noEmitOnError`, `noImplicitReturns` et `noFallthroughCasesInSwitch` sont activés ; `strict` reste actif.

`tsconfig.admin.json` vérifie l’administration avec `skipLibCheck: false`, sans charger les compatibilités globales du jeu. Ce contrôle passe aussi.

## 4. Administration : correction fonctionnelle et rendu

Les imports et suppressions sont maintenant relus même lorsque la clé des fiches modifiées n’existe pas encore. Le navigateur reproduit l’absence d’un import dans le code RC3 et le retrouve dans le bundle RC4. Les suppressions s’appliquent après fusion, et les modifications après chargement.

Les noms et identifiants sont échappés dans le rendu ; un nom contenant une balise `<img ...>` reste du texte. Les interactions utilisent des événements DOM plutôt que des handlers inline interpolés. Une modification de fiche sauvegardée et l’ouverture des incidents sont testées.

Le panneau des sources pouvait afficher une liste gigantesque d’URLs à la place d’un indicateur. Il affiche un résumé borné ; toutes les sources restent dans le filtre. Un seul parcours calcule les effectifs, puis les options sont construites dans un fragment DOM au lieu de filtrer et reparser la liste à chaque source. Un test couvre 10 000 entrées et 1 000 sources sans répétition de `filter`.

Ces améliorations ne sont pas comptées comme des clôtures supplémentaires du registre gameplay historique. La persistance des images Blob, les imports ZIP réels et la publication distante n’ont pas été certifiés. Aucun bouton de publication ni service externe n’a été invoqué pendant les tests.

## 5. Validation finale et limites

| Contrôle | Résultat |
|---|---:|
| Compilation TS + contrôle indépendant admin | PASS |
| Sorties JS recompilées dans un dossier neuf | 84/84 identiques |
| Déclarations compilées indépendamment | 84/84 identiques |
| Suite `npm test` | 102 834 PASS, 0 échec |
| Suite ciblée de réparation | 162 PASS, 0 échec |
| Nouveaux tests RC4 compris dans cette suite | 39 PASS |
| Gate S3 complète | 220/220 fichiers actifs, 0 échec |
| Archives supersédées de la gate | 11, inchangées ; remplacements vérifiés |

Les suites se recouvrent et leurs nombres ne s’additionnent pas. Les 250 profils aléatoires sont des cas dans un test, pas 250 bugs indépendants. Les anciens tests qui vérifient le marqueur de cache ont été mis à jour vers `1199repair4` ; aucune assertion de comportement n’a été retirée pour améliorer le bilan.

### Navigateur

Le démarrage, sept pages, la fenêtre Correspondances et le diagnostic injecté sont testés dans Chromium avec un DOM réel, en injectant les fichiers fournis. Le jeu est actif avec 30 977 gares chargées. L’administration est testée avec son vrai bundle, son DOM et un stockage isolé. Aucun événement `pageerror` dans ces essais.

Les tentatives de navigation native HTTP locale et `file://` ont été bloquées par la politique de l’environnement (`ERR_BLOCKED_BY_ADMINISTRATOR`). La solution de test remplace les lectures de fichiers et le stockage par un adaptateur mémoire. **Ce n’est pas une partie normale, un test GPU de longue durée ou une preuve de FPS sur le PC du joueur.** Les tuiles externes, routages distants et annonces audio ne sont pas validés par ce smoke test ; la carte de la capture est vide de fond externe pour cette raison. Aucun service n’est en circulation dans le scénario de démarrage.

Fichiers : `QA/RE_REPAIR_RC4/browser/`, scripts de reproduction dans le même dossier QA, et `FINAL_TEST_SUMMARY.json`.

## 6. Reproduction et installation

Pour jouer : exporter la sauvegarde actuelle, conserver RC3, extraire RC4 dans un dossier neuf sans superposer les versions, puis ouvrir `index.html`. `admin.html` utilise le nouveau bundle autonome. Les ressources et le JS compilé sont inclus ; installer Node ou TypeScript n’est pas nécessaire pour lancer le jeu.

Pour reconstruire après modification des sources, utiliser les dépendances de `package.json` puis :

```sh
npm run build:repair
npm run test:repair
npm test
npm run test:s3-regression
npm run audit:typescript
npm run benchmark:repair
npm run verify:repair
```

Le build utilise TypeScript 5.8.3. La validation a utilisé cette version installée dans l’environnement ; la tentative d’installation npm n’a pas abouti et aucun nouveau lockfile ne prétend verrouiller toute la chaîne. Le JS livré, la recompilation et les références de benchmark évitent de dépendre d’une installation pour jouer ou examiner les résultats.

Les références de comparaison RC3 sont dans `QA/RE_REPAIR_RC4/reference`. Les benchmarks sont exécutables sur la même machine avec les deux implémentations. Les rapports historiques dans les autres dossiers QA ne doivent pas être confondus avec le bilan RC4.

Le manifeste `QA/FILE_SHA256_MANIFEST.txt` est régénéré pour la livraison ; il exclut uniquement sa propre empreinte. Le SHA256 externe de l’archive permet de vérifier le fichier téléchargé. Les références de tests et les journaux ne sont pas chargés par le jeu.

## 7. Chantiers encore ouverts

Les voies physiques exactes, la continuité inter-voies et les manœuvres TAQ, le remorquage et la sécurité des secours, le rattrapage événementiel complet après longue absence, certaines cargaisons annulées/expirées, les améliorations de gare restantes et les conséquences des consommables demeurent dans le registre. Les erreurs de coordonnées et le nettoyage HTML général ne sont pas intégralement clos. La réduction générale des compatibilités `any`/DOM est aussi un chantier distinct.

Le cap est de garder les résultats ferroviaires, pas de gagner du débit en ignorant les contraintes. Les gains mesurés sont réels dans les scénarios décrits ; leur effet sur une partie complète dépend des vrais goulets d’étranglement de cette partie.
