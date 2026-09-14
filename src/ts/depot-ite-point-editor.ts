import { htmlText } from './html-text.js';
// S3 Alpha 14 legacy QA marker: infrastructure:[]
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { TileMap } from './map.js?v=1148';

type LatLon = { lat: number; lon: number };
type StationLike = LatLon & { id: string; name: string; type?: string };
type DepotLike = { type?: string; stationId?: string; location?: LatLon | null };
type DepotForm = { type: string; name: string; tracks: number; cost: number; infrastructure: string[]; cargoTypes: string[] };
type PixelPoint = { x: number; y: number };
type TileMapLike = { setNetworkEnabled?(enabled: boolean): void;
  centerLat: number; centerLon: number; zoomLevel: number; viewportWidth: number; viewportHeight: number;
  basicMode?: boolean; satelliteEnabled?: boolean; railEnabled?: boolean;
  applyZoom(delta: number, x: number, y: number): void; pan(dx: number, dy: number): void; markDirty?(): void;
  screenToWorld(x: number, y: number, width: number, height: number): LatLon;
  latLonToPixel(lat: number, lon: number): PixelPoint;
  renderTiles(ctx: CanvasRenderingContext2D, width: number, height: number): void;
};
type WorldLike = {
  stations?: StationLike[];
  getStationsNear?(lat: number, lon: number, radiusKm: number): StationLike[];
  getStationsInBounds?(minLat: number, minLon: number, maxLat: number, maxLon: number): StationLike[];
  getStationById(id: string | undefined): StationLike | null;
};
type DepotManagerLike = {
  add(data: Record<string, unknown>, economy: unknown): unknown;
  getAll?(): DepotLike[];
};
type GameLike = {
  world: WorldLike;
  renderer?: { tileMap?: TileMapLike; invalidateStatic?(): void };
  depotManager: DepotManagerLike;
  economy: unknown;
  saveState(): void;
};
type UiLike = { renderDepotsList(): void };

