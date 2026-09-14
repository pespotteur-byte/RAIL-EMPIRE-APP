import os,shutil
import asyncio,json,re
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(os.environ.get('RE_GAME_ROOT',str(Path(__file__).resolve().parents[1]))).resolve();out=Path(os.environ.get('AUDIT_OUT',str(Path(__file__).resolve().parents[1]/'reexecution')))/'browser-admin';out.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or 'chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1280,'height':900});errors=[];alerts=[]
  await page.route('**/*',lambda r:r.abort());page.on('pageerror',lambda e:errors.append(str(e)))
  async def dialog(d):
   alerts.append(d.message)
   if d.type=='confirm':await d.accept()
   else:await d.dismiss()
  page.on('dialog',dialog)
  html=re.sub(r'<script\b[^>]*>.*?</script>','',(root/'admin.html').read_text(),flags=re.S|re.I)
  await page.set_content(html,wait_until='domcontentloaded')
  harness=(root/'scripts/test-idb-harness.mjs').read_text().replace('export ','')
  await page.add_script_tag(content='const setImmediate=fn=>setTimeout(fn,0);\n'+harness+'''
    const factory=new TestIDBFactory();Object.defineProperty(window,'indexedDB',{value:factory});globalThis.__testFactory=factory;
    const memory=localMemory();Object.defineProperty(window,'localStorage',{value:memory});
    for(const key of ['admin_catalog_mods','admin_catalog_deleted','admin_catalog_imported','admin_incidents'])memory.setItem(key,'[]');
    memory.setItem('admin_catalog_imported',JSON.stringify([{id:'__RC14_ADMIN',name:'RC14 Évry 🐒 <b>texte</b>',category:'locomotive',traction:'electric',maxSpeed:160,power:6000,mass:84,length:19,notes:'Données conservées'.repeat(200)}]));
  ''')
  await page.add_script_tag(content=(root/'js/rail-empire.admin.bundle.js').read_text())
  await page.wait_for_function("document.querySelector('#admin-storage-status').textContent.includes('compact prêt')",timeout=20000)
  print('Admin ready',flush=True)
  migrated=await page.evaluate("['admin_catalog_mods','admin_catalog_deleted','admin_catalog_imported','admin_incidents'].every(k=>localStorage.getItem(k)===null)")
  assert migrated
  await page.fill('#search','RC14 Évry');await page.dispatch_event('#search','input');await page.wait_for_timeout(500)
  print('Filtered rows:',await page.locator('#tbody').inner_text(),flush=True)
  assert '<b>texte</b>' in await page.locator('#tbody').inner_text()
  assert await page.locator('#tbody b').count()==0
  await page.evaluate("window._editItem('__RC14_ADMIN')");await page.fill('#edit-name','RC14 modifié après commit 🐒');await page.click('#edit-save');await page.wait_for_function("!document.querySelector('#modal-edit').classList.contains('active')")
  saved=await page.evaluate("""async()=>{const db=await openDB('rail-empire-admin-db','datasets');const r=await get(db,'datasets','admin_catalog_mods');const text=await new Response(r.payload.data.stream().pipeThrough(new DecompressionStream('gzip'))).text();return {codec:r.payload.codec,json:text,bytes:r.payload.data.size};}""")
  assert 'modifié après commit' in saved['json'];assert saved['codec']=='RE13/gzip'
  await page.fill('#search','RC14 modifié');await page.dispatch_event('#search','input');await page.wait_for_timeout(400)
  await page.locator('#tbody .row-cb').first.check();await page.click('#btn-delete-selected');await page.wait_for_function("!document.querySelector('#tbody tr[data-id=\"__RC14_ADMIN\"]')")
  deleted=await page.evaluate("""async()=>{const db=await openDB('rail-empire-admin-db','datasets');return !!(await get(db,'datasets','admin_catalog_deleted'));}""");assert deleted
  # On rejected IDB+local writes, do not display an edited item as committed.
  await page.fill('#search','');await page.dispatch_event('#search','input');await page.wait_for_timeout(400)
  ident=await page.locator('#tbody tr[data-id]').first.get_attribute('data-id');await page.evaluate('(id)=>window._editItem(id)',ident)
  original=await page.input_value('#edit-name');await page.fill('#edit-name','DO NOT COMMIT')
  await page.evaluate("()=>{__testFactory.failNextCommit=true;localStorage.setItem=()=>{throw new DOMException('quota','QuotaExceededError')};}")
  await page.click('#edit-save');await page.wait_for_timeout(200)
  assert await page.locator('#modal-edit').evaluate("el=>el.classList.contains('active')")
  await page.click('#edit-cancel');await page.evaluate('(id)=>window._editItem(id)',ident);assert await page.input_value('#edit-name')==original
  assert any('plein' in text for text in alerts),alerts
  await page.screenshot(path=str(out/'admin-rc14.png'))
  report={'pass':True,'harness':'Real release admin bundle, Chromium/native gzip; deterministic in-memory IndexedDB transaction model. Native navigation administratively blocked; no actual browser disk quota certified.','legacyFourKeysMigrated':migrated,'editCommittedBeforeUI':True,'deletionCommittedBeforeUI':deleted,'literalUserHTML':True,'failedWriteDoesNotApplyEdit':True,'pageErrors':errors,'payloadBytesForEditedFixture':saved['bytes']}
  assert not errors,errors
  (out/'admin-rc14.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));await browser.close()
asyncio.run(asyncio.wait_for(main(),timeout=60))
