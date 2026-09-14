"""Seal the verified RC14 developer/runtime directories and verify every ZIP entry.
No data deletion, external requests or changes to browser storage.
Run from the full developer tree after qualification: python scripts/seal-rc14.py
"""
from pathlib import Path
import hashlib,json,zipfile,time,os
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent;LIGHT=OUT/'RE_RC14_LIGHT'
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
summary=json.loads((ROOT/'QA/RE_REPAIR_RC14/SUMMARY.json').read_text())
assert summary['pass'] and summary['tests']['s3']['failedFiles']==0
manifest=ROOT/'QA/FILE_SHA256_MANIFEST.txt'
full_files=sorted(p for p in ROOT.rglob('*') if p.is_file())
manifest.write_text(''.join(f'{digest(p)}  {p.relative_to(ROOT).as_posix()}\n' for p in full_files if p!=manifest))
results=[]
for kind,root,name in [('LIGHT',LIGHT,'Rail_Empire_S3_RC14_LIGHT.zip'),('COMPLETE',ROOT,'Rail_Empire_S3_GAMEPLAY_REPAIR_RC14.zip')]:
 files=sorted(p for p in root.rglob('*') if p.is_file())
 hashes={p.relative_to(root).as_posix():digest(p) for p in files}
 dest=OUT/name;tmp=OUT/(name+'.tmp');start=time.time()
 print('Building',kind,'files',len(files),flush=True)
 with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for p in files:z.write(p,p.relative_to(root).as_posix())
 checked=0
 with zipfile.ZipFile(tmp) as z:
  bad=z.testzip();assert bad is None,bad
  assert len(z.namelist())==len(hashes) and len(set(z.namelist()))==len(hashes)
  for info in z.infolist():
   assert info.filename in hashes
   assert hashlib.sha256(z.read(info)).hexdigest()==hashes[info.filename],info.filename
   checked+=1
  if kind=='COMPLETE':
   lines=z.read('QA/FILE_SHA256_MANIFEST.txt').decode().splitlines()
   assert len(lines)==len(hashes)-1
   for line in lines:
    expected,relative=line.split('  ',1);assert hashes[relative]==expected,relative
 tmp.replace(dest)
 result={'edition':kind,'file':dest.name,'zipBytes':dest.stat().st_size,'zipMiB':dest.stat().st_size/1048576,'sha256':digest(dest),'fileEntries':len(files),'allEntryHashesChecked':checked,'crcAllEntriesPassed':True,'logicalUncompressedBytes':sum(p.stat().st_size for p in files),'seconds':round(time.time()-start,2),'completeManifestEntriesVerified':len(files)-1 if kind=='COMPLETE' else None}
 results.append(result);print(json.dumps(result),flush=True)
(OUT/'RE_RC14_PACK_INTEGRITY.json').write_text(json.dumps({'release':'RC14','pass':True,'method':'ZIP CRC plus SHA-256 of every ZIP member against the sealed source directory; complete SHA manifest checked. This is not a measurement of browser disk files.','archives':results},ensure_ascii=False,indent=2)+'\n')
print('Both archives sealed and verified.',flush=True)
