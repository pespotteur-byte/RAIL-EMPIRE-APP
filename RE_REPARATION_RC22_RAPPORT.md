# Rail Empire RC22 FULL — OSM depuis le HTML local

## Résultat et périmètre

Cette livraison modifie le chargeur cartographique de RC21 pour autoriser l'ouverture directe de **index.html**, sans programme de lancement ni serveur local. Elle conserve le fond OSM standard et l'identifie avec le nom réel de l'application. La FULL comprend toutes les sources, ressources et preuves historiques ; aucune édition LIGHT n'est produite.

Le résultat qualifié est le **comportement du client**. L'accès réel à OSM, la navigation native file:// et Opera/Win7 ne sont pas certifiés dans cet environnement (détails ci-dessous). Il ne s'agit pas d'une approbation individuelle d'OSMF ni d'une garantie de disponibilité.

## 1. Méthode documentée pour file://

La page développeur OSM « Referer » indique explicitement X-Requested-With avec le nom de l'application pour les pages HTML locales. RC22 suit cette méthode :

- URL standard canonique HTTPS ; X-Requested-With: RailEmpire uniquement si le document est en file: et le destinataire OSM standard.
- En HTTP/HTTPS, aucun en-tête d'identification local supplémentaire ; le navigateur conserve son référent réel.
- Aucun Referer, User-Agent ou Origin fabriqué. Aucune adresse de proxy ni serveur local. Les autres fournisseurs ne reçoivent pas cette identification OSM spécifique.
- Une requête fournit à la fois son statut et le blob utilisé pour l'image ; pas de requête de sonde suivie d'un second téléchargement. Les URL blob sont révoquées après utilisation.
- Sans fetch ou après un échec CORS, aucune relance anonyme par Image.src. Les protections et le message d'erreur restent actifs.

Références consultées le 13 septembre 2026 :
https://wiki.openstreetmap.org/wiki/Referer
https://operations.osmfoundation.org/policies/tiles/

La politique générale exige une identification et un référent web, tandis que la documentation développeur donne précisément cette solution pour le cas file://. On suit cette indication spécifique sans prétendre falsifier le référent que le navigateur ne transmet pas.

## 2. Respect du service et traitement des refus

Le cache HTTP du navigateur reste en mode default, sans paramètre anti-cache. Les images décodées sont réutilisées entre changements de style. Les demandes sont limitées à la vue active ; aucune fonctionnalité de préchargement de région, sillon ou paquet hors ligne n'est ajoutée. Quatre chargements simultanés maximum par service sont partagés entre cartes de la page. Les demandes devenues inutiles sont annulées.

Les vraies réponses 401/403 stoppent le service et persistent, y compris après changement de fond ou rechargement si le stockage est disponible. Les 429 respectent Retry-After lorsqu'il est lisible. La reprise est manuelle après un refus, avec une temporisation minimale qui ne garantit aucun déblocage fournisseur. L'identité reste stable : pas de rotation pour contourner une sanction.

Nouveau contrôle : une réponse HTTP 200 portant un en-tête exposé x-blocked est une erreur fournisseur, pas une tuile réussie. Le client conserve le statut réel 200 et le motif ; il ne l'invente pas en 403. Si l'en-tête n'est pas accessible par CORS, le client ne peut pas en déduire sa présence. Le mécanisme est documenté par l'équipe opérationnelle :
https://community.openstreetmap.org/t/technical-updates-to-the-tile-openstreetmap-org-service-openstreetmap-org-standard-layer/133421

L'attribution visible hors canvas et son lien de licence sont conservés dans la LiveMap, le GPS et les éditeurs. ORM reste une couche indépendante. Le fond OSM n'est ni décoloré ni remplacé par une image blanche.

## 3. Comparaison avant/après

Le banc charge séparément les vrais modules compilés RC21 et RC22, avec un protocole local et un transport simulé :

| Même demande locale | RC21 | RC22 |
|---|---|---|
| État d'accès | local-file, refus préventif | ready |
| Demandes envoyées | 0 | 1 |
| Identification | aucune demande | X-Requested-With: RailEmpire |
| Image reçue dans le modèle | non | oui |

Preuve : QA/RE_REPAIR_RC22/HTML_OSM_BEFORE_AFTER.json. Ce n'est pas une connexion réelle au fournisseur ; l'émission native et le décodage navigateur sont contrôlés séparément.

## 4. Changements limités

Quatre sources TypeScript changent : tile-access-policy.ts, map.ts, map-source-panel.ts et build-info.ts (identité de version générée). Les sources du moteur de simulation, de la physique des trains et des règles du jeu ne changent pas.

