# RailGraph OSM mondial — Rail Empire 1.1.93

## Ce que « mondial » signifie

La grille couvre la planète entière. Rail Empire ne télécharge pas la planète au démarrage : il matérialise uniquement les cellules ferroviaires nécessaires aux zones utilisées par le joueur. Une cellule complète et validée est persistée dans IndexedDB puis réutilisée sans réseau lors des sessions suivantes.

## Hiérarchie des données

1. **OSM vectoriel** : existence et géométrie des voies.
2. **OpenRailwayMap / attributs ferroviaires** : enrichissement des mêmes voies.
3. **Raster OSM/ORM** : affichage seulement, jamais autorité de routage.

Ainsi, une panne du raster ORM ne doit plus transformer une voie réelle en « aucun way ».

## Boutons Schedule Creator

- **🌍 OSM monde** : diagnostic du cache mondial.
- **↻ OSM zone** : force une nouvelle acquisition des cellules visibles et remplace une ancienne cellule douteuse.
- **◉ OSM moteur** : visualisation passive des voies vectorielles réellement connues par le moteur.
- **↺ Auto segment** : recalcule le segment en ignorant l’ancien tracé mémorisé.

## Hors-ligne complet

Le builder existant peut transformer des fichiers `.osm.pbf` en pack local :

```bash
python3 scripts/build_railgraph_pack.py planet-latest.osm.pbf data/railnet/tracks --binary-v2 --binary-codec gzip
```

Pour une distribution réelle, un pack planète complet doit être construit sur une machine disposant de suffisamment de disque/RAM et devrait être distribué séparément du ZIP principal. La 1.1.93 est déjà compatible avec ce modèle de shards ; son mode par défaut construit le cache mondial progressivement.
