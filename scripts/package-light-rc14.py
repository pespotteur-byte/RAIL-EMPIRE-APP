"""Build a lossless HTTP-only runtime folder. Never removes user storage or contacts a map provider.
Run from the complete developer tree: python scripts/package-light-rc14.py [output_directory].
"""
from pathlib import Path
import gzip,hashlib,json,re,sys,shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'RE_RC14_LIGHT'
if OUT==ROOT or ROOT in OUT.parents: raise SystemExit('Output must be outside the developer tree.')
if OUT.exists() and any(OUT.iterdir()): raise SystemExit('Output directory must be empty; no automatic overwrite.')
OUT.mkdir(parents=True,exist_ok=True)
selected=[]
for name in ['index.html','admin.html','style.css','VERSION.txt','RELEASE.txt','LANCER_RE.cmd','AIDE_CARTE_OSM.html','LIRE_AVANT_RC14.md','TUTORIEL.md']:
 p=ROOT/name
 if p.exists():selected.append(p)
for directory in ['img','audio','data']:
 selected.extend(sorted(p for p in (ROOT/directory).rglob('*') if p.is_file()))
for rel in ['tools/LocalGameServer.cs','tools/Start-RailEmpire.ps1','scripts/serve-local.cjs','js/light-launch-guard.js','js/rail-empire.file.bundle.js','js/rail-empire.catalog.bundle.js','js/rail-empire.admin.bundle.js']:
 selected.append(ROOT/rel)
records=[]
for p in selected:
 rel=p.relative_to(ROOT).as_posix();raw=p.read_bytes();served=raw
 if rel in ['index.html','admin.html']:
  served=raw.replace(b'</head>',b'  <script defer src="js/light-launch-guard.js?v=1199repair14"></script>\n</head>')
 # Exact lossless byte stream, same URL/content type at the local server. No minifier,
 # property renaming, numeric rewriting or dependency on browser JS compression APIs.
 compact=p.suffix.lower() in ['.js','.json','.css','.csv','.svg'] and rel!='js/light-launch-guard.js' and not rel.startswith('scripts/')
 compressed=gzip.compress(served,compresslevel=9,mtime=0) if compact else served
 use_gzip=compact and len(compressed)<len(served)
 target=rel+'.gz' if use_gzip else rel
 out=OUT/target;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(compressed if use_gzip else served)
 decoded=gzip.decompress(out.read_bytes()) if use_gzip else out.read_bytes()
 if decoded!=served:raise RuntimeError('Packaging changed served content: '+rel)
 records.append({'url':rel,'file':target,'sourceBytes':len(raw),'servedBytes':len(served),'diskFileBytes':out.stat().st_size,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'servedSHA256':hashlib.sha256(served).hexdigest(),'fileSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'gzip':use_gzip,'entryGuardAdded':served!=raw})
manifest={'format':'RE14-LIGHT-MANIFEST','httpRequired':True,'compression':'gzip level 9, deterministic mtime=0; exact source bytes after decoding, except the declared entry guard','sourceBytes':sum(r['sourceBytes'] for r in records),'diskFileBytes':sum(r['diskFileBytes'] for r in records),'files':records,'omissions':'Developer sources, individual JS modules already in the bundles, test/QA history, reference spreadsheets and build tools are in the complete developer archive, not required by this runtime.'}
(OUT/'LIGHT_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
# The full detailed manifest is useful for checking, not for gameplay; gzip it too,
# outside the HTTP route allowlist. Keep a small human-readable summary next to it.
m=OUT/'LIGHT_MANIFEST.json';(OUT/'LIGHT_MANIFEST.json.gz').write_bytes(gzip.compress(m.read_bytes(),compresslevel=9,mtime=0));m.unlink()
summary={'files':len(records),'runtimeSourceBytes':manifest['sourceBytes'],'runtimeStoredFileBytes':manifest['diskFileBytes'],'rawToStoredRatio':manifest['sourceBytes']/manifest['diskFileBytes'],'compressedFiles':sum(r['gzip'] for r in records),'assetsDecodedExactly':True,'guardedEntries':['index.html','admin.html'],'manifest':'LIGHT_MANIFEST.json.gz','httpRequired':True}
(OUT/'LIGHT_SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,indent=2))
