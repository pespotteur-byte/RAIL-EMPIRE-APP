# Rail Empire — livraison RC8

Build : **S3_GAMEPLAY_REPAIR_RC8_1199repair8**. Base : archive RC7 fournie par PE, SHA-256 `b9d520cb2838c5dd62e2c3d07ecf2d0ba2b4b8d14a3ba23e581115edc8500ac5`.

## 1. Résultat et périmètre

La RC8 contient le jeu complet précompilé, ses sources TypeScript et les preuves de qualification. Le registre passe de **74/87 à 75/87 dossiers clos (86,2 %)**. SC20 est clos sur la transmission d’une identité physique connue, indépendante du nom affiché. Il reste **cinq dossiers partiels et sept ouverts**. Ce chiffre n’est ni une note de qualité universelle ni une garantie d’absence de bugs.

Le point de départ a été vérifié sur le ZIP intact : manifeste RC7 sans erreur et 318/318 tests de réparation réussis. Les 45 nouveaux tests appliqués au code RC7 donnent 13 réussites et 32 échecs, dont des appels à des fonctions nouvelles absentes de la référence. Il ne s’agit pas de 32 bugs distincts. Une référence minimale de 29 fichiers originaux est conservée dans QA, avec ses empreintes.

## 2. Réparation SC → circulation : la voie n’est plus son étiquette

Un même `wayId` renommé ne devient plus une seconde voie libre. Deux voies OSM réellement distinctes ne sont plus fusionnées simplement parce que leur nom affiché est identique. Le numéro réel de voie reste utilisable pour relier les demandes historiques et les segments OSM d’une même voie, sans transformer un nom choisi par le joueur en donnée physique.

`TrackBinding` conserve un éventuel `voiePointId`. La compilation V2 transporte une identité native/OSM normalisée jusqu’aux arrêts, au gestionnaire de réservation, aux occupations de départ et aux snapshots. Le nom lisible reste séparé de la clé de ressource. Les copies d’arrêts et de sauvegarde sont indépendantes, et un ancien libellé restauré ne redirige pas un arrêt qui possède déjà une identité physique.

Le raccordement à une voie native exige un identifiant natif valide de la bonne gare, une référence réelle non ambiguë, ou un point géographique unique à deux mètres au plus. Une référence native absente, étrangère ou ambiguë est refusée : pas de substitution opportuniste par une autre voie libre. Pour un arrêt OSM lié à une ressource native représentative, l’arrivée conserve les coordonnées choisies au SC ; le marqueur natif ne déplace plus le train.

La priorité du train physiquement en tête est conservée contre une réservation anticipée par son suiveur. Elle ne permet pas d’expulser un train réellement arrêté sur la voie. Après départ, l’occupation reste maintenue sous la queue et sa restauration réacquiert la même ressource physique, même si sa clé interne est normalisée différemment dans un gestionnaire neuf.

**Limite de migration :** les anciens bindings sans `wayId` ni `voiePointId` continuent d’utiliser la compatibilité exacte par libellé. La RC8 ne peut pas déduire une identité inexistante à partir d’un texte arbitraire. Une sélection physique doit être refaite pour ces bindings. Les déplacements de rame entre deux voies de la même gare et les manœuvres de formation ne sont pas refondus ici : SC21/SC22 restent ouverts.

## 3. Performance mesurée : recherche du propriétaire d’une occupation

Les contrôles d’occupation pouvaient parcourir toute la flotte à chaque vérification de propriétaire. La RC8 réutilise un index d’identités limité à un tick de mouvement synchrone, construit uniquement à la première demande et libéré en fin de tick. Il contient des références aux services, pas un résultat d’occupation figé.

Une annulation, une fin de service, une panne ou une modification de position restent lues sur l’objet courant. Un remplacement de liste, une modification de longueur, un changement d’identifiant, un remplacement de case ou une réorganisation provoquent une reconstruction ou un retour à la recherche autoritative. Les doublons d’identité incohérents ne doivent pas permettre de libérer une voie occupée.

