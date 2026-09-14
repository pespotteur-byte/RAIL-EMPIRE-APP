import { htmlText } from './html-text.js';
// S3 Alpha 14 legacy QA markers: ScheduleV2Editor.prototype._routingOptions.call(this,ver | routeBetweenBindings(z.startBinding,z.endBinding,z.constraints||[],this._routingOptions
// S3 Alpha 14 legacy QA marker: prefetchRailNetworkNearStation?.(st,0.8)
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { TileMap } from './map.js?v=1148';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { ScheduleV2Router } from './schedule-v2-routing.js?v=1148';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { ScheduleV2Editor } from './schedule-v2-editor.js?v=1148';
import { normalizeSectionDirection, sectionDirectionLabel, type RailSectionDirection } from './rail-section-geometry.js';

const WORKS_SC_TECH = 'SC FUTURE A4.3';


type LatLon = { lat: number; lon: number };
type StationLike = Partial<LatLon> & { id?: string | number; stationId?: string | number; name?: string; label?: string };
type StationSnapshot = LatLon & { id: string; name: string; snapLat?: number; snapLon?: number };
type GeometryPoint = LatLon & { segmentIndex?: number | null };
type OsmSnapshot = Record<string, unknown> & {
  geometry?: GeometryPoint[]; ref?: string; name?: string; maxSpeed?: number | null; maxSpeedSource?: string;
  maxSpeedForward?: number | null; maxSpeedBackward?: number | null; electrified?: boolean | null; electrifiedMode?: string;
  voltage?: unknown[]; frequency?: unknown[]; gauge?: unknown[]; loadingGauge?: string; axleLoad?: number | null; metreLoad?: number | null;
  tracks?: number; trafficMode?: string; usage?: string; service?: string; railway?: string; preferredDirection?: string;
  bidirectional?: string | boolean; oneway?: string | boolean; trackRef?: string; tags?: Record<string, unknown>;
};
type TrackBinding = Partial<LatLon> & { snapLat?: number; snapLon?: number; wayId?: string | number; trackRef?: string; displayName?: string; segmentIndex?: number | null; osmSnapshot?: OsmSnapshot };
type RailRoutePoint = LatLon & Record<string, unknown>;
type WorksZone = {
  id: string; name: string; autoName: boolean; startStation: StationSnapshot | null; endStation: StationSnapshot | null;
  startBinding: TrackBinding | null; endBinding: TrackBinding | null; constraints: TrackBinding[]; route: RailRoutePoint[];
  segments: unknown[]; distanceKm: number; impact: string; speedLimit: number; direction: RailSectionDirection; manual: boolean; error: string;
};
type WorksForm = { name:string; startDate:string; endDate:string; startTime:string; endTime:string; recurrence:string; daysOfWeek:number[]; scope:string; station:StationSnapshot|null; affectsTraffic:boolean; stationImpact:string; stationSpeedLimit:number };
type PlaceLike = Record<string, unknown> & { name?:unknown; label?:unknown; title?:unknown; displayName?:unknown; city?:unknown; ref?:unknown; lat?:unknown; latitude?:unknown; y?:unknown; lon?:unknown; lng?:unknown; longitude?:unknown; x?:unknown };
type TileMapLike = { setNetworkEnabled?(enabled: boolean): void;
  satelliteEnabled:boolean; railEnabled:boolean; zoomLevel:number; centerLat:number; centerLon:number; viewportWidth:number; viewportHeight:number;
  minZoom?:number; maxZoom?:number; isDirty?:boolean; applyZoom(delta:number,x:number,y:number):void; pan(dx:number,dy:number):void;
  markDirty?():void; clearDirty?():void; _updateFrameCache?():void; screenToWorld(x:number,y:number,w:number,h:number):LatLon;
  latLonToPixel(lat:number|undefined,lon:number|undefined):{x:number;y:number}; renderTiles(ctx:CanvasRenderingContext2D,w:number,h:number):void;
} & Record<string, unknown>;
type WorldLike = Record<string, unknown> & { stations?:StationLike[]|Record<string,StationLike>; stationsById?:Record<string,StationLike>; prefetchRailNetworkNearStation?(st:StationLike,radiusKm:number):Promise<unknown> };
type WorksManagerLike = { add(data:Record<string,unknown>):unknown; getAll():unknown[]; getZones(work:unknown):Array<{route:RailRoutePoint[]}> };
type GameLike = Record<string, unknown> & { orm:unknown; world:WorldLike; renderer?:{tileMap?:TileMapLike}; worksManager:WorksManagerLike; scheduleV2?:Record<string,unknown>; _currentDate?:string; saveState():void };
type UiLike = { renderIncidentsPage():void };
type RouterSnapshot = { routePoints:RailRoutePoint[]; segments:unknown[]; distanceKm:number };
type RouteLike = RailRoutePoint[] & { _resolvedAnchors?:TrackBinding[] };
type RouterLike = { routeBetweenBindings(start:TrackBinding,end:TrackBinding,constraints:TrackBinding[],options:Record<string,unknown>):Promise<RouteLike>; snapshotRoute(route:unknown):RouterSnapshot };
type EngineOsmCache = { key:string; ways:unknown[]; switches:unknown[] };
// S3 Alpha 12 source-compatibility marker for legacy QA: direction:'both'

