# Rail Empire — RC21 FULL : fond OpenStreetMap original

## Périmètre

Base : RC20 FULL fournie dans la conversation. Livraison FULL : jeu, sources et historique de qualification, sans retrait du catalogue, des images ou des sons. Cette passe vise le choix et l'affichage du fond OSM, son attribution et le diagnostic des erreurs. Le modèle de sauvegarde et les moteurs de circulation ne sont pas refondus.

## 1. Corrections reproduites

Le vrai fournisseur standard était déjà configuré en RC20, mais le choix visuel était incohérent. Le bouton de restauration de source ne désactivait pas le satellite ; le choix Basique désactivait aussi ORM. L'entrée GPS imposait des fonds et sa mise à jour nocturne pouvait remasquer le choix original.

| Action dans le même banc, sans accès réseau | RC20 | RC21 |
|---|---|---|
| Restaurer OSM alors que Satellite est actif | Satellite reste actif, style original inactif | OSM original actif, satellite désactivé |
| Choisir le style original avec ORM actif | ORM désactivé | ORM reste actif |

Preuve : `QA/RE_REPAIR_RC21/MAP_BEFORE_AFTER.json`, exécutée contre les véritables modules extraits de RC20 et les modules reconstruits de RC21.

La case est désormais nommée **OSM original**. Elle choisit la source standard canonique et désactive les fonds satellite/nocturne concurrents. Le fond conserve les couleurs de ses images : pas d'inversion ou de recoloration du raster original. ORM reste une surcouche indépendante. Décocher retrouve le style sombre. L'entrée GPS respecte ce choix ; le suivi satellite reste disponible lorsqu'il était choisi. Les voiles météo, les trains et les objets du jeu restent des couches distinctes.

L'écran ne présente plus un aplat clair comme une carte reçue. Un compteur distingue les tuiles réellement dessinées d'un simple accès autorisé. En l'absence de fond, un bandeau indépendant du panneau repliable explique le chargement, l'ouverture fichier, un refus, une saturation ou une erreur réseau. Les changements d'état ne sont plus retardés par la temporisation de mise à jour des simples compteurs.

## 2. Attribution et accès au service

Attribution contrastée et lien de licence présents sur la LiveMap, y compris en GPS ; les cartes secondaires utilisant TileMap reçoivent également un lien visible hors du canvas. Les textes de fournisseurs sont insérés comme texte, jamais interprétés comme HTML.

Le chargeur conserve l'URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, le cache HTTP normal et la politique de référent `strict-origin-when-cross-origin`. Aucun faux référent, en-tête User-Agent usurpé, paramètre anti-cache, proxy de contournement ou changement automatique de fournisseur n'est ajouté. Seules les tuiles de la vue sont demandées ; les requêtes abandonnées restent annulées. Les images déjà décodées sont réutilisées entre styles.

La limite de quatre transferts simultanés par service est partagée entre cartes de **la même page**, pas entre tous les onglets. C'est une protection du jeu, pas un quota officiel du fournisseur. Aucun préchargement de région, téléchargement cartographique hors ligne ou archivage de tuiles dans la sauvegarde n'est introduit. Le zoom source OSM reste limité à 19, même lorsque l'affichage zoome davantage.

Les refus 401/403 lisibles restent mémorisés, sans reprise automatique. Une sélection OSM n'efface ni ces refus ni une pause volontaire. `Retry-After` reste respecté lorsqu'il est accessible. Quinze minutes minimales avant une reprise manuelle ne signifient pas que le fournisseur a débloqué l'accès. Les erreurs sans statut lisible restent des erreurs réseau/CORS/décodage, pas des 403 inventées.

En `file://`, le fond public reste suspendu : utiliser l'origine HTTP du lanceur local. Le serveur de fichiers local ne relaie pas les demandes OSM. Sa politique de cache des **fichiers du jeu** est distincte du cache des images fournies directement par OSM.

