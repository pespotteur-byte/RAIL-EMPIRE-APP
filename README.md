# Rail Empire

A real-time railway simulation game running in the browser, powered by OpenRailwayMap data and realistic train physics.

**Live:** [https://rail-empire-onxzikcr.devinapps.com](https://rail-empire-onxzikcr.devinapps.com)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How to Play](#how-to-play)
- [Technical Details](#technical-details)
- [Save System](#save-system)
- [Browser Compatibility](#browser-compatibility)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Rail Empire lets you build and manage a railway company on a real map of France. Trains follow actual railway tracks from OpenRailwayMap, obey infrastructure speed limits, and operate on schedules you define — all synchronized to real Paris time.

The game is a single-page web application (HTML/CSS/JavaScript) with no backend or build step required. Just open `index.html` in a browser.

---

## Features

### Map & Infrastructure
- **Real railway data** — routes fetched from OpenRailwayMap via the Overpass API
- **Station snapping** — new stations snap to the nearest ORM railway node (within 2 km)
- **Tile-based map** — CartoDB base tiles with OpenRailwayMap railway overlay, smooth zoom and pan
- **Lines system** — create named lines with color codes; shared track segments are reused automatically
- **Multi-platform stations** — configure 1–30 platforms per station with custom names (e.g., `1, 2, 3A, 3B`)

### Train Simulation
- **Strict route following** — trains move segment-by-segment along ORM routes using an index + progress interpolation system
- **Haversine distance** — geodesic calculations for Earth-surface precision
- **Speed enforcement** — `effectiveSpeed = min(trainMaxSpeed, infrastructureMaxSpeed)`
- **Progressive braking** — `brakingDistance = speed² / (2 × deceleration)`, no artificial speed clamps
- **Mass-based physics** — acceleration and braking derived from locomotive power (kW) and total train mass (tonnes)
- **Block signaling (cantonnement)** — speed-dependent block lengths (0.6 km at ≤80 km/h, up to 2.5 km at >200 km/h) with reserve/occupy/release lifecycle
- **100 ms update ticks** — smooth movement with delta-time integration

### Scheduling
- **Schedule creator** — build timetables by clicking stations on a full tile map
- **Stop types** — _Arrêt_ (stop), _Passage_ (through without stopping), _Waypoint_ (routing only, invisible in timetable)
- **Round trips** — multi-departure support with configurable terminus wait time and "Auto 24h" button
- **Platform assignment** — choose specific platforms per stop or let the game assign automatically
- **Editable schedules** — modify timetables after creation
- **Stop duration** — set dwell time in minutes for intermediate stations

### Incidents & Construction Works
- **Player-created incidents** — no pre-built types; define name, epicenter, impact radius (1–50 km), duration, and effect (interruption or slowdown with speed limit)
- **Construction works** — multi-day date ranges with daily recurring hour windows (e.g., 22:00–05:00)
- **Dual alert banners** — bordeaux (#7B1E1E) for interruptions, banana yellow (#FFE135) for slowdowns
- **Real impact** — interruptions stop trains (speed = 0); slowdowns cap speed to the defined limit

### Rolling Stock
- **Custom fleet** — add locomotives and wagons with mass (tonnes) and power (kW) fields
- **Rames (consists)** — compose trains from available rolling stock
- **Physics integration** — total mass and power determine acceleration and braking performance

### Economy
- **Ticket pricing** — set fare per km
- **Revenue tracking** — income calculated per completed service
- **Balance display** — running total in the header

### Persistence
- **Auto-save** — every 10 seconds to `localStorage`
- **Mid-journey resume** — trains resume from their saved position and speed on reload, no time catchup
- **Export / import** — download save as `.json` file, load from file at login or in-game

---

## Getting Started

Rail Empire is a static frontend app — no build tools, no `npm install`, no server required.

### Option 1: Play Online

Open the deployed version:  
[https://rail-empire-onxzikcr.devinapps.com](https://rail-empire-onxzikcr.devinapps.com)

### Option 2: Run Locally

```bash
# Clone the repository
git clone https://github.com/your-org/rail-empire.git
cd rail-empire

# Serve with any static file server
python3 -m http.server 8000
# or
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

> **Note:** A local HTTP server is required because the app uses ES modules (`import`/`export`), which browsers block when opening files directly via `file://`.

---

## Project Structure

```
rail-empire/
├── index.html              # Single-page app shell (all HTML)
├── style.css               # All styles
├── README.md
└── js/
    ├── main.js             # Game entry point, init, save/load, game loop
    ├── engine.js           # Simulation clock (Paris time), tick scheduling
    ├── ui.js               # All UI rendering, event handling, modals
    ├── renderer.js         # Canvas rendering (map, trains, tracks)
    ├── map.js              # TileMap class (tile loading, zoom, pan)
    ├── orm.js              # OpenRailwayMap client (Overpass API, routing)
    ├── simulation.js       # Haversine distance, route analysis, canton manager
    ├── schedule-creator.js # ActiveService (train movement, scheduling, physics)
    ├── schedule.js         # Legacy schedule manager
    ├── world.js            # World state (stations, tracks)
    ├── line.js             # Line manager, platform manager
    ├── rolling-stock.js    # Locomotive/wagon definitions
    ├── rame.js             # Train consist composition
    ├── incidents.js        # Player-created incidents (slowdown/interruption)
    ├── works.js            # Construction works (multi-day, hourly windows)
    ├── economy.js          # Revenue, balance, ticket pricing
    ├── freight.js          # Freight contract management
    ├── depot.js            # Depot / ITE management
    ├── account.js          # Company account (name)
    └── storage.js          # localStorage persistence layer
```

---

## How to Play

1. **Start** — Enter a company name and click "Nouvelle Partie"
2. **Create stations** — Click "+ Créer une gare" and place stations on the map; they snap to real railway nodes
3. **Add rolling stock** — Go to "Matériel" and define locomotives/wagons with mass and power
4. **Compose trains** — In "Rames", assemble consists from your rolling stock
5. **Create lines** — In "Lignes", define railway lines connecting your stations
6. **Build timetables** — In "Horaires", click "+ Créer un trajet", select stations on the map, set departure time and stop durations
7. **Watch trains run** — Switch to "Carte" and watch your trains follow real tracks in real time
8. **Manage incidents** — In "Incidents", create disruptions or construction works to test your network's resilience

---

## Technical Details

### Real-Time Simulation
The game clock is synchronized to **Paris time** (`Europe/Paris` timezone). Schedule departures and arrivals correspond to actual wall-clock time. The simulation runs two concurrent loops:

- **Minute tick** — handles schedule events (departures, arrivals, state transitions)
- **Movement tick** (100 ms) — handles smooth train movement, physics, and canton management

### Routing
Routes are fetched from the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) querying `railway=rail` ways. The ORM client builds a graph from returned ways, finds shortest paths via Dijkstra, and caches results. Routes include per-node `maxspeed` tags from infrastructure data.

### Physics Model
| Parameter | Formula |
|-----------|---------|
| Distance | Haversine: `2R × atan2(√a, √(1−a))` |
| Acceleration | `F/m × 3.6` where `F = P/v` at reference speed |
| Braking distance | `v² / (2 × deceleration)` |
| Effective speed | `min(trainMax, segmentMax, incidentLimit)` |
| Block length | 0.6 km (≤80 km/h) → 2.5 km (>200 km/h) |

### Dependencies
**None.** The app is vanilla HTML/CSS/JavaScript with ES modules. External services used at runtime:

| Service | Purpose |
|---------|---------|
| [Overpass API](https://overpass-api.de) | Railway route data |
| [CartoDB Tiles](https://carto.com/basemaps) | Base map tiles |
| [OpenRailwayMap Tiles](https://www.openrailwaymap.org) | Railway overlay tiles |

---

## Save System

| Feature | Details |
|---------|---------|
| Auto-save | Every 10 seconds to `localStorage` |
| Mid-journey resume | Trains resume from saved position and speed on reload |
| File export | JSON download with company name and date |
| File import | Load `.json` save from login screen or in-game |
| Backward compatibility | New fields use fallback defaults when loading older saves |

---

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome / Edge | Fully supported |
| Firefox | Fully supported |
| Opera | Fully supported |
| Safari | Should work (ES modules required) |

Requires a browser with ES module support (all modern browsers since ~2018).

---

## Contributing

Contributions are welcome! If you'd like to add features or fix bugs:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in multiple browsers
5. Open a pull request

Since there's no build step, testing is as simple as serving the files locally and opening them in a browser.

---

## License

This project is provided as-is. See the repository for license details.

---

_Originally written and maintained by contributors and [Devin](https://app.devin.ai), with updates from the core team._
