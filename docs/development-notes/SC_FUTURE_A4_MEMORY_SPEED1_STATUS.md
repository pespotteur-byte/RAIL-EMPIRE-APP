# Rail Empire v1.1.87 — SC Future A4 MEMORY-SPEED1

Date: 2026-08-22
Base: STATIONS STRICT SC FUTURE A3 LABELPERF1
Stations: 31,009; station pack unchanged byte-for-byte (19/19 files identical).

## Fix 1 — Sillon Vmax -> timetable retiming
- Root cause: routed geometry stored line speeds already capped by the sillon Vmax used when the route was created.
- Route geometry now preserves raw infrastructure Vmax.
- Sillon/rolling-stock Vmax is applied only by the timing/physics engine.
- Changing sillon Vmax retimes the same route without rerouting geometry.
- QA explicitly verifies V80 -> V160 on V200 infrastructure changes travel time while route infrastructure data remains V200.

## Fix 2 — Long-route memory / OOM hardening
- Long dynamic corridors are transient working data instead of being duplicated into persistent resident ORM RAM caches.
- Long tile fetch remains streamed at max 2 concurrent tiles; no duplicate hedged response bodies.
- Detailed graph edges share per-way metadata instead of copying large metadata objects on every directed edge.
- A* can use compact edge-object state keys instead of large generated string keys.
- Exact Schedule anchors use the closest authoritative segment and avoid candidate-state blow-up.
- Completed transient merged corridor data is released after the leg is remembered.
- Existing SCV3 96 MiB local RailGraph memory governor remains fail-closed.

## Fix 3 — Very long real railway detours
- Still only one widening rescue pass (no restoration of the old many-layer fallback ladder).
- Rescue corridor width now scales with leg distance, up to 90 km, so real routes that deviate strongly from the straight chord (e.g. Fulda/Kassel-style paths) are not incorrectly excluded.

## Retained A3 behavior
- Exact screen-space track click (no 20 m / 80 m picker radius contract).
- Authoring order of stations/VIA is strict click order.
- Long-stream max 2 network tiles simultaneously.
- Station labels hidden below zoom 10.5; thinned until zoom 13.5; markers remain clickable.
- No synthetic straight-line railway fallback.

## QA
- Targeted SC/routing/runtime regression battery: 73/73 PASS.
- All .test.mjs: 312/315 PASS.
- The 3 remaining failures are unchanged legacy tests for removed pre-SC-Future contracts:
  1. v1.1.45 old NETWORK_UNAVAILABLE UI mapping.
  2. v1.1.49 old vector-OSM error text.
  3. v1.1.83 old explicit 3-minute routing budget failure.
- JS syntax: PASS for modified modules and rebuilt core/catalog file bundles.
- File bundle rebuilt after final A4 changes: 64 core modules / 66 catalog modules.

## Field validation still required
Do not mark SC FINAL until browser field testing confirms:
1. Change sillon Vmax on an already-routed trip and verify arrival/departure times change without route geometry changing.
2. Re-run the route that previously OOM'd.
3. Test Darmstadt -> Hannover and/or Karlsruhe -> Kassel.
4. Confirm failure, if any, is clean (no browser OOM, no synthetic connector).
