# Rail Empire RC21 FULL — installation et carte OSM

**Conserver RC20 et un export de la partie avant toute installation.** Extraire RC21 dans un nouveau dossier, sans superposer les fichiers.

Fermer les anciens onglets de RE et arrêter l'ancien lanceur. Lancer `LANCER_RE.cmd` depuis le dossier RC21 et garder sa fenêtre ouverte. Conserver la même adresse locale et le même port que d'habitude (`http://127.0.0.1:8765/index.html` avec le lanceur fourni). Ne pas vider les données du site. Si le lanceur indique que le port est occupé, arrêter l'ancien serveur plutôt que changer de port au hasard.

Dans la LiveMap, cocher **OSM original**. Cela choisit le véritable fond standard OpenStreetMap, et non un aplat ou une approximation. Le satellite et le composite satellite nocturne sont désactivés par ce choix. ORM demeure indépendant : le conserver coché pour la surcouche ferroviaire. Pour le style sombre, décocher OSM original ; pour le satellite, choisir Satellite.

Le choix original est respecté lors de l'entrée GPS. Les effets météo visuels restent distincts du fond cartographique. Les liens de licence restent visibles.

### Fond absent

Lire le bandeau **Fond de carte**, visible même quand le panneau de source est replié. Le message distingue un chargement, un refus 403, une saturation 429, une erreur réseau/CORS et une ouverture directe du fichier.

En `file://`, OSM standard reste suspendu : le navigateur n'a pas le référent HTTP attendu. Reprendre par le lanceur local. Le changement d'origine peut rendre la sauvegarde de l'autre ouverture invisible sans l'effacer ; importer l'export de référence.

Une 403 déjà mémorisée n'est pas levée par la nouvelle version ou par le bouton OSM. Après correction de sa cause, une reprise manuelle reste possible depuis le panneau de fond quand le délai le permet. **Ne pas multiplier les clics, effacer le stockage ou changer d'identité pour contourner le refus.** Le délai interne minimal de quinze minutes ne garantit pas un déblocage du service.

Le bouton **Afficher OSM original** dans les réglages de source restaure aussi la source canonique après un autre fournisseur choisi volontairement. Il ne supprime aucune suspension.

### Préservation de la partie

Cette mise à jour ne change pas le format des sauvegardes. Les livrées, horaires, numéros de rames, incidents, optimisations et comptabilité de RC20 sont conservés. Un export de partie reste nécessaire pour protéger tes données ; les images des tuiles OSM ne font pas partie de cet export.

L'aide **AIDE_CARTE_OSM.html** explique les règles et fournit les liens officiels. Les transferts vont directement du navigateur au fournisseur, pas par un proxy du lanceur. Le service public reste externe et sans disponibilité garantie. Les tests de livraison n'ont pas vérifié le réseau réel ou le cache physique d'Opera/Win7.

## Fichiers de contrôle

`RE_REPARATION_RC21_RAPPORT.md` : corrections, méthode, règles et limites.

`QA/RE_REPAIR_RC21/SUMMARY.json` : résultats réellement exécutés.

`RC21_SHA256_MANIFEST.json` : empreinte de chaque fichier du ZIP, hors manifeste lui-même. Ce contrôle d'intégrité n'est pas une signature d'éditeur.