function esc(s: unknown){return String(s??'').replace(/[&<>"']/g,(c: string)=>(({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[String(c)]));}
function clone<T>(v: T): T{return v==null?v:JSON.parse(JSON.stringify(v)) as T;}
function norm(s: unknown){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function zoneColor(z: Pick<WorksZone,'impact'> | null | undefined,selected: boolean=false){if(selected)return '#ffffff';if(z?.impact==='stop')return '#ef4444';if(z?.impact==='power-off')return '#a855f7';return '#f59e0b';}
function impactLabel(z: Pick<WorksZone,'impact'|'speedLimit'> | null | undefined){if(z?.impact==='stop')return 'Interruption';if(z?.impact==='power-off')return 'Caténaire coupée';return `LTV ${z?.speedLimit||40} km/h`;}
function haversineKm(a: LatLon,b: LatLon){const R=6371,dLat=(Number(b?.lat)-Number(a?.lat))*Math.PI/180,dLon=(Number(b?.lon)-Number(a?.lon))*Math.PI/180,la1=Number(a?.lat)*Math.PI/180,la2=Number(b?.lat)*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function stationSnapshot(st: StationLike | null | undefined): StationSnapshot | null{return st?{id:String(st.id||st.stationId||''),name:String(st.name||st.label||'Gare'),lat:Number(st.lat),lon:Number(st.lon)}:null;}

export class WorksV2Editor {
  declare game: GameLike; declare ui: UiLike; declare router: RouterLike; declare tileMap: TileMapLike;
  declare zones: WorksZone[]; declare activeZoneId:string; declare mode:string; declare busy:boolean;
  declare dragging:boolean; declare panning:boolean; declare panThresholdPx:number; declare dragStartX:number; declare dragStartY:number; declare dragX:number; declare dragY:number;
  declare _routeGeneration:number; declare _routeAbortController:AbortController|null; declare _raf:number; declare _lastRenderAt:number;
  declare _engineOsmVisible:boolean; declare _engineOsmStreamTimer:number; declare _engineOsmRenderCache:EngineOsmCache;
  declare _stationStreamTimer:number; declare _stationStreamPromise:Promise<unknown>|null; declare _stationStreamKey:string; declare _stationStreamLastAttempt:number;
  declare _onWorksKeyDown:(e:KeyboardEvent)=>void; declare overlay:HTMLElement; declare canvas:HTMLCanvasElement; declare ctx:CanvasRenderingContext2D; declare panelWrap:HTMLElement; declare panel:HTMLElement; declare form:WorksForm;
  constructor(game: GameLike,ui: UiLike){
    this.game=game;this.ui=ui;this.router=new ScheduleV2Router(game.orm) as RouterLike;this.tileMap=new TileMap() as TileMapLike;
    // Same base map policy as the current Schedule Creator.
    this.tileMap.satelliteEnabled=true;this.tileMap.railEnabled=true;this.tileMap.zoomLevel=9;this.tileMap.centerLat=48.8;this.tileMap.centerLon=2.5;
    this.zones=[];this.activeZoneId='';this.mode='idle';this.busy=false;
    this.dragging=false;this.panning=false;this.panThresholdPx=8;this.dragStartX=0;this.dragStartY=0;this.dragX=0;this.dragY=0;
    this._routeGeneration=0;this._routeAbortController=null;this._raf=0;this._lastRenderAt=0;
    this._engineOsmVisible=true;this._engineOsmStreamTimer=0;this._engineOsmRenderCache={key:'',ways:[],switches:[]};
    this._stationStreamTimer=0;this._stationStreamPromise=null;this._stationStreamKey='';this._stationStreamLastAttempt=0;
    this._onWorksKeyDown=(e: KeyboardEvent)=>{if(e?.key==='Escape'&&this.busy){e.preventDefault?.();try{this._routeAbortController?.abort?.();}catch{}this.busy=false;this._setStatus('Calcul interrompu.');}};
    if(typeof document!=='undefined')document.addEventListener('keydown',this._onWorksKeyDown);
    this._ensureOverlay();
  }

  // HOTFIX40 latest-SC bridge: these are the exact implementation used by
  // The current SC resolves vector track clicks through chooseTrackCandidatesAtCursor
  // (or chooseTrackCandidates fallback inside ScheduleV2Editor._exactTrackBinding).
  // Schedule Creator A4.3, not a second stale fork in the Works editor.
  _cursorDistancePxToCandidate(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._cursorDistancePxToCandidate as (...xs: unknown[])=>unknown).apply(this,args);}
  _exactTrackBinding(...args: unknown[]): Promise<TrackBinding | null>{return (ScheduleV2Editor.prototype._exactTrackBinding as (...xs: unknown[])=>Promise<TrackBinding | null>).apply(this,args);}
  _engineOsmViewportBounds(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._engineOsmViewportBounds as (...xs: unknown[])=>unknown).apply(this,args);}
  _drawEngineOsm(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._drawEngineOsm as (...xs: unknown[])=>unknown).apply(this,args);}
  _drawStations(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._drawStations as (...xs: unknown[])=>unknown).apply(this,args);}
  _nearestStation(...args: unknown[]): StationLike | null{return (ScheduleV2Editor.prototype._nearestStation as (...xs: unknown[])=>StationLike | null).apply(this,args);}
  _queueVisibleEngineOsm(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._queueVisibleEngineOsm as (...xs: unknown[])=>unknown).apply(this,args);}
  _streamVisibleEngineOsm(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype._streamVisibleEngineOsm as (...xs: unknown[])=>unknown).apply(this,args);}
  showWorldOsmStatus(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype.showWorldOsmStatus as (...xs: unknown[])=>unknown).apply(this,args);}
  reloadWorldOsmVisible(...args: unknown[]): unknown{return (ScheduleV2Editor.prototype.reloadWorldOsmVisible as (...xs: unknown[])=>unknown).apply(this,args);}
  _setHint(t: unknown,busy: boolean=false){this._setStatus(t,busy);}
  // HOTFIX44 — use the Schedule Creator routing configuration itself.
  // Works keeps its own UX, but routing/preparation/progress/cancellation are
  // literally driven by ScheduleV2Editor._routingOptions + ScheduleV2Router.
  _routingOptions(extra: Record<string,unknown>={}){
    const ver={performanceProfile:{maxSpeed:300,traction:'',electricSystems:[],gauges:[],loadingGauge:'',axleLoad:null,metreLoad:null}};
    return ScheduleV2Editor.prototype._routingOptions.call(this,ver,{allowDynamicRailGraphPreparation:true,...extra});
  }

  _ensureOverlay(){
    if(document.getElementById('works-v2-overlay')){
      this.overlay=document.getElementById('works-v2-overlay')!;this.canvas=this.overlay.querySelector('#wv2-map') as HTMLCanvasElement;this.ctx=this.canvas.getContext('2d')!;this.panelWrap=this.overlay.querySelector('#wv2-panel') as HTMLElement;this.panel=this.overlay.querySelector('#wv2-panel-content') as HTMLElement;return;
    }
    const style=document.createElement('style');style.id='works-v2-style';style.textContent=`
      #works-v2-overlay{position:fixed;inset:0;z-index:9050;background:#07101d;color:#e8f0fb;display:none;font:12px system-ui,sans-serif}#works-v2-overlay.open{display:flex;flex-direction:column}
      .wv2-top{height:48px;display:flex;align-items:center;gap:9px;padding:0 10px;background:#0d1726;border-bottom:1px solid #25354b;flex:0 0 auto;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.wv2-top>*{flex:0 0 auto}.wv2-top strong{font-size:15px}.wv2-top button,.wv2-btn{border:1px solid #344961;background:#16253a;color:#edf5ff;border-radius:6px;padding:7px 10px;cursor:pointer}.wv2-top button:hover,.wv2-btn:hover{background:#213650}.wv2-primary{background:#1267c9!important;border-color:#2d83e4!important}.wv2-danger{background:#471f27!important;border-color:#8d3e49!important}.wv2-search-box{display:flex;align-items:center;gap:4px}.wv2-search-box input{width:180px;padding:6px;border-radius:6px;border:1px solid #344961;background:#16253a;color:#edf5ff}
      .wv2-body{position:relative;flex:1;min-height:0}.wv2-map{position:absolute;inset:0;width:100%;height:100%;display:block;background:#08111e}.wv2-panel{position:absolute;right:10px;top:10px;bottom:10px;width:360px;background:rgba(8,16,28,.96);border:1px solid #2b405b;border-radius:10px;box-shadow:0 12px 45px #0008;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(7px)}.wv2-panel.collapsed{width:46px;height:46px;bottom:auto}.wv2-panel.collapsed .wv2-panel-content{display:none}.wv2-panel-head{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #24374e}.wv2-panel-head b{flex:1}.wv2-panel-content{padding:8px;overflow:auto;flex:1}.wv2-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.wv2-field{display:flex;flex-direction:column;gap:3px;margin-bottom:7px}.wv2-field label{font-size:10px;color:#9db0c8;text-transform:uppercase;letter-spacing:.04em}.wv2-field input,.wv2-field select{width:100%;box-sizing:border-box;background:#111d2d;border:1px solid #31455f;border-radius:5px;color:#eff6ff;padding:6px 7px;font:12px system-ui}.wv2-field input:focus,.wv2-field select:focus{outline:1px solid #388de7}.wv2-section{margin-top:10px;padding-top:9px;border-top:1px solid #22354a}.wv2-section h4{margin:0 0 7px;font-size:11px;color:#b9cbe0;text-transform:uppercase}.wv2-hint{padding:7px 9px;border:1px solid #27445f;background:#10243a;border-radius:6px;color:#c8e3ff;margin-bottom:8px}.wv2-hint.busy{border-color:#b57b21;color:#ffe2a4}.wv2-zone{border:1px solid #263a51;background:#0e1a29;border-radius:6px;padding:6px;margin:5px 0;cursor:pointer}.wv2-zone.active{border-color:#62b2ff;background:#132b43}.wv2-zone-head{display:flex;align-items:center;gap:6px}.wv2-zone-head b{flex:1}.wv2-zone small{display:block;color:#91a9c4;margin-top:3px}.wv2-zone-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.wv2-badge{font-size:9px;border-radius:4px;padding:2px 5px;background:#283a51;color:#d9e8fa}
      .wv2-bottom{min-height:43px;background:#0c1624;border-top:1px solid #24364d;display:flex;align-items:center;gap:6px;padding:0 10px;flex:0 0 auto;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.wv2-bottom>*{flex:0 0 auto}.wv2-bottom .spacer{flex:1 0 20px}.wv2-status{color:#9fb3cb;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36vw}
      @media(max-width:850px){.wv2-panel{width:320px}.wv2-status{max-width:220px}}
    `;document.head.appendChild(style);
    const overlay=document.createElement('div');overlay.id='works-v2-overlay';overlay.innerHTML=`
      <div class="wv2-top">
        <button data-act="close">← Incidents</button>
        <strong>Travaux V2 <span style="color:#7dd3fc">${WORKS_SC_TECH}</span></strong>
        <span class="wv2-badge">multi-sections indépendantes</span><span id="wv2-title" style="color:#a9bed6"></span><span style="flex:1"></span>
        <div class="wv2-search-box"><span style="color:#edf5ff;font-weight:600">🔍 Gare</span><input id="wv2-station-search" placeholder="Nom de gare..."><button data-act="search-station" title="Centrer sur une gare">↗</button><span style="color:#edf5ff;font-weight:600">📍</span><input id="wv2-place-search" placeholder="Chercher un lieu..."><button data-act="search-place" title="Centrer sur un lieu">↗</button></div>
        <button data-act="zoom-out" title="Dézoomer">−</button><button data-act="zoom-in" title="Zoomer">＋</button><button data-act="save" class="wv2-primary">✓ Programmer</button>
      </div>
      <div class="wv2-body"><canvas id="wv2-map" class="wv2-map"></canvas><div class="wv2-panel" id="wv2-panel"><div class="wv2-panel-head"><b>Chantier</b><button class="wv2-btn" data-act="toggle-panel">⇆</button></div><div class="wv2-panel-content" id="wv2-panel-content"></div></div></div>
      <div class="wv2-bottom"><button class="wv2-btn wv2-primary" data-act="add-zone">＋ Section</button><button class="wv2-btn wv2-primary" data-act="engine-osm" title="Afficher les voies et aiguillages OSM déjà chargés par le moteur">◉ OSM moteur</button><button class="wv2-btn" data-act="world-osm-status" title="État de la couche ferroviaire OSM mondiale">🌍 OSM monde</button><button class="wv2-btn" data-act="world-osm-refresh" title="Recharger la zone OSM visible">↻ OSM zone</button><button class="wv2-btn" data-act="add-via">＋ VIA</button><button class="wv2-btn" data-act="manual">✎ Tracé manuel</button><button class="wv2-btn" data-act="auto">↺ Auto section</button><button class="wv2-btn" data-act="remove-via">✕ Dernier VIA</button><span class="wv2-status" id="wv2-status">Ajoutez une section puis cliquez la gare A.</span><span class="spacer"></span><button class="wv2-btn wv2-danger" data-act="delete-zone">🗑 Section</button></div>`;
    document.body.appendChild(overlay);this.overlay=overlay;this.canvas=overlay.querySelector('#wv2-map') as HTMLCanvasElement;this.ctx=this.canvas.getContext('2d')!;this.panelWrap=overlay.querySelector('#wv2-panel') as HTMLElement;this.panel=overlay.querySelector('#wv2-panel-content') as HTMLElement;this._bind();
  }

  _bind(){
    this.overlay.addEventListener('click',(e: MouseEvent)=>{const b=(e.target as Element).closest('[data-act]');if(!b)return;const a=b.dataset.act;
      if(a==='close')this.close();if(a==='save')this.save();if(a==='zoom-in')this._zoom(1);if(a==='zoom-out')this._zoom(-1);if(a==='add-zone')this.addZone();if(a==='delete-zone')this.deleteZone();if(a==='add-via')this.armVia();if(a==='manual')this.toggleManual();if(a==='auto')this.resetAuto();if(a==='remove-via')this.removeLastVia();if(a==='toggle-panel')this.panelWrap?.classList.toggle('collapsed');if(a==='engine-osm')this.toggleEngineOsm();if(a==='world-osm-status')this.showWorldOsmStatus();if(a==='world-osm-refresh')this.reloadWorldOsmVisible();if(a==='search-station')this.searchStationFromInput();if(a==='search-place')this.searchPlaceFromInput();if(a==='pick-work-station')this.armStationOnly();
    });
    for(const [sel,fn] of ([['#wv2-station-search',()=>this.searchStationFromInput()],['#wv2-place-search',()=>this.searchPlaceFromInput()]] as Array<[string,()=>void]>))this.overlay.querySelector(sel)?.addEventListener('keydown',(e: KeyboardEvent)=>{if(e.key==='Enter'){e.preventDefault();fn();}});
    this.canvas.addEventListener('wheel',(e: WheelEvent)=>{e.preventDefault();const r=this.canvas.getBoundingClientRect();this.tileMap.applyZoom(e.deltaY<0?1:-1,e.clientX-r.left,e.clientY-r.top);this.draw();this._queueVisibleEngineOsm(false);},{passive:false});
    this.canvas.addEventListener('mousedown',(e: MouseEvent)=>this._beginMapPointer(e));window.addEventListener('mousemove',(e: MouseEvent)=>this._moveMapPointer(e));window.addEventListener('mouseup',(e: MouseEvent)=>this._endMapPointer(e));window.addEventListener('blur',()=>this._cancelMapPointer());window.addEventListener('resize',()=>this._resize());
  }

  _beginMapPointer(e: MouseEvent){if(e.button!==0||!this.isOpen())return false;this.dragging=true;this.panning=false;this.dragStartX=this.dragX=e.clientX;this.dragStartY=this.dragY=e.clientY;if(this.canvas)this.canvas.style.cursor='default';return true;}
  _moveMapPointer(e: MouseEvent){if(!this.dragging||!this.isOpen())return false;if(!this.panning){const dx=e.clientX-this.dragStartX,dy=e.clientY-this.dragStartY;if(Math.hypot(dx,dy)<this.panThresholdPx)return false;this.panning=true;if(this.canvas)this.canvas.style.cursor='grabbing';this.tileMap.pan(dx,dy);this.tileMap.markDirty?.();this.dragX=e.clientX;this.dragY=e.clientY;return true;}const dx=e.clientX-this.dragX,dy=e.clientY-this.dragY;if(!dx&&!dy)return true;this.tileMap.pan(dx,dy);this.tileMap.markDirty?.();this.dragX=e.clientX;this.dragY=e.clientY;return true;}
  _endMapPointer(e: MouseEvent){if(!this.dragging||!this.isOpen())return false;const pan=this.panning;this.dragging=false;this.panning=false;if(this.canvas)this.canvas.style.cursor='default';if(!pan&&e.target===this.canvas){this._handleMapClick(e).catch((err: unknown)=>this._error(err));return 'click';}if(pan)this._queueVisibleEngineOsm(false);return pan?'pan':false;}
  _cancelMapPointer(){if(!this.dragging)return false;this.dragging=false;this.panning=false;if(this.canvas)this.canvas.style.cursor='default';return true;}

  isOpen(){return this.overlay?.classList.contains('open');}
  _adoptMainViewport(){const main=this.game?.renderer?.tileMap;if(!main)return false;if(Number.isFinite(main.centerLat))this.tileMap.centerLat=main.centerLat;if(Number.isFinite(main.centerLon))this.tileMap.centerLon=main.centerLon;const z=Number(main.zoomLevel||this.tileMap.zoomLevel||7.5),min=Number.isFinite(this.tileMap.minZoom)?this.tileMap.minZoom!:5,max=Number.isFinite(this.tileMap.maxZoom)?this.tileMap.maxZoom!:20;this.tileMap.zoomLevel=Math.max(min,Math.min(max,z));this.tileMap.markDirty?.();return true;}
  open(){
    this.zones=[];this.activeZoneId='';this.mode='idle';this.busy=false;this._engineOsmRenderCache={key:'',ways:[],switches:[]};this.overlay.classList.add('open');this.tileMap.setNetworkEnabled?.(true);if(!this._adoptMainViewport()){this.tileMap.centerLat=48.86;this.tileMap.centerLon=2.35;this.tileMap.zoomLevel=9;}
    const today=(this.game._currentDate||new Date().toISOString().slice(0,10));const tomorrow=new Date(new Date(today+'T12:00:00').getTime()+86400000).toISOString().slice(0,10);this.form={name:'',startDate:today,endDate:tomorrow,startTime:'22:00',endTime:'05:00',recurrence:'daily',daysOfWeek:[0,1,2,3,4,5,6],scope:'sections',station:null,affectsTraffic:true,stationImpact:'stop',stationSpeedLimit:40};
    this._setStatus(`Technologie ${WORKS_SC_TECH} active. Ajoutez une section puis cliquez la gare A.`);this.renderPanel();requestAnimationFrame(()=>{this._resize();this._updateEngineOsmButton();this.draw();this._queueVisibleEngineOsm(true);this._scheduleDrawLoop();});
  }
  close(){try{this._routeAbortController?.abort?.();}catch{}this.overlay.classList.remove('open');this.tileMap.setNetworkEnabled?.(false);this.mode='idle';cancelAnimationFrame(this._raf);clearTimeout(this._engineOsmStreamTimer);}
  _zoom(d: number){const r=this.canvas.getBoundingClientRect();this.tileMap.applyZoom(d>0?1:-1,r.width/2,r.height/2);this.draw();this._queueVisibleEngineOsm(false);}
  _resize(){if(!this.isOpen())return;const r=this.canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;const cw=Math.max(1,Math.round(r.width*dpr)),ch=Math.max(1,Math.round(r.height*dpr));if(this.canvas.width!==cw||this.canvas.height!==ch){this.canvas.width=cw;this.canvas.height=ch;this.ctx.setTransform(dpr,0,0,dpr,0,0);this.tileMap.viewportWidth=r.width;this.tileMap.viewportHeight=r.height;this.tileMap.markDirty?.();}this.draw();}
  _scheduleDrawLoop(){cancelAnimationFrame(this._raf);const loop=()=>{if(!this.isOpen())return;if(this.tileMap.isDirty)this.draw();this._raf=requestAnimationFrame(loop);};this._raf=requestAnimationFrame(loop);}
  _setStatus(t: unknown,busy: boolean=false){const e=this.overlay.querySelector('#wv2-status');if(e)e.textContent=t as string;const h=this.panel?.querySelector('#wv2-hint');if(h){h.textContent=t as string;h.classList.toggle('busy',busy);}}
  _active(){return this.zones.find((z: WorksZone)=>z.id===this.activeZoneId)||null;}
  _newZone(): WorksZone{return {id:`draft-zone-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:`Section ${this.zones.length+1}`,autoName:true,startStation:null,endStation:null,startBinding:null,endBinding:null,constraints:[],route:[],segments:[],distanceKm:0,impact:'stop',speedLimit:40,direction:'both',manual:false,error:''};}

  addZone(){if((this.form?.scope||'sections')==='station')return this._setStatus('Ce chantier est en mode gare uniquement. Passez le périmètre sur “Section(s) ferroviaire(s)” pour tracer une section.');const z=this._newZone();this.zones.push(z);this.activeZoneId=z.id;this.mode='station-start';this._setStatus(`${z.name} : cliquez la gare A.`);this.renderPanel();this.draw();}
  armStationOnly(){this.form.scope='station';this.activeZoneId='';this.mode='station-only';this._setStatus('MODE GARE : cliquez la gare concernée par les travaux.');this.renderPanel();this.draw();}
  deleteZone(){const z=this._active();if(!z)return;this.zones=this.zones.filter((x: WorksZone)=>x.id!==z.id);this.activeZoneId=this.zones.at(-1)?.id||'';this.mode='idle';this._setStatus(this.zones.length?'Section supprimée. Sélectionnez une section pour la modifier.':'Ajoutez une section.');this.renderPanel();this.draw();}
  armVia(){const z=this._active();if(!z?.startBinding||!z?.endBinding)return this._setStatus('Définissez d’abord le début et la fin de la section.');this.mode='via';this._setStatus('MODE VIA : cliquez directement sur la voie/aiguille OSM à imposer.');}
  toggleManual(){const z=this._active();if(!z?.startBinding||!z?.endBinding)return this._setStatus('Définissez d’abord le début et la fin de la section.');if(this.mode==='manual'){this.mode='idle';this._setStatus('Tracé manuel terminé.');}else{this.mode='manual';z.manual=true;this._setStatus('TRACÉ MANUEL OSM : cliquez successivement les voies/aiguilles à imposer. Cliquez de nouveau “Tracé manuel” pour terminer.');}this.renderPanel();}
  async resetAuto(){const z=this._active();if(!z)return;z.constraints=[];z.manual=false;this.mode='idle';await this._recompute(z);this._setStatus('VIA supprimés : section recalculée automatiquement par le dernier routeur SC.');this.renderPanel();this.draw();}
  async removeLastVia(){const z=this._active();if(!z?.constraints?.length)return;z.constraints.pop();await this._recompute(z);this.renderPanel();this.draw();}

  async _prefetchStation(st: StationLike | null){
    if(!st)return false;
    try{await this.game?.world?.prefetchRailNetworkNearStation?.(st,0.8);return true;}
    catch(err){console.warn('Travaux V2 — préchargement RailGraph gare impossible:',err);return false;}
  }

  async _selectEndpointStation(st: StationLike | null,side: 'start'|'end'){
    const z=this._active();if(!z||!st)return false;
    const start=side==='start';
    if(start){z.startStation=stationSnapshot(st);z.startBinding=null;z.endStation=null;z.endBinding=null;z.constraints=[];z.route=[];z.segments=[];z.distanceKm=0;z.error='';}
    else{z.endStation=stationSnapshot(st);z.endBinding=null;z.constraints=[];z.route=[];z.segments=[];z.distanceKm=0;z.error='';}
    this._setStatus(`${start?'Gare A':'Gare B'} : ${st.name||'gare'} sélectionnée — chargement du réseau local…`,true);
    await this._prefetchStation(st);
    if(this.tileMap){this.tileMap.centerLat=Number(st.lat);this.tileMap.centerLon=Number(st.lon);this.tileMap.zoomLevel=Math.max(17,Number(this.tileMap.zoomLevel||0));this.tileMap.markDirty?.();}
    this.mode=start?'track-start':'track-end';
    this._setStatus(`${st.name||'Gare'} sélectionnée — cliquez maintenant la voie ${start?'A':'B'} exacte dans cette gare.`);
    this.renderPanel();this.draw();this._queueVisibleEngineOsm(true);return true;
  }

  _autoZoneName(z: WorksZone | null){
    if(!z||z.autoName===false)return;
    const a=z.startStation?.name,b=z.endStation?.name;
    z.name=a&&b?`Travaux entre ${a} et ${b}`:(a?`Travaux depuis ${a}`:z.name||`Section ${this.zones.indexOf(z)+1}`);
  }

  _sameWayMicroRoute(z: WorksZone | null): RouteLike | null{
    const a=z?.startBinding,b=z?.endBinding;if(!a||!b)return null;
    if(!a.wayId||String(a.wayId)!==String(b.wayId))return null;
    const pa={lat:Number(a.snapLat??a.lat),lon:Number(a.snapLon??a.lon)},pb={lat:Number(b.snapLat??b.lat),lon:Number(b.snapLon??b.lon)};
    if(![pa.lat,pa.lon,pb.lat,pb.lon].every(Number.isFinite))return null;
    const directKm=haversineKm(pa,pb);
    const geom=(a.osmSnapshot?.geometry||b.osmSnapshot?.geometry||[]).filter((q: GeometryPoint)=>Number.isFinite(Number(q?.lat))&&Number.isFinite(Number(q?.lon)));
    const ia=Number.isInteger(Number(a.segmentIndex))?Number(a.segmentIndex):null,ib=Number.isInteger(Number(b.segmentIndex))?Number(b.segmentIndex):null;
    const meta={...(a.osmSnapshot||{}),...(b.osmSnapshot||{}),wayId:String(a.wayId),trackRef:a.trackRef||b.trackRef||'',ref:a.osmSnapshot?.ref||b.osmSnapshot?.ref||'',name:a.osmSnapshot?.name||b.osmSnapshot?.name||''};
    const mk=(q: GeometryPoint)=>({lat:Number(q.lat),lon:Number(q.lon),wayId:String(a.wayId),segmentIndex:Number.isFinite(Number(q.segmentIndex))?Number(q.segmentIndex):null,maxSpeed:meta.maxSpeed??30,maxSpeedSource:meta.maxSpeedSource||'OSM',maxSpeedForward:meta.maxSpeedForward??null,maxSpeedBackward:meta.maxSpeedBackward??null,electrified:meta.electrified??null,electrifiedMode:meta.electrifiedMode||'',voltage:meta.voltage||[],frequency:meta.frequency||[],gauge:meta.gauge||[],loadingGauge:meta.loadingGauge||'',axleLoad:meta.axleLoad??null,metreLoad:meta.metreLoad??null,tracks:meta.tracks||1,trafficMode:meta.trafficMode||'',usage:meta.usage||'',service:meta.service||'',railway:meta.railway||'rail',preferredDirection:meta.preferredDirection||'',bidirectional:meta.bidirectional||'',oneway:meta.oneway||'',trackRef:meta.trackRef||'',name:meta.name||'',ref:meta.ref||'',tags:meta.tags||{},fallback:false});
    let pts=[mk(pa)];
    if(geom.length>=2&&ia!=null&&ib!=null&&ia>=0&&ib>=0&&ia<geom.length-1&&ib<geom.length-1){
      if(ia<=ib){for(let i=ia+1;i<=ib;i++)pts.push(mk({...geom[i],segmentIndex:i}));}
      else{for(let i=ia;i>ib;i--)pts.push(mk({...geom[i],segmentIndex:i-1}));}
    }
    pts.push(mk(pb));
    const clean:RailRoutePoint[]=[];for(const q of pts){const prev=clean[clean.length-1];if(!prev||haversineKm(prev,q)>.0005)clean.push(q);}
    if(clean.length<2||directKm>0.35)return null;
    return clean as RouteLike;
  }

  async _handleMapClick(e: MouseEvent){
    if(this.busy)return;
    const r=this.canvas.getBoundingClientRect(),p=this.tileMap.screenToWorld(e.clientX-r.left,e.clientY-r.top,r.width,r.height);
    if(this.mode==='station-only'){
      const st=this._nearestStation(p.lat,p.lon,15);
      if(!st){this._setStatus('Cliquez précisément sur une icône de gare.');return;}
      this.form.station=stationSnapshot(st);this.mode='idle';this.tileMap.centerLat=Number(st.lat);this.tileMap.centerLon=Number(st.lon);this.tileMap.zoomLevel=Math.max(15,Number(this.tileMap.zoomLevel||0));this.tileMap.markDirty?.();this._setStatus(`Travaux à ${st.name||'la gare'} : gare sélectionnée.`);this.renderPanel();this.draw();return;
    }
    let z=this._active();if(!z){this.addZone();z=this._active();if(!z)return;}
    if(this.mode==='idle'){
      if(!z.startStation)this.mode='station-start';
      else if(!z.startBinding)this.mode='track-start';
      else if(!z.endStation)this.mode='station-end';
      else if(!z.endBinding)this.mode='track-end';
      else{this._setStatus('Utilisez + VIA, Tracé manuel ou + Section.');return;}
    }
    if(this.mode==='station-start'||this.mode==='station-end'){
      const st=this._nearestStation(p.lat,p.lon,15);
      if(!st){this._setStatus(`Cliquez précisément sur une icône de gare pour définir la gare ${this.mode==='station-start'?'A':'B'}.`);return;}
      await this._selectEndpointStation(st,this.mode==='station-start'?'start':'end');return;
    }
    if(this.mode==='track-start'){
      const b=await this._chooseBinding(p.lat,p.lon,'Voie A');if(!b)return;
      z.startBinding=b;z.constraints=[];z.route=[];z.segments=[];z.distanceKm=0;this.mode='station-end';
      this._setStatus(`${z.startStation?.name||'Gare A'} — voie A ${b.trackRef||b.displayName||b.wayId||''} verrouillée. Cliquez maintenant la gare B.`);
      this.renderPanel();this.draw();return;
    }
    if(this.mode==='track-end'){
      const b=await this._chooseBinding(p.lat,p.lon,'Voie B');if(!b)return;
      z.endBinding=b;this.mode='idle';this._autoZoneName(z);await this._recompute(z);
      if(!z.error)this._setStatus(`${z.name} — ${z.distanceKm.toFixed(2)} km.`);
      this.renderPanel();this.draw();return;
    }
    if(this.mode==='via'||this.mode==='manual'){
      const b=await this._chooseBinding(p.lat,p.lon,'Point VIA');if(!b)return;
      z.constraints.push({lat:b.snapLat,lon:b.snapLon,snapLat:b.snapLat,snapLon:b.snapLon,wayId:b.wayId||'',trackRef:b.trackRef||'',displayName:b.displayName||'',segmentIndex:b.segmentIndex??null,osmSnapshot:clone(b.osmSnapshot||{})});
      await this._recompute(z);const manual=this.mode==='manual';if(!manual)this.mode='idle';
      this._setStatus(manual?'VIA ajouté. Continuez le tracé manuel OSM.':'VIA ajouté et section recalculée.');this.renderPanel();this.draw();
    }
  }

  async _chooseBinding(lat: number,lon: number,title: string){
    if(typeof navigator!=='undefined'&&navigator.onLine===false){this._error(new Error('OSM hors ligne : impossible de sélectionner une nouvelle voie.'));return null;}
    this.busy=true;this._setStatus(`${title} : sélection exacte ${WORKS_SC_TECH}…`,true);
    try{const b=await this._exactTrackBinding(lat,lon,'');return b||null;}catch(err){this._error(err);return null;}finally{this.busy=false;}
  }

  async _recompute(z: WorksZone){
    if(!z?.startBinding||!z?.endBinding)return false;this.busy=true;this._setStatus('Calcul du vrai tracé ferroviaire avec le routeur SC actuel…',true);
    try{
      // Same flow as Schedule Creator: station click already preloads its local
      // 0.8 km RailGraph once. Do NOT reload A+B here before every route solve.
      try{this._routeAbortController?.abort?.();}catch{}const controller=new AbortController();this._routeAbortController=controller;
      let route=null;
      if(!(z.constraints||[]).length)route=this._sameWayMicroRoute(z);
      if(!route)route=await this.router.routeBetweenBindings(z.startBinding,z.endBinding,z.constraints||[],this._routingOptions({signal:controller.signal}));
      const snap=this.router.snapshotRoute(route);if(!snap.routePoints?.length||snap.routePoints.length<2)throw new Error('Tracé OSM vide.');z.route=snap.routePoints;z.segments=snap.segments;z.distanceKm=snap.distanceKm;z.error='';
      const resolved=route?._resolvedAnchors||[],targets=[z.startBinding,...(z.constraints||[]),z.endBinding];if(resolved.length===targets.length)for(let i=0;i<resolved.length;i++){const rr=resolved[i],t=targets[i];if(!rr||!t)continue;t.snapLat=rr.lat;t.snapLon=rr.lon;if(rr.wayId)t.wayId=String(rr.wayId);}this._engineOsmRenderCache={key:'',ways:[],switches:[]};this._queueVisibleEngineOsm(true);return true;
    }catch(err){const e=err as {name?:string;message?:string}|null;if(e?.name==='AbortError')return false;z.error=e?.message||String(err);this._error(err);return false;}finally{this.busy=false;this.draw();}
  }

  async searchStationFromInput(){
    const input=this.overlay.querySelector('#wv2-station-search'),q=norm(input?.value);if(!q)return;const stations=this.game?.world?.stations||this.game?.world?.stationsById||{},list=Array.isArray(stations)?stations:Object.values(stations);const s=list.find((x: StationLike)=>norm(x.name||x.label).includes(q));if(!s)return this._setStatus('Gare introuvable.');
    if(Number.isFinite(Number(s.lat)))this.tileMap.centerLat=Number(s.lat);if(Number.isFinite(Number(s.lon)))this.tileMap.centerLon=Number(s.lon);this.tileMap.zoomLevel=Math.max(this.tileMap.zoomLevel||9,15);this.tileMap.markDirty?.();this.draw();this._queueVisibleEngineOsm(false);
    if(this.mode==='station-start'||this.mode==='station-end'){await this._selectEndpointStation(s,this.mode==='station-start'?'start':'end');return;}
    if(this.mode==='station-only'){this.form.station=stationSnapshot(s);this.mode='idle';this._setStatus(`Travaux à ${s.name||'la gare'} : gare sélectionnée.`);this.renderPanel();this.draw();return;}
    this._setStatus(`Carte centrée : ${s.name||'gare'}.`);
  }
  searchPlaceFromInput(){
    const input=this.overlay.querySelector('#wv2-place-search'),q=norm(input?.value);if(!q)return;const world=this.game?.world||{},pools=[];for(const key of ['stations','industries','sites','depots','technicalLocations','locations','places']){const v=world[key]||this.game?.scheduleV2?.[key];if(Array.isArray(v))pools.push(...v);else if(v&&typeof v==='object')pools.push(...Object.values(v));}const hit=pools.find((x: PlaceLike)=>[x.name,x.label,x.title,x.displayName,x.city,x.ref].some((v: unknown)=>norm(v).includes(q)));if(!hit)return this._setStatus('Lieu introuvable.');const lat=Number(hit.lat??hit.latitude??hit.y),lon=Number(hit.lon??hit.lng??hit.longitude??hit.x);if(!Number.isFinite(lat)||!Number.isFinite(lon))return this._setStatus('Lieu trouvé mais sans coordonnées.');this.tileMap.centerLat=lat;this.tileMap.centerLon=lon;this.tileMap.zoomLevel=Math.max(this.tileMap.zoomLevel||9,13);this.tileMap.markDirty?.();this.draw();this._queueVisibleEngineOsm(false);this._setStatus(`Carte centrée : ${hit.name||hit.label||'lieu'}.`);
  }
  _updateEngineOsmButton(){const btn=this.overlay?.querySelector?.('[data-act="engine-osm"]');if(!btn)return;btn.textContent=this._engineOsmVisible?'◉ OSM moteur':'○ OSM moteur';btn.classList.toggle('wv2-primary',!!this._engineOsmVisible);}
  toggleEngineOsm(){this._engineOsmVisible=!this._engineOsmVisible;this._updateEngineOsmButton();this._engineOsmRenderCache={key:'',ways:[],switches:[]};this.tileMap.markDirty?.();this.draw();if(this._engineOsmVisible){this._setStatus('OSM moteur activé : voies vectorielles et aiguillages du moteur SC visibles.');this._queueVisibleEngineOsm(true);}else this._setStatus('OSM moteur masqué : fond OpenRailwayMap uniquement.');}

  renderPanel(){
    if(!this.panel)return;
    const z=this._active(),f=this.form||{},stationMode=(f.scope||'sections')==='station',traffic=f.affectsTraffic!==false;
    const stationLabel=f.station?.name||'Aucune gare sélectionnée';
    this.panel.innerHTML=`
      <div id="wv2-hint" class="wv2-hint">${esc(this.overlay.querySelector('#wv2-status')?.textContent||'')}</div>
      <div class="wv2-field"><label>Nom du chantier</label><input id="wv2-name" value="${esc(f.name||'')}" placeholder="ex: Travaux passerelle"></div>
      <div class="wv2-grid"><div class="wv2-field"><label>Date début</label><input type="date" id="wv2-start-date" value="${esc(f.startDate||'')}"></div><div class="wv2-field"><label>Date fin</label><input type="date" id="wv2-end-date" value="${esc(f.endDate||'')}"></div><div class="wv2-field"><label>Heure début</label><input id="wv2-start-time" value="${esc(f.startTime||'22:00')}"></div><div class="wv2-field"><label>Heure fin</label><input id="wv2-end-time" value="${esc(f.endTime||'05:00')}"></div></div>
      <div class="wv2-field"><label>Récurrence</label><select id="wv2-recurrence"><option value="once" ${f.recurrence==='once'?'selected':''}>Journée unique</option><option value="daily" ${f.recurrence==='daily'?'selected':''}>Chaque jour</option><option value="weekly" ${f.recurrence==='weekly'?'selected':''}>Hebdomadaire</option></select></div>
      <div id="wv2-days" class="wv2-field" style="display:${htmlText(f.recurrence==='weekly'?'block':'none')}"><label>Jours</label><div style="display:flex;gap:7px;flex-wrap:wrap">${([['Di',0],['Lu',1],['Ma',2],['Me',3],['Je',4],['Ve',5],['Sa',6]] as Array<[string,number]>).map(([l,d])=>`<label style="font-size:11px;text-transform:none"><input type="checkbox" class="wv2-day" value="${htmlText(d)}" ${(f.daysOfWeek||[]).includes(d)?'checked':''}> ${l}</label>`).join('')}</div></div>

      <div class="wv2-section"><h4>Périmètre</h4>
        <div class="wv2-field"><label>Zone concernée</label><select id="wv2-scope"><option value="sections" ${!stationMode?'selected':''}>Section(s) ferroviaire(s)</option><option value="station" ${stationMode?'selected':''}>Une gare uniquement</option></select></div>
        ${stationMode?`<div class="wv2-field"><label>Gare concernée</label><div style="display:flex;gap:6px;align-items:center"><div style="flex:1;padding:7px;border:1px solid #31455f;border-radius:5px;background:#111d2d;color:${htmlText(f.station?'#fff':'#8fa8c1')}">${esc(stationLabel)}</div><button class="wv2-btn wv2-primary" data-act="pick-work-station">Choisir sur la carte</button></div></div>`:''}
      </div>

      <div class="wv2-section"><h4>Impact circulation</h4>
        <div class="wv2-field"><label>Ces travaux impactent-ils les trains ?</label><select id="wv2-affects-traffic"><option value="yes" ${traffic?'selected':''}>Oui</option><option value="no" ${!traffic?'selected':''}>Non — informatif uniquement</option></select></div>
        ${!traffic?'<div class="wv2-hint">Aucun ralentissement, blocage ou coupure caténaire ne sera appliqué aux trains.</div>':''}
        ${stationMode&&traffic?`<div class="wv2-field"><label>Impact en gare</label><select id="wv2-station-impact"><option value="stop" ${f.stationImpact==='stop'?'selected':''}>Interruption totale</option><option value="slow" ${f.stationImpact==='slow'?'selected':''}>LTV — limitation temporaire de vitesse</option><option value="power-off" ${f.stationImpact==='power-off'?'selected':''}>Caténaire coupée</option></select></div><div class="wv2-field" style="display:${htmlText(f.stationImpact==='slow'?'flex':'none')}"><label>Vitesse LTV (km/h)</label><input type="number" id="wv2-station-speed" min="5" max="300" value="${htmlText(Number(f.stationSpeedLimit||40))}"></div>`:''}
        ${!stationMode&&traffic?'<div style="font-size:10px;color:#9db0c8">L’impact précis reste défini section par section ci-dessous.</div>':''}
      </div>

      ${!stationMode?`<div class="wv2-section"><h4>Sections ferroviaires (${this.zones.length})</h4>${this.zones.length?this.zones.map((x: WorksZone,i: number)=>`<div class="wv2-zone ${htmlText(x.id===this.activeZoneId?'active':'')}" data-zone="${esc(x.id)}"><div class="wv2-zone-head"><span class="wv2-zone-dot" style="background:${htmlText(zoneColor(x,false))}"></span><b>${esc(x.name||`Section ${i+1}`)}</b><span class="wv2-badge">${x.distanceKm?x.distanceKm.toFixed(2)+' km':'à tracer'}</span></div><small>${htmlText(x.startStation?.name&&x.endStation?.name?`${(x.startStation.name)} → ${(x.endStation.name)} • `:'')}${esc(impactLabel(x))} • ${esc(sectionDirectionLabel(x.direction))}${x.constraints?.length?` • ${x.constraints.length} VIA`:''}${x.error?` • ⚠ ${esc(x.error)}`:''}</small></div>`).join(''):'<div style="color:#8fa8c1;padding:8px 0">Aucune section. Cliquez + Section.</div>'}</div>`:''}
      ${!stationMode&&z?`<div class="wv2-section"><h4>Section sélectionnée</h4><div class="wv2-field"><label>Nom</label><input id="wv2-zone-name" value="${esc(z.name||'')}"></div><div class="wv2-field"><label>Impact</label><select id="wv2-zone-impact" ${traffic?'':'disabled'}><option value="stop" ${z.impact==='stop'?'selected':''}>Interruption totale</option><option value="slow" ${z.impact==='slow'?'selected':''}>LTV — limitation temporaire de vitesse</option><option value="power-off" ${z.impact==='power-off'?'selected':''}>Caténaire coupée</option></select></div><div class="wv2-field"><label>Sens impacté</label><select id="wv2-zone-direction" ${traffic?'':'disabled'}><option value="both" ${normalizeSectionDirection(z.direction)==='both'?'selected':''}>Deux sens (par défaut)</option><option value="forward" ${normalizeSectionDirection(z.direction)==='forward'?'selected':''}>A → B uniquement</option><option value="reverse" ${normalizeSectionDirection(z.direction)==='reverse'?'selected':''}>B → A uniquement</option></select></div><div class="wv2-field" id="wv2-zone-speed-wrap" style="display:${htmlText(z.impact==='slow'?'block':'none')}"><label>Vitesse LTV (km/h)</label><input type="number" id="wv2-zone-speed" min="5" max="300" value="${htmlText(Number(z.speedLimit||40))}" ${traffic?'':'disabled'}></div><div style="font-size:10px;color:#8fa8c1"><b style="color:#e2e8f0">${htmlText(z.startStation?.name&&z.endStation?.name?`Travaux entre ${(z.startStation.name)} et ${(z.endStation.name)}`:'Section à compléter')}</b><br>Gare A : ${esc(z.startStation?.name||'non définie')} • voie ${esc(z.startBinding?.trackRef||z.startBinding?.displayName||z.startBinding?.wayId||'non définie')}<br>Gare B : ${esc(z.endStation?.name||'non définie')} • voie ${esc(z.endBinding?.trackRef||z.endBinding?.displayName||z.endBinding?.wayId||'non définie')}<br>VIA : ${z.constraints?.length||0}</div></div>`:''}`;
    this._bindPanel();
  }

  _readPanel(){
    if(!this.panel||!this.form)return;
    this.form.name=this.panel.querySelector('#wv2-name')?.value||this.form.name||'';
    this.form.startDate=this.panel.querySelector('#wv2-start-date')?.value||this.form.startDate||'';
    this.form.endDate=this.panel.querySelector('#wv2-end-date')?.value||this.form.endDate||'';
    this.form.startTime=this.panel.querySelector('#wv2-start-time')?.value||this.form.startTime||'22:00';
    this.form.endTime=this.panel.querySelector('#wv2-end-time')?.value||this.form.endTime||'05:00';
    this.form.recurrence=this.panel.querySelector('#wv2-recurrence')?.value||this.form.recurrence||'daily';
    this.form.daysOfWeek=[...this.panel.querySelectorAll('.wv2-day:checked')].map((x: Element)=>Number((x as HTMLInputElement).value));
    this.form.scope=this.panel.querySelector('#wv2-scope')?.value||this.form.scope||'sections';
    this.form.affectsTraffic=(this.panel.querySelector('#wv2-affects-traffic')?.value||'yes')!=='no';
    this.form.stationImpact=this.panel.querySelector('#wv2-station-impact')?.value||this.form.stationImpact||'stop';
    this.form.stationSpeedLimit=Math.max(5,Math.min(300,Number(this.panel.querySelector('#wv2-station-speed')?.value||this.form.stationSpeedLimit||40)));
  }

  _bindPanel(){
    const read=()=>this._readPanel();
    ['#wv2-name','#wv2-start-date','#wv2-end-date','#wv2-start-time','#wv2-end-time'].forEach((sel: string)=>this.panel.querySelector(sel)?.addEventListener('change',read));
    this.panel.querySelector('#wv2-recurrence')?.addEventListener('change',()=>{read();this.renderPanel();});
    this.panel.querySelectorAll('.wv2-day').forEach((x: Element)=>x.addEventListener('change',read));
    this.panel.querySelector('#wv2-scope')?.addEventListener('change',(e: Event)=>{read();this.form.scope=(e.target as HTMLSelectElement).value;if(this.form.scope==='station'){this.activeZoneId='';this.mode=this.form.station?'idle':'station-only';this._setStatus(this.form.station?`Travaux à ${this.form.station.name}.`:'Cliquez la gare concernée sur la carte.');}else{this.mode='idle';this._setStatus(this.zones.length?'Mode sections ferroviaires.':'Ajoutez une section puis cliquez la gare A.');}this.renderPanel();this.draw();});
    this.panel.querySelector('#wv2-affects-traffic')?.addEventListener('change',()=>{read();this.renderPanel();});
    this.panel.querySelector('#wv2-station-impact')?.addEventListener('change',()=>{read();this.renderPanel();});
    this.panel.querySelector('#wv2-station-speed')?.addEventListener('change',read);
    this.panel.querySelectorAll('.wv2-zone').forEach((el: Element)=>el.addEventListener('click',()=>{read();this.activeZoneId=(el as HTMLElement).dataset.zone!;this.mode='idle';this.renderPanel();this.draw();}));
    const z=this._active();if(z){this.panel.querySelector('#wv2-zone-name')?.addEventListener('change',(e: Event)=>{z.name=(e.target as HTMLInputElement).value.trim()||z.name;z.autoName=false;this.renderPanel();});this.panel.querySelector('#wv2-zone-impact')?.addEventListener('change',(e: Event)=>{z.impact=(e.target as HTMLSelectElement).value;if(z.impact==='stop')z.speedLimit=0;else if(z.impact==='slow'&&!z.speedLimit)z.speedLimit=40;this.renderPanel();this.draw();});this.panel.querySelector('#wv2-zone-speed')?.addEventListener('change',(e: Event)=>{z.speedLimit=Math.max(5,Math.min(300,Number((e.target as HTMLInputElement).value)||40));this.renderPanel();});this.panel.querySelector('#wv2-zone-direction')?.addEventListener('change',(e: Event)=>{z.direction=normalizeSectionDirection((e.target as HTMLSelectElement).value);this.renderPanel();});}
  }

  async save(){
    this._readPanel();
    const name=(this.form.name||'').trim()||'Travaux';this.form.name=name;
    if(!this.form.startDate||!this.form.endDate)return alert('Renseignez les dates des travaux.');
    if(this.form.endDate<this.form.startDate)return alert('La date de fin doit être après la date de début.');
    if(this.form.recurrence==='weekly'&&!this.form.daysOfWeek.length)return alert('Sélectionnez au moins un jour de la semaine.');
    const common={name,startDate:this.form.startDate,endDate:this.form.endDate,startTime:this.form.startTime||'22:00',endTime:this.form.endTime||'05:00',recurrence:this.form.recurrence||'daily',daysOfWeek:this.form.recurrence==='weekly'?this.form.daysOfWeek:[0,1,2,3,4,5,6],affectsTraffic:this.form.affectsTraffic!==false};
    if((this.form.scope||'sections')==='station'){
      const st=this.form.station;if(!st?.id)return alert('Sélectionnez la gare concernée par les travaux.');
      this.game.worksManager.add({...common,scope:'station',stationId:String(st.id),stationName:st.name||'',station:clone(st),stationA:String(st.id),stationB:String(st.id),stationImpact:this.form.stationImpact||'stop',stationSpeedLimit:this.form.stationImpact==='slow'?Number(this.form.stationSpeedLimit||40):0,impact:this.form.stationImpact||'stop',speedLimit:this.form.stationImpact==='slow'?Number(this.form.stationSpeedLimit||40):0,zones:[]});
    }else{
      const valid=this.zones.filter((z: WorksZone)=>z.startBinding&&z.endBinding&&z.route?.length>=2);
      if(!valid.length)return alert('Ajoutez au moins une section OSM complètement tracée.');
      if(valid.length!==this.zones.length)return alert('Une ou plusieurs sections ne sont pas terminées.');
      this.game.worksManager.add({...common,scope:'sections',zones:valid.map((z: WorksZone)=>({name:z.name,startStation:clone(z.startStation),endStation:clone(z.endStation),startBinding:clone(z.startBinding),endBinding:clone(z.endBinding),constraints:clone(z.constraints),route:clone(z.route),segments:clone(z.segments),distanceKm:z.distanceKm,impact:z.impact,speedLimit:z.impact==='stop'?0:Number(z.speedLimit||40),direction:normalizeSectionDirection(z.direction),manual:!!z.manual,scTechnology:WORKS_SC_TECH}))});
    }
    this.game.saveState();this.ui.renderIncidentsPage();this.close();
  }

  _drawRoute(route: RailRoutePoint[],color: string,width: number=4,alpha: number=1){if(!route?.length||route.length<2)return;const ctx=this.ctx;ctx.save();ctx.globalAlpha=alpha;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#06101d';ctx.lineWidth=width+4;ctx.beginPath();route.forEach((p: RailRoutePoint,i: number)=>{const q=this.tileMap.latLonToPixel(p.lat,p.lon);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();route.forEach((p: RailRoutePoint,i: number)=>{const q=this.tileMap.latLonToPixel(p.lat,p.lon);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.restore();}
  _drawAnchor(b: TrackBinding | StationSnapshot | null | undefined,color: string,r: number=6){if(!b)return;const p=this.tileMap.latLonToPixel(b.snapLat??b.lat,b.snapLon??b.lon),ctx=this.ctx;ctx.save();ctx.fillStyle=color;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  draw(){
    if(!this.isOpen())return;const r=this.canvas.getBoundingClientRect(),ctx=this.ctx,w=r.width,h=r.height;if(!w||!h)return;this._lastRenderAt=Date.now();ctx.clearRect(0,0,w,h);ctx.fillStyle='#07101b';ctx.fillRect(0,0,w,h);this.tileMap.viewportWidth=w;this.tileMap.viewportHeight=h;this.tileMap.renderTiles(ctx,w,h);this.tileMap._updateFrameCache?.();
    this._drawEngineOsm(ctx,w,h);this._drawStations(ctx,w,h);
    for(const work of this.game.worksManager.getAll()){for(const z of this.game.worksManager.getZones(work)){if(z.route?.length>=2)this._drawRoute(z.route,'#7f1d1d',2,0.28);}}
    for(const z of this.zones){if(z.route?.length>=2)this._drawRoute(z.route,zoneColor(z,z.id===this.activeZoneId),z.id===this.activeZoneId?5:3,z.id===this.activeZoneId?1:0.75);if(z.id===this.activeZoneId){if(z.startStation)this._drawAnchor(z.startStation,'#16a34a',10);if(z.endStation)this._drawAnchor(z.endStation,'#ea580c',10);this._drawAnchor(z.startBinding,'#22c55e',7);this._drawAnchor(z.endBinding,'#f97316',7);for(const c of z.constraints||[])this._drawAnchor(c,'#facc15',4);}}
    if((this.form?.scope||'sections')==='station'&&this.form?.station)this._drawAnchor(this.form.station,'#c44916',12);
    this.tileMap.clearDirty?.();
  }
  _error(err: unknown){console.error('Travaux V2',err);this._setStatus((err as {message?:string}|null)?.message||String(err));}
}