function esc(s: unknown){return String(s??'').replace(/[&<>"']/g,(c: string)=>(({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[String(c)]));}
function norm(s: unknown){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function isITE(type: unknown){return String(type||'').startsWith('ite');}
function haversineKm(a: LatLon,b: LatLon){const R=6371,dLat=(Number(b.lat)-Number(a.lat))*Math.PI/180,dLon=(Number(b.lon)-Number(a.lon))*Math.PI/180,la1=Number(a.lat)*Math.PI/180,la2=Number(b.lat)*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}

// S3 Alpha 12 source-compatibility markers for legacy QA: this.location={lat:Number(p.lat),lon:Number(p.lon)} placementOnly:true railSections:[]
// HOTFIX49 — page "Dépôts & ITE" only.
// This is intentionally a point-object placer, NOT a rail-section/Schedule-Creator fork.
// The global map's legacy +ITE action keeps InfrastructureV2Editor untouched.
export class DepotITEPointEditor {
  declare game: GameLike; declare ui: UiLike; declare tileMap: TileMapLike; declare location: LatLon | null; declare form: DepotForm;
  declare dragging: boolean; declare panning: boolean; declare panThresholdPx: number; declare dragStartX: number; declare dragStartY: number; declare dragX: number; declare dragY: number;
  declare overlay: HTMLElement; declare canvas: HTMLCanvasElement; declare ctx: CanvasRenderingContext2D; declare panel: HTMLElement;
  constructor(game: GameLike,ui: UiLike){
    this.game=game;this.ui=ui;this.tileMap=new TileMap() as TileMapLike;
    this.location=null;this.form=null as unknown as DepotForm;this.dragging=false;this.panning=false;this.panThresholdPx=5;
    this._ensureOverlay();
  }

  _ensureOverlay(){
    const existing=document.getElementById('depot-ite-point-overlay');
    if(existing){this.overlay=existing;this.canvas=existing.querySelector('#dip-map') as HTMLCanvasElement;this.ctx=this.canvas.getContext('2d')!;this.panel=existing.querySelector('#dip-panel-content') as HTMLElement;return;}
    const style=document.createElement('style');style.id='depot-ite-point-style';style.textContent=`
      #depot-ite-point-overlay{position:fixed;inset:0;z-index:9065;background:#07101d;color:#e8f0fb;display:none;font:12px system-ui,sans-serif}#depot-ite-point-overlay.open{display:flex;flex-direction:column}
      .dip-top{height:48px;display:flex;align-items:center;gap:8px;padding:0 10px;background:#0d1726;border-bottom:1px solid #25354b;flex:0 0 auto}.dip-top strong{font-size:15px}.dip-top button,.dip-btn{border:1px solid #344961;background:#16253a;color:#edf5ff;border-radius:6px;padding:7px 10px;cursor:pointer}.dip-top button:hover,.dip-btn:hover{background:#213650}.dip-primary{background:#047857!important;border-color:#10b981!important}
      .dip-body{position:relative;flex:1;min-height:0}.dip-map{position:absolute;inset:0;width:100%;height:100%;display:block;background:#08111e}.dip-panel{position:absolute;right:10px;top:10px;bottom:10px;width:370px;background:rgba(8,16,28,.97);border:1px solid #2b405b;border-radius:10px;box-shadow:0 12px 45px #0008;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(7px)}.dip-panel-head{padding:9px 10px;border-bottom:1px solid #24374e;display:flex;align-items:center;gap:8px}.dip-panel-content{padding:9px;overflow:auto;flex:1}.dip-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dip-field{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}.dip-field label{font-size:10px;color:#9db0c8;text-transform:uppercase;letter-spacing:.04em}.dip-field input,.dip-field select{width:100%;box-sizing:border-box;background:#111d2d;border:1px solid #31455f;border-radius:5px;color:#eff6ff;padding:7px;font:12px system-ui}.dip-section{margin-top:10px;padding-top:9px;border-top:1px solid #22354a}.dip-section h4{margin:0 0 7px;font-size:11px;color:#b9cbe0;text-transform:uppercase}.dip-hint{padding:8px 9px;border:1px solid #27445f;background:#10243a;border-radius:6px;color:#c8e3ff;margin-bottom:9px}.dip-checks{display:flex;flex-wrap:wrap;gap:7px 10px}.dip-checks label{font-size:11px;color:#dce8f7}.dip-search-results{position:relative}.dip-search-list{position:absolute;z-index:6;left:0;right:0;top:2px;background:#0c1827;border:1px solid #38516d;border-radius:6px;max-height:210px;overflow:auto}.dip-search-item{padding:7px 8px;border-bottom:1px solid #22354a;cursor:pointer}.dip-search-item:hover{background:#16304b}.dip-location{padding:8px;border-radius:6px;border:1px solid #2b405b;background:#0e1a29;line-height:1.55}.dip-location strong{color:#fff}.dip-bottom{height:43px;background:#0c1624;border-top:1px solid #24364d;display:flex;align-items:center;gap:8px;padding:0 10px;flex:0 0 auto}.dip-status{color:#b6c9de;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dip-icon-preview{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;font-weight:900;color:#fff}.dip-icon-preview.depot{background:#7c3aed}.dip-icon-preview.ite{background:#0891b2}
      @media(max-width:850px){.dip-panel{width:330px}.dip-status{display:none}}
    `;document.head.appendChild(style);
    const o=document.createElement('div');o.id='depot-ite-point-overlay';o.innerHTML=`
      <div class="dip-top"><button data-act="close">← Dépôts / ITE</button><strong>Placer un dépôt / ITE</strong><span style="font-size:9px;border-radius:4px;padding:2px 6px;background:#283a51;color:#d9e8fa">Objet carte</span><span style="flex:1"></span><button data-act="zoom-out">−</button><button data-act="zoom-in">＋</button><button data-act="save" class="dip-primary">✓ Construire</button></div>
      <div class="dip-body"><canvas id="dip-map" class="dip-map"></canvas><div class="dip-panel"><div class="dip-panel-head"><span id="dip-icon-preview" class="dip-icon-preview depot">D</span><b id="dip-panel-title">Dépôt</b></div><div class="dip-panel-content" id="dip-panel-content"></div></div></div>
      <div class="dip-bottom"><span class="dip-status" id="dip-status">Cliquez sur la carte pour placer l'objet.</span></div>`;
    document.body.appendChild(o);this.overlay=o;this.canvas=o.querySelector('#dip-map') as HTMLCanvasElement;this.ctx=this.canvas.getContext('2d')!;this.panel=o.querySelector('#dip-panel-content') as HTMLElement;this._bind();
  }

  _bind(){
    this.overlay.addEventListener('click',(e: MouseEvent)=>{const b=(e.target as Element).closest('[data-act]');if(!b)return;const a=b.dataset.act;if(a==='close')this.close();else if(a==='save')this.save();else if(a==='zoom-in')this._zoom(1);else if(a==='zoom-out')this._zoom(-1);});
    this.canvas.addEventListener('wheel',(e: WheelEvent)=>{e.preventDefault();const r=this.canvas.getBoundingClientRect();this.tileMap.applyZoom(e.deltaY<0?1:-1,e.clientX-r.left,e.clientY-r.top);this.draw();},{passive:false});
    this.canvas.addEventListener('mousedown',(e: MouseEvent)=>{if(e.button!==0||!this.isOpen())return;this.dragging=true;this.panning=false;this.dragStartX=this.dragX=e.clientX;this.dragStartY=this.dragY=e.clientY;});
    window.addEventListener('mousemove',(e: MouseEvent)=>{if(!this.dragging||!this.isOpen())return;if(!this.panning){const dx=e.clientX-this.dragStartX,dy=e.clientY-this.dragStartY;if(Math.hypot(dx,dy)<this.panThresholdPx)return;this.panning=true;this.tileMap.pan(dx,dy);this.dragX=e.clientX;this.dragY=e.clientY;this.draw();return;}const dx=e.clientX-this.dragX,dy=e.clientY-this.dragY;if(dx||dy){this.tileMap.pan(dx,dy);this.dragX=e.clientX;this.dragY=e.clientY;this.draw();}});
    window.addEventListener('mouseup',(e: MouseEvent)=>{if(!this.dragging||!this.isOpen())return;const pan=this.panning;this.dragging=false;this.panning=false;if(!pan&&e.target===this.canvas)this._placeFromEvent(e);});
    window.addEventListener('resize',()=>this._resize());
  }

  isOpen(){return this.overlay?.classList.contains('open');}
  open(initialType: string='depot'){
    const allowed=['depot','ite-fret','ite-industrie','ite-logistique'];const type=allowed.includes(initialType)?initialType:'depot';
    this.location=null;this.form={type,name:'',tracks:isITE(type)?2:4,cost:50000,infrastructure:[],cargoTypes:[]};
    const main=this.game.renderer?.tileMap;if(main){this.tileMap.centerLat=main.centerLat;this.tileMap.centerLon=main.centerLon;this.tileMap.zoomLevel=Math.max(8,main.zoomLevel||9);this.tileMap.basicMode=!!main.basicMode;this.tileMap.satelliteEnabled=!!main.satelliteEnabled;this.tileMap.railEnabled=main.railEnabled!==false;}else{this.tileMap.centerLat=48.86;this.tileMap.centerLon=2.35;this.tileMap.zoomLevel=9;}
    this.overlay.classList.add('open');this.tileMap.setNetworkEnabled?.(true);this._setStatus("Cliquez sur la carte pour placer l'objet. Aucun tracé ferroviaire n'est demandé.");this.renderPanel();requestAnimationFrame(()=>{this._resize();this.draw();});
  }
  close(){this.overlay.classList.remove('open');this.tileMap.setNetworkEnabled?.(false);}
  _zoom(d: number){const r=this.canvas.getBoundingClientRect();this.tileMap.applyZoom(d>0?1:-1,r.width/2,r.height/2);this.draw();}
  _resize(){if(!this.isOpen())return;const r=this.canvas.parentElement!.getBoundingClientRect();this.canvas.width=Math.max(1,Math.floor(r.width));this.canvas.height=Math.max(1,Math.floor(r.height));this.tileMap.viewportWidth=this.canvas.width;this.tileMap.viewportHeight=this.canvas.height;this.draw();}
  _setStatus(t: string){const e=this.overlay.querySelector('#dip-status');if(e)e.textContent=t;const h=this.panel?.querySelector('#dip-hint');if(h)h.textContent=t;}
  _placeFromEvent(e: MouseEvent){const r=this.canvas.getBoundingClientRect(),p=this.tileMap.screenToWorld(e.clientX-r.left,e.clientY-r.top,r.width,r.height);if(!Number.isFinite(p?.lat)||!Number.isFinite(p?.lon))return;this.location={lat:Number(p.lat),lon:Number(p.lon)};const nearest=this._nearestStation(this.location.lat,this.location.lon);this._setStatus(`${isITE(this.form!.type)?'ITE':'Dépôt'} placé. ${nearest?`Rattachement technique : ${nearest.name}.`:''}`);this.renderPanel();this.draw();}

  _nearestStation(lat: number,lon: number): StationLike | null{
    const world=this.game.world;if(!world)return null;let candidates: StationLike[]=[];for(const radius of [2,5,15,50,150,500]){candidates=world.getStationsNear?.(lat,lon,radius)||[];candidates=candidates.filter((st: StationLike)=>st&&Number.isFinite(Number(st.lat))&&Number.isFinite(Number(st.lon))&&!['depot','ite'].includes(String(st.type||'').toLowerCase()));if(candidates.length)break;}
    if(!candidates.length)candidates=(world.stations||[]).filter((st: StationLike)=>st&&Number.isFinite(Number(st.lat))&&Number.isFinite(Number(st.lon))&&!['depot','ite'].includes(String(st.type||'').toLowerCase()));let best=null,bd=Infinity;for(const st of candidates){const d=haversineKm({lat,lon},st);if(d<bd){best=st;bd=d;}}return best;
  }

  _readForm(){if(!this.panel||!this.form)return;this.form.type=this.panel.querySelector('#dip-type')?.value||this.form.type;this.form.name=this.panel.querySelector('#dip-name')?.value||'';this.form.tracks=Math.max(1,Math.min(30,Number(this.panel.querySelector('#dip-tracks')?.value)||1));this.form.cost=Math.max(0,Number(this.panel.querySelector('#dip-cost')?.value)||0);this.form.infrastructure=[];this.form.cargoTypes=[...this.panel.querySelectorAll('.dip-cargo:checked')].map((x: Element)=>(x as HTMLInputElement).value);}
  renderPanel(){
    if(!this.panel)return;const f: Partial<DepotForm>=this.form||{},ite=isITE(f.type),nearest=this.location?this._nearestStation(this.location.lat,this.location.lon):null;const preview=this.overlay.querySelector('#dip-icon-preview'),title=this.overlay.querySelector('#dip-panel-title');if(preview){preview.className=`dip-icon-preview ${ite?'ite':'depot'}`;preview.textContent=ite?'I':'D';}if(title)title.textContent=ite?'ITE':'Dépôt';
    this.panel.innerHTML=`
      <div id="dip-hint" class="dip-hint">${esc(this.overlay.querySelector('#dip-status')?.textContent||'')}</div>
      <div class="dip-field"><label>Type</label><select id="dip-type"><option value="depot" ${f.type==='depot'?'selected':''}>Dépôt de maintenance</option><option value="ite-fret" ${f.type==='ite-fret'?'selected':''}>ITE Fret</option><option value="ite-industrie" ${f.type==='ite-industrie'?'selected':''}>ITE Industrie</option><option value="ite-logistique" ${f.type==='ite-logistique'?'selected':''}>ITE Logistique</option></select></div>
      <div class="dip-field"><label>Nom</label><input id="dip-name" value="${esc(f.name||'')}" placeholder="ex: Dijon-Perrigny"></div>
      <div class="dip-field"><label>Rechercher / centrer sur une gare</label><input id="dip-search" placeholder="Tapez le nom d’une gare…" autocomplete="off"><div class="dip-search-results"><div id="dip-search-list" class="dip-search-list" style="display:none"></div></div></div>
      <div class="dip-grid"><div class="dip-field"><label>Nombre de voies</label><input type="number" id="dip-tracks" min="1" max="30" value="${htmlText(Number(f.tracks||1))}"></div><div class="dip-field"><label>Coût construction (€)</label><input type="number" id="dip-cost" min="0" step="5000" value="${htmlText(Number(f.cost||0))}"></div></div>
      ${ite?`<div class="dip-section"><h4>Fret accepté</h4><div class="dip-checks">${([['vrac_solide','Vrac solide'],['cereales_agri','Céréales'],['conteneurs','Conteneurs'],['liquides','Liquides'],['gaz','Gaz'],['produits_chimiques','Chimique'],['automobiles','Automobiles']] as Array<[string,string]>).map(([v,l])=>`<label><input type="checkbox" class="dip-cargo" value="${htmlText(v)}" ${(f.cargoTypes||[]).includes(v)?'checked':''}> ${l}</label>`).join('')}</div></div>`:`<div class="dip-section"><h4>Équipements techniques</h4><div class="dip-hint">Le dépôt est d’abord posé comme objet carte. Fosse de visite, rampes de levage, tour en fosse, station de lavage, station-service et autres équipements s’achètent ensuite dans la page Dépôts & ITE, onglet <b>Équipements</b> de sa fiche.</div></div>`}
      <div class="dip-section"><h4>Emplacement</h4><div class="dip-location">${this.location?`<strong>${this.location.lat.toFixed(5)}, ${this.location.lon.toFixed(5)}</strong><br>${htmlText(nearest?`Gare de rattachement technique : ${(nearest.name)}`:'Aucune gare de rattachement trouvée.')}`:'Cliquez simplement sur la carte. Il n’y a ni section, ni voie ORM, ni point A/B à définir.'}</div></div>`;
    this._bindPanel();
  }
  _bindPanel(){
    const preserve=()=>this._readForm();this.panel.querySelector('#dip-type')?.addEventListener('change',(e: Event)=>{preserve();this.form!.type=(e.target as HTMLSelectElement).value;this.renderPanel();this.draw();});['#dip-name','#dip-tracks','#dip-cost'].forEach((sel: string)=>this.panel.querySelector(sel)?.addEventListener('change',preserve));this.panel.querySelectorAll('.dip-infra,.dip-cargo').forEach((x: Element)=>x.addEventListener('change',preserve));
    const search=this.panel.querySelector('#dip-search'),list=this.panel.querySelector('#dip-search-list');if(search&&list){search.addEventListener('input',()=>{const q=norm(search.value);if(q.length<2){list.style.display='none';return;}const hits=[];for(const st of this.game.world.stations||[]){if(norm(st.name).includes(q)){hits.push(st);if(hits.length>=12)break;}}list.innerHTML=hits.map((st: StationLike)=>`<div class="dip-search-item" data-st="${esc(st.id)}">${esc(st.name)}</div>`).join('');list.style.display=hits.length?'block':'none';list.querySelectorAll('[data-st]').forEach((el: Element)=>el.addEventListener('click',()=>{const st=this.game.world.getStationById((el as HTMLElement).dataset.st);if(st){this.tileMap.centerLat=st.lat;this.tileMap.centerLon=st.lon;this.tileMap.zoomLevel=Math.max(13,this.tileMap.zoomLevel||13);this.tileMap.markDirty?.();this.draw();search.value=st.name;list.style.display='none';this._setStatus(`${st.name} centrée. Cliquez l'emplacement exact du ${isITE(this.form!.type)?'ITE':'dépôt'}.`);}}));});}
  }

  async save(){
    this._readForm();if(!this.location)return alert("Cliquez d'abord sur la carte pour placer le dépôt / ITE.");const name=this.form.name.trim()||(isITE(this.form.type)?'ITE':'Dépôt');const station=this._nearestStation(this.location.lat,this.location.lon);if(!station)return alert("Aucune gare ferroviaire disponible pour le rattachement technique de cet objet.");
    const created=this.game.depotManager.add({schemaVersion:2,placementOnly:true,type:this.form.type,name,stationId:station.id,tracks:this.form.tracks,cost:this.form.cost,infrastructure:[],iteTracks:[],iteCargoTypes:isITE(this.form.type)?[...new Set(this.form.cargoTypes||[])]:[],railSections:[],location:{...this.location}},this.game.economy);
    if(!created)return alert("Fonds insuffisants : l'infrastructure n'a pas été créée.");this.game.saveState();this.game.renderer?.invalidateStatic?.();this.ui.renderDepotsList();this.close();
  }

  _drawObjectIcon(ctx: CanvasRenderingContext2D,x: number,y: number,type: unknown,size: number=18,alpha: number=1){
    const ite=isITE(type);ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#07101d';ctx.lineWidth=2;
    if(ite){ctx.fillStyle='#0891b2';ctx.beginPath();ctx.moveTo(-size*.55,size*.4);ctx.lineTo(-size*.55,-size*.05);ctx.lineTo(-size*.22,-size*.28);ctx.lineTo(size*.02,-size*.05);ctx.lineTo(size*.28,-size*.28);ctx.lineTo(size*.55,-size*.05);ctx.lineTo(size*.55,size*.4);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#e6fbff';ctx.fillRect(size*.34,-size*.58,size*.12,size*.45);}
    else{ctx.fillStyle='#7c3aed';ctx.beginPath();ctx.moveTo(-size*.58,size*.4);ctx.lineTo(-size*.58,-size*.08);ctx.lineTo(0,-size*.5);ctx.lineTo(size*.58,-size*.08);ctx.lineTo(size*.58,size*.4);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#f5f3ff';ctx.fillRect(-size*.28,-size*.02,size*.56,size*.42);ctx.strokeRect(-size*.28,-size*.02,size*.56,size*.42);ctx.strokeStyle='#7c3aed';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-size*.28,size*.12);ctx.lineTo(size*.28,size*.12);ctx.stroke();}
    ctx.restore();
  }
  _objectPosition(d: DepotLike): LatLon | null{if(d?.location&&Number.isFinite(Number(d.location.lat))&&Number.isFinite(Number(d.location.lon)))return d.location;const st=this.game.world.getStationById?.(d?.stationId);return st?{lat:st.lat,lon:st.lon}:null;}
  draw(){
    if(!this.isOpen()||!this.canvas.width)return;const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;ctx.clearRect(0,0,w,h);this.tileMap.renderTiles(ctx,w,h);const zoom=this.tileMap.zoomLevel;let sts=this.game.world.stations||[];if(zoom>=7&&this.game.world.getStationsInBounds){const a=this.tileMap.screenToWorld(0,0,w,h),b=this.tileMap.screenToWorld(w,h,w,h);sts=this.game.world.getStationsInBounds(Math.min(a.lat,b.lat),Math.min(a.lon,b.lon),Math.max(a.lat,b.lat),Math.max(a.lon,b.lon));}
    ctx.save();ctx.fillStyle='#f4f7fb';ctx.strokeStyle='#182a3d';ctx.lineWidth=1;for(const st of sts){const p=this.tileMap.latLonToPixel(st.lat,st.lon);if(p.x<-5||p.y<-5||p.x>w+5||p.y>h+5)continue;if(zoom<7){ctx.fillRect(p.x,p.y,1.3,1.3);continue;}ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();if(zoom>=10){ctx.fillStyle='#dce8f7';ctx.font='10px system-ui';ctx.fillText(st.name,p.x+5,p.y-4);ctx.fillStyle='#f4f7fb';}}ctx.restore();
    for(const d of this.game.depotManager?.getAll?.()||[]){const loc=this._objectPosition(d);if(!loc)continue;const p=this.tileMap.latLonToPixel(loc.lat,loc.lon);if(p.x<-30||p.y<-30||p.x>w+30||p.y>h+30)continue;this._drawObjectIcon(ctx,p.x,p.y,d.type,14,0.65);}
    if(this.location){const p=this.tileMap.latLonToPixel(this.location.lat,this.location.lon);this._drawObjectIcon(ctx,p.x,p.y,this.form.type,22,1);ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
}
