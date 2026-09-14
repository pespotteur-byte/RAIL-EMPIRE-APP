from pathlib import Path
import subprocess,json,time
r=Path(__file__).resolve().parents[1];o=r/'QA/RE_REPAIR_RC24';results=[]
for key,cmd in [('build-repair',['npm','run','build:repair']),('repair-tests',['npm','run','test:repair']),('standard-tests',['npm','test']),('s3-regression',['npm','run','test:s3-regression'])]:
 start=time.time()
 with (o/(key+'.log')).open('w') as log:
  cp=subprocess.run(cmd,cwd=r,stdout=log,stderr=subprocess.STDOUT)
 results.append({'name':key,'command':cmd,'exitCode':cp.returncode,'elapsedSeconds':time.time()-start})
 (o/'qualification-progress.json').write_text(json.dumps(results,indent=2))
 print(key,cp.returncode,flush=True)
