# Rail Empire 1.1.87 Station Strict — SC Future ExactClick 1

- Base stations: STATIONS_STRICT_FINAL, 31 009 stations; station shard directory byte-identical.
- Exact track selection no longer accepts an arbitrary metre-radius snap.
- When a station is selected, the SC centers it and raises zoom to >=17 for physical track separation.
- Track binding loads OSM vector candidates around the cursor, projects their geometry with the same TileMap/WebMercator transform, and accepts only a segment hit within 5 screen pixels.
- Ambiguous overlapping tracks (<0.75 px difference) fail closed and ask the player to zoom rather than guessing.
- The metre quantity used internally by vector acquisition is derived from pixel scale and is not a selection threshold.
- Schedule route calculation remains SCV3 RailGraph local-only: no OSM/Overpass route fallback, no synthetic straight connector.
- Targeted QA: 54/54 PASS (Schedule editor/integrity + SCV3/RailGraph tests).
