# Livraison actuelle — RC13 : stockage compact

**Lire `LIRE_AVANT_RC13.md` avant la migration.** Exportez la partie, fermez RC12, extrayez RC13 dans un nouveau dossier et conservez la même origine HTTP locale. Arrêtez l’ancien serveur pour ne pas continuer à servir RC12.

**Stockage → Optimiser sans supprimer** applique la nouvelle compression à la partie courante et parcourt les anciens caches OSM/ORM. Gzip binaire, déduplication exacte, remplacement après validation ; aucune purge des géométries pour gonfler le gain. Le facteur 100 n’est pas garanti sur toute partie ou sur les fichiers physiques du navigateur.

Rapport : `RE_REPARATION_RC13_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC13.md`. Mesures : `QA/RE_REPAIR_RC13/STORAGE_BENCHMARK.json`. Qualification finale : `QA/RE_REPAIR_RC13/SUMMARY.json`.

Le registre historique reste à **83/87 (95,4 %)**. La 403 réelle n’est pas déclarée levée. Sources TypeScript, sorties jouables et ressources RC12 conservées ; les nouveaux formats binaires nécessitent RC13 pour leur lecture, mais l’export portable reste compatible avec les versions antérieures.

---

## Historique documentaire ci-dessous — la livraison courante est RC13

# Livraison actuelle — RC12

**Lire `LIRE_AVANT_RC12.md`.** Exportez votre sauvegarde, conservez RC11 et extrayez RC12 dans un nouveau dossier. Lancez `LANCER_RE.cmd` et conservez la même adresse/port HTTP local pour retrouver le stockage du navigateur.

**83 dossiers historiques clos sur 87 (95,4 %), inchangé.** Cette passe corrige des détections de face-à-face, la reprise et la restauration des missions de secours, et ajoute un export de diagnostic des mouvements. Elle ne termine pas le remorquage, l'autorité complète des secours, le replay d'absence ou le blocage utilisateur à basse vitesse.

Rapport : `RE_REPARATION_RC12_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC12.md`. Preuves et commandes : `QA/RE_REPAIR_RC12/README.md`. Sources TypeScript et bundles déjà compilés inclus. Les données et ressources RC11 sont conservées.

Les protections OSM/ORM héritées restent actives. Un refus réel du fournisseur n'est pas déclaré levé. Dans la LiveMap, **Runtime V2 → Exporter le diagnostic des mouvements** produit un JSON local, sans transmission réseau. Le lanceur Windows/Opera et votre sauvegarde personnelle ne sont pas certifiés par les essais Chromium isolés.

---

## Documentation historique conservée (ne pas confondre avec la livraison actuelle)

# Livraison actuelle — RC10

**Lire `LIRE_AVANT_RC10.md`.** Exportez votre sauvegarde, conservez RC9 et extrayez RC10 dans un nouveau dossier. Gardez le lancement HTTP local par `LANCER_RE.cmd` et la même adresse/port pour retrouver le stockage. Les sources TypeScript et les bundles jouables sont fournis.

**79 dossiers historiques clos sur 87 (90,8 %).** Les quatre clôtures RC10 portent sur le contrôleur de mouvement commun, la connectivité connue des offres industrielles, les effets des améliorations de gare et les conséquences des consommables/propreté. Ce taux ne représente pas tous les bugs possibles. Rapport : `RE_REPARATION_RC10_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC10.md`. Preuves : `QA/RE_REPAIR_RC10/`.

Les protections OSM/ORM de RC9 sont conservées. Une 403 réelle n'est pas déclarée levée. Le lancement Windows/Opera reste à vérifier sur votre machine. La panne sèche est désormais effective pour les réservoirs déclarés : contrôlez les consommables après import.

---


> **Livraison historique : RC8 — `1199repair8`.** Voir [les instructions](LIRE_AVANT_RC8.md), [le rapport](RE_REPARATION_RC8_RAPPORT.md) et [le registre](RE_REGISTRE_CORRECTIONS_RC8.md). Jeu complet précompilé ; preuves et limites dans `QA/RE_REPAIR_RC8/`. Les bilans ci-dessous sont historiques.

> **Livraison historique : RC6R — `1199repair601`.** Voir [les instructions](LIRE_AVANT_RC6R.md), [le rapport](RE_REPARATION_RC6R_RAPPORT.md) et [le registre](RE_REGISTRE_CORRECTIONS_RC6R.md). Les bilans antérieurs conservés dans le projet sont historiques.

