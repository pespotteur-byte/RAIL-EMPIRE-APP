import os,shutil
import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'reexecution')))/'browser-deep';out.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or 'chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(10000);errors=[];console=[];dialogs=[]
  await page.route('**/*', lambda route: route.abort())
  page.on('dialog',lambda d: (dialogs.append(d.message), asyncio.create_task(d.dismiss())))
  print('browser ready',flush=True)
  page.on('console',lambda m:print(m.text,flush=True) if m.text.startswith('ROLLBACK_TEST') else None)
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
  print('login ready',errors,console[-3:],flush=True);await page.fill('#login-name','RE RC18 — Essai navigateur isolé');await page.click('#btn-new-game')
  print('clicked',errors,console[-3:],flush=True);await page.wait_for_function('window.game.running && window.game.ui',timeout=15000);print('game running',flush=True)
  await page.wait_for_timeout(600)

  await page.evaluate("()=>{game.running=false;game.engine.paused=true;clearInterval(game.autoSaveInterval);clearInterval(game._backgroundSimInterval);}")
  baseline=await page.evaluate("async()=>{if(game._saveWritePromise)await game._saveWritePromise;game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;return await game.storage.loadGame();}")
  await page.evaluate('(s)=>{window.__auditBaseline=s;}',baseline)
  results=[]
  def checkpoint():
   (out/'partial-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results[-1],ensure_ascii=False),flush=True)
  # Import a syntactically valid JSON file whose world payload cannot be iterated.
  before=await page.evaluate('({balance:game.economy.balance,company:game.account.companyName})')
  corrupt={'companyName':'AUDIT_IMPORT_CORROMPU','economy':{'balance':123.45},'world':{'nativeRefs':{}}}
  offset=len(dialogs)
  await page.set_input_files('#load-file-input',{'name':'audit-invalid.json','mimeType':'application/json','buffer':json.dumps(corrupt).encode()})
  await page.wait_for_timeout(400)
  after=await page.evaluate('({balance:game.economy.balance,company:game.account.companyName})')
  results.append({'id':'IMPORT-ATOMIC','expected':'Rejected import leaves the live game unchanged.','before':before,'after':after,'dialogs':dialogs[offset:],'pass':before==after});checkpoint()
  await page.evaluate('()=>{game.loadState(JSON.parse(JSON.stringify(__auditBaseline)));game.running=false;game.engine.paused=true;}')
  # The model rejects future schemas, but the outer import handler must also reject them.
  for section in ['scheduleV2','rotationsV2','v2Runtime']:
   invalid=json.loads(json.dumps(baseline));invalid['companyName']='AUDIT_SCHEMA_'+section;invalid[section]['schemaVersion']=999
   offset=len(dialogs)
   await page.set_input_files('#load-file-input',{'name':'audit-schema.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
   await page.wait_for_timeout(700)
   persisted=await page.evaluate('async(k)=>{const s=await game.storage.loadGame();return {company:game.account.companyName,storedSchema:s?.[k]?.schemaVersion};}',section)
   results.append({'id':'IMPORT-SCHEMA-'+section,'expected':'Future schema import is refused and not persisted.','actual':persisted,'dialogs':dialogs[offset:],'pass':persisted['storedSchema']!=999});checkpoint()
   await page.evaluate('()=>{game.loadState(JSON.parse(JSON.stringify(__auditBaseline)));game.running=false;game.engine.paused=true;}')
  # Interleave one legal receipt between the export snapshot and the next animation frame.
  export=await page.evaluate("""async()=>{
   const origFrame=window.requestAnimationFrame,origExport=game.storage.makeExportBlob;
   let calls=0,captured=null,exportFormat=null,exportBytes=null;const before=JSON.parse(JSON.stringify(game.economy.toSave()));
   try{
    window.requestAnimationFrame=(callback)=>origFrame.call(window,t=>{calls++;if(calls===2)game.economy.addRevenue(17,'fret','Audit: receipt between export frames');callback(t);});
    game.storage.makeExportBlob=async state=>{const result=await origExport.call(game.storage,state);exportFormat=result.ext;exportBytes=result.blob.size;const text=result.ext==='.json.gz'?await new Response(result.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text():await result.blob.text();captured=JSON.parse(text);return result;};
    await game.exportSaveFile();
    const saved=captured.economy,after=game.economy.toSave();
    return {frames:calls,exportFormat,exportBytes,realEncoder:true,before:{balance:before.balance,revenue:before.revenue,freight:before.revenueByCategory.fret||0},
     saved:{balance:saved.balance,revenue:saved.revenue,freight:saved.revenueByCategory.fret||0},
     after:{balance:after.balance,revenue:after.revenue,freight:after.revenueByCategory.fret||0},
     pass:Math.abs((saved.revenue-before.revenue)-((saved.revenueByCategory.fret||0)-(before.revenueByCategory.fret||0)))<1e-8};
   }finally{window.requestAnimationFrame=origFrame;game.storage.makeExportBlob=origExport;}
  }""")
  results.append({'id':'EXPORT-SNAPSHOT','expected':'Export captures all accounting fields at a single consistent instant.',**export});checkpoint()
  print('starting deep',flush=True)
  deep=await page.evaluate("""async()=>{
   const sections=[['economy','economy'],['world','world'],['rollingStock','rollingStock'],['rameManager','rames'],['scheduleV2','scheduleV2'],['rotationV2','rotationsV2'],['depotManager','depots'],['incidentManager','activeIncidents'],['worksManager','works'],['freightManager','freightContracts'],['orm','ormRoutes'],['lineManager','lines'],['sillonManager','sillons'],['voiePointManager','voiePoints'],['dashboard','dashboard'],['graphMarche','graphMarche'],['staffManager','staff'],['bank','bank'],['weather','weather'],['unions','unions'],['seasonal','seasonal'],['connections','connections'],['stationUpgrades','stationUpgrades'],['junctionManager','junctions'],['cargoTypes','cargoTypes'],['iteModules','iteModules'],['industrialClients','industrialClients'],['shuntingManager','shunting']];
   const clone=v=>JSON.parse(JSON.stringify(v));
   const dump=()=>JSON.stringify({parts:sections.map(([key])=>key==='incidentManager'?game[key].getActiveIncidentsSave():game[key].toSave()),clock:game.engine.toClockSave(),gameplay:game.gameplayClock.toSave(),rng:game.rng.getState(),cadence:game.incidentManager.getCadenceSave(),company:game.account.companyName});
   const rows=[];
   for(const [key,section] of sections){
    console.warn('ROLLBACK_TEST '+key);
    const before=dump(),manager=game[key],original=manager.loadFromSave;let called=false,error='';
    const owned=Object.prototype.hasOwnProperty.call(manager,'loadFromSave');
    manager.loadFromSave=function(...args){called=true;const result=original.apply(this,args);game.economy.balance+=9;this._auditMarker='bad';throw new Error('AUDIT injected '+key);};
    try{game.loadState(clone(__auditBaseline));}catch(e){error=e.message;}
    finally{if(owned)manager.loadFromSave=original;else delete manager.loadFromSave;}
    rows.push({id:'ROLLBACK-'+key,called,error,unchanged:dump()===before,markerRemoved:!('_auditMarker'in manager),pass:called&&!!error&&dump()===before&&!('_auditMarker'in manager)});
   }
   // A valid import may hydrate successfully but fail to commit to storage.
   const originalSave=game.storage.saveGame,before=dump(),storedBefore=JSON.stringify(await game.storage.loadGame());
   let rejected=false;game.storage.saveGame=async()=>false;
   try{const other=clone(__auditBaseline);other.economy.balance=123;other.companyName='NOT_COMMITTED';await game.importState(other);}catch(e){rejected=true;}finally{game.storage.saveGame=originalSave;}
   rows.push({id:'IMPORT-COMMIT-FAILURE',rejected,unchanged:dump()===before,storedUnchanged:JSON.stringify(await game.storage.loadGame())===storedBefore,pass:rejected&&dump()===before&&JSON.stringify(await game.storage.loadGame())===storedBefore});
   return rows;
  }""")
  results.extend(deep);checkpoint()
  await page.screenshot(path=str(out/'audit-import-state.png'))
  report={'target':'RC18 actual bundles after fixes','harness':'Real Chromium DOM and real UI input handlers; provided local assets injected; isolated in-memory Web Storage, no external network','results':results,'pageErrors':errors,'console':console}
  (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
  await b.close()
asyncio.run(asyncio.wait_for(main(),timeout=240))

raise SystemExit(0 if all(r['pass'] for r in json.loads((out/'results.json').read_text())['results']) else 1)
