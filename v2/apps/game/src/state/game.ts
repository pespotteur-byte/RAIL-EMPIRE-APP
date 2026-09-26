import { computed, signal } from '@preact/signals';
import { ChunkLoader, CatalogStore, WorldRefStore, normalizeText, project, unproject, type RefPoint } from '@re/data';
import type { TrainPhysicsParams } from '@re/core';
import type { Camera, RenderStation } from '@re/render';
import { ScriptChunkSource } from '../platform/script-chunk-source.ts';
import { SimClient } from '../sim/sim-client.ts';

/** Racine des données : relative à index.html, fonctionne en file:// et en http. */
function dataBaseUrl(): string {
  const href = location.href.split(/[?#]/)[0] ?? '';
  const dir = href.slice(0, href.lastIndexOf('/') + 1);
  return `${dir}data/`;
}

export const loader = new ChunkLoader(new ScriptChunkSource(dataBaseUrl()));
export const world = new WorldRefStore(loader, 24);
export const catalog = new CatalogStore(loader, 4);
export const sim = new SimClient();

const PARIS = project(48.8566, 2.3522);
export const camera = signal<Camera>({ cx: PARIS.x, cy: PARIS.y, scale: 0.004 });
export const viewport = signal({ width: 1, height: 1 });
export const hoverStation = signal<RenderStation | null>(null);
export const hoverTrain = signal<string | null>(null);
export const rendererKind = signal<string>('…');
export const status = signal<string>('Chargement de l’index monde…');
export const visibleStations = signal<readonly RenderStation[]>([]);
export const loadedTiles = signal(0);

export const zoomLabel = computed(() => {
  const c = camera.value;
  const mPerPx = 1 / c.scale;
  return mPerPx >= 1000 ? `${(mPerPx / 1000).toFixed(1)} km/px` : `${mPerPx.toFixed(0)} m/px`;
});

/** Emprise géographique de la vue courante (avec marge d'une demi-vue). */
export function viewBounds(): { s: number; w: number; n: number; e: number } {
  const c = camera.value;
  const { width, height } = viewport.value;
  const hw = (width / c.scale) * 0.75;
  const hh = (height / c.scale) * 0.75;
  const sw = unproject(c.cx - hw, c.cy - hh);
  const ne = unproject(c.cx + hw, c.cy + hh);
  return { s: sw.lat, w: sw.lon, n: ne.lat, e: ne.lon };
}

let refreshToken = 0;
export async function refreshVisibleStations(): Promise<void> {
  const token = ++refreshToken;
  const b = viewBounds();
  // au-delà de ~1 km/px, on ne charge pas le monde entier : gares voyageurs des tuiles centrales seulement
  const tooWide = b.e - b.w > 24 || b.n - b.s > 16;
  const points: RefPoint[] = tooWide ? [] : await world.inBounds(b.s, b.w, b.n, b.e);
  if (token !== refreshToken) return;
  const out: RenderStation[] = [];
  for (const p of points) {
    const xy = project(p.lat, p.lon);
    out.push({ id: p.id, name: p.name, kind: p.kind, x: xy.x, y: xy.y });
  }
  visibleStations.value = out;
  loadedTiles.value = world.loadedTiles.length;
  status.value = tooWide ? 'Zoomez pour afficher les gares' : `${out.length} points · ${world.loadedTiles.length} tuiles`;
}

const DEMO_ROUTES: { label: string; names: string[]; kmh: number; physics: TrainPhysicsParams }[] = [
  {
    label: 'RER A',
    names: ['Saint-Germain-en-Laye', 'Châtelet–Les Halles', 'Marne-la-Vallée–Chessy'],
    kmh: 110,
    physics: { massKg: 260_000, powerW: 3_500_000, lengthM: 112, brakeServiceMs2: 1.0 },
  },
  {
    label: 'TER 847',
    names: ['Paris-Saint-Lazare', 'Mantes-la-Jolie', 'Rouen-Rive-Droite'],
    kmh: 160,
    physics: { massKg: 180_000, powerW: 2_400_000, lengthM: 72, brakeServiceMs2: 0.9 },
  },
  {
    label: 'TGV 6601',
    names: ['Paris-Gare-de-Lyon', 'Dijon-Ville', 'Lyon-Part-Dieu'],
    kmh: 300,
    physics: { massKg: 385_000, powerW: 12_000_000, lengthM: 200, brakeServiceMs2: 0.7 },
  },
  {
    label: 'IC 2050',
    names: ['Koblenz Hbf', 'Bonn Hbf', 'Köln Hbf'],
    kmh: 160,
    physics: { massKg: 420_000, powerW: 5_600_000, lengthM: 205, brakeServiceMs2: 0.8 },
  },
];

/** Trains de démonstration résolus par recherche de nom dans le référentiel. */
export async function spawnDemoTrains(): Promise<number> {
  let spawned = 0;
  for (const r of DEMO_ROUTES) {
    const stops: RefPoint[] = [];
    for (const name of r.names) {
      const hits = await world.searchNames(name, 5, 'voyageur');
      const hit = hits.find((h) => normalizeText(h.name) === normalizeText(name)) ?? hits[0];
      if (!hit) break;
      const tile = await world.tile(hit.tile);
      const p = tile.find((x) => x.id === hit.id);
      if (!p) break;
      stops.push(p);
    }
    if (stops.length !== r.names.length) continue;
    sim.addStations(stops.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon })));
    sim.addTrain({
      id: `demo-${r.label}`,
      label: r.label,
      route: stops.map((p) => p.id),
      maxSpeedKmh: r.kmh,
      physics: r.physics,
      dwellS: 60,
      loop: true,
    });
    spawned++;
  }
  world.releaseNames();
  return spawned;
}