L'aide OSM est mise à jour ; le cache de livraison porte 1199repair22. Le VERSION.txt utilisé par les chargeurs reste 1.1.99, conformément au contrat existant. Aucun exécutable n'est ajouté. Les outils serveur historiques de la FULL restent facultatifs et ne sont pas invoqués par index.html.

## 5. Qualification finale exécutée

| Contrôle | Résultat |
|---|---:|
| Configurations TypeScript | 17 réussies |
| Suite standard | 102 834/102 834 |
| Suite réparation | 1 017/1 017, dont 16 nouveaux |
| Contrôles ciblés tuiles/OSM | 60/60 |
| S3 complet | 274/274 fichiers actifs |
| Reconstruction indépendante | 125 JS + 125 déclarations + 3 bundles identiques |
| Ressources originales comparées | 37 152, toutes inchangées |
| Sources de simulation | inchangées |
| Contrôles navigateur OSM isolés | 10/10 |
| Navigation jeu | 16 pages atteintes |
| Mouvement inter-pages | 600/600 trains aux 4 observations |
| Secours | aller, intervention, retour et réception vérifiés |

Les suites se recouvrent : leurs nombres ne s'additionnent pas. Onze exclusions historiques supersédées sont conservées ; aucune nouvelle exclusion. Trois anciennes attentes sont adaptées à la nouvelle autorisation file://. Quarante-huit fichiers de tests ont leurs littéraux de cache 1199repair21 mis à jour en 1199repair22, sans changement d'assertion métier (liste : CACHE_FIXTURE_VERSION_UPDATE.json).

Les premières validations ont détecté un ancien cache de bundle encore numéroté RC21, des fixtures liées à cet identifiant, puis un VERSION.txt modifié à tort. Ces points ont été corrigés et le S3 final repasse intégralement. Les journaux des passes antérieures sont conservés, sans les présenter comme la qualification finale.

L'audit TS confirme 125 modules applicatifs, aucun nouveau any, aucune nouvelle suppression : 36 any explicites et 28 @ts-expect-error. Le typage strict intégral du projet reste un chantier distinct ; RC22 ne le déclare pas terminé.

## 6. Ce que montrent les essais navigateur

Une vraie requête fetch émise par Chromium depuis une origine opaque porte Origin: null, X-Requested-With: RailEmpire et aucun Referer. Une réponse PNG interceptée est décodée en 256 × 256. La LiveMap et les éditeurs utilisent leurs vrais bundles, Image et Canvas. La sélection file: est contrôlée dans le harnais et les réponses réseau sont interceptées.

Dix essais couvrent la conservation exacte des pixels, les attributions, l'indépendance ORM, OSM/satellite, le GPS de nuit, les 403 persistantes, le panneau visible et l'écran 768 × 1024. Vingt changements de style dans le scénario de cache n'ajoutent aucune demande. Les images de calibration portent la mention TEST TILE — NOT OSM ; aucune capture n'est présentée comme une vraie carte téléchargée.

Le modèle de stockage et le routage réseau du navigateur isolé ne certifient pas le cache HTTP physique natif. Aucune mesure de FPS, de RAM totale ni d'accélération n'est annoncée par cette livraison.

## 7. Limites explicites

La navigation native file:// échoue avec ERR_BLOCKED_BY_ADMINISTRATOR dans le navigateur de test. Cette règle n'a pas été désactivée. La tentative réseau externe limitée à une requête OPTIONS et un GET sur la tuile mondiale 0/0/0 échoue à la résolution DNS. Aucune vraie tuile OSM n'a été récupérée ; le prévol CORS du fournisseur n'a pas été certifié. Les preuves de ces limites sont conservées dans native-file-context.json et osm-cors-single-tile-check.json.

Donc : le chemin local est implémenté et le comportement du client testé, mais l'accès depuis le profil Opera/Win7 du joueur reste à confirmer. Une 403 antérieure n'est pas déclarée levée ; un refus réel n'est jamais masqué par un nouveau nom d'application ou un autre domaine.

## 8. Installation et sauvegardes

Exporter la partie dans la version actuelle, conserver l'export et l'ancien dossier. Extraire la FULL complète, puis double-cliquer index.html et choisir OSM original. Ne pas extraire seulement le HTML et ne pas vider le navigateur.

Passer de HTTP à file://, ou changer le chemin du HTML, peut donner un autre stockage : réimporter l'export lorsque la partie n'apparaît pas. Le comportement localStorage pour les URL fichier n'est pas garanti entre navigateurs :
https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

Les états de jeu, livrées, horaires et ressources de RC21 ne sont pas refondus dans cette livraison. Conserver l'export pré-migration pour tout retour en arrière.
