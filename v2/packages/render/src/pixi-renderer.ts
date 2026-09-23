import { SNAPSHOT_STRIDE, SnapshotField } from '@re/core';
import { Application, Container, Graphics, RendererType, Sprite, Text, type Texture } from 'pixi.js';
import {
  STATION_COLORS,
  trainColor,
  worldToScreen,
  type Camera,
  type MapRenderer,
  type RenderStation,
  type RenderTrain,
} from './types.ts';

function isWebGpu(rendererType: number): boolean {
  const webgpu: number = RendererType.WEBGPU;
  return rendererType === webgpu;
}

/**
 * Rendu WebGL (ou WebGPU) via PixiJS 8.
 *
 * Les positions sont stockées relativement à une origine locale : les coordonnées
 * Mercator (jusqu'à 2·10⁷ m) perdraient de la précision en float32 sur le GPU.
 * Le monde est un seul Container (translation + échelle) : un déplacement de
 * caméra ne touche pas aux sprites.
 */
export class PixiMapRenderer implements MapRenderer {
  readonly kind: 'webgl' | 'webgpu';
  readonly canvas: HTMLCanvasElement;
  private readonly app: Application;
  private readonly world = new Container();
  private readonly stationLayer = new Container();
  private readonly trainLayer = new Container();
  private readonly labelLayer = new Container();
  private readonly dotTexture: Texture;
  private readonly trainTexture: Texture;
  private stationSprites: Sprite[] = [];
  private stations: readonly RenderStation[] = [];
  private stationById = new Map<string, number>();
  private trainSprites: Sprite[] = [];
  private trainLabels: Text[] = [];
  private trains: readonly RenderTrain[] = [];
  private snapshot: Float32Array = new Float32Array(0);
  private snapshotCount = 0;
  private camera: Camera = { cx: 0, cy: 0, scale: 0.001 };
  private hover: string | null = null;
  private readonly hoverLabel: Text;
  private origin = { x: 0, y: 0 };
  private width = 1;
  private height = 1;

  private constructor(app: Application, canvas: HTMLCanvasElement) {
    this.app = app;
    this.canvas = canvas;
    this.kind = isWebGpu(app.renderer.type) ? 'webgpu' : 'webgl';
    this.world.addChild(this.stationLayer, this.trainLayer);
    this.app.stage.addChild(this.world, this.labelLayer);
    this.dotTexture = app.renderer.generateTexture(new Graphics().circle(0, 0, 6).fill(0xffffff));
    this.trainTexture = app.renderer.generateTexture(new Graphics().rect(0, 0, 14, 6).fill(0xffffff));
    this.hoverLabel = new Text({ text: '', style: { fill: 0xffffff, fontSize: 13, fontFamily: 'system-ui, sans-serif' } });
    this.hoverLabel.visible = false;
    this.labelLayer.addChild(this.hoverLabel);
  }

  static async create(canvas: HTMLCanvasElement): Promise<PixiMapRenderer> {
    const app = new Application();
    await app.init({
      canvas,
      preference: 'webgl',
      autoStart: false,
      autoDensity: true,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      background: 0x0b1220,
      antialias: true,
      failIfMajorPerformanceCaveat: false,
    });
    return new PixiMapRenderer(app, canvas);
  }

