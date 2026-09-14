import { assertImageSize, compositeFrame, isSafeLiverySource, type LiveryImage, type LiveryPlacement, type CompositeFrame } from './livery-model.js';
export async function decodeLiveryImage(source: string): Promise<HTMLImageElement> {
  if(!isSafeLiverySource(source))throw new Error('Format image non autorisé.');
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{assertImageSize(image.naturalWidth,image.naturalHeight);resolve(image);}catch(e){reject(e);}};image.onerror=()=>reject(new Error('Image illisible ou fichier du catalogue introuvable.'));if(!source.startsWith('data:'))image.crossOrigin='anonymous';image.src=source;});
}
export function drawLivery(canvas: HTMLCanvasElement, base: HTMLImageElement|null, cargo: HTMLImageElement, placement: LiveryPlacement): CompositeFrame|null {
  let frame:CompositeFrame|null=null;
  if(base){frame=compositeFrame({width:base.naturalWidth,height:base.naturalHeight},{width:cargo.naturalWidth,height:cargo.naturalHeight},placement);canvas.width=frame.width;canvas.height=frame.height;}
  else{assertImageSize(cargo.naturalWidth,cargo.naturalHeight);canvas.width=cargo.naturalWidth;canvas.height=cargo.naturalHeight;}
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D indisponible.');
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  // First cargo, then RE sprite. The checkerboard is CSS, never exported.
  if(frame&&base){ctx.drawImage(cargo,frame.cargoX,frame.cargoY,frame.cargoWidth,frame.cargoHeight);ctx.drawImage(base,frame.baseX,frame.baseY);}
  else ctx.drawImage(cargo,0,0);
  return frame;
}
export function canvasPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  assertImageSize(canvas.width,canvas.height);
  return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Échec de l’export PNG : mémoire graphique insuffisante.')),'image/png');}catch(e){reject(e);}});
}
export function blobDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Lecture de l’image impossible.'));reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Image illisible.'));reader.readAsDataURL(blob);});
}
export async function canvasAsset(canvas: HTMLCanvasElement): Promise<LiveryImage> {return {src:await blobDataURL(await canvasPNG(canvas)),width:canvas.width,height:canvas.height};}
export async function importLiveryImage(file: File): Promise<{asset:LiveryImage;image:HTMLImageElement}> {
  if(file.size>32*1024*1024)throw new Error('Image trop lourde (maximum 32 Mio par import).');
  if(!/\.(?:png|jpe?g|gif|webp|bmp)$/i.test(file.name)|| (file.type&&!/^image\/(?:png|jpeg|gif|webp|bmp|x-ms-bmp)$/.test(file.type)))throw new Error('Importez une image PNG, JPEG, GIF, WebP ou BMP. Les SVG ne sont pas acceptés.');
  const url=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Ce fichier ne contient pas une image lisible.'));image.src=url;});
    assertImageSize(image.naturalWidth,image.naturalHeight);
    const canvas=document.createElement('canvas');drawLivery(canvas,null,image,{x:0,y:0,scale:1});
    const asset=await canvasAsset(canvas);canvas.width=canvas.height=1;
    return {asset,image:await decodeLiveryImage(asset.src)};
  }finally{URL.revokeObjectURL(url);}
}
export function downloadLiveryPNG(blob: Blob, label: string): void {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(label.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim()||'livree')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
