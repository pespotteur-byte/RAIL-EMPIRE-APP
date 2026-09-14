import os,shutil,asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]; out=root/'QA/RE_REPAIR_RC24/browser-features'; out.mkdir(parents=True,exist_ok=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=shutil.which('chromium') or 'chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=await b.new_page(viewport={'width':1280,'height':900});page.set_default_timeout(12000)
    errors=[];console=[]
    await page.route('**/*',lambda route:route.abort())
    page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:console.append({'type':m.type,'text':m.text[:500]}) if m.type in ['error','warning'] else None)
    def file_text(src):
      u=urlparse(src); path=(root/unquote(u.path).lstrip('/')).resolve()
      if root not in path.parents or not path.is_file(): raise FileNotFoundError(src)
      return path.read_text()
    await page.expose_function('__readProvidedAsset',file_text)
    html=(root/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I);html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
    html=html.replace('<head>','<head><base href="https://rail-empire.test/"><style>'+(root/'style.css').read_text()+'</style>')
    await page.set_content(html,wait_until='domcontentloaded')
    await page.evaluate('''()=>{const m=new Map(),s={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>Array.from(m.keys())[i],get length(){return m.size;}};Object.defineProperty(window,'localStorage',{value:s});Object.defineProperty(window,'sessionStorage',{value:s});window.fetch=async(src)=>new Response(await window.__readProvidedAsset(String(src)),{status:200});const a=Node.prototype.appendChild;Node.prototype.appendChild=function(n){if(n.tagName==='SCRIPT'&&n.src){window.__readProvidedAsset(n.src).then(c=>{n.removeAttribute('src');n.textContent=c;a.call(this,n);n.dispatchEvent(new Event('load'))});return n;}return a.call(this,n)}}''')
    for script in ['data/railnet/stations/manifest.js','data/railnet/tracks/manifest.js','js/rail-empire.file.bundle.js']:
      await page.add_script_tag(content=(root/script).read_text())
    await page.wait_for_function('window.game && document.querySelector("#btn-new-game")')
    await page.fill('#login-name','RC24 browser features');await page.click('#btn-new-game');await page.wait_for_function('game.running && game.ui')
    # QG component using actual bundled class and hostile text to verify safe rendering + scroll.
    qg=await page.evaluate('''()=>{const {HeadquartersPage}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/qg-page.js','');const host=document.createElement('div');host.style.height='620px';document.body.append(host);const rows=Array.from({length:80},(_,i)=>({id:'S'+i,name:i===0?'<img src=x onerror=window.__xss=1>':'Train '+i,number:String(1000+i),category:'fret',state:'moving',speed:80,delay:0,origin:'A',destination:'B',departure:60,arrival:120,rameName:'R'+i,elements:[{elementId:'e'+i,instanceName:'W'+i,imageData:''}]}));const q=new HeadquartersPage(host,()=>({company:'Test & Co',passengers:123456,freightTonnes:98765.5,clock:'12:34:56',rows}));q.refresh(true);const fleet=host.querySelector('#qg-fleet');fleet.scrollTop=99999;fleet.dispatchEvent(new Event('scroll'));return new Promise(r=>setTimeout(()=>{r({freight:host.querySelector('#qg-freight').textContent,passengers:host.querySelector('#qg-passengers').textContent,count:host.querySelector('#qg-count').textContent,rendered:host.querySelectorAll('.qg-train').length,scrollHeight:fleet.scrollHeight,clientHeight:fleet.clientHeight,xss:!!window.__xss,literal:host.textContent.includes('<img src=x onerror=window.__xss=1>')});q.dispose();host.remove();},40));}''')
    assert qg['xss'] is False and qg['literal'] and '80 / 80' in qg['count'] and '98' in qg['freight']
    # Infogare continuous list + +24h extension + filtering.
    board=await page.evaluate('''()=>{const {RailEmpireBoard}=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/infogare-re.js','');const host=document.createElement('div');host.style.height='650px';document.body.append(host);let lastH=0,calls=0;const mk=(h,a)=>{lastH=h;calls++;return {station:'Paris Test',clock:'10:00',date:'2026-09-13',rows:Array.from({length:Math.min(400,Math.floor(h/4))},(_,i)=>({key:(a?'A':'D')+i,serviceId:'s'+i,name:'Train '+i,number:String(i),category:'passenger',origin:'Origine '+i,destination:i===3?'<b>Destination</b>':'Destination '+i,via:['Via'],platform:String(i%12),plannedMinute:600+i*4,waitMinute:i*4,delay:0,cancelled:false,state:'planned',reason:'',dayOffset:Math.floor((600+i*4)/1440)}))}};const b=new RailEmpireBoard(host,mk);b.show('X');const list=host.querySelector('#re-board-list');list.scrollTop=99999;list.dispatchEvent(new Event('scroll'));host.querySelector('#re-board-search').value='Train 3';host.querySelector('#re-board-search').dispatchEvent(new Event('input'));host.querySelector('#re-board-more').click();return new Promise(r=>setTimeout(()=>{r({lastH,calls,count:host.querySelector('#re-board-count').textContent,rendered:host.querySelectorAll('.re-board-row').length,oldSelector:!!document.querySelector('#infogare-display'),literal:host.textContent.includes('<b>Destination</b>'),xss:!!host.querySelector('b b')});b.dispose();host.remove();},80));}''')
    assert board['lastH']==2880 and not board['oldSelector'] and board['literal'] and not board['xss']
    # Random: locomotives fixed, existing wagon objects permuted, cap enforced in fill.
    rand=await page.evaluate('''()=>{const m=__RAIL_EMPIRE_FILE_BUNDLE__.require('js/rame-random.js','');const loco={category:'locomotive',length:20,elementId:'L'},w1={category:'wagon',length:10,elementId:'W1'},w2={category:'wagon',length:10,elementId:'W2'},w3={category:'wagon',length:10,elementId:'W3'};const rame={id:'R',elementDetails:[loco,w1,w2,w3],elements:['l','1','2','3'],randomizeOnDeparture:true};const before=rame.elementDetails.map(x=>x.elementId);const changed=m.randomizeRameDeparture(rame,'trip-1');const after=rame.elementDetails.map(x=>x.elementId);const again=m.randomizeRameDeparture(rame,'trip-1');const fill=m.planRandomWagons([loco],[{category:'wagon',length:100},{category:'wagon',length:120}],4,{random:()=>0.25});return {before,after,changed,again,locoFixed:after[0]==='L',sameSet:[...after].sort().join(',')===[...before].sort().join(','),fillCount:fill.selected.length+1,fillLength:fill.totalLength};}''')
    assert rand['locoFixed'] and rand['sameSet'] and not rand['again'] and rand['fillCount']<=4 and rand['fillLength']<=750
    # Actual pages visible and scrolling usable at desktop and narrow widths.
    await page.evaluate("game.ui.switchPage('qg')");await page.wait_for_timeout(100);await page.screenshot(path=str(out/'qg.png'),full_page=False)
    await page.evaluate("game.ui.switchPage('infogare')");await page.wait_for_timeout(100);await page.screenshot(path=str(out/'infogare.png'),full_page=False)
    await page.set_viewport_size({'width':375,'height':760});await page.evaluate("game.ui.switchPage('infogare')");await page.screenshot(path=str(out/'infogare-375.png'),full_page=False)
    result={'qg':qg,'board':board,'random':rand,'errors':errors,'console':console[-20:]}
    (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    assert not errors,errors
    await b.close();print(json.dumps(result,ensure_ascii=False))
asyncio.run(main())