| Services | Vérifications par mesure | RC7, médiane | RC8, médiane | Rapport |
|---:|---:|---:|---:|---:|
| 1 000 | 4 000 | 26.110 ms | 0.639 ms | ×40.8 |
| 5 000 | 20 000 | 591.378 ms | 5.182 ms | ×114.1 |

Méthode : même fonction métier et même charge de requêtes ; processus Node isolés ; trois échauffements puis neuf mesures, avec collecte mémoire entre mesures. La construction de l’index RC8 est incluse. Le nombre de réponses « occupé » est identique avant/après. Les services sont des objets de test et non un réseau entier simulé pendant le benchmark.

**Ces rapports concernent uniquement la recherche des propriétaires de ressources. Ils ne multiplient pas les FPS ni toute la vitesse de RE.** Le rendu, le calcul de routes, les échanges réseau et l’occupation globale de mémoire ne sont pas évalués par cette mesure. Les valeurs dépendent de la machine et se trouvent dans `PERFORMANCE_COMPARISON.json`.

Un prototype de cache des géométries de retour a été mesuré puis rejeté : il réduisait certaines allocations et améliorait un parcours dérivé, mais ralentissait les consultations simples et augmentait la mémoire retenue. Il ne figure pas dans les sources exécutées. Ses observations sont archivées comme expérience rejetée, pas présentées comme un gain livré.

## 4. Qualification exécutée sur cette livraison

| Contrôle | Résultat |
|---|---:|
| Construction TS et contrôles stricts isolés | Réussis |
| Suite standard | 102 834 tests réussis, zéro échec |
| Suite de réparation | 363/363, dont 45 nouveaux |
| Gate S3 | 237/237 fichiers actifs réussis |
| Recompilation indépendante | 92 JS et 92 déclarations identiques |
| Reconstruction des points d’entrée | 3 bundles et 2 HTML identiques |
| Ressources comparées au ZIP RC7 | 37 222 fichiers identiques |
| Navigation Chromium isolée | 15 pages, zéro exception non gérée observée |

Les suites se recouvrent : **leurs nombres ne s’additionnent pas** comme autant de contrôles indépendants. La gate découvre 248 fichiers, dont les mêmes 11 archives supersédées de la base : aucune exclusion ajoutée. Les 34 fichiers sensibles au timing sont exécutés seuls après les 203 fichiers fonctionnels.

Quarante-neuf tests qui vérifient littéralement le cache ont été actualisés de `1199repair7` à `1199repair8`, sans assouplissement de leurs autres assertions. Deux fixtures historiques utilisaient uniquement `displayName` pour signifier un numéro physique. Leur `trackRef` est maintenant explicite ; toutes les assertions des huit tests concernés restent inchangées. Les échecs initiaux et le détail de ces modifications sont conservés.

### Essais navigateur et limites

La navigation directe HTTP locale et `file://` a été tentée : elle est bloquée ici par `ERR_BLOCKED_BY_ADMINISTRATOR`. Le code de sortie zéro du script de sondage signifie que le résultat a été enregistré, pas que la navigation native a fonctionné.

Le jeu et l’administration sont donc testés dans un DOM Chromium réel, avec injection des fichiers locaux fournis, stockage mémoire isolé et absence de services externes. Les mêmes bundles que ceux du ZIP sont utilisés. L’essai SC20 vérifie réservation après renommage, coexistence de voies homonymes distinctes, maintien sous la queue, identité dans le snapshot et libération finale.

L’essai de circulation utilise **600 ActiveService réels sur des corridors synthétiques indépendants**, avec 454 services high et 146 low. Les 600 avancent sur Carte → Personnel → Incidents → Carte, au-delà de 12 km/h dans ce scénario. Les passages à V30 conservent la limitation sous une rame de 750 m après changement de liaison. Sont également testés la fenêtre Correspondances, un clic bancaire au plafond, les compteurs après maintenance, le diagnostic d’une erreur RH volontairement injectée, et l’administration du catalogue.

Ce n’est **pas** une partie utilisateur chargée, ni un réseau dense partagé avec des conflits complexes, ni un test d’Opera Windows 7, des voix ou des tuiles externes. LM03, le blocage durable signalé par PE autour de 12 km/h, reste partiel : cette livraison n’en revendique pas la résolution définitive. L’erreur RH « simulé » éventuellement visible dans la capture est une sonde attendue, non un plantage constaté.

