RAIL EMPIRE — BATCH186 STRICT100 — FULL CATALOG V1 + FREIGHTPASS2
================================================================
Base: Batch186 STRICT100 standalone + FreightPass1 + FreightPass2.

CATALOGUE
- Legacy catalog kept: 16,056 entries (save/catalog IDs preserved).
- New Batch186 entries added: 20,134.
- Pack RE retained: 117 entries.
- Runtime catalog total: 36,307 entries.
- Unique Batch186 in-scope MLG rolling-stock drawings represented: 34,623 / 34,623 = 100%.
- Existing legacy category corrections from unambiguous Batch186 refined category: 6,182.
- New entry categories: 7,432 automotrices, 6,421 voitures, 4,509 locomotives, 1,772 wagons.
- Every new FullCatalog entry uses its original MLG GIF from img/catalog/<archive_path>.

TECHNICAL-DATA POLICY
- No missing real-world technical value is silently asserted as certified fact.
- 2,557 new entries inherit usable game characteristics from an existing catalog entry with the same RE-EU identity.
- 57 new entries use Batch186 documented technical fields directly.
- 12,418 new entries mix family/documented values with explicit gameplay fallbacks for missing fields.
- 5,102 new entries use explicit GAMEPLAY_PROVISIONAL simulation values because exact technical specs are still absent.
- The UI labels provisional simulation performance with "Perf. jeu*" and explains that it is not a certified real-world spec.

FREIGHT
- FreightPass1 + FreightPass2 retained.
- New same-family wagon variants inherit validated cargo mappings where available.
- 1,600 / 1,772 newly added wagons inherit at least one enabled cargo type.
- Cargo catalog after normalization: 204 unique cargo types.
- Legacy Pack RE French cargo labels normalized to canonical internal IDs.
- Bad/unknown cargo references after runtime assembly: 0.

GAME PURCHASE PRICE BALANCE V2
- All built-in catalog items receive a positive gameplay purchase tariff.
- These tariffs are game-balance values, NOT asserted historical purchase prices.
- No catalog item exceeds 6,000,000 EUR.
- High-speed rolling stock is component-priced so a normal TGV/ICE-style formation remains on the requested <= 6 M EUR scale.
- Example tested TGV Atlantique 8-element selection: 4.24 M EUR; adding typical remaining trailers remains below 6 M EUR.
- Price ranges in this build:
  locomotives: 0.30–5.00 M EUR (median 1.21 M)
  automotrices: 0.42–2.49 M EUR (median 1.22 M)
  voitures: 0.14–0.70 M EUR (median 0.27 M)
  wagons: 0.05–0.70 M EUR (median 0.08 M)

QA
- Runtime catalog: 36,307 / 36,307 unique IDs.
- MLG rolling-stock coverage: 34,623 / 34,623 unique MLG IDs.
- New FullCatalog images missing: 0 / 20,134.
- Numeric smoke test: 36,307 RollingStockItem objects, 0 invalid numeric fields, 0 price > 6 M EUR.
- Relevant tests: Batch186 Freight Pass1, Pass2, rolling-stock and train-physics = 24/24 PASS.
- Broader split suite: 19/20 test files completed, 97,117 PASS / 0 FAIL. bulk-weather.test.js exceeds the execution/reporting window; it is unrelated to catalog code.

ASSET NOTE
- All 36,824 original MLG GIFs remain bundled in img/catalog.
- As in the previous reconstructed standalone build, a limited number of old generated composite PNGs and Pack RE image assets were not present in the recovered code-only source; missing legacy images are hidden gracefully. This does not reduce Batch186 MLG rolling-stock coverage.
