"""Actual RC23 bundles, Canvas, image decode and DOM interactions. Synthetic calibration tiles
are intercepted: no automated map-data collection, no external imagery access certification.
Local-file policy is modelled; native file navigation is checked separately.
"""
import asyncio,json,re,io,base64,zipfile,os
from pathlib import Path
from urllib.parse import urlparse,unquote
from PIL import Image,ImageDraw,ImageFilter
from playwright.async_api import async_playwright
r=Path(__file__).resolve().parents[1];out=r/'QA/RE_REPAIR_RC23/browser-night';out.mkdir(parents=True,exist_ok=True)
def png(img):
 b=io.BytesIO();img.save(b,format='PNG');return b.getvalue()
# Crisp local features to detect resampling/halos. These are NOT actual basemaps.
im=Image.new('RGBA',(256,256),(111,136,111,255));d=ImageDraw.Draw(im)
for y in range(0,256,16):
 for x in range(0,256,16):d.rectangle((x+2,y+2,x+12,y+12),fill=(172,157,136,255),outline=(60,66,60,255))
d.line((0,96,256,96),fill=(220,220,215,255),width=7);d.line((0,100,256,100),fill=(44,48,55,255),width=1)
d.text((5,214),'RC23 TEST - NOT A REAL MAP',fill=(255,255,255,255))
ni=Image.new('RGBA',(256,256),(0,0,0,255));nd=ImageDraw.Draw(ni);nd.ellipse((100,100,160,160),fill=(255,216,132,255));ni=ni.filter(ImageFilter.GaussianBlur(12))
blobs={'base':png(im),'night':png(ni),'transparent':png(Image.new('RGBA',(256,256),(0,0,0,0)))}
with zipfile.ZipFile(r.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC22.zip') as z:oldmap=z.read('js/map.js').decode()
# Use the identical (byte-verified below) transport dependency, change only TileMap.
oldmap=re.sub(r"import (\{[^;]+\}) from './tile-access-policy.js';",r"const \1 = __RAIL_EMPIRE_FILE_BUNDLE__.require('js/tile-access-policy.js','');",oldmap)
oldmap=oldmap.replace('export class TileMap','class TileMap')
async def main():
 result={'scope':__doc__,'checks':[],'pass':False}
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(15000);errors=[];logs=[];requests=[]
  async def route_map(route):
   u=route.request.url;host=urlparse(u).hostname or ''
   if host in ['tile.openstreetmap.org','server.arcgisonline.com','gibs.earthdata.nasa.gov'] or 'openrailwaymap.org' in host:
    data=blobs['night' if 'Black_Marble' in u else 'transparent' if 'openrailwaymap' in host else 'base']
    requests.append({'url':u,'method':route.request.method})
    return await route.fulfill(status=200,body=data,headers={'Content-Type':'image/png','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-Requested-With','Access-Control-Allow-Methods':'GET,OPTIONS','Cache-Control':'public, max-age=86400'})
   await route.abort()
  await page.route('**/*',route_map)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:logs.append({'type':m.type,'text':m.text[:250]}) if m.type in ['error','warning'] else None)
  page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
  def read(src):
   u=urlparse(src)
   if u.netloc and u.netloc!='rail-empire.test':raise ValueError('External data unavailable in isolated harness')
   path=(r/unquote(u.path).lstrip('/')).resolve()
   if r not in path.parents or not path.is_file():raise FileNotFoundError(src)
   return path.read_text()
  await page.expose_function('__readProvidedAsset',read)
  html=(r/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I);html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
  html=html.replace('<head>','<head><base href="https://rail-empire.test/"><style>'+(r/'style.css').read_text()+'</style>')
  await page.set_content(html,wait_until='domcontentloaded')
  await page.evaluate(r'''()=>{
   const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear(),key:i=>Array.from(values.keys())[i],get length(){return values.size;}};
   Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
   const nativeFetch=window.fetch.bind(window);
   window.fetch=async(src,options)=>{if(/^https:\/\/(tile.openstreetmap.org|server.arcgisonline.com|gibs.earthdata.nasa.gov|[abc].tiles.openrailwaymap.org)\//.test(String(src)))return nativeFetch(src,options);return new Response(await __readProvidedAsset(String(src)),{headers:{'Content-Type':String(src).includes('.json')?'application/json':'text/plain'}});};
   const append=Node.prototype.appendChild;Node.prototype.appendChild=function(n){if(n.tagName==='SCRIPT'&&n.src){__readProvidedAsset(n.src).then(s=>{n.removeAttribute('src');n.textContent=s;append.call(this,n);n.dispatchEvent(new Event('load'));}).catch(()=>n.dispatchEvent(new Event('error')));return n;}return append.call(this,n);};
  }''')
  try:
   for f in ['data/railnet/stations/manifest.js','data/railnet/tracks/manifest.js','js/rail-empire.file.bundle.js']:await page.add_script_tag(content=(r/f).read_text())
   await page.wait_for_function('window.game');print('bundle ready',flush=True)
   await page.add_script_tag(content='(()=>{'+oldmap+';window.OldTileMap=TileMap;})();')
   await page.evaluate('''async(data)=>{
    window.MapClass=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/map.js','').TileMap;
    MapClass.prototype._protocol=()=> 'file:';
    window.fixture={};
    for(const[k,src]of Object.entries(data)){const im=new Image();im.src=src;await im.decode();fixture[k]=im;}
   }''',{k:'data:image/png;base64,'+base64.b64encode(v).decode() for k,v in blobs.items()})
   pixels=await page.evaluate('''()=>{
    const {SATELLITE_NIGHT_TINT}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/map-lighting.js','');
    function render(Class,night,zoom=16){
     const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});
     const m=new Class();m.satelliteEnabled=true;m.nightMapEnabled=night;m.railEnabled=false;m.zoomLevel=zoom;
     const ll=m.globalPixelToLatLon((2**zoom/2+.5)*256,(2**zoom/2+.5)*256,zoom);m.centerLat=ll.lat;m.centerLon=ll.lon;
     const calls=[];m.getTile=(x,y,z,url)=>{calls.push({x,y,z,url});return {loaded:true,error:false,img:fixture[url.includes('Black_Marble')?'night':'base']};};
     m.renderTiles(ctx,256,256);m.dispose();return {c,ctx,calls};
    }
    const day=render(MapClass,false),night=render(MapClass,true),old=render(OldTileMap,true);
    const expected=document.createElement('canvas');expected.width=expected.height=256;const ec=expected.getContext('2d');ec.drawImage(day.c,0,0);ec.fillStyle=SATELLITE_NIGHT_TINT;ec.fillRect(0,0,256,256);
    const actual=night.ctx.getImageData(0,0,256,256).data,target=ec.getImageData(0,0,256,256).data;
    let diff=0;for(let i=0;i<actual.length;i++)if(actual[i]!==target[i])diff++;
    const region=render(MapClass,true,8);
    return {changedChannelsFromUnblurredExpected:diff,beforeCalls:old.calls,afterCalls:night.calls,regionCalls:region.calls,day:day.c.toDataURL(),night:night.c.toDataURL(),before:old.c.toDataURL()};
   }''')
   for k in ['day','night','before']:(out/(k+'-calibration.png')).write_bytes(base64.b64decode(pixels.pop(k).split(',')[1]))
   assert pixels['changedChannelsFromUnblurredExpected']==0,pixels
   assert any('Black_Marble' in x['url'] for x in pixels['beforeCalls']) and not any('Black_Marble' in x['url'] for x in pixels['afterCalls'])
   assert any('Black_Marble' in x['url'] for x in pixels['regionCalls'])
   result['checks'].append({'name':'Native Canvas close night equals detailed day + one tint pixel-for-pixel; no NASA close requests','pass':True,'evidence':pixels})
   await page.fill('#login-name','RC23 — Nuit GPS');await page.click('#btn-new-game');await page.wait_for_function('game.running && game.ui');await page.wait_for_timeout(700);print('game running',flush=True)
   await page.evaluate('''()=>{game.renderer.tileMap.selectOSMStandard();game.renderer.requestRender();}''');await page.wait_for_timeout(400)
   await page.locator('#toggle-night').check();await page.wait_for_function('game.renderer.tileMap.nightMapEnabled');await page.wait_for_timeout(200)
   osm=await page.evaluate('''()=>({night:game.renderer.tileMap.nightMapEnabled,satellite:game.renderer.tileMap.satelliteEnabled,basic:game.renderer.tileMap.basicMode,notice:document.querySelector('#map-source-panel').textContent,credit:document.querySelector('#livemap-attribution').textContent})''')
   assert osm['night'] and not osm['satellite'] and osm['basic'];assert 'Esri' not in osm['credit'] and 'NASA' not in osm['credit']
   result['checks'].append({'name':'Real 2D Night checkbox styles OSM without a provider change','pass':True,'state':osm})
   await page.screenshot(path=str(out/'2d-night-calibration.png'))
   await page.locator('#toggle-night').uncheck();await page.wait_for_function('!game.renderer.tileMap.nightMapEnabled');await page.locator('#toggle-satellite').check()
   gps=await page.evaluate('''()=>{game.running=false;game.timeOfDay=720;game.ui.selectedService={id:'GPS-RC23',state:'running',position:{lat:50.7,lon:7},speed:0};const ok=game.ui.enable3DFollow();game.ui._sync3DAtmosphere(true);return {ok,time:game.timeOfDay,weather:JSON.stringify(game.weather.toSave?.()||game.weather.current),sat:game.renderer.tileMap.satelliteEnabled};}''')
   assert gps['ok'] and gps['sat'];await page.wait_for_timeout(300)
   await page.select_option('#re3d-lighting-filter','night');await page.wait_for_function('game.renderer.tileMap.nightMapEnabled');print('GPS night set',flush=True)
   forced=await page.evaluate('''()=>({night:game.renderer.tileMap.nightMapEnabled,alpha:game.renderer.tileMap.getNightLightsOpacity(),time:game.timeOfDay,weather:JSON.stringify(game.weather.toSave?.()||game.weather.current),badge:document.querySelector('#re3d-mode-badge').textContent,note:document.querySelector('#re3d-lighting-note').textContent,checked:document.querySelector('#toggle-night').checked,stored:localStorage.getItem('rail-empire.gps-lighting.v1')})''')
   assert forced['night'] and forced['alpha']==0 and forced['time']==gps['time'] and forced['weather']==gps['weather'] and forced['checked'] and forced['stored']=='night',forced
   assert 'FORCÉ' in forced['badge'] and 'de jour assombri' in forced['note']
   result['checks'].append({'name':'GPS Night at midday changes neither game time nor physical weather, syncs 2D checkbox and preference','pass':True,'state':forced})
   await page.select_option('#re3d-weather-filter','rain');await page.wait_for_function('document.querySelector("#main-area").classList.contains("re3d-rain")');assert await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   await page.select_option('#re3d-weather-filter','clear');assert await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   result['checks'].append({'name':'Weather overlay and night selector remain independent','pass':True})
   # Select/wheel interaction must not zoom the camera or steal panel scrolling.
   zoom=await page.evaluate('game.renderer.tileMap.zoomLevel');await page.locator('#re3d-lighting-filter').dispatch_event('wheel',{'deltaY':120,'bubbles':True});assert await page.evaluate('game.renderer.tileMap.zoomLevel')==zoom
   result['checks'].append({'name':'Wheel over GPS controls does not alter map zoom','pass':True})
   await page.evaluate('game.timeOfDay=1380');await page.select_option('#re3d-lighting-filter','day');assert not await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   result['checks'].append({'name':'GPS Day overrides a 23:00 clock','pass':True})
   await page.select_option('#re3d-lighting-filter','auto');assert await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   await page.evaluate('game.timeOfDay=720;game.ui._sync3DAtmosphere(true)');assert not await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   result['checks'].append({'name':'Auto restores time-based satellite lighting across midnight/day','pass':True})
   await page.select_option('#re3d-lighting-filter','night');await page.locator('#toggle-night').uncheck();assert await page.input_value('#re3d-lighting-filter')=='day'
   await page.locator('#toggle-night').check();assert await page.input_value('#re3d-lighting-filter')=='night'
   result['checks'].append({'name':'Night checkbox also synchronizes the GPS selector in both directions','pass':True})
   await page.locator('#toggle-basic').check();assert await page.input_value('#re3d-lighting-filter')=='day';assert not await page.evaluate('game.renderer.tileMap.satelliteEnabled||game.renderer.tileMap.nightMapEnabled')
   await page.select_option('#re3d-lighting-filter','night');assert await page.evaluate('game.renderer.tileMap.nightMapEnabled&&!game.renderer.tileMap.satelliteEnabled')
   result['checks'].append({'name':'Original OSM selection is honored in GPS; explicit Night then darkens OSM, not satellite','pass':True})
   # Source-panel restore button must override a forced night mode too.
   await page.locator('#map-source-panel').evaluate('(e)=>e.open=true');await page.locator('.map-source-config').evaluate('(e)=>e.open=true');await page.locator('[data-tile-standard]').click()
   assert await page.input_value('#re3d-lighting-filter')=='day';assert not await page.evaluate('game.renderer.tileMap.nightMapEnabled')
   await page.locator('#map-source-panel').evaluate('(e)=>e.open=false')
   result['checks'].append({'name':'Source-panel OSM original is not immediately overridden by an old forced-night preference','pass':True})
   await page.locator('#toggle-satellite').check();await page.select_option('#re3d-lighting-filter','night');await page.wait_for_timeout(200)
   # Controls stay usable, not overlapped, at desktop and the user's 768x1024.
   layouts=[]
   for w,h in [(1280,900),(768,1024),(375,667)]:
    await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(250)
    # The clock was paused above to assert exact time invariance. Paint actual
    # renderer frames explicitly here; a flag-only screenshot is not a render test.
    for _ in range(3):
     await page.evaluate('''()=>{game.renderer.resize();game.ui.prepare3DMapAnchorForRender?.();game.renderer.render(game.world,[],game.engine,game.depotManager,game.lineManager,game.platformManager,game.voiePointManager);}''')
     await page.wait_for_timeout(180)
    drawn=await page.evaluate('''()=>({credit:document.querySelector('#livemap-attribution').textContent,source:document.querySelector('#map-source-panel').textContent,night:game.renderer.tileMap.nightMapEnabled,satellite:game.renderer.tileMap.satelliteEnabled,loaded:[...game.renderer.tileMap.tileCache.values()].filter(t=>t.loaded).length})''')
    assert drawn['night'] and drawn['satellite'] and 'Esri' in drawn['credit'] and 'NASA' not in drawn['credit'] and drawn['loaded']>0,drawn
    lay=await page.evaluate('''()=>{
     const a=document.querySelector('#re3d-controls').getBoundingClientRect(),b=document.querySelector('.map-toggles').getBoundingClientRect();
     const select=document.querySelector('#re3d-lighting-filter');select.scrollIntoView({block:'nearest'});const s=select.getBoundingClientRect();
     const hit=document.elementFromPoint(s.x+s.width/2,s.y+s.height/2);
     const credit=document.querySelector('#livemap-attribution').getBoundingClientRect();
     return {overlap:a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom,selectReachable:hit===select||select.contains(hit),selectInside:s.left>=0&&s.right<=innerWidth&&s.top>=0&&s.bottom<=innerHeight,creditInside:credit.left>=0&&credit.right<=innerWidth&&credit.bottom<=innerHeight,controlHeight:a.height,filtersHeight:b.height};
    }''')
    assert not lay['overlap'] and lay['selectReachable'] and lay['selectInside'] and lay['creditInside'],(w,h,lay)
    layouts.append({'width':w,'height':h,**lay,'rendered':drawn});await page.screenshot(path=str(out/f'gps-night-{w}-calibration.png'))
   result['checks'].append({'name':'Lighting and display panels do not overlap; select and attribution remain reachable at 3 sizes','pass':True,'layouts':layouts})
   await page.evaluate('game.ui.disable3DFollow()');await page.wait_for_timeout(100)
   restore=await page.evaluate('''()=>({sat:game.renderer.tileMap.satelliteEnabled,night:game.renderer.tileMap.nightMapEnabled,active:game.ui._threeDFollowActive})''')
   assert restore=={'sat':True,'night':False,'active':False},restore
   result['checks'].append({'name':'Exiting GPS restores pre-GPS 2D satellite/night settings','pass':True,'state':restore})
   await page.evaluate('game.ui.enable3DFollow();game.ui._sync3DAtmosphere(true)');assert await page.input_value('#re3d-lighting-filter')=='night'
   result['checks'].append({'name':'GPS remembers its manual lighting preference on re-entry','pass':True})
   result['pageErrors']=errors;result['consoleWarnings']=logs;result['interceptedTileRequests']=len(requests);assert not errors,errors;result['pass']=True
  except Exception as e:
   result['error']=str(e);result['pageErrors']=errors;result['consoleWarnings']=logs
   await page.screenshot(path=str(out/'failure.png'));raise
  finally:
   (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));await b.close()
 print(json.dumps({'pass':result['pass'],'checks':len(result['checks'])}))
asyncio.run(main())