Références officielles consultées le 13 septembre 2026 : [politique des tuiles](https://operations.osmfoundation.org/policies/tiles/), [licence et attribution](https://www.openstreetmap.org/copyright), [conditions OSMF](https://osmfoundation.org/wiki/Terms_of_Use), [règles d'attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [confidentialité](https://osmfoundation.org/wiki/Privacy_Policy). Ces règles et la disponibilité du service peuvent évoluer. L'intégration n'est pas une approbation d'OSMF ou une certification juridique. Les règles des autres fournisseurs restent distinctes.

## 3. Qualification

| Contrôle final exécuté | Résultat |
|---|---:|
| Configurations TypeScript | 17 réussies |
| Suite standard | 102 834/102 834 |
| Suite de réparation | 1 001/1 001, dont 16 nouveaux tests |
| Régressions S3 | 273/273 fichiers actifs |
| Exclusions historiques S3 | 11, aucune nouvelle |
| Reconstruction indépendante | 125 modules JS + 125 déclarations + 3 bundles identiques |
| Ressources comparées au ZIP RC20 | 37 152 fichiers inchangés |
| Navigateur : contrôles de fond/affichage/licence | 10 réussis |
| Navigateur : pages et circulation | 16 pages ; 600/600 trains progressent à chacune des quatre observations |

Dette TypeScript inchangée : **36 `any` explicites, 28 `@ts-expect-error`**, aucun nouveau `@ts-ignore` ou `@ts-nocheck`. Le typage strict intégral des anciens modules n'est pas déclaré terminé. Les cinq sources applicatives modifiées sont le chargeur de cartes, le panneau de source, le renderer, les choix GPS dans l'interface et l'identité de build. Les autres sources applicatives sont identiques au ZIP RC20.

Les résultats finaux, les nombres de tests et les sorties des commandes sont consignés dans `QA/RE_REPAIR_RC21/SUMMARY.json`. Les suites se recouvrent ; leurs nombres ne s'additionnent pas.

Les seize nouveaux tests couvrent la sélection, la séparation OSM/ORM, le maintien des refus, l'ouverture fichier sans requête, l'URL et les options de transfert, le zoom source, la réutilisation d'images, l'absence de recoloration et les transitions de diagnostic. Les vingt-huit tests existants du chargement réseau sont également recontrôlés dans la suite de réparation.

Dans Chromium isolé, le véritable décodage PNG et Canvas conserve exactement les pixels d'une tuile de calibration. **Cette image est synthétique et ne représente pas une carte OSM.** L'URL canonique et les options de fetch sont vérifiées séparément. Vingt changements de style ne génèrent aucune requête supplémentaire pour la vue déjà chargée. Le refus est ensuite conservé lors de la sélection explicite et de la recréation de la carte. Les événements du vrai jeu, le bouton de restauration, le GPS nocturne et les liens de licence sont exécutés. Les assertions de choix GPS utilisent un service de démonstration et suspendent le défilement de la simulation pendant les mesures de placement du lien ; les tests de circulation sont exécutés séparément. Le lien est accessible sans élément superposé en GPS et tient dans la fenêtre 768 × 1024.

La navigation générale, le diagnostic, la sauvegarde, la reprise et le secours sont exécutés avec les vrais bundles. Le scénario de 600 trains est observé sur carte, personnel, incidents et retour carte. Les ressources du ZIP de référence sont comparées par empreinte et les sorties TypeScript reconstruites dans un autre dossier.

### Entretien des anciens tests

Les jetons de version/cache de 48 fichiers ont été actualisés, sans retirer leurs assertions métier (`CACHE_TEST_UPDATES.json`). Le contrôle du bundle admin dérive maintenant sa version depuis le package. Deux attentes GPS ont été ajustées volontairement : lorsque le joueur a choisi OSM original, le satellite ne doit plus être forcé, y compris la nuit. La sélection explicite du satellite après OSM est également vérifiée dans le navigateur. Le script navigateur historique ne change que ses marqueurs de version ; ses anciens noms de fichiers `rc19-*` sont conservés et désignent les preuves exécutées sur RC21 dans ce dossier. Les différences exactes figurent dans `HISTORICAL_TEST_CHANGES.patch`. Aucune exclusion supplémentaire n'est ajoutée.

Les tentatives de développement ont notamment révélé des assertions restées sur RC20. Les journaux finaux et `SUMMARY.json`, et non les tentatives intermédiaires, constituent la qualification livrée.

### Limites réelles

La navigation native de Chromium vers le serveur local est interdite par l'environnement (`ERR_BLOCKED_BY_ADMINISTRATOR`). Les essais utilisent donc HTML et bundles injectés, stockage et origine simulés, transferts interceptés. **Aucune collecte de vraies tuiles n'a été effectuée par les tests.** Cela ne démontre ni la disponibilité du service public, ni le référent réellement émis par le profil Opera de PE, ni son cache disque natif. Le serveur Node local a été exécuté et ses en-têtes vérifiés séparément. Le lanceur Windows/C# est inchangé et n'a pas été exécuté ici.

Aucun gain général de FPS, aucune baisse du quota physique et aucune levée de la 403 personnelle ne sont annoncés. La source OSM n'est pas imitée par un fond de substitution ; si le service refuse encore l'accès, le jeu affiche cette limite.

## 4. Installation

Conserver RC20 et un export connu comme valide. Fermer l'ancienne version et son serveur, extraire RC21 FULL dans un nouveau dossier puis lancer `LANCER_RE.cmd`. Conserver l'hôte et le port habituels. Cocher **OSM original** dans la LiveMap. En passant de file:// à HTTP, importer l'export si l'ancien stockage n'est pas visible. **Ne pas effacer les données du site.** Voir `LIRE_AVANT_RC21.md` et l'aide intégrée `AIDE_CARTE_OSM.html`.
