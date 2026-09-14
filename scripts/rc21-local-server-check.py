"""Local asset HTTP headers only: no requests to third-party or OSM hosts."""
from pathlib import Path
import subprocess, urllib.request, json
root=Path(__file__).resolve().parents[1];out=root/'QA/RE_REPAIR_RC21'
code="const {createLocalServer}=require('./scripts/serve-local.cjs');const s=createLocalServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));"
p=subprocess.Popen(['node','-e',code],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 port=int(p.stdout.readline().strip());records=[]
 for name in ['index.html','AIDE_CARTE_OSM.html','style.css','js/map.js']:
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/{name}',timeout=5) as res:
   data=res.read();assert res.status==200
   assert res.headers['Referrer-Policy']=='strict-origin-when-cross-origin'
   records.append({'file':name,'status':res.status,'bytes':len(data),'type':res.headers['Content-Type'],'referrerPolicy':res.headers['Referrer-Policy']})
 result={'pass':True,'scope':__doc__,'files':records,'platform':'Linux / Node 22.16.0; C# Windows launcher unchanged and not executed.'}
 (out/'LOCAL_SERVER_CHECK.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
finally:
 p.terminate();p.wait(timeout=5)
