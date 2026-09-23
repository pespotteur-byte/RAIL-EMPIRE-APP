import { SNAPSHOT_STRIDE, SnapshotField } from '@re/core';
import {
  STATION_COLORS,
  trainColor,
  worldToScreen,
  type Camera,
  type MapRenderer,
  type RenderStation,
  type RenderTrain,
} from './types.ts';

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Fallback sans WebGL : suffisant pour quelques milliers de points visibles. */
export class Canvas2DMapRenderer implements MapRenderer {
  readonly kind = 'canvas2d';
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private stations: readonly RenderStation[] = [];
  private trains: readonly RenderTrain[] = [];
  private snapshot: Float32Array = new Float32Array(0);
  private snapshotCount = 0;
  private camera: Camera = { cx: 0, cy: 0, scale: 0.001 };
  private hover: string | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  setStations(stations: readonly RenderStation[]): void {
    this.stations = stations;
  }
  setTrains(trains: readonly RenderTrain[]): void {
    this.trains = trains;
  }
  setSnapshot(data: Float32Array, count: number): void {
    this.snapshot = data;
    this.snapshotCount = count;
  }
  setCamera(camera: Camera): void {
    this.camera = camera;
  }
  setHover(stationId: string | null): void {
    this.hover = stationId;
  }
  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  render(): void {
    const { ctx, camera: cam, width: w, height: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);

    const r = cam.scale > 0.01 ? 4 : cam.scale > 0.002 ? 3 : 2;
    const showLabels = cam.scale > 0.02;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const s of this.stations) {
      if (s.kind === 'ite' && cam.scale < 0.005) continue;
      const [px, py] = worldToScreen(cam, w, h, s.x, s.y);
      if (px < -8 || py < -8 || px > w + 8 || py > h + 8) continue;
      ctx.fillStyle = css(STATION_COLORS[s.kind]);
      ctx.beginPath();
      ctx.arc(px, py, s.id === this.hover ? r + 3 : r, 0, Math.PI * 2);
      ctx.fill();
      if (showLabels && s.kind === 'voyageur') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(s.name, px + r + 3, py);
      }
    }

    const n = Math.min(this.snapshotCount, this.trains.length);
    for (let i = 0; i < n; i++) {
      const o = i * SNAPSHOT_STRIDE;
      const x = this.snapshot[o + SnapshotField.X] ?? 0;
      const y = this.snapshot[o + SnapshotField.Y] ?? 0;
      const heading = this.snapshot[o + SnapshotField.Heading] ?? 0;
      const dwelling = (this.snapshot[o + SnapshotField.Dwelling] ?? 0) > 0.5;
      const authority = this.snapshot[o + SnapshotField.Authority] ?? 0;
      const [px, py] = worldToScreen(cam, w, h, x, y);
      if (px < -20 || py < -20 || px > w + 20 || py > h + 20) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-heading);
      ctx.fillStyle = css(trainColor(dwelling, authority));
      ctx.fillRect(-7, -3, 14, 6);
      ctx.restore();
      if (cam.scale > 0.005) {
        ctx.fillStyle = '#fee2e2';
        ctx.fillText(this.trains[i]?.label ?? '', px + 9, py - 8);
      }
    }
  }

  destroy(): void {
    this.stations = [];
    this.trains = [];
  }
}
