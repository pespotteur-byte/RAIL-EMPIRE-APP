# Rail Empire — Réparation RC9

**Build : `S3_GAMEPLAY_REPAIR_RC9_1199repair9`**  
Base : archive RC8 fournie dans cette conversation. Qualification : 12 septembre 2026, heure de Paris.

## 1. Résultat et périmètre

Cette livraison traite en priorité le signalement « 403 sur le filtre OSM à cause de l’utilisation ». Le fond OSM standard et la couche d’images ferroviaires ORM sont désormais protégés séparément contre les répétitions de requêtes après refus. Le chargement des images, le cache, les transitions de vue et le diagnostic ont été repris ; les moteurs de circulation et de calcul d’itinéraire n’ont pas été remplacés.

**La cause exacte de la 403 reçue chez l’utilisateur n’a pas été observée directement.** Aucun accès à son panneau Réseau, à sa réponse HTTP complète ou au dispositif de blocage du fournisseur n’est disponible. RC9 corrige les comportements identifiés dans le client ; elle ne prétend ni lever un bannissement ni garantir la disponibilité d’un service externe.

Le fond OSM, les images ORM et les requêtes vectorielles OSM/Overpass du Schedule Creator sont distincts. Cette livraison ne refond pas Overpass ni le routage longue distance. Les restrictions d’un autre service devront être diagnostiquées sur leur URL réelle.

## 2. Défauts établis dans RC8 et corrections

### Refus et charge réseau

Un échec d’image redevenait redemandable après trois secondes. La remise à zéro des compteurs lors d’un changement de vue ne supprimait pas réellement les requêtes en vol. Plusieurs cartes pouvaient disposer chacune de leur propre budget de chargement.

RC9 met en place un état d’accès par service, partagé entre les cartes de la même page. OSM standard possède son budget ; les trois sous-domaines ORM en partagent un autre. Un refus sur un sous-domaine ORM n’est pas contourné par le suivant. La limite globale interne est de quatre chargements simultanés par service ; ce choix de prudence n’est pas présenté comme un quota approuvé par le fournisseur.

Sur OSM, ORM et un fond XYZ explicitement configuré, une seule requête `fetch` fournit à la fois le statut HTTP et les octets de l’image. Elle ne sert pas de sonde suivie d’un second téléchargement. Le cache du navigateur reste en mode `default`, avec son propre mécanisme de validation. Le référent n’est pas forgé et l’agent utilisateur n’est pas modifié.

| Situation observable | Comportement RC9 |
|---|---|
| 401 ou 403 effectivement lisible | Arrêt du service et annulation des autres demandes en vol. Blocage conservé dans le stockage local lorsque disponible. Aucune relance automatique. |
| Reprise après refus | Action manuelle, après correction de la cause et au moins quinze minutes d’attente. Le délai ne garantit pas un déblocage côté serveur. |
| 429 | Pause d’au moins une minute ; `Retry-After` valide respecté lorsqu’il est exposé au navigateur. |
| Réseau/CORS/décodage sans statut lisible | Diagnostic sans code HTTP inventé ; temporisation croissante de 30 secondes jusqu’à cinq minutes. |
| Carte ou éditeur fermé | Files interrompues et chargements annulés ; les services ferroviaires restent indépendants. |
| Ancien callback après annulation | Aucun décrément du compteur de la génération suivante ; libération des créneaux idempotente. |

Un refus retourné sous forme d’image explicative avec un statut 200 n’est pas reconnu par lecture du texte de l’image. Une erreur CORS peut également empêcher la lecture du statut ou de `Retry-After`. Le panneau propose une suspension manuelle ; il ne prétend pas inspecter une réponse rendue opaque par le navigateur.

### Cache et rendu

La clé d’une tuile comprend désormais l’identité de sa source. Deux fournisseurs à la même coordonnée ne partagent plus accidentellement leurs pixels. Les timestamps météo sont également distincts ; les sous-domaines ORM, en revanche, réutilisent la même identité d’image.

Les images déjà décodées restent réutilisables entre les styles basique/sombre et après un aller-retour par le satellite. Les files devenues hors champ sont élaguées lors d’un déplacement, et les téléchargements devenus inutiles sont annulés. Les demandes n’incluent plus la ligne et la colonne supplémentaires causées par la borne supérieure inclusive.

