import { TileMap } from './map.js?v=1779103051';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileMap = new TileMap();
    this.hoveredStation = null;
    this.logicalWidth = 0;
    this.logicalHeight = 0;
    this._minimapCache = null;
    this._lastMinimapDraw = 0;
    this._minimapInterval = 50; // ~20 FPS throttle
    // Static layer offscreen canvas (tracks, stations, depots)
    this._staticCanvas = null;
    this._staticCtx = null;
    this._staticValid = false;
    this._lastStaticZoom = 0;
    this._lastStaticCLat = 0;
    this._lastStaticCLon = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  invalidateStatic() { this._staticValid = false; }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.logicalWidth = rect.width;
    this.logicalHeight = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tileMap.viewportWidth = rect.width;
    this.tileMap.viewportHeight = rect.height;
    this._staticValid = false;
    this.tileMap.markDirty();
  }

  render(world, services, engine, depotManager, lineManager, platformManager, voiePointManager) {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    this.tileMap.renderTiles(ctx, w, h);

    // Static layer: tracks + stations + depots — only redraw when view changes
    const viewChanged = this.tileMap.zoomLevel !== this._lastStaticZoom ||
      this.tileMap.centerLat !== this._lastStaticCLat ||
      this.tileMap.centerLon !== this._lastStaticCLon;
    if (viewChanged) this._staticValid = false;

    // Cache toggle element refs (avoid per-frame DOM lookups, re-query if null)
    if (!this._toggleEls || !this._toggleEls.stations) {
      this._toggleEls = {
        stations: document.getElementById('toggle-stations'),
        names: document.getElementById('toggle-station-names'),
        trains: document.getElementById('toggle-trains'),
        voie: document.getElementById('toggle-voie-points'),
        radar: document.getElementById('toggle-radar'),
        satellite: document.getElementById('toggle-satellite'),
      };
      // Wire radar toggle to map
      if (this._toggleEls.radar) {
        this._toggleEls.radar.addEventListener('change', () => {
          this.map.radarEnabled = this._toggleEls.radar.checked;
          this.map.markDirty();
        });
      }
      // Wire satellite toggle to map
      if (this._toggleEls.satellite) {
        this._toggleEls.satellite.addEventListener('change', () => {
          this.map.toggleSatellite();
          this._toggleEls.satellite.checked = this.map.satelliteEnabled;
        });
      }
    }
    const showStations = this._toggleEls.stations?.checked !== false;
    const showNames = this._toggleEls.names?.checked !== false;
    const showTrains = this._toggleEls.trains?.checked !== false;
    const showVoiePoints = this._toggleEls.voie?.checked !== false;

    if (!this._staticValid) {
      if (!this._staticCanvas || this._staticCanvas.width !== this.canvas.width || this._staticCanvas.height !== this.canvas.height) {
        this._staticCanvas = document.createElement('canvas');
        this._staticCanvas.width = this.canvas.width;
        this._staticCanvas.height = this.canvas.height;
        this._staticCtx = this._staticCanvas.getContext('2d');
      }
      const sctx = this._staticCtx;
      const dpr = window.devicePixelRatio || 1;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, w, h);
      this.drawTracks(sctx, world, lineManager);
      if (showStations) this.drawStations(sctx, world, platformManager, showNames);
      this.drawDepots(sctx, world, depotManager);
      if (showVoiePoints && voiePointManager) {
        this.drawVoieTroncons(sctx, voiePointManager, world);
        this.drawVoiePoints(sctx, voiePointManager);
      }
      this._staticValid = true;
      this._lastStaticZoom = this.tileMap.zoomLevel;
      this._lastStaticCLat = this.tileMap.centerLat;
      this._lastStaticCLon = this.tileMap.centerLon;
    }
    // Blit static layer — reset transform to avoid double DPR scaling
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this._staticCanvas, 0, 0);
    ctx.restore();

    // Dynamic layers always drawn
    if (window.game?.ui?._manualTronconWaypoints?.length > 1) {
      this._drawTempTrace(ctx, window.game.ui._manualTronconWaypoints);
    }
    if (showTrains) this.drawServices(ctx, world, services);
  }

  latLonToScreen(lat, lon) {
    return this.tileMap.latLonToPixel(lat, lon);
  }

  drawTracks(ctx, world, lineManager) {
    // Viewport culling bounds
    const topLeft = this.tileMap ? this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight) : null;
    const botRight = this.tileMap ? this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight) : null;
    const hasVP = topLeft && botRight;
    const vpMinLat = hasVP ? Math.min(topLeft.lat, botRight.lat) - 0.01 : -90;
    const vpMaxLat = hasVP ? Math.max(topLeft.lat, botRight.lat) + 0.01 : 90;
    const vpMinLon = hasVP ? Math.min(topLeft.lon, botRight.lon) - 0.01 : -180;
    const vpMaxLon = hasVP ? Math.max(topLeft.lon, botRight.lon) + 0.01 : 180;

    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

      // Viewport cull
      const tMinLat = Math.min(stA.lat, stB.lat);
      const tMaxLat = Math.max(stA.lat, stB.lat);
      const tMinLon = Math.min(stA.lon, stB.lon);
      const tMaxLon = Math.max(stA.lon, stB.lon);
      if (tMaxLat < vpMinLat || tMinLat > vpMaxLat || tMaxLon < vpMinLon || tMinLon > vpMaxLon) continue;

      // Determine track color: incidents/works override, then line color, then speed-based
      let trackColor, trackWidth;
      const hasInterruption = (track.worksActive && track.worksImpact === 'stop') ||
                              (track.incidentActive && track.incidentEffect === 'stop');
      const hasSlowdown = (track.worksActive && track.worksImpact !== 'stop') ||
                          (track.incidentActive && track.incidentEffect === 'slow');

      if (hasInterruption) {
        trackColor = track.worksActive ? '#c2410c' : '#7f1d1d';
        trackWidth = 4;
      } else if (hasSlowdown) {
        trackColor = track.worksActive ? '#c2410c' : '#facc15';
        trackWidth = 3.5;
      } else {
        // Check if track belongs to a line
        let lineColor = null;
        if (lineManager) {
          const linesOnTrack = lineManager.getLinesForTrack(track.id);
          if (linesOnTrack.length > 0) {
            lineColor = linesOnTrack[0].color;
          }
        }
        if (lineColor) {
          trackColor = lineColor;
          trackWidth = 2.5;
        } else {
          trackColor = track.maxSpeed >= 250 ? '#3b82f6' :
                       track.maxSpeed >= 160 ? '#f59e0b' : '#64748b';
          trackWidth = track.maxSpeed >= 250 ? 2.5 : 1.5;
        }
      }

      ctx.strokeStyle = trackColor;
      ctx.lineWidth = trackWidth;

      if (track.maxSpeed < 160 && !hasInterruption && !hasSlowdown) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }

      if (track.route && track.route.length > 1) {
        // LOD: skip points at lower zoom to reduce draw calls
        const zoom = this.tileMap?.zoomLevel || 10;
        const routeStep = track.route.length > 50 ? (zoom >= 14 ? 1 : zoom >= 11 ? 2 : zoom >= 8 ? 4 : 8) : 1;
        ctx.beginPath();
        const p0 = this.latLonToScreen(track.route[0].lat, track.route[0].lon);
        ctx.moveTo(p0.x, p0.y);
        for (let i = routeStep; i < track.route.length; i += routeStep) {
          const p = this.latLonToScreen(track.route[i].lat, track.route[i].lon);
          ctx.lineTo(p.x, p.y);
        }
        // Always draw last point
        const pLast = track.route[track.route.length - 1];
        const pEnd = this.latLonToScreen(pLast.lat, pLast.lon);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();
      } else {
        const pa = this.latLonToScreen(stA.lat, stA.lon);
        const pb = this.latLonToScreen(stB.lat, stB.lon);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Draw incident/works label on track at midpoint
      if ((hasInterruption || hasSlowdown) && this.tileMap.zoomLevel >= 8) {
        const midA = stA, midB = stB;
        const mp = this.latLonToScreen((midA.lat + midB.lat) / 2, (midA.lon + midB.lon) / 2);
        const label = track.incidentActive ? (track.incidentName || 'Incident') :
                      track.worksActive ? 'Travaux' : '';
        if (label) {
          ctx.fillStyle = hasInterruption ? (track.worksActive ? '#c2410c' : '#7f1d1d') : '#facc15';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`⚠ ${label}`, mp.x + 5, mp.y - 5);
        }
      }
    }
    ctx.setLineDash([]);
  }

  drawStations(ctx, world, platformManager, showNames = true) {
    const stColors = { voyageur: '#fbbf24', marchandise: '#06b6d4', ite: '#a855f7', depot: '#10b981', mixed: '#f59e0b' };
    const zoom = this.tileMap.zoomLevel;
    const fontSize = zoom >= 11 ? 12 : 10;
    for (const st of world.stations) {
      const p = this.latLonToScreen(st.lat, st.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      const color = st.closed ? '#6b7280' : (stColors[st.type] || '#fbbf24');

      ctx.fillStyle = color;
      ctx.beginPath();

      const baseSize = 5;

      if (st.closed) {
        // Closed station: X shape
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.moveTo(p.x - 4, p.y - 4); ctx.lineTo(p.x + 4, p.y + 4);
        ctx.moveTo(p.x + 4, p.y - 4); ctx.lineTo(p.x - 4, p.y + 4);
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (st.type === 'ite' || st.type === 'depot') {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else {
        ctx.arc(p.x, p.y, baseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (showNames && zoom >= 8) {
        ctx.fillStyle = st.closed ? '#6b7280' : '#e2e8f0';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(st.closed ? `${st.name} (Fermee)` : st.name, p.x + baseSize + 4, p.y + 4);

        // Show platform occupancy for stations with multiple platforms at high zoom
        if (platformManager && zoom >= 10 && st.platforms > 1) {
          const status = platformManager.getStatus(st.id);
          if (status.total > 0) {
            const label = `${status.used}/${status.total}`;
            ctx.font = '9px sans-serif';
            ctx.fillStyle = status.used >= status.total ? '#ef4444' : status.used > 0 ? '#f59e0b' : '#64748b';
            ctx.fillText(`[${label}]`, p.x + baseSize + 4, p.y + 14);
          }
        }
      }
    }
  }

  drawDepots(ctx, world, depotManager) {
    if (!depotManager) return;
    for (const depot of depotManager.getAll()) {
      const station = world.getStationById(depot.stationId);
      if (!station) continue;
      const p = this.latLonToScreen(station.lat, station.lon);
      if (p.x < -20 || p.x > this.logicalWidth + 20) continue;

      ctx.fillStyle = depot.type === 'depot' ? '#a855f7' : '#06b6d4';
      ctx.fillRect(p.x - 5, p.y + 8, 10, 6);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(p.x - 5, p.y + 8, 10, 6);
    }
  }

  drawServices(ctx, world, services) {
    for (const svc of services) {
      if (!svc || !svc.position || !svc.train) continue;
      if (typeof svc.position.lat !== 'number' || typeof svc.position.lon !== 'number') continue;
      if (isNaN(svc.position.lat) || isNaN(svc.position.lon)) continue;
      // Hide trains that have completed their service and are just waiting
      if (svc.state === 'waiting' && svc.completed) continue;
      // Hide trains truly inactive (waiting with no position set)
      if (svc.state === 'waiting' && !svc.position) continue;

      const p = this.latLonToScreen(svc.position.lat, svc.position.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      // Train markers - same size as stations for visual consistency
      const baseSize = 5;
      const color = svc.state === 'waiting' ? '#475569' : (svc.train.color || '#22d3ee');

      // Moving train indicator (no shadowBlur — too slow on Firefox)
      if (svc.state === 'moving') {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseSize * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Train triangle marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - baseSize);
      ctx.lineTo(p.x + baseSize * 0.7, p.y + baseSize * 0.5);
      ctx.lineTo(p.x - baseSize * 0.7, p.y + baseSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // S9: Train images removed from livemap per user request

      if (svc.train.breakdown) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (svc.train.blockedBy) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(p.x - 10, p.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Show labels at zoom >= 7 (not just 10) for better visibility
      if (this.tileMap.zoomLevel >= 7) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.tileMap.zoomLevel >= 10 ? 11 : 9}px sans-serif`;
        let label = `${Math.round(svc.train.speed)} km/h`;
        if (svc.train.blockedBy) label += ' [BLOQUE]';
        ctx.fillText(label, p.x + baseSize + 4, p.y - 2);
        ctx.fillStyle = svc.isRescue ? '#ef4444' : (svc.train.delay > 0 ? '#ef4444' : svc.train.delay < 0 ? '#38bdf8' : '#10b981');
        ctx.fillText(svc.isRescue ? `${svc.name} [SECOURS]` : svc.name, p.x + baseSize + 4, p.y + 10);
        if (svc.train.delay > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`+${svc.train.delay} min`, p.x + baseSize + 4, p.y + 22);
        } else if (svc.train.delay < 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`- ${Math.abs(svc.train.delay)} min`, p.x + baseSize + 4, p.y + 22);
        }
      }
    }
  }

  drawMinimap(ctx, w, h, world, services) {
    const now = performance.now();
    // Throttle minimap rendering to ~20 FPS
    if (now - this._lastMinimapDraw < this._minimapInterval) {
      // Draw cached minimap if available
      if (this._minimapCache) {
        ctx.putImageData(this._minimapCache.data, this._minimapCache.x, this._minimapCache.y);
      }
      return;
    }
    this._lastMinimapDraw = now;

    const mw = 150, mh = 110;
    const mx = w - mw - 8, my = 8;

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#1e3a5f';
    ctx.strokeRect(mx, my, mw, mh);

    if (world.stations.length === 0) return;

    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const st of world.stations) {
      minLat = Math.min(minLat, st.lat);
      maxLat = Math.max(maxLat, st.lat);
      minLon = Math.min(minLon, st.lon);
      maxLon = Math.max(maxLon, st.lon);
    }
    const padLat = (maxLat - minLat) * 0.15 + 0.5;
    const padLon = (maxLon - minLon) * 0.15 + 0.5;
    minLat -= padLat; maxLat += padLat;
    minLon -= padLon; maxLon += padLon;

    const projMini = (lat, lon) => ({
      x: mx + ((lon - minLon) / (maxLon - minLon)) * mw,
      y: my + ((maxLat - lat) / (maxLat - minLat)) * mh,
    });

    // Simplified tracks (no labels)
    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;
      const pa = projMini(stA.lat, stA.lon);
      const pb = projMini(stB.lat, stB.lon);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Simplified station dots (no labels)
    for (const st of world.stations) {
      const p = projMini(st.lat, st.lon);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active train dots only (hide if stopped at station > 5 game min)
    for (const svc of services) {
      if (!svc.position || svc.state === 'waiting') continue;
      if (svc.train?._stoppedSinceGameTime != null && svc.train.stoppedAt && window.game?.timeOfDay != null) {
        let el = window.game.timeOfDay - svc.train._stoppedSinceGameTime;
        if (el < 0) el += 1440;
        if (el > 5) continue;
      }
      const p = projMini(svc.position.lat, svc.position.lon);
      ctx.fillStyle = svc.train.color || '#22d3ee';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cache the minimap region
    try {
      const dpr = window.devicePixelRatio || 1;
      this._minimapCache = {
        data: ctx.getImageData(mx * dpr, my * dpr, mw * dpr, mh * dpr),
        x: mx * dpr,
        y: my * dpr,
      };
    } catch (e) { /* security restriction on getImageData */ }
  }

  // S9: Cache train images for map rendering (no per-frame resizing)
  _getTrainImage(svc) {
    if (!this._trainImageCache) this._trainImageCache = new Map();
    const cacheKey = svc.id;
    if (this._trainImageCache.has(cacheKey)) return this._trainImageCache.get(cacheKey);

    // Get first element with image data
    const el = svc.rame?.elementDetails?.find(e => e.imageData);
    if (!el?.imageData) { this._trainImageCache.set(cacheKey, null); return null; }

    const img = new Image();
    img.src = el.imageData;
    this._trainImageCache.set(cacheKey, img);
    return img;
  }

  drawVoiePoints(ctx, voiePointManager) {
    for (const vp of voiePointManager.getAll()) {
      const p = this.latLonToScreen(vp.lat, vp.lon);
      if (p.x < -20 || p.x > this.logicalWidth + 20 || p.y < -20 || p.y > this.logicalHeight + 20) continue;

      const isStationVP = !!vp.stationId;
      const isOccupied = !!vp.occupiedBy;
      const isLinePoint = !!vp.linePoint;
      // Line points only visible at high zoom
      if (isLinePoint && this.tileMap.zoomLevel < 11) continue;
      const size = isStationVP ? 3 : (isLinePoint ? 1.5 : 2.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = isOccupied ? '#ef4444' : (isStationVP ? '#1e40af' : (isLinePoint ? '#334155' : '#0f172a'));
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = isLinePoint ? '#64748b' : '#ffffff';
      ctx.lineWidth = isLinePoint ? 0.8 : 1.5;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      // Voie label at higher zoom (not for line points)
      if (!isLinePoint && this.tileMap.zoomLevel >= 10) {
        ctx.fillStyle = isOccupied ? '#ef4444' : '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`Voie ${vp.voie}`, p.x + 8, p.y + 3);
      }
    }
  }

  drawVoieTroncons(ctx, voiePointManager, world) {
    // Viewport bounds for culling
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    const topLeft = this.tileMap ? this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight) : null;
    const botRight = this.tileMap ? this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight) : null;
    const hasViewport = topLeft && botRight;
    const vpMinLat = hasViewport ? Math.min(topLeft.lat, botRight.lat) - 0.005 : -90;
    const vpMaxLat = hasViewport ? Math.max(topLeft.lat, botRight.lat) + 0.005 : 90;
    const vpMinLon = hasViewport ? Math.min(topLeft.lon, botRight.lon) - 0.005 : -180;
    const vpMaxLon = hasViewport ? Math.max(topLeft.lon, botRight.lon) + 0.005 : 180;

    // Batch troncons by color (occupied vs free) for fewer state changes
    const freeTrcs = [];
    const occupiedTrcs = [];

    for (const trc of voiePointManager.getAllTroncons()) {
      if (!trc.route || trc.route.length < 2) {
        const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
        const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
        if (!ptA || !ptB) continue;
        // Viewport cull
        const minLat = Math.min(ptA.lat, ptB.lat);
        const maxLat = Math.max(ptA.lat, ptB.lat);
        const minLon = Math.min(ptA.lon, ptB.lon);
        const maxLon = Math.max(ptA.lon, ptB.lon);
        if (maxLat < vpMinLat || minLat > vpMaxLat || maxLon < vpMinLon || minLon > vpMaxLon) continue;
        (trc.occupiedBy ? occupiedTrcs : freeTrcs).push(trc);
        continue;
      }
      // Viewport cull using first/last route points
      const rF = trc.route[0], rL = trc.route[trc.route.length - 1];
      const minLat = Math.min(rF.lat, rL.lat);
      const maxLat = Math.max(rF.lat, rL.lat);
      const minLon = Math.min(rF.lon, rL.lon);
      const maxLon = Math.max(rF.lon, rL.lon);
      if (maxLat < vpMinLat || minLat > vpMaxLat || maxLon < vpMinLon || minLon > vpMaxLon) continue;
      (trc.occupiedBy ? occupiedTrcs : freeTrcs).push(trc);
    }

    // Route simplification step based on zoom
    const zoom = this.tileMap?.zoomLevel || 10;
    const step = zoom >= 14 ? 1 : zoom >= 11 ? 2 : 4;

    // Draw free tronçons (single batch)
    if (freeTrcs.length > 0) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const trc of freeTrcs) {
        if (!trc.route || trc.route.length < 2) {
          const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
          const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
          const pa = this.latLonToScreen(ptA.lat, ptA.lon);
          const pb = this.latLonToScreen(ptB.lat, ptB.lon);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        } else {
          const p0 = this.latLonToScreen(trc.route[0].lat, trc.route[0].lon);
          ctx.moveTo(p0.x, p0.y);
          for (let i = step; i < trc.route.length; i += step) {
            const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
            ctx.lineTo(p.x, p.y);
          }
          const pL = trc.route[trc.route.length - 1];
          const pEnd = this.latLonToScreen(pL.lat, pL.lon);
          ctx.lineTo(pEnd.x, pEnd.y);
        }
      }
      ctx.stroke();
    }

    // Draw occupied tronçons (red, single batch)
    if (occupiedTrcs.length > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const trc of occupiedTrcs) {
        if (!trc.route || trc.route.length < 2) {
          const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
          const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
          const pa = this.latLonToScreen(ptA.lat, ptA.lon);
          const pb = this.latLonToScreen(ptB.lat, ptB.lon);
          ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        } else {
          const p0 = this.latLonToScreen(trc.route[0].lat, trc.route[0].lon);
          ctx.moveTo(p0.x, p0.y);
          for (let i = step; i < trc.route.length; i += step) {
            const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
            ctx.lineTo(p.x, p.y);
          }
          const pL = trc.route[trc.route.length - 1];
          const pEnd = this.latLonToScreen(pL.lat, pL.lon);
          ctx.lineTo(pEnd.x, pEnd.y);
        }
      }
      ctx.stroke();
    }
  }

  /**
   * Draw signal lights at canton boundaries for active services.
   * Green = clear, Yellow = approach (next canton occupied), Red = stop.
   */
  drawSignals(ctx, services) {
    const zoom = this.tileMap.zoomLevel;
    if (zoom < 12) return; // Only show signals at high zoom

    // Viewport bounds for culling
    const topLeft = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
    const botRight = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
    if (!topLeft || !botRight) return;
    const vpMinLat = Math.min(topLeft.lat, botRight.lat) - 0.005;
    const vpMaxLat = Math.max(topLeft.lat, botRight.lat) + 0.005;
    const vpMinLon = Math.min(topLeft.lon, botRight.lon) - 0.005;
    const vpMaxLon = Math.max(topLeft.lon, botRight.lon) + 0.005;

    const cantonMgr = window.game?.cantonManager;
    if (!cantonMgr) return;

    const drawnSignals = new Set();
    const signalRadius = zoom >= 15 ? 5 : zoom >= 13 ? 4 : 3;

    // Collect all signal positions from active services' canton assignments
    for (const svc of services) {
      if (!svc._cantonAssignments || !svc.active || svc.isRescue) continue;
      const route = svc._state?.cachedRoute;
      if (!route || route.length < 2) continue;

      for (const assignment of svc._cantonAssignments) {
        const endIdx = assignment.endIndex;
        if (endIdx >= route.length) continue;

        const pt = route[endIdx];
        if (!pt || pt.lat < vpMinLat || pt.lat > vpMaxLat || pt.lon < vpMinLon || pt.lon > vpMaxLon) continue;

        const signalKey = `${pt.lat.toFixed(5)},${pt.lon.toFixed(5)}`;
        if (drawnSignals.has(signalKey)) continue;
        drawnSignals.add(signalKey);

        // Determine signal aspect
        const canton = cantonMgr.cantons.get(assignment.cantonId);
        let color = '#22c55e'; // green (clear)

        if (canton) {
          if (canton.occupiedBy) {
            color = '#ef4444'; // red (occupied)
          } else if (canton.reservedBy) {
            color = '#eab308'; // yellow (reserved/approach)
          }
        }

        const screenPos = this.latLonToScreen(pt.lat, pt.lon);

        // Signal post (small vertical line)
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y + signalRadius);
        ctx.lineTo(screenPos.x, screenPos.y + signalRadius + 6);
        ctx.stroke();

        // Signal head (filled circle with glow)
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, signalRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glow effect for red/yellow signals
        if (color !== '#22c55e') {
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, signalRadius + 3, 0, Math.PI * 2);
          ctx.fillStyle = color === '#ef4444' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)';
          ctx.fill();
        }
      }
    }
  }

  _getTronconEndpoint(pointId, voiePointManager, world) {
    // Could be a voie point or a station
    const vp = voiePointManager.getVoiePointById(pointId);
    if (vp) return { lat: vp.lat, lon: vp.lon };
    const st = world.getStationById(pointId);
    if (st) return { lat: st.lat, lon: st.lon };
    return null;
  }

  getVoiePointAt(x, y, voiePoints) {
    const hitR = 'ontouchstart' in window ? 25 : 15;
    for (const vp of voiePoints) {
      const p = this.latLonToScreen(vp.lat, vp.lon);
      if (Math.hypot(p.x - x, p.y - y) < hitR) return vp;
    }
    return null;
  }

  _drawTempTrace(ctx, waypoints) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const p0 = this.latLonToScreen(waypoints[0].lat, waypoints[0].lon);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < waypoints.length; i++) {
      const p = this.latLonToScreen(waypoints[i].lat, waypoints[i].lon);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Draw dots at each waypoint
    for (const wp of waypoints) {
      const p = this.latLonToScreen(wp.lat, wp.lon);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getStationAt(x, y, stations) {
    const hitR = 'ontouchstart' in window ? 25 : 15;
    for (const st of stations) {
      const p = this.latLonToScreen(st.lat, st.lon);
      if (Math.hypot(p.x - x, p.y - y) < hitR) return st;
    }
    return null;
  }
}
