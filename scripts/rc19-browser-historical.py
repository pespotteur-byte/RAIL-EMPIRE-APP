import os,shutil
import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'reexecution')))/'browser-historique';out.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or 'chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(10000);errors=[];console=[]
  await page.route('**/*', lambda route: route.abort())
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
  print('login ready',errors,console[-3:],flush=True);await page.fill('#login-name','RE RC19 — Essai navigateur isolé');await page.click('#btn-new-game')
  print('clicked',errors,console[-3:],flush=True);await page.wait_for_function('window.game.running && window.game.ui',timeout=15000);print('game running',flush=True)
  await page.wait_for_timeout(600)
  state=await page.evaluate('({running:game.running,stations:game.world.stations.length,page:game.ui.activePage,clock:!!game.gameplayClock,modules:Object.keys(__RAIL_EMPIRE_FILE_BUNDLE__.modules).length})')
  pages=await page.evaluate('Array.from(document.querySelectorAll("[data-page]")).map(x=>({id:x.dataset.page,text:x.textContent.trim().slice(0,50)}))')
  nav=[]
  for item in pages:
   ident=item['id']
   if ident in ['map','rolling-stock','rames','schedules','rotations','lines','depots','infogare','staff','weather','dashboard','incidents','graph-marche','cargo-types','industrial-clients']:
    try:
     print('page',ident,flush=True);await page.evaluate('(id)=>game.ui.switchPage(id)',ident);await page.wait_for_timeout(400);nav.append({'target':ident,'active':await page.evaluate('game.ui.activePage')})
    except Exception as e:nav.append({'target':ident,'error':str(e)[:500]})
  assert all(x.get('target') == x.get('active') for x in nav), nav
  await page.evaluate("game.ui.switchPage('schedules')")
  await page.click('#btn-schedule-connections');await page.wait_for_selector('#re-connections-dialog')
  await page.click('#re-connections-dialog [data-policy="flexible"]')
  connectionDialog=await page.evaluate('({open:!!document.querySelector("#re-connections-dialog"),policy:game.connections.waitPolicy,hasArrivalHook:typeof game.connections.onArrival==="function"})')
  await page.click('#re-connections-dialog [data-close-connections]')
  await page.evaluate("game.ui.switchPage('map')")
  diagnostic=await page.evaluate("""()=>{
   const original=game.staffManager.tickWorkforce;
   const count=()=>game.diagnostics.snapshot().find(x=>x.code==='STAFF_WORKFORCE')?.count||0;
   const before=count();
   try{
    game.staffManager.tickWorkforce=()=>{throw new Error('RC11 test <b>simulé</b>');};
    game.tick(game.timeOfDay,game._currentDate||game.engine.getParisDate(),{});
   }finally{game.staffManager.tickWorkforce=original;}
   game.ui._lastV2SidebarDiagAt=0;game.ui.updateV2RuntimeSidebar();
   const box=document.querySelector('#v2-runtime-sidebar-status');
   return {countDelta:count()-before,running:game.running,visible:box.textContent.includes('STAFF_WORKFORCE'),literalText:box.textContent.includes('<b>simulé</b>'),injectedBoldElement:Array.from(box.querySelectorAll('b')).some(x=>x.textContent==='simulé')};
  }""")
  assert diagnostic['countDelta']==1 and diagnostic['running'] and diagnostic['visible'] and diagnostic['literalText'] and not diagnostic['injectedBoldElement'],diagnostic
  bankCheck=await page.evaluate("""()=>{
   const bank=game.bank,e=game.economy,bankSave=bank.toSave(),economySave=e.toSave(),confirmBefore=window.confirm;
   const host=document.createElement('div');document.body.appendChild(host);
   try {
    bank.loans=[];bank.startingBalance=20000000;e.balance=20000000;
    window.confirm=()=>true;bank.render(host,game);
    const button=host.querySelector('[data-type="mega"]');const disabled=button.disabled;button.click();
    return {buttonDisabled:disabled,loans:bank.loans.length,principal:bank.loans[0]?.principal,balance:e.balance};
   } finally { window.confirm=confirmBefore;bank.loadFromSave(bankSave);e.loadFromSave(economySave);host.remove(); }
  }""")
  assert not bankCheck['buttonDisabled'] and bankCheck['loans']==1 and bankCheck['principal']==10000000 and bankCheck['balance']==30000000,bankCheck
  saveCheck=await page.evaluate("""async()=>{
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   if(game._saveWritePromise)await game._saveWritePromise;
   const rame=game.rameManager.add({id:'__RC11_SAVE_R',name:'Maintenance persistence probe',totalKmRun:10000,kmSinceLastMaint:10000,wearLevel:40});
   const world={stations:[],getStationById:()=>null};
   const svc=new ActiveService({id:'__RC11_SAVE_S',rameId:rame.id,name:'prepared before maintenance',stops:[]},rame,world,null);
   svc.state='waiting';svc.active=true;svc.train.totalKmRun=10000;svc.train.kmSinceLastMaint=10000;svc.train.wearLevel=40;
   game.scheduleCreator.services.push(svc);game.scheduleCreator._invalidateActiveCache();
   rame.kmSinceLastMaint=0;rame.wearLevel=0;
   const original=game.storage.saveGame;let captured;
   try {
    game.storage.saveGame=state=>{captured=state;return Promise.resolve(true);};
    game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;
    const saved=captured.rames.find(r=>r.id===rame.id);
    return {material:{km:rame.kmSinceLastMaint,wear:rame.wearLevel},train:{km:svc.train.kmSinceLastMaint,wear:svc.train.wearLevel},saved:{km:saved.kmSinceLastMaint,wear:saved.wearLevel},total:saved.totalKmRun};
   } finally {game.storage.saveGame=original;game.scheduleCreator.removeService(svc.id);game.rameManager.remove(rame.id);}
  }""")
  assert saveCheck=={'material':{'km':0,'wear':0},'train':{'km':0,'wear':0},'saved':{'km':0,'wear':0},'total':10000},saveCheck
  trackIdentityCheck=await page.evaluate("""()=>{
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   const a={id:'__RC11_BIND_A',name:'A',lat:45,lon:2,platforms:3},b={id:'__RC11_BIND_B',name:'B',lat:45.01,lon:2,platforms:3};
   const world={stations:[a,b],getStationById:id=>id===a.id?a:id===b.id?b:null};
   const list=[];
   const make=(id,label,way)=>{
    const r={id:'R'+id,maxSpeed:100,totalMass:100,totalPower:2000,totalLength:100,elements:[],elementDetails:[]};
    const identity={kind:'osm',id:way,trackRef:'',lat:a.lat,lon:a.lon};
    const t=game.timeOfDay;
    const svc=new ActiveService({id,rameId:r.id,v2OccurrenceId:'O'+id,v2RotationId:'ROT'+id,v2BaseDate:game.engine.getParisDate(),routes:[[{lat:a.lat,lon:a.lon,wayId:way,maxSpeed:100},{lat:b.lat,lon:b.lon,wayId:way,maxSpeed:100}]],stops:[{stationId:a.id,type:'arret',arrivalTime:t,departureTime:t,lat:a.lat,lon:a.lon,platform:label,trackIdentity:identity},{stationId:b.id,type:'arret',arrivalTime:t+10,departureTime:t+10,lat:b.lat,lon:b.lon}]},r,world,null);
    svc.state='waiting';svc.position={lat:a.lat,lon:a.lon};game.scheduleCreator.services.push(svc);list.push(svc);return svc;
   };
   try {
    const first=make('__RC11_BIND_1','Alpha','bind100'),renamed=make('__RC11_BIND_2','Beta','bind100'),separate=make('__RC11_BIND_3','Alpha','bind101');
    const reserve=s=>s._reserveArrivalResources(a,s.stops[0]);
    const firstGranted=reserve(first),renameBlocked=!reserve(renamed),otherTrackGranted=reserve(separate);
    first._beginDepartureResourceHold(a.id);first.totalDistance=.005;first._releaseDepartureResourcesIfTailClear();const rearStillProtected=!reserve(renamed);
    const snap=game.scheduleV2Runtime.toSave().services.find(s=>s.id===first.id);const savedPhysicalId=snap?.departureResourceHold?.trackIdentity?.id;
    first.totalDistance=.200;first._releaseDepartureResourcesIfTailClear();const releasedAfterRear=reserve(renamed);
    return {firstGranted,renameBlocked,otherTrackGranted,rearStillProtected,releasedAfterRear,savedPhysicalId,visibleName:renamed.train.platform,used:game.platformManager.getStatus(a.id).used};
   } finally {for(const s of list){s._releaseAllPhysicalResources();game.scheduleCreator.removeService(s.id);}}
  }""")
  assert trackIdentityCheck=={'firstGranted':True,'renameBlocked':True,'otherTrackGranted':True,'rearStillProtected':True,'releasedAfterRear':True,'savedPhysicalId':'bind100','visibleName':'Beta','used':2},trackIdentityCheck
  print('track identity',trackIdentityCheck,flush=True)
  # One real ActiveService in the actual game loop, not a synthetic dt caller.
  await page.evaluate("""()=>{
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   const a={id:'__RC11_A',name:'Essai A',lat:48,lon:2,platforms:2},b={id:'__RC11_B',name:'Essai B',lat:48,lon:2.2,platforms:2};
   const route=Array.from({length:201},(_,i)=>({lat:48,lon:2+i*.001,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,tracks:2,wayId:'rc11-smoke-way'}));
   const world={stations:[a,b],getStationById:id=>id===a.id?a:id===b.id?b:null};
   const rame={id:'__RC11_R',name:'Essai électrique',traction:'electric',maxSpeed:160,totalMass:500,totalTonnage:500,totalPower:5000,adhesionMass:90,totalLength:200,totalCapacity:0,totalFreightCapacity:0,elementDetails:[]};
   const now=game.timeOfDay;
   const svc=new ActiveService({id:'__RC11_MOVEMENT',name:'RC11 — mouvement réel',rameId:rame.id,serviceType:'hlp',routes:[route],stops:[{stationId:a.id,departureTime:now-5,arrivalTime:now-5,type:'arret'},{stationId:b.id,arrivalTime:now+60,departureTime:now+60,type:'arret'}]},rame,world,null);
   svc.currentStopIndex=1;svc._initializeState(svc.routes[0],'1-0');svc.state='moving';svc.position={lat:48,lon:2};svc.speed=80;svc.train.speed=80;svc.train.state='moving';svc.active=true;svc._currentDate=game.engine.getParisDate();
   game.scheduleCreator.services.push(svc);game.scheduleCreator._invalidateActiveCache();game.scheduleCreator.refreshMovingCache(true);
   window.__rc5Probe=svc;
  }""")
  movements=[]
  for target in ['map','staff','incidents','map']:
   await page.evaluate('(id)=>game.ui.switchPage(id)',target)
   await page.wait_for_timeout(750)
   movements.append(await page.evaluate('({page:game.ui.activePage,state:__rc5Probe.state,speed:__rc5Probe.speed,km:__rc5Probe.totalDistance,position:__rc5Probe.position})'))
  assert all(x['state']=='moving' and x['speed']>12 for x in movements),movements
  assert all(movements[i]['km']>movements[i-1]['km'] for i in range(1,len(movements))),movements
  await page.evaluate("game.scheduleCreator.removeService('__RC11_MOVEMENT')")
  # A non-stop timing point in the real game loop: the head passes it at V30,
  # while the 750 m rear must remain limited on the approach after the leg reset.
  await page.evaluate("""()=>{
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   const a={id:'__RC11_PASS_A',name:'A',lat:46,lon:2,platforms:2},b={id:'__RC11_PASS_B',name:'Point sans arrêt',lat:46.01,lon:2,platforms:2},c={id:'__RC11_PASS_C',name:'C',lat:46.11,lon:2,platforms:2};
   const point=(st,v)=>({...st,maxSpeed:v,maxSpeedSource:'OSM',electrified:true,tracks:2,wayId:'__RC11_PASS_WAY'});
   const routes=[[point(a,30),point(b,30)],[point(b,160),point(c,160)]];
   const world={stations:[a,b,c],getStationById(id){return this.stations.find(s=>s.id===id)||null;}};
   const rame={id:'__RC11_PASS_R',name:'750 m probe',traction:'diesel',maxSpeed:160,totalMass:1000,totalTonnage:1000,totalPower:5000,adhesionMass:90,totalLength:750,totalCapacity:0,totalFreightCapacity:0,elementDetails:[]};
   const now=game.timeOfDay,s=new ActiveService({id:'__RC11_PASS',name:'Point de passage réel',rameId:rame.id,serviceType:'hlp',routes,stops:[{stationId:a.id,arrivalTime:now-5,departureTime:now-5,type:'arret'},{stationId:b.id,arrivalTime:now,departureTime:now,type:'passage'},{stationId:c.id,arrivalTime:now+60,departureTime:now+60,type:'arret'}]},rame,world,null);
   s.currentStopIndex=1;s._initializeState(routes[0],'1-0');s.position={lat:a.lat,lon:a.lon};s._setRouteProgressKm(routes[0],s._state.cumDist[0]-.003);s.totalDistance=s._currentFrontKm(routes[0]);s.speed=s.train.speed=30;s.state=s.train.state='moving';s.active=true;s._currentDate=game.engine.getParisDate();
   game.scheduleCreator.services.push(s);game.scheduleCreator._invalidateActiveCache();game.scheduleCreator.refreshMovingCache(true);window.__rc11Pass=s;
  }""")
  await page.wait_for_timeout(1800)
  passage=await page.evaluate('({state:__rc11Pass.state,index:__rc11Pass.currentStopIndex,speed:__rc11Pass.speed,tailLimit:__rc11Pass._getPassageTailSpeedLimit(),holds:__rc11Pass._passageTailSpeedHolds.length,totalDistance:__rc11Pass.totalDistance})')
  assert passage['state']=='moving' and passage['index']==2 and 29<=passage['speed']<=30.00001 and passage['tailLimit']==30 and passage['holds']>0,passage
  await page.wait_for_timeout(500)
  passageNext=await page.evaluate('({state:__rc11Pass.state,index:__rc11Pass.currentStopIndex,speed:__rc11Pass.speed,tailLimit:__rc11Pass._getPassageTailSpeedLimit(),totalDistance:__rc11Pass.totalDistance,lod:__rc11Pass._lod})')
  assert passageNext['totalDistance']>passage['totalDistance'] and passageNext['lod']=='high' and passageNext['tailLimit']==30,passageNext
  passage['nextObservation']=passageNext
  print('nonstop passage',passage,flush=True)
  await page.evaluate("game.scheduleCreator.removeService('__RC11_PASS')")
  # Fleet stress: real ActiveServices, actual engine callbacks, 600 independent
  # synthetic corridors. This is not a dense interlocking / shared-track test.
  print('600-train real-loop fixture',flush=True)
  await page.evaluate("""()=>{
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   window.__rc11Fleet=[];
   for(let k=0;k<600;k++){
    const lat=47+k*.004,lon=2;
    const a={id:`__RC11_F${k}_A`,lat,lon,name:'A',platforms:2},b={id:`__RC11_F${k}_B`,lat,lon:2.2,name:'B',platforms:2};
    const route=Array.from({length:201},(_,i)=>({lat,lon:lon+i*.001,maxSpeed:160,maxSpeedSource:'OSM',electrified:true,tracks:2,wayId:`__RC11_FWAY_${k}`}));
    const world={stations:[a,b],getStationById:id=>id===a.id?a:id===b.id?b:null};
    const rame={id:`__RC11_FR${k}`,name:'Fleet test',traction:'electric',maxSpeed:160,totalMass:500,totalTonnage:500,totalPower:5000,adhesionMass:90,totalLength:200,totalCapacity:0,totalFreightCapacity:0,elementDetails:[]};
    const now=game.timeOfDay;
    const svc=new ActiveService({id:`__RC11_FS${k}`,name:`Test ${k}`,rameId:rame.id,serviceType:'hlp',routes:[route],stops:[{stationId:a.id,departureTime:now-5,arrivalTime:now-5,type:'arret'},{stationId:b.id,arrivalTime:now+60,departureTime:now+60,type:'arret'}]},rame,world,null);
    svc.currentStopIndex=1;svc._initializeState(svc.routes[0],'1-0');svc.state='moving';svc.position={lat,lon};svc.speed=80;svc.train.speed=80;svc.train.state='moving';svc.active=true;svc._currentDate=game.engine.getParisDate();
    game.scheduleCreator.services.push(svc);__rc11Fleet.push(svc);
   }
   game.scheduleCreator._invalidateActiveCache();game.scheduleCreator.refreshMovingCache(true);
  }""")
  fleet=[]
  for target in ['map','staff','incidents','map']:
   before=await page.evaluate('__rc11Fleet.map(s=>s.totalDistance)')
   await page.evaluate('(id)=>game.ui.switchPage(id)',target)
   await page.wait_for_timeout(3600)
   record=await page.evaluate("""(before)=>({page:game.ui.activePage,count:__rc11Fleet.length,advanced:__rc11Fleet.filter((s,i)=>s.totalDistance>before[i]).length,moving:__rc11Fleet.filter(s=>s.state==='moving').length,minSpeed:Math.min(...__rc11Fleet.map(s=>s.speed)),maxSpeed:Math.max(...__rc11Fleet.map(s=>s.speed)),lod:__rc11Fleet.reduce((r,s)=>(r[s._lod]=(r[s._lod]||0)+1,r),{}),km:__rc11Fleet.reduce((sum,s)=>sum+s.totalDistance,0)})""",before)
   fleet.append(record);print('fleet',record,flush=True)
   assert record['count']==600 and record['advanced']==600 and record['moving']==600 and record['minSpeed']>12,record
  # RC12: stop time after the four live-movement observations, retaining all 600
  # services, so browser automation does not compete with a saturated synthetic
  # workload while interacting with the export control. No movement test is paused.
  await page.evaluate('()=>{game.running=false;game.ui._lastV2SidebarDiagAt=0;game.ui.updateV2RuntimeSidebar();}')
  exportControl=await page.evaluate('()=>({html:document.querySelector("#v2-runtime-sidebar-status")?.innerHTML,method:typeof game.ui.exportMovementDiagnostics})')
  (out/'rc19-export-control.json').write_text(json.dumps(exportControl,ensure_ascii=False,indent=2))
  async with page.expect_download(timeout=10000) as event:
   await page.locator('button[onclick="game.ui.exportMovementDiagnostics()"]').click()
  download=await event.value
  await download.save_as(str(out/'rc19-movement-export.json'))
  snapshot=json.loads((out/'rc19-movement-export.json').read_text())
  diagnosticExport={'suggestedFilename':download.suggested_filename,'bytes':(out/'rc19-movement-export.json').stat().st_size,'schemaVersion':snapshot['schemaVersion'],'build':snapshot['build'],'counts':snapshot['counts'],'sampled':snapshot['sampled'],'truncated':snapshot['truncated'],'positionsPresent':all(x['position'] is not None for x in snapshot['services']),'containsRawRoutes':any('cachedRoute' in x for x in snapshot['services'])}
  assert diagnosticExport['build']=='RC19' and diagnosticExport['counts']['moving']==600 and diagnosticExport['sampled']==512 and diagnosticExport['truncated']==88 and diagnosticExport['positionsPresent'] and not diagnosticExport['containsRawRoutes'],diagnosticExport
  print('RC12 actual sidebar JSON download',diagnosticExport,flush=True)
  await page.evaluate("""()=>{for(const s of __rc11Fleet)game.scheduleCreator.removeService(s.id);__rc11Fleet=[];}""")
  # Inherited user-facing network controls, exercised against the actual compiled bundle.
  panelChecks=await page.evaluate("""()=>{
   const map=game.renderer.tileMap,root=document.querySelector('#map-source-panel');
   const {MapSourcePanel}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/map-source-panel.js','');
   const panel=new MapSourcePanel(map,null);panel.root=root;
   const original=map._protocol;map.setNetworkEnabled(false);root.open=true;
   try{
    const initial=map.getBaseMapAccess();
    map._protocol=()=> 'https:';
    map.tileAccess.failure(map.getBaseMapSource().url,403);panel.update(true);
    const refused={kind:map.getBaseMapAccess().kind,text:root.querySelector('[data-tile-status]').textContent,retryDisabled:root.querySelector('[data-tile-retry]').disabled};
    const form=root.querySelector('form'),url=root.querySelector('[name="tile-url"]'),credit=root.querySelector('[name="tile-credit"]'),consent=root.querySelector('[name="tile-consent"]');
    url.value='https://tiles.example.test/{z}/{x}/{y}.png';credit.value='<img src=x onerror="window.__tileXSS=1">';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const noConsentRejected=map.getBaseMapSource().url.includes('tile.openstreetmap.org')&&root.querySelector('[data-tile-result]').textContent.includes('Confirmer');
    consent.checked=true;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const configured=map.getBaseMapSource();game.renderer.requestRender();
    const sourcePersisted=JSON.parse(localStorage.getItem('rail-empire.basemap.v1')).url===configured.url;
    root.querySelector('[data-tile-standard]').click();panel.update(true);
    return {initial:initial.kind,refused,noConsentRejected,configured,sourcePersisted,noScriptExecution:!window.__tileXSS,restoredStillRefused:map.getBaseMapAccess().kind==='forbidden',inlineEventAttributes:root.querySelectorAll('[onclick],[onerror]').length};
   }finally{map._protocol=original;map.setNetworkEnabled(true);}
  }""")
  assert panelChecks['initial']=='local-file' and panelChecks['refused']['kind']=='forbidden' and panelChecks['refused']['retryDisabled'],panelChecks
  assert panelChecks['noConsentRejected'] and panelChecks['sourcePersisted'] and panelChecks['noScriptExecution'] and panelChecks['restoredStillRefused'] and panelChecks['inlineEventAttributes']==0,panelChecks
  await page.screenshot(path=str(out/'rc19-osm-panel.png'))
  await page.set_viewport_size({'width':768,'height':1024})
  await page.wait_for_timeout(250)
  layoutChecks=await page.evaluate("""()=>{
   const root=document.querySelector('#map-source-panel'),summary=root.querySelector('summary'),rect=summary.getBoundingClientRect();
   const hit=document.elementFromPoint(rect.x+12,rect.y+8),link=document.querySelector('#livemap-attribution a');
   return {summaryVisible:root.contains(hit),panel:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},attributionHref:link?.href,attributionClickable:link?getComputedStyle(link).pointerEvents==='auto':false};
  }""")
  assert layoutChecks['summaryVisible'] and layoutChecks['attributionClickable'] and layoutChecks['attributionHref']=='https://www.openstreetmap.org/copyright',layoutChecks
  await page.screenshot(path=str(out/'rc19-osm-panel-768.png'))
  await page.set_viewport_size({'width':1280,'height':900})
  await page.evaluate("document.querySelector('#map-source-panel').open=false")
  print('OSM panel',panelChecks,flush=True)
  featureChecks=await page.evaluate("""()=>{
   const station=game.world.stations[0],id=station.id,originalName=station.name;
   station.platforms=2;station.type='voyageur';station.name='<img src=x onerror="window.__upgradeXSS=1"> Gare test';
   const host=document.createElement('div');host.id='rc11-upgrade-test';document.body.appendChild(host);
   game.stationUpgrades.render(host,game);
   const select=host.querySelector('#upgrade-station-select');select.value=id;select.dispatchEvent(new Event('change'));
   const originalBalance=game.economy.balance;
   const buy=type=>host.querySelector('[data-module="'+type+'"]').click();
   const beforeFreight=game.stationUpgrades.canHandleFreight(id);
   buy('platform');buy('depot');buy('freight');
   const platformTotal=game.platformManager.getStatus(id).total;
   const baseUnchanged=station.platforms===2;
   const garage=game.depotManager.depots.find(d=>d.stationUpgradeSource===id);
   const paid=originalBalance-game.economy.balance;
   const us=JSON.parse(JSON.stringify(game.stationUpgrades.toSave()));
   const ds=JSON.parse(JSON.stringify(game.depotManager.toSave()));
   game.depotManager.loadFromSave(ds);game.stationUpgrades.loadFromSave(us,game.world);game.stationUpgrades.syncRuntime();
   const reloadNoDuplication=game.platformManager.getStatus(id).total===3&&game.depotManager.depots.filter(d=>d.stationUpgradeSource===id).length===1;
   const escaped=!host.querySelector('img[src="x"]')&&!window.__upgradeXSS;
   station.name=originalName;
   const {Rame}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/rame.js','');
   const {ActiveService}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/schedule-creator.js','');
   const {materialResourceEffects}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/consumable-effects.js','');
   const {FreightNetwork}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/freight-network.js','');
   const r=new Rame({id:'RC11_RES',elementDetails:[{elementId:'L',category:'locomotive',traction:'bimode',power:3000,mass:80,maxSpeed:160}],consumables:{fuelCapacityL:3000,fuelL:0}});
   const fuelEmptyStops=materialResourceEffects(r,{electrified:false}).powerW===0;
   const wireStillWorks=materialResourceEffects(r,{electrified:true}).powerW===3000000;
   r.consumables.fuelL=50;const refillRestores=materialResourceEffects(r,{electrified:false}).powerW===3000000;
   const network=new FreightNetwork({stations:[{id:'A',lat:48,lon:2},{id:'B',lat:48.1,lon:2},{id:'C',lat:48.00001,lon:2}],tracks:[{stationA:'A',stationB:'B',route:[{lat:48,lon:2},{lat:48.1,lon:2}]}]});
   const networkDestinations=[...network.reachableStations('A')];
   return {platformTotal,baseUnchanged,paid,garageTracks:garage.tracks,garageHasNoInventedRail:garage.railSections.length===0,freightActivated:!beforeFreight&&game.stationUpgrades.canHandleFreight(id),reloadNoDuplication,escaped,fuelEmptyStops,wireStillWorks,refillRestores,networkDestinations};
  }""")
  assert featureChecks=={'platformTotal':3,'baseUnchanged':True,'paid':80000,'garageTracks':1,'garageHasNoInventedRail':True,'freightActivated':True,'reloadNoDuplication':True,'escaped':True,'fuelEmptyStops':True,'wireStillWorks':True,'refillRestores':True,'networkDestinations':['B']},featureChecks
  print('RC11 feature integration',featureChecks,flush=True)
  newFeatureChecks=await page.evaluate("""()=>{
   const req=(name)=>__RAIL_EMPIRE_FILE_BUNDLE__.require('js/'+name+'.js','');
   const {Rame}=req('rame'),{materialTrackMismatch}=req('material-track-location');
   const {assessTurnback,CAB_CHANGE_SECONDS}=req('formation-turnback');
   const {simulateProfile,getLastProfileWorkspaceStats}=req('train-physics');
   const payload=`PE & Évry "O'Brian" <img data-re-injection src=x onerror="globalThis.__reInjected=1">`;
   const id=`RC11_');globalThis.__reInjected=1;// & "`;
   const oldRames=game.rameManager.getAll,oldStock=game.rollingStock.getAll,oldEdit=game.ui.openRameEditor,oldEditStock=game.ui.editStock,oldAnimate=game.ui._animateSolari;
   const host=document.createElement('div');host.id='rc11-html-integration';document.body.appendChild(host);
   const htmlViews=[],clicked=[];
   const record=(name,container,expectLiteral=true)=>{
    const x={name,injectedNodes:container.querySelectorAll('[data-re-injection]').length,scriptExecuted:!!globalThis.__reInjected,literalPreserved:container.textContent.toLowerCase().includes('<img data-re-injection'),doubleEncoded:container.textContent.includes('&lt;img')};
    if(x.injectedNodes||x.scriptExecuted||x.doubleEncoded||(expectLiteral&&!x.literalPreserved))throw new Error('Unsafe or changed HTML '+JSON.stringify(x));
    htmlViews.push(x);
   };
   try{
    game.ui._animateSolari=()=>{};
    const train={svcId:id,name:payload,trainNumber:payload,seriesName:payload,origin:payload,destination:payload,servedStations:[payload],fromStations:[payload],depTime:600,arrTime:610,delay:1,delayReason:payload,platform:'1',voie:payload,isDeparture:true,isArrival:true,category:'voyageur'};
    for(const method of ['_renderSncfDep','_renderSncfArr','_renderOldSncf','_renderCATI3_3','_renderAFLDepart','_renderAFLArrivee','_renderCATIComplet','_renderCATIAr','_renderDbAbfahrt']){
     host.innerHTML=game.ui[method]({id:'A',name:payload},[train],'10:00');record(method,host);
    }
    for(const method of ['_renderPlatformGL','_renderPlatformBanlieue']){
     host.innerHTML=game.ui[method]({name:payload,train:{name:payload,seriesName:payload,number:payload},rame:{},stops:[]},{id:'A',name:payload},{id:'B',name:payload},[{name:payload,isLast:true}],600,'','10:00',5);record(method,host);
    }
    const rame=new Rame({id,name:payload,serialNumber:payload,elementDetails:[{name:payload,instanceName:payload,category:'locomotive',power:1000,length:20,mass:80},{name:payload,category:'wagon',freightCapacity:50,cargoTypes:[payload],length:20,mass:20}]});
    for(const key of ['rames-search','rames-traction-filter','rames-status-filter','stock-search','stock-category-filter','stock-subcat-filter','stock-traction-filter','stock-source-filter','stock-detail-filter']){const el=document.getElementById(key);if(el)el.value='';}
    game.rameManager.getAll=()=>[rame];game.ui.openRameEditor=value=>clicked.push({kind:'rame',value});game.ui._ramesPage=0;game.ui.renderRamesList();
    const rames=document.getElementById('rames-list');record('rames cards / nested freight / inline handler',rames);rames.querySelector('.rame-card button').click();
    const stock={id,name:payload,seriesName:payload,notes:payload,category:'locomotive',traction:'diesel',maxSpeed:120,length:20,tonnage:80,power:1000,cargoTypes:[],passengerCapacity:0,freightCapacity:0};
    game.rollingStock.getAll=()=>[stock];game.ui.editStock=value=>clicked.push({kind:'stock',value});game.ui._stockPage=0;game.ui.renderStockList();
    const stockList=document.getElementById('rolling-stock-list')||document.getElementById('stock-list');record('stock cards / quoted title / inline handler',stockList);stockList.querySelector('.stock-card button').click();
    if(clicked.length!==2||clicked.some(x=>x.value!==id))throw new Error('Escaping changed button arguments: '+JSON.stringify(clicked));
    if(rame.name!==payload||stock.name!==payload||train.name!==payload)throw new Error('Escaping changed the data model');
    const differentTrackBlocked=materialTrackMismatch({trackIdentity:{kind:'osm',id:'10'}},{trackIdentity:{kind:'osm',id:'11'}},'A');
    const loco={elementId:'L',category:'locomotive',power:1000},wagon={elementId:'W',category:'wagon',power:0};
    const cabChangeAllowed=assessTurnback([loco]).allowed,runaroundNotInvented=assessTurnback([loco,wagon]).mode==='runaround_required';
    const result=simulateProfile([{distM:500000,limitMs:40}],{massKg:500000,powerW:5000000,lengthM:750,dsStep:2}),workspace=getLastProfileWorkspaceStats();
    if(!differentTrackBlocked||!cabChangeAllowed||!runaroundNotInvented||!Number.isFinite(result.timeSec)||workspace.residentCells!==20000||workspace.totalCells!==250000)throw new Error('Bundled helpers failed');
    return {htmlViews,clickedArgumentsPreserved:clicked.length===2,modelNamesUnchanged:true,differentTrackBlocked,cabChangeAllowed,runaroundNotInvented,cabChangeSeconds:CAB_CHANGE_SECONDS,physics:{timeSec:result.timeSec,workspace}};
   }finally{game.rameManager.getAll=oldRames;game.rollingStock.getAll=oldStock;game.ui.openRameEditor=oldEdit;game.ui.editStock=oldEditStock;game.ui._animateSolari=oldAnimate;host.remove();game.ui.renderRamesList();game.ui.renderStockList();}
  }""")
  print('RC11 new bundle / DOM checks',newFeatureChecks,flush=True)
  # RC12 routing controls in real DOM, independent fixture (no external provider).
  await page.evaluate("game.ui.switchPage('map')")
  rescueCards=await page.evaluate("""()=>{
   const {DepotManager}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/depot.js','');
   const manager=new DepotManager(),id=`rc12');globalThis.__badRescueId=1;//`;
   manager.activeRescues=[{id,stockName:'Secours <b data-rescue-inject>Évry</b>',state:'routing',position:{lat:48,lon:2},targetPosition:{lat:48.01,lon:2},speed:0,_routeAccessDenied:true,_routeRetryAtMs:Date.now()+900000,routeStatusMessage:'Routage refusé (403) — <img data-rescue-inject src=x onerror="window.__badRescueText=1">'}];
   const render=()=>{game.ui._lastTrainListAt=0;game.ui.updateTrainsList(manager.getRescueServices());return document.querySelector('#trains-list');};
   let host=render(),button=host.querySelector('button');const waiting={disabled:button.disabled,literal:host.textContent.includes('<img data-rescue-inject'),label:host.textContent.includes('Recherche du tracé aller'),noInjection:host.querySelectorAll('[data-rescue-inject]').length===0};
   manager.activeRescues[0]._routeRetryAtMs=0;host=render();button=host.querySelector('button');const old=game.ui.resumeRescueRouting,clicked=[];
   try{game.ui.resumeRescueRouting=value=>clicked.push(value);button.click();}finally{game.ui.resumeRescueRouting=old;}
   window.__rc12RescueFixture=manager;
   return {waiting,afterCooldownEnabled:!button.disabled,exactIdAfterClick:clicked.length===1&&clicked[0]===id,scriptNotExecuted:!window.__badRescueId&&!window.__badRescueText};
  }""")
  assert rescueCards['waiting']=={'disabled':True,'literal':True,'label':True,'noInjection':True} and rescueCards['afterCooldownEnabled'] and rescueCards['exactIdAfterClick'] and rescueCards['scriptNotExecuted'],rescueCards
  # Freeze UI refresh only for this screenshot; the Node tests exercise retry behavior.
  await page.evaluate('()=>{game.ui._lastTrainListAt=performance.now()+60000;}')
  await page.set_viewport_size({'width':768,'height':1024})
  await page.locator('#trains-list').scroll_into_view_if_needed()
  await page.screenshot(path=str(out/'rc19-rescue-controls-768.png'))
  rescueLayout=await page.evaluate("""()=>{const e=document.querySelector('#trains-list button'),r=e.getBoundingClientRect();return {visible:r.width>0&&r.height>0,withinViewport:r.left>=0&&r.right<=innerWidth,buttonText:e.textContent.trim(),cardWithoutHorizontalOverflow:e.closest('.train-card-fixed').scrollWidth<=e.closest('.train-card-fixed').clientWidth};}""")
  assert rescueLayout['visible'] and rescueLayout['withinViewport'] and rescueLayout['cardWithoutHorizontalOverflow'],rescueLayout
  print('RC12 rescue cards',rescueCards,rescueLayout,flush=True)
  # RC17: actual release UI and actual native gzip; Web Storage remains the harness's memory map.
  await page.evaluate("game.ui.switchPage('map')")
  await page.click('#btn-storage');await page.wait_for_selector('#re-storage-panel')
  await page.wait_for_function("document.querySelector('#re-storage-stats').textContent.includes('localStorage')")
  await page.screenshot(path=str(out/'rc19-storage-before-768.png'))
  await page.click('#re-storage-compact')
  await page.wait_for_function("!document.querySelector('#re-storage-compact').disabled",timeout=30000)
  storageReportText=await page.locator('#re-storage-stats').inner_text()
  progressText=await page.locator('#re-storage-progress').inner_text()
  assert 'Sauvegarde enregistrée' in progressText,progressText
  storageChecks=await page.evaluate("""async()=>{
    const loaded=await game.storage.loadGame(),info=game.storage.getSaveInfo();
    const{decodeJson}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/storage-codec.js','');
    const raw=localStorage.getItem('rail-empire-save');
    return {saveLoaded:!!loaded,codec:raw?.startsWith('RE13:')?JSON.parse(raw.slice(5)).codec:null,info,compressionAvailable:typeof CompressionStream==='function',decompressionAvailable:typeof DecompressionStream==='function',progress:document.querySelector('#re-storage-progress').textContent};
  }""")
  assert storageChecks['saveLoaded'] and storageChecks['codec']=='RE13/gzip',storageChecks
  async with page.expect_download() as info:
   await page.click('#re-storage-report')
  download=await info.value
  await download.save_as(str(out/'rc19-storage-diagnostic-download.json'))
  downloadReport=json.loads((out/'rc19-storage-diagnostic-download.json').read_text())
  assert downloadReport['format']=='RE13-STORAGE-DIAGNOSTIC',downloadReport
  assert 'rames' not in downloadReport and 'scheduleV2' not in downloadReport,downloadReport
  layouts=[]
  for width in [768,375]:
   await page.set_viewport_size({'width':width,'height':1024})
   await page.screenshot(path=str(out/f'rc19-storage-panel-{width}.png'))
   layout=await page.evaluate("""()=>{const p=document.querySelector('#re-storage-panel section'),r=p.getBoundingClientRect();return {width:innerWidth,left:r.left,right:r.right,scrollWidth:p.scrollWidth,clientWidth:p.clientWidth,buttons:[...p.querySelectorAll('button')].map(b=>({id:b.id,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))};}""")
   assert layout['left']>=0 and layout['right']<=width and layout['scrollWidth']<=layout['clientWidth'],layout
   assert all(x['left']>=0 and x['right']<=width for x in layout['buttons']),layout
   layouts.append(layout)
  await page.keyboard.press('Escape');assert await page.locator('#re-storage-panel').count()==0
  assert await page.evaluate("document.activeElement.id")=='btn-storage'
  # Capture a new live empty game snapshot for reproducibility, NOT a user-provided save.
  await page.set_viewport_size({'width':768,'height':1024})
  (out/'rc19-storage-browser.json').write_text(json.dumps({'harness':'Actual Chromium release bundle and native gzip APIs, supplied assets injected, external network denied, memory Web Storage fallback, native IndexedDB not certified.','checks':storageChecks,'statsText':storageReportText,'progressText':progressText,'layouts':layouts,'download':downloadReport,'keyboardEscapeFocusRestored':True},ensure_ascii=False,indent=2))
  print('RC13 storage',storageChecks,layouts,flush=True)
  # RC17: actual bundle, real main moveTick and actual depot DOM; route provider deterministic.
  rescueTow=await page.evaluate("""async()=>{
    const req=n=>__RAIL_EMPIRE_FILE_BUNDLE__.require('js/'+n+'.js','');
    const {ActiveService}=req('schedule-creator'),{Depot}=req('depot'),{Rame}=req('rame');
    const services=game.scheduleCreator.services,oldRoute=game.orm.findRoute,oldStockLookup=game.rollingStock.getById;
    game.rollingStock.getById=id=>id==='RC17_L'?{id,name:'Secours',category:'locomotive',traction:'diesel',power:2400,mass:84,length:20,maxSpeed:100}:oldStockLookup.call(game.rollingStock,id);
    const depot=new Depot({id:'RC17_D',stationId:'RC17_A',name:'Atelier RC17',built:true,type:'depot',tracks:2,location:{lat:48.5,lon:2.5},rescueLocos:[{stockId:'RC17_L',stockName:'Secours RC17',traction:'diesel'}]});
    const vehicle=game.rotationV2.addVehicle({number:'RC17-PHYSICAL-001',name:'Engin remorqué',category:'locomotive',traction:'diesel',maxSpeed:120,massKg:80000,powerW:3000000,lengthM:20});
    const rame=new Rame({id:'RC17_PHYSICAL_ONLY',name:'Formation <b data-tow-injection>PE</b>',elementDetails:[{physicalVehicleId:vehicle.id,category:'locomotive',traction:'diesel',power:3000,mass:80,length:20,maxSpeed:120}]});
    const world={tracks:[],stations:[{id:'RC17_A',lat:48.5,lon:2.5},{id:'RC17_B',lat:48.52,lon:2.5}],getStationById(id){return this.stations.find(s=>s.id===id);}};
    const route=world.stations.map(st=>({...st,wayId:'RC17-way',maxSpeed:100,electrified:false}));
    const now=game.timeOfDay,svc=new ActiveService({id:'v2:RC17:OCC:2026-09-12',name:'RC17 remorqué',v2OccurrenceId:'OCC',v2RotationId:'RC17',v2BaseDate:'2026-09-12',rameId:rame.id,routes:[route],stops:[{stationId:'RC17_A',arrivalTime:now-1,departureTime:now-1,type:'arret'},{stationId:'RC17_B',arrivalTime:now+10,departureTime:now+10,type:'arret'}]},rame,world,null);
    svc.state='moving';svc.active=true;svc.currentStopIndex=1;svc.position={lat:48.505,lon:2.5};svc.speed=svc.train.speed=0;svc.train.breakdown={type:'moteur'};svc._v2VehicleIds=[vehicle.id];svc._initializeState(route,'1-0');vehicle.available=false;
    game.depotManager.depots.push(depot);game.scheduleCreator.services=[svc];game.scheduleCreator._invalidateActiveCache();game.scheduleCreator.refreshMovingCache(true);
    game.orm.findRoute=(lat,lon,a,b)=>Promise.resolve([{lat,lon,wayId:'RC17-way'},{lat:(lat+a)/2,lon:lon+.001,wayId:'RC17-way'},{lat:a,lon:b,wayId:'RC17-way'}]);
    try{
      const r=game.depotManager.dispatchRescue(world,svc);for(let i=0;i<12;i++)await Promise.resolve();for(let i=0;i<1200&&r.state!=='recovering';i++)game.moveTick(1,now);if(r.state!=='recovering')throw Error('Physical outbound failed: '+r.routeStatusMessage);for(let i=0;i<301;i++)game.moveTick(1,now);for(let i=0;i<12;i++)await Promise.resolve();
      const before={...svc.position};for(let i=0;i<12;i++)game.moveTick(.5,now);
      const intermediate={targetMoved:JSON.stringify(before)!==JSON.stringify(svc.position),together:JSON.stringify(svc.position)===JSON.stringify(r.position),correctRoute:svc._state.cachedRoute===r.returnRoute,ownRouteUnchanged:svc.getCurrentRoute()===route,state:svc.train.state};
      for(let i=0;i<1000&&r.state!=='done';i++)game.moveTick(1,now);
      game.ui.switchPage('depots');game.ui.selectDepotDetail(depot.id);game.ui.setDepotDetailTab('material');
      const host=document.querySelector('#depots-list')||document.querySelector('.depot-detail');const text=host.textContent;
      const parked=game.depotManager.getRescuedFormations(depot.id);const result={intermediate,state:r.state,targetRemoved:svc.position===null,targetCancelled:svc.cancelled,vehicleAtDepot:vehicle.location.kind==='DEPOT'&&vehicle.location.id===depot.id,vehicleUnavailable:!vehicle.available,noDuplicateRame:!game.rameManager.getById(rame.id),parkedRecords:parked.length,repairCount:game.depotManager.repairQueue.filter(q=>q.serviceId===svc.id).length,uiShowsFormation:text.includes('Formations physiques remorquées')&&text.includes('Formation <b data-tow-injection>PE</b>'),injectedNodes:host.querySelectorAll('[data-tow-injection]').length};
      if(!Object.values(intermediate).slice(0,4).every(Boolean)||intermediate.state!=='remorqué'||result.state!=='done'||!result.targetRemoved||!result.targetCancelled||!result.vehicleAtDepot||!result.vehicleUnavailable||!result.noDuplicateRame||result.parkedRecords!==1||result.repairCount!==1||!result.uiShowsFormation||result.injectedNodes)throw new Error(JSON.stringify(result));
      return result;
    }finally{game.orm.findRoute=oldRoute;game.rollingStock.getById=oldStockLookup;game.scheduleCreator.services=services;game.scheduleCreator._invalidateActiveCache();game.scheduleCreator.refreshMovingCache(true);}
  }""")
  (out/'rc19-rescue-tow.json').write_text(json.dumps({'harness':'Actual release bundle, real main movement loop and depot UI in Chromium. Deterministic supplied route; no live railway-provider validation.', 'checks':rescueTow},ensure_ascii=False,indent=2))
  await page.screenshot(path=str(out/'rc19-rescue-depot.png'))
  print('RC17 rescue tow',rescueTow,flush=True)
  # RC17 actual main save/load, bounded overdue update, second save/reload, and UI.
  replayCheck=await page.evaluate("""async()=>{
    if(game.autoSaveInterval)clearInterval(game.autoSaveInterval);
    if(game._saveWritePromise)await game._saveWritePromise;
    const saveGame=game.storage.saveGame;let captured=null;
    try{
      game.storage.saveGame=state=>{captured=state;return Promise.resolve(true);};
      const current=Date.now(),cursor=Math.floor((current-3600000)/1000)*1000;
      const {ChronologicalClock}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/chronological-clock.js','');
      game.engine.enableChronologicalReplay(new ChronologicalClock(null,cursor,current).snapshot(),cursor,current);
      game.gameplayClock.lastUpdateMs=cursor;
      game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;
      if(!captured?.physicsClock||captured.physicsClock.cursorMs!==cursor)throw Error('automatic cursor missing');
      const saved=JSON.parse(JSON.stringify(captured));game.loadState(saved);await Promise.resolve();
      const before=game.engine.getSimulationEpochMs();if(before!==cursor)throw Error('load teleported time');
      game.engine.update();const after=game.engine.getSimulationEpochMs();game._updateV2RuntimeStatus();
      const debt=game.engine.getReplayDebtSeconds(),status=document.querySelector('#re-chronological-status').textContent;
      if(!(after>before&&after-before<=200000&&debt>0&&debt<3600&&!game.engine.paused))throw Error(JSON.stringify({before,after,debt,paused:game.engine.paused}));
      if(!status.includes('Rattrapage'))throw Error(status);
      game._saveStateNow();if(game._saveWritePromise)await game._saveWritePromise;
      const resumed=JSON.parse(JSON.stringify(captured));game.loadState(resumed);await Promise.resolve();
      if(game.engine.getSimulationEpochMs()!==after)throw Error('mid-replay reload lost cursor');
      return {automaticSaveCursor:cursor,restoredExact:true,firstUpdateSimulatedSeconds:(after-before)/1000,debtSeconds:debt,midReplayReloadExact:true,discardedPhysicsSeconds:game.engine.discardedPhysicsSeconds,visibleStatus:status,paused:game.engine.paused};
    }finally{game.storage.saveGame=saveGame;}
  }""")
  (out/'rc19-replay-browser.json').write_text(json.dumps({'harness':'Actual main load/save and engine/update callbacks in the release bundle; supplied assets and memory Web Storage; one-hour target, first bounded frame and middle-of-replay reload. Not a full replay of a user save.', 'checks':replayCheck},ensure_ascii=False,indent=2))
  await page.screenshot(path=str(out/'rc19-replay-status.png'))
  print('RC17 chronological replay',replayCheck,flush=True)
  assert not errors,errors
  await page.screenshot(path=str(out/'rc19-memory-smoke.png'))
  (out/'rc19-memory-smoke.json').write_text(json.dumps({'harness':'Chromium real DOM, provided local files injected without external network; in-memory Web Storage. Separate native-navigation.json records current HTTP/file support.','startup':state,'rc17Replay':replayCheck,'rc17RescueTow':rescueTow,'rc12DiagnosticExport':diagnosticExport,'rc12RescueCards':rescueCards,'rc12RescueLayout':rescueLayout,'rc10Regressions':featureChecks,'rc11Features':newFeatureChecks,'mapSourcePanel':panelChecks,'mapPanelLayout768':layoutChecks,'trackIdentity':trackIdentityCheck,'injectedDiagnosticCheck':diagnostic,'internalPageMovement':movements,'nonstopPassage':passage,'bankAtCeiling':bankCheck,'maintenanceSnapshot':saveCheck,'fleetMovement':fleet,'connectionsDialog':connectionDialog,'availablePages':pages,'navigation':nav,'pageErrors':errors,'console':console},ensure_ascii=False,indent=2))
  print(state,nav,'ERRORS',errors,flush=True)
  await b.close()
asyncio.run(asyncio.wait_for(main(),timeout=300))
