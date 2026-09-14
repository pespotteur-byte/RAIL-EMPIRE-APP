import asyncio,json,io
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
r=Path(__file__).resolve().parents[1];out=r/'QA/RE_REPAIR_RC22'
buf=io.BytesIO();Image.new('RGBA',(256,256),(48,96,128,255)).save(buf,format='PNG');tile=buf.getvalue()
async def main():
 result={'scope':'Real browser fetch from opaque about:blank origin (Origin:null), responses intercepted; file navigation unavailable. No traffic to OSM, no native file claim.','pass':False,'requests':[]}
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page()
  async def intercept(route):
   q=route.request;result['requests'].append({'method':q.method,'url':q.url,'headers':await q.all_headers()})
   await route.fulfill(status=204 if q.method=='OPTIONS' else 200,body=b'' if q.method=='OPTIONS' else tile,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'X-Requested-With','Access-Control-Max-Age':'600','Content-Type':'image/png','Cache-Control':'public, max-age=604800'})
  await page.route('https://tile.openstreetmap.org/**',intercept)
  await page.set_content('<!doctype html><title>RC22 isolated CORS</title>')
  try:
   result['browser']=await page.evaluate('''async()=>{
    const response=await fetch('https://tile.openstreetmap.org/0/0/0.png',{headers:{'X-Requested-With':'RailEmpire'},credentials:'omit',mode:'cors',cache:'default',referrerPolicy:'strict-origin-when-cross-origin'});
    const blob=await response.blob();const img=new Image();const url=URL.createObjectURL(blob);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});URL.revokeObjectURL(url);
    return {origin:location.origin,protocol:location.protocol,status:response.status,width:img.naturalWidth,height:img.naturalHeight};
   }''')
   result['pass']=result['browser']['width']==256 and any(x['headers'].get('x-requested-with')=='RailEmpire' and x['headers'].get('origin')=='null' and not x['headers'].get('referer') for x in result['requests'])
  except Exception as e:result['error']=str(e)
  await b.close()
 (out/'null-origin-fetch.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
asyncio.run(main())
