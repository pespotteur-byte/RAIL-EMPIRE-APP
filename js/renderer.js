import { TileMap } from './map.js?v=1778285270';

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
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

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
  }

  render(world, services, engine, depotManager, lineManager, platformManager, voiePointManager) {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    this.tileMap.renderTiles(ctx, w, h);
    this.drawTracks(ctx, world, lineManager);
    const showStations = document.getElementById('toggle-stations')?.checked !== false;
    const showNames = document.getElementById('toggle-station-names')?.checked !== false;
    const showTrains = document.getElementById('toggle-trains')?.checked !== false;
    if (showStations) this.drawStations(ctx, world, platformManager, showNames);
    this.drawDepots(ctx, world, depotManager);
    const showVoiePoints = document.getElementById('toggle-voie-points')?.checked !== false;
    if (showVoiePoints && voiePointManager) {
      this.drawVoieTroncons(ctx, voiePointManager, world);
      this.drawVoiePoints(ctx, voiePointManager);
    }
    // Draw temporary manual tronçon trace
    if (window.game?.ui?._manualTronconWaypoints?.length > 1) {
      this._drawTempTrace(ctx, window.game.ui._manualTronconWaypoints);
    }
    if (showTrains) this.drawServices(ctx, world, services);
  }

  latLonToScreen(lat, lon) {
    return this.tileMap.latLonToPixel(lat, lon);
  }

  drawTracks(ctx, world, lineManager) {
    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

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
        ctx.beginPath();
        const p0 = this.latLonToScreen(track.route[0].lat, track.route[0].lon);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < track.route.length; i++) {
          const p = this.latLonToScreen(track.route[i].lat, track.route[i].lon);
          ctx.lineTo(p.x, p.y);
        }
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
    for (const st of world.stations) {
      const p = this.latLonToScreen(st.lat, st.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      const colors = {
        voyageur: '#fbbf24',
        marchandise: '#06b6d4',
        ite: '#a855f7',
        depot: '#10b981',
        mixed: '#f59e0b',
      };
      const color = colors[st.type] || '#fbbf24';

      ctx.fillStyle = color;
      ctx.beginPath();

      // Scale station size by platform count for large stations
      const baseSize = 5;

      if (st.type === 'ite' || st.type === 'depot') {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else {
        ctx.arc(p.x, p.y, baseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (showNames && this.tileMap.zoomLevel >= 8) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold ${this.tileMap.zoomLevel >= 11 ? 12 : 10}px sans-serif`;
        ctx.fillText(st.name, p.x + baseSize + 4, p.y + 4);

        // Show platform occupancy for stations with multiple platforms at high zoom
        if (platformManager && this.tileMap.zoomLevel >= 10 && st.platforms > 1) {
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
      // Hide trains stopped at a STATION for > 5 game minutes (not trains stopped in line)
      if (svc.train._stoppedSinceGameTime != null && svc.train.stoppedAt && window.game?.timeOfDay != null) {
        let elapsed = window.game.timeOfDay - svc.train._stoppedSinceGameTime;
        if (elapsed < 0) elapsed += 1440;
        if (elapsed > 5) continue;
      }
      // Hide trains truly inactive (waiting, no position)
      if (svc.state === 'waiting' && !svc.train.stoppedAt && !svc.position) continue;

      const p = this.latLonToScreen(svc.position.lat, svc.position.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      // Train markers - same size as stations for visual consistency
      const baseSize = 5;
      const color = svc.state === 'waiting' ? '#475569' : (svc.train.color || '#22d3ee');

      // Outer glow for moving trains (reduced shadowBlur for performance)
      if (svc.state === 'moving') {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
    for (const trc of voiePointManager.getAllTroncons()) {
      if (!trc.route || trc.route.length < 2) {
        // Fallback: draw straight line between endpoints
        const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
        const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
        if (!ptA || !ptB) continue;
        const pa = this.latLonToScreen(ptA.lat, ptA.lon);
        const pb = this.latLonToScreen(ptB.lat, ptB.lon);
        ctx.strokeStyle = trc.occupiedBy ? '#ef4444' : '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        continue;
      }

      // Draw ORM route
      ctx.strokeStyle = trc.occupiedBy ? '#ef4444' : '#64748b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      const p0 = this.latLonToScreen(trc.route[0].lat, trc.route[0].lon);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < trc.route.length; i++) {
        const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
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
