import asyncio,json,shutil
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('https://**/*',lambda r:r.abort());await page.route('http://**/*',lambda r:r.abort())
  result={'url':(root/'index.html').as_uri()}
  try:
   r=await page.goto((root/'index.html').as_uri(),wait_until='domcontentloaded',timeout=15000)
   result['status']=r.status if r else None;result['title']=await page.title();result['game']=await page.evaluate('!!window.game');result['urlActual']=page.url
  except Exception as e:result['error']=str(e)
  result['errors']=errors
  (root/'QA/RE_REPAIR_RC24/NATIVE_HTML_PROBE.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));await b.close()
asyncio.run(main())
