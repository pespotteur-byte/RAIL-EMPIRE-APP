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

    // Separate loading pools: base and ORM load in parallel
    this._baseLoading = 0;
    this._railLoading = 0;
    this._maxBaseConn = 8;
    this._maxRailConn = 8;
    this._baseQueue = [];
    this._railQueue = [];
    this._lastQueueZoom = 0;

    // Generation counter — increments on zoom change to discard stale loads
    this._generation = 0;
    // Zoom debounce — wait for zoom to stabilize before loading
    this._zoomDebounceTimer = null;
    this._zoomSettled = true;
    this._lastRoundedZoom = 0;

    // Dirty flag for view changes
    this._dirty = true;
    this._lastCenterLat = 0;
    this._lastCenterLon = 0;
    this._lastZoom = 0;

    // Offscreen tile buffer
    this._tileCanvas = null;
    this._tileCtx = null;
    this._tileBufferValid = false;
    this._tileBufferW = 0;
    this._tileBufferH = 0;
    this._pendingTiles = 0;
    this._lastPendingTiles = 0;

    this.baseTileUrls = [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ];
    this.satelliteTileUrls = [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ];
    this.satelliteEnabled = false;
    this.railTileUrls = [
      'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    ];

    // Weather radar overlay (RainViewer)
    this.radarEnabled = false;
    this._radarTileUrl = null;
    this._radarMaxZoom = 12; // RainViewer max supported zoom
  }

  markDirty() { this._dirty = true; this._tileBufferValid = false; }

  _checkDirty() {
    if (this.centerLat !== this._lastCenterLat ||
        this.centerLon !== this._lastCenterLon ||
        this.zoomLevel !== this._lastZoom) {
      this._dirty = true;
      this._tileBufferValid = false;

      // Detect zoom level change (integer) → discard stale + debounce
      const newZ = Math.round(this.zoomLevel);
      if (newZ !== this._lastRoundedZoom) {
        this._lastRoundedZoom = newZ;
        // Bump generation so in-flight loads are discarded on completion
        this._generation++;
        this._baseLoading = 0;
        this._railLoading = 0;
        this._baseQueue = [];
        this._railQueue = [];
        // Remove unfinished tile entries so they get re-queued at new zoom
        for (const [k, t] of this.tileCache) {
          if (!t.loaded && !t.error) this.tileCache.delete(k);
        }
        // Debounce: don't load new tiles until zoom stable for 80ms
        this._zoomSettled = false;
        clearTimeout(this._zoomDebounceTimer);
        this._zoomDebounceTimer = setTimeout(() => {
          this._zoomSettled = true;
          this._dirty = true;
          this._tileBufferValid = false;
          this._processQueue();
        }, 80);
      }

      this._lastCenterLat = this.centerLat;
      this._lastCenterLon = this.centerLon;
      this._lastZoom = this.zoomLevel;
    }
  }

  get isDirty() {
    this._checkDirty();
    return this._dirty;
  }

  clearDirty() { this._dirty = false; }

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

  _processQueue() {
    if (!this._zoomSettled) return;
    const curZ = Math.round(this.zoomLevel);
    // Process base pool
    this._drainPool(this._baseQueue, curZ, false);
    // Process rail pool in parallel
    this._drainPool(this._railQueue, curZ, true);
  }

  _drainPool(queue, curZ, isRail) {
    const max = isRail ? this._maxRailConn : this._maxBaseConn;
    let loading = isRail ? this._railLoading : this._baseLoading;
    while (queue.length > 0 && loading < max) {
      const item = queue.shift();
      if (item.tile.loaded || item.tile.error) continue;
      if (item.z !== undefined && item.z !== curZ) continue;
      loading++;
      if (isRail) this._railLoading = loading; else this._baseLoading = loading;
      this._fetchTile(item.tile, item.url, isRail);
    }
  }

  _fetchTile(tile, url, isRail) {
    const gen = this._generation;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      if (gen !== this._generation) return;
      tile.loaded = true;
      tile.img = img;
      if (isRail) this._railLoading--; else this._baseLoading--;
      this._tileBufferValid = false;
      this._dirty = true;
      this._processQueue();
    };
    img.onerror = () => {
      if (gen !== this._generation) return;
      tile.error = true;
      tile.errorTime = Date.now();
      if (isRail) this._railLoading--; else this._baseLoading--;
      this._processQueue();
    };
    img.src = url;
  }

  getTile(tx, ty, z, urlTemplate) {
    const isRail = urlTemplate.includes('openrailway');
    const isRadar = urlTemplate.includes('rainviewer');
    const isSat = urlTemplate.includes('arcgisonline');
    const suffix = isRadar ? 'w' : (isRail ? 'r' : (isSat ? 's' : 'b'));
    const key = `${z}/${tx}/${ty}/${suffix}`;
    const cached = this.tileCache.get(key);
    if (cached) {
      if (cached.error && Date.now() - cached.errorTime > 3000) {
        this.tileCache.delete(key);
      } else {
        return cached;
      }
    }

    const tile = { loaded: false, error: false, img: null, errorTime: 0 };
    this.tileCache.set(key, tile);

    const url = urlTemplate.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
    if (isRail || isRadar) this._railQueue.push({ tile, url, z });
    else this._baseQueue.push({ tile, url, z });
    this._processQueue();

    // Evict when cache too large — LRU-like: remove error tiles first, then oldest
    if (this.tileCache.size > 3000) {
      const keys = Array.from(this.tileCache.keys());
      let evicted = 0;
      // Phase 1: remove error tiles
      for (const k of keys) {
        if (evicted >= 500) break;
        const t = this.tileCache.get(k);
        if (t && t.error) { this.tileCache.delete(k); evicted++; }
      }
      // Phase 2: remove tiles from different zoom levels (keep current zoom)
      const currentZ = this.zoomLevel;
      for (const k of keys) {
        if (evicted >= 500) break;
        if (!this.tileCache.has(k)) continue;
        const tileZ = parseInt(k.split('/')[0]) || 0;
        if (tileZ !== currentZ) { this.tileCache.delete(k); evicted++; }
      }
      // Phase 3: remove oldest entries (Map preserves insertion order)
      for (let i = 0; evicted < 500 && i < keys.length; i++) {
        if (this.tileCache.has(keys[i])) { this.tileCache.delete(keys[i]); evicted++; }
      }
    }
    return tile;
  }

  renderTiles(ctx, canvasW, canvasH) {
    // Detect view changes (zoom/pan) and invalidate buffer if needed
    this._checkDirty();

    // Use offscreen buffer: only re-render tiles when view changed or new tiles loaded
    if (this._tileBufferValid && this._tileCanvas &&
        this._tileBufferW === canvasW && this._tileBufferH === canvasH) {
      ctx.drawImage(this._tileCanvas, 0, 0);
      return;
    }

    // Create/resize offscreen canvas (logical size — same coordinate space as main ctx)
    if (!this._tileCanvas || this._tileBufferW !== canvasW || this._tileBufferH !== canvasH) {
      this._tileCanvas = document.createElement('canvas');
      this._tileCanvas.width = canvasW;
      this._tileCanvas.height = canvasH;
      this._tileCtx = this._tileCanvas.getContext('2d');
      this._tileBufferW = canvasW;
      this._tileBufferH = canvasH;
    }

    const tctx = this._tileCtx;
    tctx.clearRect(0, 0, canvasW, canvasH);

    const z = Math.round(this.zoomLevel);
    const scale = Math.pow(2, this.zoomLevel - z);
    const scaledTileSize = this.tileSize * scale;
    const center = this.latLonToGlobalPixel(this.centerLat, this.centerLon, z);

    const startTileX = Math.floor((center.x - canvasW / 2 / scale) / this.tileSize);
    const startTileY = Math.floor((center.y - canvasH / 2 / scale) / this.tileSize);
    const endTileX = Math.ceil((center.x + canvasW / 2 / scale) / this.tileSize);
    const endTileY = Math.ceil((center.y + canvasH / 2 / scale) / this.tileSize);
    const maxTile = Math.pow(2, z);

    this._pendingTiles = 0;

    this._lastQueueZoom = z;

    const baseUrls = this.satelliteEnabled ? this.satelliteTileUrls : this.baseTileUrls;
    const layers = [baseUrls, this.railTileUrls];
    // Add radar layer if enabled (clamp to max supported zoom)
    if (this.radarEnabled && this._radarTileUrl) {
      layers.push([this._radarTileUrl]);
    }
    for (const urls of layers) {
      const isRadarLayer = this.radarEnabled && urls[0] === this._radarTileUrl;
      if (isRadarLayer) tctx.globalAlpha = 0.5;
      // Radar tiles: clamp zoom to max supported, upscale for higher zooms
      const layerZ = isRadarLayer ? Math.min(z, this._radarMaxZoom) : z;
      const layerMaxTile = isRadarLayer ? Math.pow(2, layerZ) : maxTile;
      const zoomDiff = z - layerZ;
      const upscale = Math.pow(2, zoomDiff);
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          if (ty < 0 || ty >= maxTile) continue;
          const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
          if (isRadarLayer && zoomDiff > 0) {
            // Upscale: find the parent tile at clamped zoom
            const parentTx = Math.floor(wrappedTx / upscale);
            const parentTy = Math.floor(ty / upscale);
            const urlIdx = (parentTx + parentTy) % urls.length;
            const tile = this.getTile(parentTx, parentTy, layerZ, urls[urlIdx]);
            if (tile.loaded && tile.img) {
              const subX = wrappedTx - parentTx * upscale;
              const subY = ty - parentTy * upscale;
              const srcSize = this.tileSize / upscale;
              const px = (tx * this.tileSize - center.x) * scale + canvasW / 2;
              const py = (ty * this.tileSize - center.y) * scale + canvasH / 2;
              tctx.drawImage(tile.img, subX * srcSize, subY * srcSize, srcSize, srcSize, px, py, scaledTileSize, scaledTileSize);
            }
          } else {
            const urlIdx = (wrappedTx + ty) % urls.length;
            const tile = this.getTile(wrappedTx, ty, layerZ, urls[urlIdx]);
            if (tile.loaded && tile.img) {
              const px = (tx * this.tileSize - center.x) * scale + canvasW / 2;
              const py = (ty * this.tileSize - center.y) * scale + canvasH / 2;
              tctx.drawImage(tile.img, px, py, scaledTileSize, scaledTileSize);
            }
          }
          if (!isRadarLayer) {
            // Fallback: draw cached lower-zoom tile while loading (non-radar only)
            const wrTx = ((tx % maxTile) + maxTile) % maxTile;
            const urlIdx2 = (wrTx + ty) % urls.length;
            const tile2 = this.getTile(wrTx, ty, z, urls[urlIdx2]);
            if (!tile2.loaded && !tile2.error) {
              this._pendingTiles++;
              const isOverlay = urls === this.railTileUrls;
              const suffix = isOverlay ? 'r' : 'b';
              for (let fz = z - 1; fz >= this.minZoom; fz--) {
                const fScale = Math.pow(2, z - fz);
                const ftx = Math.floor(wrTx / fScale);
                const fty = Math.floor(ty / fScale);
                const fKey = `${fz}/${ftx}/${fty}/${suffix}`;
                const fTile = this.tileCache.get(fKey);
                if (fTile && fTile.loaded && fTile.img) {
                  const subX = wrTx - ftx * fScale;
                  const subY = ty - fty * fScale;
                  const srcSize = this.tileSize / fScale;
                  const px = (tx * this.tileSize - center.x) * scale + canvasW / 2;
                  const py2 = (ty * this.tileSize - center.y) * scale + canvasH / 2;
                  tctx.drawImage(fTile.img, subX * srcSize, subY * srcSize, srcSize, srcSize, px, py2, scaledTileSize, scaledTileSize);
                  break;
                }
              }
            }
          }
        }
      }
      if (isRadarLayer) tctx.globalAlpha = 1.0;
    }

    // Buffer is valid only if all tiles loaded
    this._tileBufferValid = this._pendingTiles === 0;
    this._lastPendingTiles = this._pendingTiles;

    // Blit to main canvas
    ctx.drawImage(this._tileCanvas, 0, 0);
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

  setRadarTileUrl(url) {
    if (this._radarTileUrl !== url) {
      this._radarTileUrl = url;
      if (this.radarEnabled) {
        this._tileBufferValid = false;
        this._dirty = true;
      }
    }
  }

  toggleRadar() {
    this.radarEnabled = !this.radarEnabled;
    this._tileBufferValid = false;
    this._dirty = true;
    return this.radarEnabled;
  }

  toggleSatellite() {
    this.satelliteEnabled = !this.satelliteEnabled;
    this._tileBufferValid = false;
    this._dirty = true;
    return this.satelliteEnabled;
  }
}
