# Rail Empire — RC23 FULL

## Objet de la livraison

Base : archive RC22 FULL fournie. Ajout de Jour/Nuit/Auto dans le GPS, de Nuit dans les filtres 2D et remplacement du rendu nocturne trop grossier par une stratégie adaptée au zoom. Ouverture directe de **`index.html`** conservée ; aucun nouveau lanceur, serveur ou fournisseur ajouté.

L’enquête est dans `ENQUETE_VUE_NUIT_RC23.md`, avec références officielles NASA, CARTO et OSM. La présente qualification n’affirme ni une carte nocturne mondiale en haute résolution, ni la levée d’une 403, ni une amélioration globale des FPS.

## 1. Commandes GPS et 2D

Le GPS propose **Éclairage visuel : Auto / Jour / Nuit**, indépendant du filtre météo visuel. Jour et Nuit peuvent être forcés quelle que soit l’heure de la simulation. Le choix est mémorisé dans une préférence locale, sans toucher au format de partie ou au stockage physique des trains.

La case **☾ Nuit** rejoint le groupe Affichage carte en 2D. En GPS, les deux commandes se synchronisent. Les panneaux sont défilables et ne se chevauchent pas aux trois formats contrôlés : 1280×900, 768×1024 et 375×667. La molette dans un contrôle n’est plus interceptée pour déplacer le zoom GPS.

Quitter le GPS restaure les filtres 2D précédents. Rechoisir OSM original a priorité sur une nuit forcée : le fond est remis en couleurs originales. Auto préserve ce choix explicite, comme dans RC22 ; Nuit permet ensuite de le transformer volontairement en style sombre.

Les tests vérifient qu’un passage en Nuit à midi ne modifie ni l’heure, ni l’objet météo physique. Les sources de la boucle principale et des moteurs de simulation sont inchangées. Voir `SOURCE_DIFF_SCOPE.json` pour la liste exhaustive des sources modifiées.

## 2. Correction du fond nocturne

RC22 utilisait une couche lumineuse NASA native jusqu’au zoom 8 avec 88 % d’opacité, y compris en zoom GPS rapproché. La nouvelle règle ne fait plus passer automatiquement à Satellite lorsque le joueur assombrit OSM.

| Situation | RC23 |
|---|---|
| Satellite, zoom ≤ 8 | Lumières NASA natives ≤ 8, opacité maximale 30 % |
| Satellite, zoom 8 à 10 | Disparition progressive de la couche NASA |
| Satellite, zoom ≥ 10 | Aucune nouvelle demande ni dessin NASA pour la vue ; satellite détaillé de jour avec une teinte uniforme |
| OSM + Nuit | Style sombre local sur le même fond, sans source satellite implicite |
| OSM original rechoisi | Couleurs originales, filtre Nuit annulé |

Le fond satellite local reçoit une teinte d’opacité 0,48 au lieu de 0,68. Aucun nouvel algorithme de flou, aucune accentuation inventant du détail ni couche GPU « screen » n’est introduit. Les limites natives du satellite restent inchangées (niveau 20) ; les très forts agrandissements peuvent donc toujours montrer les limites de l’image de base.

Les crédits dépendent des couches réellement demandées : NASA disparaît du crédit de proximité, les autres attributions restent visibles. La ligne d’aide précise **« satellite de jour assombri »** plutôt que de prétendre afficher une photographie nocturne détaillée.

## 3. Contrôle du rendu et du coût

Le nouveau banc navigateur utilise le vrai module TileMap de RC22, extrait de son ZIP, puis celui de RC23 et le vrai Canvas Chromium. Les réponses image sont des tuiles de calibration synthétiques : aucune carte réelle n’a été collectée.

Dans la vue de 256×256 au zoom 16, RC22 demande les deux couches satellite et NASA ; RC23 ne demande que le satellite. L’image RC23 est identique, canal par canal, à la même image diurne plus une seule teinte uniforme : **zéro canal différent** sur 262 144 canaux comparés. Il s’agit de la fidélité du pipeline par rapport au rendu attendu, pas d’une identité visuelle jour/nuit ni d’une validation de la résolution de chaque fournisseur.

Les zooms 10, 12,5, 16, 20 et 30 sont couverts par les tests de non-demande de NASA. Une transition de zoom 8 vers 14 retire bien la couche sans attendre une nouvelle entrée en GPS. Les bascules conservent le cache d’images décodées ; un refus 403 reste mémorisé.

Le GPS complet est ensuite réellement dessiné dans le navigateur, y compris après l’arrêt volontaire de l’horloge dans le banc. Les captures ne se limitent pas à des contrôles dont seul l’état interne a changé. Les trois tailles d’écran présentent le crédit correct et des tuiles chargées dans le banc.

C’est un retrait ciblé de travail raster et de requêtes inutiles à proximité. **Aucun benchmark de FPS global, de mémoire totale ou de plusieurs heures sous Opera n’est annoncé.**