> **Livraison historique : RC5 gameplay / TypeScript / performances.** Voir `LIRE_AVANT_RC5.md`, `RE_REPARATION_RC5_RAPPORT.md` et `RE_REGISTRE_CORRECTIONS_RC5.md`. Les sections suivantes sont historiques.

# Livraison Gameplay Repair RC2 — 11 septembre 2026

**Version jouable précompilée : ouvrir `index.html`.** Cache : `1199repair2`.

Registre de correction : **51 dossiers clos sur 76 (67,1 %)**. Il s’agit du taux de clôture des anomalies suivies, pas d’une garantie d’absence de bugs. Rapport : `QA/RE_REPAIR_RC2/RAPPORT_RC2.md` ; détail : `QA/RE_REPAIR_RC2/ANOMALY_REGISTER.md`.

Sauvegarder la partie précédente, conserver RC1 et extraire ce jeu dans un nouveau dossier. **Horaires → Correspondances** ouvre la nouvelle fenêtre de configuration. Pour le contrôle du contenu livré : `npm run verify:repair` (Node requis uniquement pour les contrôles de développement).

---

## Historique de la documentation fournie

# Rail Empire — Gameplay Repair RC1

**11 septembre 2026. Build de réparation consolidé, à tester sur une copie de sauvegarde.**

Ouvrir `index.html` dans le dossier extrait. Le JavaScript et les deux bundles de démarrage/catalogue sont déjà compilés : aucune installation Node nécessaire pour jouer. Ne pas mélanger les fichiers avec ceux d’un autre checkpoint.

Lire **`RE_REPARATION_RC1_RAPPORT.md`** : corrections, résultats, réserves et procédure d’essai. Les preuves actuelles sont dans `QA/RE_REPAIR_RC1/`. Les autres rapports QA, sceaux et notes Alpha ci-dessous sont conservés comme **historique**, pas comme certification de ce build.

Pour développer : `npm run build:repair`. Pour les nouveaux tests et l’audit d’origine : `npm run test:repair`. Pour l’intégrité du paquet : `npm run verify:repair` (avant toute modification/recompilation).

---

## Documentation historique du projet

# Rail Empire

A real-time railway simulation game running in the browser, powered by OpenRailwayMap data and realistic train physics.

> **Saison 3 / TypeScript Alpha 27** — the gradual TypeScript migration has started. The browser runtime remains precompiled JavaScript and still works by opening `index.html`; development sources for migrated modules live in `src/ts/`. See `docs/S3_TYPESCRIPT_MIGRATION.md`.

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

The game remains a single-page browser application with no backend. End users can still open `index.html` directly; development now gradually compiles TypeScript sources to the existing JavaScript runtime files.

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
- **Fast-forward on reload** — elapsed time since save is simulated (up to 24 h) so trains resume where they should be
- **Export / import** — download save as `.json` file, load from file at login or in-game

---

## Getting Started

Rail Empire remains a static browser game for players: the ZIP already contains the compiled JavaScript runtime. TypeScript is a **development dependency only** for contributors working on Saison 3; players do not need Node.js or npm.

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
| Fast-forward | On reload, simulates elapsed time (max 24 h) |
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


## HOTFIX68 — LiveMap voix neuronales multilingues

Les phrases fixes des annonces LiveMap restent en français, mais **chaque nom de gare demande la langue locale de la gare**. La voix française Piper préférée est `fr_FR-siwis-low`; les gares allemandes utilisent une session allemande distincte, les italiennes une session italienne, etc. Les régions multilingues (Suisse, Belgique, Espagne et Pays de Galles) sont résolues selon la position de la gare. Les modèles Piper sont téléchargés à la première rencontre de leur langue puis mis en cache lorsque le navigateur le permet : ils ne sont pas embarqués dans le ZIP. HOTFIX75 ne laisse cependant plus Piper bloquer la phrase : si le modèle/réseau/runtime n'est pas disponible, RE cherche une voix système de la même langue puis, en dernier recours, envoie le bon tag BCP-47 (`fr-FR`, `de-DE`, etc.) au moteur vocal du navigateur sans lui affecter explicitement une voix anglaise. Voir `audio/siv/PIPER_MULTILINGUAL_VOICES_ATTRIBUTION.txt` et `audio/siv/PIPER_SIWIS_ATTRIBUTION.txt`.

## Saison 3 — TypeScript Alpha 3

