export class TileMap {
  constructor() {
    this.tileSize = 256;
    this.tileCache = new Map();
    this.centerLat = 49.75;
    this.centerLon = 2.7;
    this.zoomLevel = 7.5;
    this.minZoom = 5;
    this.maxZoom = 20;
    this.viewportWidth = 800;
    this.viewportHeight = 600;

    this.baseTileUrls = [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ];
    this.railTileUrls = [
      'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    ];
  }

  latLonToGlobalPixel(lat, lon, zoom) {
    const scale = Math.pow(2, zoom) * this.tileSize;
    const x = ((lon + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  globalPixelToLatLon(px, py, zoom) {
    const scale = Math.pow(2, zoom) * this.tileSize;
    const lon = (px / scale) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / scale))) * 180) / Math.PI;
    return { lat, lon };
  }

  worldToScreen(lat, lon, canvasW, canvasH) {
    const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
    const point = this.latLonToGlobalPixel(lat, lon, this.zoomLevel);
    return {
      x: point.x - center.x + canvasW / 2,
      y: point.y - center.y + canvasH / 2,
    };
  }

  screenToWorld(sx, sy, canvasW, canvasH) {
    const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
    const px = sx - canvasW / 2 + center.x;
    const py = sy - canvasH / 2 + center.y;
    return this.globalPixelToLatLon(px, py, this.zoomLevel);
  }

  pan(dx, dy) {
    const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, this.zoomLevel);
    const newCenter = this.globalPixelToLatLon(center.x - dx, center.y - dy, this.zoomLevel);
    this.centerLat = Math.max(-85, Math.min(85, newCenter.lat));
    this.centerLon = newCenter.lon;
  }

  applyZoom(delta, sx, sy) {
    const worldBefore = this.screenToWorld(sx, sy, this.viewportWidth, this.viewportHeight);
    const step = delta > 0 ? 0.25 : -0.25;
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + step));
    const worldAfter = this.screenToWorld(sx, sy, this.viewportWidth, this.viewportHeight);
    this.centerLat -= worldAfter.lat - worldBefore.lat;
    this.centerLon -= worldAfter.lon - worldBefore.lon;
  }

  getTile(tx, ty, z, urlTemplate) {
    const key = `${urlTemplate}/${z}/${tx}/${ty}`;
    const cached = this.tileCache.get(key);
    if (cached) {
      // Retry failed tiles after 5 seconds
      if (cached.error && Date.now() - cached.errorTime > 5000) {
        this.tileCache.delete(key);
      } else {
        return cached;
      }
    }

    const tile = { loaded: false, error: false, img: null, errorTime: 0 };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { tile.loaded = true; tile.img = img; };
    img.onerror = () => { tile.error = true; tile.errorTime = Date.now(); };

    const url = urlTemplate.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
    img.src = url;

    this.tileCache.set(key, tile);
    if (this.tileCache.size > 800) {
      // Evict errored tiles first, then oldest
      const keys = Array.from(this.tileCache.keys());
      let evicted = 0;
      for (const k of keys) {
        if (evicted >= 200) break;
        const t = this.tileCache.get(k);
        if (t && t.error) { this.tileCache.delete(k); evicted++; }
      }
      for (let i = 0; evicted < 200 && i < keys.length; i++) {
        if (this.tileCache.has(keys[i])) { this.tileCache.delete(keys[i]); evicted++; }
      }
    }
    return tile;
  }

  renderTiles(ctx, canvasW, canvasH) {
    const z = Math.round(this.zoomLevel);
    const scale = Math.pow(2, this.zoomLevel - z);
    const scaledTileSize = this.tileSize * scale;
    const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, z);

    const startTileX = Math.floor((center.x - canvasW / 2 / scale) / this.tileSize);
    const startTileY = Math.floor((center.y - canvasH / 2 / scale) / this.tileSize);
    const endTileX = Math.ceil((center.x + canvasW / 2 / scale) / this.tileSize);
    const endTileY = Math.ceil((center.y + canvasH / 2 / scale) / this.tileSize);
    const maxTile = Math.pow(2, z);

    const layers = [this.baseTileUrls, this.railTileUrls];
    for (const urls of layers) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          if (ty < 0 || ty >= maxTile) continue;
          const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
          const urlIdx = (wrappedTx + ty) % urls.length;
          const tile = this.getTile(wrappedTx, ty, z, urls[urlIdx]);
          if (tile.loaded && tile.img) {
            const px = (tx * this.tileSize - center.x) * scale + canvasW / 2;
            const py = (ty * this.tileSize - center.y) * scale + canvasH / 2;
            ctx.drawImage(tile.img, px, py, scaledTileSize, scaledTileSize);
          }
        }
      }
    }
  }

  latLonToPixel(lat, lon) {
    return this.worldToScreen(lat, lon, this.viewportWidth, this.viewportHeight);
  }

  getPixelsPerKm() {
    const lat = this.centerLat;
    const p1 = this.latLonToGlobalPixel(lat, 0, this.zoomLevel);
    const p2 = this.latLonToGlobalPixel(lat, 0.01, this.zoomLevel);
    const pxPer001Deg = p2.x - p1.x;
    const kmPer001Deg = 0.01 * 111.32 * Math.cos((lat * Math.PI) / 180);
    return pxPer001Deg / kmPer001Deg;
  }
}
