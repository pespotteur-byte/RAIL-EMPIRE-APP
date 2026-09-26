import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { catalog, hoverStation, hoverTrain, loadedTiles, rendererKind, sim, spawnDemoTrains, status, world, zoomLabel } from '../state/game.ts';
import { Livemap } from './Livemap.tsx';

const catalogInfo = signal<string>('catalogue : non chargé');
const heapInfo = signal<string>('');

interface MemoryPerformance extends Performance {
  memory?: { usedJSHeapSize: number };
}

function formatSimTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function App() {
  useEffect(() => {
    void (async () => {
      const idx = await world.ready();
      status.value = `${idx.count} points référencés · ${Object.keys(idx.tiles).length} tuiles`;
      const n = await spawnDemoTrains();
      sim.setRunning(true);
      sim.setTimeScale(10);
      status.value = `${n} trains de démonstration`;
    })().catch((e: unknown) => {
      status.value = `Erreur : ${e instanceof Error ? e.message : String(e)}`;
    });
    const t = setInterval(() => {
      const mem = (performance as MemoryPerformance).memory;
      heapInfo.value = mem ? `heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} Mo` : '';
    }, 1000);
    const d = setInterval(() => {
      const id = hoverTrain.value;
      if (id) sim.inspect(id);
    }, 250);
    return () => {
      clearInterval(t);
      clearInterval(d);
    };
  }, []);

  const loadCatalog = () => {
    catalogInfo.value = 'catalogue : chargement…';
    const t0 = performance.now();
    catalog
      .ready()
      .then((idx) => {
        const locos = catalog.filter({ category: 'locomotive' }).length;
        catalogInfo.value = `catalogue : ${idx.count} fiches (${locos} locomotives) en ${(performance.now() - t0).toFixed(0)} ms`;
      })
      .catch((e: unknown) => {
        catalogInfo.value = `catalogue : ${e instanceof Error ? e.message : String(e)}`;
      });
  };

  const stats = sim.stats.value;
  const hover = hoverStation.value;
  const detail = sim.detail.value?.id === hoverTrain.value ? sim.detail.value : null;
  return (
    <div class="app">
      <header class="topbar">
        <strong>Rail Empire V2</strong>
        <span class="badge">{rendererKind.value}</span>
        <span>{status.value}</span>
        <span class="spacer" />
        <span>{zoomLabel.value}</span>
        <span>{loadedTiles.value} tuiles</span>
        <span>{heapInfo.value}</span>
      </header>
      <main class="map-host">
        <Livemap />
        {detail && (
          <div class="tooltip">
            <b>{detail.label}</b>
            <div>
              {detail.speedKmh.toFixed(0)} km/h · limite {detail.limitKmh.toFixed(0)} (ligne {detail.lineLimitKmh.toFixed(0)})
            </div>
            <div class={detail.status === 'GO' ? 'muted' : 'error'}>
              {detail.status} · {detail.code} · {detail.reason}
            </div>
            <div class="muted">
              signal {detail.aspect} · km {detail.routeKm.toFixed(1)}/{detail.routeTotalKm.toFixed(1)} · {detail.blocksHeld} canton(s)
              {detail.nextStop ? ` · → ${detail.nextStop}` : ''}
            </div>
          </div>
        )}
        {hover && !detail && (
          <div class="tooltip">
            <b>{hover.name}</b>
            <div class="muted">
              {hover.kind} · {hover.id}
            </div>
          </div>
        )}
      </main>
      <footer class="bottombar">
        <button
          onClick={() => {
            sim.setRunning(!sim.running.value);
          }}
        >
          {sim.running.value ? 'Pause' : 'Lecture'}
        </button>
        {[1, 10, 60].map((s) => (
          <button
            key={s}
            class={sim.timeScale.value === s ? 'active' : ''}
            onClick={() => {
              sim.setTimeScale(s);
            }}
          >
            ×{s}
          </button>
        ))}
        <span>sim {stats ? formatSimTime(stats.simTime) : '--:--:--'}</span>
        <span>{stats ? `${stats.trains} trains · ${stats.cantons} cantons · ${stats.ticksPerSecond.toFixed(0)} ticks/s · ${stats.lastStepMs.toFixed(2)} ms/tick` : ''}</span>
        <span class="spacer" />
        <button onClick={loadCatalog}>Charger l’index catalogue</button>
        <span>{catalogInfo.value}</span>
        {sim.error.value && <span class="error">{sim.error.value}</span>}
      </footer>
    </div>
  );
}
