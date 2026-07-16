import { TileMap } from './map.js?v=1784240818';

// LVM-01 — couleurs des trains sur la livemap par catégorie (annexe 2a).
export const LIVEMAP_CATEGORY_COLORS = {
  voyageur: '#3b82f6', // bleu
  fret: '#22c55e',     // vert
  travaux: '#f59e0b',  // orange
  machine: '#a855f7',  // violet — HLP / TM (Section VI)
};

// LVM-01 — icônes de train reproduites à l'identique des annexes 2a (image2-5).
const TRAIN_ICON_SRC = {
  generic: 'img/livemap/train_generic.png',
  voyageur: 'img/livemap/train_voyageur.png',
  fret: 'img/livemap/train_fret.png',
  travaux: 'img/livemap/train_travaux.png',
  machine: 'img/livemap/train_generic.png',
};
const TRAIN_ICON_IMAGES = {};
if (typeof Image !== 'undefined') {
  for (const [k, src] of Object.entries(TRAIN_ICON_SRC)) {
    const img = new Image();
    img.src = src;
    TRAIN_ICON_IMAGES[k] = img;
  }
}

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

    // Update frame projection cache once per render (avoids redundant trig in latLonToScreen)
    this.tileMap._updateFrameCache();

    // Cache toggle element refs (avoid per-frame DOM lookups, re-query if null)
    if (!this._toggleEls || !this._toggleEls.stations) {
      this._toggleEls = {
        stations: document.getElementById('toggle-stations'),
        names: document.getElementById('toggle-station-names'),
        trains: document.getElementById('toggle-trains'),
        voie: document.getElementById('toggle-voie-points'),
        orm: document.getElementById('toggle-orm'),
        radar: document.getElementById('toggle-radar'),
        satellite: document.getElementById('toggle-satellite'),
        clouds: document.getElementById('toggle-clouds'),
      };
      if (this._toggleEls.orm) {
        this._toggleEls.orm.addEventListener('change', () => {
          this.tileMap.railEnabled = this._toggleEls.orm.checked;
          this.tileMap.markDirty();
        });
      }
      if (this._toggleEls.radar) {
        this._toggleEls.radar.addEventListener('change', () => {
          this.tileMap.radarEnabled = this._toggleEls.radar.checked;
          this.tileMap.markDirty();
        });
      }
      if (this._toggleEls.satellite) {
        this._toggleEls.satellite.addEventListener('change', () => {
          this.tileMap.toggleSatellite();
          this._toggleEls.satellite.checked = this.tileMap.satelliteEnabled;
        });
      }
      if (this._toggleEls.clouds) {
        this._toggleEls.clouds.addEventListener('change', () => {
          this.tileMap.cloudEnabled = this._toggleEls.clouds.checked;
          this.tileMap.markDirty();
        });
      }
    }
    const showStations = this._toggleEls.stations?.checked !== false;
    const showNames = this._toggleEls.names?.checked !== false;
    const showTrains = this._toggleEls.trains?.checked !== false;
    const showVoiePoints = this._toggleEls.voie?.checked !== false;

    // Industries toggle
    if (!this._toggleEls.industries) {
      this._toggleEls.industries = document.getElementById('toggle-industries');
    }
    const showIndustries = this._toggleEls.industries?.checked === true;

    // Zones toggle (signal boxes + regulation zones)
    if (!this._toggleEls.zones) {
      this._toggleEls.zones = document.getElementById('toggle-zones');
    }
    const showZones = this._toggleEls.zones?.checked !== false;

    // Draw static layers directly to main ctx (tracks ~3ms, stations ~0.2ms = fast)
    this.drawTracks(ctx, world, lineManager);
    if (showStations) this.drawStations(ctx, world, platformManager, showNames);
    this.drawDepots(ctx, world, depotManager);
    if (showZones) this.drawSignalBoxes(ctx);
    if (showZones) this.drawRegulationZones(ctx);
    if (showVoiePoints && voiePointManager) {
      this.drawVoieTroncons(ctx, voiePointManager, world);
      this.drawVoiePoints(ctx, voiePointManager);
    }

    // Industry markers
    if (showIndustries) {
      this.drawIndustries(ctx);
    }

    // Cloud overlay (canvas-based fallback when tile data is unavailable)
    if (this.tileMap.cloudEnabled && !this.tileMap._cloudTileUrl) {
      this._drawCloudOverlay(ctx, w, h);
    }

    // Dynamic layers always drawn
    if (window.game?.ui?._manualTronconWaypoints?.length > 1) {
      this._drawTempTrace(ctx, window.game.ui._manualTronconWaypoints);
    }
    if (showTrains) this.drawServices(ctx, world, services);
    this.drawSelectedServiceRoute(ctx, world);
    this.drawSignals(ctx, services);
  }

  _drawCloudOverlay(ctx, w, h) {
    const weather = window.game?.weather;
    if (!weather) return;
    const low = weather.cloudLow || 0;
    const mid = weather.cloudMid || 0;
    const high = weather.cloudHigh || 0;
    if (low + mid + high === 0) return;

    // Low clouds: dense, gray-white
    if (low > 0) {
      ctx.fillStyle = `rgba(200,210,220,${low * 0.002})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Mid clouds: lighter, blue-gray
    if (mid > 0) {
      ctx.fillStyle = `rgba(180,195,215,${mid * 0.0015})`;
      ctx.fillRect(0, 0, w, h);
    }
    // High clouds: wispy, very transparent
    if (high > 0) {
      ctx.fillStyle = `rgba(220,225,235,${high * 0.001})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  latLonToScreen(lat, lon) {
    return this.tileMap.latLonToPixel(lat, lon);
  }

  drawTracks(ctx, world, lineManager) {
    const tm = this.tileMap;
    const topLeft = tm ? tm.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight) : null;
    const botRight = tm ? tm.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight) : null;
    const hasVP = topLeft && botRight;
    const vpMinLat = hasVP ? Math.min(topLeft.lat, botRight.lat) - 0.01 : -90;
    const vpMaxLat = hasVP ? Math.max(topLeft.lat, botRight.lat) + 0.01 : 90;
    const vpMinLon = hasVP ? Math.min(topLeft.lon, botRight.lon) - 0.01 : -180;
    const vpMaxLon = hasVP ? Math.max(topLeft.lon, botRight.lon) + 0.01 : 180;

    const zoom = tm?.zoomLevel || 10;
    const pxPerDegLon = tm._frameScale ? (tm._frameScale / 360) : 500;

    for (const track of world.tracks) {
      const stA = world.getStationById(track.stationA);
      const stB = world.getStationById(track.stationB);
      if (!stA || !stB) continue;

      // Use cached bounding box if available
      let tMinLat, tMaxLat, tMinLon, tMaxLon;
      if (track._bbox) {
        tMinLat = track._bbox[0]; tMaxLat = track._bbox[1];
        tMinLon = track._bbox[2]; tMaxLon = track._bbox[3];
      } else {
        tMinLat = Math.min(stA.lat, stB.lat);
        tMaxLat = Math.max(stA.lat, stB.lat);
        tMinLon = Math.min(stA.lon, stB.lon);
        tMaxLon = Math.max(stA.lon, stB.lon);
        track._bbox = [tMinLat, tMaxLat, tMinLon, tMaxLon];
      }
      if (tMaxLat < vpMinLat || tMinLat > vpMaxLat || tMaxLon < vpMinLon || tMinLon > vpMaxLon) continue;

      // Skip tiny tracks that would be sub-pixel at current zoom
      const spanPx = (tMaxLon - tMinLon) * pxPerDegLon;
      const spanPy = (tMaxLat - tMinLat) * pxPerDegLon;
      if (spanPx < 2 && spanPy < 2 && zoom < 10) continue;

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
        // Check if track belongs to a line (skip expensive lookup at very low zoom)
        let lineColor = null;
        if (lineManager && zoom >= 7) {
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
        const len = track.route.length;
        const routeStep = len <= 20 ? 1 :
          zoom >= 15 ? 1 : zoom >= 12 ? Math.max(1, len >> 6) :
          zoom >= 9 ? Math.max(2, len >> 4) : Math.max(4, len >> 3);
        ctx.beginPath();
        // Inline Mercator projection for speed (avoid method call overhead)
        const fScale = tm._frameScale;
        const fCx = tm._frameCx;
        const fCy = tm._frameCy;
        const fHW = tm._frameHalfW;
        const fHH = tm._frameHalfH;
        const DEG2RAD = Math.PI / 180;
        const INV4PI = 1 / (4 * Math.PI);
        const r0 = track.route[0];
        let sinLat = Math.sin(r0.lat * DEG2RAD);
        let sx = ((r0.lon + 180) / 360) * fScale - fCx + fHW;
        let sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
        ctx.moveTo(sx, sy);
        for (let i = routeStep; i < len; i += routeStep) {
          const rp = track.route[i];
          sinLat = Math.sin(rp.lat * DEG2RAD);
          sx = ((rp.lon + 180) / 360) * fScale - fCx + fHW;
          sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
          ctx.lineTo(sx, sy);
        }
        const rl = track.route[len - 1];
        sinLat = Math.sin(rl.lat * DEG2RAD);
        sx = ((rl.lon + 180) / 360) * fScale - fCx + fHW;
        sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) * INV4PI) * fScale - fCy + fHH;
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        const pa = tm.worldToScreenFast(stA.lat, stA.lon);
        const pb = tm.worldToScreenFast(stB.lat, stB.lon);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Annex 6 / LVM — direction arrows + track labels for main tracks at high zoom
      if (zoom >= 13) {
        const route = track.route || [];
        const startLat = route[0]?.lat ?? stA.lat;
        const startLon = route[0]?.lon ?? stA.lon;
        const endLat = route[route.length - 1]?.lat ?? stB.lat;
        const endLon = route[route.length - 1]?.lon ?? stB.lon;
        const start = this.latLonToScreen(startLat, startLon);
        const end = this.latLonToScreen(endLat, endLon);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len > 20) {
          const angle = Math.atan2(dy, dx);
          const mx = (start.x + end.x) / 2;
          const my = (start.y + end.y) / 2;

          // Track label (OSM ref/name/trackRef) at midpoint
          const trkLabel = track.name || track.ref || '';
          if (trkLabel) {
            ctx.save();
            ctx.font = 'bold 9px sans-serif';
            const metrics = ctx.measureText(trkLabel);
            const pad = 2;
            ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
            ctx.fillRect(mx - metrics.width / 2 - pad, my - 20, metrics.width + pad * 2, 14);
            ctx.fillStyle = '#e0e7ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(trkLabel, mx, my - 13);
            ctx.restore();
          }

          // Direction arrow + label
          this._drawArrow(ctx, mx, my, angle, 5, '#e2e8f0');
          ctx.save();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Direction ${stB.name}`, mx + 8, my + 10);
          ctx.restore();
        }
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
          ctx.fillText(`\u26A0 ${label}`, mp.x + 5, mp.y - 5);
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

  drawIndustries(ctx) {
    const ic = window.game?.industrialClients;
    if (!ic) return;

    // Cache locations array (heavy to compute every frame)
    if (!this._indLocs || this._indLocsTick !== (this._frameTick || 0)) {
      this._indLocs = ic.getAllRealLocations();
      this._indLocsTick = this._frameTick || 0;
    }
    const locs = this._indLocs;
    if (!locs || locs.length === 0) return;

    const zoom = this.tileMap?.zoomLevel || 10;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Adaptive: at low zoom, only show every Nth site and skip labels
    const showLabels = zoom >= 9;
    const step = zoom < 7 ? 4 : zoom < 8 ? 2 : 1;
    const dotSize = zoom >= 10 ? 5 : zoom >= 8 ? 4 : 3;

    ctx.textAlign = 'center';
    ctx.font = `${zoom >= 10 ? 9 : 8}px sans-serif`;

    for (let i = 0; i < locs.length; i += step) {
      const loc = locs[i];
      const p = this.latLonToScreen(loc.lat, loc.lon);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;

      // Colored diamond marker
      const color = loc.color || '#94a3b8';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.fillRect(-dotSize / 2, -dotSize / 2, dotSize, dotSize);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-dotSize / 2, -dotSize / 2, dotSize, dotSize);
      ctx.restore();

      // Label at sufficient zoom
      if (showLabels) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        const label = zoom >= 11 ? loc.name : loc.industryName;
        ctx.fillText(label, p.x, p.y - dotSize - 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawSignalBoxes(ctx) {
    const sbs = window.game?.staffManager?.signalBoxes;
    if (!sbs || sbs.length === 0) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    for (const sb of sbs) {
      const p = this.latLonToScreen(sb.lat, sb.lon);
      if (p.x < -40 || p.x > this.logicalWidth + 40) continue;
      // Draw radius circle
      const metersPerPixel = 156543.03 * Math.cos(sb.lat * Math.PI / 180) / Math.pow(2, zoom);
      const radiusPx = (sb.radiusKm * 1000) / metersPerPixel;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Draw icon
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
      // Label
      if (zoom >= 9) {
        ctx.fillStyle = '#c4b5fd';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sb.name, p.x, p.y - 8);
      }
    }
  }

  drawRegulationZones(ctx) {
    const zones = window.game?.staffManager?.zones;
    if (!zones || zones.length === 0) return;
    const zoom = this.tileMap?.zoomLevel || 10;
    for (const z of zones) {
      if (!z.lat || !z.lon) continue;
      const p = this.latLonToScreen(z.lat, z.lon);
      if (p.x < -100 || p.x > this.logicalWidth + 100) continue;
      const metersPerPixel = 156543.03 * Math.cos(z.lat * Math.PI / 180) / Math.pow(2, zoom);
      const radiusPx = ((z.radiusKm || 30) * 1000) / metersPerPixel;
      // Draw radius circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw center marker
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0ea5e9';
      ctx.fill();
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      if (zoom >= 8) {
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.name, p.x, p.y - 10);
      }
    }
  }

  drawServices(ctx, world, services) {
    const zoom = this.tileMap?.zoomLevel || 10;
    // DEP-06 : trains en maintenance absents de la Livemap ET du bandeau train
    services = services.filter(svc => !svc.train?.inMaintenance && !(svc.rame && svc.rame.inMaintenance));
    const len = services.length;
    if (len === 0) return;

    // Viewport bounds for fast lat/lon reject
    let vpMinLat, vpMaxLat, vpMinLon, vpMaxLon;
    if (len > 200 && this.tileMap) {
      const tl = this.tileMap.screenToWorld(0, 0, this.logicalWidth, this.logicalHeight);
      const br = this.tileMap.screenToWorld(this.logicalWidth, this.logicalHeight, this.logicalWidth, this.logicalHeight);
      if (tl && br) {
        vpMinLat = Math.min(tl.lat, br.lat) - 0.1;
        vpMaxLat = Math.max(tl.lat, br.lat) + 0.1;
        vpMinLon = Math.min(tl.lon, br.lon) - 0.1;
        vpMaxLon = Math.max(tl.lon, br.lon) + 0.1;
      }
    }

    const bs = 5;  // baseSize
    const bsH = bs * 0.5;
    const bsW = bs * 0.7;
    const useBatch = len > 1000;
    const showLabels = zoom >= 7 && len < 5000;
    const w = this.logicalWidth, h = this.logicalHeight;

    if (useBatch) {
      // BATCHED RENDERING: dots (fillRect) for massive scale, much faster than path triangles
      const tm = this.tileMap;
      const fScale = tm._frameScale || (256 * Math.pow(2, tm.zoomLevel));
      const fCx = tm._frameCx;
      const fCy = tm._frameCy;
      const fHW = w / 2;
      const fHH = h / 2;
      const DEG2RAD = Math.PI / 180;
      const MAX_VISIBLE = 5000; // cap visible trains for performance
      const dotSize = len > 10000 ? 3 : 4;

      ctx.fillStyle = '#22d3ee';
      let drawn = 0;
      for (let i = 0; i < len && drawn < MAX_VISIBLE; i++) {
        const svc = services[i];
        if (!svc || !svc.position) continue;
        const lat = svc.position.lat, lon = svc.position.lon;
        if (vpMinLat !== undefined) {
          if (lat < vpMinLat || lat > vpMaxLat || lon < vpMinLon || lon > vpMaxLon) continue;
        }
        const sx = ((lon + 180) / 360) * fScale - fCx + fHW;
        if (sx < -30 || sx > w + 30) continue;
        const sinLat = Math.sin(lat * DEG2RAD);
        const sy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * fScale - fCy + fHH;
        if (sy < -30 || sy > h + 30) continue;
        ctx.fillRect(sx - dotSize/2, sy - dotSize/2, dotSize, dotSize);
        drawn++;
      }
      return;
    }

    // NON-BATCHED: detailed rendering for smaller sets
    for (let i = 0; i < len; i++) {
      const svc = services[i];
      if (!svc || !svc.position || !svc.train) continue;
      if (svc.state === 'completed') continue;
      if (svc.state === 'waiting' && !svc.train.stoppedAt) continue;
      if (vpMinLat !== undefined) {
        const lat = svc.position.lat, lon = svc.position.lon;
        if (lat < vpMinLat || lat > vpMaxLat || lon < vpMinLon || lon > vpMaxLon) continue;
      }

      const p = this.latLonToScreen(svc.position.lat, svc.position.lon);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;

      // LVM-01 — 3 déclinaisons couleur par catégorie (annexe 2a).
      const cat = svc.category || svc.train.category || 'voyageur';
      const catColor = LIVEMAP_CATEGORY_COLORS[cat] || svc.train.color || '#22d3ee';
      const color = svc.state === 'waiting' ? '#475569' : catColor;

      // LVM-06 — anneau de sélection autour du train choisi.
      if (window.game?.ui?.selectedService?.id === svc.id) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, bs * 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (svc.state === 'moving') {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, bs * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // LVM-01 — icône directionnelle : flèche orientée vers la cible du train.
      let heading = svc.train?.heading;
      if (heading == null && svc.position) {
        const target = typeof svc.getTargetStation === 'function' ? svc.getTargetStation() : null;
        if (target) {
          const pa = this.latLonToScreen(svc.position.lat, svc.position.lon);
          const pb = this.latLonToScreen(target.lat, target.lon);
          heading = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        }
      }
      if (heading == null) heading = 0;
      this._drawTrainIcon(ctx, p, cat, color, bs, svc.state, heading);

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

      if (showLabels) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${zoom >= 10 ? 11 : 9}px sans-serif`;
        let label = `${Math.round(svc.train.speed)} km/h`;
        if (svc.train.blockedBy) label += ' [BLOQUE]';
        ctx.fillText(label, p.x + bs + 4, p.y - 2);
        ctx.fillStyle = svc.isRescue ? '#ef4444' : (svc.train.delay > 0 ? '#ef4444' : svc.train.delay < 0 ? '#38bdf8' : '#10b981');
        ctx.fillText(svc.isRescue ? `${svc.name} [SECOURS]` : svc.name, p.x + bs + 4, p.y + 10);
        if (svc.train.delay > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`+${svc.train.delay} min`, p.x + bs + 4, p.y + 22);
        } else if (svc.train.delay < 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`- ${Math.abs(svc.train.delay)} min`, p.x + bs + 4, p.y + 22);
        }
      }
    }
  }

  // LVM-06 — tracer le service sélectionné sur la livemap avec ses arrêts.
  drawSelectedServiceRoute(ctx, world) {
    const svc = window.game?.ui?.selectedService;
    if (!svc || !world || !this.tileMap) return;

    const drawRoute = (routes, color) => {
      if (!routes) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      for (const route of routes) {
        if (!route || route.length < 2) continue;
        const step = Math.max(1, Math.floor(route.length / 80));
        ctx.beginPath();
        const p0 = this.latLonToScreen(route[0].lat, route[0].lon);
        ctx.moveTo(p0.x, p0.y);
        for (let i = step; i < route.length; i += step) {
          const p = this.latLonToScreen(route[i].lat, route[i].lon);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        // Player note / Annex 10c : visible dots along the traced route.
        ctx.fillStyle = '#fff';
        for (let i = step; i < route.length; i += step) {
          const p = this.latLonToScreen(route[i].lat, route[i].lon);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    };

    drawRoute(svc.routes, '#22d3ee');
    if (svc.roundTrip) {
      const returnRoutes = svc._returnRoutes || (svc.routes ? svc.routes.slice().reverse().map(r => r ? [...r].reverse() : null) : null);
      drawRoute(returnRoutes, '#c084fc');
    }

    const drawStop = (stop, color) => {
      let lat, lon;
      if (stop.voiePointId && window.game?.voiePointManager) {
        const vp = window.game.voiePointManager.getVoiePointById(stop.voiePointId);
        if (vp) { lat = vp.lat; lon = vp.lon; }
      } else if (stop.stationId) {
        const st = world.getStationById(stop.stationId);
        if (st) { lat = st.lat; lon = st.lon; }
      }
      if (lat == null || lon == null) return;
      const p = this.latLonToScreen(lat, lon);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    for (const s of svc.stops || []) drawStop(s, '#22d3ee');
    if (svc.roundTrip) {
      const returnStops = svc.returnStops?.length ? svc.returnStops : (svc._returnStopsData || (svc.stops ? svc.stops.slice().reverse() : []));
      for (const s of returnStops) drawStop(s, '#c084fc');
    }
  }

  // LVM-01 — icônes de train directionnelles (annexes 2a images 2-5).
  // Utilise les PNG colorés par catégorie ; la pointe de la flèche est orientée
  // dans le sens du mouvement (heading). Fallback polygon si l'image n'est pas chargée.
  _drawTrainIcon(ctx, p, cat, color, bs, state, heading = 0) {
    const key = (TRAIN_ICON_IMAGES[cat] ? cat : 'generic');
    const img = TRAIN_ICON_IMAGES[key];
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(p.x, p.y);
      // L'image a une flèche vers le bas (sens +y) ; on la tourne pour qu'elle
      // pointe dans le sens du heading calculé par atan2(dy,dx) en canvas.
      ctx.rotate(Math.PI / 2 - heading);
      if (state === 'waiting') {
        ctx.filter = 'grayscale(100%) brightness(0.55)';
      }
      const size = bs * 5;
      const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    // Fallback arrow
    const len = bs * 5;
    const wid = bs * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    if (state === 'waiting') {
      ctx.filter = 'grayscale(100%) brightness(0.55)';
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(-len * 0.35, -wid);
    ctx.lineTo(-len * 0.2, -wid * 0.4);
    ctx.lineTo(-len * 0.55, 0);
    ctx.lineTo(-len * 0.2, wid * 0.4);
    ctx.lineTo(-len * 0.35, wid);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, bs * 0.25);
    ctx.stroke();
    ctx.restore();
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
      if (!svc.position || svc.state === 'waiting' || svc.state === 'completed') continue;
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
    const visibleTrcs = [];

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
        visibleTrcs.push(trc);
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
      visibleTrcs.push(trc);
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

    // Player note / Annex 6 — small circle on each traced point (50 m vertex) at high zoom.
    if (zoom >= 12 && visibleTrcs.length > 0) {
      ctx.fillStyle = zoom >= 14 ? '#cbd5e1' : '#64748b';
      ctx.beginPath();
      for (const trc of visibleTrcs) {
        if (!trc.route || trc.route.length < 2) continue;
        for (let i = step; i < trc.route.length - 1; i += step) {
          const p = this.latLonToScreen(trc.route[i].lat, trc.route[i].lon);
          ctx.moveTo(p.x + 1.5, p.y);
          ctx.arc(p.x, p.y, zoom >= 14 ? 1.5 : 1, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }

    // Annex 6 — direction arrows + PA/PB markers on user tronçons at high zoom
    if (zoom >= 14 && visibleTrcs.length > 0) {
      ctx.save();
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const trc of visibleTrcs) {
        const ptA = this._getTronconEndpoint(trc.pointA, voiePointManager, world);
        const ptB = this._getTronconEndpoint(trc.pointB, voiePointManager, world);
        if (!ptA || !ptB) continue;
        const start = this.latLonToScreen(ptA.lat, ptA.lon);
        const end = this.latLonToScreen(ptB.lat, ptB.lon);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len < 12) continue;
        const angle = Math.atan2(dy, dx);
        const perp = angle + Math.PI / 2;
        const off = 10;
        const ox = Math.cos(perp) * off;
        const oy = Math.sin(perp) * off;
        // PA / PB labels
        ctx.fillText('PA', start.x + ox, start.y + oy);
        ctx.fillText('PB', end.x + ox, end.y + oy);
        // Direction arrow + labels at midpoint
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        this._drawArrow(ctx, midX, midY, angle, 5, '#e2e8f0');

        // Track label (OSM ref/name/trackRef)
        const trkLabel = trc.trackRef || trc.ref || trc.name || '';
        if (trkLabel) {
          ctx.save();
          ctx.font = 'bold 8px sans-serif';
          const metrics = ctx.measureText(trkLabel);
          const pad = 2;
          ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
          ctx.fillRect(midX - metrics.width / 2 - pad, midY - 18, metrics.width + pad * 2, 12);
          ctx.fillStyle = '#e0e7ff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(trkLabel, midX, midY - 12);
          ctx.restore();
        }

        // Direction label
        const destName = ptB.stationId ? (world.getStationById(ptB.stationId)?.name || 'PB') : 'PB';
        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Direction ${destName}`, midX + 6, midY + 8);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  _drawArrow(ctx, x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

        // Annex 7 — label signal aspect at very high zoom
        if (zoom >= 15) {
          const aspectLabel = color === '#22c55e' ? 'voie libre' : color === '#eab308' ? 'avertissement' : 'carré';
          ctx.fillStyle = color;
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(aspectLabel, screenPos.x, screenPos.y - signalRadius - 2);
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

  // Hit-test an industry marker (uses the per-frame cached locations). Returns
  // the nearest industry loc within the hit radius, or null.
  getIndustryAt(x, y) {
    const locs = this._indLocs;
    if (!locs || locs.length === 0) return null;
    const hitR = 'ontouchstart' in window ? 22 : 12;
    let best = null, bestD = hitR;
    for (const loc of locs) {
      const p = this.latLonToScreen(loc.lat, loc.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = loc; }
    }
    return best;
  }
}
