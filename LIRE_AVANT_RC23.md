# Rail Empire RC23 FULL — Jour/Nuit GPS et Nuit en 2D

## Lancement : uniquement le HTML

Conserve RC22 et un export de ta partie. Ferme son onglet, extrais toute RC23 FULL dans un nouveau dossier, puis double-clique sur **`index.html`**. Aucun `.cmd`, `.exe` ou serveur local n’est nécessaire au nouveau fonctionnement. Ne déplace pas le HTML seul : les bundles et ressources voisins restent nécessaires.

Ne vide pas les données du navigateur. Si la partie n’apparaît pas dans le nouveau chemin local, importe l’export conservé. Le comportement du stockage `file://` dépend du navigateur et du chemin ; il n’est pas validé ici sur Opera/Win7. Ferme une version avant d’ouvrir l’autre.

Les anciens utilitaires de lancement restent archivés par compatibilité dans la FULL. RC23 n’en ajoute pas et l’ouverture directe du HTML ne les invoque pas.

## Dans le GPS

Le panneau possède désormais **Éclairage visuel**, juste avant la météo :

- **Auto · heure du jeu** : reprend le cycle jour/nuit. Le choix explicite d’OSM original garde toutefois ses couleurs originales ; une note le rappelle.
- **Jour** : force un affichage de jour, même si la simulation est à 23 h.
- **Nuit** : force un affichage de nuit, même à midi.

Ces modes ne changent ni l’heure simulée, ni les horaires des trains, ni les incidents, ni la météo physique. Ils se combinent avec Pluie, Dégagé et les autres filtres météo visuels.

Le choix Auto/Jour/Nuit est mémorisé comme préférence locale quand le navigateur autorise son stockage. Quitter le GPS restaure les filtres 2D présents avant l’entrée ; revenir au GPS reprend son choix d’éclairage.

Les panneaux de droite sont séparés et défilables sur les petits écrans. Une molette utilisée dans leurs commandes ne doit pas zoomer la carte.

## En 2D

La case **☾ Nuit** est dans **Affichage carte**, avec Satellite, OSM original et les autres filtres. Elle assombrit le fond sélectionné, sans imposer un autre fournisseur. En GPS, elle est synchronisée avec Jour/Nuit.

Rechoisir **OSM original** signifie retrouver volontairement ses couleurs originales : cela annule le filtre Nuit, y compris la nuit forcée du GPS. Pour OSM sombre, garde ce fond puis coche Nuit à nouveau.

## Quelle image nocturne ?

**En proximité : satellite de jour assombri, pas une nouvelle photographie satellite de nuit.** La couche NASA trop grossière disparaît complètement à partir du zoom 10. Les détails de l’image de base restent à leur résolution existante ; aucun filtre de flou ou de netteté artificielle n’est ajouté.

En vue régionale, les lumières NASA restent présentes, mais beaucoup moins opaques ; elles s’effacent progressivement entre les zooms 8 et 10. Sur OSM, il s’agit d’un style sombre local, pas du satellite.

Le satellite de base peut encore être flou à un agrandissement extrême ou si le fournisseur n’a pas d’image fine dans une zone. RC23 corrige spécifiquement le halo géant créé par le sur-agrandissement de la couche de lumières.

## Accès cartographique

Une connexion et l’autorisation des fournisseurs restent nécessaires pour recevoir leurs nouvelles images. Les filtres ne suppriment pas une ancienne 403 et ne lancent pas de contournement. Les crédits demeurent visibles et le transport HTML de RC22 est conservé.

Les vérifications navigateur utilisent les vrais bundles avec un réseau et un stockage isolés. La navigation native `file://` est interdite par la plateforme de test ; le lancement réel sous Opera/Win7 et l’accès réel aux fournisseurs ne sont donc pas certifiés par cette livraison.

## Documents et vérifications

- `RE_REPARATION_RC23_RAPPORT.md` : changements et qualification.
- `ENQUETE_VUE_NUIT_RC23.md` : sources officielles, choix et limites.
- `QA/RE_REPAIR_RC23/SUMMARY.json` : résultats structurés de cette passe.
- `RC23_SHA256_MANIFEST.json` : empreintes des fichiers de la FULL, hors manifeste lui-même.

Les anciens rapports et tests restent conservés comme historique ; ils ne remplacent pas le bilan RC23.
