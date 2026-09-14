# Rail Empire — RC17 FULL : clôture du registre historique

Base : archive RC16 FULL fournie. Jeu, TypeScript, ressources et historique conservés. Aucune édition LIGHT.

## Bilan vérifié

**87 dossiers historiques clos sur 87**, contre 84 dans RC16. Les trois clôtures nouvelles sont LM03, TIME05 et DDS04. Il s’agit de clôtures sur des causes reproduites et des critères de régression documentés, pas d’une certification « aucun bug possible ». Les critères complets sont dans `QA/RE_REPAIR_RC17/CLOSURE_CRITERIA.json`.

La précédente tentative RC17 n’avait laissé aucun code récupérable. Cette livraison est issue du code RC16 réellement extrait, de modifications écrites sur disque et des qualifications exécutées ici. Les sources et les trois adaptations de fixtures existantes sont comparées dans `SOURCE_DIFF.patch`.

## LM03 — mouvement indépendant de la page et de la caméra

Le cache du tronçon pouvait rester valable 300 millisecondes de temps réel, alors que beaucoup plus de temps simulé s’écoulait pendant un rattrapage, ou que le réseau avait changé. La position physique courante et le gestionnaire du réseau font désormais autorité ; l’ancien objet n’est plus réutilisé sur la seule base de son âge.

Au-delà de 500 services, les groupes moyen/distant recevaient auparavant des pas physiques grossiers. Le changement de caméra modifiait donc le calcul, malgré un contrôleur commun. RC17 donne le même pas de 100 ms aux services physiques, que la carte soit visible ou non. Les temps anciennement accumulés restent consommés une seule fois. Les optimisations d’affichage et de chargement cartographique sont distinctes de cette cadence.

Les huit tests nouveaux vérifient la même position, vitesse, distance et traction après une minute simulée, carte visible, éloignée, absente et alternée ; ils vérifient aussi les objets de tronçon supprimés/remplacés et le maintien d’un vrai blocage. Le test au seuil comporte un train physique et 600 enregistrements de flotte auxiliaires ; il n’est pas présenté comme un benchmark de 601 trains physiques. **Sept de ces huit tests échouent sur les modules RC16 non modifiés, huit passent dans RC17.** En complément, Chromium fait réellement progresser 600 trains aux quatre observations de pages.

**Limite précise :** sans le diagnostic de l’ancienne partie personnelle, il n’est pas possible d’attribuer rétrospectivement son incident à une seule de ces causes. La clôture porte sur les causes reproduites et sur l’indépendance physique des changements de page, désormais testée.

## TIME05 — reprise opérationnelle, pas simple saut de position

Le curseur chronologique RC16 est conservé. RC17 corrige les états qui divergeaient lors de la reprise : effort de traction, décélération physique précédente, vitesse et retard exacts, position exacte, observations météo locales connues, horloges de personnel et champs de contrat pouvant être vides intentionnellement.

Le codec historique garde ses deltas de coordonnées et ajoute les seules exceptions nécessaires pour restituer les doubles d’origine. Aucun point n’est retiré, aucun nouvel arrondi n’est ajouté. Cela conserve notamment l’équivalence de freinage qui était perdue après une sauvegarde. Le stockage compressé RC13/RC14 est conservé, sans nouveau facteur de réduction annoncé.

Pendant un rattrapage, une réponse météo actuelle ou provenant d’un monde précédemment chargé ne remplace pas les conditions connues de la simulation passée. Les observations valides sont sauvegardées et restaurées ; les données non typées, non finies et entrées excessives sont filtrées. Le jeu ne prétend pas inventer la météo historique réelle absente de ses données.

Un scénario utilise les véritables méthodes `main.tick`, `secondTick` et `moveTick`, ainsi que les gestionnaires de circulation, fret, ITE, travaux, personnel, économie, banque et manœuvres. Le fret dessert des arrêts intermédiaires, reste immobilisé par les opérations ITE, traverse une limitation de travaux et atteint son terminus. Les parcours continu, différé et interrompu par rechargement sont comparés sur les transitions d’état, leurs instants, positions, recettes, cargaison, comptes, matériel et état du générateur aléatoire.

**L’essai de 48 heures exécute 1 728 000 pas physiques**, traverse deux changements de date et comporte trois sauvegardes/rechargements JSON, notamment en marche et pendant l’attente ITE. Aucun arrêt sauté, aucune livraison facturée deux fois ni perte de règlement quotidien dans ce scénario. Les entrées extérieures restent identiques entre les branches ; de nouveaux incidents aléatoires externes ne sont pas injectés pour fabriquer une différence. Les incidents connus et les autres conventions temporelles restent couverts par les tests de régression hérités.

Dans Chromium, les véritables sauvegarde automatique, chargement, rattrapage borné, seconde sauvegarde et seconde reprise conservent aussi le curseur ; zéro seconde physique abandonnée dans cet essai. Il ne s’agit pas de 48 heures d’une sauvegarde personnelle arbitraire.

