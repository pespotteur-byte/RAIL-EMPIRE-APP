import { TileMap } from './map.js?v=1777581315';

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

  render(world, services, engine, depotManager) {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    this.tileMap.renderTiles(ctx, w, h);
    this.drawTracks(ctx, world);
    this.drawStations(ctx, world);
    this.drawDepots(ctx, world, depotManager);
    this.drawServices(ctx, world, services);
    this.drawMinimap(ctx, w, h, world, services);
  }

  latLonToScreen(lat, lon) {
    return this.tileMap.latLonToPixel(lat, lon);
  }

  drawTracks(ctx, world) {
    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

      // Determine track color: incidents/works override normal colors
      let trackColor, trackWidth;
      const hasInterruption = (track.worksActive && track.worksImpact === 'stop') ||
                              (track.incidentActive && track.incidentEffect === 'stop');
      const hasSlowdown = (track.worksActive && track.worksImpact !== 'stop') ||
                          (track.incidentActive && track.incidentEffect === 'slow');

      if (hasInterruption) {
        trackColor = '#7B1E1E'; // Bordeaux for interruptions
        trackWidth = 4;
      } else if (hasSlowdown) {
        trackColor = '#FFE135'; // Banana yellow for slowdowns
        trackWidth = 3.5;
      } else {
        trackColor = track.maxSpeed >= 250 ? '#3b82f6' :
                     track.maxSpeed >= 160 ? '#f59e0b' : '#64748b';
        trackWidth = track.maxSpeed >= 250 ? 2.5 : 1.5;
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
          ctx.fillStyle = hasInterruption ? '#7B1E1E' : '#FFE135';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`⚠ ${label}`, mp.x + 5, mp.y - 5);
        }
      }
    }
    ctx.setLineDash([]);
  }

  drawStations(ctx, world) {
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

      if (st.type === 'ite' || st.type === 'depot') {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else {
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (this.tileMap.zoomLevel >= 8) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold ${this.tileMap.zoomLevel >= 11 ? 12 : 10}px sans-serif`;
        ctx.fillText(st.name, p.x + 8, p.y + 4);
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
      if (!svc.position) continue;
      // Only render active trains (moving or stopped at station)
      if (svc.state === 'waiting' && svc.train.speed === 0 && !svc.train.stoppedAt) continue;

      const p = this.latLonToScreen(svc.position.lat, svc.position.lon);
      if (p.x < -30 || p.x > this.logicalWidth + 30 || p.y < -30 || p.y > this.logicalHeight + 30) continue;

      // Bigger train markers for visibility at all zoom levels
      const baseSize = svc.state === 'waiting' ? 8 : 12;
      const color = svc.state === 'waiting' ? '#475569' : (svc.train.color || '#22d3ee');

      // Outer glow for moving trains
      if (svc.state === 'moving') {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
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
        ctx.fillStyle = svc.train.delay > 0 ? '#ef4444' : '#10b981';
        ctx.fillText(svc.name, p.x + baseSize + 4, p.y + 10);
        if (svc.train.delay > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`+${svc.train.delay} min`, p.x + baseSize + 4, p.y + 22);
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

    // Active train dots only
    for (const svc of services) {
      if (!svc.position || svc.state === 'waiting') continue;
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

  getStationAt(x, y, stations) {
    for (const st of stations) {
      const p = this.latLonToScreen(st.lat, st.lon);
      if (Math.hypot(p.x - x, p.y - y) < 15) return st;
    }
    return null;
  }
}
