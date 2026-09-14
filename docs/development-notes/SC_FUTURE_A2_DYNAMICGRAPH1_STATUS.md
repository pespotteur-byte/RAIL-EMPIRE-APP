# Rail Empire 1.1.87 — SC Future A2 DynamicGraph1

Correctif du blocage `RAILGRAPH_DATA_MISSING` observé après un clic exact sur une voie.

## Nouveau flux
1. Le clic exact reste un hit-test écran sur la géométrie OSM, pas un rayon en mètres.
2. Le routeur tente d'abord le RailGraph statique local.
3. Si cette zone n'a pas encore de pack statique, le SC prépare un corridor ferroviaire réel borné.
   - <= 4 km : OSM main corridor, nœuds/ways exacts.
   - > 4 km : corridor railway-only tuilé.
4. Le calcul est ensuite fait localement sur les ways acquis.
5. Un seul élargissement de corridor est permis si la topologie réelle impose un détour.
6. Aucun tracé droit/synthétique n'est accepté.

## QA
- 45/45 tests ciblés SC Future + éditeur + RailGraph : PASS.
- 78/78 tests éditeur/core/régional ciblés : PASS.
- Bundle JS : syntaxe PASS.
- `data/railnet/stations` : identique octet pour octet à EXACTCLICK1.
