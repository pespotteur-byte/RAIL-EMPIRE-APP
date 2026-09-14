# Rail Empire — Réparation gameplay RC5

**11 septembre 2026 — Base RC4, sources TypeScript, runtime recompilé et ressources complètes.**

## Résumé

Cette version clôt trois dossiers connus : **SC27 (répartition des VIA lors d’une insertion), LM16 (coordonnées zéro dans les vues identifiées), ECO08 (cycle de la cargaison interrompue)**. Le registre passe de **60/77 à 63/77 : 81,8 %**. Les dossiers partiels ne sont pas comptés comme réparés. Un pourcentage de dossiers n’est pas une garantie d’absence de bugs.

Deux optimisations portent sur des fonctions réellement utilisées : recherche des ruptures d’électrification et calcul des péages. Les charges comparatives utilisent les méthodes RC4 copiées sans modification et les méthodes RC5, avec contrôle de leurs résultats. Le gain de ces fonctions n’est pas un multiplicateur de FPS du jeu complet.

**Aucune refonte terminée du remorquage, des manœuvres intervoies, des TAQ ou du replay complet des longues absences n’est revendiquée.** Les points restants figurent dans le registre fourni.

## 1. SC : insertion d’un arrêt sans réordonner les VIA

L’ancienne heuristique décidait indépendamment, à partir des distances à vol d’oiseau, si chaque VIA appartenait à la liaison entrante ou sortante. Sur une ligne en U, un VIA réellement après l’arrêt inséré était réaffecté avant lui. Le même défaut est reproduit en sens inverse.

La nouvelle mesure projette les ancrages sur **l’ancienne géométrie ferroviaire ordonnée**, en privilégiant les identifiants OSM de voie/segment disponibles. La distance cumulée sur cette route détermine un point de coupure unique. Les VIA suivants changent de numéro de liaison mais conservent leur identité et leur ordre. Aucun point géométrique n’est supprimé pour obtenir ce résultat.

Un deuxième cas a été corrigé dans la même fonction : **ajouter une gare avant l’ancienne origine** crée une nouvelle liaison 0. Toutes les contraintes des liaisons existantes, y compris les guides de prévisualisation, doivent donc être décalées d’un cran. L’append au terminus conserve au contraire ses guides en place.

Les essais couvrent également le vrai chemin `_finishPendingStationAnchor`, pas seulement un helper appelé hors interface. Ils vérifient la liaison affectée lors du recalcul et l’absence de perte des métadonnées.

**Limite explicite :** une géométrie ancienne absente, une insertion éloignée de la route ou un passage ambigu sur une voie parcourue plusieurs fois ne permet pas de choisir magiquement l’occurrence souhaitée. Le repli conserve une seule partition et l’ordre des VIA ; son choix reste approximatif et le trajet doit être vérifié par le joueur. La correction n’affirme pas résoudre une intention indéterminée.

Sources : `src/ts/route-linear-reference.ts`, `src/ts/schedule-v2-editor.ts`. Preuves : `js/__tests__/re-rc5-sc-insertion.test.mjs`.

## 2. Coordonnées : zéro est une valeur, pas une absence

Les derniers cas identifiés de `snapLat || lat` et `snapLon || lon` dans le SC sont retirés. Un helper partagé valide chaque axe, respecte 0 et utilise la coordonnée brute uniquement si le snap est absent ou invalide. Le dessin des arrêts, le centrage, le dessin et la sélection des VIA utilisent ce même résultat.

Les ancrages absents, blancs, booléens ou non finis ne doivent pas créer de marqueur ni recentrer sur 0/0. Les tests couvrent ces entrées, le vrai zéro, le repli brut et l’absence totale de position. L’inventaire ciblé des autres expressions est conservé dans `coordinate-search.txt` : les `coordonnée || 0` résiduels préservent un vrai zéro, et les deux `bestSeg!` repérés sont des assertions TypeScript, pas des négations runtime.

