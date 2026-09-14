"""Package a complete RC22 tree and verify every archived file against a SHA-256 manifest."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, zipfile, os

root=Path(__file__).resolve().parents[1]
output=root.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC22.zip'
partial=output.with_suffix('.zip.partial')
manifest_name='RC22_SHA256_MANIFEST.json'
sha=lambda data:hashlib.sha256(data).hexdigest()
summary=json.loads((root/'QA/RE_REPAIR_RC22/SUMMARY.json').read_text())
assert summary['pass'] and summary['independentBuild']['pass']
freeze=json.loads((root/'QA/RE_REPAIR_RC22/SOURCE_FREEZE.json').read_text())
for name,digest in freeze['sourceAndBundleHashes'].items():
    assert sha((root/name).read_bytes())==digest, 'Frozen source changed: '+name
paths=sorted(p for p in root.rglob('*') if p.is_file() and p.relative_to(root).as_posix()!=manifest_name)
assert not any(p.is_symlink() for p in paths),'Refusing a symlink in the distributable tree'
files={}
for p in paths:
    data=p.read_bytes();files[p.relative_to(root).as_posix()]={'size':len(data),'sha256':sha(data)}
manifest={'build':summary['build'],'edition':'FULL','algorithm':'SHA-256','scope':'Every packaged file except this manifest itself. Integrity record, not publisher signature.','files':files}
(root/manifest_name).write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Hashed files:',len(files),flush=True)
with zipfile.ZipFile(partial,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
    for p in paths+[root/manifest_name]:
        z.write(p,p.relative_to(root).as_posix())
print('Archive written; verifying CRC and all file digests',flush=True)
with zipfile.ZipFile(partial) as z:
    bad=z.testzip();assert bad is None,('CRC failure',bad)
    stored=json.loads(z.read(manifest_name));assert stored==manifest
    expected=set(files)|{manifest_name};assert set(z.namelist())==expected and len(z.namelist())==len(expected)
    for name,entry in files.items():
        data=z.read(name)
        assert len(data)==entry['size'] and sha(data)==entry['sha256'],'Digest failure: '+name
    count=len(z.infolist())
# Ensure no background job or late edit altered the staged directory while packing.
for name,entry in files.items():
    data=(root/name).read_bytes()
    assert len(data)==entry['size'] and sha(data)==entry['sha256'],'Staging changed during packaging: '+name
assert json.loads((root/manifest_name).read_text())==manifest
os.replace(partial,output)
h=hashlib.sha256()
with output.open('rb') as f:
    for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
result={'build':summary['build'],'archive':output.name,'edition':'FULL','sizeBytes':output.stat().st_size,'sizeMiB':output.stat().st_size/1024**2,'sha256':h.hexdigest(),'crcPass':True,'manifestSha256Pass':True,'filesHashed':len(files),'archiveEntries':count,'manifest':manifest_name,'sourceFreezeVerified':True,'stagedFilesUnchangedDuringPackaging':True,'verifiedUtc':datetime.now(timezone.utc).isoformat(),'pass':True}
(root.parent/'RE_RC22_PACK_INTEGRITY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,indent=2),flush=True)
