import os,shutil
import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'QA/RE_REPAIR_RC20')))/'browser-liveries';out.mkdir(parents=True,exist_ok=True)
from PIL import Image,ImageDraw
cargo=Image.new('RGBA',(220,50),(0,0,0,0));d=ImageDraw.Draw(cargo);d.rectangle((0,0,219,49),fill=(173,42,32,255));d.rectangle((4,4,215,45),outline=(230,230,230,255),width=2)
for x in range(10,215,12):d.line((x,5,x,44),fill=(126,28,25,255),width=2)
cargo.save(out/'cargo.png')
replacement=Image.new('RGBA',(150,28),(0,0,0,0));d=ImageDraw.Draw(replacement);d.rectangle((0,2,149,20),fill=(200,40,45,255));d.rectangle((0,21,149,27),fill=(20,20,25,255));replacement.save(out/'replacement.png')
async def main():
 async with async_playwright()as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or 'chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(10000);errors=[];console=[]
  async def local_images(route):
   u=urlparse(route.request.url)
   f=(root/unquote(u.path).lstrip('/')).resolve()
   if u.netloc=='rail-empire.test' and u.path.startswith('/img/') and root in f.parents and f.is_file():
    import mimetypes
    await route.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream',headers={'Access-Control-Allow-Origin':'*'})
   else:await route.abort()
  await page.route('**/*',local_images)
  page.on('dialog',lambda d: asyncio.create_task(d.dismiss()))
  print('browser ready',flush=True)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append({'type':m.type,'text':m.text[:500]})if m.type in ['error','warning']else None)
  def file_text(src):
   u=urlparse(src)
   if u.netloc and u.netloc!='rail-empire.test':raise ValueError('Offline harness: external request not served')
   path=(root/unquote(u.path).lstrip('/')).resolve()
   if root not in path.parents or not path.is_file():raise FileNotFoundError(src)
   return path.read_text()
  await page.expose_function('__readProvidedAsset',file_text)
  html=(root/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I);html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
  html=html.replace('<head>','<head><base href="https://rail-empire.test/"><style>'+(root/'style.css').read_text()+'</style>')
  await page.set_content(html,wait_until='domcontentloaded');print('DOM ready',flush=True)
  await page.evaluate('''()=>{
   const memory=new Map();const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear(),key:i=>Array.from(memory.keys())[i],get length(){return memory.size;}};
   Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
   window.fetch=async(src)=>{const text=await window.__readProvidedAsset(String(src));return new Response(text,{status:200,headers:{'content-type':String(src).includes('.json')?'application/json':'text/plain'}});};
   const append=Node.prototype.appendChild;
   Node.prototype.appendChild=function(node){if(node.tagName==='SCRIPT'&&node.src){const src=node.src;window.__readProvidedAsset(src).then(code=>{node.removeAttribute('src');node.textContent=code;append.call(this,node);node.dispatchEvent(new Event('load'));}).catch(e=>{node.dispatchEvent(new Event('error'));});return node;}return append.call(this,node);};
  }''')
  for script in ['data/railnet/stations/manifest.js','data/railnet/tracks/manifest.js','js/rail-empire.file.bundle.js']:
   print('inject',script,flush=True);await page.add_script_tag(content=(root/script).read_text());print('injected',script,flush=True)
  await page.wait_for_function('window.game && document.querySelector("#btn-new-game")',timeout=10000)
  print('login ready',errors,console[-3:],flush=True);await page.fill('#login-name','RE RC20 — Essai navigateur isolé');await page.click('#btn-new-game')
  print('clicked',errors,console[-3:],flush=True);await page.wait_for_function('window.game.running && window.game.ui',timeout=15000);print('game running',flush=True)
  await page.wait_for_timeout(600)
  await page.evaluate('''()=>{game.running=false;game.engine.paused=true;game._replayPump?.cancel();}''')
  print('Preparing livery fixtures',flush=True)
  seed=await page.evaluate('''()=>{
   if(game.autoSaveInterval)clearInterval(game.autoSaveInterval);
   game.rollingStock.add({id:'__LIV_WAGON',name:'RC20 Wagon de démonstration',category:'wagon',imageData:'img/catalog/Wagons/Ks 55 6.gif',length:20,maxSpeed:120,mass:20,power:0});
   game.rollingStock.add({id:'__LIV_LOCO',name:'RC20 Locomotive de démonstration',category:'locomotive',imageData:'img/catalog/Wagons/Ks 55 6.gif',length:20,maxSpeed:120,mass:80,power:4000,traction:'diesel'});
   window.__catalogBefore=JSON.stringify(game.rollingStock.getById('__LIV_WAGON'));
   game.ui.switchPage('liveries');return {balance:game.economy.balance,catalogCount:game.rollingStock.getAll().length};
  }''')
  await page.fill('#liv-stock-search','__LIV_WAGON');await page.click('[data-liv-stock="__LIV_WAGON"]')
  await page.wait_for_function('document.querySelector("#liv-status").textContent.includes("Wagon prêt")')
  await page.set_input_files('#liv-file',str(out/'cargo.png'))
  await page.wait_for_function('!document.querySelector("#liv-save").disabled')
  await page.locator('#liv-x').focus();await page.keyboard.press('Control+a');await page.keyboard.type('-35');await page.keyboard.press('Tab');assert await page.locator('#liv-x').input_value()=='-35'
  await page.click('#liv-reset')
  initial=await page.locator('#liv-canvas').evaluate('(c)=>({width:c.width,height:c.height})')
  assert initial=={'width':221,'height':66},initial
  await page.fill('#liv-label','Conteneurs 001 <test>')
  for ident,value in [('liv-x','-35'),('liv-y','-58'),('liv-scale','150')]:await page.fill('#'+ident,value)
  await page.wait_for_timeout(120)
  canvas=page.locator('#liv-canvas');await canvas.scroll_into_view_if_needed();box=await canvas.bounding_box()
  await page.mouse.move(box['x']+120,box['y']+70);await page.mouse.down();await page.mouse.move(box['x']+140,box['y']+80,steps=4);await page.mouse.up();await page.wait_for_timeout(120)
  placement=await page.evaluate('({x:Number(document.querySelector("#liv-x").value),y:Number(document.querySelector("#liv-y").value),scale:Number(document.querySelector("#liv-scale").value)/100})')
  assert placement=={'x':-25,'y':-53,'scale':1.5},placement
  await canvas.focus();await page.keyboard.press('Shift+ArrowUp');await page.keyboard.press('ArrowRight');await page.wait_for_timeout(100)
  moved=await page.evaluate('({x:Number(document.querySelector("#liv-x").value),y:Number(document.querySelector("#liv-y").value)})')
  assert moved=={'x':-24,'y':-63},moved
  await page.mouse.move(box['x']+60,box['y']+40);await page.mouse.wheel(0,-100);await page.wait_for_timeout(120)
  assert await page.locator('#liv-scale').input_value()!='150'
  await page.fill('#liv-scale','150');await page.wait_for_timeout(100)
  before_png=await canvas.evaluate('(c)=>c.toDataURL("image/png")')
  import base64
  (out/'preview.png').write_bytes(base64.b64decode(before_png.split(',')[1]))
  async with page.expect_download() as info:await page.click('#liv-export')
  dl=await info.value;await dl.save_as(str(out/'export-wagon.png'))
  from PIL import Image,ImageChops
  a=Image.open(out/'preview.png').convert('RGBA');z=Image.open(out/'export-wagon.png').convert('RGBA')
  assert a.size==z.size and ImageChops.difference(a,z).getbbox() is None
  assert z.size==(330,91),z.size
  pixel=await page.evaluate('''async()=>{
   const {decodeLiveryImage}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/livery-canvas.js','');
   const b=await decodeLiveryImage('img/catalog/Wagons/Ks 55 6.gif'),expected=document.createElement('canvas'),actual=document.querySelector('#liv-canvas');expected.width=actual.width;expected.height=actual.height;
   const e=expected.getContext('2d'),o=game.ui._liveryEditor;e.imageSmoothingEnabled=false;
   // Independent reference formula for this known placement (-24,-63), scale 1.5.
   e.drawImage(o.cargoImage,0,12,330,75);e.drawImage(b,24,75);
   const aa=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,bb=e.getImageData(0,0,expected.width,expected.height).data;
   let differences=0,transparent=0;for(let i=0;i<aa.length;i++){if(aa[i]!==bb[i])differences++;if(i%4===3&&aa[i]===0)transparent++;}
   return {differences,transparent,exportWidth:actual.width,exportHeight:actual.height,wagonNativeWidth:b.naturalWidth,wagonNativeHeight:b.naturalHeight};
  }''')
  assert pixel['differences']==0 and pixel['transparent']>0,pixel
  await page.click('#liv-save');await page.wait_for_function('document.querySelector("#liv-status").textContent.includes("Livrée enregistrée")',timeout=30000)
  print('Pixel export and mouse/keyboard controls passed',flush=True)
  saved=await page.evaluate('''()=>{const r=game.liveries.all()[0];window.__wagonLivery=r.id;return {id:r.id,label:r.label,placement:r.placement,width:r.image.width,height:r.image.height,balance:game.economy.balance,catalogSame:__catalogBefore===JSON.stringify(game.rollingStock.getById('__LIV_WAGON')),assets:game.liveries.toSave().assets.length};}''')
  assert saved['balance']==seed['balance'] and saved['catalogSame'] and saved['label']=='Conteneurs 001 <test>'
  assert saved['placement']=={'x':-24,'y':-63,'scale':1.5},saved
  assert await page.locator('.liv-record b').text_content()=='Conteneurs 001 <test>'
  # Invalid upload must keep the last valid composition and record.
  (out/'invalid.png').write_text('not a PNG')
  await page.set_input_files('#liv-file',str(out/'invalid.png'));await page.wait_for_function('document.querySelector("#liv-status").textContent.includes("image lisible")')
  assert before_png==await canvas.evaluate('(c)=>c.toDataURL("image/png")')
  await page.locator('[data-liv-action="copy"]').first.click();await page.wait_for_function('game.liveries.size===2 && !game._liveryWriting')
  copied=await page.evaluate('({labels:game.liveries.all().map(r=>r.label),assets:game.liveries.toSave().assets.length})')
  assert copied['labels']==['Conteneurs 001 <test>','Conteneurs 002 <test>'] and copied['assets']==saved['assets'],copied
  await page.locator('[data-liv-action="edit"]').first.click();await page.wait_for_function('document.querySelector("#liv-status").textContent.includes("Livrée ouverte")')
  assert float(await page.locator('#liv-y').input_value())==-63
  # Inject a failed commit: no library or money mutation survives.
  failed=await page.evaluate('''async()=>{
   while(game._saveWritePromise)await game._saveWritePromise;
   const before=JSON.stringify(game.liveries.toSave()),balance=game.economy.balance,original=game.storage.saveGame;
   game.storage.saveGame=()=>Promise.resolve(false);let refused=false;
   try{await game.commitLiveryChange(()=>{game.liveries.put({...game.liveries.all()[0],label:'SHOULD NOT PERSIST'});});}catch(e){refused=String(e).includes('non enregistrée');}finally{game.storage.saveGame=original;}
   return {refused,libraryRestored:before===JSON.stringify(game.liveries.toSave()),balanceUnchanged:balance===game.economy.balance,unlocked:!game._liveryWriting};
  }''')
  assert all(failed.values()),failed
  # Other vehicle types: import only; no wagon or cargo layer, native dimensions.
  await page.click('#liv-new');await page.fill('#liv-stock-search','__LIV_LOCO');await page.click('[data-liv-stock="__LIV_LOCO"]')
  await page.set_input_files('#liv-file',str(out/'replacement.png'));await page.wait_for_function('!document.querySelector("#liv-save").disabled')
  assert await canvas.evaluate('(c)=>[c.width,c.height]')==[150,28]
  await page.fill('#liv-label','Locomotive rouge 001');await page.click('#liv-save');await page.wait_for_function('game.liveries.size===3 && !game._liveryWriting')
  replacement=await page.evaluate('''()=>{const r=game.liveries.all().at(-1);return {kind:r.kind,base:r.base,cargo:r.cargo,width:r.image.width,height:r.image.height};}''')
  assert replacement=={'kind':'replacement','base':None,'cargo':None,'width':150,'height':28},replacement
  # Per-element selection in the actual rame editor; original element stays original.
  await page.evaluate('''()=>{
   const w=game.rollingStock.getById('__LIV_WAGON'),l=game.rollingStock.getById('__LIV_LOCO');
   const details=[{...l,catalogId:l.id,elementId:'__EL_L'},{...w,catalogId:w.id,elementId:'__EL_W1'},{...w,catalogId:w.id,elementId:'__EL_W2'}];
   const rame=game.rameManager.add({id:'__RAME_LIV',name:'Fret 001',serialNumber:'R-0007',elements:details.map(e=>e.catalogId),elementDetails:details});
   for(let i=0;i<details.length;i++)game.rotationV2.materializeRameElement(rame,i,game.rollingStock.getById(details[i].catalogId));
   game.ui.switchPage('rames');game.ui.openRameEditor('__RAME_LIV');
  }''')
  await page.select_option('[data-rame-livery="1"]',saved['id'])
  element_selection=await page.evaluate('''()=>({selected:game.ui.currentRameElements[1].liveryId,original:game.ui.currentRameElements[2].liveryId||'',different:game.ui.currentRameElements[1].imageData!==game.ui.currentRameElements[2].imageData})''')
  assert element_selection=={'selected':saved['id'],'original':'','different':True},element_selection
  await page.click('#btn-save-rame');await page.wait_for_function('document.querySelector("#modal-rame").classList.contains("hidden")')
  await page.evaluate('''async()=>{while(game._saveWritePromise)await game._saveWritePromise;}''')
  print('Rame editor saved',flush=True)
  rame=await page.evaluate('''()=>{const r=game.rameManager.getById('__RAME_LIV');return {id:r.id,image:r.elementDetails[1].imageData,ref:r.elementDetails[1].liveryId,physical:game.rotationV2.vehicles.filter(v=>v.catalogId==='__LIV_WAGON').map(v=>({image:v.imageData,ref:v.liveryId}))};}''')
  assert rame['ref']==saved['id'] and rame['image'].startswith('data:image/png'),rame
  assert any(v['ref']==saved['id'] and v['image']==rame['image'] for v in rame['physical']),rame
  # Duplicating the rame generates unique display numbers without changing source.
  duplicate=await page.evaluate('''()=>{game.ui.duplicateRame('__RAME_LIV');return {name:document.querySelector('#rame-name').value,serial:document.querySelector('#rame-serial').value,ids:game.ui.currentRameElements.map(x=>x.elementId),originalIds:game.rameManager.getById('__RAME_LIV').elementDetails.map(x=>x.elementId),livery:game.ui.currentRameElements[1].liveryId};}''')
  assert duplicate['name']=='Fret 002' and duplicate['serial']=='R-0008' and not(set(duplicate['ids'])&set(duplicate['originalIds'])) and duplicate['livery']==saved['id'],duplicate
  await page.evaluate('''()=>{document.querySelector('#modal-rame').classList.add('hidden');}''')
  # Capture actual full export snapshot and load through actual game import boundary.
  roundtrip=await page.evaluate('''async()=>{
   while(game._saveWritePromise)await game._saveWritePromise;
   let state;const original=game.storage.saveGame;game.storage.saveGame=s=>{state=JSON.parse(JSON.stringify(s));return Promise.resolve(true);};
   try{game._saveStateNow();await game._saveWritePromise;}finally{game.storage.saveGame=original;}
   const images=game.liveries.all().map(r=>r.image.src),before=game.liveries.toSave();game.loadState(state);
   const r=game.rameManager.getById('__RAME_LIV'),savedElement=state.rames.find(r=>r.id==='__RAME_LIV').elementDetails[1];
   game.running=false;game.engine.paused=true;game._replayPump?.cancel();
   return {count:game.liveries.size,libraryEqual:JSON.stringify(before)===JSON.stringify(game.liveries.toSave()),imageRestored:r.elementDetails[1].imageData===images[0],savedAsReference:savedElement.liveryId===window.__wagonLivery&&!savedElement.imageData.startsWith('data:'),noCatalogueReplacement:game.rollingStock.getById('__LIV_WAGON').imageData==='img/catalog/Wagons/Ks 55 6.gif'};
  }''')
  assert roundtrip=={'count':3,'libraryEqual':True,'imageRestored':True,'savedAsReference':True,'noCatalogueReplacement':True},roundtrip
  # Export and reimport the actual gzip file through the real file input.
  async with page.expect_download() as exported:await page.evaluate('()=>game.exportSaveFile()')
  exported=await exported.value;portable=out/('game-export.gz' if exported.suggested_filename.endswith('.gz') else 'game-export.json');await exported.save_as(str(portable))
  import gzip
  portable_state=json.loads(gzip.decompress(portable.read_bytes()) if portable.suffix=='.gz' else portable.read_text())
  assert len(portable_state['liveries']['liveries'])==3
  await page.evaluate("()=>{game.liveries.put({...game.liveries.all()[0],label:'Temporary changed label'});}")
  await page.set_input_files('#load-file-input',str(portable))
  await page.wait_for_function('!game._importing && game.liveries.all()[0]?.label==="Conteneurs 001 <test>" && document.querySelector("#load-file-input").value===""',timeout=30000)
  portable_check=await page.evaluate('({records:game.liveries.size,linked:game.rameManager.getById("__RAME_LIV").elementDetails[1].liveryId===window.__wagonLivery,pngRestored:game.rameManager.getById("__RAME_LIV").elementDetails[1].imageData.startsWith("data:image/png")})')
  assert portable_check=={'records':3,'linked':True,'pngRestored':True},portable_check
  portable_check['compressedBytes']=portable.stat().st_size;portable_check['format']=portable.suffix
  await page.evaluate('''()=>{game.ui.switchPage('liveries');}''')
  await page.locator('[data-liv-action="edit"]').first.click();await page.wait_for_function('document.querySelector("#liv-status").textContent.includes("Livrée ouverte")')
  print('Full save/reload and numbering passed',flush=True)
  await page.screenshot(path=str(out/'rc20-liveries-desktop.png'),full_page=True)
  await page.set_viewport_size({'width':375,'height':900});await page.wait_for_timeout(150);await page.screenshot(path=str(out/'rc20-liveries-375.png'),full_page=True)
  viewport=await page.evaluate('({width:innerWidth,documentScroll:document.documentElement.scrollWidth,workshopRight:document.querySelector("#page-liveries").getBoundingClientRect().right,workshopClient:document.querySelector("#page-liveries").clientWidth})');assert viewport['workshopRight']<=viewport['width']+1,viewport
  await page.set_viewport_size({'width':1280,'height':900})
  await page.evaluate('''()=>{window.confirm=()=>true;}''')
  await page.locator('[data-liv-action="delete"]').first.click();await page.wait_for_function('game.liveries.size===2 && !game._liveryWriting')
  deletion=await page.evaluate('''()=>({restored:game.rameManager.getById('__RAME_LIV').elementDetails[1].imageData==='img/catalog/Wagons/Ks 55 6.gif',referenceCleared:!game.rameManager.getById('__RAME_LIV').elementDetails[1].liveryId,catalogueExists:!!game.rollingStock.getById('__LIV_WAGON'),physicalRestored:game.rotationV2.vehicles.filter(v=>v.catalogId==='__LIV_WAGON').every(v=>!v.liveryId&&v.imageData==='img/catalog/Wagons/Ks 55 6.gif')})''')
  assert all(deletion.values()),deletion
  result={'mode':'Real production bundle and browser Canvas; injected page, isolated storage/local resources; no external network','initialCanvas':initial,'dragPlacement':placement,'keyboardPlacement':moved,'pngPixelReference':pixel,'previewEqualsExport':True,'saved':saved,'copy':copied,'failedWrite':failed,'replacement':replacement,'selection':element_selection,'physicalImagesCount':len(rame['physical']),'duplicateRame':duplicate,'saveReload':roundtrip,'portableFileExportImport':portable_check,'viewport375':viewport,'deleteRestoresOriginal':deletion,'pageErrors':errors,'console':console[-30:]}
  (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));assert not errors,errors
  print(json.dumps(result,ensure_ascii=False,indent=2),flush=True);await b.close()
asyncio.run(main())
