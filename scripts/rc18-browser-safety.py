import os,shutil
import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'reexecution')))/'browser-safety';out.mkdir(parents=True,exist_ok=True)
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
  results=[]
  dashboard=await page.evaluate("""()=>{
   const eco=game.economy,old=eco.history,host=document.createElement('div');document.body.appendChild(host);
   const value='<b id="audit-category-markup">libellé importé</b>';
   try{eco.history=[{type:'revenue',amount:17,category:value,description:'test RC18'}];game.dashboard.render(host,game);
    return {literal:host.textContent.includes(value),injectedElement:!!host.querySelector('#audit-category-markup'),pass:host.textContent.includes(value)&&!host.querySelector('#audit-category-markup')};
   }finally{eco.history=old;host.remove();}
  }""")
  results.append({'id':'FINANCIAL-CATEGORY-HTML',**dashboard})
  if not os.environ.get('ONLY_DASHBOARD'):
   locked=await page.evaluate("""async()=>{
    if(game._saveWritePromise)await game._saveWritePromise;game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;
    const snapshot=await game.storage.loadGame(),oldSave=game.storage.saveGame;let release,entered,calls=0;
    const barrier=new Promise(resolve=>release=resolve),gate=new Promise(resolve=>entered=resolve);
    game.storage.saveGame=async data=>{calls++;entered();await barrier;return oldSave.call(game.storage,data);};
    let secondRejected=false,autosaveHeld=false,paused=false,modalOpen=false;
    try{
     const first=game.importState(snapshot);await gate;
     try{await game.importState(snapshot);}catch(e){secondRejected=true;}
     const auto=game._saveStateNow();autosaveHeld=auto==null&&calls===1;paused=game.engine.paused&&!game.running;modalOpen=!!document.querySelector('[data-re-import-lock]')?.open;
     release();await first;
     return {secondRejected,autosaveHeld,paused,modalOpen,modalRemoved:!document.querySelector('[data-re-import-lock]'),calls,unlocked:!game._importing,pass:secondRejected&&autosaveHeld&&paused&&modalOpen&&calls===1&&!game._importing&&!document.querySelector('[data-re-import-lock]')};
    }finally{release();game.storage.saveGame=oldSave;}
   }""")
   results.append({'id':'IMPORT-CONCURRENCY-AND-AUTOSAVE',**locked})
   occupied=await page.evaluate("""async()=>{
    const {RescueMovement}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/rescue-movement.js','');
    const {Rame}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/rame.js','');
    const c=game.cantonManager,id='__RC18_OCCUPIED_RESCUE';
    const r=new Rame({id:'R_OCC',name:'Test',elementDetails:[{elementId:'L_OCC',category:'locomotive',traction:'diesel',length:20,mass:84,power:2400,maxSpeed:100}]});
    const actor=new RescueMovement(id,r,game.world,game.weather);
    const route=[{lat:40,lon:2,maxSpeed:100},{lat:40.01,lon:2,maxSpeed:100}];
    const assignments=c.createRouteCantons(route),cid=assignments[0].cantonId;c.occupy(cid,id);game.depotManager._rescueMovements.set(id,actor);
    const original=game.incidentManager.loadFromSave;game.incidentManager.loadFromSave=function(){throw new Error('Late rejected import with occupied rescue');};
    const baseline=JSON.parse(JSON.stringify(await game.storage.loadGame()));let rejected=false;
    try{game.loadState(baseline);}catch(e){rejected=true;}finally{delete game.incidentManager.loadFromSave;}
    const result={rejected,occupiedBy:c.cantons.get(cid)?.occupiedBy,tracked:c.getTrackedCantons(id).has(cid),sameActor:game.depotManager._rescueMovements.get(id)===actor};
    result.pass=rejected&&result.occupiedBy===id&&result.tracked&&result.sameActor;
    c.releaseAll(id);game.depotManager._rescueMovements.delete(id);return result;
   }""")
   results.append({'id':'FAILED-IMPORT-KEEPS-ACTIVE-RESCUE-CANTONS',**occupied})
   cadence=await page.evaluate("""async()=>{
    const {IncidentManager}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/incidents.js','');
    const m=game.incidentManager;m._incidentSpawnCredit=.8333333333333334;m._incidentSpawnLastAbsMinute=12345678;m.lastCheck='2026-09-12:123';m._weatherSampleCursor=42;
    if(game._saveWritePromise)await game._saveWritePromise;game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;
    const saved=JSON.parse(JSON.stringify(await game.storage.loadGame())),expected=JSON.stringify(m.getCadenceSave());
    game.incidentManager=new IncidentManager();game.loadState(saved);
    const actual=JSON.stringify(game.incidentManager.getCadenceSave());
    return {newManager:game.incidentManager!==m,savedSchema:saved.incidentCadence?.schemaVersion,exact:expected===actual,pass:game.incidentManager!==m&&saved.incidentCadence?.schemaVersion===1&&expected===actual};
   }""")
   results.append({'id':'REAL-MAIN-FRESH-INCIDENT-MANAGER',**cadence})
  report={'target':str(root),'harness':'Actual Chromium DOM and real bundles. Network disabled, memory WebStorage. The concurrency test pauses the storage callback before calling its real encoder.','results':results,'pageErrors':errors}
  (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
  await b.close()
asyncio.run(asyncio.wait_for(main(),timeout=180))
raise SystemExit(0 if all(r['pass'] for r in json.loads((out/'results.json').read_text())['results']) else 1)
