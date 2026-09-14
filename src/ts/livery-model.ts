/** User liveries are visual overlays, never catalogue replacements or vehicles. */
export interface LiveryImage { src: string; width: number; height: number }
export interface LiveryPlacement { x: number; y: number; scale: number }
export interface LiveryDefinition {
  id: string; catalogId: string; label: string; kind: 'wagon' | 'replacement';
  base: LiveryImage | null; cargo: LiveryImage | null; image: LiveryImage;
  placement: LiveryPlacement; anchorX: number; anchorY: number; createdAt: string;
}
export interface LiveryTarget { physicalVehicleId?: string; elementId?: string; liveryId?: string; catalogId?: string; stockId?: string; imageData?: string; originalImageData?: string }
export interface CompositeFrame { width: number; height: number; left: number; top: number; baseX: number; baseY: number; cargoX: number; cargoY: number; cargoWidth: number; cargoHeight: number }
export const LIVERY_MAX_SIDE = 8192;
export const LIVERY_MAX_PIXELS = 16777216;
export function assertImageSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > LIVERY_MAX_SIDE || height > LIVERY_MAX_SIDE || width * height > LIVERY_MAX_PIXELS) throw new Error('Image trop grande ou invalide : maximum 8192 px par côté et 16 mégapixels. Réduisez la taille ou le placement.');
}
export function isSafeLiverySource(src: string): boolean {
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) return true;
  try {
    const path=decodeURIComponent(src);
    return path.startsWith('img/') && !path.split('/').some(p=>p==='..'||p==='.') && !/[\\?#%\x00-\x1f]/.test(path) && /\.(?:png|jpe?g|gif|webp)$/i.test(path);
  } catch { return false; }
}
function object(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Livrée : objet attendu.');
  return value as Record<string,unknown>;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Livrée : ${label} invalide.`); return value;
}
function checkedImage(value: unknown): LiveryImage {
  const v=object(value);const width=finite(v.width,'largeur'),height=finite(v.height,'hauteur');assertImageSize(width,height);
  if(typeof v.src!=='string'||!isSafeLiverySource(v.src))throw new Error('Livrée : source image non autorisée (images locales ou raster importé uniquement).');
  return {src:v.src,width,height};
}
export function compositeFrame(base: Pick<LiveryImage,'width'|'height'>, cargo: Pick<LiveryImage,'width'|'height'>, placement: LiveryPlacement): CompositeFrame {
  assertImageSize(base.width,base.height);assertImageSize(cargo.width,cargo.height);
  const x=finite(placement.x,'X'),y=finite(placement.y,'Y'),scale=finite(placement.scale,'échelle');
  if(scale<=0)throw new Error('L’échelle du chargement doit être positive.');
  const cw=cargo.width*scale,ch=cargo.height*scale;
  // Reserve wagon + scaled load height, then expand further if dragged outside.
  // Never shrink, stretch or clip either source to fit the other.
  const left=Math.floor(Math.min(0,x)),top=Math.floor(Math.min(-ch,y));
  const right=Math.ceil(Math.max(base.width,x+cw)),bottom=Math.ceil(Math.max(base.height,y+ch));
  const width=right-left,height=bottom-top;assertImageSize(width,height);
  return {width,height,left,top,baseX:left===0?0:-left,baseY:top===0?0:-top,cargoX:x-left,cargoY:y-top,cargoWidth:cw,cargoHeight:ch};
}
export function defaultLiveryPlacement(base: Pick<LiveryImage,'width'|'height'>, cargo: Pick<LiveryImage,'width'|'height'>): LiveryPlacement {
  return {x:(base.width-cargo.width)/2,y:-cargo.height,scale:1};
}
function checkDefinition(value: unknown): LiveryDefinition {
  const v=object(value);
  for(const key of ['id','catalogId','label','createdAt'])if(typeof v[key]!=='string'||!String(v[key]).trim())throw new Error(`Livrée : ${key} manquant.`);
  if(v.kind!=='wagon'&&v.kind!=='replacement')throw new Error('Type de livrée invalide.');
  const p=object(v.placement),placement={x:finite(p.x,'X'),y:finite(p.y,'Y'),scale:finite(p.scale,'échelle')};
  if(placement.scale<=0)throw new Error('Échelle invalide.');
  const base=v.base==null?null:checkedImage(v.base),cargo=v.cargo==null?null:checkedImage(v.cargo),image=checkedImage(v.image);
  const anchorX=finite(v.anchorX,'ancre X'),anchorY=finite(v.anchorY,'ancre Y');
  if(v.kind==='wagon'){
    if(!base||!cargo)throw new Error('Le wagon et son chargement sont requis.');
    const frame=compositeFrame(base,cargo,placement);
    if(frame.width!==image.width||frame.height!==image.height||frame.baseX!==anchorX||frame.baseY!==anchorY)throw new Error('Les dimensions exportées ne correspondent pas à la composition.');
  }
  return {id:String(v.id),catalogId:String(v.catalogId),label:String(v.label).trim(),kind:v.kind,base,cargo,image,placement,anchorX,anchorY,createdAt:String(v.createdAt)};
}
export class LiveryLibrary {
  private records = new Map<string,LiveryDefinition>();
  private sequence=0;
  private byCatalog = new Map<string,LiveryDefinition[]>();
  get size(): number { return this.records.size; }
  get(id: string): LiveryDefinition | undefined { return this.records.get(id); }
  all(): LiveryDefinition[] { return Array.from(this.records.values()); }
  compatible(catalogId: unknown): readonly LiveryDefinition[] { return this.byCatalog.get(String(catalogId)) || []; }
  private reindex(): void { this.byCatalog.clear();for(const r of this.records.values()){const a=this.byCatalog.get(r.catalogId)||[];a.push(r);this.byCatalog.set(r.catalogId,a);} }
  newId(): string { let id:string;do{id=`livery-${Date.now().toString(36)}-${(++this.sequence).toString(36)}`;}while(this.records.has(id));return id; }
  put(value: LiveryDefinition): LiveryDefinition {
    const record=checkDefinition(value),old=this.records.get(record.id);
    if(old&&old.catalogId!==record.catalogId)throw new Error('Une livrée existante ne peut pas changer de matériel de base.');
    this.records.set(record.id,record);this.reindex();return record;
  }
  remove(id: string): void { this.records.delete(id);this.reindex(); }
  apply(target: LiveryTarget, original?: string, strict=false): void {
    const record=target.liveryId?this.get(target.liveryId):undefined;
    const catalogId=String(target.catalogId||target.stockId||'');
    if(target.liveryId&&(!record||record.catalogId!==catalogId)){
      if(strict)throw new Error(`Livrée absente ou incompatible : ${target.liveryId}`);
      target.liveryId='';
    }
    if(record&&record.catalogId===catalogId){
      if(target.originalImageData===undefined)target.originalImageData=original??target.imageData??'';
      target.imageData=record.image.src;
    }else if(target.originalImageData!==undefined){target.imageData=target.originalImageData;}
  }
  select(target: LiveryTarget, id: string, original?: string): void {
    const record=id?this.get(id):null;
    if(id&&(!record||record.catalogId!==String(target.catalogId||target.stockId||'')))throw new Error('Cette livrée ne correspond pas à ce matériel.');
    if(target.originalImageData===undefined)target.originalImageData=original??target.imageData??'';
    target.liveryId=id;this.apply(target,original,true);
  }
  /** Asset strings are stored once in the library; vehicles only store liveryId.
   * No arbitrary cap on liveries, and no eviction/truncation of user creations. */
  toSave(): {schemaVersion:1;assets:LiveryImage[];liveries:Record<string,unknown>[]} {
    const assets:LiveryImage[]=[],index=new Map<string,number>();
    const ref=(image:LiveryImage|null):number|null=>{if(!image)return null;const key=`${image.width}:${image.height}:${image.src}`;let i=index.get(key);if(i===undefined){i=assets.length;assets.push({...image});index.set(key,i);}return i;};
    const liveries=this.all().map(r=>({...r,placement:{...r.placement},base:ref(r.base),cargo:ref(r.cargo),image:ref(r.image)}));
    return {schemaVersion:1,assets,liveries};
  }
  loadFromSave(value: unknown): void {
    if(value==null){this.records.clear();this.byCatalog.clear();return;}
    const v=object(value);if(v.schemaVersion!==1||!Array.isArray(v.assets)||!Array.isArray(v.liveries))throw new Error('Livrées : format de sauvegarde incompatible.');
    const assets=v.assets.map(checkedImage),next=new Map<string,LiveryDefinition>();
    const resolve=(ref:unknown,optional=false):LiveryImage|null=>{if(ref===null&&optional)return null;if(typeof ref!=='number'||!Number.isInteger(ref)||!assets[ref])throw new Error('Livrée : référence image invalide.');return assets[ref]!;};
    for(const raw of v.liveries){const r=object(raw),record=checkDefinition({...r,base:resolve(r.base,true),cargo:resolve(r.cargo,true),image:resolve(r.image)});if(next.has(record.id))throw new Error('Identifiant de livrée dupliqué.');next.set(record.id,record);}
    this.records=next;this.reindex();
  }
}
export function saveLiveryTarget<T extends LiveryTarget>(element: T): T {
  // Keep the original sprite as the explicit fallback. Custom raster belongs
  // to the library and must not be copied into every wagon in the save.
  return element.liveryId ? {...element,imageData:element.originalImageData||''} : element;
}

/** Copy appearance only, never physical properties or catalogue identity. */
export function copyLiveryAppearance(target:LiveryTarget, source:LiveryTarget):void {
  if(String(target.catalogId||target.stockId||'')!==String(source.catalogId||source.stockId||''))return;
  for(const key of ['liveryId','imageData','originalImageData'] as const){
    if(source[key]===undefined)delete target[key];else target[key]=source[key];
  }
}
