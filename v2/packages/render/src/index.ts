import { Canvas2DMapRenderer } from './canvas2d-renderer.ts';
import type { MapRenderer } from './types.ts';

export * from './types.ts';
export { Canvas2DMapRenderer } from './canvas2d-renderer.ts';

export interface CreateRendererOptions {
  /** Forcer le fallback (debug / navigateurs anciens). */
  forceCanvas2d?: boolean;
  onFallback?: (reason: string) => void;
}

/**
 * WebGL via PixiJS si disponible, sinon Canvas 2D. En cas d'échec après
 * acquisition d'un contexte WebGL, le canvas est remplacé par un neuf (un
 * canvas ne peut pas changer de type de contexte).
 */
export async function createMapRenderer(canvas: HTMLCanvasElement, opts: CreateRendererOptions = {}): Promise<MapRenderer> {
  if (!opts.forceCanvas2d && hasWebGL()) {
    try {
      const { PixiMapRenderer } = await import('./pixi-renderer.ts');
      return await PixiMapRenderer.create(canvas);
    } catch (e) {
      opts.onFallback?.(e instanceof Error ? e.message : String(e));
      const fresh = document.createElement('canvas');
      fresh.className = canvas.className;
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
  } else if (!opts.forceCanvas2d) {
    opts.onFallback?.('WebGL indisponible');
  }
  return new Canvas2DMapRenderer(canvas);
}

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