  setStations(stations: readonly RenderStation[]): void {
    this.stations = stations;
    this.stationById = new Map(stations.map((s, i) => [s.id, i]));
    const first = stations[0];
    if (first) this.origin = { x: first.x, y: first.y };
    for (let i = stations.length; i < this.stationSprites.length; i++) {
      const sp = this.stationSprites[i];
      if (sp) sp.visible = false;
    }
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      if (!s) continue;
      let sp = this.stationSprites[i];
      if (!sp) {
        sp = new Sprite(this.dotTexture);
        sp.anchor.set(0.5);
        this.stationSprites[i] = sp;
        this.stationLayer.addChild(sp);
      }
      sp.visible = true;
      sp.tint = STATION_COLORS[s.kind];
      sp.position.set(s.x - this.origin.x, -(s.y - this.origin.y));
    }
  }

  setTrains(trains: readonly RenderTrain[]): void {
    this.trains = trains;
    for (let i = trains.length; i < this.trainSprites.length; i++) {
      const sp = this.trainSprites[i];
      const lb = this.trainLabels[i];
      if (sp) sp.visible = false;
      if (lb) lb.visible = false;
    }
    for (let i = 0; i < trains.length; i++) {
      const t = trains[i];
      if (!t) continue;
      let sp = this.trainSprites[i];
      if (!sp) {
        sp = new Sprite(this.trainTexture);
        sp.anchor.set(0.5);
        this.trainSprites[i] = sp;
        this.trainLayer.addChild(sp);
      }
      sp.visible = true;
      let lb = this.trainLabels[i];
      if (!lb) {
        lb = new Text({ text: '', style: { fill: 0xfee2e2, fontSize: 11, fontFamily: 'system-ui, sans-serif' } });
        this.trainLabels[i] = lb;
        this.labelLayer.addChild(lb);
      }
      lb.text = t.label;
      lb.visible = true;
    }
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
    this.app.renderer.resize(this.width, this.height);
  }

  render(): void {
    const cam = this.camera;
    const w = this.width;
    const h = this.height;
    const [ox, oy] = worldToScreen(cam, w, h, this.origin.x, this.origin.y);
    this.world.position.set(ox, oy);
    this.world.scale.set(cam.scale);

    // taille écran constante des sprites quelle que soit l'échelle
    const dotScale = (cam.scale > 0.01 ? 4 : cam.scale > 0.002 ? 3 : 2) / 6 / cam.scale;
    const showIte = cam.scale >= 0.005;
    const hoverIdx = this.hover === null ? undefined : this.stationById.get(this.hover);
    for (let i = 0; i < this.stations.length; i++) {
      const sp = this.stationSprites[i];
      const s = this.stations[i];
      if (!sp || !s) continue;
      sp.visible = s.kind !== 'ite' || showIte;
      sp.scale.set(i === hoverIdx ? dotScale * 1.8 : dotScale);
    }

    const trainScale = 1 / cam.scale;
    const n = Math.min(this.snapshotCount, this.trains.length);
    const showTrainLabels = cam.scale > 0.005;
    for (let i = 0; i < this.trainSprites.length; i++) {
      const sp = this.trainSprites[i];
      const lb = this.trainLabels[i];
      if (!sp) continue;
      if (i >= n) {
        sp.visible = false;
        if (lb) lb.visible = false;
        continue;
      }
      const o = i * SNAPSHOT_STRIDE;
      const x = this.snapshot[o + SnapshotField.X] ?? 0;
      const y = this.snapshot[o + SnapshotField.Y] ?? 0;
      const heading = this.snapshot[o + SnapshotField.Heading] ?? 0;
      const dwelling = (this.snapshot[o + SnapshotField.Dwelling] ?? 0) > 0.5;
      const authority = this.snapshot[o + SnapshotField.Authority] ?? 0;
      sp.visible = true;
      sp.position.set(x - this.origin.x, -(y - this.origin.y));
      sp.rotation = -heading;
      sp.scale.set(trainScale);
      sp.tint = trainColor(dwelling, authority);
      if (lb) {
        lb.visible = showTrainLabels;
        if (showTrainLabels) {
          const [px, py] = worldToScreen(cam, w, h, x, y);
          lb.position.set(px + 9, py - 18);
        }
      }
    }

    const hs = hoverIdx === undefined ? undefined : this.stations[hoverIdx];
    if (hs) {
      const [px, py] = worldToScreen(cam, w, h, hs.x, hs.y);
      this.hoverLabel.text = hs.name;
      this.hoverLabel.position.set(px + 10, py - 8);
      this.hoverLabel.visible = true;
    } else {
      this.hoverLabel.visible = false;
    }

    this.app.render();
  }

  destroy(): void {
    this.app.destroy(false, { children: true, texture: true });
  }
}
