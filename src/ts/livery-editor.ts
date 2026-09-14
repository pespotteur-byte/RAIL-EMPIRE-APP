import { htmlText } from './html-text.js';
import { LabelAllocator } from './duplicate-tools.js';
import { LiveryLibrary, compositeFrame, defaultLiveryPlacement, type LiveryImage, type LiveryPlacement, type LiveryDefinition, type LiveryTarget } from './livery-model.js';
import { decodeLiveryImage, importLiveryImage, drawLivery, canvasAsset, canvasPNG, downloadLiveryPNG } from './livery-canvas.js';
export interface LiveryCatalogItem { id: string; name: string; category: string; imageData?: string }
export interface LiveryEditorHost {
  library: LiveryLibrary;
  catalog: () => LiveryCatalogItem[];
  commit: (change: () => void) => Promise<void>;
  targets: () => LiveryTarget[];
  ensureCatalog?: () => Promise<unknown> | unknown;
}
/** Event-driven editor. No animation loop, network map or per-train work. */
export class LiveryEditor {
  private selected: LiveryCatalogItem | null = null;
  private editingId = '';
  private baseAsset: LiveryImage | null = null;
  private cargoAsset: LiveryImage | null = null;
  private baseImage: HTMLImageElement | null = null;
  private cargoImage: HTMLImageElement | null = null;
  private placement: LiveryPlacement = {x:0,y:0,scale:1};
  private request = 0;
  private frameRequest = 0;
  private busy = false;
  private placementValid = true;
  private active = true;
  private page = 0;
  private stockPage = 0;
  private readonly perPage = 24;
  private drag: {pointerId:number;clientX:number;clientY:number;x:number;y:number;factorX:number;factorY:number} | null = null;
  private canvas: HTMLCanvasElement;
  constructor(private readonly root: HTMLElement, private readonly host: LiveryEditorHost) {
    root.innerHTML=`<div class="liv-header"><div><h2>Livrées</h2><p>Vos variantes visuelles, sans remplacer ni acheter le matériel d’origine.</p></div><button class="btn-primary" id="liv-new">+ Nouvelle livrée</button></div>
    <div class="liv-workspace"><section class="liv-card"><h3>1 · Choisir le matériel RE</h3><div class="liv-filters"><input id="liv-stock-search" type="search" placeholder="Nom, série ou identifiant du matériel" aria-label="Rechercher le matériel"><select id="liv-stock-category" aria-label="Catégorie"><option value="">Tout le matériel</option value="wagon">Wagons</option><option value="locomotive">Locomotives</option><option value="automotrice">Automotrices</option><option value="voiture">Voitures</option></select></div><div id="liv-stock-results" class="liv-stock-results"></div><div class="liv-pager"><button id="liv-stock-prev">←</button><output id="liv-stock-count"></output><button id="liv-stock-next">→</button><button id="liv-stock-refresh">Actualiser</button></div></section>
    <section class="liv-card liv-editor"><h3>2 · Composer la livrée</h3><p id="liv-selected">Sélectionnez un matériel à gauche.</p><label class="liv-field">Nom ou numéro de la livrée<input id="liv-label" type="text" autocomplete="off" placeholder="Ex. Conteneur rouge 001"></label><label class="liv-field"><span id="liv-file-label">Image du chargement (wagon) ou nouvelle image (autre matériel)</span><input id="liv-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"></label><p class="liv-note">PNG, JPEG, GIF, WebP ou BMP. Le wagon RE reste au premier plan ; le chargement passe derrière. Une image opaque masque ce qui est derrière elle.</p>
    <div id="liv-position" class="liv-placement"><label>X (px)<input id="liv-x" type="number" step="1" value="0"></label><label>Y (px)<input id="liv-y" type="number" step="1" value="0"></label><label>Échelle (%)<input id="liv-scale" type="number" min="1" max="10000" step="1" value="100"></label><button id="liv-reset">Réinitialiser le placement</button></div>
    <div class="liv-preview-tools"><span>Glisser le chargement · molette : taille · flèches : 1 px (Maj : 10)</span><label>Zoom aperçu<select id="liv-zoom"><option value="1">100 %</option><option value="2" selected>200 %</option><option value="4">400 %</option><option value="8">800 %</option></select></label></div>
    <div class="liv-preview"><canvas id="liv-canvas" width="1" height="1" tabindex="0" aria-label="Positionner le chargement, glisser ou utiliser les flèches"></canvas></div><output id="liv-dimensions">Aucune image chargée.</output><div class="liv-actions"><button class="btn-primary" id="liv-save" disabled>Enregistrer la livrée</button><button id="liv-export" disabled>Exporter PNG</button></div><p id="liv-status" role="status" aria-live="polite"></p></section></div>
    <section class="liv-card liv-library"><div class="liv-library-title"><h3>Vos livrées</h3><input id="liv-search" type="search" placeholder="Rechercher une livrée" aria-label="Rechercher une livrée"></div><p class="liv-note">Aucune limite de nombre dans RE. Les créations sont incluses dans votre sauvegarde de partie. Le quota du navigateur et la mémoire restent les limites réelles.</p><div id="liv-records" class="liv-records"></div><div class="liv-pager"><button id="liv-prev">← Précédentes</button><output id="liv-count"></output><button id="liv-next">Suivantes →</button></div></section>`;
    this.canvas=this.el<HTMLCanvasElement>('liv-canvas');
    this.el('liv-new').addEventListener('click',()=>{if(!this.busy)this.clear();});
    for(const id of ['liv-stock-search','liv-stock-category'])this.el(id).addEventListener('input',()=>{this.stockPage=0;this.renderCatalog();});
    this.el('liv-stock-prev').addEventListener('click',()=>{this.stockPage=Math.max(0,this.stockPage-1);this.renderCatalog();});
    this.el('liv-stock-next').addEventListener('click',()=>{this.stockPage++;this.renderCatalog();});
    this.el('liv-stock-refresh').addEventListener('click',()=>{void this.refreshCatalog();});
    this.el('liv-stock-results').addEventListener('click',event=>{const button=(event.target as Element|null)?.closest<HTMLButtonElement>('[data-liv-stock]');if(button&&!this.busy){const item=this.host.catalog().find(x=>String(x.id)===button.dataset.livStock);if(item)void this.choose(item);}});
    this.el<HTMLInputElement>('liv-file').addEventListener('change',()=>{const input=this.el<HTMLInputElement>('liv-file'),file=input.files?.[0];input.value='';if(file)void this.upload(file);});
    for(const id of ['liv-x','liv-y','liv-scale'])this.el(id).addEventListener('input',()=>{if(!this.busy)this.readPlacement();});
    this.el('liv-reset').addEventListener('click',()=>{if(this.busy||!this.baseAsset||!this.cargoAsset)return;this.placement=defaultLiveryPlacement(this.baseAsset,this.cargoAsset);this.placementValid=true;this.writePlacement();this.render();});
    this.el('liv-zoom').addEventListener('change',()=>this.sizePreview());
    this.el('liv-save').addEventListener('click',()=>{void this.save();});
    this.el('liv-export').addEventListener('click',()=>{void this.export();});
    this.el('liv-search').addEventListener('input',()=>{this.page=0;this.renderLibrary();});
    this.el('liv-prev').addEventListener('click',()=>{this.page=Math.max(0,this.page-1);this.renderLibrary();});
    this.el('liv-next').addEventListener('click',()=>{this.page++;this.renderLibrary();});
    this.el('liv-records').addEventListener('click',event=>{const b=(event.target as Element|null)?.closest<HTMLButtonElement>('[data-liv-action]');if(b&&!this.busy)void this.recordAction(b.dataset.livAction||'',b.dataset.livId||'');});
    this.bindCanvas();this.show();
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T {const result=this.root.querySelector('#'+id) as T | null;if(!result)throw new Error('Contrôle livrées introuvable : '+id);return result;}
  private message(text:string,error=false):void {const el=this.el('liv-status');el.textContent=text;el.classList.toggle('liv-error',error);}
  setActive(value:boolean):void{this.active=value;if(!value){this.drag=null;if(this.frameRequest)cancelAnimationFrame(this.frameRequest);this.frameRequest=0;}}
  dispose():void{this.request++;this.setActive(false);}
  show():void{this.active=true;this.renderCatalog();this.renderLibrary();this.render();}
  private async refreshCatalog():Promise<void>{try{await this.host.ensureCatalog?.();this.renderCatalog();}catch(e){this.message(String(e),true);}}
  private setBusy(value:boolean):void{
    this.busy=value;
    (this.root.querySelectorAll('button,input,select') as NodeListOf<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>).forEach(e=>{e.disabled=value;});
    if(!value){this.renderCatalog();this.renderLibrary();this.render();}
  }
  private clear():void {
    this.request++;this.editingId='';this.selected=null;this.baseAsset=this.cargoAsset=null;this.baseImage=this.cargoImage=null;this.placement={x:0,y:0,scale:1};this.placementValid=true;
    this.el<HTMLInputElement>('liv-label').value='';this.el('liv-selected').textContent='Sélectionnez un matériel à gauche.';this.writePlacement();this.render();this.message('');
  }
  private renderCatalog():void {
    const query=this.el<HTMLInputElement>('liv-stock-search').value.trim().toLocaleLowerCase(),category=this.el<HTMLSelectElement>('liv-stock-category').value;
    const matches=this.host.catalog().filter(item=>(!category||item.category===category)&&(!query||`${item.name} ${item.id}`.toLocaleLowerCase().includes(query)));
    const pages=Math.max(1,Math.ceil(matches.length/this.perPage));this.stockPage=Math.max(0,Math.min(this.stockPage,pages-1));
    this.el('liv-stock-results').innerHTML=matches.slice(this.stockPage*this.perPage,(this.stockPage+1)*this.perPage).map(item=>`<button class="liv-stock" data-liv-stock="${htmlText(item.id)}" ${this.busy?'disabled':''}><span><b>${htmlText(item.name)}</b><small>${htmlText(item.category)} · ${htmlText(item.id)}</small></span>${item.imageData?`<img loading="lazy" src="${htmlText(item.imageData)}" alt="">`:'<small>Sans image</small>'}</button>`).join('')||'<p>Aucun matériel trouvé.</p>';
    this.el('liv-stock-count').textContent=`${matches.length.toLocaleString('fr-FR')} matériels · ${this.stockPage+1}/${pages}`;
    this.el<HTMLButtonElement>('liv-stock-prev').disabled=this.busy||this.stockPage===0;this.el<HTMLButtonElement>('liv-stock-next').disabled=this.busy||this.stockPage+1>=pages;
  }
  private renderLibrary():void{
    const query=this.el<HTMLInputElement>('liv-search').value.trim().toLocaleLowerCase();const rows=this.host.library.all().filter(r=>!query||`${r.label} ${r.catalogId}`.toLocaleLowerCase().includes(query));
    const pages=Math.max(1,Math.ceil(rows.length/this.perPage));this.page=Math.max(0,Math.min(this.page,pages-1));
    this.el('liv-records').innerHTML=rows.slice(this.page*this.perPage,(this.page+1)*this.perPage).map(r=>`<article class="liv-record"><div class="liv-thumb"><img loading="lazy" src="${htmlText(r.image.src)}" alt="${htmlText(r.label)}"></div><b>${htmlText(r.label)}</b><small>${htmlText(r.catalogId)} · ${r.image.width} × ${r.image.height} px</small><div>${[['edit','Modifier'],['copy','Dupliquer'],['delete','Supprimer']].map(([action,label])=>`<button data-liv-id="${htmlText(r.id)}" data-liv-action="${action}" ${this.busy?'disabled':''}>${label}</button>`).join('')}</div></article>`).join('')||'<p>Aucune livrée enregistrée.</p>';
    this.el('liv-count').textContent=`${rows.length} livrée(s) · page ${this.page+1}/${pages}`;this.el<HTMLButtonElement>('liv-prev').disabled=this.busy||this.page===0;this.el<HTMLButtonElement>('liv-next').disabled=this.busy||this.page+1>=pages;
  }
  private async choose(item:LiveryCatalogItem):Promise<void>{
    const token=++this.request;this.editingId='';this.selected=item;this.baseImage=this.cargoImage=null;this.baseAsset=this.cargoAsset=null;this.placement={x:0,y:0,scale:1};this.placementValid=true;this.writePlacement();this.render();
    this.el<HTMLInputElement>('liv-label').value='';this.el('liv-selected').textContent=`${item.name} · ${item.id}`;this.el('liv-file-label').textContent=item.category==='wagon'?'Importer le chargement (derrière le wagon RE)':'Importer la nouvelle image de ce matériel';
    this.message(item.category==='wagon'?'Chargement du wagon RE…':'Importez la nouvelle image, puis donnez un nom ou un numéro.');
    if(item.category==='wagon'){
      try{if(!item.imageData)throw new Error('Ce wagon n’a pas d’image dans le catalogue.');const image=await decodeLiveryImage(item.imageData);if(token!==this.request)return;this.baseImage=image;this.baseAsset={src:item.imageData,width:image.naturalWidth,height:image.naturalHeight};this.message('Wagon prêt. Importez le chargement à placer derrière.');this.render();}
      catch(e){if(token===this.request)this.message(String(e),true);}
    }
  }
  private async upload(file:File):Promise<void>{
    if(this.busy)return;if(!this.selected){this.message('Choisissez d’abord le matériel RE.',true);return;}
    if(this.selected.category==='wagon'&&!this.baseImage){this.message('Attendez le chargement du wagon RE ou choisissez une image disponible.',true);return;}
    const token=++this.request;this.setBusy(true);this.message('Lecture de l’image…');
    try{const loaded=await importLiveryImage(file);if(token!==this.request)return;
      const next=this.baseAsset?defaultLiveryPlacement(this.baseAsset,loaded.asset):{x:0,y:0,scale:1};
      if(this.baseAsset)compositeFrame(this.baseAsset,loaded.asset,next);
      this.cargoImage=loaded.image;this.cargoAsset=loaded.asset;this.placement=next;this.placementValid=true;this.writePlacement();this.render();this.message('Image prête. Déplacez le chargement dans l’aperçu ; l’export conserve ses proportions.');
    }catch(e){if(token===this.request)this.message(e instanceof Error?e.message:String(e),true);}
    finally{if(token===this.request)this.setBusy(false);}
  }
  private readPlacement():void {
    const next={x:this.el<HTMLInputElement>('liv-x').valueAsNumber,y:this.el<HTMLInputElement>('liv-y').valueAsNumber,scale:this.el<HTMLInputElement>('liv-scale').valueAsNumber/100};
    if(!this.baseAsset||!this.cargoAsset)return;
    try{compositeFrame(this.baseAsset,this.cargoAsset,next);this.updatePlacement(next);}
    catch(e){this.placementValid=false;this.message(e instanceof Error?e.message:String(e),true);this.render();}
  }
  private writePlacement():void{this.el<HTMLInputElement>('liv-x').value=String(this.placement.x);this.el<HTMLInputElement>('liv-y').value=String(this.placement.y);this.el<HTMLInputElement>('liv-scale').value=String(Math.round(this.placement.scale*10000)/100);}
  private updatePlacement(next:LiveryPlacement):void{
    if(!this.baseAsset||!this.cargoAsset)return;
    try{compositeFrame(this.baseAsset,this.cargoAsset,next);this.placementValid=true;this.placement=next;this.writePlacement();this.scheduleRender();this.message('');}
    catch(e){this.writePlacement();this.message(e instanceof Error?e.message:String(e),true);}
  }
  private scheduleRender():void{if(this.frameRequest||!this.active)return;this.frameRequest=requestAnimationFrame(()=>{this.frameRequest=0;this.render();});}
  private sizePreview():void{const zoom=Number(this.el<HTMLSelectElement>('liv-zoom').value)||1;this.canvas.style.width=`${this.canvas.width*zoom}px`;this.canvas.style.height=`${this.canvas.height*zoom}px`;}
  private render():void{
    this.el('liv-position').hidden=this.selected?.category!=='wagon';
    const ready=!!this.cargoImage&&(this.selected?.category!=='wagon'||!!this.baseImage);
    this.el<HTMLButtonElement>('liv-save').disabled=this.busy||!ready||!this.placementValid;this.el<HTMLButtonElement>('liv-export').disabled=this.busy||!ready||!this.placementValid;
    if(!ready||!this.cargoImage){this.canvas.width=this.baseImage?.naturalWidth||1;this.canvas.height=this.baseImage?.naturalHeight||1;const ctx=this.canvas.getContext('2d');if(ctx&&this.baseImage)ctx.drawImage(this.baseImage,0,0);this.sizePreview();this.el('liv-dimensions').textContent='Importez une image pour composer la livrée.';return;}
    try{drawLivery(this.canvas,this.baseImage,this.cargoImage,this.placement);this.sizePreview();this.el('liv-dimensions').textContent=`Export PNG : ${this.canvas.width} × ${this.canvas.height} px · transparent · proportions conservées`;}catch(e){this.message(String(e),true);this.el<HTMLButtonElement>('liv-save').disabled=true;this.el<HTMLButtonElement>('liv-export').disabled=true;}
  }
  private bindCanvas():void{
    this.canvas.addEventListener('pointerdown',event=>{if(this.busy||!this.baseImage||!this.cargoImage||event.button!==0)return;const rect=this.canvas.getBoundingClientRect();this.drag={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:this.placement.x,y:this.placement.y,factorX:this.canvas.width/rect.width,factorY:this.canvas.height/rect.height};this.canvas.setPointerCapture(event.pointerId);this.canvas.focus();event.preventDefault();});
    this.canvas.addEventListener('pointermove',event=>{const d=this.drag;if(!d||event.pointerId!==d.pointerId)return;this.updatePlacement({x:Math.round(d.x+(event.clientX-d.clientX)*d.factorX),y:Math.round(d.y+(event.clientY-d.clientY)*d.factorY),scale:this.placement.scale});});
    const end=()=>{this.drag=null;};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('lostpointercapture',end);
    this.canvas.addEventListener('wheel',event=>{if(this.busy||!this.baseImage||!this.cargoImage)return;event.preventDefault();const scale=Math.max(.01,Math.min(100,Math.round(this.placement.scale*Math.exp(-event.deltaY*.001)*10000)/10000));this.updatePlacement({...this.placement,scale});},{passive:false});
    this.canvas.addEventListener('keydown',event=>{if(this.busy||!this.baseImage||!this.cargoImage)return;const step=event.shiftKey?10:1,offset:{[key:string]:[number,number]}={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]},d=offset[event.key];if(d){event.preventDefault();this.updatePlacement({...this.placement,x:this.placement.x+d[0],y:this.placement.y+d[1]});}});
  }
  private async save():Promise<void>{
    if(this.busy||!this.placementValid||!this.selected||!this.cargoImage||!this.cargoAsset)return;
    const label=this.el<HTMLInputElement>('liv-label').value.trim();if(!label){this.message('Donnez un nom ou un numéro à la livrée.',true);return;}
    const token=this.request;this.setBusy(true);this.message('Enregistrement…');
    try{
      const canvas=document.createElement('canvas'),frame=drawLivery(canvas,this.baseImage,this.cargoImage,this.placement),image=await canvasAsset(canvas);canvas.width=canvas.height=1;
      if(token!==this.request)return;
      const id=this.editingId||this.host.library.newId();
      const record:LiveryDefinition={id,catalogId:String(this.selected.id),label,kind:this.selected.category==='wagon'?'wagon':'replacement',base:this.baseAsset,cargo:this.baseAsset?this.cargoAsset:null,image,placement:{...this.placement},anchorX:frame?.baseX||0,anchorY:frame?.baseY||0,createdAt:this.host.library.get(id)?.createdAt||new Date().toISOString()};
      await this.host.commit(()=>{this.host.library.put(record);});this.editingId=id;this.renderLibrary();this.message('Livrée enregistrée. Elle est sélectionnable pour chaque véhicule dans l’éditeur de rame.');
    }catch(e){this.message(e instanceof Error?e.message:String(e),true);}finally{this.setBusy(false);}
  }
  private async export():Promise<void>{
    if(this.busy||!this.placementValid||!this.cargoImage)return;this.setBusy(true);
    try{const canvas=document.createElement('canvas');drawLivery(canvas,this.baseImage,this.cargoImage,this.placement);const blob=await canvasPNG(canvas);canvas.width=canvas.height=1;downloadLiveryPNG(blob,this.el<HTMLInputElement>('liv-label').value||this.selected?.name||'livree');this.message('PNG exporté aux dimensions exactes de la composition.');}
    catch(e){this.message(String(e),true);}finally{this.setBusy(false);}
  }
  private async recordAction(action:string,id:string):Promise<void>{
    const record=this.host.library.get(id);if(!record)return;
    if(action==='edit'){
      const token=++this.request;this.setBusy(true);this.message('Ouverture de la livrée…');
      try{const base=record.base?await decodeLiveryImage(record.base.src):null,cargoAsset=record.kind==='wagon'?record.cargo:record.image;if(!cargoAsset)throw new Error('Chargement manquant.');const cargo=await decodeLiveryImage(cargoAsset.src);if(token!==this.request)return;
        const item=this.host.catalog().find(x=>String(x.id)===record.catalogId)||{id:record.catalogId,name:record.catalogId,category:record.kind==='wagon'?'wagon':'locomotive'};
        this.selected=item;this.editingId=id;this.baseAsset=record.base;this.cargoAsset=cargoAsset;this.baseImage=base;this.cargoImage=cargo;this.placement={...record.placement};this.placementValid=true;this.el<HTMLInputElement>('liv-label').value=record.label;this.el('liv-selected').textContent=`${item.name} · ${item.id}`;this.el('liv-file-label').textContent=record.kind==='wagon'?'Remplacer le chargement':'Remplacer l’image de la livrée';this.writePlacement();this.render();this.message('Livrée ouverte. Les changements seront appliqués après enregistrement.');this.el('liv-selected').scrollIntoView({block:'center'});
      }catch(e){this.message(String(e),true);}finally{this.setBusy(false);}return;
    }
    if(action==='delete'){
      const count=this.host.targets().filter(t=>t.liveryId===id).length;
      if(!confirm(`Supprimer « ${record.label} » ?${count?' Les véhicules qui l’utilisent retrouveront leur image d’origine.':''} Le matériel du catalogue est conservé.`))return;
      this.setBusy(true);try{await this.host.commit(()=>{for(const t of this.host.targets())if(t.liveryId===id)this.host.library.select(t,'');this.host.library.remove(id);});if(this.editingId===id)this.clear();this.message('Livrée supprimée ; matériel d’origine conservé.');}catch(e){this.message(String(e),true);}finally{this.setBusy(false);}return;
    }
    if(action==='copy'){
      this.setBusy(true);try{const label=new LabelAllocator(this.host.library.all().map(r=>r.label),true).next(record.label);await this.host.commit(()=>{this.host.library.put({...record,id:this.host.library.newId(),label,createdAt:new Date().toISOString(),placement:{...record.placement}});});this.message('Livrée dupliquée, sans dupliquer le matériel ni les fichiers image.');}catch(e){this.message(String(e),true);}finally{this.setBusy(false);}
    }
  }
}
