# Rail Empire 1.1.87 — Station Strict / Schedule Creator Future Alpha 1

Base: `Rail_Empire_v1.1.87_STATIONS_STRICT_FINAL` (31,009 stations).

## Schedule routing architecture
- Schedule Creator track picking is **local-only**.
- Route computation uses the packaged `RailGraphPack` only.
- No OSM API / Overpass request is required or permitted by the Schedule V3 routing path.
- Exact OSM way/node geometry is authoritative.
- No synthetic straight connector fallback.
- `railway=tram`, `subway`, `light_rail` excluded by the RailGraph builder.
- Binary V2 packed shards, coarse long-distance graph, bounded detailed-shard LRU (96 MiB).
- If the exact local topology is not packaged or cannot fit the memory budget, routing fails closed with a structured error instead of silently switching to a live web route.

## Important field limitation of this alpha
The engine and builder are present, but this release intentionally ships `data/railnet/tracks/manifest.js` with `prepared:false`: the real Europe/Germany PBF track pack could not be embedded from the build environment. The included test fixtures validate the offline engine itself.

To create a real field pack, run `scripts/build_railgraph_pack.py` against one or more OSM/Geofabrik `.osm.pbf` extracts and target `data/railnet/tracks`.

Priority field routes once a Germany pack is built:
1. Karlsruhe Hbf → local VIA (~3 km)
2. Mannheim-Friedrichsfeld → Weinheim
3. Karlsruhe Hbf → Kassel Hbf
4. Repeated VIA routing / prefix stability
5. Repeat with Internet disconnected

## QA finale de l’alpha 1
- Station Strict: dossier `data/railnet/stations` byte-identical à la base autoritaire.
- SCV3 RailGraph ciblé: 14/14 PASS.
- Contrat SC Future local-only + anti-backup: 1/1 PASS.
- Batterie MJS actuelle: 302/305 PASS. Les 3 échecs restants sont des tests historiques qui injectent l’ancienne API réseau du Schedule Router; ils ne correspondent plus au contrat SC Future.
- Builder fixture: 5 ways → 1 shard `prepared:true` → route 4 points, 0 réseau.
- Syntaxe JS / Python / bundles: PASS.
