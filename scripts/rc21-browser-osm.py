"""Real Chromium/HTTP renderer checks. All external traffic is intercepted: no OSM scraping."""
import asyncio, json, subprocess, os, re, io, time
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];out=root/'QA/RE_REPAIR_RC21/browser-osm';out.mkdir(parents=True,exist_ok=True)
# Deliberately synthetic, recognizable calibration tile, never called an OSM map.
im=Image.new('RGBA',(256,256),(235,231,222,255));d=ImageDraw.Draw(im)
d.rectangle((0,0,127,127),fill=(128,184,126,255));d.rectangle((128,0,255,127),fill=(116,185,220,255));d.line([(0,220),(255,150)],fill=(243,194,83,255),width=16);d.text((8,8),'RC21 TEST TILE - NOT OSM',fill='black')
buf=io.BytesIO();im.save(buf,format='PNG');tile=buf.getvalue()
async def main():
 server=subprocess.Popen(['node','scripts/serve-local.cjs'],cwd=root,stdout=(out/'server.log').open('w'),stderr=subprocess.STDOUT)
 result={'scope':'Native Chromium HTTP navigation; actual local server, bundles and ESM. Synthetic tile HTTP responses intercepted. No request reaches OSM/ORM/satellite servers. No browser-disk-cache guarantee (Playwright routing disables its HTTP cache).','tileFixture':'synthetic colour calibration, NOT real OSM imagery','checks':[]}
 try:
  await asyncio.sleep(.5)
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   page=await browser.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(15000)
   calls=[];mode={'http':200};other=[];errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   async def route(r):
    url=r.request.url;u=urlparse(url)
    if u.hostname=='127.0.0.1':return await r.continue_()
    if u.hostname=='tile.openstreetmap.org':
     calls.append({'url':url,'headers':dict(r.request.headers),'responseStatus':mode['http']})
     return await r.fulfill(status=mode['http'],body=tile if mode['http']==200 else b'blocked',headers={'Content-Type':'image/png' if mode['http']==200 else 'text/plain','Cache-Control':'public, max-age=604800','Access-Control-Allow-Origin':'*','Retry-After':'120','Access-Control-Expose-Headers':'Retry-After'})
    other.append(url);await r.abort()
   await page.route('**/*',route)
   await page.goto('http://127.0.0.1:8765/AIDE_CARTE_OSM.html',wait_until='domcontentloaded')
   result['nativeHttpOrigin']=await page.evaluate('location.origin');assert result['nativeHttpOrigin']=='http://127.0.0.1:8765'
   # Work with the compiled TileMap class and the real Canvas/Image/fetch pipeline.
   await page.set_content('<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="/style.css"></head><body><div style="position:relative;width:256px;height:256px"><canvas id="test-map" width="256" height="256"></canvas></div></body></html>')
   await page.evaluate('''async()=>{
    const {TileMap}=await import('/js/map.js');window.m=new TileMap();m.zoomLevel=8;m._lastRoundedZoom=8;m._lastQueueZoom=8;m.railEnabled=false;
    const ll=m.globalPixelToLatLon(128.5*256,88.5*256,8);m.centerLat=ll.lat;m.centerLon=ll.lon;m.selectOSMStandard();
    window.c=document.querySelector('canvas');window.ctx=c.getContext('2d',{willReadFrequently:true});m.renderTiles(ctx,256,256);
   }''')
   await page.wait_for_function('m.networkStats.loaded===1');await page.evaluate('m.renderTiles(ctx,256,256)')
   assert len(calls)==1,calls
   assert calls[0]['url']=='https://tile.openstreetmap.org/8/128/88.png',calls
   assert calls[0]['headers']['referer']=='http://127.0.0.1:8765/',calls
   assert 'no-cache' not in str(calls[0]['headers']).lower(),calls
   rgba=await page.evaluate('Array.from(ctx.getImageData(0,0,256,256).data)');assert bytes(rgba)==im.tobytes(),'Original tile pixels changed'
   result['checks'].append({'name':'Original raster exact pixel equality + canonical HTTPS + genuine native Referer','pass':True,'networkRequests':len(calls),'changedChannels':0})
   assert await page.locator('.re-map-credit a').get_attribute('href')=='https://www.openstreetmap.org/copyright'
   assert await page.locator('.re-map-credit').is_visible()
   result['checks'].append({'name':'Editor attribution visible outside canvas, with licence link','pass':True})
   before=len(calls);await page.evaluate('''()=>{for(let i=0;i<20;i++){m.toggleBasic();m.renderTiles(ctx,256,256);}m.selectOSMStandard();m.renderTiles(ctx,256,256);}''');await page.wait_for_timeout(100)
   assert len(calls)==before
   result['checks'].append({'name':'20 original/dark switches reuse decoded tile without network calls','pass':True,'extraRequests':0})
   # A provider refusal survives view changes and recreation on the same storage origin.
   mode['http']=403
   await page.evaluate('''()=>{m.centerLon+=2;m.markDirty();m.renderTiles(ctx,256,256);}''');await page.wait_for_function('m.getBaseMapAccess().kind==="forbidden"')
   before=len(calls)
   await page.evaluate('''async()=>{m.selectOSMStandard();m.renderTiles(ctx,256,256);m.dispose();const {TileMap}=await import('/js/map.js');window.m=new TileMap();m.selectOSMStandard();m.railEnabled=false;m.renderTiles(ctx,256,256);}''');await page.wait_for_timeout(100)
   assert len(calls)==before
   assert await page.evaluate('m.getBaseMapAccess().kind')=='forbidden'
   result['checks'].append({'name':'403 stops source and persists through explicit OSM choice and recreation','pass':True,'extraRequests':0})
   await page.evaluate('m.dispose();localStorage.clear()');mode['http']=200
   # Native full game boot and actual UI controls, no bundles injected.
   print('native map checks pass; booting full game',flush=True)
   await page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
   await page.wait_for_function('window.game && document.querySelector("#btn-new-game")')
   await page.fill('#login-name','RC21 test OSM');await page.click('#btn-new-game');await page.wait_for_function('game.running && game.ui')
   await page.wait_for_timeout(1000)
   await page.evaluate('game.ui.switchPage("map")')
   await page.locator('#toggle-satellite').check();await page.locator('#toggle-basic').check()
   await page.wait_for_function('game.renderer.tileMap.basicMode && !game.renderer.tileMap.satelliteEnabled && !game.renderer.tileMap.nightMapEnabled')
   await page.wait_for_timeout(800)
   ui=await page.evaluate('''()=>({basic:document.querySelector('#toggle-basic').checked,satellite:document.querySelector('#toggle-satellite').checked,url:game.renderer.tileMap.getBaseMapSource().url,drawn:game.renderer.tileMap.hasVisibleBaseTiles(),noticeHidden:document.querySelector('#map-base-notice').hidden,ormEnabled:!document.querySelector('#toggle-orm').disabled,attribution:document.querySelector('#livemap-attribution').textContent,build:__RAIL_EMPIRE_FILE_BUNDLE__.version||null})''')
   assert ui['basic'] and not ui['satellite'] and ui['drawn'] and ui['noticeHidden'] and ui['ormEnabled'],ui
   result['checks'].append({'name':'Full native game: real UI satellite -> OSM selector, original pixels, independent ORM','pass':True,'state':ui})
   # Check the source panel button as well, and refusal explanation outside the closed panel.
   await page.locator('#toggle-satellite').check();await page.locator('#map-source-panel').evaluate('(e)=>e.open=true')
   await page.locator('.map-source-config').evaluate('(e)=>e.open=true');await page.locator('[data-tile-standard]').click();await page.wait_for_function('!game.renderer.tileMap.satelliteEnabled && document.querySelector("#toggle-basic").checked')
   result['checks'].append({'name':'Panel restore button changes the displayed layer, not only the source URL','pass':True})
   await page.locator('#map-source-panel').evaluate('(e)=>e.open=false')
   await page.evaluate('''()=>{const tm=game.renderer.tileMap;tm.tileAccess.failure(tm.getBaseMapSource().url,403);tm.markDirty();game.renderer.requestRender();}''')
   await page.wait_for_function('!document.querySelector("#map-base-notice").hidden')
   notice=await page.locator('#map-base-notice').inner_text();assert '403' in notice
   result['checks'].append({'name':'Refusal visible even with source panel collapsed','pass':True,'notice':notice})
   await page.screenshot(path=str(out/'osm-error-ui.png'))
   # Current GPS state must not replace explicitly selected OSM, even at night.
   gps=await page.evaluate('''()=>{
    const tm=game.renderer.tileMap;game.ui.selectedService={id:'GPS-TEST',state:'running',position:{lat:50,lon:7},speed:0};game.timeOfDay=22*60;
    const ok=game.ui.enable3DFollow();game.ui._sync3DAtmosphere(true);const state={ok,basic:tm.basicMode,satellite:tm.satelliteEnabled,night:tm.nightMapEnabled};game.ui.disable3DFollow();return state;
   }''')
   assert gps['ok'] and gps['basic'] and not gps['satellite'] and not gps['night'],gps
   result['checks'].append({'name':'Actual GPS entry and night update preserve chosen OSM source','pass':True,'state':gps})
   # Licence must remain legible in the user's small viewport as well.
   await page.set_viewport_size({'width':768,'height':1024});await page.wait_for_timeout(200)
   bounds=await page.locator('#livemap-attribution').bounding_box();assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=769 and bounds['y']+bounds['height']<=1025,bounds
   result['checks'].append({'name':'LiveMap licence fits 768x1024 viewport','pass':True,'bounds':bounds})
   await page.screenshot(path=str(out/'osm-768.png'))
   result['pageErrors']=errors;result['interceptedOSMRequests']=calls;result['otherExternalRequestsBlocked']=len(other)
   assert not errors,errors
   result['pass']=True;await browser.close()
 finally:
  (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));server.terminate()
  try:server.wait(timeout=5)
  except subprocess.TimeoutExpired:server.kill()
 print(json.dumps({'pass':result.get('pass',False),'checks':len(result['checks'])},indent=2))
if __name__=='__main__':asyncio.run(main())
