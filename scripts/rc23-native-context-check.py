import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
r=Path(__file__).resolve().parents[1];out=r/'QA/RE_REPAIR_RC23'
async def main():
 result={'scope':'Actual browser file:// navigation, default platform policies; no server, no security-policy bypass','pass':False}
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page()
  try:
   await page.goto((r/'index.html').as_uri(),wait_until='domcontentloaded',timeout=10000)
   await page.wait_for_function('window.game',timeout=10000)
   result['url']=page.url;result['title']=await page.title();result['text']=(await page.locator('body').inner_text())[:500]
   result['pass']=await page.evaluate('location.protocol === "file:" && !!window.game')
  except Exception as e:result['error']=str(e)
  await b.close()
 (out/'native-file-context.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
asyncio.run(main())
