import type { RefPointKind } from '@re/data';

export interface RenderStation {
  id: string;
  name: string;
  kind: RefPointKind;
  /** Web Mercator (m) */
  x: number;
  y: number;
}

export interface RenderTrain {
  id: string;
  label: string;
}

/** Caméra : centre en mètres Mercator, `scale` = pixels par mètre. */
export interface Camera {
  cx: number;
  cy: number;
  scale: number;
}

export interface MapRenderer {
  readonly kind: 'webgl' | 'webgpu' | 'canvas2d';
  readonly canvas: HTMLCanvasElement;
  setStations(stations: readonly RenderStation[]): void;
  setTrains(trains: readonly RenderTrain[]): void;
  /** Snapshot brut du moteur (SNAPSHOT_STRIDE floats par train). */
  setSnapshot(data: Float32Array, count: number): void;
  setCamera(camera: Camera): void;
  setHover(stationId: string | null): void;
  resize(width: number, height: number): void;
  /** Rend une image ; à appeler depuis requestAnimationFrame. */
  render(): void;
  destroy(): void;
}

export function worldToScreen(cam: Camera, w: number, h: number, x: number, y: number): [number, number] {
  return [w / 2 + (x - cam.cx) * cam.scale, h / 2 - (y - cam.cy) * cam.scale];
}

export function screenToWorld(cam: Camera, w: number, h: number, px: number, py: number): [number, number] {
  return [cam.cx + (px - w / 2) / cam.scale, cam.cy - (py - h / 2) / cam.scale];
}

export const STATION_COLORS: Record<RefPointKind, number> = {
  voyageur: 0x3b82f6,
  marchandise: 0xf59e0b,
  ite: 0x9ca3af,
};

export const TRAIN_COLOR = 0xef4444;
export const TRAIN_DWELL_COLOR = 0xfca5a5;
/** Train ralenti par un avertissement (CAUTION) */
export const TRAIN_CAUTION_COLOR = 0xf59e0b;
/** Train arrêté par un carré fermé (STOP hors gare) */
export const TRAIN_STOP_COLOR = 0xa855f7;

/** Couleur d'un train selon dwelling + code d'autorité (0 GO, 1 CAUTION, 2 STOP). */
export function trainColor(dwelling: boolean, authority: number): number {
  if (dwelling) return TRAIN_DWELL_COLOR;
  if (authority >= 2) return TRAIN_STOP_COLOR;
  if (authority >= 1) return TRAIN_CAUTION_COLOR;
  return TRAIN_COLOR;
}
