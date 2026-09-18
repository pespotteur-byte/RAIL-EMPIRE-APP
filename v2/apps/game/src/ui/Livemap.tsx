import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { createMapRenderer, screenToWorld, type MapRenderer, type RenderStation } from '@re/render';
import { camera, hoverStation, refreshVisibleStations, rendererKind, sim, viewport, visibleStations } from '../state/game.ts';

const MIN_SCALE = 0.00002;
const MAX_SCALE = 2;

/**
 * Carte : un canvas, un renderer (WebGL/Canvas 2D), une boucle rAF qui ne fait
 * que pousser caméra + dernier snapshot. Aucun état de jeu ici.
 */
export function Livemap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: MapRenderer | null = null;
    let raf = 0;
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const disposers: (() => void)[] = [];
    let rebindTo: (el: HTMLCanvasElement) => void = () => undefined;

    const host = canvas.parentElement ?? document.body;
    const resize = () => {
      const r = host.getBoundingClientRect();
      viewport.value = { width: Math.max(1, Math.floor(r.width)), height: Math.max(1, Math.floor(r.height)) };
      renderer?.resize(viewport.value.width, viewport.value.height);
    };
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void refreshVisibleStations();
      }, 120);
    };

    void createMapRenderer(canvas, {
      forceCanvas2d: new URLSearchParams(location.search).has('canvas2d'),
      onFallback: (reason) => {
        console.warn('[render] fallback Canvas 2D :', reason);
      },
    }).then((r) => {
      if (disposed) {
        r.destroy();
        return;
      }
      renderer = r;
      rebindTo(r.canvas);
      rendererKind.value = r.kind;
      resize();
      disposers.push(
        effect(() => {
          r.setStations(visibleStations.value);
        }),
        effect(() => {
          r.setTrains(sim.trains.value.ids.map((id, i) => ({ id, label: sim.trains.value.labels[i] ?? id })));
        }),
        effect(() => {
          r.setHover(hoverStation.value?.id ?? null);
        }),
        effect(() => {
          r.setCamera(camera.value);
          scheduleRefresh();
        }),
      );
      const loop = () => {
        if (disposed) return;
        const snap = sim.latest;
        r.setSnapshot(snap.data, snap.count);
        r.render();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // --- interactions : molette = zoom autour du curseur, glisser = pan, survol = gare ---
    // Liées au canvas actif du renderer (le fallback Canvas 2D peut remplacer l'élément).
    let target: HTMLCanvasElement = canvas;
    let drag: { x: number; y: number; cx: number; cy: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camera.value;
      const { width, height } = viewport.value;
      const rect = target.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const [wx, wy] = screenToWorld(c, width, height, px, py);
      const factor = Math.exp(-e.deltaY * 0.0015);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor));
      // garder le point sous le curseur fixe
      const cx = wx - (px - width / 2) / scale;
      const cy = wy + (py - height / 2) / scale;
      camera.value = { cx, cy, scale };
    };
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, cx: camera.value.cx, cy: camera.value.cy };
      target.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (drag) {
        const c = camera.value;
        camera.value = { ...c, cx: drag.cx - (e.clientX - drag.x) / c.scale, cy: drag.cy + (e.clientY - drag.y) / c.scale };
        return;
      }
      const rect = target.getBoundingClientRect();
      hoverStation.value = pickStation(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onUp = (e: PointerEvent) => {
      drag = null;
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    };
    const onCancel = () => {
      drag = null;
    };
    const onLeave = () => {
      hoverStation.value = null;
    };
    const bind = (el: HTMLCanvasElement) => {
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);
      el.addEventListener('lostpointercapture', onCancel);
      el.addEventListener('pointerleave', onLeave);
    };
    const unbind = (el: HTMLCanvasElement) => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('lostpointercapture', onCancel);
      el.removeEventListener('pointerleave', onLeave);
    };
    bind(target);
    rebindTo = (el) => {
      if (el === target) return;
      unbind(target);
      target = el;
      bind(target);
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (refreshTimer) clearTimeout(refreshTimer);
      ro.disconnect();
      for (const d of disposers) d();
      unbind(target);
      renderer?.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} class="livemap" />;
}

function pickStation(px: number, py: number): RenderStation | null {
  const c = camera.value;
  const { width, height } = viewport.value;
  const [wx, wy] = screenToWorld(c, width, height, px, py);
  const radius = 8 / c.scale;
  let best: RenderStation | null = null;
  let bestD = radius * radius;
  for (const s of visibleStations.value) {
    if (s.kind === 'ite' && c.scale < 0.005) continue;
    const dx = s.x - wx;
    const dy = s.y - wy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