## 5. TypeScript et intégrité du contenu

L’audit trouve **92 modules applicatifs TS et 92 sorties JS compilées**, trois bundles générés, aucune source applicative JS non appariée dans le périmètre audité, aucun script applicatif inline ni gestionnaire d’événement HTML inline. Les données, outils, tests, bibliothèques externes et références historiques sont distingués de l’application.

Il reste **48 `any` explicites et 28 `@ts-expect-error`**, zéro `@ts-ignore` et zéro `@ts-nocheck`, sans augmentation. Les compatibilités globales anciennes affaiblissent encore le contrôle de certains modules. Le nouveau module d’identité de voie passe aussi un contrôle strict isolé sans ces compatibilités. **Sources applicatives en TypeScript ne signifie pas typage intégralement assaini.** Le JS généré est conservé car le navigateur l’exécute ; il n’est pas nécessaire d’installer Node pour jouer.

Les images, données de réseau/catalogue, fichiers audio, catalogues tableur et CSS ont été comparés octet par octet au ZIP fourni. Aucun fichier d’origine n’a été supprimé. Le manifeste SHA-256 final couvre les fichiers livrés sauf lui-même ; les rapports antérieurs sont conservés comme historique.

## 6. Installation et contrôles du joueur

Exporter sa sauvegarde, conserver RC7, extraire RC8 dans un **nouveau dossier**, puis ouvrir `index.html`. Ne pas fusionner les fichiers des versions. Importer d’abord une copie de partie. Les données physiques ambiguës peuvent maintenant être refusées plutôt que remplacées par une voie différente ; cela doit être corrigé dans le binding du sillon, pas contourné en choisissant arbitrairement une voie libre.

Essai ciblé utile : deux horaires visant la même voie avec des noms différents doivent se bloquer mutuellement ; deux voies distinctes peuvent conserver le même nom visible ; un départ ne libère pas la voie avant dégagement de la queue ; sauvegarder/recharger ne doit pas changer la ressource réellement réservée.

Restent les 12 dossiers non clos du registre : SC21, SC22, SC28, LM03, LM06, TIME05, ECO05, FEAT02, FEAT03, DDS03, DDS04 et QA03. Ils concernent notamment les manœuvres, le replay complet, les réseaux denses, certains effets économiques et de matériel, le remorquage et les anciennes interpolations HTML.

## 7. Reproduire les preuves

Avec les outils de développement déclarés dans `package.json` :

```sh
npm run build:repair
npm run test:repair
npm test
npm run test:s3-regression
node scripts/benchmark-rc8.cjs QA/RE_REPAIR_RC8/baseline
```

Régressions nouvelles contre le code RC7 conservé (échecs attendus), depuis un shell POSIX :

```sh
RE_BASE="$PWD/QA/RE_REPAIR_RC8/baseline" node --test js/__tests__/re-rc8-track-identity.test.mjs js/__tests__/re-rc8-resource-index.test.mjs
```

Sous PowerShell, définir `$env:RE_BASE` vers ce dossier, exécuter la même commande Node sans le préfixe POSIX, puis supprimer cette variable pour tester RC8. Cette référence minimale contient 29 fichiers originaux ; ce n’est pas une deuxième copie jouable.

Les scripts `verify-rebuild.py` et `browser-*.py` dans QA reproduisent les contrôles de laboratoire ; les essais navigateur nécessitent Playwright et Chromium. Ils ne sont pas nécessaires pour lancer le jeu. Les relances peuvent réécrire les résultats QA : archiver les preuves de livraison avant reproduction. `npm run verify:repair` contrôle le manifeste avant toute modification ou recompilation.

Preuves principales : `QUALIFICATION.json`, `TYPESCRIPT_AUDIT.json`, `REPRODUCIBLE_BUILD.json`, `RESOURCE_PARITY.json`, `SOURCE_PROVENANCE.json`, `BASELINE_MANIFEST.json`, `PERFORMANCE_COMPARISON.json`, le diff et les journaux dans `QA/RE_REPAIR_RC8/`.