Deux défauts annexes sont corrigés : le tampon d’affichage ne se déclare plus complet tant qu’une tuile parent agrandie est en attente, et le cache de projection tient compte d’un redimensionnement du viewport même sans changement de position/zoom.

Ces corrections ne suppriment ni la simulation ni des gares pour gagner du temps. La limite générale du cache d’images et le mode GPS bas mémoire antérieurs ne constituent toujours pas une garantie contre tous les OOM possibles.

## 3. Avant/après reproductible

`QA/RE_REPAIR_RC9/compare-raster.mjs` applique le même scénario déterministe au module original RC8 extrait de l’archive et au module RC9 compilé. Toutes les demandes sont interceptées : aucun balayage de serveur public.

| Scénario | RC8 | RC9 |
|---|---:|---:|
| Vue de 256 × 256 exactement alignée sur une tuile | 4 tuiles demandées | 1 tuile demandée |
| Projection après passage de 800 × 600 à 1 200 × 800 | Centre erroné : 400, 300 | Centre correct : 600, 400 |
| Deux fournisseurs différents à coordonnées égales | Même objet de pixels | Objets distincts |
| Retour satellite → fond déjà chargé | Tuile perdue | Tuile réutilisée |
| Limite de base exposée par l’objet | 10 | 4, avec partage par service dans RC9 |

Le premier cas représente 75 % de demandes en moins **dans ce scénario aligné précis**. Ce n’est ni une moyenne sur toute navigation ni un gain de FPS ou une accélération du calculateur de sillons. Les vérifications de refus/multi-cartes mesurent des événements et des invariants, pas une performance générale extrapolée.

## 4. Interface et lancement local

Le panneau de la LiveMap présente l’état du fond et celui d’ORM, leurs pauses et reprises. Il propose un fournisseur XYZ HTTPS personnalisé avec attribution, zoom maximal et confirmation explicite des droits d’usage. Aucun fournisseur tiers alternatif n’est choisi automatiquement. Les textes sont insérés comme du texte ; les URL ne doivent jamais contenir un secret privé.

L’attribution est placée au-dessus de la recherche de gare, avec un lien de licence cliquable. Le panneau a été contrôlé à 768 × 1 024 et 1 280 × 900 dans Chromium. Son résumé n’est plus masqué par les commandes supérieures. Le rafraîchissement des contrôles de diagnostic est limité pour éviter de les recalculer à chaque image rendue.

L’OSMF demande notamment un référent valable pour les pages web, une attribution visible et le respect du cache. Une ouverture `file://` ne fournit pas ce contexte web ; RC9 suspend préventivement le fond standard dans ce mode. Cela ne suffit pas à expliquer toutes les 403 possibles ni à lever celles liées à une utilisation excessive. Références officielles en section 8.

`LANCER_RE.cmd` utilise `tools/Start-RailEmpire.ps1` et `tools/LocalGameServer.cs` pour proposer un serveur de fichiers local, lié uniquement à `127.0.0.1:8765`. Il n’effectue aucune requête vers OSM, n’offre pas de proxy et n’écrit pas les fichiers du jeu. Le port reste fixe pour préserver l’origine du stockage du navigateur. Un port déjà occupé produit une erreur au lieu d’en choisir un autre silencieusement.

Le serveur Node alternatif, `node scripts/serve-local.cjs`, a été exécuté et testé sous Linux : GET/HEAD, cache conditionnel, types MIME, M4A/CSV, refus des écritures, validation Host/Origin, refus des traversées de chemin, liens symboliques et accès aux sources/QA. **Le lanceur Windows/C# n’a pas été exécuté ni compilé dans cet environnement ; sa validation sous Win7/Opera reste à faire.** Aucun binaire précompilé prétendument certifié n’est fourni.

**Avant de passer de `file://` à HTTP, exporter la partie depuis RC8.** Le stockage du navigateur dépend de l’origine. Importer ensuite la sauvegarde sous la nouvelle adresse ; un écran d’accueil vierge ne signifie pas que les anciennes données ont été supprimées. Conserver le même navigateur/profil et l’adresse exacte, sans alterner avec `localhost` ou d’autres ports. Guide : `LIRE_AVANT_RC9.md` et `AIDE_CARTE_OSM.html`.

## 5. Qualification

