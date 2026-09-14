# AUDIT PERFORMANCE — Rail Empire v1.1.43

Baseline audited: v1.1.42 exact source/bundle tree. Scope: all persistent loops, Livemap renderer, train movement hot paths, Schedule V2 planning, catalogue startup, hidden-page UI setup, timers, OSM streaming and packaging/cache busting.

## Confirmed defects and repairs

1. **Static Livemap cache declared but never used.** Tracks, depots, zones, VoiePoints and all gameplay stations were reprojected/redrawn at ~30 FPS. v1.1.43 activates a real offscreen static overlay and invalidates it only on camera/data/toggle changes.

2. **17,817 all-zoom stations were redrawn every frame at zoom 5.** The hard all-stations requirement is preserved, but the complete station layer now lives in the static overlay instead of the dynamic frame path.

3. **Map rendering continued while the map was hidden or totally idle.** `gameLoop()` now renders the Livemap only on the Map page and only for visible motion, explicit invalidation/tile dirty state, or a 1 Hz idle heartbeat.

4. **`moveTick()` built viewport projections, service grids, route indexes and LOD arrays at 10 Hz with zero moving trains.** A true zero-moving fast path now skips all of that; waiting/predeparture logic remains on the second tick.

5. **Schedule V2 timing cache deep-copied ORM geometry.** `_timedVersion()` previously constructed a full `ScheduleVersion(ver.toJSON())`, copying potentially thousands of route points and rerunning physics. It now shallow-clones only mutable timing objects and shares immutable route geometry.

6. **Schedule V2 cache check happened after a route-wide electrical/profile scan.** Even a cache hit could traverse every ORM segment once/second. v1.1.43 computes a cheap formation/version input signature first and returns the cached timed version before `_actualProfile()` touches the route.

7. **Direct Rame proxy was rebuilt repeatedly.** `RotationV2Manager.upsertRameProxy()` now uses a physical/location signature and reuses the same proxy unless the actual Rame changes.

8. **Train infrastructure-speed hot path rescanned route from index 0 for each 10 m sample of train length.** It now walks the contiguous occupied segment backwards from the current state index.

9. **Negative speed-transition braking cap rescanned the complete remaining route every 100 ms.** Downward transitions are indexed once per route leg and searched with bounded lookahead.

10. **Legacy passage-stop discovery performed a stations × route-points Cartesian scan.** It now uses `World.getStationsNear()` spatial lookups around route points.

11. **Batch186 FullCatalog (63 chunks / ~26 MB source) auto-loaded while player was on Livemap.** Full catalogue loading is now strictly lazy and starts only on catalogue-dependent pages.

12. **Batch186 chunk insertion rebuilt a Set of all catalogue IDs for every chunk.** A single `_batch186ExistingIds` index is reused for the entire load.

13. **Catalogue seeding could duplicate thousands of rolling-stock objects.** `seedCatalog()` built an ID Set but failed to add newly seeded IDs into it. `adminSync.loadOverrides()` then called seeding again. `RollingStockManager.add()` is a plain `push`, so duplicates were real. v1.1.43 adds each ID immediately and admin completion applies only incremental overrides.

14. **The ~16k base rolling-stock catalogue was materialized on every Livemap startup.** Saved Rames already persist complete `elementDetails`, so the map/runtime do not need the stock catalogue. v1.1.43 seeds only cargo definitions at startup; base stock is materialized lazily on Matériel/Rames/Roulements/Dépôts, before FullCatalog.

15. **Hidden rolling-stock UI scanned the ~16k base catalogue during `setupAll()`.** Wagon subcategory population is deferred until Matériel is opened.

16. **Schedule V2 / Rotation V2 authoring UI was eagerly constructed at game startup.** Those editors inject large style/overlay DOM. They are now instantiated only when Horaire/Roulements is opened.

17. **Header/weather/diagnostic UI was refreshed too frequently.** Header/weather/alerts are throttled and avoid identical DOM writes; V2 diagnostic/sidebar and freight/trains use slower bounded refreshes with content equality where applicable.

18. **Industries were still rendered in the dynamic map path.** They are part of the static Livemap overlay now.

19. **Low-zoom station panning still paid 17,817 Web-Mercator sin/log projections whenever the static layer had to move.** Each station now caches normalized Mercator coordinates; camera pans apply only scale/translation arithmetic. Station coordinate edits invalidate that station's cached projection automatically.

20. **Version/cache-buster verified.** Exact v1.1.42 packaging was rechecked and was already correctly stamped V1.1.42 / `v=1142`; the earlier stale-v1.1.41 suspicion was false. v1.1.43 keeps an explicit V1.1.43 / `v=1143` regression guard.

## Investigated and rejected as startup root causes

- The suspected 17,817-station `<option>` DOM explosion in hidden Depot/Works/Line pages is **not a startup path**. Those station selects are built only when the corresponding modal/creator is opened. No blanket removal was applied.
- Schedule/ITE/Sillon/Works/Infogare map intervals are modal/page guarded; they are not persistent heavy Livemap loops while closed.
- Autosave is 60 s and idle-scheduled; admin incident polling is 60 s. Neither explains continuous baseline jank.
- Tile/cloud/weather layers have normal dirty flags and are not permanently enabled by default.