La clôture LM16 porte sur ces cas identifiés et les correctifs précédents conservés, pas sur une preuve universelle de traitement de toutes les données géographiques corrompues.

## 3. Fret : terminer une cargaison sans la perdre ni la payer au mauvais client

### Identité indépendante de l’affectation

Le chargement mémorise désormais son propre identifiant de contrat. Modifier l’affectation du service n’étiquette plus rétroactivement le fret déjà à bord avec le nouveau contrat. La livraison de l’ancien chargement se fait au bon destinataire. Une cargaison assignée/interrompue ne peut pas être proposée automatiquement à un autre contrat compatible pour déclencher une recette indue.

### Interruption et suppression

Un contrat devenu inactif ou supprimé laisse sa cargaison à bord jusqu’au **prochain arrêt commercial utilisable**. Un point technique ou un ITE signalé incompatible ne réalise pas une restitution fictive. Une arrivée commerciale de distance nulle permet néanmoins de restituer une cargaison interrompue, sans générer une nouvelle livraison.

La restitution libère les réservations et vide seulement le fret contractuel. Elle ne réduit pas le reliquat du contrat, n’augmente ni son pourcentage livré ni les revenus/satisfactions/statistiques industriels, et ne convertit pas le cargo en fret générique. Le journal ajoute une entrée comptable sans paiement, une seule fois. Un contrat supprimé reste sous forme d’enregistrement inactif tant que des trains doivent encore restituer leur charge ; il est retiré après la dernière restitution.

La fin effective ou la suppression d’un service libère également son reliquat non livré. La garde des opérations au terminus introduite dans les RC précédentes est respectée avant cette finalisation. Cette restitution reste une abstraction comptable : **elle ne simule ni entrepôt physique, ni stockage par gare, ni retour par camion**. Aucune nouvelle règle calendaire d’expiration n’a été inventée ; cette logique s’applique quand le contrat est effectivement rendu inactif par le moteur ou la sauvegarde.

### Sauvegardes et réservations

L’identité du cargo est persistée dans le compact legacy (`cgid`, distinct de l’index d’arrêt `ci`) et dans l’instantané V2 (`contractCargoId`). Les anciennes sauvegardes sont migrées lorsque l’association est identifiable. Après restauration des managers, puis une fois par minute, les réservations sont reconciliées avec les services vivants **et les instantanés V2 encore en attente de compilation**. Les services réels priment sur un doublon d’instantané ; les réservations fantômes sont libérées.

Les quantités non finies des instantanés sont normalisées, et un ancien surbooking ne peut pas recréer un registre supérieur au stock restant. Une vieille cargaison dont le contrat n’existe plus suit le chemin de restitution, sans argent inventé.

Preuves : **15 tests** dans `re-rc5-freight-lifecycle.test.mjs`, dont deux transporteurs sur le même contrat supprimé, compact legacy aller-retour, état V2 en attente, changement d’affectation et idempotence.

## 4. Performances : résultats avant/après

| Charge mesurée | RC4 | RC5 | Rapport des médianes |
|---|---:|---:|---:|
| 4 000 contrôles caténaire, route de 50 000 points entièrement électrifiée | 215.268 ms | 1.160 ms | ×185.51 |
| 4 000 contrôles caténaire, route de 150 000 points entièrement électrifiée | 645.203 ms | 1.176 ms | ×548.47 |
| 4 000 contrôles caténaire, 150 000 points avec ruptures régulières | 45.074 ms | 1.443 ms | ×31.23 |
| 100 calculs de péage sur 50 000 points | 459.755 ms | 24.239 ms | ×18.97 |

Méthode : **trois passages d’échauffement puis neuf échantillons par version**, processus Node distincts, mêmes charges et comparaison des sorties numériques/compteurs. Médiane des neuf échantillons. Les fonctions de référence sont extraites sans changement du JS RC4 ; leurs empreintes et celles des fichiers d’origine sont incluses dans `reference/PROVENANCE.json`. Le benchmark est rejouable avec `npm run benchmark:repair` dans un environnement de développement compatible.

