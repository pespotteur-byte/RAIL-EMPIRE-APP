# RailGraph OSM mondial — sécurité cache 1.1.94

La couverture du RailGraph runtime reste mondiale, découpée en cellules de 0,5° × 0,5°. Les cellules contenant de vraies géométries ferroviaires OSM sont conservées durablement dans IndexedDB et peuvent être réutilisées hors ligne.

## Règle nouvelle pour une cellule vide

Une réponse HTTP valide contenant **0 voie** n'est plus considérée comme une preuve suffisante qu'une cellule du monde est réellement sans chemin de fer.

1. RE interroge la source OSM/Overpass prévue.
2. Si au moins une voie valide est reçue, la cellule positive est conservée durablement.
3. Si la réponse contient 0 voie, RE demande une confirmation à un autre endpoint mondial.
4. Si l'autre endpoint renvoie des voies, la réponse vide est rejetée et les voies récupérées deviennent l'autorité locale.
5. Si deux endpoints indépendants confirment 0 voie, RE peut mémoriser temporairement une cellule négative.
6. Cette cellule négative expire automatiquement (6 h par défaut) et sera donc revérifiée plus tard.
7. Si la confirmation indépendante échoue, aucune cellule vide n'est enregistrée : la zone reste « manquante » et sera retentée.

## Migration depuis 1.1.93

Les anciens enregistrements `complete:true` + `ways:[]` créés par la 1.1.93 ne sont plus reconnus comme valides. Ils sont supprimés automatiquement au prochain accès. Les cellules positives de la 1.1.93 restent compatibles.

## Boutons Schedule Creator

- **🌍 OSM monde** : affiche l'état de la couche mondiale et les compteurs de sécurité du cache.
- **↻ OSM zone** : supprime et recharge les cellules mondiales visibles si une zone paraît encore incomplète.
- **↺ Auto segment** : recalcule le segment avec les générations de route actuelles.

## Cache de route

La 1.1.94 utilise `schedule-route-v7` et `exact-leg-v4`. Les itinéraires mémorisés par les générations antérieures sont volontairement ignorés.

## Pack planète offline

La build principale ne contient toujours pas un `planet.osm.pbf` complet. La couverture mondiale est obtenue à la demande et mise en cache. L'architecture reste compatible avec la génération ultérieure de shards statiques depuis un planet PBF pour une distribution offline séparée.