Preuves : `QA/RE_REPAIR_RC23/browser-night/results.json` et ses captures. Toutes les captures sont explicitement des calibrations, pas des fonds réels.

## 4. Qualification relancée

| Contrôle | Résultat |
|---|---:|
| Configurations TypeScript, principale comprise | 18 réussies |
| Suite standard | 102 834 / 102 834 |
| Suite de réparation | 1 039 / 1 039, dont 22 nouveaux tests |
| Groupe ciblé cartes/GPS | 74 / 74 |
| Régressions S3 | 275 / 275 fichiers actifs |
| Nouveaux scénarios navigateur Jour/Nuit | 13 / 13 |
| Scénarios navigateur transport OSM HTML | 10 / 10 |
| Navigation historique dans le navigateur | 16 pages |
| Trains avançant entre les pages | 600 / 600 aux quatre observations |
| Reconstruction indépendante | 126 modules, 126 déclarations, 3 bundles identiques |
| Ressources comparées à RC22 | 37 152 fichiers inchangés |

Le cycle réel de secours du banc repasse : approche, intervention, retour, réception au dépôt. Les contrôles de restauration et d’avancement chronologique sont relancés.

Les comptes des suites se recouvrent ; **ils ne s’additionnent pas**. Les onze exclusions historiques S3 sont conservées sans ajout. Les journaux sont ceux de cette exécution, et non les copies des résultats RC22.

Le nouveau `map-lighting.ts` passe une configuration stricte isolée, sans les déclarations globales permissives du projet. L’ensemble conserve **36 `any` explicites et 28 `@ts-expect-error`**, zéro nouveau `@ts-ignore` ou `@ts-nocheck`. Le typage strict intégral du reste du jeu demeure un chantier séparé.

### Maintenance explicite des anciens tests

Trois fichiers de vérification ancienne de code-source (hotfix70/71/72) supposaient que Nuit force Satellite, que NASA soit constamment superposée à 88 % et créditée à tout zoom. Ces attentes contredisaient la modification demandée. Elles ont été remplacées par les nouvelles règles et complétées par les essais de rendu effectif. Les protections contre le mélange « screen », les filtres lourds et les accès refusés restent testées. Aucun test n’a été retiré ni exclu pour obtenir un feu vert.

Le premier lancement du banc historique échouait uniquement parce qu’il attendait la chaîne `RC22` dans le diagnostic ; l’export contenait correctement `RC23`. Une copie dédiée RC23 a été exécutée jusqu’au bout. Le journal de cet essai initial est conservé. Les premiers ajustements d’assertions source sont également documentés dans les logs ciblés.

## 5. Périmètre exact des modifications

Sources fonctionnelles modifiées : `map.ts`, `renderer.ts`, `map-source-panel.ts`, `ui.ts`. Nouveau module : `map-lighting.ts`. Identité de build actualisée : `build-info.ts`. HTML, CSS, index de bundle et configuration de qualification ajustés.

La comparaison constate **123 fichiers source TypeScript/de contrats inchangés**. La boucle `main.ts` et le transport `tile-access-policy.ts` sont strictement identiques à RC22. Les images, données, sons et ressources du jeu sont conservés, ainsi que l’historique de développement : livraison FULL uniquement.

## 6. Limites à conserver dans le bilan

La navigation native vers `file:///…/index.html` a été tentée et refusée par la plateforme de test (`ERR_BLOCKED_BY_ADMINISTRATOR`). Aucun contournement de sécurité n’a été utilisé. Les vrais bundles ont donc été injectés dans un navigateur isolé avec DOM et Canvas réels, stockage de test et requêtes interceptées. La couche réseau file-mode a été modélisée ; ces résultats ne certifient pas un vrai chargement local sous Opera/Win7.

Aucun téléchargement de tuiles OSM, Esri ou NASA réel n’a été effectué pendant les tests. Les erreurs réseau de services externes bloqués, visibles dans les journaux, ne sont pas présentées comme des succès d’accès. Les exceptions JavaScript de page sont absentes sur les parcours validés.

L’ancien dispositif de lancement HTML et les protections d’accès sont conservés ; cette livraison ne prétend pas lever une ancienne 403. Les images disponibles dans une zone, le quota physique du navigateur, l’audio et les longues sessions réelles restent hors de cette qualification.

## 7. Installation et intégrité

Exporter la partie et conserver RC22. Extraire la FULL RC23 dans un dossier distinct et double-cliquer uniquement sur **`index.html`**, avec ses fichiers voisins. Ne pas lancer les deux versions simultanément et ne pas vider les données du site. Le guide `LIRE_AVANT_RC23.md` explique les commandes.

Le manifeste `RC23_SHA256_MANIFEST.json` couvre les fichiers de l’archive hors manifeste lui-même. La vérification finale de CRC, empreintes et stabilité du dossier pendant la création est enregistrée à côté de la livraison dans `RE_RC23_PACK_INTEGRITY.json`. Les empreintes sont un contrôle d’intégrité, pas une signature de l’éditeur.
