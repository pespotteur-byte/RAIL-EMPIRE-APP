"""Rebuild generated outputs in a separate clean directory and check original assets."""
from pathlib import Path
import shutil,subprocess,json,hashlib,zipfile
root=Path(__file__).resolve().parents[1];out=root/'QA/RE_REPAIR_RC22';clean=root.parent/'RE_RC22_INDEPENDENT_BUILD'
if clean.exists():shutil.rmtree(clean)
clean.mkdir();shutil.copytree(root/'src',clean/'src');(clean/'scripts').mkdir()
for name in ['tsconfig.json','package.json','index.html','admin.html']:shutil.copy2(root/name,clean/name)
for name in ['generate-build-info.cjs','build-file-bundle-v1199.cjs']:shutil.copy2(root/'scripts'/name,clean/'scripts'/name)
modules=[p.relative_to(root/'src/ts').with_suffix('.js') for p in (root/'src/ts').rglob('*.ts') if not p.name.endswith('.d.ts')]
compiled={str(p) for p in modules}
for p in (root/'js').rglob('*.js'):
 rel=p.relative_to(root/'js')
 if '__tests__' in rel.parts or str(rel) in compiled or p.name.endswith('.bundle.js'):continue
 dest=clean/'js'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
with (out/'independent-build.log').open('w') as log:
 for command in [['node','scripts/generate-build-info.cjs'],['tsc','-p','tsconfig.json'],['node','scripts/build-file-bundle-v1199.cjs']]:subprocess.run(command,cwd=clean,stdout=log,stderr=subprocess.STDOUT,check=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=['js/'+str(p) for p in modules]+['types/'+str(p.with_suffix('.d.ts')) for p in modules]+['js/rail-empire.'+n+'.bundle.js' for n in ['file','catalog','admin']]
differences=[name for name in files if sha(root/name)!=sha(clean/name)]
assets=[];assetdiff=[]
with zipfile.ZipFile(root.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC21.zip') as z:
 for info in z.infolist():
  name=info.filename
  if info.is_dir():continue
  # Supplied data, image, audio, style and icon resources; CSS is an intentional change.
  if name.startswith(('assets/','data/','audio/','images/','sounds/','img/')):
   assets.append(name)
   if not (root/name).exists() or hashlib.sha256(z.read(name)).hexdigest()!=sha(root/name):assetdiff.append(name)
result={'pass':not differences and not assetdiff,'modules':len(modules),'declarations':len(modules),'bundles':3,'generatedFilesCompared':len(files),'generatedDifferences':differences,'originalResourcesCompared':len(assets),'resourceDifferences':assetdiff,'cssChangedIntentionally':False,'scope':'Independent TypeScript compilation and bundle construction; no execution guarantee for another platform.'}
(out/'INDEPENDENT_BUILD_AND_RESOURCES.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));assert result['pass']
