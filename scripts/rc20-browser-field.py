import os,shutil
import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'QA/RE_REPAIR_RC20')))/'browser-field';out.mkdir(parents=True,exist_ok=True)
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
  print('login ready',errors,console[-3:],flush=True);await page.fill('#login-name','RE RC20 — Essai navigateur isolé');await page.click('#btn-new-game')
  print('clicked',errors,console[-3:],flush=True);await page.wait_for_function('window.game.running && window.game.ui',timeout=15000);print('game running',flush=True)
  await page.wait_for_timeout(600)
  await page.evaluate('''()=>{game.running=false;game.engine.paused=true;game._replayPump?.cancel();}''')
  finance=await page.evaluate('''()=>{
   const e=game.economy,d=game.dashboard;e.history=[];e.dailySnapshots=[];
   for(let i=0;i<800;i++){e.addRevenue(100+i,'fret','Recette '+i);e.addExpense(20+i,'exploitation','Dépense '+i);}
   for(let i=0;i<65;i++)e.processDailyCharges([],[],new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10));
   d.revenueHistory=Array.from({length:600},(_,i)=>({time:'Point '+i,value:i*100}));d.expenseHistory=Array.from({length:600},(_,i)=>({time:'Point '+i,value:i*60}));
   game.ui.switchPage('dashboard');
   return {history:e.history.length,days:e.dailySnapshots.length,controls:document.querySelectorAll('.re-chart-controls').length,canvases:document.querySelectorAll('#page-dashboard canvas').length,rows:document.querySelectorAll('.re-finance-rows tbody tr').length,text:document.querySelector('.re-financial-panel').textContent};
  }''')
  assert finance['history']==1600 and finance['days']==64 and finance['controls']>=6 and finance['rows']==100,finance
  chart=page.locator('#dash-chart-revenue');await chart.scroll_into_view_if_needed();await page.wait_for_timeout(100)
  before=await page.evaluate('JSON.stringify([game.dashboard.revenueHistory,game.dashboard.expenseHistory])')
  controls=chart.locator('xpath=following-sibling::*[1]');await controls.get_by_role('button',name='Tout',exact=True).click()
  box=await chart.bounding_box();await page.mouse.move(box['x']+120,box['y']+70);await page.mouse.down();await page.mouse.move(box['x']+box['width']*.8,box['y']+70,steps=5);await page.mouse.up()
  cursor=await controls.locator('output').text_content();assert 'Recettes' in cursor and 'Dépenses' in cursor,cursor
  await page.mouse.wheel(0,-100);await page.wait_for_timeout(50)
  ranges=await controls.locator('input').evaluate_all('(els)=>els.map(e=>Number(e.value))');assert ranges[1]-ranges[0]<599,ranges
  await chart.focus();await page.keyboard.press('ArrowLeft')
  assert before==await page.evaluate('JSON.stringify([game.dashboard.revenueHistory,game.dashboard.expenseHistory])')
  # Every category composition chart is inspectable too, without changing money.
  composition=page.locator('#dash-chart-rev-bar');await composition.scroll_into_view_if_needed();await composition.click();await page.keyboard.press('ArrowRight')
  await page.locator('.re-financial-panel [data-finance="next"]').click();assert 'page 2/' in await page.locator('.re-financial-panel output').text_content()
  await page.locator('.re-financial-panel [data-finance="query"]').fill('Recette 0');assert '1 écritures' in await page.locator('.re-financial-panel output').text_content()
  await page.locator('.re-financial-panel [data-finance="query"]').fill('')
  async with page.expect_download() as downloaded:await page.locator('[data-finance="json"]').click()
  download=await downloaded.value;await download.save_as(str(out/'finance.json'));financial_export=json.loads((out/'finance.json').read_text());assert len(financial_export['economy']['history'])==1600
  async with page.expect_download() as downloaded:await page.locator('[data-finance="csv"]').click()
  download=await downloaded.value;await download.save_as(str(out/'finance.csv'));assert len((out/'finance.csv').read_text().splitlines())==1601
  await page.locator('.re-financial-panel').scroll_into_view_if_needed();await page.screenshot(path=str(out/'rc19-finance-panel.png'))
  await chart.scroll_into_view_if_needed();await page.screenshot(path=str(out/'rc19-interactive-chart.png'))
  # Pixel equivalence to exact unculled reference paths, using real Canvas rasterisation.
  pixels=await page.evaluate('''()=>{
   const {RouteDrawingCache}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/route-drawing-cache.js','');
   const {TileMap}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/map.js','');
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=800;a.height=b.height=500;
   const map=Object.create(TileMap.prototype);Object.assign(map,{centerLat:48,centerLon:2.3,zoomLevel:15,tileSize:256});
   const r=Array.from({length:20000},(_,i)=>({lat:48+Math.sin(i*.013)*.0003,lon:2+i*.00003}));
   const project=p=>map.worldToScreen(p.lat,p.lon,800,500),cache=new RouteDrawingCache();
   const draw=(ctx,paths)=>{ctx.clearRect(0,0,800,500);ctx.strokeStyle='#2583ff';ctx.lineWidth=8;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();for(const points of paths)for(let i=0;i<points.length;i++){const p=points[i];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.stroke();};
   const results=[];
   for(const zoom of [8,15,19])for(const shift of [0,.01]){map.zoomLevel=zoom;map.centerLon=2.3+shift;const tl=map.screenToWorld(-16,-16,800,500),br=map.screenToWorld(816,516,800,500),bounds={minLat:br.lat,maxLat:tl.lat,minLon:tl.lon,maxLon:br.lon};draw(a.getContext('2d'),[r.map(project)]);draw(b.getContext('2d'),cache.project(r,bounds,zoom+':'+shift,project));const aa=a.getContext('2d').getImageData(0,0,800,500).data,bb=b.getContext('2d').getImageData(0,0,800,500).data;let delta=0;for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])delta++;results.push({zoom,shift,changedChannels:delta});}
   return results;
  }''')
  assert all(r['changedChannels']==0 for r in pixels),pixels
  pump=await page.evaluate("""async()=>{
   const originalRAF=window.requestAnimationFrame;
   if(game.autoSaveInterval)clearInterval(game.autoSaveInterval);
   const now=Date.now(),cursor=Math.floor((now-3600000)/1000)*1000;
   game.engine.enableChronologicalReplay(null,cursor,now);game.gameplayClock.lastUpdateMs=cursor;
   game.engine.paused=false;game.running=true;
   window.requestAnimationFrame=()=>0;
   try{
    game.gameLoop();const afterFirst=game.engine.getSimulationEpochMs();
    await new Promise(resolve=>setTimeout(resolve,350));
    const afterPump=game.engine.getSimulationEpochMs();
    return {firstSliceSeconds:(afterFirst-cursor)/1000,extraSecondsWithoutPaint:(afterPump-afterFirst)/1000,remainingDebt:game.engine.getReplayDebtSeconds(),discardedPhysicsSeconds:game.engine.discardedPhysicsSeconds};
   }finally{game.running=false;game.engine.paused=true;game._replayPump?.cancel();window.requestAnimationFrame=originalRAF;}
  }""")
  assert pump['extraSecondsWithoutPaint']>0 and pump['discardedPhysicsSeconds']==0,pump
  result={'replayPumpWithoutAdditionalPaint':pump,'finance':finance,'chartCursor':cursor,'zoomRange':ranges,'financeExportRows':1600,'financialDataUnchangedByDrag':True,'pixels':pixels,'pageErrors':errors,'console':console}
  (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  assert not errors,errors
  print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
  await b.close()
asyncio.run(main())
