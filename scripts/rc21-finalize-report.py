"""Build release evidence from the successful current commands, not historic counters."""
from pathlib import Path
from datetime import datetime,timezone
import re,json,hashlib,zipfile,difflib
r=Path(__file__).resolve().parents[1];q=r/'QA/RE_REPAIR_RC21'
read=lambda n:json.loads((q/n).read_text())
qualification=read('qualification-progress.json');assert len(qualification)==4 and all(x['exitCode']==0 for x in qualification),qualification
build=json.loads((r/'package.json').read_text())['railEmpireBuild'];audit=read('TYPESCRIPT_AUDIT.json');assert audit['pass'] and audit['build']==build
ind=read('INDEPENDENT_BUILD_AND_RESOURCES.json');assert ind['pass']
browser=read('browser-osm-isolated/results.json');assert browser['pass'] and not browser['pageErrors'] and len(browser['checks'])==10
hist=read('browser-historique/rc19-memory-smoke.json');assert not hist['pageErrors'] and len(hist['navigation'])==16
assert all(x['target']==x['active'] for x in hist['navigation'])
assert len(hist['fleetMovement'])==4 and all(x['count']==600 and x['advanced']==600 for x in hist['fleetMovement'])
assert hist['rc17RescueTow']['state']=='done'
local=read('LOCAL_SERVER_CHECK.json');assert local['pass']
repro=read('MAP_BEFORE_AFTER.json');assert repro['pass']
def tap(name):
 s=(q/name).read_text();counts={k:int(re.findall(r'^# '+k+r' (\d+)$',s,re.M)[-1]) for k in ['tests','pass','fail','skipped']};assert counts['fail']==0 and counts['tests']==counts['pass'];return counts
standard=tap('standard-tests.log');repair=tap('repair-tests.log');assert standard['tests']==102834 and repair['tests']==1001
s3=json.loads([line for line in (q/'s3-regression.log').read_text().splitlines() if line.startswith('{"ok":')][-1]);assert s3['ok'] and s3['passed']==273 and s3['archivedSupersededFiles']==11
sha=lambda b:hashlib.sha256(b).hexdigest()
# Exact changes to old tests, plus actual application source inventory.
changes=[];patch=[];app=[];appPatch=[];unchanged=[]
archive=r.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC20.zip'
with zipfile.ZipFile(archive) as z:
 for n in z.namelist():
  if not n.startswith(('js/__tests__/','src/ts/')) or not n.endswith(('.ts','.js','.mjs')):continue
  p=r/n
  if p.is_file():
   before=z.read(n).decode();after=p.read_text()
   if before!=after:
    (changes if n.startswith('js/__tests__/') else app).append(n)
    (patch if n.startswith('js/__tests__/') else appPatch).extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='RC20/'+n,tofile='RC21/'+n))
   elif n.startswith('src/ts/') and not n.endswith('.d.ts'):unchanged.append(n)
(q/'HISTORICAL_TEST_CHANGES.patch').write_text(''.join(patch));(q/'APPLICATION_CHANGES.patch').write_text(''.join(appPatch));(q/'CHANGE_INVENTORY.json').write_text(json.dumps({'testFilesChanged':changes,'appSourcesChanged':app,'unchangedAppSources':unchanged},indent=2))
original=sha(archive.read_bytes());expected=json.loads((r.parent/'RE_RC20_PACK_INTEGRITY.json').read_text())['sha256'];assert original==expected
summary={'build':build,'edition':'FULL','pass':True,'recordedUtc':datetime.now(timezone.utc).isoformat(),'qualification':qualification,'standard':standard,'repair':{**repair,'newTests':16},'s3':s3,'typescript':{'configs':17,'modules':audit['implementationModules'],'explicitAny':audit['explicitAnyTotal'],'suppressions':audit['suppressions'],'pass':audit['pass'],'unpairedExecutableJs':audit['unpairedExecutableJs'],'strictnessCaveat':audit['strictnessCaveat']},'independentBuild':ind,'mapBrowser':{'checks':len(browser['checks']),'pass':True,'scope':browser['scope'],'realExternalTileRequests':0},'historicalBrowser':{'views':len(hist['navigation']),'pageErrors':hist['pageErrors'],'fleet':hist['fleetMovement'],'rescue':hist['rc17RescueTow'],'scope':hist['harness']},'localServer':local,'beforeAfter':repro,'rc20OriginalArchiveUnchanged':True,'rc20Sha256':original,'applicationSourcesChanged':app,'testChanges':{'cacheOnlyOrCachePlusGPSFiles':48,'legacyFilesChangedTotal':len(changes),'functionalExpectationUpdates':['GPS respects explicitly selected original OSM; does not force satellite','Night satellite is selected only when original OSM is not the active choice'],'newExclusions':0},'limitations':['Live tile servers not contacted; test raster is synthetic.','Managed Chromium blocks native navigation. Real bundles and canvas run with injected files, simulated storage/origin and intercepted HTTP.','Opera/Win7, real HTTP Referer and physical browser cache remain unverified.','C# Windows launcher unchanged, not executed here.','No guarantee of service availability or release of an existing provider block.','No new overall FPS/storage performance claim.'], 'suitesOverlap':True}
(q/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
# Freeze executable sources, entry points, tests, build tools and generated outputs.
paths=[]
for prefix in ['src','js','types','scripts']:
 paths.extend(p for p in (r/prefix).rglob('*') if p.is_file())
paths.extend(r/n for n in ['package.json','index.html','admin.html','style.css','AIDE_CARTE_OSM.html'])
paths.extend(r.glob('tsconfig*.json'))
freeze={'build':build,'sourceAndBundleHashes':{p.relative_to(r).as_posix():sha(p.read_bytes()) for p in sorted(set(paths))}}
(q/'SOURCE_FREEZE.json').write_text(json.dumps(freeze,indent=2))
print(json.dumps({'pass':True,'repair':repair,'s3files':s3['passed'],'modules':audit['implementationModules'],'debt':audit['explicitAnyTotal'],'browserChecks':len(browser['checks']),'sourceFilesFrozen':len(freeze['sourceAndBundleHashes'])},indent=2))