| Contrôle | Résultat |
|---|---:|
| Compilation et construction de livraison | Réussies |
| Suite standard | 102 834 tests réussis, zéro échec |
| Suite de réparation | 396 tests réussis, zéro échec |
| Ajouts RC9 | 28 tests réseau/cache/projection + 5 tests serveur local |
| Gate S3 | 239/239 fichiers actifs ; 11 archives historiques inchangées |
| Reconstruction indépendante | 94 modules JS et 94 déclarations identiques ; trois bundles et deux entrées HTML identiques |
| Audit TypeScript | 94 modules applicatifs ; zéro JS applicatif non apparié |
| Dette TypeScript déclarée | 48 `any` explicites et 28 `@ts-expect-error`, sans augmentation |
| Ressources conservées | 37 221 fichiers identiques à RC8 ; CSS volontairement modifiée, hors de ce compte |

Les suites se recouvrent : leurs nombres ne s’additionnent pas. Les 33 nouveaux tests ne sont pas 33 nouveaux bugs indépendants. Aucun fichier supplémentaire n’a été exclu du gate.

Les invariants des anciens tests ont été conservés. Les jetons de version de 49 fichiers ont été actualisés. Deux assertions de disposition textuelle sont remplacées par des contrôles comportementaux : URL réellement choisie par TileMap et distinction effective des clés jour/nuit. Trois échecs intermédiaires sont conservés dans les journaux : changement transitoire incorrect de `VERSION.txt` remis à `1.1.99`, puis les deux assertions liées au déplacement du code. Le bilan final ne masque pas ces essais.

Dans le navigateur, les bundles réellement reconstruits sont injectés dans un DOM Chromium isolé, avec ressources locales et réseau externe intercepté. Nouvelle partie, 30 977 gares, quinze pages, correspondances, prêt au plafond, snapshot de maintenance, identité des voies et restriction sous la queue sont rejoués. Sur quatre observations avec changements de pages, **600/600 services du scénario synthétique avancent**. Aucune exception de page n’est remontée. Les diagnostics volontairement injectés sont identifiés dans les preuves ; ils ne sont pas un échec spontané du jeu.

L’ouverture native HTTP et `file://` est bloquée ici par Chromium avec `ERR_BLOCKED_BY_ADMINISTRATOR`. Le test d’ouverture enregistre cette limite ; son code de sortie zéro signifie que le relevé s’est terminé, pas que la navigation native fonctionne. L’injection des bundles ne certifie pas l’accès réel OSM, les en-têtes sur le réseau de l’utilisateur, son profil Opera ou l’audio. Les 403/429 sont reproduites par des réponses contrôlées.

L’audit de couverture TypeScript ne signifie pas que toute la dette de typage historique a disparu. Les scripts de construction, tests, preuves et lanceurs sont distincts des sources applicatives ; aucune conversion de C# ou d’outils en TypeScript n’est revendiquée.

## 6. État du chantier général

Le registre historique reste à **75 dossiers clos sur 87**, avec cinq partiels et sept ouverts. Ce taux n’est pas une mesure de tout le jeu garanti sans défaut. Les corrections réseau de cette livraison sont suivies séparément : elles ne servent pas à gonfler le dénominateur ou à déclarer un bannissement externe résolu.

Les manœuvres physiques entre voies, la complétude du replay après absence, les interventions de secours et le blocage durable à basse vitesse restent notamment à traiter ou à reproduire selon les lignes du registre. RC9 ne les déclare pas corrigés par ce travail sur les images de carte.

## 7. Preuves livrées

`QA/RE_REPAIR_RC9/QUALIFICATION.json` synthétise les résultats. Les journaux bruts, scénarios de test navigateur, captures, comparaison avant/après, audit de types, reconstruction indépendante, parité des ressources, provenance et diff du code sont présents. `QA/FILE_SHA256_MANIFEST.txt` couvre les fichiers du paquet hors manifeste lui-même. L’archive est contrôlée après création par CRC et vérification des empreintes de ses membres.

## 8. Références consultées

- OSMF, [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) : service standard, identification, attribution, cache et limites d’usage.
- OpenStreetMap, [Blocked tiles](https://wiki.openstreetmap.org/wiki/Blocked_tiles) : catégories de refus et cas du référent.
- MDN, [Request.cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache) et [Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After) : cache et temporisation.
- MDN, [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) et [Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) : stockage associé à l’origine et limites de `file://`.

Ces références décrivent les mécanismes et politiques ; elles ne certifient pas que le fournisseur a débloqué le navigateur de l’utilisateur.
