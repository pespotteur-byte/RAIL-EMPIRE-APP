# Rail Empire v1.1.87 — SC Future A4.1 MEMORY-SPEED-DUPNAME1

Base: SC Future A4 MEMORY-SPEED1, itself based on Station Strict A3 LabelPerf1.
Stations: 31,009; strict station pack unchanged byte-for-byte (19/19 files identical).

## Retained A4 fixes
- Route geometry preserves raw infrastructure Vmax; changing sillon Vmax retimes without rerouting.
- Long dynamic corridor fetches use transient working data to reduce retained heap.
- Max 2 long-distance network tiles concurrently; no duplicate hedged payload bodies.
- Compact detailed graph/state representation.
- Transient merged corridor released after each resolved leg.
- Long real-detour rescue remains a single widening pass, without synthetic straight-line railway fallback.
- Exact 5 px track hit-test, click-order VIA/stations, LabelPerf zoom gating retained.

## A4.1 duplication rule
- When schedule duplication changes train number (+2 same direction, linked return scheme +1/+2), an exact occurrence of the original train number inside the train name is changed to the generated number too.
- Example: number 17801 / name `TER 17801 Dijon → Lyon` duplicates to 17803 / `TER 17803 Dijon → Lyon`.
- Descriptive names without the source number remain unchanged.
- Explicit manual duplicate-name override always wins.

## QA
- Dedicated A4.1 duplication + A4 memory/speed + frequency regression: 11/11 PASS.
- schedule-v2-model.js suite: 21/21 PASS.
- All *.test.mjs: 316/319 PASS; the same 3 legacy tests remain for removed pre-SC-Future network/error contracts.
- Modified/bundled JS syntax: PASS.
- Station files: 19/19 byte-identical to Station Strict FINAL.