Migration cumulative en `strict: true` : `rng`, `operational-time`, `train-physics`, `movement-authority`, `rail-section-geometry`, `signaling`, `schedule-logic` et `weather-thresholds`.
Le navigateur continue de charger les fichiers générés sous `js/`; Node/TypeScript ne sont requis que pour développer/recompiler.

## Saison 3 — TypeScript Alpha 4

Migration cumulative : ajout de `rolling-stock`, `catalog-price-balance`, `catalog-cargo-normalization` et `icons` en TypeScript strict. Le catalogue reste fourni en données JS/bundles, mais son modèle matériel et ses règles de normalisation/prix sont désormais typés.


## Saison 3 — TypeScript Alpha 5

Le portage TypeScript atteint désormais le cœur Schedule V2. Cette passe migre `schedule-v2-model`, `schedule-v2-timing`, `schedule-v2-validation` et `schedule-v2-routing` sous `strict: true`, tout en recompilant vers les mêmes fichiers `js/*.js` pour préserver le lancement direct `file://`.

Validation de parité : 84 tests Schedule V2 ciblés verts et 5 000 comparaisons différentielles Alpha 4 ↔ Alpha 5 sans divergence sur horloges, physique des temps de parcours et snapshots de routes.

## Saison 3 — TypeScript Alpha 6

Migration cumulative : ajout de `rame`, `rotation-v2-model` et `schedule-v2-runtime`. Le cœur des formations physiques, roulements, affectations et reconstruction runtime des horaires V2 est désormais compilé depuis TypeScript.

Validation : 114 tests ciblés roulements/runtime/rames verts et 6 000 comparaisons différentielles Alpha 5 ↔ Alpha 6 sans divergence fonctionnelle.

## Saison 3 — TypeScript Alpha 7

Migration cumulative : ajout de `engine`, `simulation` et `storage`. La boucle temporelle, le cantonnement et la persistance navigateur sont désormais compilés depuis TypeScript.

Validation : 11 943 tests ciblés verts et 5 000 comparaisons différentielles Alpha 6 ↔ Alpha 7 sans divergence sur distances, profils de route et cantons.


## Saison 3 — TypeScript Alpha 8

Migration cumulative : ajout de `bank`, `economy`, `freight`, `junctions`, `shunting`, `weather`, `weather-map-view` et `works`. Les systèmes économiques, fret, météo mondiale, travaux et manœuvres sont désormais compilés depuis TypeScript en `strict: true`.

Validation : 5 537 tests ciblés Alpha 8 verts. Suite générale : 102 833 / 102 834, avec uniquement le test historique `REG-01/02/04` déjà rouge avant le portage.


## Saison 3 — TypeScript Alpha 9

Migration cumulative : ajout de `line`, `connections`, `seasonal`, `unions`, `station-upgrades` et `schedule-v2-revalidation`. Les lignes/quais, correspondances, horaires saisonniers, négociations sociales, améliorations de gare et la revalidation transactionnelle Schedule V2 sont désormais compilés depuis TypeScript strict.

Validation : 104 tests exploitation/fuzz ciblés verts. Les frontières historiques les plus dynamiques restent volontairement typées larges avant le resserrage final.


## Saison 3 — TypeScript Alpha 10

Migration cumulative : ajout de `world`, `global-stations`, `map`, `terrain3d` et `voie-points`. Le monde ferroviaire, le référentiel de gares, le moteur cartographique et les géométries de voies/terrain sont désormais compilés depuis TypeScript strict.

Validation : typecheck strict vert et 4 033 / 4 036 tests monde/carte/gares sur la batterie élargie. Les trois échecs restants sont des assertions de chaînes HOTFIX9/HOTFIX20 déjà obsolètes dans Alpha 9 ; aucun nouvel échec fonctionnel n'est introduit.


## Saison 3 — TypeScript Alpha 11

Migration cumulative : ajout de `account`, `admin-sync`, `a12-model`, `sillon`, `operational-icons`, `tutorial` et `dashboard`. Les services d'administration, anciens sillons, aide et tableau de bord sont désormais compilés depuis TypeScript strict.

Validation : typecheck strict vert, 7 / 7 tests ciblés, suite générale 102 833 / 102 834 avec uniquement le défaut historique `REG-01/02/04`. Aucun `@ts-nocheck` n'est utilisé.


## Saison 3 — TypeScript Alpha 12

Migration cumulative : ajout de `world-rail-cache`, `works-v2-editor`, `infrastructure-v2-editor`, `depot-ite-point-editor` et `infogare-bitmap-font`. Le cache ferroviaire mondial et les éditeurs Travaux / Infrastructure / Dépôts-ITE passent désormais par la chaîne TypeScript tout en conservant les imports navigateur historiques et le lancement direct `file://`.

