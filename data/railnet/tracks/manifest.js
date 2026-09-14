// Rail Empire SC V3 — local vector rail graph manifest.
// The runtime never fabricates railway geometry. Because no static planet pack is bundled,
// first use of an uncached world cell may fetch OSM/Overpass vector data during Schedule routing;
// validated positive cells are then persisted locally. Raster OpenRailwayMap PNG tiles are never
// treated as routable vectors.
globalThis.__RAILNET_TRACK_PACK__ = {
  schema: 'rail-empire-railgraph-v1',
  version: 1,
  prepared: false,
  source: 'OpenRailwayMap / OpenStreetMap railway infrastructure',
  attribution: '© OpenStreetMap contributors; OpenRailwayMap',
  reason: 'STATIC_WORLD_TRACK_PACK_NOT_BUNDLED;_RUNTIME_WORLD_OSM_VECTOR_CACHE_ENABLED',
  runtimeWorldBase: true,
  runtimeWorldCoverage: 'global',
  runtimeWorldCellDeg: 0.5,
  shards: [],
  coarse: null
};
