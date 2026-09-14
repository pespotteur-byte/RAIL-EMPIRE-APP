const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cases=[];
for(const scenario of ['electrification-50k','electrification-150k','electrification-150k-mixed','toll-50000']){
 const pair={scenario};
 for(const version of ['RC4','RC5']){
  const out=spawnSync(process.execPath,['--expose-gc',path.join(__dirname,'benchmark-rc5-worker.mjs'),version,scenario],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:2**20});
  if(out.error||out.status!==0)throw Error(out.error?.message||out.stderr||`benchmark exited ${out.status}`);
  pair[version]=JSON.parse(out.stdout.trim());
 }
 if(JSON.stringify(pair.RC4.result)!==JSON.stringify(pair.RC5.result))throw Error(`Result mismatch: ${scenario}`);
 pair.speedup=pair.RC4.medianMs/pair.RC5.medianMs;cases.push(pair);
 console.error(`${scenario}: ${pair.RC4.medianMs.toFixed(3)} -> ${pair.RC5.medianMs.toFixed(3)} ms; x${pair.speedup.toFixed(2)}`);
}
const report={build:'S3_GAMEPLAY_REPAIR_RC5',scope:'Real method microbenchmarks, warm queries on immutable route snapshots; NOT whole-game FPS or capacity. Cold first-call cost recorded separately.',warmupIterations:3,samplesPerVersion:9,isolatedProcesses:true,cpu:os.cpus()[0]?.model,node:process.version,platform:process.platform,architecture:process.arch,cases};
fs.writeFileSync(path.join(root,'QA/RE_REPAIR_RC5/BENCHMARK.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