### Recherche caténaire

RC4 reparcourt la fin de la route à chaque contrôle d’un train uniquement électrique. RC5 construit à la demande un index des plages comportant une absence explicite de caténaire, puis cherche la prochaine plage par dichotomie. Les portions d’électrification inconnue conservent leur sémantique précédente. Les coupures d’alimentation et travaux restent contrôlés en direct dans leurs chemins d’autorité de mouvement : cet index ne remplace pas ces contrôles.

L’index porte sur un snapshot de route fixe. Un nouvel objet/une nouvelle longueur le reconstruit ; les réinitialisations de liaison le vident, y compris pour une modification en place explicitement signalée. Les essais comparent **300 géométries mixtes reproductibles, chaque indice de segment**, à une recherche linéaire, ainsi que la vraie méthode `ActiveService` et les remplacements de routes.

Le coût de création n’est pas caché : les premiers appels, incluant aussi la construction géométrique commune, sont mesurés séparément dans le JSON. Sur le cas mixte de 150 000 points, ce premier appel passe de **11,43 à 17,20 ms** ; les contrôles répétés deviennent ensuite beaucoup moins coûteux. Les gains importants du tableau concernent ces réutilisations d’une route déjà indexée.

### Péages et très longues routes

La recherche `Math.max(...speeds)` pouvait encore provoquer un `RangeError` lors du traitement économique d’une arrivée sur une route de 150 000 à 200 000 points. Le calcul utilise maintenant une seule boucle pour la vitesse moyenne/maximale, le nombre de voies, l’électrification et l’usage principal. Il ne découpe ni ne tronque le trajet ; les facteurs tarifaires restent inchangés sur les données valides testées.

Ce complément rejoint **SC30**, déjà clos pour les assemblages de grandes listes : il n’est pas compté une seconde fois. Deux tests de routes géantes échouent sur RC4 et passent sur RC5. La baisse du coût sur 50 000 points est mesurée séparément dans le tableau.

**Ces mesures ne certifient ni une flotte entière de 5 000 trains, ni les FPS, ni la RAM totale de RE, ni les performances du PC utilisateur.** Le rendu, le GPU, les tuiles, le catalogue et les autres managers restent d’autres coûts. Le calcul physique RC4 et ses contrôles sont conservés.

## 5. TypeScript et code réellement livré

L’inventaire compte **86 modules applicatifs TypeScript**, leurs **86 sorties JavaScript** et **86 déclarations**, recompilées dans un dossier neuf puis comparées octet par octet. Les trois bundles core/catalogue/admin sont régénérés puis reconstruits indépendamment à l’identique ; `index.html`, `admin.html` et le chargement différé utilisent **1199repair5**. Le core charge 85 modules ; les décomptes par bundle se recouvrent et ne se somment pas aux 86 sources.

Il n’y a pas de nouveau module applicatif JavaScript sans source TS. Les données JS pures, les outils de construction/tests/QA et les bibliothèques externes restent distingués des sources applicatives.

Le comptage syntaxique réel reste **48 any, 28 @ts-expect-error, 0 @ts-ignore, 0 @ts-nocheck**. Aucun accroissement de ces dettes. Les compatibilités globales historiques affaiblissent toujours certains contrôles : **tout écrire en TS n’est pas encore un assainissement complet du typage**.

Les deux nouveaux modules passent en plus `tsc -p tsconfig.rc5-core.json`, isolés des compatibilités permissives ; l’administration conserve son contrôle strict indépendant. `TYPESCRIPT_AUDIT.json` et `RECOMPILE_PARITY.json` détaillent l’inventaire.

## 6. Tests et navigateur