## Contracts intentionally preserved

- All 17,817 gameplay stations remain visible at minimum zoom.
- OSM/ORM remains route authority; no synthetic straight-line fallback is introduced.
- Direct Rame assignment, real rotations, J+1 handling, Schedule V2 second-level departures, WAYPOINT→gare routing and Livemap train imagery/context remain in scope and are covered by regression tests before release.

## Additional whole-code findings after crash recovery

21. **17,817 empty platform-occupancy Maps were allocated at startup.** The all-Europe station bootstrap called `PlatformManager.initStation()` for every gameplay station, even with zero trains. Platform state is now created lazily on first actual platform use. OSM station streaming no longer preallocates platform state either.

22. **Dynamic platform overlay iterated visible stations even when no platform was occupied.** The renderer now iterates sparse `stationPlatforms` state and immediately skips empty occupancy Maps. With zero trains, this layer is effectively empty work.

23. **Works update rescanned all tracks and invalidated the complete static map every minute even with no works.** Work and incident visual signatures now gate both the track scan and `Renderer.invalidateStatic()`; unchanged state causes no re-rasterization of the 17,817-station layer.

24. **Historical ORM coverage was replayed on every save load.** Saved bounding boxes were restored as if their graph were resident, then `reloadAreas()` fetched/rebuilt every historical area in the background. v1.1.43 separates `_savedLoadedBboxes` (history) from `_loadedBboxes` (actually resident graph) and removes automatic area replay at startup. Persisted history survives subsequent saves without falsely satisfying `_isCovered()`.

25. **Every validated Schedule V2 route was network-revalidated on save load.** Startup could therefore trigger Overpass/ORM work for every timetable before the player even moved the Livemap. Automatic network revalidation is removed from boot. Validated route snapshots remain authoritative; runtime integrity checks remain fail-closed.

26. **Schedule V2 rotation plans were rebuilt every simulation second and again for diagnostics.** Plans are now cached per rotation/date for the current simulation minute. `forceSync()` explicitly invalidates the cache after real edits, so responsiveness is preserved without idle rebuilds.

27. **Idle `À l'approche` UI polling queried the DOM every 800 ms with no approaching train.** The timer now returns before any DOM query unless a rendered service actually requires the blink state.

28. **Paris real-time acquisition recreated locale/time-zone conversion machinery repeatedly.** A single `Intl.DateTimeFormat` is cached in `SimulationEngine`; `formatToParts()` replaces repeated locale-string creation/reparse while preserving second precision and the existing fallback.

29. **The custom `file://` builder defeated source-level lazy catalogue imports.** Even after heavy catalogue modules became dynamic imports, the old builder still embedded every module in the startup bundle. The resulting startup script was about 48.6 MB and included the 63 Batch186 chunks. This was a packaging-level performance defect, not a renderer-only problem.

30. **`file://` packaging is now split into a small core and a deferred catalogue bundle.** The startup bundle is 2,853,757 bytes / 61 modules. The deferred material bundle is 45,802,563 bytes / 66 modules and is not referenced by `index.html`; it is injected only when a material-dependent page requests it. This preserves `file://` operation without forcing the Livemap to load/parse tens of megabytes of rolling-stock data at boot.

31. **Cargo definitions were coupled to the gigantic rolling-stock catalogue.** The 46 cargo types needed by normal gameplay now live in `catalog-cargo-types-base.js` (~6.8 KB), allowing Livemap startup without instantiating the base stock and identity tables.

32. **Bulk ORM save/load tests encoded the obsolete resident-graph semantics.** The test was updated to require: saved coverage is retained as history, `_loadedBboxes` is empty in a fresh process, and a second save preserves history without claiming ways are resident. `bulk-orm` now passes 20,275/20,275.

## Packaging measurements

- Previous monolithic `file://` bundle: approximately 48.6 MB.
- v1.1.43 core startup bundle: **2,853,757 bytes** (61 modules).
- v1.1.43 deferred catalogue bundle: **45,802,563 bytes** (66 modules).
- `index.html` loads only `rail-empire.file.bundle.js?v=1143` at startup.
- `rail-empire.catalog.bundle.js?v=1143` is loaded on demand through `__railEmpireEnsureCatalogBundle()`.

## Final QA executed for this audit

- Functional non-bulk/non-weather: **320/320 PASS**.
- Post-bundle critical contracts: **69/69 PASS**.
- ORM bulk bank: **20,275/20,275 PASS**.
- JavaScript/MJS syntax: **187/187 PASS**.
- The full historical ~97k bulk bank was not rerun in this final performance pass; results above are the tests actually executed on the v1.1.43 tree/bundle.

## Field-test caveat

This environment does not provide a usable interactive browser benchmark for Rail Empire; previous Chromium navigation attempts were blocked by environment policy. The code audit found and removed measurable structural startup/idle costs, but actual FPS/latency on the user's machine must still be confirmed by field test. No FPS claim is made here.
