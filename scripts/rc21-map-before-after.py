"""Compare the actual RC20/RC21 display selectors. No network or OSM data is used."""
from pathlib import Path
import zipfile, subprocess, json
root=Path(__file__).resolve().parents[1];out=root/'QA/RE_REPAIR_RC21'
base=root.parent/'RC20_MAP_BASELINE';(base/'js').mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC20.zip') as z:
 for name in ['package.json','js/map.js','js/map-source-panel.js','js/tile-access-policy.js']:
  (base/name).write_bytes(z.read(name))
probe="""
import {pathToFileURL} from 'node:url';import path from 'node:path';
const r=process.argv[1];globalThis.location={protocol:'https:'};const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
const {TileMap}=await import(pathToFileURL(path.join(r,'js/map.js')));const {MapSourcePanel}=await import(pathToFileURL(path.join(r,'js/map-source-panel.js')));
const m=new TileMap();m.setNetworkEnabled(false);m.satelliteEnabled=true;m.railEnabled=true;let click;
const root={querySelector:s=>s==='[data-tile-standard]'?{addEventListener:(e,fn)=>{click=fn}}:null,classList:{toggle(){}}};new MapSourcePanel(m,root);click();
const restore={originalStyle:m.basicMode,satellite:m.satelliteEnabled,night:m.nightMapEnabled,orm:m.railEnabled};m.dispose();
const n=new TileMap();n.setNetworkEnabled(false);n.railEnabled=true;n.toggleBasic();const basic={originalStyle:n.basicMode,orm:n.railEnabled};n.dispose();
console.log(JSON.stringify({restore,basic}));
"""
data={}
for key,d in [('RC20',base),('RC21',root)]:
 cp=subprocess.run(['node','--input-type=module','-e',probe,str(d)],cwd=root,text=True,capture_output=True,check=True);data[key]=json.loads(cp.stdout)
assert data['RC20']['restore']['satellite'] and not data['RC21']['restore']['satellite']
assert not data['RC20']['basic']['orm'] and data['RC21']['basic']['orm']
data['pass']=True;data['scope']=__doc__
(out/'MAP_BEFORE_AFTER.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print(json.dumps(data))
