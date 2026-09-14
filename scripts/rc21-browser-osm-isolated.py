"""Full real bundles in isolated Chromium. No external tile/service traffic is sent.
Navigation is administrator-blocked; HTML/assets are injected; HTTP, location and storage
are simulated. Actual Canvas, Image decoding and DOM events run in Chromium.
"""
import asyncio,json,re,io
from pathlib import Path
from urllib.parse import urlparse,unquote
from PIL import Image,ImageDraw
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];out=root/'QA/RE_REPAIR_RC21/browser-osm-isolated';out.mkdir(parents=True,exist_ok=True)
im=Image.new('RGBA',(256,256),(235,231,222,255));d=ImageDraw.Draw(im)
d.rectangle((0,0,127,127),fill=(128,184,126,255));d.rectangle((128,0,255,127),fill=(116,185,220,255));d.line([(0,220),(255,150)],fill=(243,194,83,255),width=16);d.text((8,8),'RC21 TEST TILE - NOT OSM',fill='black')
buf=io.BytesIO();im.save(buf,format='PNG');tile=list(buf.getvalue())
async def main():
 result={'scope':__doc__,'tileFixture':'Synthetic calibration tile, NOT OSM imagery. Used only to verify exact raster rendering.','checks':[]}
 try:
  async with async_playwright() as p:
   b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(15000);errors=[];console=[]
   await page.route('**/*',lambda route:route.abort())
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
   page.on('console',lambda m:console.append({'type':m.type,'text':m.text[:500]})if m.type in ['error','warning']else None)
   def read(src):
    u=urlparse(src)
    if u.netloc and u.netloc!='rail-empire.test':raise ValueError('External asset blocked by isolated harness')
    path=(root/unquote(u.path).lstrip('/')).resolve()
    if root not in path.parents or not path.is_file():raise FileNotFoundError(src)
    return path.read_text()
   await page.expose_function('__readProvidedAsset',read)
   html=(root/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I);html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
   html=html.replace('<head>','<head><base href="https://rail-empire.test/"><style>'+(root/'style.css').read_text()+'</style>')
   await page.set_content(html,wait_until='domcontentloaded')
   await page.evaluate('''(bytes)=>{
    const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>Array.from(data.keys())[i],get length(){return data.size;}};
    Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
    window.tileCalls=[];window.tileStatus=200;window.tileBytes=new Uint8Array(bytes);
    window.fetch=async(src,options)=>{if(String(src).startsWith('https://tile.openstreetmap.org/')){tileCalls.push({url:String(src),options:{cache:options?.cache,referrerPolicy:options?.referrerPolicy,credentials:options?.credentials,headers:options?.headers??null}});return new Response(tileStatus===200?tileBytes:'blocked',{status:tileStatus,headers:{'Content-Type':tileStatus===200?'image/png':'text/plain','Cache-Control':'public, max-age=604800','Retry-After':'120'}});}const text=await __readProvidedAsset(String(src));return new Response(text,{headers:{'Content-Type':String(src).includes('.json')?'application/json':'text/plain'}});};
    const append=Node.prototype.appendChild;Node.prototype.appendChild=function(node){if(node.tagName==='SCRIPT'&&node.src){__readProvidedAsset(node.src).then(code=>{node.removeAttribute('src');node.textContent=code;append.call(this,node);node.dispatchEvent(new Event('load'));}).catch(()=>node.dispatchEvent(new Event('error')));return node;}return append.call(this,node);};
   }''',tile)
   for f in ['data/railnet/stations/manifest.js','data/railnet/tracks/manifest.js','js/rail-empire.file.bundle.js']:await page.add_script_tag(content=(root/f).read_text())
   await page.wait_for_function('window.game && document.querySelector("#btn-new-game")');print('bundles ready',flush=True)
   await page.evaluate('''()=>{
    const {TileMap}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/map.js','');window.MapClass=TileMap;
    TileMap.prototype._protocol=()=> 'https:'; // Simulate the permitted origin; native navigation is unavailable here.
    const wrap=document.createElement('div');wrap.id='calibration-map';wrap.style='position:fixed;top:100px;left:20px;width:256px;height:256px;z-index:99999';document.body.appendChild(wrap);
    window.c=document.createElement('canvas');c.width=c.height=256;wrap.appendChild(c);window.ctx=c.getContext('2d',{willReadFrequently:true});
    window.m=new TileMap();m.zoomLevel=8;m._lastRoundedZoom=8;m._lastQueueZoom=8;m.railEnabled=false;const ll=m.globalPixelToLatLon(128.5*256,88.5*256,8);m.centerLat=ll.lat;m.centerLon=ll.lon;m.selectOSMStandard();m.renderTiles(ctx,256,256);
   }''')
   await page.wait_for_function('m.networkStats.loaded===1');await page.evaluate('m.renderTiles(ctx,256,256)')
   calls=await page.evaluate('tileCalls');assert len(calls)==1 and calls[0]['url']=='https://tile.openstreetmap.org/8/128/88.png',calls
   assert calls[0]['options']=={'cache':'default','referrerPolicy':'strict-origin-when-cross-origin','credentials':'omit','headers':None},calls
   rgba=await page.evaluate('Array.from(ctx.getImageData(0,0,256,256).data)');assert bytes(rgba)==im.tobytes(),'Original tile pixels changed'
   result['checks'].append({'name':'Real Canvas/Image preserves the raster pixel-for-pixel; canonical URL and cache/referrer options','pass':True,'changedChannels':0,'request':calls[0]})
   assert await page.locator('#calibration-map .re-map-credit').is_visible()
   assert await page.locator('#calibration-map .re-map-credit a').get_attribute('href')=='https://www.openstreetmap.org/copyright'
   result['checks'].append({'name':'Editor attribution visible outside canvas with licence link','pass':True})
   before=await page.evaluate('tileCalls.length');await page.evaluate('''()=>{for(let i=0;i<20;i++){m.toggleBasic();m.renderTiles(ctx,256,256);}m.selectOSMStandard();m.renderTiles(ctx,256,256);}''');await page.wait_for_timeout(100)
   assert before==await page.evaluate('tileCalls.length');result['checks'].append({'name':'20 style switches reuse decoded raster without another HTTP request','pass':True,'extraRequests':0})
   await page.evaluate('tileStatus=403;m.centerLon+=2;m.markDirty();m.renderTiles(ctx,256,256)');await page.wait_for_function('m.getBaseMapAccess().kind==="forbidden"');before=await page.evaluate('tileCalls.length')
   await page.evaluate('''()=>{m.selectOSMStandard();m.renderTiles(ctx,256,256);m.dispose();m=new MapClass();m.selectOSMStandard();m.railEnabled=false;m.renderTiles(ctx,256,256);}''');await page.wait_for_timeout(100)
   assert before==await page.evaluate('tileCalls.length');assert await page.evaluate('m.getBaseMapAccess().kind')=='forbidden'
   result['checks'].append({'name':'403 remains through explicit original selection and map recreation','pass':True,'extraRequests':0})
   await page.evaluate('''()=>{m.tileAccess.resume(m.getBaseMapSource().url,'https:',Date.now()+1000000);m.dispose();document.querySelector('#calibration-map').remove();tileStatus=200;}''')
   await page.fill('#login-name','RC21 OSM isolated test');await page.click('#btn-new-game');await page.wait_for_function('game.running && game.ui');await page.wait_for_timeout(1000);print('game running',flush=True)
   await page.evaluate('game.ui.switchPage("map")');await page.locator('#toggle-satellite').check();await page.locator('#toggle-basic').check();await page.wait_for_function('game.renderer.tileMap.basicMode && !game.renderer.tileMap.satelliteEnabled && !game.renderer.tileMap.nightMapEnabled');await page.wait_for_timeout(800)
   ui=await page.evaluate('''()=>({basic:document.querySelector('#toggle-basic').checked,satellite:document.querySelector('#toggle-satellite').checked,url:game.renderer.tileMap.getBaseMapSource().url,drawn:game.renderer.tileMap.hasVisibleBaseTiles(),noticeHidden:document.querySelector('#map-base-notice').hidden,ormEnabled:!document.querySelector('#toggle-orm').disabled,attribution:document.querySelector('#livemap-attribution').textContent})''')
   assert ui['basic'] and not ui['satellite'] and ui['drawn'] and ui['noticeHidden'] and ui['ormEnabled'],ui
   result['checks'].append({'name':'Actual UI selects original OSM from satellite; ORM stays independently selectable','pass':True,'state':ui})
   await page.locator('#toggle-satellite').check();await page.locator('#map-source-panel').evaluate('(e)=>e.open=true');await page.locator('.map-source-config').evaluate('(e)=>e.open=true');await page.locator('[data-tile-standard]').click();await page.wait_for_function('!game.renderer.tileMap.satelliteEnabled && document.querySelector("#toggle-basic").checked')
   result['checks'].append({'name':'Source panel restore button changes the displayed layer','pass':True})
   await page.locator('#map-source-panel').evaluate('(e)=>e.open=false');await page.evaluate('''()=>{const tm=game.renderer.tileMap;tm.tileAccess.failure(tm.getBaseMapSource().url,403);tm.markDirty();game.renderer.requestRender();}''');await page.wait_for_function('!document.querySelector("#map-base-notice").hidden && document.querySelector("#map-base-notice").textContent.includes("403")')
   notice=await page.locator('#map-base-notice').inner_text();assert '403' in notice
   result['checks'].append({'name':'Refusal explanation is visible with source panel collapsed','pass':True,'notice':notice});await page.screenshot(path=str(out/'osm-refusal-ui.png'))
   gps=await page.evaluate('''()=>{game.running=false;const tm=game.renderer.tileMap;game.ui.selectedService={id:'GPS-TEST',state:'running',position:{lat:50,lon:7},speed:0};game.timeOfDay=22*60;const ok=game.ui.enable3DFollow();game.ui._sync3DAtmosphere(true);return {ok,basic:tm.basicMode,satellite:tm.satelliteEnabled,night:tm.nightMapEnabled};}''')
   assert gps['ok'] and gps['basic'] and not gps['satellite'] and not gps['night'],gps
   assert await page.locator('#livemap-attribution').is_visible()
   gpscredit=await page.locator('#livemap-attribution').evaluate('''e=>{const a=e.querySelector('a'),r=a.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:!!hit&&(a===hit||a.contains(hit)),x:r.x,y:r.y,width:r.width,height:r.height};}''')
   assert gpscredit['visible'],gpscredit
   await page.screenshot(path=str(out/'osm-gps-attribution.png'))
   await page.evaluate('game.ui.disable3DFollow()')
   result['checks'].append({'name':'GPS entry and night update preserve selected original OSM; licence link is unobstructed','pass':True,'state':gps,'attribution':gpscredit})
   # Pause frame scheduling during camera-only assertions; fleet movement is checked separately.
   satellite=await page.evaluate('''()=>{const tm=game.renderer.tileMap;game.ui.selectedService={id:'GPS-TEST',state:'running',position:{lat:50,lon:7},speed:0};tm.setSatelliteEnabled(true);game.timeOfDay=22*60;const ok=game.ui.enable3DFollow();game.ui._sync3DAtmosphere(true);const result={ok,satellite:tm.satelliteEnabled,night:tm.nightMapEnabled};game.ui.disable3DFollow();tm.selectOSMStandard();game.renderer.requestRender();return result;}''')
   assert satellite['ok'] and satellite['satellite'] and satellite['night'],satellite
   result['checks'].append({'name':'Satellite explicitly chosen after OSM still enters GPS night imagery','pass':True,'state':satellite})
   await page.set_viewport_size({'width':768,'height':1024});await page.wait_for_timeout(200)
   bounds=await page.locator('#livemap-attribution').bounding_box();assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=769 and bounds['y']+bounds['height']<=1025,bounds
   result['checks'].append({'name':'LiveMap licence fits 768x1024 viewport','pass':True,'bounds':bounds});await page.screenshot(path=str(out/'osm-768.png'))
   result['pageErrors']=errors;result['console']=console;assert not errors,errors
   result['pass']=True;await b.close()
 finally:(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps({'pass':result.get('pass',False),'checks':len(result['checks'])},indent=2))
if __name__=='__main__':asyncio.run(main())