| Contrôle | Résultat final |
|---|---:|
| Construction TypeScript, administration et nouveaux modules isolés | Réussie |
| Recompilation JS / déclarations | 86/86 et 86/86 identiques |
| Suite standard | 102 834 réussites, 0 échec |
| Suite ciblée de réparation | 196/196 |
| Nouveaux tests RC5 inclus dans ces 196 | 34/34 |
| Gate S3 complète | 224/224 fichiers actifs ; 11 archives supersédées inchangées |
| Sous-ensemble comparable de 28 nouveaux tests sur RC4 | 26 échecs attendus, 2 témoins réussis |

Les suites se recouvrent et **ne s’additionnent pas**. Plusieurs tests couvrent une même cause ; les échecs de RC4 comprennent des fonctionnalités de récupération inexistantes, pas 26 bugs indépendants. Les six tests spécifiques au nouvel index ne sont pas présentés comme s’ils existaient dans RC4.

La première gate a rencontré des assertions qui exigeaient encore le cache `1199repair4`. Leur littéral de version a été actualisé vers `1199repair5`, sans modifier les conditions métier ou les seuils de performances. Le faux FreightManager du test de diagnostics a été remplacé par le vrai manager avec une liste de services vide : ses assertions de continuité des autres managers sont conservées. L’historique de ces essais est fourni ; les fichiers `*-final` correspondent aux contrôles finaux réussis.

### Essai Chromium

Démarrage du bundle, 30 977 gares chargées, sept pages, fenêtre Correspondances et erreur RH injectée dans les diagnostics : aucun événement `pageerror` non géré. L’administration conserve les imports sans modification préalable, masque les éléments supprimés, traite les noms avec balises comme du texte, enregistre une modification et ouvre son dialogue incidents.

Un vrai `ActiveService` électrique a été ajouté à la boucle du jeu avec une route de test. À travers **LiveMap → Personnel → Incidents → LiveMap**, ses quatre relevés passent de **80,47 → 81,48 → 82,67 → 83,84 km/h**, et de **17,81 → 33,56 → 51,79 → 70,30 mètres** parcourus. Aucune avance physique n’est injectée manuellement par le test : le moteur tourne normalement entre les relevés.

**Limites :** navigation HTTP locale et `file://` bloquée par la politique de l’environnement. Le test utilise donc un vrai DOM Chromium avec les fichiers fournis injectés et un stockage isolé en mémoire. Ce n’est pas un essai de distribution native ou de persistance IndexedDB de longue durée. Pas de certification des services externes, de l’audio, du GPS 3D complet ni d’une longue session chargée. Le scénario à un train ne clôt pas **LM03**, le blocage exact à 12 km/h sur le PC utilisateur.

## 7. Installation et reste à faire

Exporter la sauvegarde actuelle, conserver la RC4 et extraire la RC5 dans un **nouveau dossier**, sans mélanger les fichiers. Le jeu est précompilé : ouvrir `index.html`. Node et TypeScript ne sont nécessaires qu’aux commandes de développement et de contrôle. Tester d’abord une copie de partie.

Pour vérifier les nouveautés : insérer un arrêt sur un parcours en boucle avec VIA ; ajouter une origine avant le premier arrêt ; interrompre un contrat chargé puis atteindre un arrêt commercial ; exporter/recharger avec des cargaisons en transport ; changer de page avec un train en mouvement.

Il reste notamment les voies exactes/manœuvres/TAQ, remorquage et sécurité DDS, replay complet des longues absences, consommables, effets restants des améliorations de gare, routabilité des contrats industriels, cohérence totale full/macro et certains échappements HTML. SC29 (calendrier legacy autour de minuit) reste à confirmer. Le plafond absolu des cellules physiques SC28 n’est pas déclaré résolu.

Le paquet conserve les ressources originales et les preuves historiques. **Le manifeste courant est `QA/FILE_SHA256_MANIFEST.txt` ; les anciens sceaux/rapports Alpha et RC précédents sont de l’historique, pas des attestations de RC5.**