Validation : `strict: true` vert, batterie Alpha 12 ciblée verte. Le test historique `Caténaire coupée blocks electric-only stock but not diesel` reste rouge à l'identique sur Alpha 11 et n'est pas une régression du portage. Aucun `@ts-nocheck` n'est utilisé.


## Saison 3 — TypeScript Alpha 13

Migration cumulative : ajout de `schedule`, `ite-modules`, `cargo-types` et `graph-marche`. Le gestionnaire ITE, la taxonomie fret dynamique et le Graphique de Marche (zoom sémantique 30→10→5→1 min, pan souris, labels persistants) sont désormais compilés depuis TypeScript strict.

Validation : typecheck strict vert et 35 / 35 tests ciblés Alpha 13 verts. Les anciens tests source-text du graphique conservent des marqueurs de compatibilité sans modifier le comportement runtime.

## Saison 3 — TypeScript Alpha 14

Migration métier : `depot`, `incidents` et `staff` deviennent des sources TypeScript strictes. Les catalogues dynamiques de personnel, équipements, opérations et ressources sont explicitement bornés aux frontières historiques sans modifier le runtime émis.

Validation : `strict: true`, aucun `@ts-nocheck`, tests métier dépôts/personnel/incidents + suite générale de non-régression.


## Saison 3 — TypeScript Alpha 15

Migration cumulative des trois contrôleurs `rotation-v2-editor`, `livemap-train-announcer` et `schedule-v2-editor` en TypeScript strict. Une petite couche `legacy-ui-compat.ts` formalise les hypothèses DOM historiques pendant la migration sans ajouter de comportement runtime. Les anciens contrats QA qui inspectent textuellement la forme du JavaScript compilé sont conservés via des marqueurs de compatibilité sans modifier la logique exécutée.

Le joueur continue de lancer `index.html` directement ; TypeScript reste uniquement un outil de développement/build.


## Saison 3 — TypeScript Alpha 16

Migration cumulative : ajout de `renderer` et `main`. Le rendu principal, la boucle d'affichage, le bootstrap du jeu, la reconstruction d'état et les branchements des managers passent désormais par TypeScript strict. Les quelques modules non encore migrés restent des frontières JS explicites au niveau de leurs imports ; aucun fichier TS n'utilise `@ts-nocheck`.

Validation : `strict: true`, 54 / 54 tests ciblés démarrage/LiveMap/GPS après compatibilité source-text, puis suite générale 102 833 / 102 834 avec uniquement le défaut historique `REG-01/02/04` déjà présent avant le portage. Bundle `file://` : `1199ts16`.


## Saison 3 — TypeScript Alpha 17

- `industrial-clients.js` et `schedule-creator.js` ont désormais leur source officielle dans `src/ts/`.
- TypeScript reste en `strict: true`  sans `@ts-nocheck`.
- Frontières historiques et formats compacts de sauvegarde ont été explicités sans changement de gameplay volontaire.
- Tests ciblés Alpha 17 : **8573 / 8573**.
- Bundle `file://` : **1199ts17**.
- État de migration : **68 modules TypeScript / 45 029 lignes TS**.


## Saison 3 — TypeScript Alpha 18

Migration cumulative : ajout de `orm` et `railgraph-pack`. Le routage OpenRailwayMap/Overpass, les caches de topologie, les corridors Schedule Creator et le pack ferroviaire local RailGraph sont désormais compilés depuis TypeScript. Une passerelle `legacy-runtime-contracts.ts` formalise temporairement les métadonnées historiques attachées aux tableaux/erreurs ; elle sera resserrée lors du freeze final.

Validation : `strict: true`, aucun `@ts-nocheck`, **20 339 / 20 339** tests ORM/RailGraph/SC ciblés verts. Bundle `file://` : **1199ts18**. État : 71 fichiers source TypeScript (69 modules applicatifs + 2 passerelles de compatibilité), environ 50 900 lignes TS.

### Saison 3 — TypeScript Alpha 19

Migration du dernier grand module applicatif : `ui.js` est désormais généré depuis `src/ts/ui.ts`. Le code applicatif principal de Rail Empire dispose maintenant d'une source TypeScript ; les `.js` sans équivalent `.ts` restants sont des bundles générés ou des packs de données catalogue.

