# Rail Empire 1.1.87 — SC Future A3 LabelPerf1

Base: STATIONS_STRICT_SC_FUTURE_A3_ORDER_LONGSTREAM1
Date: 2026-08-22

## Performance station labels
- Station markers remain visible/clickable at all zoom levels.
- Schedule Creator station names are not rendered below zoom 10.5.
- From zoom 10.5 to <13.5, station-name rendering is thinned in screen space (110x24 px then 80x20 px cells).
- At zoom >=13.5, every visible station name may be rendered again.
- Canvas text shadows for Schedule Creator station labels were removed.
- Exact track selection remains unaffected and normally works at high zoom.

## QA
- Focused SC Future / dynamic graph / long-stream / RailGraph / label-performance tests: 23/23 PASS.
- JS source and FILE:// bundles: node --check PASS.
- data/railnet/stations compared against A3 source: identical.