## DDS04 — le secours utilise le même contrôleur physique

`RescueMovement` dérive d’`ActiveService`. L’aller et le retour ne suivent plus l’ancienne accélération séparée. La locomotive doit posséder des caractéristiques réelles dans le catalogue ou la rame ; leur absence retient le secours avec un motif explicite. Les cantons, tronçons, itinéraires de cisaillement, limitations de travaux, traction et consommables passent par les contrôles communs.

Seule l’approche du train cible effectivement immobilisé est autorisée pour l’accostage. Un troisième train, une autre réservation ou une cible qui a bougé ne sont jamais assimilés à cet attelage. Une réservation de cisaillement reste contrôlée même si la présence du secours a déjà restauré son propre tronçon. Un secours bloqué ne disparaît pas à la suite du délai d’annulation d’un service commercial.

Au retour, la masse et la longueur comprennent la formation remorquée ; la puissance et le carburant proviennent de la locomotive de secours. Le transfert des occupations est atomique. Les anciennes occupations restent détenues jusqu’au dégagement de la queue. Le cas d’un train de 750 m, soit 770 m avec la locomotive, est contrôlé. Position, progression, efforts, carburant et verrous sont sauvegardés ; une sauvegarde physique corrompue est retenue au lieu de libérer silencieusement les voies. Carburant et odomètre de la locomotive sont également conservés dans le registre du dépôt, au-delà de la mission.

Les **22 nouveaux tests DDS** couvrent ces règles, les travaux fermés/ralentis, la compatibilité électrique, la panne sèche, l’accostage, les conflits et la reprise JSON. Les 28 tests de remorquage RC15 passent également. Dans le navigateur, le secours réalise l’aller, l’intervention et le retour en utilisant `main.moveTick`, **sans forcer sa position au rendez-vous**, puis la formation apparaît au dépôt sans duplication.

Le convoi reste un corps agrégé avec point de référence commun, pas une simulation de chaque attelage. Le dépôt plein, les routes inconnues, les services externes refusant une requête et les données de traction absentes entraînent une attente sûre, pas une permission inventée.

## Qualification exécutée

| Contrôle | Résultat |
|---|---:|
| Réparation | **836/836**, dont **45 nouveaux tests** |
| Standard | **102 834 réussites** |
| S3 | **264/264 fichiers actifs** ; 11 exclusions historiques inchangées |
| TypeScript | **111 modules**, compilation et contrats ; 48 `any`, 28 `@ts-expect-error` inchangés |
| Reconstruction indépendante | **111 modules JS, 111 déclarations, 3 bundles et 2 HTML identiques** |
| Ressources comparées à RC16 | **37 152 fichiers identiques**, aucun fichier de base supprimé |
| Chromium isolé | **15 pages**, 600 trains progressant aux 4 observations, aucun `pageerror` |

Les suites se recouvrent : leurs totaux ne s’additionnent pas. Les tests existants modifiés sont explicités dans `INPUT_PARITY.json` : versions de cache, cadence devenue uniforme et données physiques manquantes dans d’anciennes fixtures. Aucune exclusion nouvelle ni suppression d’assertion pour masquer un défaut.

## Performances et limites de plateforme

La cadence physique uniforme peut demander plus de CPU lorsque beaucoup de trains sont hors champ. Aucun gain global de FPS n’est annoncé. Le rattrapage reste borné par appel et conserve le travail restant ; il n’est pas rendu instantané en sautant des événements. Les tailles du ZIP FULL ne sont pas le quota du navigateur.

L’ouverture native HTTP et `file://` a renvoyé `ERR_BLOCKED_BY_ADMINISTRATOR` dans l’environnement de qualification. Les bundles réels sont donc exercés dans un DOM Chromium isolé, avec fichiers locaux fournis et stockage de test. Cela ne certifie ni Opera/Win7, ni le stockage physique personnel, ni l’audio et les fournisseurs extérieurs. La 403 OSM n’est pas déclarée levée. Aucun contrôle d’accès n’a été contourné.

## Installation et intégrité

Exporter la partie depuis RC16 avant migration, conserver cet export et l’archive précédente. Extraire RC17 FULL dans un nouveau dossier, conserver l’adresse et le port du serveur local, fermer les anciennes versions et ne pas vider le stockage du site. Les nouveaux champs ne permettent pas de récupérer les précisions ou événements déjà perdus dans un ancien fichier. Pour un retour arrière, utiliser l’export d’avant migration.

Les empreintes de chaque fichier et le CRC de l’archive sont vérifiés lors du scellement. Le résultat est livré séparément dans `RE_RC17_PACK_INTEGRITY.json` ; voir également le manifeste embarqué et `SUMMARY.json`.