Validation : `strict: true`, aucun `@ts-nocheck`, batterie UI/LiveMap/Infogare/Rames/Roulements/Travaux de 217 tests ciblés verte. Les anciens tests qui inspectent littéralement la mise en forme JavaScript conservent des marqueurs QA runtime-neutres. Bundle `file://` : **1199ts19**.

### Saison 3 — TypeScript Alpha 20 — Port freeze

Le portage applicatif est gelé : chaque module JavaScript applicatif principal possède désormais une source TypeScript sous `src/ts/`. Les JavaScript sans source TypeScript restants sont explicitement limités aux bundles générés et aux packs de données catalogue.

Alpha 20 ajoute un audit automatique (`npm run audit:s3-final`) qui échoue si un nouveau module applicatif JS apparaît sans source TS ou si `@ts-nocheck` est introduit. Les suppressions TypeScript restantes concernent uniquement des imports navigateur cache-bustés et des modules de données générés ; elles sont comptabilisées dans `QA/S3_TYPESCRIPT_ALPHA20_FINAL_AUDIT.json`. Les deux bridges de compatibilité legacy sont conservés volontairement afin de ne pas modifier le runtime DOM/metadata pendant le freeze fonctionnel.

Bundle `file://` : **1199ts20**.

## Saison 3 — TypeScript Alpha 21 — Contrats sans `@ts-ignore`

Durcissement post-portage : les derniers `@ts-ignore` ont été supprimés et remplacés par des contrats de déclaration explicites pour les gros loaders/catalogues générés. Aucun changement gameplay volontaire.

Validation : `strict: true`, **0 `@ts-ignore`**, **0 `@ts-nocheck`**, aucun module JavaScript applicatif orphelin. Les tests hérités Alpha 20 et les contrats bundle `file://` restent verts.

## Saison 3 — TypeScript Alpha 22 — Premiers domaines réellement resserrés

Le typage est renforcé sur les frontières les plus sensibles : horloge/simulation, banque, matériel roulant, horaires saisonniers, timing physique Schedule V2, administration et persistance navigateur. Cette passe réduit les `any` explicites sans changer les règles de jeu.

Validation : **7 599 `any` explicites** après la passe, cache navigateur **`1199ts22`**, typecheck strict et régressions ciblées verts.

## Saison 3 — TypeScript Alpha 23 — Gate anti-régression et hardening Schedule/RH

Alpha 23 privilégie la qualité de release plutôt que le volume de migration. `schedule-v2-routing` et `schedule-v2-validation` sont resserrés au niveau des types de domaine ; leur JavaScript compilé reste inchangé par rapport à l'Alpha 22. La passe corrige également deux dettes runtime révélées par la nouvelle QA : l'approche gare pouvait immobiliser un train avant le quai tout en le laissant `moving`, et la couverture RH/régulation pouvait être brièvement incohérente immédiatement après une affectation avant le premier tick personnel.

La gate S3 exécute chaque fichier de test dans un processus Node isolé, sépare les tests fonctionnels des tests timing/performance, impose des timeouts durs et supporte le shardage déterministe. Les anciens snapshots 3D volontairement remplacés par HOTFIX29 sont conservés comme archives avec un test d'invariants 3D actuel obligatoire.

Validation finale sur le build réellement expédié : **173/173 fichiers fonctionnels + 32/32 fichiers lourds/performance = 205/205 fichiers actifs verts** ; **11 snapshots historiques 3D archivés avec remplacement explicite**. État TypeScript : **72 fichiers / 64 389 lignes**, **0 `@ts-ignore`**, **0 `@ts-nocheck`**, **7 529 `any` explicites**, **28 `@ts-expect-error` documentés** pour les frontières navigateur cache-bustées. Bundle `file://` : **`1199ts23`**.


## Saison 3 — TypeScript Alpha 24 — Modèle de roulements sans `any`

Alpha 24 durcit intégralement `rotation-v2-model.ts`, le modèle physique qui relie véhicules, coupons, formations, occurrences, opérations d’attelage/dételage, changements de locomotive, split/merge, calendriers, conflits matériels et sauvegarde. Le fichier passe de **423 `any` explicites à 0**. Les contrats d’entrée legacy sont désormais structurés et les états internes des opérations, timelines, calendriers et intervalles matériels sont typés.

Cette alpha est volontairement **source-only côté runtime** : le JavaScript applicatif généré est **octet pour octet identique à l’Alpha 23 officielle**. Le bundle navigateur et le cache restent donc intentionnellement `1199ts23` ; forcer un nouveau cache n’apporterait aucun nouveau code au joueur. Cette règle évite une invalidation inutile et constitue une preuve supplémentaire qu’aucune logique gameplay n’a changé pendant le durcissement.

