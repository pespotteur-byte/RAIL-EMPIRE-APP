---
name: testing-rail-empire
description: Test Rail Empire game end-to-end. Use when verifying game fixes, new features, or regressions in the browser.
---

# Testing Rail Empire

## Overview
Rail Empire is a client-side only railway simulator game. No auth/credentials needed. The game runs entirely in the browser with canvas-based map rendering.

## Devin Secrets Needed
None — the app is fully client-side with no authentication.

## Deployed App
- Live URL: https://rail-empire-onxzikcr.devinapps.com/
- Repo: github.com/pespotteur-byte/RAIL-EMPIRE-APP

## How to Start Testing

1. For local RC28 audits, serve the repository root with `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/index.html`. Do not confuse root RC28 with the separate `v2/` application; confirm any deployed URL is current before using it.
2. On login screen, type a company name and click "Nouvelle Partie" (new game) or "Reprendre la partie" (resume)
3. Open DevTools console (F12) to monitor for JS errors

### Runtime bundle and browser state
- Root `index.html` loads `js/rail-empire.file.bundle.js`; rebuilding only `js/ui.js` or `js/rolling-stock.js` does not update the tested app. Ensure the file bundle is rebuilt using the repository build flow (`scripts/build-file-bundle-v1199.cjs`), then hard-reload.
- Keep the same Chrome profile and local origin when testing Resume: a newly launched profile may legitimately have no previous localStorage.
- After importing a save **during an active game**, verify map zoom, simulated clock and canvas redraw after window resize, not just the success alert. Compare reload/Resume if those stop updating.
- Test both 800×700 desktop window and a true 390×844 mobile viewport: the desktop navigation can compress differently from the mobile hamburger layout.
- On wide screens, later navigation tabs require horizontal scrolling in the header; on mobile the hamburger exposes them.
- Use native DevTools with Errors only if the browser-console tool cannot reconnect after a Chrome restart. Distinguish external OSM/Overpass HTTP errors from uncaught application errors.

## Navigation
The game has 9 tabs accessible via the header nav:
- **Carte** — Map with canvas, stations, trains, tile layers
- **Materiel** — Rolling stock catalog
- **Rames** — Train compositions (rames)
- **Horaires** — Schedules & services
- **Lignes** — Lines
- **Depots/ITE** — Maintenance depots & freight terminals
- **Incidents** — Incidents & planned works
- **Finances** — Economy dashboard (revenue, expenses, penalties)
- **Infogare** — Station departure boards

## Key Testing Flows

### Map Tiles
- Both CartoDB (dark base) and OpenRailwayMap (colored rails) layers should load
- Rapid zoom in/out should NOT produce blue screen — fallback tiles from cached zoom levels should display
- The tile cache holds ~3000 tiles with separate loading pools for base (8 connections) and ORM (8 connections)

### Station Creation
- Click "+ Creer une gare" on map page, click map location, fill modal, click "Creer la gare"
- Warning "No railway node within 2km" is normal for locations away from rail lines

### Save/Load
- Save: click 💾 icon in header → downloads JSON file
- Load: on login screen click "Charger un fichier de sauvegarde" → select JSON
- Resume: click "Reprendre la partie" to load from localStorage
- After reload, console should show "Fast-forwarding simulation by Xs" followed by "Fast-forward complete" — this should complete instantly, not freeze

### Maintenance (Depots)
- Go to Depots/ITE tab → create a depot linked to a station
- The "Entretien preventif" section should say "(rame)" and list RAMES, not services
- Maintenance targets rames, not services/trajets

### Economy/Finances
- All values should be formatted numbers (not NaN, not undefined)
- Penalty label should say "-25%" (single reduction, not double-dip)

### Schedule Creator
- Creating a service requires: at least 2 stations, a rame, a line
- The schedule creator has a mini-map that renders at 4fps
- Day-of-week checkboxes (Lu/Ma/Me/Je/Ve/Sa/Di) control which days the train runs

## Console Errors
- Zero JS errors expected during normal gameplay
- Info-level CORS messages from tile preconnect hints (shown as blue "Issues" counter) are normal and NOT errors
- Filter console to "Errors" level to verify — should show nothing

## Common Gotchas
- The game clock runs in real-time (no speed controls), so testing time-dependent features (delays, schedule ticks) requires waiting
- The 75 "Issues" in console are info-level tile CORS hints, not errors — filter to Errors level
- Station creation on areas without nearby railway nodes shows a warning but still works
- Some fixes (memory leaks, O(n²) caps) require complex game states with many trains to fully test
- When testing after a reload, the fast-forward should complete in under a second — if it freezes, the C3 fix may have regressed