Validation finale sur le build recompilé : **173/173 fichiers fonctionnels + 32/32 fichiers lourds/performance = 205/205 fichiers actifs verts**, en complément des **113/113 tests ciblés roulements/runtime**. État TypeScript : **72 fichiers / 64 662 lignes**, **0 `@ts-ignore`**, **0 `@ts-nocheck`**, **7 116 `any` explicites**, **28 `@ts-expect-error` documentés**. Preuve de parité : **147/147 fichiers runtime `js/`**, `index.html`, `rail-empire.file.bundle.js` et `rail-empire.catalog.bundle.js` sont **octet pour octet identiques à l’Alpha 23 officielle**.

## Saison 3 — TypeScript Alpha 25 — Modèle Schedule V2 durci

Alpha 25 durcit le modèle de domaine `schedule-v2-model.ts` qui porte calendriers d’exploitation, liaisons voie/gare, contraintes de route, segments, legs, profils de performance, versions d’horaires, groupes aller-retour et persistance Schedule V2. Les anciennes index-signatures ouvertes des classes sont supprimées et remplacées par des propriétés de domaine explicites.

Le fichier passe de **125 `any` explicites à 0 selon l’audit syntaxique**, avec une unique frontière legacy volontaire (`Record<string, any>`) pour les données brutes de sauvegarde / catalogue avant normalisation. La dette globale descend de **7 116 à 6 991 `any` explicites**. Les frontières Schedule ↔ Routing ↔ Rotation ont été réalignées sans ajouter de cast runtime.

Cette alpha reste volontairement **source-only côté runtime** : après compilation, `schedule-v2-model.js`, `schedule-v2-routing.js` et `rotation-v2-model.js` sont octet pour octet identiques à l’Alpha 24. Le cache navigateur reste donc `1199ts23`. Validation finale : **157/157 tests ciblés Schedule/Rotation**, puis **173/173 fichiers fonctionnels + 32/32 fichiers lourds/performance = 205/205 fichiers actifs verts**. Preuve de parité : **147/147 fichiers runtime**, `index.html` et les deux bundles sont octet pour octet identiques à l’Alpha 24 officielle.



## Saison 3 — TypeScript Alpha 26 — RailGraph local durci

Alpha 26 durcit `railgraph-pack.ts`, le pack ferroviaire local utilisé par le Schedule Creator pour charger les shards, décoder RailGraph Binary V2, gérer le budget mémoire, les index géographiques et le chargement de corridors exacts sans recours réseau.

- `railgraph-pack.ts` : **0 `any` explicite** dans le code TypeScript.
- Dette globale auditée : **6 896 `any`** (contre 6 991 en Alpha 25).
- Le JavaScript généré de `railgraph-pack.js` reste **octet pour octet identique à Alpha 25** après compilation.
- Les comportements de routage, mémoire, ORM local et Schedule restent inchangés ; cette alpha est un durcissement TypeScript pur.
- Validation ciblée RailGraph/ORM/Schedule : **122/122 tests verts**. Gate finale : **173/173 fichiers fonctionnels + 32/32 fichiers lourds/performance = 205/205 fichiers actifs verts**. Preuve de parité : **147/147 fichiers runtime**, `index.html` et les deux bundles sont octet pour octet identiques à l’Alpha 25 officielle.
## Saison 3 — TypeScript Alpha 27 — Voies et tronçons durcis

Alpha 27 durcit `voie-points.ts`, le noyau des points de voie et tronçons utilisé pour l’occupation, les réservations, les cisaillements, la géométrie locale et la persistance des infrastructures. Le format des sauvegardes reste inchangé et le JavaScript compilé de ce module reste strictement identique à Alpha 26.

- `voie-points.ts` : **143 → 0 `any` explicite**.
- Dette globale auditée : **6 753 `any`** (contre 6 896 en Alpha 26).
- Compatibilité des anciennes sauvegardes conservée via des frontières `unknown`/records typées, sans changement du format écrit.
- Tests ciblés voies/tronçons/sauvegarde/ORM/LiveMap : **84/84** avant gate cumulative.
- Gate cumulative finale : **205/205 fichiers actifs verts** (173 fonctionnels + 32 lourds/perf).
- Parité runtime finale : **147/147 fichiers identiques à Alpha 26** ; `index.html`, `admin.html` et les deux bundles sont byte-identiques.
- Revalidation ciblée post-build : **84/84** tests verts.

